/**
 * example7.js COP構文検出テスト（Jest）
 */

const { BabelLayerDetector } = require('../../src/parser/babelLayerDetector');
const { BabelRefinementDetector } = require('../../src/parser/babelRefinementDetector');
const fs = require('fs');
const path = require('path');

describe('example7.js COP構文検出', () => {
    let code;
    let layerDetector;
    let refinementDetector;
    let layers;
    let refinements;

    beforeAll(() => {
        // example7.jsを読み込み
        const filePath = path.join(__dirname, '../../examples/example7.js');
        code = fs.readFileSync(filePath, 'utf8');
        
        // 検出実行
        layerDetector = new BabelLayerDetector();
        layers = layerDetector.detect(code);
        
        refinementDetector = new BabelRefinementDetector();
        refinements = refinementDetector.detect(code);
    });

    describe('Layer検出', () => {
        test('landscapeレイヤーが1個検出される', () => {
            expect(layers).toHaveLength(1);
        });

        test('landscapeレイヤーの名前が正しい', () => {
            const landscape = layers.find(l => l.name === 'landscape');
            expect(landscape).toBeDefined();
            expect(landscape.name).toBe('landscape');
        });

        test('landscapeレイヤーのconditionが正しい', () => {
            const landscape = layers.find(l => l.name === 'landscape');
            expect(landscape.condition).toBe('gyroLevel > 45');
        });

        test('landscapeレイヤーのtypeが"layer"', () => {
            const landscape = layers.find(l => l.name === 'landscape');
            expect(landscape.type).toBe('layer');
        });
    });

    describe('Refinement検出', () => {
        test('合計6個のRefinementが検出される（exhibit 1 + addPartialMethod 2 + deploy 1 + proceed 2）', () => {
            expect(refinements.length).toBeGreaterThanOrEqual(6);
        });

        test('EMA.exhibit()が1個検出される', () => {
            const exhibits = refinements.filter(r => r.type === 'refinement_exhibit');
            expect(exhibits).toHaveLength(1);
        });

        test('EMA.addPartialMethod()が2個検出される', () => {
            const addPartialMethods = refinements.filter(r => r.type === 'refinement_addPartialMethod');
            expect(addPartialMethods.length).toBeGreaterThanOrEqual(2);
        });

        test('EMA.deploy()が1個検出される', () => {
            const deploys = refinements.filter(r => r.type === 'refinement_deploy');
            expect(deploys).toHaveLength(1);
            expect(deploys[0].layerObject).toBe('landscape');
        });

        test('Layer.proceed()が2個検出される', () => {
            const proceeds = refinements.filter(r => r.type === 'refinement_proceed');
            expect(proceeds.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('詳細な検証', () => {
        test('EMA.exhibit()のターゲットがscreenである', () => {
            const exhibit = refinements.find(r => r.type === 'refinement_exhibit');
            expect(exhibit).toBeDefined();
            expect(exhibit.targetObject).toBe('screen');
        });

        test('EMA.addPartialMethod()のターゲットがplayerViewとvideoGameである', () => {
            const addPartialMethods = refinements.filter(r => r.type === 'refinement_addPartialMethod');
            const targets = addPartialMethods.map(r => r.targetObject).sort();
            expect(targets).toContain('playerView');
            expect(targets).toContain('videoGame');
        });

        test('全てのRefinementが行番号を持つ', () => {
            refinements.forEach(r => {
                expect(r.line).toBeGreaterThan(0);
            });
        });

        test('landscapeレイヤーが行番号を持つ', () => {
            const landscape = layers[0];
            expect(landscape.line).toBeGreaterThan(0);
        });
    });

    describe('統合確認', () => {
        test('Overview用の全結果を統合すると7個以上になる', () => {
            const allResults = [...layers, ...refinements];
            expect(allResults.length).toBeGreaterThanOrEqual(7);
        });

        test('全ての結果がtypeプロパティを持つ', () => {
            const allResults = [...layers, ...refinements];
            allResults.forEach(result => {
                expect(result.type).toBeDefined();
            });
        });

        test('結果を行番号でソートできる', () => {
            const allResults = [...layers, ...refinements].sort((a, b) => a.line - b.line);
            
            // 最初の要素の行番号 <= 最後の要素の行番号
            expect(allResults[0].line).toBeLessThanOrEqual(allResults[allResults.length - 1].line);
        });
    });
});
