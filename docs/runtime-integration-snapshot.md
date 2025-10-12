---
作成日: 2025-10-13
バージョン: 1
---

# COP-lens ランタイム統合機能開発 - スナップショット

## 🎯 現在の主要な目的

**VSCodeでCOPのランタイム状態をリアルタイムに可視化する**

ブラウザで実行中のEMA.jsアプリケーションのLayer activate/deactivateをVSCodeの依存グラフで表示する機能を実装中。

## ✅ 達成済み

### 通信基盤（完全に動作）
- WebSocket通信（port 8765）✅
- イベント送信・受信 ✅
- ロギングシステム（`.cop-lens-debug.log`）✅

### 確認済みログ
```
🟢 Layer activated: onlineEditor
[UI] Updating runtime status: onlineEditor -> ACTIVE
⚪ Layer deactivated: onlineEditor  
[UI] Updating runtime status: onlineEditor -> INACTIVE
```

**ブラウザ→VSCode間の通信は完璧に動作！**

## ❌ 未解決の問題（最優先）

### 依存グラフWebViewの構文エラー

**現象：**
- 依存グラフが真っ白（何も表示されない）
- エラー: `index.html:1239 Uncaught SyntaxError: Invalid or unexpected token`

**原因：**
- `dependencyGraphView.js`のHTMLテンプレート内に構文エラー

**試したこと：**
- `contentText.indexOf('\n')`エスケープ修正 ✅
- ランタイム機能を一時無効化 ✅
- まだエラーが残っている ❌

**次のステップ：**
1. HTMLテンプレート全体の文字列エスケープをチェック
2. 最近追加した`updateLayerRuntimeStatus`関数周辺を確認
3. または段階的にロールバック

## 📋 実装したファイル

1. `src/runtime/WebSocketServer.js`
2. `src/runtime/RuntimeEventHandler.js`
3. `src/runtime/hooks/ema-devtools-hook.js`
4. `src/ui/dependencyGraphView.js` (Runtime Status UI追加)
5. `src/utils/logger.js` (ロギングシステム)
6. `extension.js` (統合)
7. `examples/remote-editor-web/public/index.html` (フック追加)

## 🔑 重要な技術的発見

### EMA.jsの動作
- `Layer.prototype.activate()`は**使われていない**
- Signalの変化で自動的に`layer._enter()`が呼ばれる
- したがって`EMA.deploy()`で`enter`/`exit`をラップする必要がある

### 読み込み順序
```javascript
// index.htmlで正しい順序
await import('./js/ema/loader.js');      // EMA.jsをグローバルに公開
await import('./ema-devtools-hook.js');  // パッチ適用
await import('./js/app.js');             // アプリ起動
```

## 📝 テスト手順

1. VSCode拡張を再起動（Shift+F5 → F5）
2. 依存グラフを開く
3. ブラウザアプリ起動（`npm start`）
4. トグル操作
5. ログ確認：`cat examples/.cop-lens-debug.log`

## 🌳 Git状態

- ブランチ: `feature/runtime-monkey-patch`
- 最新: `54e74c7 debug: ランタイム機能を一時的に無効化`
