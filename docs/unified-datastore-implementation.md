# 統合データストア実装完了

## 実装内容

### 1. 作成したファイル
- `src/analyzer/copAnalysisResult.js` - 統合データストア

### 2. 変更したファイル
- `extension.js` - 統合ストアを使用するように改修
- `src/ui/hoverProvider.js` - 統合ストアからデータ取得

---

## 統合データストアの構造

### エンティティ（Entity）の構造
```javascript
{
    id: "layer_landscape_25",
    type: "layer",  // layer, refinement_*, signal
    name: "landscape",
    line: 25,
    
    // 位置情報（Hover/Definition用）
    position: {
        start: 404,
        end: 413
    },
    
    // 型固有の詳細情報（TreeView用）
    details: {
        condition: "gyroLevel > 45",
        conditionType: "signal"
    },
    
    // シンボル情報（Hover用）
    symbols: [
        {
            text: "landscape",
            role: "layer-definition",
            range: { start: 404, end: 413 }
        }
    ],
    
    // 関連情報
    references: [],
    refinements: [],
    
    // 元データ（後方互換性）
    _original: { /* 既存検出器の結果 */ }
}
```

### インデックス（高速アクセス用）
```javascript
// 位置ベース（Hover用）
symbolIndex: [
    { start: 404, end: 413, entityIndex: 0, symbol: {...} }
]  // ソート済み → O(log n) 二分探索

// 名前ベース（参照検索用）
nameIndex: Map {
    "landscape" => [entity1, entity2, ...]
}  // O(1) 検索

// 行番号ベース（TreeView連携用）
lineIndex: Map {
    25 => [entity1, entity2, ...]
}  // O(1) 検索

// 型ベース（TreeView表示用）
typeIndex: Map {
    "layer" => [entity1, entity2, ...],
    "refinement_addPartialMethod" => [...]
}  // O(1) 検索
```

---

## データアクセス方法

### Hover機能から
```javascript
// 位置でエンティティを検索
const result = analysisResult.findByPosition(offset);
// → { entity: {...}, symbol: {...} }

// Layer詳細情報を取得
const layerInfo = analysisResult.getLayerInfo("landscape");
// → { definition: entity, references: [...], refinements: [...] }
```

### TreeViewから
```javascript
// 型別に取得
const layers = analysisResult.getByType("layer");
const refinements = analysisResult.getRefinements();

// 行番号で取得（ジャンプ用）
const entities = analysisResult.getByLine(25);
```

### 将来の機能から
```javascript
// 名前で検索（Definition Jump用）
const entities = analysisResult.getByName("landscape");

// 統計情報
const stats = analysisResult.getStatistics();
```

---

## 解決された問題

### ✅ データ重複の解消
- 以前: LayerDetector と SymbolDetector が同じLayerを別々に検出
- 現在: 1つのエンティティに統合

### ✅ 相互参照の実現
- Hover ↔ TreeView 間でデータ共有
- Layer定義 ↔ Refinement の関連付け
- 参照 → 定義 の追跡

### ✅ メンテナンスコストの削減
- 単一情報源（Single Source of Truth）
- 新機能追加時は新しいインデックスを追加するだけ

### ✅ パフォーマンス維持
- O(log n): 位置ベース検索
- O(1): 名前、行番号、型ベース検索

---

## 後方互換性

既存のTreeViewは変更不要：
```javascript
// Legacy形式で取得可能
const legacyResults = analysisResult.getLegacyResults();
// → [...layerResults, ...refinementResults] (ソート済み)

treeProvider.updateResults(legacyResults);
```

---

## 動作確認手順

### 1. 拡張機能を起動
```
F5キー → Extension Development Host
```

### 2. テストファイルを開く
```
test-samples/hover-test.js
```

### 3. Hover確認
以下にカーソルを合わせてHoverを確認：

**Layer定義:**
- `landscape` (line 9)
  - condition表示
  - refinements一覧表示

**Layer参照:**
- `landscape` in `EMA.deploy(landscape)` (line 53)
  - 定義への参照情報
  - condition表示

**Refinement:**
- `EMA.addPartialMethod(landscape, playerView, "draw", ...)` (line 38)
  - Layer情報
  - Target情報
  - Layer conditionへのリンク

**Target object:**
- `playerView` (line 38)
  - 関連するメソッド一覧

### 4. Developer Console確認
```
Ctrl+Shift+I → Console

> Detected 2 layers, 10 refinements, 25 symbols
> Analysis complete: { total: 37, layers: 2, refinements: 10, ... }
```

---

## 次のステップ候補

統合データストアを活用した機能拡張：

### 1. Definition Provider
```javascript
// 参照から定義へジャンプ
analysisResult.findByPosition(offset)  // 参照を取得
  → analysisResult.getByName(name)     // 定義を検索
    → vscode.Location                  // ジャンプ
```

### 2. Reference Provider
```javascript
// 定義から全参照箇所を表示
analysisResult.getLayerInfo(layerName)
  → layerInfo.references  // 全参照
    → vscode.Location[]   // 一覧表示
```

### 3. TreeView改良
```javascript
// TreeViewから詳細情報表示
treeItem.entity = analysisResult.getByLine(25)[0];
  → クリック時に entity.details を表示
```

---

## まとめ

✅ **単一情報源を実現**
- 全てのCOP情報が `COPAnalysisResult` に集約
- データ重複なし

✅ **効率的なアクセス**
- 複数のインデックスで O(log n) または O(1) 検索
- UIごとに最適なアクセス方法

✅ **拡張性**
- 新機能追加時は新しいインデックスを追加
- 既存コードへの影響最小限

✅ **後方互換性**
- 既存のTreeViewは動作継続
- 段階的な移行が可能

統合データストアの実装が完了しました！
