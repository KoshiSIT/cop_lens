---
作成日: 2025-10-10
バージョン: 1
---

# COP-Lens - Remote Editor グラフ可視化実装 - 会話スナップショット

## 現在の主要な目的・目標

**Remote Editorプロジェクトの依存関係グラフに、COP構造（Layer、Refinement）を統合し、正しく可視化する**

目標画像の構造を再現：
- Layerノード（薄い黄色の長方形）
- Refinementノード（ピンクの長方形）
- 正しいエッジの向き：Layer → Refinement、Method → Refinement

## 導入・背景

COP-Lensは、Context-Oriented Programming (COP)の依存関係を可視化するVSCode拡張機能。EMA.jsフレームワークを使用したJavaScriptプロジェクトを解析し、クラス・インスタンス・メソッドに加えて、Layer・RefinementといったCOP特有の構造をグラフ表示する。

対象プロジェクト：`examples/remote-editor/`
- `RemoteEditor.js`: メインクラス
- `EditorWidget.js`: エディタウィジェット
- `layers.js`: Layer定義とRefinement

## 主要トピックの概要

### 1. Layerノードとインスタンスの統合

**問題**: `layerOnlineEditor`が2つのノードとして表示される
- インスタンスノード（オレンジ、RemoteEditor.jsから）
- Layer定義ノード（黄色、layers.jsから）

**解決策**:
- Layerクラスのインスタンスは、Layer定義ノードとして扱う
- `UnifiedProjectAnalyzer.buildDependencyGraph()`でインスタンスノードを削除
- エッジをLayer定義ノードにリダイレクト

**実装**:
```javascript
// UnifiedProjectAnalyzer.js
const layerDefinitionNames = new Set(
    allNodes.filter(n => n.data.type === 'layer').map(n => n.data.name)
);

const filteredNodes = allNodes.filter(node => {
    if (node.data.type === 'instance' && node.data.className === 'Layer') {
        if (layerDefinitionNames.has(node.data.name)) {
            return false; // インスタンスノードを削除
        }
    }
    return true;
});
```

### 2. エッジの向きの修正

**問題1**: Refinement → Method（間違い）
- 正しい向き: Method → Refinement
- 意味: 元のメソッドがRefinementで拡張される

**解決策**:
```javascript
// COPAnalyzer.js
const methodId = `${refinement.targetObject}.${refinement.methodName}`;
updatedEdges.push({
    data: {
        source: methodId,        // Method → Refinement
        target: refId,
        type: 'refined_by'
    }
});
```

**問題2**: Refinement → Layer（間違い）
- 正しい向き: Layer → Refinement
- 意味: LayerがRefinementを所有/定義する

**解決策**:
```javascript
updatedEdges.push({
    data: {
        source: `Layer_${refinement.layerObject}`,  // Layer → Refinement
        target: refId,
        type: 'has_refinement'
    }
});
```

### 3. 関数呼び出しからのインスタンス検出

**問題**: `this.onlineLayer = EMA.deploy(...)`が検出されない
- `new`キーワードがないため、既存ロジックでは検出不可

**解決策**: `detectCompositionFromCall()`メソッドを追加
```javascript
// BabelObjectDependencyDetector.js
detectCompositionFromCall(propertyName, callNode, assignmentNode) {
    let className = 'Unknown';
    
    // Case 1: EMA.deploy() → Layer instance
    if (callNode.callee.type === 'MemberExpression' &&
        callNode.callee.object.name === 'EMA' &&
        callNode.callee.property.name === 'deploy') {
        className = 'Layer';
    }
    // ...
}
```

### 4. 外部変数参照の検出

**問題**: `this.layerOnlineEditor = layerOnlineEditor`が検出されない
- 右辺が既存変数への参照（Identifier）

