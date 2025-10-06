/**
 * EditorWidget Class
 * A simple text editor widget with save and render functionality
 */

class EditorWidget {
    constructor() {
        this.file = "document.txt";
        this.content = "";
        this.localStorage = {
            write: (file, text) => {
                console.log(`  → Local save: "${text}" to ${file}`);
                return `saved_to_${file}`;
            },
        };
    }

    /**
     * Save text to local storage (original implementation)
     */
    save(text) {
        console.log("EditorWidget.save() - original");
        return this.localStorage.write(this.file, text);
    }

    /**
     * Render the editor interface
     */
    render() {
        console.log("EditorWidget.render() - drawing editor");
        return "<editor-ui>Editor</editor-ui>";
    }

    display() {
        console.log("EditorWidget.display()");
        return this.render();
    }
}

module.exports = EditorWidget;
