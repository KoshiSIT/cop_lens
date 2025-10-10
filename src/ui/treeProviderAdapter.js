const vscode = require("vscode");
const { TreeViewProvider } = require("../features/treeViewProvider");

/**
 * COPTreeProviderAdapter - Adapts existing COPTreeProvider to new TreeViewProvider
 * 
 * Implements VSCode's TreeDataProvider interface and uses the new TreeViewProvider internally
 */
class COPTreeProviderAdapter {
    constructor(globalStore = null) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.analysisResult = null;
        this.treeViewProvider = null;
        this.globalStore = globalStore;
        this.currentFilePath = null;
    }

    /**
     * Set analysis result and update
     * @param {Object} analysisResult - Analysis result from COPAnalyzer
     * @param {string} filePath - File path
     */
    setAnalysisResult(analysisResult, filePath = null) {
        this.analysisResult = analysisResult;
        this.currentFilePath = filePath;
        this.treeViewProvider = new TreeViewProvider(analysisResult, this.globalStore);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Legacy setResults method (for backward compatibility)
     * @param {Array} results - Legacy format result array
     */
    setResults(results) {
        // Do nothing if empty array
        if (!results || results.length === 0) {
            this.analysisResult = null;
            this.treeViewProvider = null;
            this._onDidChangeTreeData.fire();
            return;
        }
        
        // When using legacy format (backward compatibility)
        // In this case, we need to use legacy logic internally
        // Implementation is simple - indicate no results
        this.analysisResult = null;
        this.treeViewProvider = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        if (!element) return null;

        // Convert TreeViewProvider item to VSCode TreeItem
        const item = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = element.description;
        item.tooltip = element.tooltip;
        item.command = element.command;

        // Set icon
        if (element.iconType) {
            item.iconPath = new vscode.ThemeIcon(
                element.iconType.icon,
                new vscode.ThemeColor(element.iconType.color)
            );
        }

        return item;
    }

    /**
     * Get child elements
     * @param {vscode.TreeItem} element - Parent element
     * @returns {Array<Object>} Array of child elements
     */
    getChildren(element) {
        if (element) {
            // No child elements in current implementation
            return [];
        }

        // Return root level elements
        if (!this.treeViewProvider) {
            const noResultItem = {
                label: "No COP constructs detected",
                description: "",
                tooltip: "No analysis result available. Open a JavaScript file to analyze.",
                type: 'info'
            };
            return [noResultItem];
        }

        return this.treeViewProvider.buildTreeItems();
    }
}

module.exports = { COPTreeProviderAdapter };
