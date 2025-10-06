const { COPAnalyzer } = require('./src/analyzer/copAnalyzer');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/structured-cop/onlineEditorLayer.js');
const code = fs.readFileSync(filePath, 'utf8');
const analyzer = new COPAnalyzer(filePath);
const result = analyzer.analyze(code);

console.log('=== onlineEditorLayer.js Analysis ===\n');
console.log('Layers:', result.getLayers().length);
console.log('Refinements:', result.getRefinements().length);
console.log('Entities:', result.entities.length);

console.log('\n=== All Entities ===');
result.entities.forEach((e, i) => {
    console.log(`${i}. ${e.name} (${e.type}) - line ${e.line}`);
});

console.log('\n=== Dependency Graph ===');
const graph = result.dependencies;
console.log('Nodes:', graph.nodes.length);
console.log('Edges:', graph.edges.length);

console.log('\nNode types:');
const nodeTypes = {};
graph.nodes.forEach(node => {
    const type = node.data?.type || 'unknown';
    nodeTypes[type] = (nodeTypes[type] || 0) + 1;
});
Object.entries(nodeTypes).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
});
