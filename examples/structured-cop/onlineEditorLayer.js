/**
 * COP Layer Definition and Deployment
 * Defines online editor behavior as a context-oriented layer
 */

const { Layer, SignalComp, EMA } = require("../../lib/EMAjs-master/loader");
const EditorWidget = require("./EditorWidget");
const serverConnected = require("./serverSignal");

// ========== Layer Definition ==========
const layerOnlineEditor = new Layer("onlineEditor");

// Layer activation condition (based on server connection state)
layerOnlineEditor.condition = new SignalComp("serverConnected === true");

// Layer enter callback
layerOnlineEditor.onEnter = function() {
    console.log("✓ Online layer activated - network connection established");
};

// Layer exit callback
layerOnlineEditor.onExit = function() {
    console.log("✗ Online layer deactivated - network connection lost");
};

// ========== Partial Method Definition ==========
// Refine EditorWidget.save() for online mode
EMA.addPartialMethod(
    layerOnlineEditor,
    EditorWidget,
    "save",
    function(text) {
        console.log("  [onlineEditor layer active]");
        console.log("  → Server sync: uploading to cloud...");
        // Simulate server upload
        console.log("  → Cloud save completed");
        // Then proceed with original local save
        Layer.proceed(text);
    }
);

// Refine EditorWidget.render() for online mode
EMA.addPartialMethod(
    layerOnlineEditor,
    EditorWidget,
    "render",
    function() {
        console.log("  [onlineEditor layer active]");
        console.log("  → Adding online indicator to UI");
        const originalUI = Layer.proceed();
        return originalUI.replace("</editor-ui>", " [ONLINE]</editor-ui>");
    }
);

// ========== Layer Deployment ==========
EMA.deploy(layerOnlineEditor);

console.log("Layer 'onlineEditor' deployed");

module.exports = layerOnlineEditor;
