# COP Debug Tool 実装計画（更新版）

## 現在の進捗状況
✅ 1. プロジェクト初期化 - 完了
✅ 2. package.json設定 - 完了  
🎯 3. 現在作業中: AST検出ファイル作成（Layersパターン検出）

## 更新された作業チェックリスト

### 1. プロジェクト初期化 ✅
* ✅ コマンドライン実行: `npx --package yo --package generator-code -- yo code`
* ✅ 選択: New Extension (TypeScript) → JavaScript版で実装
* ✅ 名前入力: COP Lens
* ✅ identifier確認: cop-lens
* ✅ 生成されたフォルダ構造確認

### 2. package.json設定 ✅  
* ✅ package.jsonを開く
* ✅ `activationEvents`セクション設定: `"onLanguage:javascript"`
* ✅ `contributes`セクションに`views`プロパティ追加
* ✅ explorerビューに`copOverview`という新しいビュー定義追加
* ✅ ビューの表示条件をJavaScript/TypeScriptファイル時に設定
* ✅ `cop-lens.goToLine`コマンド追加

### 3. テスト用ファイル準備（優先実装）🎯
* ⏳ `test-samples`フォルダ作成
* ⏳ `test-samples/example7.js`ファイル作成（実際のCOPコード）
* [ ] 複数パターンのテストファイル作成

### 4. AST検出ファイル作成（Layer検出特化）🎯
* ✅ `src`フォルダ内に`parser`フォルダ作成
* ⏳ `parser`フォルダ内に`layerDetector.js`ファイル作成（TypeScript→JavaScript変更）
* [ ] vscodeモジュールをインポート
* [ ] LayerResult インターフェース定義 (line, layerName, condition, type)
* [ ] detectLayers関数の基本構造作成
* [ ] JavaScript AST解析（esprima/acorn使用検討）
* [ ] AST走査でVariableDeclaration検索
* [ ] オブジェクトに`condition`プロパティがあるかチェック
* [ ] EMA.deploy()呼び出し検出
* [ ] new Signal()検出
* [ ] 検出結果を配列で返す処理

### 5. TreeView Provider作成
* ✅ `src`フォルダ内に`ui`フォルダ作成  
* [ ] `ui`フォルダ内に`treeProvider.js`ファイル作成
* [ ] COPTreeProviderクラス定義
* [ ] vscode.TreeDataProviderインターフェース実装
* [ ] _onDidChangeTreeDataイベント定義
* [ ] updateResultsメソッド作成
* [ ] getTreeItemメソッド実装 - 階層構造対応
  * [ ] 📋 Layers カテゴリ
  * [ ] 🔧 EMA Operations カテゴリ  
  * [ ] 📡 Signals カテゴリ
* [ ] getChildrenメソッド実装 - 結果をツリー項目に変換
* [ ] COPTreeItemクラス定義
* [ ] TreeItemにクリック時のコマンド設定

### 6. extension.js修正
* [ ] extension.jsファイルを開く
* [ ] 作成したファイルをインポート（require形式）
* [ ] activate関数内でTreeProviderインスタンス作成
* [ ] window.registerTreeDataProviderで登録
* [ ] goToLineコマンドを定義・登録
* [ ] onDidChangeActiveTextEditorイベントリスナー追加
* [ ] updateAnalysis関数作成
* [ ] 関数内でdetectLayers呼び出し
* [ ] 結果をTreeProviderに渡す処理
* [ ] 初回解析実行
* [ ] subscriptionsに各リスナーを追加

### 7. ローカル実行テスト
* [ ] F5キーでExtension Development Host起動
* [ ] 新しいVS Codeウィンドウの起動確認
* [ ] example7.jsファイルを開く
* [ ] エクスプローラーサイドバー表示
* [ ] "COP Overview"セクションの存在確認
* [ ] 検出された項目数の確認
* [ ] 項目の表示内容確認：
  * [ ] 📋 Layers
  * [ ] └── landscape (line 25) → condition: "gyroLevel > 45"

### 8. Layer検出機能の動作確認
* [ ] TreeView項目をクリック
* [ ] 該当行にカーソルが移動することを確認
* [ ] 他のJavaScriptファイルを開く
* [ ] TreeViewが更新されることを確認
* [ ] JavaScript以外のファイルでTreeViewが空になることを確認

### 9. デバッグ確認
* [ ] Ctrl+Shift+I でDeveloper Console開く
* [ ] Console タブ選択
* [ ] "COP Debug Tool activated"メッセージの確認
* [ ] "Detected X layers"メッセージの確認
* [ ] エラーメッセージがないことを確認

### 10. 基本機能テスト（Layer検出）
* [ ] 拡張機能が正常にロードされる
* [ ] Layer構文（`condition`プロパティ）を正しく検出する
* [ ] TreeViewに結果が表示される
* [ ] クリックでナビゲーションが動作する
* [ ] ファイル切り替えでTreeViewが更新される
* [ ] コンソールにエラーが出力されない

## 検出パターンの優先度（更新）

### Phase 1: Layer検出（現在の目標）
1. **高優先度**: 
   - `condition`プロパティを持つオブジェクトの検出
   - レイヤー名（変数名）の特定
   - 行番号の取得

### Phase 2: EMA Operations検出（次期目標）
2. **中優先度**:
   - `EMA.deploy()`呼び出し検出
   - `EMA.addPartialMethod()`呼び出し検出

### Phase 3: Signals検出（将来目標）
3. **低優先度**:
   - `new Signal()`定義検出
   - Signal値変更検出

## 技術スタック更新
- **言語**: JavaScript (TypeScriptから変更)
- **AST解析**: acorn/esprima検討
- **VS Code API**: TreeDataProvider, commands, views
- **テスト**: example7.jsベースの実際のCOPコード