/**
 * メソッドノード検出のテスト
 */

const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');

console.log('🧪 メソッドノード検出テスト\n');

const code = `
class RemoteEditor {
    constructor(editor, server) {
        this.editor = new EditorWidget();
        this.server = new Signal();
    }
    
    connect() {
        console.log('connecting...');
    }
    
    disconnect() {
        console.log('disconnecting...');
    }
}
`;

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile('test.js');
detector.detect(code);
const graph = detector.getDependencyGraph();

console.log('📊 グラフ情報:');
console.log(`  ノード数: ${graph.nodes.length}`);
console.log(`  エッジ数: ${graph.edges.length}`);
console.log(`  クラス: ${graph.summary.classes}`);
console.log(`  インスタンス: ${graph.summary.instances}`);
console.log(`  メソッド: ${graph.summary.methods}`);

console.log('\n📦 ノード一覧:');
graph.nodes.forEach(node => {
    const extra = node.data.type === 'external' ? ' [External]' : '';
    const params = node.data.params ? ` (${node.data.params.join(', ')})` : '';
    console.log(`  - ${node.data.name} (${node.data.type})${params}${extra}`);
});

console.log('\n🔗 エッジ一覧:');
graph.edges.forEach(edge => {
    console.log(`  - ${edge.data.source} → ${edge.data.target} [${edge.data.type}]`);
});

// メソッドノードが正しく検出されているか確認
const methodNodes = graph.nodes.filter(n => n.data.type === 'method');
const hasMethodEdges = graph.edges.filter(e => e.data.type === 'hasMethod');

console.log(`\n✅ メソッドノード: ${methodNodes.length}個`);
console.log(`✅ hasMethodエッジ: ${hasMethodEdges.length}個`);

if (methodNodes.length === 2 && hasMethodEdges.length === 2) {
    console.log('\n🎉 メソッド検出が正常に動作しています！');
} else {
    console.log('\n❌ メソッド検出に問題があります');
}
