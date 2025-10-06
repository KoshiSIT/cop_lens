import RemoteEditor from './RemoteEditor.js';

/**
 * App.js - Main application logic
 * Connects UI elements with RemoteEditor and EditorWidget classes
 */

// Initialize RemoteEditor instance
const remoteEditor = new RemoteEditor();

// DOM elements
const toggle = document.getElementById('connectionToggle');
const statusIndicator = document.getElementById('statusIndicator');
const saveButton = document.getElementById('saveButton');
const editorContent = document.getElementById('editorContent');
const toast = document.getElementById('toast');

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast ('success', 'info', 'error')
 */
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

/**
 * Update UI based on current connection status
 */
function updateConnectionStatus() {
    const isOnline = remoteEditor.getStatus();
    
    if (isOnline) {
        statusIndicator.textContent = 'ONLINE';
        statusIndicator.className = 'status-indicator online';
    } else {
        statusIndicator.textContent = 'OFFLINE';
        statusIndicator.className = 'status-indicator offline';
    }
}

/**
 * Toggle connection status
 */
toggle.addEventListener('change', function() {
    if (this.checked) {
        remoteEditor.goOnline();
    } else {
        remoteEditor.goOffline();
    }
    updateConnectionStatus();
});

/**
 * Save button handler
 */
saveButton.addEventListener('click', function() {
    const text = editorContent.value;
    const isOnline = remoteEditor.getStatus();
    
    console.log(`\n💾 Save button clicked`);
    console.log(`   Mode: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`   Content length: ${text.length} characters`);
    
    // Call editor's save method (COP-aware)
    const result = remoteEditor.editor.save(text);
    
    console.log(`   Result: ${result}`);
    
    // Show toast notification based on context
    if (isOnline) {
        showToast('✅ Saved to server and localStorage', 'success');
    } else {
        showToast('✅ Saved to localStorage', 'info');
    }
});

/**
 * Initialize on page load
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Remote Editor Web App initialized');
    console.log('📋 Architecture: COP-enabled with EMA.js');
    console.log('   - EditorWidget: Base class');
    console.log('   - RemoteEditor: COP-enabled with onlineEditor layer');
    console.log('   - EMA.js: Context-Oriented Programming framework');
    console.log('\n💡 Open DevTools Console to see behavior logs');
    console.log('💡 Toggle Online/Offline to see layer activation\n');
    
    updateConnectionStatus();
    
    // Load saved content from localStorage if exists
    const savedContent = localStorage.getItem(remoteEditor.editor.file);
    if (savedContent) {
        editorContent.value = savedContent;
        console.log('📂 Loaded saved content from localStorage');
    }
});
