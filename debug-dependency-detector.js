const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/structured-cop/onlineEditorLayer.js');
const code = fs.readFileSync(filePath, 'utf8');

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile(filePath);

const graph = detector.detect(code);

console.log('=== Dependency Detector Result ===');
console.log('Nodes:', graph.nodes.length);
console.log('Edges:', graph.edges.length);

console.log('\n=== Nodes ===');
graph.nodes.forEach((node, i) => {
    console.log(`${i}. ${node.data.label} (${node.data.type})`);
});

console.log('\n=== Edges ===');
graph.edges.forEach((edge, i) => {
    console.log(`${i}. ${edge.source} -> ${edge.target} (${edge.data.type})`);
});
