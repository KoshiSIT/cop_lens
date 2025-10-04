const { Signal } = require("../../lib/EMAjs-master/loader");
const EditorWidget = require("./EditorWidget");

/**
 * RemoteEditor class - main orchestrator
 * Manages editor, server connection state, and remote work sessions
 */
class RemoteEditor {
    constructor() {
        // EditorWidget instance
        this.editor = new EditorWidget();
        
        // Server connection state (Signal)
        this.server = new Signal(false);  // false = offline, true = online
    }

    /**
     * Start remote work session
     * @returns {Object} Session information
     */
    workRemote() {
        console.log("RemoteEditor.workRemote() - managing remote work session");
        return {
            sessionId: "session_" + Date.now(),
            isActive: true
        };
    }

    /**
     * Switch to online mode
     */
    goOnline() {
        console.log("\n=== Network Status: ONLINE ===");
        this.server.value = true;  // This will activate the layer
    }

    /**
     * Switch to offline mode
     */
    goOffline() {
        console.log("\n=== Network Status: OFFLINE ===");
        this.server.value = false;  // This will deactivate the layer
    }
}

module.exports = RemoteEditor;
