---
作成日: 2025-10-13
バージョン: 2
---

# COP-lens ランタイム統合機能 - アーキテクチャ理解セッション

## 🎯 現在の状況

ランタイム統合機能の実装が完了し、リファクタリングも完了。
現在、実装の詳細フローとアーキテクチャを体系的に振り返り中。

## 📊 実装完了の成果

### ✅ 機能実装
- ブラウザ(EMA.js) ↔ VSCode間のWebSocket通信
- Layer activate/deactivate検知
- 依存グラフへの動的ノード追加
- 詳細パネルへのランタイム状態表示

### ✅ リファクタリング完了
- `dependencyGraphView.js`: 1200行 → 274行（**77%削減**）
- ファイル分割完了（templates/ と handlers/）

## 🔍 理解したこと：Layer Activation検知の仕組み

### なぜ`_enter()`/`_exit()`をフックするのか

EMA.jsの設計：
```javascript
// Layer.js - enableCondition()
this._cond.on(function (active) {
    if (active !== thiz._active) {
        thiz._active = active;
        if (thiz._active) {
            thiz._enter();              // ← Layerがactivate
            thiz._installPartialMethod();
        } else {
            thiz._exit();               // ← Layerがdeactivate
            thiz._uninstallPartialMethods();
        }
    }
});
```

### 重要なポイント

1. **EMA.jsには`Layer.activate()`メソッドが存在しない**
2. **`_enter()`/`_exit()`がactivation/deactivationそのもの**
3. **代替案：`_active`プロパティ監視も可能だが、現在の実装が優れている**

## 📋 データフロー（Step 1-2まで確認済み）

### Step 1: ブラウザでのイベント発生
```
トグルクリック → goOnline/goOffline() → networkStatus.value = true/false
```

### Step 2: Layer activation
```
Signal変化 → enableCondition()評価 → _enter()/_exit() → Monkey Patch検知
```

## 🔄 今後確認する内容

- Step 3: WebSocket通信
- Step 4: VSCode側の受信処理
- Step 5: 依存グラフへの反映
- Step 6: WebView内での表示

## 🎓 学んだ設計原則

1. **Monkey Patchのタイミング** - `EMA.deploy()`時点
2. **WebView内でのコード実行** - 文字列として生成・埋め込み
3. **リファクタリング戦略** - 機能ごとにファイル分離

## 💡 今回のセッションで確認したこと

1. ✅ Layer activation検知の仕組み
2. ✅ `_enter()`/`_exit()`フックの理由
3. ✅ ブラウザ側のイベント発生フロー（Step 1-2）
4. ✅ WebViewでの文字列ベースコード生成の理由

## 🎯 次のステップ

Step 3以降のWebSocket通信からVSCode側の処理を追跡し、
完全なデータフロー図とアーキテクチャ図を作成
