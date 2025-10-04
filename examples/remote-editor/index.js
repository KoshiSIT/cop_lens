const { EMA } = require("../../lib/EMAjs-master/loader");
const RemoteEditor = require("./RemoteEditor");
const EditorWidget = require("./EditorWidget");
const layerOnlineEditor = require("./layers");

/**
 * Factory function to create RemoteEditor with reactive layer activation
 * @returns {RemoteEditor} Configured RemoteEditor instance
 */
function createRemoteEditor() {
    const remoteEditor = new RemoteEditor();
    
    // Setup reactive layer activation
    // Maps internal server Signal to public name "serverConnected"
    EMA.exhibit(remoteEditor, {
        serverConnected: remoteEditor.server
    });
    
    console.log("RemoteEditor initialized with reactive layer activation");
    
    return remoteEditor;
}

module.exports = {
    RemoteEditor,
    EditorWidget,
    layerOnlineEditor,
    createRemoteEditor
};
