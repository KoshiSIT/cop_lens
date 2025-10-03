# COP-lens Dependency Analysis

このディレクトリには、COP-lensプロジェクトの依存関係分析に関するツールと結果が含まれています。

## 📁 ファイル構成

```
analysis/dependency-cruiser/
├── .dependency-cruiser.js     # 設定ファイル
├── analyze-dependencies.sh    # 分析スクリプト
├── README.md                  # このファイル
├── dependency-graph.svg       # 基本依存グラフ（履歴）
├── dependency-report.html     # インタラクティブレポート（履歴）
└── full-dependency-graph.svg  # 全体依存グラフ（履歴）
```

## 🚀 使用方法

### スクリプト実行
```bash
# 基本分析（src のみ）
./analysis/dependency-cruiser/analyze-dependencies.sh basic

# 全体分析
./analysis/dependency-cruiser/analyze-dependencies.sh full

# HTMLレポート生成
./analysis/dependency-cruiser/analyze-dependencies.sh report

# 循環依存チェック
./analysis/dependency-cruiser/analyze-dependencies.sh validate

# COP固有の解析
./analysis/dependency-cruiser/analyze-dependencies.sh cop-focus
```

### 直接実行
```bash
# 基本コマンド
npx depcruise src --config analysis/dependency-cruiser/.dependency-cruiser.js

# SVG出力
npx depcruise src --config analysis/dependency-cruiser/.dependency-cruiser.js --output-type dot | dot -T svg > output.svg

# HTML出力
npx depcruise . --config analysis/dependency-cruiser/.dependency-cruiser.js --output-type html > report.html
```

## 📊 現在の分析結果

### プロジェクト構造
- **6 modules, 3 dependencies** 検出済み
- **循環依存なし** ✅
- **主要な依存関係**:
  - `layerDetector.js` → `baseDetector.js`
  - `refinementDetector.js` → `baseDetector.js` 
  - `commands/index.js` → `commands/goToLine.js`

### アーキテクチャの特徴
1. **BaseDetector パターン**: 継承ベースの検出器設計
2. **Command パターン**: UI操作の分離
3. **モジュール分離**: parser, ui, commands の明確な分離

## 🎯 COP-lens用カスタマイズ

dependency-cruiserの設定では以下をCOP-lens向けにカスタマイズ：

- **includeOnly**: `^(src|examples|test|lib)` - 分析対象を限定
- **doNotFollow**: `node_modules`, `analysis`, `.vscode` を除外
- **coloring**: 解決済み（緑）、循環（赤）、未解決（赤）で色分け

## 📚 学習ポイント

Dependency Cruiserの分析から学べる点：
- **AST解析**: acorn パーサーによる依存関係抽出
- **GraphViz統合**: DOT形式からSVG生成
- **設定駆動**: JSON設定による柔軟なカスタマイズ
- **ルールベース検証**: 循環依存、孤立モジュールの検出
