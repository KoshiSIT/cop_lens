/**
 * EditorWidget class - UI component for editor
 * Handles document editing and rendering
 * 
 * Base implementation (context-independent)
 */
class EditorWidget {
    constructor() {
        this.file = "document.txt";
        this.content = "";
    }

    /**
     * Save document (Base implementation)
     * @param {string} text - Content to save
     * @returns {string} Save result
     */
    save(text) {
        console.log("📝 EditorWidget.save() called (BASE implementation)");
        console.log(`   → Saving to localStorage: ${this.file}`);
        
        // Save to localStorage
        localStorage.setItem(this.file, text);
        
        console.log(`   ✅ Saved to localStorage`);
        return `saved_to_${this.file}`;
    }

    /**
     * Render editor interface
     * @returns {string} Rendered HTML
     */
    render() {
        console.log("🎨 EditorWidget.render() - drawing editor interface");
        return "<editor-ui>Rendered Editor</editor-ui>";
    }

    /**
     * Display editor
     * @returns {string} Display result
     */
    display() {
        console.log("👁️  EditorWidget.display() - displaying editor");
        return this.render();
    }
}

export default EditorWidget;
