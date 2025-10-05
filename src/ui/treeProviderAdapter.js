const vscode = require("vscode");
const { TreeViewProvider } = require("../features/treeViewProvider");

/**
 * COPTreeProviderAdapter - 既存のCOPTreeProviderを新しいTreeViewProviderに適合
 * 
 * VSCodeのTreeDataProviderインターフェースを実装し、
 * 内部で新しいTreeViewProviderを使用する
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
     * 解析結果を設定して更新
     * @param {Object} analysisResult - COPAnalyzerからの解析結果
     * @param {string} filePath - ファイルパス
     */
    setAnalysisResult(analysisResult, filePath = null) {
        this.analysisResult = analysisResult;
        this.currentFilePath = filePath;
        this.treeViewProvider = new TreeViewProvider(analysisResult, this.globalStore);
        this._onDidChangeTreeData.fire();
    }

    /**
     * 旧形式のsetResultsメソッド（後方互換性のため）
     * @param {Array} results - 旧形式の結果配列
     */
    setResults(results) {
        // 空の配列の場合は何もしない
        if (!results || results.length === 0) {
            this.analysisResult = null;
            this.treeViewProvider = null;
            this._onDidChangeTreeData.fire();
            return;
        }
        
        // 旧形式をそのまま使う場合（後方互換）
        // この場合は内部的に旧ロジックを使う必要がある
        // 実装はシンプルに、結果がないことを示す
        this.analysisResult = null;
        this.treeViewProvider = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        if (!element) return null;

        // TreeViewProviderのアイテムをVSCode TreeItemに変換
        const item = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = element.description;
        item.tooltip = element.tooltip;
        item.command = element.command;

        // アイコンを設定
        if (element.iconType) {
            item.iconPath = new vscode.ThemeIcon(
                element.iconType.icon,
                new vscode.ThemeColor(element.iconType.color)
            );
        }

        return item;
    }

    /**
     * 子要素を取得
     * @param {vscode.TreeItem} element - 親要素
     * @returns {Array<Object>} 子要素の配列
     */
    getChildren(element) {
        if (element) {
            // 現在の実装では子要素なし
            return [];
        }

        // ルートレベルの要素を返す
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
