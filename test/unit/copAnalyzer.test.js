const { COPAnalyzer } = require('../../src/analyzer/copAnalyzer');

describe('COPAnalyzer', () => {
    describe('基本的な解析', () => {
        test('Layer、Refinement、Dependencyをすべて検出できる', () => {
            const code = `
const layerOnline = { 
    condition: "isOnline === true",
    enter: function() {},
    exit: function() {}
};

class Editor {
    constructor() {
        this.content = "";
        this.battery = { charge: 80 };
    }
    
    save() {
        console.log("save");
    }
}

// Refinement (EMA.exhibit)
const editor = new Editor();
EMA.exhibit(editor, {level: editor.battery.charge});
            `.trim();

            const analyzer = new COPAnalyzer('test.js');
            const result = analyzer.analyze(code);

            // Layer検出
            expect(result.layers).toBeDefined();
            expect(result.layers.length).toBe(1);
            expect(result.layers[0].name).toBe('layerOnline');

            // Refinement検出
            expect(result.refinements).toBeDefined();
            expect(result.refinements.length).toBeGreaterThan(0);

            // Dependency検出
            expect(result.dependencies).toBeDefined();
            expect(result.dependencies.nodes).toBeDefined();
            expect(result.dependencies.edges).toBeDefined();
        });

        test('空のコードでもエラーにならない', () => {
            const analyzer = new COPAnalyzer('test.js');
            const result = analyzer.analyze('');

            expect(result.layers).toEqual([]);
            expect(result.refinements).toEqual([]);
            expect(result.dependencies.nodes).toEqual([]);
        });

        test('filePathを保持する', () => {
            const analyzer = new COPAnalyzer('/path/to/test.js');
            const result = analyzer.analyze('const x = 1;');

            expect(result.filePath).toBe('/path/to/test.js');
        });
    });

    describe('symbolIndexの構築', () => {
        test('Layer定義の位置情報を含む', () => {
            const code = `const layerOnline = { condition: "test" };`;
            const analyzer = new COPAnalyzer('test.js');
            const result = analyzer.analyze(code);

            expect(result.symbolIndex).toBeDefined();
            expect(result.symbolIndex.length).toBeGreaterThan(0);
            
            const layerSymbol = result.symbolIndex.find(s => s.name === 'layerOnline');
            expect(layerSymbol).toBeDefined();
            expect(layerSymbol.type).toBe('layer');
            expect(layerSymbol.line).toBeGreaterThan(0);
        });

        test('Refinementの位置情報を含む', () => {
            const code = `
const layer = { condition: "test" };

class MyClass {
    method() {
        this.data = 100;
    }
}

const obj = new MyClass();
EMA.exhibit(obj, {value: obj.data});
            `.trim();
            
            const analyzer = new COPAnalyzer('test.js');
            const result = analyzer.analyze(code);

            const refinementSymbol = result.symbolIndex.find(s => s.type === 'refinement');
            expect(refinementSymbol).toBeDefined();
        });

        test('行番号でソートされている', () => {
            const code = `
const layer1 = { condition: "layer1" };  // line 1
const layer2 = { condition: "layer2" };  // line 2
const layer3 = { condition: "layer3" };  // line 3
            `.trim();
            
            const analyzer = new COPAnalyzer('test.js');
            const result = analyzer.analyze(code);

            for (let i = 1; i < result.symbolIndex.length; i++) {
                expect(result.symbolIndex[i].line).toBeGreaterThanOrEqual(
                    result.symbolIndex[i - 1].line
                );
            }
        });
    });

    describe('エラーハンドリング', () => {
        test('構文エラーのあるコードでも例外を投げない', () => {
            const code = `const x = ;`; // 構文エラー
            const analyzer = new COPAnalyzer('test.js');

            expect(() => {
                analyzer.analyze(code);
            }).not.toThrow();
        });

        test('nullやundefinedを渡してもエラーにならない', () => {
            const analyzer = new COPAnalyzer('test.js');

            expect(() => analyzer.analyze(null)).not.toThrow();
            expect(() => analyzer.analyze(undefined)).not.toThrow();
        });
    });

    describe('複数回の解析', () => {
        test('同じAnalyzerインスタンスで複数回解析できる', () => {
            const analyzer = new COPAnalyzer('test.js');
            
            const result1 = analyzer.analyze('const layer1 = { condition: "layer1" };');
            expect(result1.layers.length).toBe(1);

            const result2 = analyzer.analyze('const layer2 = { condition: "layer2" };');
            expect(result2.layers.length).toBe(1);
            expect(result2.layers[0].name).toBe('layer2');
        });
    });
});
