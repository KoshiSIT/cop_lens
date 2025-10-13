# COP-lens ランタイム統合アーキテクチャ

> COP-lens拡張機能のランタイム統合機能の完全な実装解説
> 
> 作成日: 2025-10-13

---

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ全体像](#アーキテクチャ全体像)
3. [境界1: Browser ↔ VSCode Extension](#境界1-browser--vscode-extension)
4. [境界2: VSCode Extension ↔ WebView](#境界2-vscode-extension--webview)
5. [プロトコル変換](#プロトコル変換)
6. [呼び出しチェーン](#呼び出しチェーン)
7. [設計パターン](#設計パターン)
8. [実装ファイル一覧](#実装ファイル一覧)

---

## 概要

COP-lensのランタイム統合機能は、ブラウザで実行中のEMA.jsアプリケーションの**リアルタイムな状態変化**をVSCodeに伝え、依存グラフに反映する機能です。

### 主要機能

- ✅ Layer activation/deactivation の検知
- ✅ Signal値の変化追跡
- ✅ リアルタイムなグラフ更新
- ✅ 詳細パネルへの状態表示

### 技術スタック

- **WebSocket通信**: Browser ↔ VSCode Extension
- **postMessage API**: VSCode Extension ↔ WebView
- **Monkey Patching**: EMA.jsのAPIをフック
- **Event-Driven Architecture**: 非同期イベント処理

---

## アーキテクチャ全体像

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (ブラウザで実行中のEMA.jsアプリ)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ema-devtools-hook.js                                       │
│  ├─ EMA.jsのMonkey Patch                                    │
│  ├─ Layer._enter() / _exit() をフック                      │
│  └─ WebSocket送信                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 境界1: WebSocket (ws://localhost:8765)
                        │ Protocol: JSON (ネスト構造)
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ VSCode Extension (Node.js環境)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WebSocketServer.js                                         │
│  └─ ws.on('message') → messageHandlers実行                 │
│         ↓                                                    │
│  RuntimeEventHandler.js                                     │
│  ├─ handleMessage() - イベント解析                          │
│  ├─ handleLayerActivate() - 処理                           │
│  └─ updateGlobalStore() - プロトコル変換                   │
│         ↓                                                    │
│  DependencyGraphView.js                                     │
│  └─ updateRuntimeStatus() - WebViewに送信                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 境界2: postMessage (VSCode IPC)
                        │ Protocol: JSON (フラット構造)
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ WebView (Chromium iframe内のHTML/JS)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  graphScript.js                                             │
│  └─ window.addEventListener('message')                     │
│         ↓                                                    │
│  runtimeStatusHandler.js                                    │
│  └─ updateLayerRuntimeStatus()                             │
│         ↓                                                    │
│  Cytoscape.js                                               │
│  ├─ ノード追加/更新                                         │
│  ├─ スタイル変更（緑/グレー）                               │
│  └─ 詳細パネル更新                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 境界1: Browser ↔ VSCode Extension

### プロトコル仕様

| 項目 | 内容 |
|------|------|
| **通信方式** | WebSocket (単方向: Browser → VSCode) |
| **エンドポイント** | `ws://localhost:8765` |
| **データ形式** | JSON |
| **プロトコルバージョン** | `1.0.0` |

### イベントタイプ（4種類）

#### 1. Layer Deploy Event (静的)

**タイミング**: `EMA.deploy(layer)` が呼ばれたとき

```json
{
  "type": "layer:deploy",
  "timestamp": 1697123456789,
  "protocolVersion": "1.0.0",
  "data": {
    "layerName": "onlineEditor",
    "condition": "networkStatus === true",
    "hasEnter": true,
    "hasExit": true
  }
}
```

#### 2. Layer Activate Event (動的)

**タイミング**: `Layer._enter()` が実行されたとき

```json
{
  "type": "layer:activate",
  "timestamp": 1697123460000,
  "protocolVersion": "1.0.0",
  "data": {
    "layerName": "onlineEditor",
    "condition": "networkStatus === true",
    "signals": {
      "networkStatus": true,
      "connectionSpeed": 100
    }
  }
}
```

#### 3. Layer Deactivate Event (動的)

**タイミング**: `Layer._exit()` が実行されたとき

```json
{
  "type": "layer:deactivate",
  "timestamp": 1697123465000,
  "protocolVersion": "1.0.0",
  "data": {
    "layerName": "onlineEditor",
    "signals": {
      "networkStatus": false,
      "connectionSpeed": 0
    }
  }
}
```

#### 4. Refinement Add Event (静的)

**タイミング**: `EMA.addPartialMethod()` が呼ばれたとき

```json
{
  "type": "refinement:add",
  "timestamp": 1697123458000,
  "protocolVersion": "1.0.0",
  "data": {
    "layerName": "onlineEditor",
    "className": "EditorWidget",
    "methodName": "save"
  }
}
```

### Monkey Patch実装

```javascript
// ema-devtools-hook.js

// EMA.deploy() をパッチ
const originalDeploy = window.EMA.deploy;
window.EMA.deploy = function(layer) {
    // enter/exitコールバックをラップ
    if (typeof layer.enter === 'function') {
        const originalEnter = layer.enter;
        layer.enter = function() {
            // Signal値を収集
            const signals = collectSignalValues();
            
            // Layer有効化イベントを送信
            devtools.emit('layer:activate', {
                layerName: layer.name,
                condition: layer.condition,
                signals: signals
            });
            
            // 元のenterを実行
            return originalEnter.apply(this, arguments);
        };
    }
    
    // 元の処理を実行
    return originalDeploy.apply(this, arguments);
};
```

### Signal値の収集

```javascript
function collectSignalValues() {
    const signals = {};
    
    // windowオブジェクト全体を探索
    for (const key in window) {
        const obj = window[key];
        
        if (obj && typeof obj === 'object') {
            for (const prop in obj) {
                const value = obj[prop];
                
                // Signalインスタンスを検出
                if (value && typeof value === 'object' && 
                    value.constructor && 
                    value.constructor.name === 'Signal') {
                    
                    signals[prop] = value.value;
                }
            }
        }
    }
    
    return signals;
}
```

---

## 境界2: VSCode Extension ↔ WebView

### プロトコル仕様

| 項目 | 内容 |
|------|------|
| **通信方式** | postMessage API (双方向) |
| **スコープ** | Extension Host ↔ WebView (iframe) |
| **データ形式** | JSON |
| **セキュリティ** | Sandboxed WebView |

### メッセージタイプ

#### Extension → WebView

##### 1. updateRuntimeStatus

**タイミング**: RuntimeEventHandlerがイベントを処理したとき

```json
{
  "command": "updateRuntimeStatus",
  "layerName": "onlineEditor",
  "status": "ACTIVE",
  "signals": {
    "networkStatus": true,
    "connectionSpeed": 100
  },
  "timestamp": 1697123456789
}
```

#### WebView → Extension

##### 1. goToLocation

**タイミング**: ノード/エッジをダブルクリックしたとき

```json
{
  "command": "goToLocation",
  "file": "examples/remote-editor-web/public/js/remote-editor-ema.js",
  "line": 25
}
```

##### 2. showInfo

```json
{
  "command": "showInfo",
  "text": "Graph rendered successfully!"
}
```

##### 3. refresh

```json
{
  "command": "refresh"
}
```

##### 4. export

```json
{
  "command": "export",
  "format": "svg"
}
```

##### 5. logRuntimeUpdate

```json
{
  "command": "logRuntimeUpdate",
  "layerName": "onlineEditor",
  "status": "ACTIVE",
  "signals": { "networkStatus": true },
  "timestamp": 1697123456789
}
```

---

## プロトコル変換

### 変換の必要性

**境界1 (WebSocket)**: 外部システム間通信
- 汎用プロトコル
- バージョン管理必要
- イベント完全情報保持

**境界2 (postMessage)**: 同一システム内通信
- UI特化プロトコル
- バージョン管理不要
- 必要最小限の情報

### 変換プロセス

```javascript
// RuntimeEventHandler.js

handleLayerActivate(event) {
    // 境界1のプロトコル（ネスト構造）
    const { layerName, condition, signals } = event.data;
    
    // 内部状態更新
    this.layerStates.set(layerName, {
        status: 'ACTIVE',
        signals: signals,
        lastUpdate: event.timestamp
    });
    
    // 境界2のプロトコル（フラット構造）に変換
    this.updateGlobalStore(layerName, 'ACTIVE', signals);
}

updateGlobalStore(layerName, status, signals) {
    // DependencyGraphViewに通知
    this.dependencyGraphView.updateRuntimeStatus(
        layerName,   // そのまま
        status,      // 'ACTIVE' に変換（元は event.type）
        signals      // そのまま
    );
}
```

```javascript
// DependencyGraphView.js

updateRuntimeStatus(layerName, status, signals) {
    // postMessageで送信
    this.currentPanel.webview.postMessage({
        command: 'updateRuntimeStatus',  // type → command
        layerName: layerName,
        status: status,                  // 追加（元プロトコルにはない）
        signals: signals,
        timestamp: Date.now()            // 新しいタイムスタンプ
    });
}
```

### 変換内容まとめ

| 項目 | 境界1 | 変換 | 境界2 |
|------|-------|------|-------|
| 識別子 | `type: "layer:activate"` | → | `command: "updateRuntimeStatus"` |
| 構造 | `event.data.layerName` | → | `layerName` (フラット化) |
| 状態 | なし | → | `status: "ACTIVE"` (追加) |
| condition | `event.data.condition` | → | 削除 |
| protocolVersion | `"1.0.0"` | → | 削除 |

---

## 呼び出しチェーン

### 完全なフロー

```
1. Browser: Layer._enter() 実行
   ↓
2. Monkey Patch: devtools.emit('layer:activate', ...)
   ↓
3. WebSocket.send(JSON.stringify(event))
   ↓
4. [WebSocket通信]
   ↓
5. WebSocketServer: ws.on('message', (data) => ...)
   ↓
6. messageHandlers.forEach(handler => handler(message))
   ↓
7. extension.js: runtimeEventHandler.handleMessage(message)
   ↓
8. RuntimeEventHandler: JSON.parse(eventJson)
   ↓
9. RuntimeEventHandler: switch(event.type)
   ↓
10. RuntimeEventHandler: handleLayerActivate(event)
   ↓
11. RuntimeEventHandler: updateGlobalStore(layerName, 'ACTIVE', signals)
   ↓
12. DependencyGraphView: updateRuntimeStatus(layerName, status, signals)
   ↓
13. DependencyGraphView: currentPanel.webview.postMessage({...})
   ↓
14. [VSCode IPC]
   ↓
15. WebView: window.addEventListener('message', event => ...)
   ↓
16. WebView: updateLayerRuntimeStatus(layerName, status, signals)
   ↓
17. Cytoscape.js: ノード更新・スタイル変更
   ↓
18. 詳細パネル: ランタイム状態表示
```

### コールバック登録と実行

#### 起動時（extension.js）

```javascript
// 1. インスタンス作成
const runtimeServer = new RuntimeWebSocketServer(8765);
const runtimeEventHandler = new RuntimeEventHandler(dependencyGraphView);

// 2. サーバー起動
await runtimeServer.start();

// 3. コールバック登録 ★重要★
runtimeServer.onMessage((message) => {
    runtimeEventHandler.handleMessage(message);
});
```

#### WebSocketServer.onMessage()

```javascript
onMessage(handler) {
    this.messageHandlers.push(handler);  // 配列に追加
}
```

#### メッセージ受信時

```javascript
ws.on('message', (data) => {
    const message = data.toString();
    
    // 登録済みの全ハンドラーを実行
    this.messageHandlers.forEach(handler => handler(message));
    //                            ↑
    //            extension.js で登録したコールバック
});
```

---

## 設計パターン

### 1. Observer Pattern (観察者パターン)

```
Subject: WebSocketServer
Observer: RuntimeEventHandler

WebSocketServerがメッセージを受信 → 全Observerに通知
```

**実装**:
```javascript
class WebSocketServer {
    messageHandlers = [];  // Observers
    
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    
    notifyObservers(message) {
        this.messageHandlers.forEach(h => h(message));
    }
}
```

### 2. Callback Pattern (コールバックパターン)

**登録フェーズ（起動時）**:
```javascript
runtimeServer.onMessage((message) => {
    runtimeEventHandler.handleMessage(message);
});
```

**実行フェーズ（メッセージ受信時）**:
```javascript
messageHandlers.forEach(handler => handler(message));
```

### 3. Event-Driven Architecture

```
イベント発生 → 非同期処理 → ハンドラー実行
```

### 4. Monkey Patching

```javascript
// 元のメソッドを保存
const originalMethod = obj.method;

// 新しいメソッドで置き換え
obj.method = function() {
    // 追加処理
    console.log('Before');
    
    // 元のメソッドを実行
    const result = originalMethod.apply(this, arguments);
    
    // 追加処理
    console.log('After');
    
    return result;
};
```

### 5. Protocol Translation Pattern

```
外部プロトコル → 内部プロトコル
(汎用・厳密)     (特化・簡潔)
```

---

## 実装ファイル一覧

### ブラウザ側

| ファイル | 役割 |
|---------|------|
| `src/runtime/hooks/ema-devtools-hook.js` | Monkey Patch、WebSocket送信 |

### VSCode Extension側

| ファイル | 役割 |
|---------|------|
| `src/runtime/WebSocketServer.js` | WebSocketサーバー |
| `src/runtime/RuntimeEventHandler.js` | イベント処理、プロトコル変換 |
| `src/runtime/types.ts` | 型定義 |
| `src/ui/dependencyGraphView.js` | WebView管理、postMessage送信 |
| `extension.js` | 統合、コールバック登録 |

### WebView側

| ファイル | 役割 |
|---------|------|
| `src/ui/templates/graphScript.js` | メッセージ受信 |
| `src/ui/handlers/runtimeStatusHandler.js` | ランタイム状態更新 |
| `src/ui/handlers/graphEventHandler.js` | ノードクリックイベント |

---

## まとめ

### 実装の特徴

1. **2つの境界**
   - 境界1: WebSocket（Browser ↔ Extension）
   - 境界2: postMessage（Extension ↔ WebView）

2. **異なるプロトコル**
   - 境界1: ネスト構造、バージョン管理あり
   - 境界2: フラット構造、UI特化

3. **プロトコル変換**
   - RuntimeEventHandlerが中間層として変換
   - 各境界に最適化されたプロトコル

4. **疎結合設計**
   - Observer Pattern
   - Callback Pattern
   - 各コンポーネントが独立

5. **リアルタイム性**
   - 非同期イベント駆動
   - WebSocket + postMessage
   - 即座にUI反映

### 設計の利点

- ✅ **拡張性**: 新しいイベントタイプの追加が容易
- ✅ **保守性**: 各層が独立して変更可能
- ✅ **テスト容易性**: 各コンポーネントを個別にテスト可能
- ✅ **パフォーマンス**: 非同期処理で高速
- ✅ **セキュリティ**: WebView Sandboxing

---

## 参考資料

- [VSCode WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Observer Pattern](https://refactoring.guru/design-patterns/observer)
