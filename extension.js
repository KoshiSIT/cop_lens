// The module 'vscode' contains the VS Code extensibility API
const vscode = require("vscode");

// Unified architecture
const { COPAnalyzer } = require("./src/analyzer/copAnalyzer");
const { ProjectAnalyzer } = require("./src/analyzer/projectAnalyzer");
const { GlobalCOPDataStore } = require("./src/analyzer/globalCOPDataStore");

// UI Adapters
const { COPTreeProviderAdapter } = require("./src/ui/treeProviderAdapter");
const { COPHoverProviderAdapter } = require("./src/ui/hoverProviderAdapter");
const DependencyGraphView = require("./src/ui/dependencyGraphView");

// Utils
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
        const dependencyGraphView = new DependencyGraphView(context);
        
        // Initialize Global Data Store
        const globalStore = new GlobalCOPDataStore();
        
        // Initialize providers with globalStore
        const treeProvider = new COPTreeProviderAdapter(globalStore);
        const hoverProvider = new COPHoverProviderAdapter(globalStore);
        
        // Register hover provider for JavaScript files
        const hoverDisposable = vscode.languages.registerHoverProvider(
            { language: 'javascript', scheme: 'file' },
            hoverProvider
        );

        // Register tree data provider
        vscode.window.registerTreeDataProvider("copOverview", treeProvider);

        /**
         * Update global store with current file analysis
         */
        function updateGlobalStore() {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== "javascript") {
                return;
            }

            console.log("Updating global store...");
            const code = editor.document.getText();
            const filePath = editor.document.fileName;
            
            // Analyze current file and update global store
            const analyzer = new COPAnalyzer(filePath);
            const analysisResult = analyzer.analyze(code);
            
            globalStore.updateFile(filePath, analysisResult);
            
            console.log(`[Store] Updated ${filePath}: ${analysisResult.layers.length} layers, ${analysisResult.refinements.length} refinements`);
            
            // Update UI components (they read from globalStore)
            const fileAnalysis = globalStore.getFileAnalysis(filePath);
            treeProvider.setAnalysisResult(fileAnalysis, filePath);
            hoverProvider.setAnalysisResult(fileAnalysis);
            
            // Log statistics
            const stats = globalStore.getStatistics();
            console.log(`[Store] Total: ${stats.totalFiles} files, ${stats.totalLayers} layers, ${stats.totalRefinements} refinements`);
        }

        // Initialize project root
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const projectRoot = determineProjectRoot(editor.document);
            globalStore.setProjectRoot(projectRoot);
        }
        
        updateGlobalStore();

        // Update store when the file is changed
        const changeListener = vscode.window.onDidChangeActiveTextEditor(() => {
            updateGlobalStore();
        });

        // Update store when saved
        const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === "javascript") {
                updateGlobalStore();
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

        context.subscriptions.push(
            changeListener, 
            saveListener, 
            dependencyGraphCommand,
            hoverDisposable
        );
        
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
