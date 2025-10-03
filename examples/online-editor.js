// Online Editor COP Example
// This example demonstrates Context-Oriented Programming concepts
// with a remote editor that switches behavior based on online/offline context

// ========== Classes (緑色 - Green in dependency graph) ==========

/**
 * RemoteEditor class - main orchestrator
 * Manages 4 dependency instances through composition pattern
 */
class RemoteEditor {
    constructor() {
        // Composition pattern - RemoteEditor has 4 instances
        this.editor = new Editor();
        this.workRemote = new WorkRemote();
        this.server = new Server();
        this.onlineLayer = new OnlineLayer();
    }
    
    initialize() {
        console.log("RemoteEditor initialized with dependencies");
    }
}

/**
 * EditorWidget class - UI component
 * Depends on editor instance and has render instance
 */
class EditorWidget {
    constructor(editor) {
        this.editor = editor;  // depends on editor instance
        this.render = new Render();  // has render instance
    }
    
    display() {
        this.render.draw();
    }
    
    save() {
        return this.editor.saveContent();
    }
}

// ========== Instances/Objects (オレンジ色 - Orange in dependency graph) ==========

/**
 * Editor instance - handles content editing
 */
class Editor {
    constructor() {
        this.content = "";
        this.isModified = false;
    }
    
    saveContent() {
        console.log("Editor: saving content locally");
        return "saved_locally";
    }
}

/**
 * WorkRemote instance - manages remote work session
 */
class WorkRemote {
    constructor() {
        this.connectionStatus = "disconnected";
    }
    
    connect() {
        this.connectionStatus = "connected";
        console.log("WorkRemote: connected");
    }
}

/**
 * Server instance - handles server communication
 */
class Server {
    constructor() {
        this.isOnline = false;
    }
    
    upload(data) {
        console.log("Server: uploading data");
        return "upload_success";
    }
}

/**
 * OnlineLayer instance - represents online context layer
 */
class OnlineLayer {
    constructor() {
        this.isActive = false;
        this.condition = "networkStatus === 'online'";
        this.eventsTriggered = 0;
        this.eventsRegistered = 5;
    }
    
    activate() {
        this.isActive = true;
        this.eventsTriggered += 1;
        console.log("OnlineLayer: activated");
    }
    
    deactivate() {
        this.isActive = false;
        console.log("OnlineLayer: just deactivated");
    }
}

/**
 * Render instance - handles UI rendering
 */
class Render {
    constructor() {
        this.canvas = null;
    }
    
    draw() {
        console.log("Render: drawing UI");
    }
}

/**
 * Save instance - represents save functionality
 */
class Save {
    constructor() {
        this.lastSaveTime = null;
    }
    
    execute(data) {
        this.lastSaveTime = new Date();
        console.log("Save: executing save operation");
        return data;
    }
}

// ========== COP Layer Definitions (黄色 - Yellow in dependency graph) ==========

/**
 * Layer definition for online editor functionality
 * Contains partial method implementation for online context
 */
const layerOnlineEditor = {
    condition: "onlineLayer.isActive === true",
    name: "onlineEditor",
    locations: 1,
    eventsTriggered: 10,
    
    // Partial method for save functionality
    saveImplementation: function(originalSave) {
        console.log("Layer onlineEditor: server.send(this.file, text)");
        // Send to server instead of local save
        return "sent_to_server";
    }
};

/**
 * Original save functionality - base behavior
 */
const originalSave = {
    name: "original",
    locations: 1,
    implementation: function() {
        console.log("Original save: this.localStorage.write(this.file, text)");
        return "saved_locally";
    }
};

// ========== COP Integration (EMA Framework) ==========

/**
 * Mock EMA (Event-based Middleware Architecture) operations
 * Simulates the COP runtime system
 */
const EMA = {
    /**
     * Exhibit signals from objects for layer conditions
     */
    exhibit: function(object, mappings) {
        console.log(`EMA.exhibit: exposing signals from ${object.constructor.name}`);
        Object.assign(object, mappings);
    },
    
    /**
     * Add partial method to target object via layer
     */
    addPartialMethod: function(layer, target, methodName, implementation) {
        console.log(`EMA.addPartialMethod: adding ${methodName} to ${target.constructor.name} via ${layer.name}`);
        // Store original method
        target[`_original_${methodName}`] = target[methodName];
        // Replace with layered implementation
        target[methodName] = implementation;
    },
    
    /**
     * Deploy layer for activation
     */
    deploy: function(layer) {
        console.log(`EMA.deploy: deploying layer ${layer.name}`);
        layer.isDeployed = true;
    }
};

// ========== Usage Example - Demonstrating COP Behavior ==========

// Create main system following the dependency graph structure
const remoteEditor = new RemoteEditor();
const editorWidget = new EditorWidget(remoteEditor.editor);
const saveInstance = new Save();

// Set up COP relationships (preparing for blue lines activation in graph)
EMA.exhibit(remoteEditor.onlineLayer, {
    networkStatus: "online"
});

// Add partial method as shown in yellow box of dependency graph
EMA.addPartialMethod(
    layerOnlineEditor, 
    saveInstance, 
    "execute", 
    function(data) {
        if (remoteEditor.onlineLayer.isActive) {
            return layerOnlineEditor.saveImplementation();
        } else {
            return originalSave.implementation();
        }
    }
);

EMA.deploy(layerOnlineEditor);

// ========== Execution Simulation ==========

console.log("=== System Initialization ===");
remoteEditor.initialize();
editorWidget.display();

console.log("\n=== Layer Activation (Blue lines become active) ===");
// Simulate online context - blue lines in dependency graph activate
remoteEditor.onlineLayer.activate();
const onlineResult = saveInstance.execute("test data");
console.log(`Result: ${onlineResult}`);

console.log("\n=== Layer Deactivation (Return to black lines) ==="); 
// Simulate offline context - return to normal dependency flow
remoteEditor.onlineLayer.deactivate();
const offlineResult = saveInstance.execute("test data");
console.log(`Result: ${offlineResult}`);

// ========== Export for COP-lens Analysis ==========

module.exports = {
    // Classes for dependency detection
    RemoteEditor,
    EditorWidget,
    
    // Instances for dependency analysis
    Editor,
    WorkRemote, 
    Server,
    OnlineLayer,
    Render,
    Save,
    
    // COP constructs for refinement detection
    layerOnlineEditor,
    originalSave,
    EMA
};