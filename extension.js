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

        /**
         * Initialize project-wide analysis
         */
        async function initializeProjectAnalysis() {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'javascript') {
                return;
            }

            console.log("[Store] Initializing project-wide analysis...");
            const projectRoot = determineProjectRoot(editor.document);
            globalStore.setProjectRoot(projectRoot);

            try {
                // Step 1: Analyze dependency graph (project-wide)
                const projectAnalyzer = new ProjectAnalyzer(projectRoot);
                const dependencyGraph = await projectAnalyzer.analyzeProject();
                
                // Save dependency graph to store
                globalStore.setDependencyGraph(dependencyGraph);
                console.log(`[Store] Dependency graph saved: ${dependencyGraph.nodes.length} nodes, ${dependencyGraph.edges.length} edges`);

                // Step 2: Analyze each file for COP constructs
                const scopeDir = require('path').dirname(editor.document.fileName);
                const jsFiles = collectJavaScriptFiles(scopeDir);
                
                console.log(`[Store] Analyzing ${jsFiles.length} JavaScript files...`);
                for (const file of jsFiles) {
                    try {
                        const code = require('fs').readFileSync(file, 'utf8');
                        const copAnalyzer = new COPAnalyzer(file);
                        const result = copAnalyzer.analyze(code);
                        globalStore.updateFile(file, result);
                    } catch (err) {
                        console.error(`[Store] Error analyzing ${file}:`, err.message);
                    }
                }

                // Update UI
                const fileAnalysis = globalStore.getFileAnalysis(editor.document.fileName);
                if (fileAnalysis) {
                    treeProvider.setAnalysisResult(fileAnalysis, editor.document.fileName);
                    hoverProvider.setAnalysisResult(fileAnalysis);
                }

                // Log statistics
                const stats = globalStore.getStatistics();
                console.log(`[Store] Project initialized: ${stats.totalFiles} files, ${stats.totalLayers} layers, ${stats.totalRefinements} refinements`);
                
                vscode.window.setStatusBarMessage(
                    `✅ COP-lens: ${stats.totalFiles} files analyzed`,
                    3000
                );
            } catch (error) {
                console.error('[Store] Project initialization failed:', error);
                vscode.window.showErrorMessage(`Failed to initialize project: ${error.message}`);
            }
        }

        /**
         * Collect all JavaScript files in a directory
         */
        function collectJavaScriptFiles(dir) {
            const fs = require('fs');
            const path = require('path');
            const files = [];
            
            try {
                const entries = fs.readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isFile() && entry.endsWith('.js')) {
                        files.push(fullPath);
                    }
                }
            } catch (err) {
                console.error('[Store] Error collecting files:', err);
            }
            
            return files;
        }

        // Initialize project on activation
        initializeProjectAnalysis();

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
                const fileName = vscode.workspace.asRelativePath(editor.document.fileName);

                // Retrieve dependency graph from store (no re-analysis!)
                let dependencyGraph = globalStore.getDependencyGraph();
                
                if (!dependencyGraph || dependencyGraph.nodes.length === 0) {
                    console.log('[Graph] No dependency graph in store. Initializing project...');
                    vscode.window.showInformationMessage('Analyzing project...');
                    
                    // Initialize if not done yet
                    await initializeProjectAnalysis();
                    dependencyGraph = globalStore.getDependencyGraph();
                    
                    if (!dependencyGraph || dependencyGraph.nodes.length === 0) {
                        vscode.window.showInformationMessage('No classes found in the project.');
                        return;
                    }
                }
                
                console.log('[Graph] Retrieved from store:', dependencyGraph.summary);
                console.log('[Graph] Nodes:', dependencyGraph.nodes.length);
                console.log('[Graph] Edges:', dependencyGraph.edges.length);

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
                console.error('[Graph] Error showing dependency graph:', error);
                vscode.window.showErrorMessage(`Failed to show dependency graph: ${error.message}`);
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
