const { COPAnalyzer } = require('./src/analyzer/copAnalyzer');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/remote-editor-ema.js');
console.log('Testing file:', filePath);
console.log('File exists:', fs.existsSync(filePath));
const code = fs.readFileSync(filePath, 'utf8');
const analyzer = new COPAnalyzer(filePath);
const result = analyzer.analyze(code);

console.log('=== Layer Detection ===');
const layers = result.getLayers();
layers.forEach(layer => {
    console.log(`\nLayer: ${layer.name}`);
    console.log(`  Condition: ${layer.details?.condition}`);
    console.log(`  Condition Type: ${layer.details?.conditionType}`);
    console.log(`  Line: ${layer.line}`);
});

console.log('\n=== Check if Signal is referenced in condition ===');
// Look for "networkStatus" or "networkConnected" in conditions
layers.forEach(layer => {
    const condition = layer.details?.condition;
    if (condition) {
        console.log(`\nLayer: ${layer.name}`);
        console.log(`  Condition: "${condition}"`);
        
        // Extract signal name from condition
        // Patterns: "signalName === value" or "signalName.value"
        const signalMatch = condition.match(/(\w+)\s*[=!<>]|(\w+)\.value/);
        if (signalMatch) {
            const signalName = signalMatch[1] || signalMatch[2];
            console.log(`  → Detected Signal reference: ${signalName}`);
        }
    }
});
