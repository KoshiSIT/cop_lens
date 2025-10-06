# .copignore

プロジェクトルートに`.copignore`ファイルを配置することで、依存グラフの解析から除外するファイル/ディレクトリを指定できます。

## 書式

- 1行に1つのパターンを記述
- `#`で始まる行はコメント
- 空行は無視されます
- ワイルドカード`*`が使用可能

## 例

```
# EMA.jsライブラリを除外
ema

# テストファイルを除外
*.test.js
*.spec.js

# ビルド成果物を除外
dist
build
```

## デフォルトで除外されるディレクトリ

以下のディレクトリは`.copignore`に記述しなくても自動的に除外されます：

- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`
- `.vscode`
- `.serena`
- `lib`

## 使い方

1. プロジェクトルートに`.copignore`ファイルを作成
2. 除外したいパターンを記述
3. VS Codeをリロード（`Developer: Reload Window`）
4. 依存グラフを再生成

## 注意

- `.copignore`の変更後は、VS Codeのリロードが必要です
- プロジェクトごとに異なる`.copignore`を配置できます
