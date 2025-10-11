// The module 'vscode' contains the VS Code extensibility API
const vscode = require("vscode");

// Unified architecture
const { COPAnalyzer } = require("./src/analyzer/copAnalyzer");
const { GlobalCOPDataStore } = require("./src/analyzer/globalCOPDataStore");
const { UnifiedProjectAnalyzer } = require("./src/analyzer/unifiedProjectAnalyzer");
const { BabelObjectDependencyDetector } = require("./src/parser/babelObjectDependencyDetector");

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
async function activate(context) {
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
        async function updateGlobalStore() {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== "javascript") {
                return;
            }

            console.log("Updating global store...");
            const projectRoot = determineProjectRoot(editor.document);
            
            // Initialize or check if project has changed
            if (globalStore.projectRoot === null) {
                console.log(`[Store] Initializing project root: ${projectRoot}`);
                globalStore.setProjectRoot(projectRoot);
                
                // First time: analyze entire project
                console.log(`[Store] First file opened, analyzing entire project...`);
                await initializeProjectAnalysis();
                
            } else if (globalStore.hasProjectChanged(projectRoot)) {
                console.log(`[Store] Project changed from ${globalStore.projectRoot} to ${projectRoot}, clearing store`);
                globalStore.clear();
                globalStore.setProjectRoot(projectRoot);
                
                // Project changed: analyze new project
                console.log(`[Store] Project changed, analyzing new project...`);
                await initializeProjectAnalysis();
            } else {
                // Same project: just update this file
                const code = editor.document.getText();
                const filePath = editor.document.fileName;
                
                // Analyze current file and update global store
                const analyzer = new COPAnalyzer(filePath);
                const analysisResult = analyzer.analyze(code);
                
                globalStore.updateFile(filePath, analysisResult);
                
                const layersCount = analysisResult.getLayers ? analysisResult.getLayers().length : 0;
                const refinementsCount = analysisResult.getRefinements ? analysisResult.getRefinements().length : 0;
                console.log(`[Store] Updated ${filePath}: ${layersCount} layers, ${refinementsCount} refinements`);
            }
            
            // Update UI components (they read from globalStore)
            const filePath = editor.document.fileName;
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
            
            // Check if project has changed
            if (globalStore.hasProjectChanged(projectRoot)) {
                console.log(`[Store] Project changed from ${globalStore.projectRoot} to ${projectRoot}`);
                globalStore.clear();
            }
            
            globalStore.setProjectRoot(projectRoot);

            try {
                // Use unified analyzer for complete project analysis
                const analyzer = new UnifiedProjectAnalyzer(projectRoot);
                const { fileResults, dependencyGraph } = await analyzer.analyzeProject();
                
                // Save all results to store
                for (const [filePath, result] of fileResults) {
                    globalStore.updateFile(filePath, result);
                }
                
                globalStore.setDependencyGraph(dependencyGraph);
                
                console.log(`[Store] Dependency graph saved: ${dependencyGraph.nodes.length} nodes, ${dependencyGraph.edges.length} edges`);

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
                vscode.window.showWarningMessage(
                    `COP-lens: Project analysis incomplete. Some features may be limited.`
                );
                
                // フォールバック: 少なくとも現在のファイルは解析
                try {
                    updateGlobalStore();
                } catch (fallbackError) {
                    console.error('[Store] Fallback analysis also failed:', fallbackError);
                }
            }
        }



        // Initialize project on activation
        await initializeProjectAnalysis();

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
                const projectRoot = determineProjectRoot(editor.document);

                // Always use project-wide dependency graph
                let dependencyGraph = globalStore.getDependencyGraph();
                
                if (!dependencyGraph || dependencyGraph.nodes.length === 0) {
                    console.log('[Graph] No dependency graph in store. First analysis may be in progress...');
                    vscode.window.showInformationMessage('Please wait for project analysis to complete, or manually trigger "Initialize Project Analysis".');
                    return;
                }
                
                console.log('[Graph] Using project-wide dependency graph');
                console.log('[Graph] Nodes:', dependencyGraph.nodes.length);
                console.log('[Graph] Edges:', dependencyGraph.edges.length);

                // Build graph with hierarchy using DependencyGraphProvider
                const { DependencyGraphProvider } = require('./src/features/dependencyGraphProvider');
                const graphProvider = new DependencyGraphProvider(null, globalStore);
                const graphWithHierarchy = graphProvider.buildGraph();

                console.log('[Graph] Hierarchy calculated:', graphWithHierarchy.hierarchy.size, 'nodes');
                
                // Enhance refinement nodes with target method code from GlobalStore
                if (graphWithHierarchy.nodes) {
                    for (const node of graphWithHierarchy.nodes) {
                        if (node.data.type === 'refinement' && !node.data.targetMethodCode) {
                            const targetObject = node.data.targetObject;
                            const methodName = node.data.methodName;
                            
                            if (targetObject && methodName) {
                                // Find target class in global graph
                                const targetClassNode = dependencyGraph.nodes?.find(n => 
                                    n.data.type === 'class' && 
                                    n.data.name === targetObject
                                );
                                
                                if (targetClassNode && targetClassNode.data.methodsMap) {
                                    const method = targetClassNode.data.methodsMap[methodName];
                                    if (method) {
                                        node.data.targetMethodCode = method.code;
                                        node.data.targetMethodLine = method.line;
                                        node.data.targetMethodFile = method.file;
                                        console.log(`[Graph] Enhanced refinement node with target method code: ${targetObject}.${methodName}`);
                                    }
                                }
                            }
                        }
                    }
                }

                // Show in WebView
                dependencyGraphView.show(
                    graphWithHierarchy,
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
