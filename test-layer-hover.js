const { COPAnalyzer } = require('./src/analyzer/copAnalyzer');
const { HoverProvider } = require('./src/features/hoverProvider');
const { GlobalCOPDataStore } = require('./src/analyzer/globalCOPDataStore');
const fs = require('fs');

// GlobalStoreを作成
const globalStore = new GlobalCOPDataStore();

// EditorWidget.jsを解析してストアに追加
const editorWidgetCode = fs.readFileSync('examples/remote-editor/EditorWidget.js', 'utf8');
const editorWidgetAnalyzer = new COPAnalyzer('examples/remote-editor/EditorWidget.js');
const editorWidgetResult = editorWidgetAnalyzer.analyze(editorWidgetCode);
globalStore.updateFile('examples/remote-editor/EditorWidget.js', editorWidgetResult);

// 依存グラフをセット
globalStore.setDependencyGraph(editorWidgetResult.dependencies);

// layers.jsを解析
const layersCode = fs.readFileSync('examples/remote-editor/layers.js', 'utf8');
const layersAnalyzer = new COPAnalyzer('examples/remote-editor/layers.js');
const layersResult = layersAnalyzer.analyze(layersCode);

// HoverProviderを作成（globalStore付き）
const hoverProvider = new HoverProvider(layersResult, globalStore);

// LayerOnlineEditor行でHoverをテスト（line 10）
const hoverInfo = hoverProvider.provideHover({ line: 9, character: 0 });

console.log('=== Layer Hover Content (with Refinements links) ===');
console.log(hoverInfo ? hoverInfo.contents : 'No hover');
console.log('\n');
console.log('=== Expected output ===');
console.log('Should show:');
console.log('• `EditorWidget` [↗] → `save()` [↗] → Refinement [↗]');
console.log('');
console.log('Where:');
console.log('  - First [↗] jumps to EditorWidget class definition');
console.log('  - Second [↗] jumps to save() method definition');
console.log('  - Third [↗] jumps to Refinement line');
