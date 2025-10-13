---
作成日: 2025-10-13
バージョン: 2
---

# COP-lens ランタイム統合機能 - アーキテクチャとフロー

## 🎯 概要

ブラウザで実行中のEMA.jsアプリケーションのLayer activate/deactivateイベントをVSCodeにリアルタイム送信し、依存グラフで可視化する機能。

## 📊 全体データフロー

```
【ブラウザ側】
ユーザー操作（トグルクリック）
    ↓
app.js: toggle.addEventListener('change')
    ↓
RemoteEditor.goOnline() / goOffline()
    ↓
this.networkStatus.value = true/false  ← Signal変化
    ↓
EMA.js: Layer.enableCondition()
    ↓ (条件評価)
layer._enter() または layer._exit()
    ↓ (Monkey Patchでフック)
ema-devtools-hook.js: layer.enter/exit ラッパー
    ↓
WebSocket送信（port 8765）
    ↓
【VSCode側】
WebSocketServer.js: メッセージ受信
    ↓
RuntimeEventHandler.js: イベント処理
    ↓
logger.js: ログ記録 + DependencyGraphView.updateRuntimeStatus()
    ↓
WebView: postMessage
    ↓
graphScript.js: updateLayerRuntimeStatus()
    ↓
【UI更新】
1. グラフに動的ノード追加/更新
2. 詳細パネルにActivation状態表示
```

## 🏗️ アーキテクチャ

### ブラウザ側コンポーネント

#### 1. `ema-devtools-hook.js`（Monkey Patch）
**役割:** EMA.jsのAPIをフックしてイベントを検知

**パッチ対象:**
```javascript
EMA.deploy(layer) {
    // layer.enter をラップ
    layer.enter = function() {
        sendActivateEvent();  // ← 追加処理
        originalEnter.apply(this, arguments);
    };
    
    // layer.exit をラップ
    layer.exit = function() {
        sendDeactivateEvent(); // ← 追加処理
        originalExit.apply(this, arguments);
    };
}
```

**なぜ`layer.enter`/`exit`をフックするのか:**
- EMA.jsは`Layer.prototype.activate()`メソッドを持たない
- Signalの変化で自動的に`layer._enter()`/`_exit()`が呼ばれる
- `enableCondition()`内で以下のように処理される:

```javascript
// Layer.js の enableCondition()
this._cond.on(function (active) {
    if (active !== thiz._active) {
        thiz._active = active;
        if (thiz._active) {
            thiz._enter();  // ← activate時
            thiz._installPartialMethod();
        } else {
            thiz._exit();   // ← deactivate時
            thiz._uninstallPartialMethods();
        }
    }
});
```

**代替案の検討:**
- `_active`プロパティを監視する方法も可能
- しかし`enter`/`exit`フックの方が:
  - ✅ タイミングが正確
  - ✅ ユーザー定義コールバックも検出
  - ✅ EMA.jsの設計思想に合致

#### 2. WebSocket接続
**役割:** VSCodeとの双方向通信

**実装:**
```javascript
class DevToolsConnection {
    connect() {
        this.ws = new WebSocket('ws://localhost:8765');
    }
    
    emit(type, data) {
        this.ws.send(JSON.stringify({
            type: type,
            timestamp: Date.now(),
            data: data
        }));
    }
}
```

**イベントタイプ:**
- `layer:deploy` - Layer配備時
- `layer:activate` - Layer有効化時
- `layer:deactivate` - Layer無効化時
- `refinement:add` - Refinement追加時

### VSCode側コンポーネント

#### 1. `WebSocketServer.js`
**役割:** WebSocketサーバーの管理

**主要機能:**
- port 8765でリッスン
- 接続管理（複数クライアント対応）
- メッセージのパース・検証
- イベントハンドラーへのディスパッチ

#### 2. `RuntimeEventHandler.js`
**役割:** 受信イベントの処理とログ記録

**主要メソッド:**
```javascript
handleLayerDeploy(data)      // Layer配備
handleLayerActivate(data)    // Layer有効化
handleLayerDeactivate(data)  // Layer無効化
handleRefinementAdd(data)    // Refinement追加
updateRuntimeStatus(layerName, status) // UI更新
```

**状態管理:**
- `runtimeState` Map: Layer名 → 状態
- ログファイルに永続化

#### 3. `DependencyGraphView.js`
**役割:** WebViewへのメッセージ送信

**メソッド:**
```javascript
updateRuntimeStatus(layerName, status, signals) {
    this.currentPanel.webview.postMessage({
        command: 'updateRuntimeStatus',
        layerName: layerName,
        status: status,
        signals: signals
    });
}
```

### WebView側コンポーネント（リファクタリング後）

#### 1. `graphScript.js`
**役割:** スクリプト生成の統括

