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
    
    console.log('=== Dependency Graph ===');
    console.log('Total nodes:', graph.nodes.length);
    console.log('Total edges:', graph.edges.length);
    
    console.log('\n=== Node Types ===');
    const nodeTypes = {};
    graph.nodes.forEach(n => {
        const type = n.data.type;
        nodeTypes[type] = (nodeTypes[type] || 0) + 1;
    });
    Object.entries(nodeTypes).sort().forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n=== Layer Nodes ===');
    graph.nodes.filter(n => n.data.type === 'layer').forEach(node => {
        console.log(`Layer: ${node.data.label}`);
        console.log(`  ID: ${node.data.id}`);
        console.log(`  Line: ${node.data.line}`);
    });
    
    console.log('\n=== Edge Types ===');
    const edgeTypes = {};
    graph.edges.forEach(e => {
        const type = e.data.type;
        edgeTypes[type] = (edgeTypes[type] || 0) + 1;
    });
    Object.entries(edgeTypes).sort().forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
}

analyzeRemoteEditor().catch(console.error);
