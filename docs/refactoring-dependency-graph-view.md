# Dependency Graph View リファクタリング

## 📊 概要

`dependencyGraphView.js`の肥大化（1200行超）を解消するため、コードを整理・分離しました。

## 🎯 目的

- **可読性向上**: ファイルサイズを削減し、変更箇所を見つけやすく
- **保守性向上**: 機能ごとにファイルを分離
- **テスト容易性**: 各モジュールを独立してテスト可能に

## ✅ 完了した作業

### Phase 1: CSSスタイル分離

**作成したファイル:**
- `src/ui/templates/graphStyles.js` (333行)

**効果:**
- `dependencyGraphView.js`から322行削減
- スタイル変更が独立して可能

**使用方法:**
```javascript
const { getGraphStyles } = require('./templates/graphStyles');
// HTMLテンプレート内で
<style>${getGraphStyles()}</style>
```

### Phase 2: HTMLテンプレート構造準備

**作成したファイル:**
- `src/ui/templates/graphTemplate.js` (117行)

**内容:**
- HTMLの構造部分（header, container, panels, legend）
- スクリプトプレースホルダー

**使用方法:**
```javascript
const { generateGraphTemplate } = require('./templates/graphTemplate');
const html = generateGraphTemplate(title, fileName);
```

## 📁 新しいディレクトリ構造

```
src/ui/
├── dependencyGraphView.js (884行) ← 元1200行
├── templates/
│   ├── graphStyles.js (333行) - CSSスタイル
│   └── graphTemplate.js (117行) - HTML構造
├── handlers/ (今後)
│   ├── nodeDetailHandler.js - ノード詳細表示
│   ├── runtimeStatusHandler.js - ランタイム状態更新
│   └── graphEventHandler.js - イベント処理
└── utils/ (今後)
    └── graphHelpers.js - ヘルパー関数
```

## 🚧 今後の課題

### WebView JavaScript の制約

WebView内で実行されるJavaScriptコードは、以下の理由で完全な分離が困難：

1. **実行環境**: WebView内でのみ実行可能
2. **変数スコープ**: `window`, `document`, `cytoscape`などに依存
3. **テンプレートリテラル**: 親スコープの変数を参照

### 推奨される整理方法

完全な分離の代わりに、以下の方法で整理：

1. **コメントブロックで区切る**
   ```javascript
   // ========================================
   // Cytoscape Initialization
   // ========================================
   ```

2. **関数をグループ化**
   - 初期化関数
   - ノード詳細関数
   - ランタイム更新関数
   - イベントハンドラー

3. **将来の改善案**
   - Web Components の導入
   - React/Vue などのフレームワーク検討

## 📈 成果

| 項目 | Before | After | 削減 |
|------|--------|-------|------|
| `dependencyGraphView.js` | 1200行 | 884行 | **-316行** |
| CSSスタイル | インライン | `graphStyles.js` | ✅ |
| HTML構造 | インライン | `graphTemplate.js` | ✅ |

## 🎯 ベストプラクティス

### スタイル変更時
1. `src/ui/templates/graphStyles.js`を編集
2. VSCode拡張を再起動してテスト

### HTML構造変更時
1. `src/ui/templates/graphTemplate.js`を編集
2. スクリプトプレースホルダー`{{SCRIPT_CONTENT}}`を保持

### ロジック変更時
1. 現状は`dependencyGraphView.js`内で編集
2. コメントブロックを参考に該当箇所を探す

## 📝 メモ

- Phase 1完了: CSSスタイル分離 ✅
- Phase 2完了: HTMLテンプレート構造準備 ✅
- Phase 3計画: WebView JavaScript整理（コメント・関数グループ化）
