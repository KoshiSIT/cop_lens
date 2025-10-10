# COP-Lens プロジェクトルール

## ディレクトリ構造

```
cop-lens/
├── src/                    # ソースコード
│   ├── analyzer/          # 解析ロジック
│   ├── graph/             # グラフ生成・レンダリング
│   ├── hover/             # ホバー機能
│   ├── parser/            # パーサー（Babel）
│   └── providers/         # VSCode プロバイダー
├── test/                   # テストコード
│   ├── unit/              # ユニットテスト（*.test.js）
│   ├── integration/       # 統合テスト（*.test.js）
│   ├── debug/             # デバッグスクリプト
│   └── output/            # テスト出力（HTML等）
├── examples/               # サンプルプロジェクト
├── lib/                    # 外部ライブラリ
├── docs/                   # ドキュメント
└── extension.js           # VSCode拡張エントリーポイント
```

## ファイル命名規則

### テストファイル

| ファイル名パターン | 配置場所 | 用途 |
|-------------------|----------|------|
| `*.test.js` | `test/unit/` または `test/integration/` | 正式なテストコード（Jest/Mocha） |
| `test-*.js` | `test/debug/` | 手動実行用テストスクリプト |
| `debug-*.js` | `test/debug/` | デバッグ用スクリプト |
| `check-*.js` | `test/debug/` | 検証用スクリプト |

### 出力ファイル

| ファイル名パターン | 配置場所 | 用途 |
|-------------------|----------|------|
| `*.html` | `test/output/` | グラフ可視化HTML |
| `*.json` | `test/output/` | 解析結果JSON |
| `*.log` | `test/output/` | ログファイル |

## コーディング規約

### 1. **プロジェクトルートを汚さない**

❌ **悪い例**:
```bash
# ルートにテストファイルを作成
node > test-new-feature.js
```

✅ **良い例**:
```bash
# 適切な場所に作成
node > test/debug/test-new-feature.js
```

### 2. **一時ファイルは.gitignoreに追加**

```gitignore
# test/debug/ のファイルは基本的にコミットしない
test/debug/*.js
test/output/*.html
test/output/*.json
test/output/*.log
```

### 3. **正式なテストは test/unit/ または test/integration/**

- Jest/Mochaで実行されるテストのみ
- ファイル名: `*.test.js`
- CIで自動実行

### 4. **デバッグスクリプトの作成**

```javascript
// test/debug/debug-new-feature.js
const { NewFeature } = require('../../src/...');

async function debug() {
    console.log('=== Debug New Feature ===');
    // デバッグコード
}

debug().catch(console.error);
```

実行:
```bash
node test/debug/debug-new-feature.js
```

### 5. **相対パスの注意**

`test/debug/`から実行する場合、`require`のパスに注意：

```javascript
// test/debug/debug-xxx.js
const { XXX } = require('../../src/xxx');  // ../../ が必要
```

## npm スクリプト

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest test/unit",
    "test:integration": "jest test/integration",
    "debug": "node test/debug/",
    "clean": "rm -rf test/output/*"
  }
}
```

## .gitignore 更新

```gitignore
# テスト出力
test/output/*.html
test/output/*.json
test/output/*.log

# デバッグスクリプト（必要に応じて）
test/debug/*.js

# 一時ファイル
*.tmp
*.temp
```

## 開発ワークフロー

### 新機能の開発

1. **実装**: `src/` にコードを書く
2. **デバッグ**: `test/debug/debug-xxx.js` でテスト
3. **正式テスト**: `test/unit/xxx.test.js` を作成
4. **クリーンアップ**: デバッグスクリプトを削除 or `.gitignore`

### プルリクエスト前

```bash
# 1. ルートのゴミを確認
ls -la | grep "\.js$"

# 2. 不要なファイルを削除
rm test/debug/debug-*.js

# 3. テストを実行
npm test

# 4. コミット
git add -A
git commit -m "feat: xxx"
```

## まとめ

### ✅ やるべきこと

- テスト/デバッグファイルは `test/` 以下に配置
- 正式テストは `test/unit/` または `test/integration/`
- 出力ファイルは `test/output/`
- プロジェクトルートはクリーンに保つ

### ❌ やってはいけないこと

- ルートに `test-*.js` を作成
- ルートに `debug-*.js` を作成
- ルートに `*.html` を出力
- 一時ファイルをコミット
