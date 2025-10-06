import { EMA, Signal } from './ema/loader.js';
import EditorWidget from './EditorWidget.js';
import { onlineLayerDefinition, setupOnlineLayer } from './layers.js';

/**
 * RemoteEditor class - main orchestrator with COP support
 * Manages editor, server connection, and layer-based behavior
 * 
 * Uses EMA.js for Context-Oriented Programming
 */
class RemoteEditor {
    constructor() {
        // EditorWidget instance
        this.editor = new EditorWidget();
        
        // Server mock object
        this.server = {
            baseUrl: "https://remote-server.com/api",
            connected: false,
            send: function(file, text) {
                console.log(`   📤 Server.send("${file}", ${text.length} chars)`);
                console.log(`   → Uploading to ${this.baseUrl}`);
                return { 
                    status: "uploaded", 
                    file: file, 
                    size: text.length,
                    timestamp: new Date().toISOString()
                };
            },
            connect: function() {
                this.connected = true;
                console.log("   🔌 Server: connection established");
            },
            disconnect: function() {
                this.connected = false;
                console.log("   🔌 Server: connection closed");
            }
        };

        // Network status signal for layer condition
        this.networkStatus = new Signal(false);

        // Setup COP
        this.setupCOP();
    }

    /**
     * Setup Context-Oriented Programming
     */
    setupCOP() {
        console.log("⚙️  Setting up COP layers...");
        
        // EMA.exhibit: Expose network status signal
        EMA.exhibit(this, {
            networkConnected: this.networkStatus
        });

        // Setup and deploy online layer from layers.js
        setupOnlineLayer(this.server);

        console.log("✅ COP layers initialized");
    }

    /**
     * Start remote work session
     * @returns {Object} Session information
     */
    workRemote() {
        console.log("🌐 RemoteEditor.workRemote() - managing remote work session");
        return {
            sessionId: "session_" + Date.now(),
            isActive: true
        };
    }

    /**
     * Switch to online mode
     */
    goOnline() {
        console.log("\n=== 🟢 Network Status: ONLINE ===");
        this.server.connect();
        this.networkStatus.value = true;
    }

    /**
     * Switch to offline mode
     */
    goOffline() {
        console.log("\n=== ⚪ Network Status: OFFLINE ===");
        this.server.disconnect();
        this.networkStatus.value = false;
    }

    /**
     * Get current connection status
     * @returns {boolean} true if online, false if offline
     */
    getStatus() {
        return this.networkStatus.value;
    }
}

export default RemoteEditor;
