const vscode = require("vscode");

class COPTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.results = [];
    }

    /**
     * Update the tree view with new layer detection results
     * @param {Array} layerResults - Array of detected layer objects and refinement operations
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
                "No COP constructs detected",
                vscode.TreeItemCollapsibleState.None,
            );
            noResultItem.description = "";
            noResultItem.tooltip =
                "No layers or refinements detected in the current file.";
            return [noResultItem];
        }

        return this.results.map((result) => {
            const item = new vscode.TreeItem(
                this.getDisplayName(result),
                vscode.TreeItemCollapsibleState.None,
            );

            item.description = this.getDescription(result);
            item.tooltip = this.getTooltip(result);

            // Set color and icon based on construct type
            this.setIconAndColor(item, result);

            item.command = {
                command: "cop-lens.goToLine",
                title: "Go to Line",
                arguments: [result.line],
            };

            return item;
        });
    }

    /**
     * Get display name for tree item based on construct type
     * @param {Object} result - Detection result
     * @returns {string} Display name
     */
    getDisplayName(result) {
        switch (result.type) {
            case "layer":
                return `${result.name} (line ${result.line})`;
            case "refinement_exhibit":
                return `EMA.exhibit (line ${result.line})`;
            case "refinement_addPartialMethod":
                return `EMA.addPartialMethod (line ${result.line})`;
            case "refinement_proceed":
                return `Layer.proceed (line ${result.line})`;
            default:
                return `Unknown (line ${result.line})`;
        }
    }

    /**
     * Get description for tree item based on construct type
     * @param {Object} result - Detection result
     * @returns {string} Description
     */
    getDescription(result) {
        switch (result.type) {
            case "layer":
                return result.condition;
            case "refinement_exhibit":
                const mappingKeys = Object.keys(result.mappings);
                return `${result.targetObject} → ${mappingKeys.join(", ")}`;
            case "refinement_addPartialMethod":
                return `${result.targetObject}.${result.methodName} ← ${result.layerObject}`;
            case "refinement_proceed":
                return "Call base method";
            default:
                return "Unknown construct";
        }
    }

    /**
     * Get tooltip for tree item based on construct type
     * @param {Object} result - Detection result
     * @returns {string} Tooltip
     */
    getTooltip(result) {
        switch (result.type) {
            case "layer":
                return `Layer: ${result.name}\nCondition: ${result.condition}\nType: ${result.conditionType}`;
            case "refinement_exhibit":
                const mappings = Object.entries(result.mappings)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n");
                return `EMA.exhibit: ${result.targetObject}\nMappings:\n${mappings}`;
            case "refinement_addPartialMethod":
                return `EMA.addPartialMethod\nLayer: ${result.layerObject}\nTarget: ${result.targetObject}\nMethod: ${result.methodName}`;
            case "refinement_proceed":
                return "Layer.proceed() - Call base method implementation";
            default:
                return "Unknown COP construct";
        }
    }

    /**
     * Set icon and color for tree item based on construct type
     * @param {vscode.TreeItem} item - Tree item
     * @param {Object} result - Detection result
     */
    setIconAndColor(item, result) {
        switch (result.type) {
            case "layer":
                // Existing layer logic
                if (result.conditionType === "signal") {
                    item.iconPath = new vscode.ThemeIcon(
                        "circle-filled",
                        new vscode.ThemeColor("charts.blue"),
                    );
                } else if (result.conditionType === "string") {
                    item.iconPath = new vscode.ThemeIcon(
                        "circle-filled",
                        new vscode.ThemeColor("charts.green"),
                    );
                } else {
                    item.iconPath = new vscode.ThemeIcon(
                        "circle-filled",
                        new vscode.ThemeColor("charts.gray"),
                    );
                }
                break;
            case "refinement_exhibit":
                item.iconPath = new vscode.ThemeIcon(
                    "symbol-interface",
                    new vscode.ThemeColor("charts.purple"),
                );
                break;
            case "refinement_addPartialMethod":
                item.iconPath = new vscode.ThemeIcon(
                    "symbol-method",
                    new vscode.ThemeColor("charts.orange"),
                );
                break;
            case "refinement_proceed":
                item.iconPath = new vscode.ThemeIcon(
                    "arrow-right",
                    new vscode.ThemeColor("charts.yellow"),
                );
                break;
            default:
                item.iconPath = new vscode.ThemeIcon(
                    "question",
                    new vscode.ThemeColor("charts.gray"),
                );
        }
    }
}

module.exports = { COPTreeProvider };
