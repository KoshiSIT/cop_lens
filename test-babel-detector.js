const { BabelLayerDetector } = require('./src/parser/babelLayerDetector');
const fs = require('fs');

console.log('=== Testing Babel Layer Detector ===\n');

// Test on layers.js
const code = fs.readFileSync('examples/remote-editor/layers.js', 'utf8');
const detector = new BabelLayerDetector();
detector.setCurrentFile('examples/remote-editor/layers.js');

const results = detector.detect(code);

console.log('Results:', results.length, 'layers found\n');

results.forEach((layer, i) => {
    console.log(`Layer ${i + 1}:`);
    console.log('  Name:', layer.name);
    console.log('  Layer Name:', layer.layerName || 'N/A');
    console.log('  Condition:', layer.condition);
    console.log('  Type:', layer.conditionType);
    console.log('  Constructor Style:', layer.constructorStyle);
    console.log('  Line:', layer.line);
    console.log('');
});
