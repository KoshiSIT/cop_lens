const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');
const { COPAnalyzer } = require('./src/analyzer/copAnalyzer');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/remote-editor/RemoteEditor.js');
const code = fs.readFileSync(filePath, 'utf8');

console.log('=== COP Analysis ===');
const analyzer = new COPAnalyzer(filePath);
const result = analyzer.analyze(code);

console.log('Layers:', result.getLayers().length);
result.getLayers().forEach(layer => {
    console.log(`  - ${layer.name} (${layer.type})`);
});

console.log('\n=== Dependency Graph ===');
const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile(filePath);
const graph = detector.detect(code);

console.log('Nodes:', graph.nodes.length);
console.log('Classes:');
graph.nodes.filter(n => n.data.type === 'class').forEach(node => {
    console.log(`  - ${node.data.name}`);
    console.log(`    Properties: ${node.data.properties}`);
});

console.log('\nInstances:');
graph.nodes.filter(n => n.data.type === 'instance').forEach(node => {
    console.log(`  - ${node.data.name}: ${node.data.className}`);
});
