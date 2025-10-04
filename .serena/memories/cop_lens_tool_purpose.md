# COP-lens ツールの目的と解決すべき課題

## COPの課題（ツールが解決すべき問題）

### **1. 動作の追跡性が低い**
- 実行時にメソッドが置き換わる
- どこで置き換わっているか見えない
- コードを読むだけでは動作が予測できない

### **2. バージョン間の関連性が不明**
- オリジナル: `EditorWidget.save()`
- Layer版: `onlineEditor`の`save()`実装
- これらの関係がコードから見えない
- どのLayerがどのメソッドを変更しているか分からない

### **3. 切り替え条件が分散**
- `condition: "serverConnected === true"`
- いつ切り替わるのか？
- どのスコープで有効なのか？
- 条件が複雑な場合、理解が困難

### **4. 依存関係が隠れている**
- Signal → Layer → メソッド
- この依存チェーンが見えない
- Signalの変更がどのメソッドに影響するか追跡できない

---

## ツールが提供すべき情報

### **1. COP構文の所在**
- どこにLayerがあるか
- どこに部分メソッドがあるか
- どこにSignalがあるか
- COPの要素を一覧できる

### **2. 切り替え条件**
- Layer "onlineEditor" は何がtrueの時にactivateするか
- その条件に使われるSignalは何か
- そのSignalはどこで変更されるか
- 条件式の意味を理解できる

### **3. 依存関係**
- Signal "serverConnected" → Layer "onlineEditor"
- Layer "onlineEditor" → EditorWidget.save()
- つまり: serverConnectedが変わると、save()の動作が変わる
- 依存チェーン全体を可視化

### **4. オリジナルとLayerの結びつき**
- EditorWidget.save() (オリジナル)
  ↓ refined by
- Layer "onlineEditor" の部分メソッド (line 28)
  ↓ activated when
- serverConnected === true (line 13)
- オリジナルと各Layerバージョンの対応関係

---

## 具体的な使用シナリオ

### **シナリオ1: 「このメソッドはいつ動作が変わる？」**

開発者が`EditorWidget.save()`を見ている時:

```javascript
// EditorWidget.js
save(text) {
    console.log("Saving:", text);
}
```

**ツールが表示すべき情報:**
```
⚠️ このメソッドは Layer によって動作が変更されます

Refined by:
  - Layer "onlineEditor" (layers.js:28)
    Condition: serverConnected === true
    Signal: serverConnected (defined at RemoteEditor.js:12)
```

---

### **シナリオ2: 「このLayerはいつactivateする？」**

開発者が`layerOnlineEditor`を見ている時:

```javascript
// layers.js
const layerOnlineEditor = new Layer("onlineEditor");
layerOnlineEditor.condition = new SignalComp("serverConnected === true");
```

**ツールが表示すべき情報:**
```
Layer: onlineEditor
├─ Condition: serverConnected === true
│   └─ Signal: serverConnected
│       ├─ Defined: RemoteEditor.js:12
│       └─ Modified by:
│           - RemoteEditor.goOnline() (line 35)
│           - RemoteEditor.goOffline() (line 40)
│
└─ Refines:
    - EditorWidget.save() (EditorWidget.js:15)
```

---

### **シナリオ3: 「このSignalの変化は何に影響する？」**

開発者が`serverConnected`を見ている時:

```javascript
// RemoteEditor.js
this.server = new Signal(false);
```

**ツールが表示すべき情報:**
```
Signal: serverConnected
├─ Type: boolean
├─ Initial value: false
├─ Modified by:
│   - goOnline() (line 35): sets to true
│   - goOffline() (line 40): sets to false
│
└─ Triggers Layers:
    - onlineEditor (layers.js:10)
      └─ Affects:
          - EditorWidget.save()
```

---

## 検出すべき要素（3つのフェーズ）

### **Phase 1: 基本要素の検出**
1. Layer定義
   - `new Layer("name")`
   - オブジェクトリテラル `{ condition: "..." }`
   
2. Signal定義
   - `new Signal(initialValue)`
   
3. 部分メソッド定義
   - `EMA.addPartialMethod(layer, target, method, impl)`

### **Phase 2: 関係性の抽出**
4. Layer → Condition
   - どの条件でactivateするか
   - `layer.condition = new SignalComp("expression")`
   
5. Condition → Signal
   - 条件式でどのSignalを使うか
   - `"serverConnected === true"` → `serverConnected`
   
6. Layer → TargetMethod
   - どのメソッドを変更するか
   - `addPartialMethod(layer, EditorWidget, "save", ...)`
   
7. Signal → 変更箇所
   - どこで値が変わるか
   - `signal.value = newValue`

### **Phase 3: 依存グラフの構築**
8. Signal → Layer → Method の依存チェーン
   - Signal変更がどのメソッドに影響するかの全体像
   
9. オリジナルメソッド ↔ Layer版の対応
   - 同じメソッドの複数バージョンの関係
   
10. スコープ情報
    - どこで有効か
    - Layer のデプロイスコープ

---

## ツールの価値

### **開発者の理解を支援**
- COPコードの動作を静的に理解できる
- 実行しなくても依存関係が分かる
- デバッグが容易になる

### **保守性の向上**
- メソッド変更の影響範囲が分かる
- Signalの変更がどこに影響するか追跡できる
- リファクタリングが安全になる

### **モジュール性の可視化**
- Layerによる関心事の分離が見える
- コンテキストごとの動作バリエーションが把握できる
- アーキテクチャの理解が深まる

---

## 重要な認識

**「Layerインスタンスの操作検出」だけでは不十分**

これはPhase 1の「Layer定義」の一部に過ぎない。
真の目標は**関係性の抽出と依存グラフの構築**である。

単に「どこにLayerがあるか」を見つけるだけでなく:
- そのLayerが何を変更するか
- いつactivateするか
- どのSignalに依存するか
- 影響範囲はどこまでか

これら全体を理解できるようにすることが、ツールの本質的な価値。
