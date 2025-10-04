const { createRemoteEditor } = require("./index");

/**
 * Demo script for Remote Editor with COP
 * Shows how the editor behavior changes based on connection state
 */

console.log("=== Initializing Remote Editor System ===\n");

// Create RemoteEditor instance (with reactive layer activation)
const remoteEditor = createRemoteEditor();

// ========== Initial System State (Offline) ==========
console.log("\n=== Initial System State (Offline) ===");
console.log("Layer onlineEditor: Deactivated");

// Test save functionality in offline mode
console.log("\n--- Testing Save in Offline Mode ---");
remoteEditor.editor.save("Sample document content");

// ========== Network Connection Established ==========
console.log("\n=== Network Connection Established ===");
const session = remoteEditor.workRemote();
console.log(`WorkRemote session started: ${session.sessionId}`);
remoteEditor.goOnline();  // This triggers layer activation automatically

// Test save functionality in online mode
console.log("\n--- Testing Save in Online Mode (Layer Active) ---");
remoteEditor.editor.save("Sample document content");

// ========== Network Connection Lost ==========
console.log("\n=== Network Connection Lost ===");
remoteEditor.goOffline();  // This triggers layer deactivation automatically

// Test save functionality back in offline mode
console.log("\n--- Testing Save After Going Offline ---");
remoteEditor.editor.save("Sample document content");

console.log("\n=== Demo Complete ===");
