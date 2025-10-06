# Structured COP Example

このディレクトリは、COPの理想的な構造を示すサンプルプロジェクトです。

## ファイル構成

```
structured-cop/
├── EditorWidget.js          # ベースクラス（クラス定義）
├── serverSignal.js          # Signal定義
├── onlineEditorLayer.js     # Layer定義とデプロイ
└── main.js                  # メインアプリケーション
```

## 依存関係グラフ

期待される構造：

```
[serverConnected Signal]
        ↓ depends_on_signal
[layerOnlineEditor Layer定義]
        ↓ (deployed as instance)
[layerOnlineEditor Instance]
        ↓ refines
[EditorWidget.save() Refinement]
        ↓ refines_method
[EditorWidget.save() Original]
```

## 実行方法

```bash
cd examples/structured-cop
node main.js
```

## COP-lens での可視化

VSCodeで `onlineEditorLayer.js` を開いて、依存グラフを表示すると：

- **緑の楕円**: `serverConnected` (Signal)
- **紫の六角形**: `layerOnlineEditor` (Layer定義)
- **ピンクの四角**: `save()`, `render()` (Refinement)
- **緑の四角**: `EditorWidget` (クラス)

エッジ：
- 紫の破線: Layer → Signal (depends_on_signal)
- 紫の破線: Refinement → Layer (belongs_to_layer)
- 赤の実線: Refinement → Class (refines)
