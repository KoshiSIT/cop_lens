import { EMA, Layer, SignalComp } from './ema/loader.js';
import EditorWidget from './EditorWidget.js';

/**
 * COP Layer Definition and Deployment
 * Defines online editor behavior as a context-oriented layer
 */

// ========== Layer Definition ==========
const onlineLayerDefinition = {
    condition: "networkConnected === true",
    name: "onlineEditor",
    enter: function () {
        console.log("🔵 Online layer ACTIVATED - network connection established");
    },
    exit: function () {
        console.log("⚪ Online layer DEACTIVATED - network connection lost");
    }
};

// ========== Partial Method Definition ==========
// Refine EditorWidget.save() for online mode
// Note: We need to get the server instance from RemoteEditor
// So we'll define a function that takes the server as parameter
function setupOnlineLayer(server) {
    EMA.addPartialMethod(
        onlineLayerDefinition,
        EditorWidget.prototype,
        "save",
        function (text) {
            console.log("💾 EditorWidget.save() called (ONLINE LAYER)");
            console.log("   → Saving to both server AND localStorage");

            // Send to server first
            const serverResult = server.send(this.file, text);
            console.log(`   ✅ Uploaded to server: ${serverResult.status}`);

            // Then call original save (localStorage)
            Layer.proceed(text);

            return `saved_to_server_and_${this.file}`;
        }
    );

    // ========== Layer Deployment ==========
    EMA.deploy(onlineLayerDefinition);

    console.log("✅ Layer onlineEditor deployed");
}

export { onlineLayerDefinition, setupOnlineLayer };