**解決策**: `detectAggregationOrReference()`メソッドを追加
```javascript
detectAggregationOrReference(propertyName, identifier, assignNode) {
    const varName = identifier.name;
    let className = 'Unknown';
    
    // Pattern 1: layerXxx -> Layer
    if (varName.startsWith('layer')) {
        className = 'Layer';
    }
    // ...
}
```

## 決定事項・達成事項

### ✅ 達成事項

1. **Layerノードの統合**
   - インスタンスとLayer定義を1つのノードに統合
   - 薄い黄色の長方形で表示

2. **Refinementノードの追加**
   - `EMA.addPartialMethod()`から検出
   - ピンクの長方形で表示

3. **エッジの向きを修正**
   - Layer → Refinement (紫の破線、`has_refinement`)
   - Method → Refinement (赤の実線、`refined_by`)

4. **インスタンス検出の拡張**
   - 関数呼び出しからのインスタンス作成を検出（`EMA.deploy()`）
   - 外部変数参照からのインスタンスを検出（`= layerOnlineEditor`）

5. **エッジのリダイレクト**
   - 削除されたLayerインスタンスノードへのエッジを、Layer定義ノードにリダイレクト
   - 重複エッジの除去

### コミット履歴

1. `feat: detect instances created by function calls (e.g., EMA.deploy)`
2. `feat: add onlineLayer instance to RemoteEditor class`
3. `feat: add Layer and Refinement nodes to dependency graph`
4. `fix: correct method ID format in Refinement edges`
5. `fix: correct property name to layerOnlineEditor and detect instance references`
6. `fix: merge duplicate Layer instance and definition nodes`
7. `fix: redirect edges from removed Layer instance to Layer definition`
8. `fix: reverse refinement edge direction (method → refinement)`
9. `fix: reverse Layer-Refinement edge direction (Layer → Refinement)`

## 重要な文脈・背景情報・制約

### ファイル構造

```
examples/remote-editor/
├── RemoteEditor.js       # メインクラス
│   ├── editor: EditorWidget
│   ├── server: Signal
│   └── layerOnlineEditor: Layer (参照)
├── EditorWidget.js       # エディタクラス
│   ├── save()
│   ├── render()
│   └── display()
└── layers.js             # Layer定義
    └── layerOnlineEditor: new Layer("onlineEditor")
        ├── condition: SignalComp("serverConnected === true")
        └── addPartialMethod: EditorWidget.save()
```

### ノードタイプとスタイル

| タイプ | 色 | 形状 | 説明 |
|--------|-----|------|------|
| class | 緑 | 角丸四角 | クラス定義 |
| instance | オレンジ | 角丸四角 | インスタンス |
| external | グレー | 角丸四角 | 外部クラス（Signal, Layerなど） |
| method | 黄色 | 角丸四角 | メソッド |
| layer | 薄い黄色 | 長方形 | Layer定義（インスタンスと統合） |
| refinement | ピンク | 長方形 | Refinement（部分メソッド） |

### エッジタイプ

| タイプ | 色 | スタイル | 向き | 説明 |
|--------|-----|----------|------|------|
| composition | 青 | 実線 | A → B | AがBを所有 |
| has_refinement | 紫 | 破線 | Layer → Refinement | LayerがRefinementを定義 |
| refined_by | 赤 | 実線 | Method → Refinement | メソッドがRefinementで拡張 |
| hasMethod | グレー | 点線 | Class → Method | クラスがメソッドを持つ |
| instanceOf | グレー | 破線 | Instance → Class | インスタンスがクラスに属する |

### 技術的な制約

1. **メソッドIDの形式**: `ClassName.methodName`（ドット区切り）
2. **LayerインスタンスのID**: `Layer_${layerName}`
3. **RefinementのID**: `Refinement_${targetObject}_${methodName}`
4. **エッジの一意性**: source + target + typeで判定

## 未解決の問題・課題

### 1. Signal → Layerの依存関係が未実装

**問題**: Layerの`condition`がSignalを参照している関係が表示されない

```javascript
// layers.js
layerOnlineEditor.condition = new SignalComp("serverConnected === true");
```

