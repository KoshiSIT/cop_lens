const vscode = require("vscode");

class COPTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.results = [];
    }
    /**
     * Update the tree view with new layer detection results
     * @param {Array} layerResults - Array of detected layer objects
     */
    updateResults(layerResults) {
        this.results = layerResults;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for a given tree item or root if no item is provided
     * @param {vscode.TreeItem} element - Parent tree item
     * @returns {Array<vscode.TreeItem>} Array of child tree items
     */
    getChildren(element) {
        if (!element) {
            return this.createTreeItems();
        }
        return [];
    }
    /**
     * Transform layer results into TreeItem instances
     * @returns {Array<vscode.TreeItem>} Array of TreeItem instances
     */
    createTreeItems() {
        if (this.results.length === 0) {
            const noResultItem = new vscode.TreeItem(
                "No layers detected",
                vscode.TreeItemCollapsibleState.None,
            );
            noResultItem.description = "";
            noResultItem.tooltip = " No layers detected in the current file.";
            return [noResultItem];
        }

        return this.results.map((layer) => {
            const item = new vscode.TreeItem(
                `${layer.name} (line ${layer.line})`,
                vscode.TreeItemCollapsibleState.None,
            );
            item.description = layer.condition;
            item.tooltip = `Layer: ${layer.name}\nCondition: ${layer.condition}\nType: ${layer.conditionType}`;

            item.command = {
                command: "cop-lens.goToLine",
                title: "Go to Line",
                arguments: [layer.line],
            };
            return item;
        });
    }
}

module.exports = { COPTreeProvider };
