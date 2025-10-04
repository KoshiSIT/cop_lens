/**
 * RemoteEditorの構造を検出
 */

const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');
const fs = require('fs');

console.log('🧪 RemoteEditor構造検出テスト\n');

const code = fs.readFileSync('examples/remote-editor/RemoteEditor.js', 'utf8');

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile('RemoteEditor.js');
detector.detect(code);
const graph = detector.getDependencyGraph();

console.log('📊 グラフ情報:');
console.log(`  ノード数: ${graph.nodes.length}`);
console.log(`  クラス: ${graph.summary.classes}`);
console.log(`  インスタンス: ${graph.summary.instances}`);
console.log(`  メソッド: ${graph.summary.methods}`);

console.log('\n📦 クラスノード:');
graph.nodes.filter(n => n.data.type === 'class').forEach(node => {
    console.log(`  - ${node.data.name}`);
});

console.log('\n📦 インスタンスノード:');
graph.nodes.filter(n => n.data.type === 'instance').forEach(node => {
    console.log(`  - ${node.data.name} (${node.data.className})`);
});

console.log('\n📦 メソッドノード:');
graph.nodes.filter(n => n.data.type === 'method').forEach(node => {
    console.log(`  - ${node.data.className}.${node.data.name}()`);
});

console.log('\n📦 外部クラス:');
graph.nodes.filter(n => n.data.type === 'external').forEach(node => {
    console.log(`  - ${node.data.name}`);
});

console.log('\n✅ 画像との比較:');
const expectedInstances = ['editor', 'server'];
const expectedMethods = ['workRemote', 'goOnline', 'goOffline'];

expectedInstances.forEach(name => {
    const exists = graph.nodes.some(n => n.data.name === name && n.data.type === 'instance');
    console.log(`  ${exists ? '✅' : '❌'} インスタンス: ${name}`);
});

expectedMethods.forEach(name => {
    const exists = graph.nodes.some(n => n.data.name === name && n.data.type === 'method');
    console.log(`  ${exists ? '✅' : '❌'} メソッド: ${name}`);
});
