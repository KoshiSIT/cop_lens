const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/remote-editor-ema.js');
const code = fs.readFileSync(filePath, 'utf8');

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile(filePath);
const graph = detector.detect(code);

console.log('=== Dependency Graph ===');
console.log('Nodes:', graph.nodes.length);
console.log('Edges:', graph.edges.length);

console.log('\n=== Classes ===');
graph.nodes.filter(n => n.data.type === 'class').forEach(node => {
    console.log(`Class: ${node.data.name}`);
    console.log(`  Properties: ${node.data.properties}`);
    console.log(`  Methods: ${Object.keys(node.data.methodsMap || {}).length}`);
});

console.log('\n=== Instances ===');
graph.nodes.filter(n => n.data.type === 'instance').forEach(node => {
    console.log(`Instance: ${node.data.name}`);
    console.log(`  Class: ${node.data.className}`);
    console.log(`  Line: ${node.data.line}`);
});

console.log('\n=== Composition Edges ===');
graph.edges.filter(e => e.data.type === 'composition').forEach(edge => {
    console.log(`${edge.data.source}.${edge.data.property} -> ${edge.data.target}`);
});
