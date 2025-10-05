// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { BabelLayerDetector } = require("./src/parser/babelLayerDetector");
const { BabelRefinementDetector } = require("./src/parser/babelRefinementDetector");
const { BabelObjectDependencyDetector } = require("./src/parser/babelObjectDependencyDetector");
const { ProjectAnalyzer } = require("./src/analyzer/projectAnalyzer");
const { COPTreeProvider } = require("./src/ui/treeProvider");
const { COPTreeProviderAdapter } = require("./src/ui/treeProviderAdapter");
const DependencyGraphView = require("./src/ui/dependencyGraphView");
const { setupCommands } = require("./src/commands");
const { determineProjectRoot } = require("./src/utils/projectUtils");
const { BabelSymbolDetector } = require("./src/parser/babelSymbolDetector");
const { SymbolRegistry } = require("./src/analyzer/symbolRegistry");
const { COPHoverProvider } = require("./src/ui/hoverProvider");
const { COPHoverProviderAdapter } = require("./src/ui/hoverProviderAdapter");
const { COPAnalysisResult } = require("./src/analyzer/copAnalysisResult");

// New unified architecture (Phase 1: parallel operation)
const { COPAnalyzer } = require("./src/analyzer/copAnalyzer");
const { HoverProvider } = require("./src/features/hoverProvider");
const { TreeViewProvider } = require("./src/features/treeViewProvider");
const { DependencyGraphProvider } = require("./src/features/dependencyGraphProvider");

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
        
        // OLD: Keep for backward compatibility (Phase 2 will remove)
        const analysisResult = new COPAnalysisResult();
        const oldHoverProvider = new COPHoverProvider(analysisResult);
        const oldTreeProvider = new COPTreeProvider();
        
        // NEW: Use adapters with new architecture
        const newTreeProvider = new COPTreeProviderAdapter();
        const newHoverProvider = new COPHoverProviderAdapter();
        
        // Register NEW hover provider for JavaScript files
        const hoverDisposable = vscode.languages.registerHoverProvider(
            { language: 'javascript', scheme: 'file' },
            newHoverProvider
        );

        // Register NEW tree data provider
        vscode.window.registerTreeDataProvider("copOverview", newTreeProvider);

        function analyzeCurrentFile() {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== "javascript") {
                // Clear NEW providers
                newTreeProvider.setAnalysisResult(null);
                newHoverProvider.setAnalysisResult(null);
                
                // Clear OLD providers (keep for compatibility)
                analysisResult.entities = [];
                analysisResult.buildIndices();
                oldTreeProvider.setResults([]);
                return;
            }

            console.log("Analyzing current file...");
            const code = editor.document.getText();
            const filePath = editor.document.fileName;
            
            // NEW: Use unified COPAnalyzer
            const analyzer = new COPAnalyzer(filePath);
            const newAnalysisResult = analyzer.analyze(code);
            
            console.log(`[NEW] Detected ${newAnalysisResult.layers.length} layers, ${newAnalysisResult.refinements.length} refinements`);
            
            // Update NEW UI components
            newTreeProvider.setAnalysisResult(newAnalysisResult);
            newHoverProvider.setAnalysisResult(newAnalysisResult);
            
            // OLD: Keep existing analysis for backward compatibility (will be removed in Phase 3)
            const layerDetector = new BabelLayerDetector();
            const layerResults = layerDetector.detect(code);

            const refinementDetector = new BabelRefinementDetector();
            const refinementResults = refinementDetector.detect(code);

            const symbolDetector = new BabelSymbolDetector();
            const symbols = symbolDetector.detect(code);
            
            console.log(`[OLD] Detected ${layerResults.length} layers, ${refinementResults.length} refinements`);
            
            // Build old unified analysis result (keep for comparison)
            analysisResult.entities = []; // Reset
            analysisResult.mergeLayerResults(layerResults);
            analysisResult.mergeRefinementResults(refinementResults);
            analysisResult.mergeSymbols(symbols);
            analysisResult.buildIndices();
            
            // Update OLD UI components (disabled - using new ones)
            // oldTreeProvider.setResults(analysisResult.getLegacyResults());
            // oldHoverProvider.setAnalysisResult(analysisResult);
            
            // Log statistics
            const stats = analysisResult.getStatistics();
            console.log(`[OLD] Analysis complete:`, stats);
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
