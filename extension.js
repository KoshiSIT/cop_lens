// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { LayerDetector } = require("./src/parser/layerDetector");
const { RefinementDetector } = require("./src/parser/refinementDetector");
const ObjectDependencyDetector = require("./src/parser/objectDependencyDetector");
const { COPTreeProvider } = require("./src/ui/treeProvider");
const DependencyGraphView = require("./src/ui/dependencyGraphView");
const { setupCommands } = require("./src/commands");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log("COP-lens activated");
    const treeProvider = new COPTreeProvider();
    const dependencyGraphView = new DependencyGraphView(context);

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
    // Register dependency graph command
    const dependencyGraphCommand = vscode.commands.registerCommand('cop-lens.showDependencyGraph', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'javascript') {
            vscode.window.showErrorMessage('Please open a JavaScript file to analyze dependencies.');
            return;
        }

        try {
            const code = editor.document.getText();
            const filePath = editor.document.fileName;
            const fileName = vscode.workspace.asRelativePath(filePath);

            // Detect dependencies
            console.log('🔍 Starting dependency detection...');
            console.log('File path:', filePath);
            console.log('Code length:', code.length);
            
            const detector = new ObjectDependencyDetector();
            detector.setCurrentFile(filePath);
            const results = detector.detect(code);
            const dependencyGraph = detector.getDependencyGraph();
            
            console.log('📊 Detection results:', dependencyGraph.summary);
            console.log('📊 Nodes found:', dependencyGraph.nodes.length);
            console.log('📊 Edges found:', dependencyGraph.edges.length);

            if (dependencyGraph.summary.classes === 0) {
                console.log('⚠️ No classes detected in file');
                console.log('First 500 chars:', code.substring(0, 500));
                vscode.window.showInformationMessage('No classes found in the current file.');
                return;
            }
            
            console.log('✅ Classes found:', dependencyGraph.summary.classes);
            console.log('✅ Instances found:', dependencyGraph.summary.instances);
            console.log('✅ Dependencies found:', dependencyGraph.summary.dependencies);

            // Show in WebView
            dependencyGraphView.show(
                dependencyGraph,
                `Dependencies - ${fileName}`,
                fileName
            );

            // Show summary in status bar
            vscode.window.setStatusBarMessage(
                `📊 COP-lens: ${dependencyGraph.summary.classes} classes, ${dependencyGraph.summary.dependencies} dependencies`,
                5000
            );

        } catch (error) {
            console.error('Error generating dependency graph:', error);
            vscode.window.showErrorMessage(`Failed to generate dependency graph: ${error.message}`);
        }
    });

    setupCommands(context);

    context.subscriptions.push(changeListener, saveListener, dependencyGraphCommand);
}
// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
