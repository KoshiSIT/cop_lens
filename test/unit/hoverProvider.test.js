const { HoverProvider } = require("../../src/features/hoverProvider");
const { COPAnalyzer } = require("../../src/analyzer/copAnalyzer");

describe("HoverProvider", () => {
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
    save() {
        console.log("save");
    }
}
        `.trim();

        const analyzer = new COPAnalyzer("test.js");
        analysisResult = analyzer.analyze(code);
        provider = new HoverProvider(analysisResult);
    });

    describe("findEntityAt", () => {
        test("Layer定義の位置でエンティティを取得できる", () => {
            // Layer定義は最初の行にある（0始まり）
            const position = { line: 0, character: 10 };
            const entity = provider.findEntityAt(position);

            expect(entity).toBeDefined();
            expect(entity.type).toBe("layer");
            expect(entity.name).toBe("layerOnline");
        });

        test("存在しない位置ではnullを返す", () => {
            const position = { line: 999, character: 0 };
            const entity = provider.findEntityAt(position);

            expect(entity).toBeNull();
        });

        test("行番号の範囲内で最も近いエンティティを返す", () => {
            const position = { line: 0, character: 5 };
            const entity = provider.findEntityAt(position);

            expect(entity).toBeDefined();
        });
    });

    describe("provideHover", () => {
        test("Layer情報のホバーコンテンツを生成できる", () => {
            const position = { line: 0, character: 10 };
            const hover = provider.provideHover(position);

            expect(hover).toBeDefined();
            expect(hover.contents).toBeDefined();
            expect(hover.contents).toContain("Layer");
            expect(hover.contents).toContain("layerOnline");
        });

        test("存在しない位置ではnullを返す", () => {
            const position = { line: 999, character: 0 };
            const hover = provider.provideHover(position);

            expect(hover).toBeNull();
        });
    });

    describe("generateHoverContent", () => {
        test("Layer用のホバーコンテンツを生成する", () => {
            const layerEntity = {
                type: "layer",
                name: "layerOnline",
                data: {
                    condition: "isOnline === true",
                    conditionType: "string",
                },
            };

            const content = provider.generateHoverContent(layerEntity);

            expect(content).toContain("Layer");
            expect(content).toContain("layerOnline");
            expect(content).toContain("isOnline === true");
        });

        test("Refinement用のホバーコンテンツを生成する", () => {
            const refinementEntity = {
                type: "refinement",
                name: "Editor.save",
                data: {
                    targetClass: "Editor",
                    methodName: "save",
                },
            };

            const content = provider.generateHoverContent(refinementEntity);

            expect(content).toContain("Refinement");
            expect(content).toContain("Editor");
            expect(content).toContain("save");
        });

        test("nullエンティティではnullを返す", () => {
            const content = provider.generateHoverContent(null);
            expect(content).toBeNull();
        });
    });
});
