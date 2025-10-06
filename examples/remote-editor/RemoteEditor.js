const { Signal, EMA } = require("../../lib/EMAjs-master/loader");
const EditorWidget = require("./EditorWidget");
const layerOnlineEditor = require("./layers");

/**
 * RemoteEditor class - main orchestrator
 * Manages editor, server connection state, and remote work sessions
 * 
 * Properties:
 *   - editor: EditorWidget instance
 *   - server: Signal for server connection state
 *   - layerOnlineEditor: Layer instance (from layers.js)
 */
class RemoteEditor {
    constructor() {
        // EditorWidget instance
        this.editor = new EditorWidget();
        
        // Server connection state (Signal)
        this.server = new Signal(false);  // false = offline, true = online
        
        // Setup COP layers
        this.setupCOP();
    }
    
    /**
     * Setup Context-Oriented Programming
     */
    setupCOP() {
        // Exhibit server signal for layer condition
        EMA.exhibit(this, {
            serverConnected: this.server
        });
        
        // Store reference to Layer instance
        this.layerOnlineEditor = layerOnlineEditor;
        
        console.log("RemoteEditor: COP layers initialized");
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
