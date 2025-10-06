const { COPAnalyzer } = require('./src/analyzer/copAnalyzer');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/remote-editor-ema.js');
const code = fs.readFileSync(filePath, 'utf8');
const analyzer = new COPAnalyzer(filePath);
const result = analyzer.analyze(code);

console.log('=== COP Analysis ===');
console.log('Layers:', result.getLayers().length);
console.log('Refinements:', result.getRefinements().length);

console.log('\n=== Layers ===');
result.getLayers().forEach(layer => {
    console.log(`Layer: ${layer.name}`);
    console.log(`  Type: ${layer.type}`);
    console.log(`  Condition: ${layer.details?.condition}`);
    console.log(`  Line: ${layer.line}`);
});

console.log('\n=== Refinements ===');
result.getRefinements().forEach(ref => {
    const original = ref._original;
    console.log(`Refinement: ${original.type}`);
    console.log(`  Layer: ${original.layerObject}`);
    console.log(`  Target: ${original.targetObject}.${original.methodName || ''}`);
    console.log(`  Line: ${ref.line}`);
});

console.log('\n=== Dependency Graph ===');
const graph = result.dependencies;
console.log('Nodes:', graph.nodes.length);
console.log('Edges:', graph.edges.length);

console.log('\n=== All Node Types ===');
const nodeTypes = {};
graph.nodes.forEach(n => {
    nodeTypes[n.data.type] = (nodeTypes[n.data.type] || 0) + 1;
});
Object.entries(nodeTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
});