**構造:**
```javascript
generateGraphScript(config) {
    return `
        ${generateDebugCode()}
        ${generateCytoscapeInitCode()}
        ${generateHelperFunctions()}
        ${generateNodeDetailHandler()}
        ${generateRuntimeStatusHandler()}
        ${generateEventHandlers()}
        ${generateMessageListener()}
    `;
}
```

#### 2. `runtimeStatusHandler.js`
**役割:** ランタイム状態更新ロジック

**主要機能:**
- グラフに動的ノード追加/更新
- ノードスタイル変更（緑/灰色）
- 詳細パネルの状態表示更新

#### 3. `nodeDetailHandler.js`
**役割:** ノード詳細パネルの表示

**表示内容:**
- 🟢 Activation: ACTIVE/INACTIVE
- Signal値
- 更新時刻（X秒前）
- 基本情報、メソッド一覧など

## 🔑 重要な技術的決定

### 1. なぜMonkey Patchか？

**理由:**
- EMA.jsはライブラリとして提供され、コア実装を変更できない
- 既存アプリケーションに影響を与えずに監視機能を追加
- DevToolsフックは開発時のみ有効化

**実装タイミング:**
```html
<script type="module">
    await import('./js/ema/loader.js');      // 1. EMA.js読み込み
    await import('./ema-devtools-hook.js');  // 2. パッチ適用
    await import('./js/app.js');             // 3. アプリ起動
</script>
```

### 2. なぜWebSocketか？

**理由:**
- リアルタイム双方向通信が必要
- ブラウザ→VSCode間でHTTPリクエストは不向き
- WebSocketは低遅延・低オーバーヘッド

**代替案:**
- ❌ HTTP Polling: 遅延が大きい
- ❌ Server-Sent Events: 単方向のみ
- ✅ WebSocket: リアルタイム双方向

### 3. WebView内でスクリプトを文字列生成する理由

**VSCodeのWebView制約:**
- WebViewは完全に隔離されたブラウザ環境
- ローカルファイルシステムに直接アクセスできない
- `<script src="./file.js">`が使えない

**解決策:**
- JavaScriptコードを文字列として生成
- HTMLに埋め込んで`webview.html = ...`で渡す

**リファクタリング:**
- スクリプト生成関数を別ファイルに分離
- 機能ごとにハンドラーファイルを作成
- メインファイルは274行に削減（元1200行）

## 📁 ファイル構成

### ブラウザ側
```
examples/remote-editor-web/public/
├── ema-devtools-hook.js (361行)
│   ├── WebSocket接続管理
│   ├── EMA.deploy()パッチ
│   └── イベント送信
├── js/
│   ├── app.js - UI制御
│   ├── RemoteEditor.js - アプリロジック
│   └── ema/ - EMA.jsライブラリ
└── index.html - 読み込み順序制御
```

### VSCode側
```
src/
├── runtime/
│   ├── WebSocketServer.js (184行)
│   ├── RuntimeEventHandler.js (231行)
│   └── types.ts (型定義)
├── ui/
│   ├── dependencyGraphView.js (274行) ← 元1200行
│   ├── templates/
│   │   ├── graphStyles.js (333行)
│   │   ├── graphTemplate.js (117行)
│   │   └── graphScript.js (200行)
│   └── handlers/
│       ├── nodeDetailHandler.js (150行)
│       ├── runtimeStatusHandler.js (100行)
│       └── graphEventHandler.js (100行)
└── utils/
    └── logger.js (120行)
```

## 🎓 学んだこと

### EMA.jsの動作原理
- Layerは`_active`プロパティで状態管理
- Signalの変化で`enableCondition()`が`_enter`/`_exit`を呼ぶ
- `Layer.activate()`メソッドは存在しない（暗黙的活性化のみ）

### WebViewの制約
- 隔離された実行環境
- 外部JSファイルを読み込めない
- 文字列生成が唯一の方法

### リファクタリングの効果
- 1200行 → 274行（77%削減）
- 機能ごとに分離
- 変更箇所が明確
- Git diffが読みやすい

## 🚀 今後の改善案

### 短期
- [ ] Signal値の正確な取得
- [ ] 複数Layer同時監視のテスト
- [ ] エラーハンドリング強化

### 中期
- [ ] タイムライン表示
- [ ] Layer依存関係の可視化
- [ ] パフォーマンス最適化

### 長期
- [ ] Web Componentsへの移行検討
- [ ] 他のCOPフレームワーク対応
- [ ] ブレークポイント機能

## 📊 成果

### 実装完了
- ✅ WebSocket通信基盤
- ✅ Monkey Patchによるイベント検知
- ✅ リアルタイムUI更新
- ✅ ログシステム
- ✅ 大規模リファクタリング

### 動作確認済み
- ✅ Layer activate/deactivate検知
- ✅ グラフへの動的ノード追加
- ✅ 詳細パネルの状態表示
- ✅ リアルタイム更新

### ドキュメント
- ✅ 実装スナップショット
- ✅ リファクタリングドキュメント
- ✅ アーキテクチャ図（本文書）
- ✅ 代替実装案の記録
