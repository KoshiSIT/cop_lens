/**
 * 複数クラスのメソッド検出テスト
 */

const { BabelObjectDependencyDetector } = require('./src/parser/babelObjectDependencyDetector');

console.log('🧪 複数クラスのメソッド検出テスト\n');

const code = `
class RemoteEditor {
    constructor() {
        this.editor = new EditorWidget();
    }
}

class EditorWidget {
    constructor() {
        this.render = new Render();
    }
    
    display() {
        console.log('displaying...');
    }
}

class Render {
    draw() {
        console.log('drawing...');
    }
}
`;

const detector = new BabelObjectDependencyDetector();
detector.setCurrentFile('test.js');
detector.detect(code);
const graph = detector.getDependencyGraph();

console.log('📊 グラフ情報:');
console.log(`  ノード数: ${graph.nodes.length}`);
console.log(`  クラス: ${graph.summary.classes}`);
console.log(`  メソッド: ${graph.summary.methods}`);

console.log('\n📦 クラス一覧:');
graph.nodes.filter(n => n.data.type === 'class').forEach(node => {
    console.log(`  - ${node.data.name}`);
});

console.log('\n📋 メソッド一覧:');
graph.nodes.filter(n => n.data.type === 'method').forEach(node => {
    console.log(`  - ${node.data.className}.${node.data.name}()`);
});

const methodsByClass = {};
graph.nodes.filter(n => n.data.type === 'method').forEach(node => {
    if (!methodsByClass[node.data.className]) {
        methodsByClass[node.data.className] = [];
    }
    methodsByClass[node.data.className].push(node.data.name);
});

console.log('\n📊 クラスごとのメソッド数:');
console.log(`  RemoteEditor: ${methodsByClass['RemoteEditor']?.length || 0}`);
console.log(`  EditorWidget: ${methodsByClass['EditorWidget']?.length || 0}`);
console.log(`  Render: ${methodsByClass['Render']?.length || 0}`);

if (methodsByClass['EditorWidget'] && methodsByClass['EditorWidget'].includes('display')) {
    console.log('\n✅ EditorWidget.display()が検出されました');
} else {
    console.log('\n❌ EditorWidget.display()が検出されていません');
}

if (methodsByClass['Render'] && methodsByClass['Render'].includes('draw')) {
    console.log('✅ Render.draw()が検出されました');
} else {
    console.log('❌ Render.draw()が検出されていません');
}
