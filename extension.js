// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { LayerDetector } = require("./src/parser/layerDetector");
const { RefinementDetector } = require("./src/parser/refinementDetector");
const { ObjectDependencyDetector } = require("./src/parser/objectDependencyDetector");
const { ProjectAnalyzer } = require("./src/analyzer/projectAnalyzer");
const { COPTreeProvider } = require("./src/ui/treeProvider");
const DependencyGraphView = require("./src/ui/dependencyGraphView");
const { setupCommands } = require("./src/commands");
const { determineProjectRoot } = require("./src/utils/projectUtils");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log("COP-lens activated");
    
    try {
        console.log("Loading dependencies...");
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
        console.log('Registering command: cop-lens.showDependencyGraph');
        const dependencyGraphCommand = vscode.commands.registerCommand('cop-lens.showDependencyGraph', async () => {
            console.log('Command cop-lens.showDependencyGraph executed!');
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'javascript') {
                vscode.window.showErrorMessage('Please open a JavaScript file to analyze dependencies.');
                return;
            }

            try {
                const filePath = editor.document.fileName;
                const fileName = vscode.workspace.asRelativePath(filePath);
                const projectRoot = determineProjectRoot(editor.document);

                // Analyze project using ProjectAnalyzer
                console.log('Starting project-wide dependency analysis...');
                console.log('Entry file:', filePath);
                console.log('Project root:', projectRoot);
                
                const analyzer = new ProjectAnalyzer(projectRoot);
                const dependencyGraph = await analyzer.analyzeProject();
                
                console.log('Analysis results:', dependencyGraph.summary);
                console.log('Nodes found:', dependencyGraph.nodes.length);
                console.log('Edges found:', dependencyGraph.edges.length);

                if (dependencyGraph.summary.classes === 0) {
                    console.log('No classes detected in project');
                    vscode.window.showInformationMessage('No classes found in the project.');
                    return;
                }
                
                console.log('Classes found:', dependencyGraph.summary.classes);
                console.log('Instances found:', dependencyGraph.summary.instances);
                console.log('Dependencies found:', dependencyGraph.summary.dependencies);

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

        context.subscriptions.push(changeListener, saveListener, dependencyGraphCommand);
        
        setupCommands(context);
        
        console.log("COP-lens activation complete!");
    } catch (error) {
        console.error("Error during activation:", error);
        vscode.window.showErrorMessage(`COP-lens activation failed: ${error.message}`);
    }
}
// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
