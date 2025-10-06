// Remote Editor Example with EMA.js
// This example reproduces the dependency graph shown in the diagram
// using proper EMA.js syntax and patterns

const {
    Signal,
    SignalComp,
    Layer,
    EMA,
    show,
} = require("../lib/EMAjs-master/loader");

// ========== Classes (Green nodes in diagram) ==========

/**
 * RemoteEditor class - main orchestrator (remote-editor)
 * Properties: 
 *   - editor: EditorWidget instance
 *   - server: server object with send() method
 *   - networkStatus: Signal for network connection state
 *   - onlineLayerDefinition: Layer definition object
 *   - onlineLayer: Layer instance (created by EMA.deploy)
 * Methods: workRemote()
 */
class RemoteEditor {
    constructor() {
        // editor is an instance of EditorWidget (orange node -> green node)
        this.editor = new EditorWidget();
        
        // server is a simple object property
        this.server = {
            baseUrl: "https://remote-server.com",
            connected: false,
            send: function(file, text) {
                console.log(`  → Server.send("${file}", "${text}") - uploading to ${this.baseUrl}`);
                return { status: "uploaded", file: file, size: text.length };
            },
            connect: function() {
                this.connected = true;
                console.log("Server: connection established");
            },
            disconnect: function() {
                this.connected = false;
                console.log("Server: connection closed");
            }
        };

        // Network status signal for layer condition
        this.networkStatus = new Signal(false); // false = offline, true = online

        // onlineLayer property - layer definition object
        this.onlineLayerDefinition = {
            condition: "networkConnected === true",
            name: "onlineEditor",
            enter: function() {
                console.log("Online layer activated - network connection established");
            },
            exit: function() {
                console.log("Online layer deactivated - network connection lost");
            },
        };

        this.setupCOP();
    }

    // workRemote is a METHOD (not a class!)
    workRemote() {
        console.log("RemoteEditor.workRemote() - managing remote work session");
        return {
            sessionId: "session_" + Date.now(),
            isActive: true
        };
    }

    setupCOP() {
        // EMA.exhibit: Expose network status signal
        EMA.exhibit(this, {
            networkConnected: this.networkStatus,
        });

        // EMA.addPartialMethod: Register partial methods for online behavior
        EMA.addPartialMethod(
            this.onlineLayerDefinition,
            this.editor,
            "save",
            function(text) {
                console.log("onlineEditor: server.send(this.file, text)");
                // Send to server first
                this.server.send("document.txt", text);
                // Then call original save (proceed)
                Layer.proceed(text);
            }.bind(this),
        );

        EMA.addPartialMethod(
            this.onlineLayerDefinition,
            this.editor,
            "render",
            function() {
                console.log("onlineEditor: online rendering mode");
                // Call original render
                return Layer.proceed();
            }.bind(this),
        );

        // EMA.deploy: Deploy layer and store instance in onlineLayer property
        this.onlineLayer = EMA.deploy(this.onlineLayerDefinition);

        console.log("RemoteEditor initialized with COP layers");
    }

    // Simulate network connection changes
    goOnline() {
        console.log("\n=== Network Status: ONLINE ===");
        this.networkStatus.value = true; // This will activate the layer
    }

    goOffline() {
        console.log("\n=== Network Status: OFFLINE ===");
        this.networkStatus.value = false; // This will deactivate the layer
    }
}

/**
 * EditorWidget class - UI component (EditorWidget)
 * Methods: save(), render()
 */
class EditorWidget {
    constructor() {
        this.file = "document.txt";
        this.content = "";
        this.localStorage = {
            write: (file, text) => {
                console.log(`original: save(text) { this.localStorage.write(this.file, text); }`);
                console.log(`  → Saved "${text}" to local file: ${file}`);
                return `saved_to_${file}`;
            },
        };
    }

    // save is a METHOD (not a class!)
    save(text) {
        console.log("EditorWidget.save() called");
        return this.localStorage.write(this.file, text);
    }

    // render is a METHOD (not a class!)
    render() {
        console.log("EditorWidget.render() - drawing editor interface");
        return "<editor-ui>Rendered Editor</editor-ui>";
    }

    display() {
        console.log("EditorWidget: displaying editor");
        return this.render();
    }
}

// ========== Usage Example - Reproducing the Diagram Behavior ==========

console.log("=== Initializing Remote Editor System ===");

// Create the main system following diagram structure
const remoteEditor = new RemoteEditor();

console.log("\n=== Initial System State (Offline) ===");
console.log("Layer onlineEditor: Just deactivated");
console.log("- 1 Location");
console.log("- Caused 10 Events");
console.log("- Has 5 Events");

// Test save functionality in offline mode
console.log("\n--- Testing Save in Offline Mode ---");
remoteEditor.editor.save("Sample document content");

console.log("\n=== Network Connection Established ===");
// Simulate network connection - this will activate the layer
remoteEditor.server.connect();
const session = remoteEditor.workRemote(); // Call workRemote METHOD
console.log(`WorkRemote session started: ${session.sessionId}`);
remoteEditor.goOnline(); // This triggers layer activation

// Test save functionality in online mode (blue arrows active)
console.log("\n--- Testing Save in Online Mode (Blue Arrows Active) ---");
remoteEditor.editor.save("Sample document content");

console.log("\n=== Network Connection Lost ===");
// Simulate network disconnection - this will deactivate the layer
remoteEditor.goOffline(); // This triggers layer deactivation
remoteEditor.server.disconnect();

// Test save functionality back in offline mode
console.log("\n--- Testing Save After Going Offline ---");
remoteEditor.editor.save("Sample document content");

console.log("\n=== Layer Status Information ===");
// Display layer information similar to yellow boxes in diagram
const activeLayers = EMA.getActiveLayers();
const inactiveLayers = EMA.getInactiveLayers();

console.log("Active layers:", activeLayers.length);
console.log("Inactive layers:", inactiveLayers.length);

activeLayers.forEach((layer) => {
    console.log(`Layer ${layer.name}: Active`);
});

inactiveLayers.forEach((layer) => {
    console.log(`Layer ${layer.name}: Just deactivated`);
    console.log("- 1 Location");
    console.log("- Caused 10 Events");
    console.log("- Has 5 Events");
});

// ========== Export for COP-lens Analysis ==========
module.exports = {
    // Classes for dependency detection
    RemoteEditor,
    EditorWidget,

    // Example instances for testing
    remoteEditor,

    // EMA framework reference
    EMA,
};
