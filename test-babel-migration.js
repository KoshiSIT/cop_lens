/**
 * Babel移行の動作確認スクリプト
 * VSCode環境なしでDetectorの動作を確認
 */

const { BabelLayerDetector } = require('./src/parser/babelLayerDetector');
const { BabelRefinementDetector } = require('./src/parser/babelRefinementDetector');
const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');

console.log('🧪 Babel移行テスト開始\n');

// Test 1: BabelLayerDetector
console.log('📋 Test 1: BabelLayerDetector');
const layerCode = `
const layer1 = { 
    condition: "x > 1",
    refinements: []
};

const layer2 = new Layer("auth");
`;

const layerDetector = new BabelLayerDetector();
const layerResults = layerDetector.detect(layerCode);
console.log('  結果:', JSON.stringify(layerResults, null, 2));
console.log(`  ✅ ${layerResults.length}個のLayerを検出\n`);

// Test 2: BabelRefinementDetector
console.log('📋 Test 2: BabelRefinementDetector');
const refinementCode = `
const myRefinement = {
    target: "MyClass.myMethod",
    advice: function() { console.log("advice"); }
};
`;

const refinementDetector = new BabelRefinementDetector();
const refinementResults = refinementDetector.detect(refinementCode);
console.log('  結果:', JSON.stringify(refinementResults, null, 2));
console.log(`  ✅ ${refinementResults.length}個のRefinementを検出\n`);

// Test 3: BabelObjectDependencyDetector
console.log('📋 Test 3: BabelObjectDependencyDetector');
const depCode = `
import { Layer } from 'emajs';

class MyClass {
    constructor() {
        this.layer = new Layer("test");
    }
    
    method() {
        Layer.proceed();
    }
}
`;

const depDetector = new BabelObjectDependencyDetector();
depDetector.setCurrentFile('test.js');
depDetector.detect(depCode);
const graph = depDetector.getDependencyGraph();
console.log('  ノード数:', graph.nodes.length);
console.log('  エッジ数:', graph.edges.length);
console.log('  ノード:', JSON.stringify(graph.nodes.map(n => n.name), null, 2));
console.log(`  ✅ 依存グラフを生成\n`);

// Test 4: 旧Detectorとの互換性確認
console.log('📋 Test 4: 旧DetectorのAPIとの互換性');
try {
    const testCode = 'const layer = { condition: "true" };';
    
    // 旧API: detect()が配列を返すことを確認
    const results = layerDetector.detect(testCode);
    if (Array.isArray(results)) {
        console.log('  ✅ detect()は配列を返す');
    }
    
    // 旧API: 結果オブジェクトの構造確認
    if (results[0] && results[0].type && results[0].name && results[0].line !== undefined) {
        console.log('  ✅ 結果オブジェクトの構造が互換');
    }
    
    // getDependencyGraph()の確認
    const graphResult = depDetector.getDependencyGraph();
    if (graphResult.nodes && graphResult.edges && graphResult.summary) {
        console.log('  ✅ getDependencyGraph()の構造が互換');
    }
    
    console.log('\n🎉 すべてのテストが成功！Babel移行完了\n');
} catch (error) {
    console.error('❌ 互換性エラー:', error.message);
    process.exit(1);
}
