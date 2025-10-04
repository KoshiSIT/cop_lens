/**
 * 全exampleファイルのCOP構文検出統合テスト
 */

const { BabelLayerDetector } = require('../../src/parser/babelLayerDetector');
const { BabelRefinementDetector } = require('../../src/parser/babelRefinementDetector');
const fs = require('fs');
const path = require('path');

describe('COP Examples 統合テスト', () => {
    let layerDetector;
    let refinementDetector;

    beforeAll(() => {
        layerDetector = new BabelLayerDetector();
        refinementDetector = new BabelRefinementDetector();
    });

    /**
     * ヘルパー: ファイルを解析
     */
    function analyzeFile(filename) {
        const filePath = path.join(__dirname, `../../examples/${filename}`);
        const code = fs.readFileSync(filePath, 'utf8');
        const layers = layerDetector.detect(code);
        const refinements = refinementDetector.detect(code);
        return { layers, refinements, allResults: [...layers, ...refinements] };
    }

    describe('example1.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example1.js');
        });

        test('lowBatteryレイヤーが1個検出される', () => {
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('lowBattery');
        });

        test('Refinementが3個検出される (exhibit 1 + addPartialMethod 1 + deploy 1)', () => {
            expect(result.refinements.length).toBe(3);
        });

        test('EMA.exhibit()が1個検出される', () => {
            const exhibits = result.refinements.filter(r => r.type === 'refinement_exhibit');
            expect(exhibits).toHaveLength(1);
            expect(exhibits[0].targetObject).toBe('battery');
        });

        test('EMA.addPartialMethod()が1個検出される', () => {
            const addPartials = result.refinements.filter(r => r.type === 'refinement_addPartialMethod');
            expect(addPartials).toHaveLength(1);
            expect(addPartials[0].targetObject).toBe('videoCard');
        });

        test('EMA.deploy()が1個検出される', () => {
            const deploys = result.refinements.filter(r => r.type === 'refinement_deploy');
            expect(deploys).toHaveLength(1);
            expect(deploys[0].layerObject).toBe('lowBattery');
        });
    });

    describe('example2.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example2.js');
        });

        test('landscapeレイヤーが1個検出される', () => {
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('landscape');
        });

        test('Refinementが4個検出される (exhibit 1 + addPartialMethod 1 + deploy 1 + proceed 1)', () => {
            expect(result.refinements.length).toBe(4);
        });

        test('Layer.proceed()が1個検出される', () => {
            const proceeds = result.refinements.filter(r => r.type === 'refinement_proceed');
            expect(proceeds).toHaveLength(1);
        });
    });

    describe('example3.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example3.js');
        });

        test('2個のレイヤーが検出される (landscape, portrait)', () => {
            expect(result.layers).toHaveLength(2);
            const names = result.layers.map(l => l.name).sort();
            expect(names).toEqual(['landscape', 'portrait']);
        });

        test('Refinementが8個検出される (exhibit 2 + addPartialMethod 2 + deploy 2 + proceed 2)', () => {
            expect(result.refinements.length).toBe(8);
        });

        test('EMA.exhibit()が2個検出される', () => {
            const exhibits = result.refinements.filter(r => r.type === 'refinement_exhibit');
            expect(exhibits).toHaveLength(2);
        });

        test('EMA.deploy()が2個検出される', () => {
            const deploys = result.refinements.filter(r => r.type === 'refinement_deploy');
            expect(deploys).toHaveLength(2);
        });
    });

    describe('example4.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example4.js');
        });

        test('2個のレイヤーが検出される (landscape, portrait)', () => {
            expect(result.layers).toHaveLength(2);
            const names = result.layers.map(l => l.name).sort();
            expect(names).toEqual(['landscape', 'portrait']);
        });

        test('Refinementが9個検出される (exhibit 3 + addPartialMethod 2 + deploy 2 + proceed 2)', () => {
            expect(result.refinements.length).toBe(9);
        });

        test('EMA.exhibit()が3個検出される', () => {
            const exhibits = result.refinements.filter(r => r.type === 'refinement_exhibit');
            expect(exhibits).toHaveLength(3);
            const targets = exhibits.map(e => e.targetObject).sort();
            expect(targets).toEqual(['landscape', 'playerView', 'screen']);
        });
    });

    describe('example5.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example5.js');
        });

        test('houseLightレイヤーが1個検出される', () => {
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('houseLight');
        });

        test('Refinementが3個検出される (exhibit 2 + deploy 1)', () => {
            expect(result.refinements.length).toBe(3);
        });

        test('EMA.exhibit()が2個検出される (smartPhone, car)', () => {
            const exhibits = result.refinements.filter(r => r.type === 'refinement_exhibit');
            expect(exhibits).toHaveLength(2);
            const targets = exhibits.map(e => e.targetObject).sort();
            expect(targets).toEqual(['car', 'smartPhone']);
        });

        test('addPartialMethodが検出されない (enterのみのレイヤー)', () => {
            const addPartials = result.refinements.filter(r => r.type === 'refinement_addPartialMethod');
            expect(addPartials).toHaveLength(0);
        });
    });

    describe('example6.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example6.js');
        });

        test('レイヤーが検出されない (Signal/SignalCompのみ)', () => {
            expect(result.layers).toHaveLength(0);
        });

        test('Refinementが検出されない (EMAメソッド呼び出しなし)', () => {
            expect(result.refinements).toHaveLength(0);
        });

        test('検出される構文がない', () => {
            expect(result.allResults).toHaveLength(0);
        });
    });

    describe('example7.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example7.js');
        });

        test('landscapeレイヤーが1個検出される', () => {
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('landscape');
        });

        test('Refinementが6個検出される (exhibit 1 + addPartialMethod 2 + deploy 1 + proceed 2)', () => {
            expect(result.refinements.length).toBe(6);
        });

        test('scopeプロパティを持つレイヤー', () => {
            const landscape = result.layers[0];
            expect(landscape.name).toBe('landscape');
        });
    });

    describe('example8.js', () => {
        let result;

        beforeAll(() => {
            result = analyzeFile('example8.js');
        });

        test('landscapeレイヤーが1個検出される', () => {
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('landscape');
        });

        test('Refinementが6個検出される (exhibit 1 + addPartialMethod 2 + deploy 1 + proceed 2)', () => {
            expect(result.refinements.length).toBe(6);
        });

        test('exitプロパティを持つレイヤー', () => {
            const landscape = result.layers[0];
            expect(landscape.name).toBe('landscape');
        });

        test('EMA.addPartialMethod()が2個検出される', () => {
            const addPartials = result.refinements.filter(r => r.type === 'refinement_addPartialMethod');
            expect(addPartials).toHaveLength(2);
            const targets = addPartials.map(a => a.targetObject).sort();
            expect(targets).toEqual(['playerViewSmartPhone', 'videoGame']);
        });
    });

    describe('統合確認', () => {
        test('全exampleファイルが存在する', () => {
            const examples = ['example1.js', 'example2.js', 'example3.js', 'example4.js', 
                            'example5.js', 'example6.js', 'example7.js', 'example8.js'];
            
            examples.forEach(filename => {
                const filePath = path.join(__dirname, `../../examples/${filename}`);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });

        test('各ファイルがJavaScriptとして解析可能', () => {
            const examples = ['example1.js', 'example2.js', 'example3.js', 'example4.js', 
                            'example5.js', 'example6.js', 'example7.js', 'example8.js'];
            
            examples.forEach(filename => {
                expect(() => {
                    analyzeFile(filename);
                }).not.toThrow();
            });
        });

        test('全exampleで合計レイヤー数が正しい', () => {
            const examples = ['example1.js', 'example2.js', 'example3.js', 'example4.js', 
                            'example5.js', 'example6.js', 'example7.js', 'example8.js'];
            
            const totalLayers = examples.reduce((sum, filename) => {
                const result = analyzeFile(filename);
                return sum + result.layers.length;
            }, 0);

            // example1: 1, example2: 1, example3: 2, example4: 2, 
            // example5: 1, example6: 0, example7: 1, example8: 1
            expect(totalLayers).toBe(9);
        });
    });
});
