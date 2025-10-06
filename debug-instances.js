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
    
    console.log('=== All Instance Nodes ===');
    graph.nodes.filter(n => n.data.type === 'instance').forEach(node => {
        console.log(`Instance: ${node.data.name}`);
        console.log(`  ID: ${node.data.id}`);
        console.log(`  Class: ${node.data.className}`);
    });
    
    console.log('\n=== Composition Edges to Instances ===');
    graph.edges.filter(e => e.data.type === 'composition').forEach(edge => {
        console.log(`${edge.data.source} → ${edge.data.target}`);
    });
}

analyzeRemoteEditor().catch(console.error);
