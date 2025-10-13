# Refinement詳細パネル - アクティブ状態可視化機能

> 実装日: 2025-10-13

---

## 🎯 機能概要

Refinementノードの詳細パネルで、**現在どちらのコードが実行されているか**を視覚的に表示する機能。

Layer のactivation状態に応じて、Original Method と Refinement Code の表示を動的に変更します。

---

## 💡 実装の動機

### 問題

COPでは、Layerのactivation/deactivation によってメソッドの実装が動的に切り替わります。
しかし、**どちらのコードが現在実行されているか**が分かりにくいという課題がありました。

### 解決策

ランタイム状態に基づいて、詳細パネルのコード表示を以下のように変更：

- **アクティブなコード**: 明るく表示、🟢 ACTIVE バッジ
- **非アクティブなコード**: 薄く表示、⚪ INACTIVE バッジ

---

## 🎨 ビジュアルデザイン

### Layerが INACTIVE の場合

```
┌─────────────────────────────────────────────┐
│ ⚪ Activation: INACTIVE                      │
│ Signals: { networkStatus: false }           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📄 Original Method 🟢 ACTIVE        [明るい] │
│ ┌─────────────────────────────────────────┐ │
│ │ save(text) {                            │ │
│ │   console.log("Saving to localStorage");│ │
│ │   localStorage.setItem(this.file, text);│ │
│ │   return 'saved_to_' + this.file;      │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🔧 Refinement Code ⚪ INACTIVE        [薄い] │
│ ┌─────────────────────────────────────────┐ │
│ │ function(text) {                        │ │
│ │   server.send(this.file, text);        │ │
│ │   Layer.proceed(text);                 │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Layerが ACTIVE の場合

```
┌─────────────────────────────────────────────┐
│ 🟢 Activation: ACTIVE                        │
│ Signals: { networkStatus: true }            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📄 Original Method ⚪ INACTIVE        [薄い] │
│ ┌─────────────────────────────────────────┐ │
│ │ save(text) {                            │ │
│ │   console.log("Saving to localStorage");│ │
│ │   localStorage.setItem(this.file, text);│ │
│ │   return 'saved_to_' + this.file;      │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🔧 Refinement Code 🟢 ACTIVE        [明るい] │
│ ┌─────────────────────────────────────────┐ │
│ │ function(text) {                        │ │
│ │   server.send(this.file, text);        │ │
│ │   Layer.proceed(text);                 │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 🔧 技術実装

### 修正ファイル

- `src/ui/handlers/nodeDetailHandler.js`

### 実装のポイント

#### 1. ランタイム状態の取得

```javascript
const layerName = data.layerObject || data.name;
const runtime = runtimeStatusMap[layerName];
const isActive = runtime && runtime.status === 'ACTIVE';
```

#### 2. 実行されるコードの判定

```javascript
// Layerが無効 → Originalが実行される
const originalActive = !isActive;

// Layerが有効 → Refinementが実行される
const refinementActive = isActive;
```

#### 3. スタイルの動的生成

```javascript
// アクティブなコード
const opacity = isActive ? '1.0' : '0.4';
const borderColor = isActive 
    ? '#4CAF50'  // 緑
    : 'var(--vscode-editorWidget-border)';  // グレー
const bgColor = isActive 
    ? 'var(--vscode-editor-background)'
    : 'var(--vscode-editorWidget-background)';
```

#### 4. バッジの表示

```javascript
const badge = isActive ? '🟢 ACTIVE' : '⚪ INACTIVE';
const badgeBg = isActive 
    ? 'rgba(76,175,80,0.2)'   // 緑の半透明
    : 'rgba(150,150,150,0.2)'; // グレーの半透明
```

---

## 📊 視覚的要素の詳細

### スタイル比較表

| 要素 | ACTIVE | INACTIVE |
|------|--------|----------|
| **不透明度** | 1.0 (100%) | 0.4 (40%) |
| **左ボーダー色** | #4CAF50 (緑) / Info色 (青) | グレー |
| **左ボーダー幅** | 3px | 3px |
| **背景色** | エディタ背景 | ウィジェット背景（暗い） |
| **バッジ** | 🟢 ACTIVE | ⚪ INACTIVE |
| **バッジ背景** | 緑の半透明 | グレーの半透明 |

### 色の使い分け

- **Original Method (ACTIVE)**: 青系 (`var(--vscode-editorInfo-foreground)`)
- **Refinement Code (ACTIVE)**: 緑系 (`#4CAF50`)
- **両方 (INACTIVE)**: グレー系

---

## 🎬 動作フロー

### ユーザーアクション

1. 依存グラフでRefinementノードをクリック
2. 詳細パネルが開く
3. 現在のactivation状態に基づいてコードが表示される

### リアルタイム更新

1. ブラウザでトグルスイッチをクリック
2. Layer activation/deactivation イベント発生
3. WebSocket経由でVSCodeに通知
4. 詳細パネルが自動更新
5. **コードの明るさが変化**（アクティブ ↔ 非アクティブ）

---

## 🔍 コード例

### Original Method（非アクティブ時）

```javascript
html += '<div class="node-detail-section code-section" style="'
    + 'opacity: 0.4; '  // 薄く表示
    + 'border-left: 3px solid var(--vscode-editorWidget-border);'
    + '">';
html += '<div class="code-section-header">';
html += '<div class="node-detail-section-title">'
    + '📄 Original Method '
    + '<span style="'
    + 'margin-left: 8px; '
    + 'font-size: 11px; '
    + 'padding: 2px 8px; '
    + 'border-radius: 12px; '
    + 'background: rgba(150,150,150,0.2);'
    + '">⚪ INACTIVE</span>'
    + '</div>';
html += '</div>';
html += '<pre class="code-container" style="'
    + 'background: var(--vscode-editorWidget-background);'
    + '"><code>' + escapeHtml(data.targetMethodCode) + '</code></pre>';
html += '</div>';
```

### Refinement Code（アクティブ時）

```javascript
html += '<div class="node-detail-section code-section" style="'
    + 'opacity: 1.0; '  // 明るく表示
    + 'border-left: 3px solid #4CAF50;'
    + '">';
html += '<div class="code-section-header">';
html += '<div class="node-detail-section-title">'
    + '🔧 Refinement Code (onlineEditor) '
    + '<span style="'
    + 'margin-left: 8px; '
    + 'font-size: 11px; '
    + 'padding: 2px 8px; '
    + 'border-radius: 12px; '
    + 'background: rgba(76,175,80,0.2);'
    + '">🟢 ACTIVE</span>'
    + '</div>';
html += '</div>';
html += '<pre class="code-container" style="'
    + 'background: var(--vscode-editor-background);'
    + '"><code>' + escapeHtml(data.implementationCode) + '</code></pre>';
html += '</div>';
```

---

## 📝 使用例

### シナリオ: Online/Offline エディタ

#### 初期状態（Offline）

1. ブラウザでアプリを開く（接続OFF）
2. VSCodeで `save (refinement)` ノードをクリック
3. 詳細パネルに表示：
   - ⚪ Activation: INACTIVE
   - 📄 Original Method: 🟢 ACTIVE（明るい）
   - 🔧 Refinement Code: ⚪ INACTIVE（薄い）

#### トグル切り替え（Online）

1. ブラウザでトグルをONに切り替え
2. VSCodeの詳細パネルが自動更新
3. 表示が変化：
   - 🟢 Activation: ACTIVE
   - 📄 Original Method: ⚪ INACTIVE（薄くなる）
   - 🔧 Refinement Code: 🟢 ACTIVE（明るくなる）

#### 実行動作の理解

- **Offline**: `EditorWidget.save()` が呼ばれると、Original Methodが実行
  - `localStorage.setItem()` でローカル保存
  
- **Online**: `EditorWidget.save()` が呼ばれると、Refinement Codeが実行
  - `server.send()` でサーバー送信
  - `Layer.proceed()` でOriginalも実行（両方）

---

## 🎯 利点

### 1. 直感的な理解

開発者は一目で「どちらのコードが実行されるか」を理解できる。

### 2. デバッグ支援

- バグが発生した場合、どのコードが原因かすぐに分かる
- 実行フローの追跡が容易

### 3. COPの理解促進

- Layerのactivation/deactivationがコード実行に与える影響を視覚化
- COPの動的な側面を体験的に学習できる

### 4. リアルタイムフィードバック

- ブラウザでの操作が即座にVSCodeに反映
- 動的な挙動を確認しながら開発可能

---

## 🔮 将来の拡張可能性

### 現在は実装しない（検討事項）

1. **アニメーション効果**
   - トランジションでスムーズに明るさ変化
   - `transition: opacity 0.3s ease`

2. **より強い視覚的強調**
   - アクティブなコードに光彩効果
   - `box-shadow: 0 0 10px rgba(76,175,80,0.3)`

3. **実行フローの矢印表示**
   - Original → Refinement の呼び出し順序を図示

4. **複数Layerの重なり表示**
   - 複数のRefinementが重なる場合の優先度表示

5. **パフォーマンス情報**
   - 各コードの実行時間やコール回数

---

## 📚 関連ドキュメント

- `docs/runtime-protocol-architecture.md` - ランタイム統合の全体像
- `src/ui/handlers/nodeDetailHandler.js` - 実装ファイル
- `src/ui/handlers/runtimeStatusHandler.js` - ランタイム状態管理

---

## ✅ まとめ

### 実装内容

- Layerのactivation状態に基づいてコード表示を動的変更
- アクティブ: 明るく、🟢 ACTIVE バッジ
- 非アクティブ: 薄く、⚪ INACTIVE バッジ

### 技術的アプローチ

- CSSの `opacity` で明るさ変更
- `border-left` で色分け
- 動的にスタイルを生成

### ユーザー体験

- 一目でどちらが実行されるか分かる
- リアルタイムで状態変化を確認
- デバッグとCOP理解を支援

この機能により、COPの動的な挙動がより直感的に理解できるようになりました。
