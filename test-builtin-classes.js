/**
 * 組み込みクラス検出のテスト
 */

const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');

console.log('🧪 組み込みクラス検出テスト\n');

const code = `
class Save {
    constructor() {
        this.lastSaveTime = new Date();
    }
}

class RemoteEditor {
    constructor() {
        this.networkStatus = new Signal();
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

console.log('\n📦 ノード一覧:');
graph.nodes.forEach(node => {
    const builtIn = node.data.builtIn ? ' [Built-in]' : '';
    console.log(`  - ${node.data.name} (${node.data.type})${builtIn}`);
});

console.log('\n🔗 エッジ一覧:');
graph.edges.forEach(edge => {
    console.log(`  - ${edge.data.source} → ${edge.data.target} [${edge.data.type}]`);
});

// エラーチェック：すべてのエッジのターゲットがノードとして存在するか
const nodeIds = new Set(graph.nodes.map(n => n.data.id));
const missingTargets = graph.edges.filter(e => !nodeIds.has(e.data.target));

if (missingTargets.length === 0) {
    console.log('\n✅ すべてのエッジのターゲットが存在します');
} else {
    console.log('\n❌ 存在しないターゲット:');
    missingTargets.forEach(e => {
        console.log(`  - ${e.data.source} → ${e.data.target}`);
    });
}
