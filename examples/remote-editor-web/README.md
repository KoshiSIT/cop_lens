# Remote Editor Web - COP Trace Demo

Phase 1のUIプロトタイプ：COPの実行トレース支援機能のテスト用Webアプリケーション

## 概要

このアプリケーションは、Context-Oriented Programming (COP)の実行時動作を可視化するためのデモ環境です。
Online/Offlineの状態切り替えによって、EditorWidgetの`save()`メソッドの振る舞いが動的に変わることを体験できます。

## 機能

### 現在の実装（Phase 1）

- ✅ Online/Offline状態のトグルスイッチ
- ✅ テキストエディタUI
- ✅ Saveボタン
- ✅ コンソールログでの動作確認
- ⚠️ 実際のLayer動作なし（モック）

### 今後の実装（Phase 2以降）

- ⏳ 実際のEMAjs統合
- ⏳ WebSocketによるVSCode連携
- ⏳ リアルタイムトレース送信
- ⏳ 依存グラフへの状態反映

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. サーバー起動

```bash
npm start
```

### 3. ブラウザで開く

```
http://localhost:3000
```

## 使い方

1. **ブラウザで開く**: `http://localhost:3000`にアクセス
2. **状態切り替え**: トグルスイッチでOnline/Offlineを切り替え
3. **テキスト入力**: エディタエリアに任意のテキストを入力
4. **Save実行**: 💾 Save Documentボタンをクリック
5. **ログ確認**: ブラウザのDevTools Consoleで動作ログを確認

## 期待される動作

### Offlineモード
```
⚪ Switched to OFFLINE mode
   → layerOnlineEditor: INACTIVE

📝 Save button clicked in OFFLINE mode
   → Executing: EditorWidget.save() (original)
   → Saving to localStorage...
   ✅ Saved to localStorage only
```

### Onlineモード
```
🟢 Switched to ONLINE mode
   → layerOnlineEditor: ACTIVE

📝 Save button clicked in ONLINE mode
   → Executing: layerOnlineEditor.save()
   → Sending to server...
   → Layer.proceed() → original save()
   → Saving to localStorage...
   ✅ Saved to server AND localStorage
```

## ファイル構成

```
remote-editor-web/
├── server.js           # Expressサーバー
├── package.json        # 依存関係
├── README.md          # このファイル
└── public/
    └── index.html     # UIとロジック（1ファイル完結）
```

## 技術スタック

- **フロントエンド**: 純粋なHTML/CSS/JavaScript（フレームワークなし）
- **バックエンド**: Node.js + Express
- **通信**: なし（Phase 2でWebSocket追加予定）

## 開発ロードマップ

### Phase 1: UIプロトタイプ ✅（現在）
- [x] 基本UI作成
- [x] 状態切り替え機能
- [x] モックの動作確認

### Phase 2: EMAjs統合
- [ ] EMAjsライブラリの組み込み
- [ ] 実際のLayer動作
- [ ] Refinementの実行

### Phase 3: トレース機能
- [ ] EMAjsへのフック追加
- [ ] トレース情報の収集
- [ ] WebSocket通信

### Phase 4: VSCode連携
- [ ] VSCode Extension側の実装
- [ ] リアルタイム依存グラフ更新
- [ ] 実行経路のハイライト

## トラブルシューティング

### サーバーが起動しない
```bash
# ポート3000が使用中の場合
# server.jsのPORTを変更してください
const PORT = 3001;
```

### ブラウザで表示されない
- ブラウザのキャッシュをクリア
- DevToolsで404エラーがないか確認

## ライセンス

ISC