**必要な実装**:
- Layer定義から`condition`を解析
- `SignalComp`の式から参照されているSignal名を抽出
- Signal → Layer の依存エッジを作成

**実装場所**: 
- `BabelLayerDetector.js`: conditionの詳細な解析
- `COPAnalyzer.mergeCOPIntoGraph()`: Signal → Layer エッジの追加

### 2. 複数のRefinementへの対応

**現状**: 1つのLayerに1つのRefinementのみ表示

**必要な実装**:
- 複数の`addPartialMethod`を検出
- 各Refinementノードを作成
- Layer → 複数Refinement のエッジ

### 3. Layer activationの可視化

**アイデア**: Layerのactiveかどうかを視覚的に表現
- active: 明るい色、太い枠線
- inactive: 薄い色、細い枠線

**必要な実装**:
- ランタイム情報の取得（現在は静的解析のみ）
- WebViewへのライブデータ送信

### 4. Proceed呼び出しの可視化

**問題**: Refinement内の`Layer.proceed()`呼び出しが表示されない

```javascript
EMA.addPartialMethod(layer, EditorWidget, "save", function(text) {
    console.log("online mode");
    Layer.proceed(text);  // ← この呼び出し
});
```

**必要な実装**:
- Refinement関数本体の解析
- `Layer.proceed()`の検出
- Refinement → 元のMethod へのエッジ（proceeds）

## 現在取り組んでいる目標

### 短期目標

1. ✅ **Layerノードの表示** - 完了
2. ✅ **Refinementノードの表示** - 完了
3. ✅ **エッジの向きを修正** - 完了
4. ⏭️ **Signal → Layerの依存関係** - 次のステップ

### 中期目標

1. 複数Refinementへの対応
2. Layer activationの可視化
3. Proceed呼び出しの可視化
4. グローバルプロジェクト解析の完成度向上

## 会話の進化メモ

### フェーズ1: インスタンス検出の拡張

最初の課題は、`remote-editor-ema.js`の`this.onlineLayer = EMA.deploy(...)`が検出されなかったこと。`new`キーワードがないため、既存の`detectComposition`では検出不可。`detectCompositionFromCall()`を追加して、関数呼び出しからのインスタンス作成を検出できるようにした。

### フェーズ2: 正しいファイル構造の理解

`remote-editor-ema.js`はサンプルファイルで、実際の対象は`examples/remote-editor/`ディレクトリ。ここでは、`RemoteEditor.js`が`layerOnlineEditor`を参照形式で保持している（`this.layerOnlineEditor = layerOnlineEditor`）。

### フェーズ3: Layer定義とインスタンスの統合

`layerOnlineEditor`が2つのノードとして表示される問題を発見。1つはインスタンスノード（RemoteEditor.jsから）、もう1つはLayer定義ノード（layers.jsから）。「インスタンスがLayerだったら、Layerノードとして扱う」というルールに従い、インスタンスノードを削除してLayer定義ノードに統合。

### フェーズ4: エッジの向きの修正

ユーザーから画像を見せられ、エッジの向きが間違っていることを指摘された：

1. **Refinement → Method** は間違い
   - 正しい: **Method → Refinement**
   - 意味: 元のメソッドがRefinementで拡張される

2. **Refinement → Layer** も間違い
   - 正しい: **Layer → Refinement**
   - 意味: LayerがRefinementを所有/定義する

両方のエッジの向きを修正し、エッジタイプも変更（`refines` → `refined_by`、`belongs_to_layer` → `has_refinement`）。

### 現在地

グラフは基本的な構造を正しく表示できるようになった：
- ✅ Layerノード（薄い黄色の長方形）
- ✅ Refinementノード（ピンクの長方形）
- ✅ 正しいエッジの向き

次のステップは、**Signal → Layerの依存関係**を追加すること。Layerの`condition`がSignalを参照している関係を可視化する。
