/**
 * Main Application
 * Demonstrates the structured COP architecture
 */

const EditorWidget = require("./EditorWidget");
const serverConnected = require("./serverSignal");
const layerOnlineEditor = require("./onlineEditorLayer");

console.log("\n========================================");
console.log("Structured COP Example");
console.log("========================================\n");

// Create editor instance
const editor = new EditorWidget();

// ========== Test Offline Mode ==========
console.log("\n--- Offline Mode (Layer Inactive) ---");
console.log("serverConnected.value =", serverConnected.value);

editor.save("Document content - offline");
console.log("Rendered:", editor.render());

// ========== Switch to Online Mode ==========
console.log("\n--- Switching to Online Mode ---");
serverConnected.value = true;  // Activate layer

editor.save("Document content - online");
console.log("Rendered:", editor.render());

// ========== Switch Back to Offline ==========
console.log("\n--- Switching to Offline Mode ---");
serverConnected.value = false;  // Deactivate layer

editor.save("Document content - offline again");
console.log("Rendered:", editor.render());

console.log("\n========================================");
console.log("Demo Complete");
console.log("========================================\n");
