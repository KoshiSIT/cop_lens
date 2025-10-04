const { Layer, SignalComp, EMA } = require("../../lib/EMAjs-master/loader");
const EditorWidget = require("./EditorWidget");

/**
 * COP Layer Definition and Deployment
 * Defines online editor behavior as a context-oriented layer
 */

// ========== Layer Definition ==========
const layerOnlineEditor = new Layer("onlineEditor");

// Layer activation condition (based on server connection state)
layerOnlineEditor.condition = new SignalComp("serverConnected === true");

// Layer enter callback
layerOnlineEditor.onEnter = function() {
    console.log("Online layer activated - network connection established");
};

// Layer exit callback
layerOnlineEditor.onExit = function() {
    console.log("Online layer deactivated - network connection lost");
};

// ========== Partial Method Definition ==========
// Refine EditorWidget.save() for online mode
EMA.addPartialMethod(
    layerOnlineEditor,
    EditorWidget,
    "save",
    function(text) {
        console.log("onlineEditor layer: server mode active");
        // In online mode, we could add server sync here
        // For now, just proceed with original save
        Layer.proceed(text);
    }
);

// ========== Layer Deployment ==========
EMA.deploy(layerOnlineEditor);

console.log("Layer onlineEditor deployed");

module.exports = layerOnlineEditor;
