# COPシンボル検出・グループ化・Hover機能 実装ドキュメント

## 概要

COP構文のシンボルを検出し、グループ化して、Hover時にコンテキスト情報を表示する機能を実装しました。

## アーキテクチャ

```
既存の検出器（Layer, Refinement, ObjectDependency）
    ↓
新規: BabelSymbolDetector （統合シンボル検出）
    ↓
新規: SymbolRegistry （シンボル索引・グループ化）
    ↓
新規: COPHoverProvider （Hover機能）
```

## 実装したファイル

### 1. `src/parser/babelSymbolDetector.js` ⭐ 中核ファイル

**役割**: COPのすべてのシンボルを検出し、グループ・役割を付与

**シンボルグループ:**
```javascript
SymbolGroup = {
    LAYER: 'layer',
    TARGET: 'target', 
    EMA_API: 'ema-api',
    SIGNAL: 'signal'
}
```

**シンボル役割:**
```javascript
SymbolRole = {
    // Layer group
    LAYER_DEFINITION: 'layer-definition',      // const landscape = {...}
    LAYER_REFERENCE: 'layer-reference',        // EMA.deploy(landscape)
    
    // Target group
    TARGET_OBJECT: 'target-object',            // playerView
    TARGET_METHOD: 'target-method',            // "draw"
    
    // EMA API group
    EMA_OBJECT: 'ema-object',                  // EMA
    EMA_METHOD: 'ema-method',                  // exhibit, deploy, etc.
    
    // Signal group
    SIGNAL_DEFINITION: 'signal-definition',    // new Signal(0)
    SIGNAL_REFERENCE: 'signal-reference'       // gyroLevel in condition
}
```

**検出パターン:**

1. **Layer定義**
   - `new Layer("name")` → constructor style
   - `const name = { condition: "..." }` → object literal style

2. **Signal定義**
   - `new Signal(initialValue)`

3. **EMA API呼び出し**
   - `EMA.exhibit(target, {...})`
   - `EMA.addPartialMethod(layer, target, "method", impl)`
   - `EMA.deploy(layer)`

4. **参照追跡**
   - LayerやSignalの変数参照を検出

**出力例:**
```javascript
{
    text: "landscape",
    group: "layer",
    role: "layer-definition",
    range: { start: 404, end: 413 },
    line: 25,
    metadata: { definitionType: "object-literal" }
}
```

---

### 2. `src/analyzer/symbolRegistry.js` ⭐ 検索最適化

**役割**: シンボルを効率的に検索・グループ化

**データ構造:**
```javascript
class SymbolRegistry {
    symbols = []              // 全シンボル
    symbolIndex = []          // ソート済み（二分探索用）
    groupedSymbols = Map()    // グループ別索引
    namedSymbols = Map()      // 名前別索引
    layerInfo = Map()         // Layer集約情報
}
```

**主要メソッド:**

1. `build(symbols)` - インデックス構築
2. `findSymbolAtPosition(offset)` - **O(log n)** 二分探索
3. `getSymbolsByGroup(group)` - **O(1)** グループ取得
4. `getSymbolsByName(name)` - **O(1)** 名前検索
5. `getLayerInfo(layerName)` - Layer情報取得
6. `mergeRefinementResults()` - Refinement結果を統合

**計算量:**
| 操作 | 計算量 | 説明 |
|------|--------|------|
| インデックス構築 | O(n log n) | 一度だけ |
| カーソル位置検索 | O(log n) | 二分探索 |
| グループ取得 | O(1) | Map検索 |
| 名前検索 | O(1) | Map検索 |

---

### 3. `src/ui/hoverProvider.js` ⭐ UI表示

**役割**: Hover時の情報表示

**グループ別の表示内容:**

#### Layer Hover
```markdown
### 📋 Layer Definition

**Name:** `landscape`
**Line:** 24

**Referenced 3 time(s)**

**Refinements:**
- `playerView.draw()` (line 38)
- `videoGame.draw()` (line 46)
```

#### Target Object Hover
```markdown
### 🎯 Target Object

**Name:** `playerView`
**Context:** addPartialMethod

**Methods refined:**
- `draw()`
```

#### EMA API Hover
```markdown
### 🔌 EMA.addPartialMethod()

Adds a context-specific method implementation to a target object.
```

#### Signal Hover
```markdown
### 📡 Signal Definition

**Name:** `gyroLevel`
**Initial Value:** `0`
```

---

### 4. `extension.js` の変更

**追加した初期化:**
```javascript
// Symbol detection and hover
const symbolRegistry = new SymbolRegistry();
const hoverProvider = new COPHoverProvider(symbolRegistry, []);

// Register hover provider
const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'javascript', scheme: 'file' },
    hoverProvider
);
```

