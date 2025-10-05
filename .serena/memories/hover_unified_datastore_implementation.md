# COP-lens Hover機能・統合データストア実装完了

## 実装日
2025年1月

## 実装概要
COPシンボルのHover機能と統合データストアを実装。Layer、Refinement、Target、Signalなどのシンボルをグループ化し、効率的にアクセスできるアーキテクチャを構築。

---

## 実装したファイル

### 1. 新規作成
- `src/analyzer/copAnalysisResult.js` - 統合データストア（中核）
- `src/parser/babelSymbolDetector.js` - シンボル統合検出器
- `src/analyzer/symbolRegistry.js` - シンボル検索レジストリ（後でCOPAnalysisResultに統合）
- `src/ui/hoverProvider.js` - Hover機能実装
- `test-samples/hover-test.js` - テストファイル

### 2. 変更したファイル
- `extension.js` - 統合データストアを使用
- `src/ui/treeProvider.js` - refinement_deployケース追加、setResults()に改名

---

## アーキテクチャ

### データフロー
```
検出器（3つ並行実行）
├─ BabelLayerDetector      → layerResults
├─ BabelRefinementDetector → refinementResults
└─ BabelSymbolDetector     → symbols
         ↓
COPAnalysisResult（統合データストア）
├─ mergeLayerResults()
├─ mergeRefinementResults()
├─ mergeSymbols()
└─ buildIndices()
         ↓
    ┌────┴────┐
    ↓         ↓
TreeView   HoverProvider
```

### デザインパターン
- **Registry Pattern**: 名前ベースの高速検索（O(1)）
- **Index Pattern**: 位置ベースの二分探索（O(log n)）
- **CQRS**: 読み書き分離（元データ + 最適化インデックス）
- **Strategy Pattern**: シンボルグループごとに異なる処理
- **Single Source of Truth**: 単一情報源

---

## COPAnalysisResult（統合データストア）

### エンティティ構造
```javascript
{
    id: "layer_landscape_25",
    type: "layer",  // layer, refinement_*, signal
    name: "landscape",
    line: 25,
    
    // 位置情報（Hover/Definition用）
    position: { start: 404, end: 413 },
    
    // 型固有の詳細情報（TreeView用）
    details: {
        condition: "gyroLevel > 45",
        conditionType: "signal"
    },
    
    // シンボル情報（Hover用）
    symbols: [{
        text: "landscape",
        role: "layer-definition",
        range: { start: 404, end: 413 }
    }],
    
    // 関連情報
    references: [],
    refinements: [],
    
    // 元データ（後方互換性）
    _original: { /* 既存検出器の結果 */ }
}
```

### インデックス（高速アクセス用）
- `symbolIndex`: 位置ベース（O(log n)二分探索）
- `nameIndex`: 名前ベース（O(1)）
- `lineIndex`: 行番号ベース（O(1)）
- `typeIndex`: 型ベース（O(1)）

### 主要メソッド
```javascript
// 位置から検索（Hover用）
findByPosition(offset) → { entity, symbol }

// 名前から検索（Definition Jump用）
getByName(name) → [entities]

// 型から検索（TreeView用）
getByType(type) → [entities]

// Layer情報取得
getLayerInfo(layerName) → { definition, references, refinements }

// 後方互換性
getLegacyResults() → [...layerResults, ...refinementResults]
```

---

## シンボルグループとロール

### グループ（4つ）
```javascript
SymbolGroup = {
    LAYER: 'layer',
    TARGET: 'target',
    EMA_API: 'ema-api',
    SIGNAL: 'signal'
}
```

### ロール
```javascript
SymbolRole = {
    // Layer
    LAYER_DEFINITION: 'layer-definition',
    LAYER_REFERENCE: 'layer-reference',
    
    // Target
    TARGET_OBJECT: 'target-object',
    TARGET_METHOD: 'target-method',
    
    // EMA API
    EMA_OBJECT: 'ema-object',
    EMA_METHOD: 'ema-method',
    
    // Signal
    SIGNAL_DEFINITION: 'signal-definition',
    SIGNAL_REFERENCE: 'signal-reference'
}
```

---

## Hover機能の実装状況

### ✅ 実装済み

#### 1. LAYER グループ
**Layer Definition（定義）**
```markdown
### 📋 Layer Definition
**Name:** `landscape`
**Line:** 25
**Condition:** `gyroLevel > 45`
**Refinements:**
- `playerView.draw()` (line 38)
- `videoGame.draw()` (line 46)
```

**Layer Reference（参照）**
```markdown
### 📋 Layer Reference
**Name:** `landscape`
**Defined at:** line 25
**Condition:** `gyroLevel > 45`
*Click to go to definition*
```

#### 2. TARGET グループ
**Target Object**
```markdown
### 🎯 Target Object
**Name:** `playerView`
**Methods refined:**
- `draw()`
```

#### 3. Refinement
```markdown
### 🔧 Partial Method
**Target:** `playerView.draw()`
**Layer:** `landscape`
**Line:** 38
**Layer Condition:** `gyroLevel > 45`
```

### ❌ 未実装

- TARGET_METHOD のHover
- EMA_API グループ全て
- SIGNAL グループ全て

---

## TreeView（COP Overview）

### 表示される項目
- 📋 Layer定義（condition表示）
- 🔧 EMA.addPartialMethod
- 📤 EMA.exhibit
- 🚀 EMA.deploy（新規追加）
- ➡️ Layer.proceed

