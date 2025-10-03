# OOP依存グラフ実装計画

## 🎯 目標
**online-editor.js と remote-editor-ema.js のオブジェクト関係を依存グラフで可視化**

## 📊 実装段階

### **Phase 1: データ検出エンジン**

#### **1.1 ObjectDependencyDetector 実装**
- **ファイル**: `src/parser/objectDependencyDetector.js`
- **継承**: `BaseDetector` を拡張
- **検出対象**:
  ```javascript
  // Composition検出
  this.editor = new Editor();
  
  // Aggregation検出  
  constructor(editor) { this.editor = editor; }
  
  // Association検出
  this.editor.save(content);
  
  // Instantiation検出
  createWidget() { return new EditorWidget(); }
  ```

#### **1.2 DependencyGraph データ構造**
- **ファイル**: `src/graph/dependencyGraph.js`
- **データ形式**:
  ```javascript
  {
    nodes: [
      {
        id: "RemoteEditor",
        name: "RemoteEditor", 
        type: "class",        // "class" | "instance"
        file: "remote-editor-ema.js",
        line: 15,
        description: "メインオーケストレータ"
      }
    ],
    edges: [
      {
        source: "RemoteEditor",
        target: "Editor", 
        type: "composition",   // "composition" | "aggregation" | "association" | "instantiation"
        property: "editor",
        file: "remote-editor-ema.js", 
        line: 22,
        description: "this.editor = new Editor()"
      }
    ]
  }
  ```

#### **1.3 検出ルール定義**
```javascript
const DependencyTypes = {
  COMPOSITION: "composition",     // constructor内 new演算子 + プロパティ代入
  AGGREGATION: "aggregation",     // constructorパラメータ → プロパティ代入  
  ASSOCIATION: "association",     // メソッド内他オブジェクトのメソッド呼び出し
  INSTANTIATION: "instantiation"  // メソッド内 new演算子 + return
};
```

### **Phase 2: 可視化エンジン**

#### **2.1 GraphRenderer 実装**
- **ファイル**: `src/graph/graphRenderer.js`
- **機能**: DependencyGraph → Cytoscape.js データ変換
- **レンダリング設定**:
  - **クラス**: 緑色、角丸矩形
  - **インスタンス**: オレンジ色、楕円
  - **Composition**: 青色、実線、太い
  - **Aggregation**: 紫色、破線
  - **Association**: 灰色、点線

#### **2.2 VSCode WebView統合**
- **ファイル**: `src/ui/dependencyGraphView.js`
- **機能**:
  - WebViewPanel作成
  - Cytoscape.js HTML生成
  - ノードクリック → コードジャンプ
  - レイアウト切替UI

### **Phase 3: VSCode拡張統合**

#### **3.1 コマンド登録**
- **extension.js** に追加:
  ```javascript
  vscode.commands.registerCommand('cop-lens.showDependencyGraph', () => {
    // 現在のファイル解析 → 依存グラフ表示
  });
  ```

#### **3.2 TreeProvider統合**
- **treeProvider.js** 拡張:
  - 依存グラフ表示ボタン追加
  - 「Dependencies」セクション追加

## 🎯 具体的実装目標

### **ターゲットファイル**
1. **remote-editor-ema.js**: メインの依存関係
2. **online-editor.js**: シンプルな構造（テスト用）

### **期待される検出結果**
```javascript
// remote-editor-ema.js の依存関係
RemoteEditor → Editor (composition, line 22)
RemoteEditor → Server (composition, line 24) 
RemoteEditor → WorkRemote (composition, line 23)
EditorWidget → Editor (aggregation, line 88)
EditorWidget → Render (composition, line 89)
EditorWidget → Editor.save (association, line 100)
```

### **可視化要件**
- **レイアウト**: COSE アルゴリズム（自動配置）
- **インタラクション**: ノードクリック → コードジャンプ
- **フィルタリング**: 依存関係タイプ別表示切替
- **エクスポート**: SVG出力機能（将来）

## 🚀 実装順序

### **Week 1: データ検出**
1. `ObjectDependencyDetector` 基本実装
2. `DependencyGraph` データ構造
3. `remote-editor-ema.js` での動作テスト

### **Week 2: 可視化**
1. `GraphRenderer` 実装
2. VSCode WebView統合
3. Cytoscape.js レンダリング

### **Week 3: 統合・テスト**
1. VSCode拡張への統合
2. UI改善・バグ修正
3. `online-editor.js` でのテスト

## 📋 成功基準

### **最小実装 (MVP)**
- [ ] `remote-editor-ema.js` の基本的な依存関係を検出
- [ ] VSCodeでCytoscape.jsグラフを表示
- [ ] ノードクリックでコードにジャンプ

### **完全実装**
- [ ] 4つの依存関係タイプすべてを検出
- [ ] レイアウト切替・フィルタリング機能
- [ ] エラーハンドリング・パフォーマンス最適化

## 🔧 技術スタック確定

### **検出エンジン**
- **AST解析**: Acorn パーサー（既存）
- **パターンマッチング**: ノードタイプ + 構文解析

### **可視化エンジン** 
- **グラフライブラリ**: Cytoscape.js
- **レイアウト**: COSE, Dagre, Circle
- **UI**: VSCode WebView API

### **データフロー**
```
SourceCode → AST → ObjectDependencyDetector → DependencyGraph → GraphRenderer → Cytoscape.js
```

## 📝 次のアクション
1. `ObjectDependencyDetector` クラスの実装開始
2. `remote-editor-ema.js` でのComposition検出テスト
3. 基本的なDependencyGraphデータ構造の確認
