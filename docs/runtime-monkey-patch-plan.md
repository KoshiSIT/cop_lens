# Runtime Monkey Patch Implementation Plan

## Overview
ユーザーが1行追加するだけで、実行時のLayer状態をリアルタイムで監視できる機能

## Architecture

```
Browser                          VSCode Extension
┌─────────────────┐             ┌──────────────────┐
│ EMA.js (patched)│             │ WebSocket Server │
│                 │             │   :8765          │
│ Layer.activate()│  WebSocket  │                  │
│   → hook        │────────────→│ EventHandler     │
│   → send event  │             │   → GlobalStore  │
│                 │             │   → UI update    │
└─────────────────┘             └──────────────────┘
```

## Files to Create

### 1. src/runtime/types.ts
イベントプロトコル定義
- RuntimeEvent型
- LayerActivateEvent, LayerDeactivateEvent
- 将来の拡張性を考慮

### 2. src/runtime/WebSocketServer.ts
WebSocketサーバー
- ポート8765でリスン
- メッセージ受信
- クライアント管理

### 3. src/runtime/RuntimeEventHandler.ts
イベント処理
- イベントパース
- GlobalStore更新
- エラーハンドリング

### 4. src/runtime/hooks/ema-devtools-hook.js
ブラウザ側フック（純粋なJavaScript）
- EMA API検出・待機
- Monkey Patch適用
- WebSocket接続・送信

**Note:** これが唯一のフック本体。サンプルはこれを参照する。

### 5. extension.js (更新)
- WebSocketサーバー起動
- RuntimeEventHandler統合

### 6. src/ui/dependencyGraphView.js (更新)
- 詳細パネルにランタイム状態表示
- Layer Status: ACTIVE/INACTIVE
- Signal values

## Implementation Steps

### Step 1: 型定義 (15min)
```typescript
// src/runtime/types.ts
export interface RuntimeEvent {
  type: string;
  timestamp: number;
}

export interface LayerActivateEvent extends RuntimeEvent {
  type: 'layer:activate';
  data: {
    layerName: string;
    condition: string;
    signals: Record<string, any>;
  };
}

export interface LayerDeactivateEvent extends RuntimeEvent {
  type: 'layer:deactivate';
  data: {
    layerName: string;
  };
}
```

### Step 2: WebSocketサーバー (30min)
```typescript
// src/runtime/WebSocketServer.ts
import WebSocket from 'ws';

export class RuntimeWebSocketServer {
  private wss: WebSocket.Server | null = null;
  
  start(port: number): Promise<void>
  stop(): Promise<void>
  onMessage(handler: (data: string) => void): void
  hasClients(): boolean
}
```

### Step 3: ブラウザ側フック (1h)
```javascript
// src/runtime/hooks/ema-devtools-hook.js
(function() {
  // 1. WebSocket接続
  // 2. EMA.js検出待機
  // 3. Monkey Patch適用
  //    - Layer.prototype.activate
  //    - Layer.prototype.deactivate
  // 4. イベント送信
})();
```

### Step 4: イベントハンドラー (30min)
```typescript
// src/runtime/RuntimeEventHandler.ts
export class RuntimeEventHandler {
  handleEvent(event: RuntimeEvent): void
  updateLayerStatus(layerName: string, status: 'ACTIVE' | 'INACTIVE'): void
}
```

### Step 5: extension.js統合 (30min)
```javascript
// extension.js
const runtimeServer = new RuntimeWebSocketServer();
const eventHandler = new RuntimeEventHandler();

runtimeServer.start(8765);
runtimeServer.onMessage((data) => {
  const event = JSON.parse(data);
  eventHandler.handleEvent(event);
});
```

### Step 6: UI更新 (30min)
詳細パネルに追加:
```
Layer: onlineLayerDefinition
Status: 🟢 ACTIVE
Signals:
  networkConnected: true
```

### Step 7: サンプル統合 (30min)
```html
<!-- examples/remote-editor-web/public/index.html -->
<script src="./js/ema/loader.js"></script>
<script src="./ema-devtools-hook.js"></script>
<script type="module" src="./js/app.js"></script>
```

## Testing Plan

### Manual Test
1. VSCode拡張起動
2. `npm start`でサンプルアプリ起動
3. ブラウザでhttp://localhost:3000
4. コンソールで接続確認: "✅ EMA DevTools connected"
5. Onlineトグル操作
6. VSCodeの詳細パネルで"Status: ACTIVE"確認

### Edge Cases
- EMA.jsが読み込まれない
- WebSocketサーバーが起動していない
- 複数のLayerが同時にactivate
- Signal値の型が複雑な場合

## Documentation

### README.md に追加
```markdown
## Runtime Monitoring (Experimental)

Monitor Layer activation in real-time!

### Setup
1. Copy `src/runtime/hooks/ema-devtools-hook.js` to your project
2. Add to HTML: `<script src="./ema-devtools-hook.js"></script>`
3. Run your app
4. See live status in COP Dependency Graph view
```

## Timeline

- Day 1 AM: Step 1-3 (基盤実装)
- Day 1 PM: Step 4-5 (統合)
- Day 2 AM: Step 6-7 (UI・サンプル)
- Day 2 PM: Testing & Documentation

Total: ~4 hours of focused work