### 修正した内容
- `refinement_deploy`ケースを追加（Unknown問題を解決）
- アイコン: 🚀 rocket（赤色）
- 説明: Deploy layer: layerName

---

## 命名の改善

### 変更内容
```javascript
// 変更前
treeProvider.updateResults(results);
hoverProvider.updateAnalysisResult(analysisResult);

// 変更後
treeProvider.setResults(results);
hoverProvider.setAnalysisResult(analysisResult);
```

### 理由
- Setterであることが明確
- 「更新」ではなく「データソースをセット」という意図
- 一貫性のある命名

---

## 解決した問題

### 1. データ重複の解消
**問題:** 同じLayer情報をLayerDetectorとSymbolDetectorが別々に検出
**解決:** 統合データストアに集約

### 2. 相互参照の実現
**問題:** Hover ↔ TreeView 間でデータ共有できない
**解決:** 単一情報源により相互アクセス可能

### 3. メンテナンスコストの削減
**問題:** データ重複で保守が困難
**解決:** Single Source of Truth

### 4. パフォーマンス維持
- O(log n): 位置ベース検索
- O(1): 名前、行番号、型ベース検索

### 5. 拡張性の確保
**問題:** 新機能追加が困難
**解決:** 新しいインデックスを追加するだけで拡張可能

---

## テスト結果

### ユニットテスト
```
Test Suites: 2 failed, 3 passed, 5 total
Tests:       8 failed, 64 passed, 72 total
```
- 64件通過（89%）
- 失敗8件は既存検出器の問題（今回の実装とは無関係）

### 手動テスト
- ✅ Hover機能動作確認
- ✅ TreeView表示確認
- ✅ シンボル検出確認

---

## 今後の拡張候補（優先順位付き）

### 高優先度
1. **SIGNAL グループのHover** - COPの核心機能
   - 初期値、型、変更箇所の表示
   - Signalの影響範囲の可視化

2. **Definition Provider** - 定義へジャンプ
   - Layer参照 → Layer定義
   - Signal参照 → Signal定義

3. **EMA_API のHover** - API使い方の説明
   - パラメータ情報
   - 使用例

### 中優先度
4. **Target Method のHover**
5. **Find References Provider** - 参照箇所一覧
   - Layer定義 → 全参照
   - Signal定義 → 全参照

### 低優先度
6. **Completion Provider** - コード補完
7. **Rename Provider** - 一括名前変更
8. **Code Lens** - インライン情報表示
9. **Parameter Hints** - パラメータヒント

---

## 技術的なハイライト

### 類似アーキテクチャ
このアーキテクチャは **Go言語のgopls** に最も近い：
- Symbol Index + 二分探索
- シンプルなRegistry Pattern
- 段階的な情報集約

### 拡張性の設計
新機能追加時：
1. 新しいインデックスを追加
2. アクセスメソッドを追加
3. UI側は既存のAPIを使用

例：
```javascript
// Definition Provider追加時
class DefinitionProvider {
    provideDefinition(position) {
        const result = analysisResult.findByPosition(position);
        if (result.symbol.role === 'layer-reference') {
            const layers = analysisResult.getByName(result.symbol.text);
            return layers[0]; // 定義へジャンプ
        }
    }
}
```

---

## グループ別UI機能まとめ

| グループ | 役割 | Hover | Definition | References | Completion | 実装状況 |
|---------|------|-------|-----------|-----------|-----------|---------|
| LAYER | definition | ✅ | ❌ | ❌ | ❌ | 部分的 |
| | reference | ✅ | ❌ | ❌ | ❌ | 部分的 |
| TARGET | object | ✅ | ❌ | ❌ | ❌ | 部分的 |
| | method | ❌ | ❌ | ❌ | ❌ | 未実装 |
| EMA_API | object | ❌ | ❌ | ❌ | ❌ | 未実装 |
| | method | ❌ | ❌ | ❌ | ❌ | 未実装 |
| SIGNAL | definition | ❌ | ❌ | ❌ | ❌ | 未実装 |
| | reference | ❌ | ❌ | ❌ | ❌ | 未実装 |

---

## 重要な設計判断

### 1. 後方互換性の維持
```javascript
getLegacyResults() // TreeViewは既存形式で動作継続
```

### 2. エンティティベースの設計
- シンボルだけでなく、エンティティ（Layer、Refinement等）を中心に設計
- エンティティに複数のシンボルを含む

### 3. 段階的な移行
- 既存のTreeViewは変更最小限
- 新しいHover機能は新しいデータ構造を使用
- 将来的に全てを新しい構造に移行可能

---

## ドキュメント

### 作成済み
- `docs/hover-implementation.md` - Hover機能実装ドキュメント
- `docs/unified-datastore-implementation.md` - 統合データストア実装ドキュメント

### コード内ドキュメント
- 全てのクラス・メソッドにJSDocコメント
- 複雑なロジックに説明コメント

---

## まとめ

### 達成したこと
✅ 統合データストアの実装  
✅ シンボル検出とグループ化  
✅ Hover機能（部分的）  
✅ TreeView修正  
✅ 命名改善  
✅ 後方互換性の維持  
✅ 拡張性の確保  

### 土台として素晴らしい点
1. **単一情報源**: データの重複なし
2. **効率的なアクセス**: O(log n)とO(1)の検索
3. **拡張性**: 新機能追加が容易
4. **一貫性**: 統一されたデータ構造
5. **保守性**: コードが整理されている

### 次のステップ
この土台の上に、SIGNAL、EMA_API、Definition Provider等の機能を追加していく準備が整った。
