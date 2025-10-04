/**
 * Manual test to debug detection issues
 */

const { BabelObjectDependencyDetector: ObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');
const GraphRenderer = require('./src/graph/graphRenderer');
const fs = require('fs');

console.log('=== MANUAL DEBUG TEST ===');

// Test with the simple test file
const testFiles = [
    './test-simple.js',
    './examples/remote-editor-ema.js',
    './examples/online-editor.js'
];

testFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }
    
    console.log(`\n=== Testing ${filePath} ===`);
    
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        console.log(`📄 File size: ${code.length} characters`);
        console.log(`📄 First 200 chars: ${code.substring(0, 200).replace(/\n/g, '\\n')}`);
        
        const detector = new ObjectDependencyDetector();
        detector.setCurrentFile(filePath);
        
        // Call detect and get results
        const results = detector.detect(code);
        console.log(`🔍 Raw results: ${results.length} items`);
        
        const dependencyGraph = detector.getDependencyGraph();
        console.log(`📊 Summary:`, dependencyGraph.summary);
        
        if (dependencyGraph.nodes.length > 0) {
            console.log(`📊 Sample nodes:`);
            dependencyGraph.nodes.slice(0, 3).forEach(node => {
                console.log(`  - ${node.data.name} (${node.data.type}) at line ${node.data.line}`);
            });
        }
        
        if (dependencyGraph.edges.length > 0) {
            console.log(`📊 Sample edges:`);
            dependencyGraph.edges.slice(0, 3).forEach(edge => {
                console.log(`  - ${edge.data.source} → ${edge.data.target} (${edge.data.type})`);
            });
        }
        
        // Check internal state
        console.log(`🔍 Internal state:`);
        console.log(`  - Classes map size: ${detector.classes.size}`);
        console.log(`  - Instances map size: ${detector.instances.size}`);
        console.log(`  - Dependencies array length: ${detector.dependencies.length}`);
        
        if (detector.classes.size > 0) {
            console.log(`🔍 Detected classes:`);
            for (const [className, classInfo] of detector.classes) {
                console.log(`  - ${className} at line ${classInfo.line}`);
            }
        }
        
        // Test GraphRenderer
        console.log(`
🎨 Testing GraphRenderer...`);
        const renderer = new GraphRenderer();
        const cytoscapeConfig = renderer.render(dependencyGraph);
        
        console.log(`  Elements: ${cytoscapeConfig.elements.nodes.length} nodes, ${cytoscapeConfig.elements.edges.length} edges`);
        console.log(`  Layout type: ${cytoscapeConfig.layout.name}`);
        
        if (cytoscapeConfig.layout.name === 'preset') {
            console.log(`  ✅ Using preset (hierarchy) layout`);
            console.log(`  Positions for first 3 nodes:`);
            const nodes = cytoscapeConfig.elements.nodes.slice(0, 3);
            nodes.forEach(node => {
                const pos = cytoscapeConfig.layout.positions[node.data.id];
                console.log(`    ${node.data.id}: (${pos.x}, ${pos.y}) level=${node.data.hierarchyLevel}`);
            });
        } else {
            console.log(`  ⚠️ Using ${cytoscapeConfig.layout.name} layout (not hierarchy)`);
        }
        
    } catch (error) {
        console.error(`❌ Error testing ${filePath}:`, error.message);
        console.error(error.stack);
    }
});
