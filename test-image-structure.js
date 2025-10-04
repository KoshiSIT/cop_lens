/**
 * 画像と同じ構造をテスト
 */

const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');

console.log('🧪 画像と同じ構造のテスト\n');

const code = `
class RemoteEditor {
    constructor() {
        this.editor = new EditorWidget();
        this.server = new Signal();
    }
}

class EditorWidget {
    constructor() {
        this.render = new Render();
    }
}
`;

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile('test.js');
detector.detect(code);
const graph = detector.getDependencyGraph();

console.log('📦 全ノード:');
graph.nodes.forEach(node => {
    console.log(`  - ${node.data.id} (${node.data.type})`);
});

console.log('\n🔗 全エッジ:');
graph.edges.forEach(edge => {
    console.log(`  - ${edge.data.source} → ${edge.data.target} [${edge.data.type}]`);
});

// 期待されるノード
const expectedNodes = [
    'RemoteEditor',
    'EditorWidget', 
    'RemoteEditor_editor',  // editor instance
    'RemoteEditor_server',  // server instance
    'EditorWidget_render',  // render instance
    'Signal',
    'Render'
];

console.log('\n✅ 期待されるノード:');
expectedNodes.forEach(name => {
    const exists = graph.nodes.some(n => n.data.id === name);
    console.log(`  ${exists ? '✅' : '❌'} ${name}`);
});
