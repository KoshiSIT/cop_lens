// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { LayerDetector } = require("./src/parser/layerDetector");
const { RefinementDetector } = require("./src/parser/refinementDetector");
const { COPTreeProvider } = require("./src/ui/treeProvider");
const { setupCommands } = require("./src/commands");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log("COP-lens activated");
    const treeProvider = new COPTreeProvider();

    vscode.window.registerTreeDataProvider("copOverview", treeProvider);

    function analyzeCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "javascript") {
            treeProvider.updateResults([]);
            return;
        }

        console.log("Analyzing current file for layers...");
        const code = editor.document.getText();
        const layerDetector = new LayerDetector();
        const results = layerDetector.detect(code);

        const refinementDetector = new RefinementDetector();
        const refinementResults = refinementDetector.detect(code);

        console.log(`Detected ${results.length} layers.`);
        const allResults = [...results, ...refinementResults].sort(
            (a, b) => a.line - b.line,
        );
        treeProvider.updateResults(allResults);
    }

    analyzeCurrentFile();

    // update analysis when the file is changed
    const changeListener = vscode.window.onDidChangeActiveTextEditor(() => {
        analyzeCurrentFile();
    });

    // update analysis when saved

    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === "javascript") {
            analyzeCurrentFile();
        }
    });
    setupCommands(context);

    context.subscriptions.push(changeListener, saveListener);
}
// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
