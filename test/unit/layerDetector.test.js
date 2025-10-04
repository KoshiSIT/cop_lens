const { BabelLayerDetector: LayerDetector } = require("../../src/parser/babelLayerDetector");
const fs = require("fs");
const path = require("path");

describe("LayerDetector", () => {
    let detector;

    beforeEach(() => {
        detector = new LayerDetector();
    });
    test("should work with simple example", () => {
        const code = 'let layer1 = { condition: "x > 1" };';
        const results = detector.detect(code);
        expect(results).toBeDefined();
        expect(results.length).toBe(1);
        expect(results[0]).toMatchObject({
            line: expect.any(Number),
            name: "layer1",
            condition: "x > 1",
            conditionType: "string",
            type: "layer",
        });
    });
    test("should detect layer in example7.js", () => {
        const filepath = path.join(__dirname, "../../examples/example7.js");
        const code = fs.readFileSync(filepath, "utf8");
        const results = detector.detect(code);

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            name: "landscape",
            condition: "gyroLevel > 45",
            conditionType: "string",
            type: "layer",
        });
    });
});
