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
 * Has 4 dependencies: editor, workRemote, server, onlineLayer
 */
class RemoteEditor {
    constructor() {
        // Create instances (orange nodes)
        this.editor = new Editor();
        this.workRemote = new WorkRemote();
        this.server = new Server();

        // Network status signal for layer condition
        this.networkStatus = new Signal(false); // false = offline, true = online

        // Layer definition object (will become onlineLayer instance via deploy)
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
                this.server.send(this.file, text);
                // Then call original save (proceed)
                Layer.proceed(text);
            }.bind(this),
        );

        // EMA.deploy: Deploy layer (creates onlineLayer instance)
        EMA.deploy(this.onlineLayerDefinition);

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
 * Depends on editor instance and has render instance
 */
class EditorWidget {
    constructor(editor) {
        this.editor = editor; // depends on editor instance
        this.render = new Render(); // has render instance
    }

    display() {
        console.log("EditorWidget: displaying editor");
        return this.render.draw();
    }

    triggerSave() {
        const content = "Sample document content";
        console.log("EditorWidget: triggering save operation");
        return this.editor.save(content);
    }
}

// ========== Instances/Objects (Orange nodes in diagram) ==========

/**
 * Editor instance - handles document editing
 */
class Editor {
    constructor() {
        this.file = "document.txt";
        this.content = "";
        this.localStorage = {
            write: (file, text) => {
                console.log(
                    `original: save(text) { this.localStorage.write(this.file, text); }`,
                );
                console.log(`  → Saved "${text}" to local file: ${file}`);
                return `saved_to_${file}`;
            },
        };
    }

    save(text) {
        console.log("Editor.save() called");
        return this.localStorage.write(this.file, text);
    }
}

/**
 * WorkRemote instance - manages remote work session
 */
class WorkRemote {
    constructor() {
        this.sessionId = null;
        this.isActive = false;
    }

    startSession() {
        this.sessionId = "session_" + Date.now();
        this.isActive = true;
        console.log(`WorkRemote: started session ${this.sessionId}`);
    }

    endSession() {
        console.log(`WorkRemote: ended session ${this.sessionId}`);
        this.isActive = false;
        this.sessionId = null;
    }
}

/**
 * Server instance - handles server communication
 */
class Server {
    constructor() {
        this.connected = false;
        this.baseUrl = "https://remote-server.com";
    }

    send(file, text) {
        console.log(
            `  → Server.send("${file}", "${text}") - uploading to ${this.baseUrl}`,
        );
        return { status: "uploaded", file: file, size: text.length };
    }

    connect() {
        this.connected = true;
        console.log("Server: connection established");
    }

    disconnect() {
        this.connected = false;
        console.log("Server: connection closed");
    }
}

/**
 * Render instance - handles UI rendering
 */
class Render {
    constructor() {
        this.canvas = "canvas-element";
    }

    draw() {
        console.log("Render: drawing editor interface");
        return "<editor-ui>Rendered Editor</editor-ui>";
    }
}

/**
 * Save instance - represents save functionality
 * This could be extended with additional save operations
 */
class Save {
    constructor() {
        this.lastSaveTime = null;
        this.saveCount = 0;
    }

    execute(data, method = "local") {
        this.lastSaveTime = new Date();
        this.saveCount++;
        console.log(`Save.execute: method=${method}, count=${this.saveCount}`);
        return { saved: true, method: method, timestamp: this.lastSaveTime };
    }
}

// ========== Usage Example - Reproducing the Diagram Behavior ==========

console.log("=== Initializing Remote Editor System ===");

// Create the main system following diagram structure
const remoteEditor = new RemoteEditor();
const editorWidget = new EditorWidget(remoteEditor.editor);
const saveInstance = new Save();

console.log("\n=== Initial System State (Offline) ===");
console.log("Layer onlineEditor: Just deactivated");
console.log("- 1 Location");
console.log("- Caused 10 Events");
console.log("- Has 5 Events");

// Test save functionality in offline mode
console.log("\n--- Testing Save in Offline Mode ---");
editorWidget.triggerSave();

console.log("\n=== Network Connection Established ===");
// Simulate network connection - this will activate the layer
remoteEditor.server.connect();
remoteEditor.workRemote.startSession();
remoteEditor.goOnline(); // This triggers layer activation

// Test save functionality in online mode (blue arrows active)
console.log("\n--- Testing Save in Online Mode (Blue Arrows Active) ---");
editorWidget.triggerSave();

console.log("\n=== Network Connection Lost ===");
// Simulate network disconnection - this will deactivate the layer
remoteEditor.goOffline(); // This triggers layer deactivation
remoteEditor.server.disconnect();
remoteEditor.workRemote.endSession();

// Test save functionality back in offline mode
console.log("\n--- Testing Save After Going Offline ---");
editorWidget.triggerSave();

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

    // Instances for dependency analysis
    Editor,
    WorkRemote,
    Server,
    Render,
    Save,

    // Example instances for testing
    remoteEditor,
    editorWidget,
    saveInstance,

    // EMA framework reference
    EMA,
};
