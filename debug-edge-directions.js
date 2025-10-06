const { UnifiedProjectAnalyzer } = require('./src/analyzer/unifiedProjectAnalyzer');
const { GlobalCOPDataStore } = require('./src/analyzer/globalCOPDataStore');
const path = require('path');

async function analyzeRemoteEditor() {
    const projectPath = path.join(__dirname, 'examples/remote-editor');
    
    const store = new GlobalCOPDataStore();
    store.setProjectRoot(projectPath);
    
    const analyzer = new UnifiedProjectAnalyzer(projectPath);
    await analyzer.analyzeProject(store);
    
    const graph = store.getDependencyGraph();
    
    console.log('=== COP Edges ===');
    
    console.log('\nLayer → Refinement:');
    graph.edges.filter(e => e.data.type === 'has_refinement').forEach(edge => {
        console.log(`  ${edge.data.source} → ${edge.data.target}`);
    });
    
    console.log('\nMethod → Refinement:');
    graph.edges.filter(e => e.data.type === 'refined_by').forEach(edge => {
        console.log(`  ${edge.data.source} → ${edge.data.target}`);
    });
}

analyzeRemoteEditor().catch(console.error);