**analyzeCurrentFile() の更新:**
```javascript
// Symbol detection
const symbolDetector = new BabelSymbolDetector();
const symbols = symbolDetector.detect(code);

// Update registry
symbolRegistry.build(symbols);
symbolRegistry.mergeRefinementResults(refinementResults);
hoverProvider.updateRegistry(symbolRegistry);
hoverProvider.updateRefinements(refinementResults);

// Log statistics
const stats = symbolRegistry.getStatistics();
console.log(`Symbol statistics:`, stats);
```

---

## 考慮事項の評価

### ✅ 既存のコードへの影響
- **最小限**: 既存の検出器（BabelLayerDetector, BabelRefinementDetector）は変更なし
- **独立実行**: SymbolDetectorは並行して動作
- **統合**: SymbolRegistryがRefinement結果をマージ

### ✅ 実装コスト（既存ライブラリの活用）
- **Babel**: 既存のBabelインフラを100%再利用
- **BabelBaseDetector**: 継承して共通ロジック活用
- **VSCode API**: 標準のHoverProvider使用

### ✅ パフォーマンス
- **O(log n)** 二分探索でカーソル位置のシンボルを高速検索
- **O(1)** Map検索でグループ・名前ベースの検索
- **インクリメンタル**: ファイル変更時のみ再解析
- **メモリ効率**: 参照のみでデータ複製なし

### ✅ 拡張性（COP情報の取り出し）
**既に実装済み:**
- `getSymbolsByGroup()` - グループ別取得
- `getSymbolsByName()` - 名前検索
- `getLayerInfo()` - Layer情報集約
- `mergeRefinementResults()` - 他の解析結果との統合

**将来の拡張が容易:**
```javascript
// 新しいCOP構文を追加する場合
// 1. BabelSymbolDetectorにvisitorを追加
// 2. SymbolGroup/SymbolRoleを追加
// 3. HoverProviderに表示ロジックを追加

// 例: Context構文の追加
getVisitors(results) {
    return {
        ...existingVisitors,
        // 新しい構文検出
        NewExpression: (path) => {
            if (path.node.callee.name === 'Context') {
                this.detectContextDefinition(path, results);
            }
        }
    };
}
```

---

## 使用方法

### 1. 拡張機能を起動
```bash
F5キーを押してExtension Development Hostを起動
```

### 2. テストファイルを開く
```bash
test-samples/hover-test.js を開く
```

### 3. Hoverテスト
以下のシンボルにカーソルを合わせてHover情報を確認：

- **Layer定義**: `landscape` (line 9)
- **Layer参照**: `landscape` in `EMA.deploy(landscape)` (line 53)
- **Target object**: `playerView` in `EMA.addPartialMethod()` (line 38)
- **EMA API**: `EMA` or `addPartialMethod` (line 38)
- **Signal定義**: `gyroLevel` (line 4)

### 4. Developer Consoleで統計確認
```
Ctrl+Shift+I → Console
> Symbol statistics: { total: 25, byGroup: {...}, layerDefinitions: 2 }
```

---

## テスト項目

- [x] Layer定義のHover表示
- [x] Layer参照のHover表示（定義へのリンク情報）
- [x] Target objectのHover表示（関連するrefinements）
- [x] EMA APIのHover表示（メソッド説明）
- [x] Signal定義のHover表示（初期値）
- [x] シンボル検索のパフォーマンス（大規模ファイル対応）
- [x] ファイル切り替え時の動作
- [x] 既存のTreeView機能への影響なし

---

## 技術的なハイライト

### 1. デザインパターン
- **Registry Pattern**: 名前ベースの高速検索
- **Index Pattern**: 位置ベースの二分探索
- **CQRS**: 読み書き分離（元データ + 最適化インデックス）
- **Strategy Pattern**: シンボルグループごとに異なるHover生成

### 2. 類似アーキテクチャ
このアーキテクチャは **Go言語のgopls** に最も近い：
- Symbol Index + 二分探索
- シンプルなRegistry Pattern
- 段階的な情報集約

### 3. 将来の拡張可能性
- **Definition Provider**: 定義へジャンプ
- **Reference Provider**: 参照箇所一覧
- **Rename Provider**: シンボル名の一括変更
- **Code Lens**: インライン情報表示
- **Completion Provider**: コード補完

すべて同じSymbolRegistryを活用可能

---

## まとめ

✅ **実装完了項目:**
1. COPシンボルの統合検出
2. シンボルのグループ化・役割定義
3. 効率的な検索インデックス（O(log n)）
4. Hover機能の実装
5. 既存コードとの統合

✅ **考慮事項すべてクリア:**
- 既存コードへの影響: 最小限
- 実装コスト: 既存インフラ活用
- パフォーマンス: 二分探索 + Map
- 拡張性: APIとインターフェースが明確

🚀 **次のステップ候補:**
1. Definition Provider（定義へジャンプ）
2. Reference Provider（参照箇所表示）
3. Completion Provider（コード補完）
