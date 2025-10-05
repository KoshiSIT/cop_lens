const { DependencyGraphProvider } = require('../../src/features/dependencyGraphProvider');
const { COPAnalyzer } = require('../../src/analyzer/copAnalyzer');

describe('DependencyGraphProvider', () => {
    let analysisResult;
    let provider;

    beforeEach(() => {
        const code = `
class Editor {
    constructor() {
        this.widget = new EditorWidget();
        this.server = new Server();
    }
    
    save() {
        this.widget.update();
    }
}

class EditorWidget {
    update() {}
}

class Server {
    send(data) {}
}
        `.trim();

        const analyzer = new COPAnalyzer('test.js');
        analysisResult = analyzer.analyze(code);
        provider = new DependencyGraphProvider(analysisResult);
    });

    describe('buildGraph', () => {
        test('依存グラフデータを構築できる', () => {
            const graph = provider.buildGraph();

            expect(graph).toBeDefined();
            expect(graph.nodes).toBeDefined();
            expect(graph.edges).toBeDefined();
            expect(graph.summary).toBeDefined();
        });

        test('ノードとエッジが含まれている', () => {
            const graph = provider.buildGraph();

            expect(graph.nodes.length).toBeGreaterThan(0);
            expect(graph.edges.length).toBeGreaterThan(0);
        });

        test('階層情報が含まれている', () => {
            const graph = provider.buildGraph();

            expect(graph.hierarchy).toBeDefined();
            // 階層情報はMapまたはObjectである
            expect(graph.hierarchy).toBeTruthy();
        });
    });

    describe('getSummary', () => {
        test('サマリー情報を取得できる', () => {
            const summary = provider.getSummary();

            expect(summary).toBeDefined();
            expect(summary.totalNodes).toBeDefined();
            expect(summary.totalEdges).toBeDefined();
        });

        test('サマリーに正しい値が含まれている', () => {
            const summary = provider.getSummary();

            expect(summary.totalNodes).toBeGreaterThan(0);
            expect(typeof summary.totalNodes).toBe('number');
        });
    });

    describe('getNodes', () => {
        test('ノード一覧を取得できる', () => {
            const nodes = provider.getNodes();

            expect(nodes).toBeDefined();
            expect(Array.isArray(nodes)).toBe(true);
        });

        test('各ノードに必要な情報が含まれている', () => {
            const nodes = provider.getNodes();

            if (nodes.length > 0) {
                const node = nodes[0];
                expect(node.data).toBeDefined();
                expect(node.data.id).toBeDefined();
            }
        });
    });

    describe('getEdges', () => {
        test('エッジ一覧を取得できる', () => {
            const edges = provider.getEdges();

            expect(edges).toBeDefined();
            expect(Array.isArray(edges)).toBe(true);
        });

        test('各エッジにsourceとtargetが含まれている', () => {
            const edges = provider.getEdges();

            if (edges.length > 0) {
                const edge = edges[0];
                expect(edge.data).toBeDefined();
                expect(edge.data.source).toBeDefined();
                expect(edge.data.target).toBeDefined();
            }
        });
    });

    describe('空の解析結果', () => {
        test('空のコードでもエラーにならない', () => {
            const emptyAnalyzer = new COPAnalyzer('empty.js');
            const emptyResult = emptyAnalyzer.analyze('');
            const emptyProvider = new DependencyGraphProvider(emptyResult);

            expect(() => {
                emptyProvider.buildGraph();
            }).not.toThrow();
        });

        test('空の結果でもグラフ構造を返す', () => {
            const emptyAnalyzer = new COPAnalyzer('empty.js');
            const emptyResult = emptyAnalyzer.analyze('');
            const emptyProvider = new DependencyGraphProvider(emptyResult);

            const graph = emptyProvider.buildGraph();

            expect(graph.nodes).toEqual([]);
            expect(graph.edges).toEqual([]);
        });
    });
});
