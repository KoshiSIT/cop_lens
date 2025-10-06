const { GlobalCOPDataStore } = require('./src/analyzer/globalCOPDataStore');
const { UnifiedProjectAnalyzer } = require('./src/analyzer/unifiedProjectAnalyzer');
const path = require('path');

async function testProjectAnalysis(projectPath, projectName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${projectName}`);
    console.log(`Path: ${projectPath}`);
    console.log('='.repeat(60));
    
    const store = new GlobalCOPDataStore();
    store.setProjectRoot(projectPath);
    
    const analyzer = new UnifiedProjectAnalyzer(projectPath);
    await analyzer.analyzeProject(store);
    
    const graph = store.getDependencyGraph();
    
    console.log(`\nResults:`);
    console.log(`  Files analyzed: ${store.fileAnalysisResults.size}`);
    console.log(`  Nodes: ${graph?.nodes?.length || 0}`);
    console.log(`  Edges: ${graph?.edges?.length || 0}`);
    
    if (graph && graph.nodes) {
        const nodeTypes = {};
        graph.nodes.forEach(node => {
            const type = node.data?.type || 'unknown';
            nodeTypes[type] = (nodeTypes[type] || 0) + 1;
        });
        
        console.log(`\nNode types:`);
        Object.entries(nodeTypes).sort().forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
        });
    }
    
    // List analyzed files
    console.log(`\nAnalyzed files:`);
    for (const [filePath, result] of store.fileAnalysisResults) {
        const relativePath = path.relative(projectPath, filePath);
        const layers = result?.getLayers?.()?.length || 0;
        const refinements = result?.getRefinements?.()?.length || 0;
        console.log(`  - ${relativePath} (Layers: ${layers}, Refinements: ${refinements})`);
    }
    
    return { store, graph };
}

(async () => {
    const examplesDir = path.join(__dirname, 'examples');
    
    // Test 1: structured-cop
    const structuredCopPath = path.join(examplesDir, 'structured-cop');
    const result1 = await testProjectAnalysis(structuredCopPath, 'structured-cop');
    
    // Test 2: remote-editor-web (only analyze public/js)
    const remoteEditorPath = path.join(examplesDir, 'remote-editor-web', 'public', 'js');
    const result2 = await testProjectAnalysis(remoteEditorPath, 'remote-editor-web/public/js');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('Comparison');
    console.log('='.repeat(60));
    console.log(`structured-cop nodes: ${result1.graph?.nodes?.length || 0}`);
    console.log(`remote-editor-web nodes: ${result2.graph?.nodes?.length || 0}`);
})();
