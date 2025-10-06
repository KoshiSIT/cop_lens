const { BabelLayerDetector } = require('./src/parser/babelLayerDetector');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'examples/remote-editor-ema.js');
const code = fs.readFileSync(filePath, 'utf8');

const detector = new BabelLayerDetector();
detector.setCurrentFile(filePath);
const layers = detector.detect(code);

console.log('Detected layers:', layers.length);
layers.forEach((layer, i) => {
    console.log(`\n${i + 1}. ${layer.name}`);
    console.log(`   Condition: ${layer.condition}`);
    console.log(`   Type: ${layer.conditionType}`);
    console.log(`   Constructor: ${layer.constructorStyle}`);
});
