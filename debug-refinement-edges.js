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
    
    console.log('=== Method Nodes ===');
    graph.nodes.filter(n => n.data.type === 'method').forEach(node => {
        console.log(`Method ID: ${node.data.id}`);
        console.log(`  Name: ${node.data.name}`);
        console.log(`  Class: ${node.data.className}`);
    });
    
    console.log('\n=== Refinement Nodes ===');
    graph.nodes.filter(n => n.data.type === 'refinement').forEach(node => {
        console.log(`Refinement ID: ${node.data.id}`);
        console.log(`  Label: ${node.data.label}`);
    });
    
    console.log('\n=== Refines Edges ===');
    graph.edges.filter(e => e.data.type === 'refines').forEach(edge => {
        console.log(`Edge: ${edge.data.source} → ${edge.data.target}`);
        const sourceExists = graph.nodes.some(n => n.data.id === edge.data.source);
        const targetExists = graph.nodes.some(n => n.data.id === edge.data.target);
        console.log(`  Source exists: ${sourceExists}`);
        console.log(`  Target exists: ${targetExists}`);
    });
}

analyzeRemoteEditor().catch(console.error);
