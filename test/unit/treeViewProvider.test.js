const { TreeViewProvider } = require('../../src/features/treeViewProvider');
const { COPAnalyzer } = require('../../src/analyzer/copAnalyzer');

describe('TreeViewProvider', () => {
    let analysisResult;
    let provider;

    beforeEach(() => {
        const code = `
const layerOnline = { 
    condition: "isOnline === true",
    enter: function() {},
    exit: function() {}
};

class Editor {
    constructor() {
        this.battery = { charge: 80 };
    }
}

const editor = new Editor();
EMA.exhibit(editor, {level: editor.battery.charge});
        `.trim();

        const analyzer = new COPAnalyzer('test.js');
        analysisResult = analyzer.analyze(code);
        provider = new TreeViewProvider(analysisResult);
    });

    describe('buildTreeItems', () => {
        test('Layer と Refinement の両方からTreeItemを生成できる', () => {
            const items = provider.buildTreeItems();

            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            
            // Layerが含まれている
            const layerItems = items.filter(item => item.type === 'layer');
            expect(layerItems.length).toBe(1);
            
            // Refinementが含まれている
            const refinementItems = items.filter(item => item.type === 'refinement');
            expect(refinementItems.length).toBeGreaterThan(0);
        });

        test('空の解析結果では"No COP constructs"を返す', () => {
            const emptyAnalyzer = new COPAnalyzer('empty.js');
            const emptyResult = emptyAnalyzer.analyze('');
            const emptyProvider = new TreeViewProvider(emptyResult);

            const items = emptyProvider.buildTreeItems();

            expect(items).toBeDefined();
            expect(items.length).toBe(1);
            expect(items[0].label).toContain('No COP constructs');
        });
    });

    describe('createTreeItem', () => {
        test('Layer用のTreeItemを生成できる', () => {
            const layerEntity = {
                type: 'layer',
                name: 'layerOnline',
                line: 1,
                data: {
                    condition: 'isOnline === true',
                    conditionType: 'string'
                }
            };

            const item = provider.createTreeItem(layerEntity);

            expect(item).toBeDefined();
            expect(item.label).toContain('layerOnline');
            expect(item.label).toContain('line 1');
            expect(item.description).toContain('isOnline === true');
        });

        test('Refinement用のTreeItemを生成できる', () => {
            const refinementEntity = {
                type: 'refinement',
                name: 'exhibit',
                line: 5,
                data: {
                    type: 'refinement_exhibit',
                    targetObject: 'editor',
                    mappings: {
                        level: 'editor.battery.charge'
                    }
                }
            };

            const item = provider.createTreeItem(refinementEntity);

            expect(item).toBeDefined();
            expect(item.label).toContain('EMA.exhibit');
            expect(item.label).toContain('line 5');
        });

        test('TreeItemにコマンドが設定されている', () => {
            const layerEntity = {
                type: 'layer',
                name: 'test',
                line: 10,
                data: {}
            };

            const item = provider.createTreeItem(layerEntity);

            expect(item.command).toBeDefined();
            expect(item.command.command).toBe('cop-lens.goToLine');
            expect(item.command.arguments).toEqual([10]);
        });
    });

    describe('getDisplayName', () => {
        test('Layer名を表示名として返す', () => {
            const displayName = provider.getDisplayName({
                type: 'layer',
                name: 'layerOnline',
                line: 1
            });

            expect(displayName).toBe('layerOnline (line 1)');
        });

        test('EMA.exhibit を表示名として返す', () => {
            const displayName = provider.getDisplayName({
                type: 'refinement',
                data: { type: 'refinement_exhibit' },
                line: 5
            });

            expect(displayName).toBe('EMA.exhibit (line 5)');
        });
    });

    describe('getDescription', () => {
        test('LayerのConditionを説明として返す', () => {
            const description = provider.getDescription({
                type: 'layer',
                data: { condition: 'x > 10' }
            });

            expect(description).toBe('x > 10');
        });

        test('Refinementのマッピング情報を説明として返す', () => {
            const description = provider.getDescription({
                type: 'refinement',
                data: {
                    type: 'refinement_exhibit',
                    targetObject: 'editor',
                    mappings: { level: 'battery.charge', status: 'online' }
                }
            });

            expect(description).toContain('editor');
            expect(description).toContain('level');
            expect(description).toContain('status');
        });
    });

    describe('getTooltip', () => {
        test('Layer用のTooltipを生成できる', () => {
            const tooltip = provider.getTooltip({
                type: 'layer',
                name: 'layerOnline',
                data: {
                    condition: 'isOnline === true',
                    conditionType: 'string'
                }
            });

            expect(tooltip).toContain('Layer');
            expect(tooltip).toContain('layerOnline');
            expect(tooltip).toContain('isOnline === true');
        });

        test('Refinement用のTooltipを生成できる', () => {
            const tooltip = provider.getTooltip({
                type: 'refinement',
                data: {
                    type: 'refinement_exhibit',
                    targetObject: 'editor',
                    mappings: { level: 'battery.charge' }
                }
            });

            expect(tooltip).toContain('EMA.exhibit');
            expect(tooltip).toContain('editor');
            expect(tooltip).toContain('level');
        });
    });
});
