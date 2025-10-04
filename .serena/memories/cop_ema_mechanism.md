# COP (Context-Oriented Programming) と EMA.js の動作メカニズム

## COPの本質

COPは**オリジナルのクラス/オブジェクトのメソッドを動的に入れ替える**仕組み。
- プロトタイプではなく、**オブジェクトのプロパティを直接書き換える**
- **Signalの変化**がトリガーとなって、Layerがactivate/deactivateする
- これにより、**コンテキストに応じた動作の切り替え**を実現

---

## EMA.jsの動作メカニズム（詳細）

### **ステップ1: 準備（addPartialMethod）**

```javascript
EMA.addPartialMethod(
    layerOnlineEditor,  // Layer
    EditorWidget,       // ターゲットオブジェクト
    "save",             // メソッド名
    function(text) {    // 新しい実装
        console.log("online mode");
        Layer.proceed(text);
    }
);
```

**内部処理:**
1. `OriginalMethodsPool.add(EditorWidget, "save")`
   - オリジナルのメソッドを保存: `[EditorWidget, "save", 元のsave関数]`
   
2. `PartialMethodsPool.add(EditorWidget, "save", 新実装, layerOnlineEditor)`
   - 部分メソッドを保存: `[EditorWidget, "save", 新実装, layerOnlineEditor]`

**重要:** この時点では`EditorWidget.save`はまだオリジナルのまま。プールに情報を記録しただけ。

---

### **ステップ2: Layer Activate（メソッド置き換え）**

```javascript
// Signalの値が変わる
serverConnected.value = true;

// ↓ Layer.condition が評価される（"serverConnected === true"）
// ↓ 条件がtrueになる
// ↓ Layer._enter() が呼ばれる
// ↓ Layer._installPartialMethod() が呼ばれる
```

**`_installPartialMethod()`の動作:**

```javascript
this._installPartialMethod = function() {
    PartialMethodsPool.forEachByLayer(this, function (obj, methodName, partialMethodImpl) {
        // ★ここで実際にメソッドを置き換える！
        obj[methodName] = function () {  // 直接代入で上書き
            Layer.proceed = function () {
                return Layer._executeOriginalMethod(obj, methodName, arguments);
            };

            let args = arguments;
            let result = partialMethodImpl.apply(obj, args);  // 新しい実装を実行
            
            Layer.proceed = undefined;
            return result;
        };
    });
};
```

**結果:**
```javascript
// Before
EditorWidget.save = オリジナルの実装

// After
EditorWidget.save = ラッパー関数 {
    Layer.proceed を設定;
    partialMethodImpl を実行;  // 新しい実装
    Layer.proceed をクリア;
}
```

---

### **ステップ3: Layer Deactivate（メソッド復元）**

```javascript
// Signalの値が変わる
serverConnected.value = false;

// ↓ Layer._exit() が呼ばれる
// ↓ Layer._uninstallPartialMethods() が呼ばれる
```

**`_uninstallPartialMethods()`の動作:**

```javascript
this._uninstallPartialMethods = function() {
    PartialMethodsPool.forEachByLayer(this, function (obj, methodName) {
        // オリジナルのメソッドを復元
        obj[methodName] = OriginalMethodsPool.get(obj, methodName);
    });
};
```

**結果:**
```javascript
EditorWidget.save = オリジナルの実装に戻る
```

---

## 動作フロー全体図

```
【初期状態】
EditorWidget.save = オリジナルの実装

        ↓ EMA.addPartialMethod()

【準備完了】
- OriginalMethodsPool: [EditorWidget, "save", オリジナル] 保存済み
- PartialMethodsPool: [EditorWidget, "save", 新実装, layer] 保存済み
- EditorWidget.save = まだオリジナルのまま（変更なし）

        ↓ Signal.value = true

【Layer Activate】
- _installPartialMethod() 実行
- obj["save"] = ラッパー関数  ← 直接代入で上書き
- EditorWidget.save = 新しい実装が動く

        ↓ Signal.value = false

【Layer Deactivate】
- _uninstallPartialMethods() 実行
- obj["save"] = オリジナル  ← 復元
- EditorWidget.save = オリジナルに戻る
```

---

## 重要な発見

### **メソッドの置き換え方法**
- ❌ プロトタイプチェーンを使っているわけではない
- ✅ オブジェクトのプロパティを**直接書き換え**ている
- 実装: `obj[methodName] = 新しい関数;`

### **Layer.proceed の仕組み**
- Layer.proceed は**グローバルな関数**として一時的に設定される
- 部分メソッド内で`Layer.proceed()`を呼ぶと、オリジナルのメソッドが実行される
- 実行後、`Layer.proceed`はundefinedに戻される

### **2つのプール**
1. **OriginalMethodsPool**: オリジナルのメソッドを保存（読み取り専用）
2. **PartialMethodsPool**: 部分メソッドを保存（読み取り専用）

---

## COPの利点

- **関心事の分離**: コンテキスト依存の動作を別モジュール（Layer）に分離
- **動的切り替え**: 実行時にSignalの変化で動作を切り替え
- **非侵襲的**: 元のクラス定義を変更せずに動作を拡張
- **モジュール化**: 複数のLayerを独立して定義・管理できる

---

## 検出すべき構文（今後の実装に向けて）

このメカニズムを理解した上で、静的解析で検出すべき要素:

1. **Layer定義**
   - `new Layer("name")`
   - オブジェクトリテラル `{ condition: "..." }`

2. **Layer設定**
   - `layer.condition = new SignalComp("...")`
   - `layer.onEnter = function() {...}`

3. **部分メソッド定義**
   - `EMA.addPartialMethod(layer, target, method, impl)`
   - どのLayerが、どのオブジェクトの、どのメソッドを変更するか

4. **Signal定義**
   - `new Signal(initialValue)`
   - Layerの条件で使われるSignal

5. **Layer配備**
   - `EMA.deploy(layer)`

6. **Signal展開**
   - `EMA.exhibit(obj, { signalName: signal })`
