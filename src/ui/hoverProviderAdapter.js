const vscode = require("vscode");
const { HoverProvider } = require("../features/hoverProvider");

/**
 * COPHoverProviderAdapter - Adapts existing COPHoverProvider to new HoverProvider
 * 
 * Implements VSCode's HoverProvider interface and uses the new HoverProvider internally
 */
class COPHoverProviderAdapter {
    constructor(globalStore = null) {
        this.analysisResult = null;
        this.hoverProvider = null;
        this.globalStore = globalStore;
    }

    /**
     * Set analysis result
     * @param {Object} analysisResult - Analysis result from COPAnalyzer
     */
    setAnalysisResult(analysisResult) {
        this.analysisResult = analysisResult;
        this.hoverProvider = new HoverProvider(analysisResult, this.globalStore);
    }

    /**
     * Provide VSCode hover information
     * @param {vscode.TextDocument} document - Document
     * @param {vscode.Position} position - Cursor position
     * @returns {vscode.Hover|null} Hover information
     */
    provideHover(document, position) {
        if (!this.hoverProvider) {
            return null;
        }

        // Convert VSCode Position to {line, character} format
        const pos = {
            line: position.line,
            character: position.character
        };

        // Pass filePath when using globalStore
        const filePath = document.fileName;
        const entity = this.hoverProvider.findEntityAt(pos, filePath);
        
        if (!entity) {
            return null;
        }
        
        const content = this.hoverProvider.generateHoverContent(entity);
        if (!content) {
            return null;
        }
        
        const hoverInfo = {
            contents: content,
            range: entity.range
        };
        if (!hoverInfo) {
            return null;
        }

        // Create Markdown content
        const markdown = new vscode.MarkdownString(hoverInfo.contents);
        markdown.isTrusted = true;

        // Return VSCode Hover object
        return new vscode.Hover(markdown);
    }
}

module.exports = { COPHoverProviderAdapter };
