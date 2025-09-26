const { RefinementDetector } = require("../../src/parser/refinementDetector");

describe("RefinementDetector", () => {
    let detector;

    beforeEach(() => {
        detector = new RefinementDetector();
    });

    describe("EMA.exhibit detection", () => {
        test("should detect simple EMA.exhibit call", () => {
            const code = "EMA.exhibit(battery, {level: battery.charge});";
            const results = detector.detect(code);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: "refinement_exhibit",
                targetObject: "battery",
                mappings: {
                    level: "battery.charge",
                },
                line: 1,
            });
        });

        test("should detect EMA.exhibit with multiple mappings", () => {
            const code =
                "EMA.exhibit(screen, {gyroLevel: screen.gyroscope, rotation: screen.angle});";
            const results = detector.detect(code);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: "refinement_exhibit",
                targetObject: "screen",
                mappings: {
                    gyroLevel: "screen.gyroscope",
                    rotation: "screen.angle",
                },
            });
        });
        test("should detect exhibit in example1.js", () => {
            const fs = require("fs");
            const path = require("path");
            const filepath = path.join(__dirname, "../../examples/example1.js");
            const code = fs.readFileSync(filepath, "utf8");

            const detector = new RefinementDetector();
            const results = detector.detect(code);

            expect(results.length).toBeGreaterThan(0);
        });

        test("should detect EMA.exhibit from example1.js pattern", () => {
            const code = `
                let battery = {charge: new Signal(100)};
                EMA.exhibit(battery, {level: battery.charge});
            `;
            const results = detector.detect(code);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: "refinement_exhibit",
                targetObject: "battery",
                mappings: {
                    level: "battery.charge",
                },
            });
        });

        test("should detect EMA.exhibit from example3.js pattern", () => {
            const code = `
                EMA.exhibit(screen, {gyroLevel: screen.gyroscope});
                EMA.exhibit(landscape, {landscape: landscape.condition});
            `;
            const results = detector.detect(code);

            expect(results).toHaveLength(2);
            expect(results[0]).toMatchObject({
                targetObject: "screen",
                mappings: { gyroLevel: "screen.gyroscope" },
            });
            expect(results[1]).toMatchObject({
                targetObject: "landscape",
                mappings: { landscape: "landscape.condition" },
            });
        });
    });

    describe("EMA.addPartialMethod detection", () => {
        test("should detect EMA.addPartialMethod", () => {
            const code = 'EMA.addPartialMethod(lowBattery, videoCard, "graph", function() {});';
            const results = detector.detect(code);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: "refinement_addPartialMethod",
                layerObject: "lowBattery",
                targetObject: "videoCard",
                methodName: "graph",
                hasImplementation: true
            });
        });

        test("should detect EMA.addPartialMethod with arrow function", () => {
            const code = 'EMA.addPartialMethod(landscape, playerView, "draw", () => { Layer.proceed(); });';
            const results = detector.detect(code);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: "refinement_addPartialMethod",
                layerObject: "landscape",
                targetObject: "playerView",
                methodName: "draw",
                hasImplementation: true
            });
        });

        test("should not detect invalid EMA.addPartialMethod calls", () => {
            const code = `
                EMA.addPartialMethod();
                EMA.addPartialMethod(layer, obj);
                EMA.addPartialMethod(layer, obj, "method");
            `;
            const results = detector.detect(code);

            expect(results).toHaveLength(0);
        });
    });

    describe("Edge cases", () => {
        test("should return empty array for non-EMA code", () => {
            const code = "let x = 5; console.log(x);";
            const results = detector.detect(code);

            expect(results).toHaveLength(0);
        });

        test("should return empty array for invalid EMA.exhibit calls", () => {
            const code = `
                EMA.exhibit();
                EMA.exhibit(obj);
                EMA.exhibit(obj, "not-an-object");
            `;
            const results = detector.detect(code);

            expect(results).toHaveLength(0);
        });

        test("should ignore non-EMA method calls", () => {
            const code = `
                OTHER.exhibit(obj, {prop: obj.value});
                obj.exhibit({prop: value});
            `;
            const results = detector.detect(code);

            expect(results).toHaveLength(0);
        });

        test("should handle empty object mappings", () => {
            const code = "EMA.exhibit(obj, {});";
            const results = detector.detect(code);

            expect(results).toHaveLength(0);
        });
    });

    describe("Real file examples", () => {
        test("should work with actual example file content", () => {
            // example1.jsの一部を模擬
            const code = `
                let battery = {
                    name: "UMIDIGI",
                    charge: new Signal(100),
                    capacity: 5105
                };

                let videoCard = {
                    graph: function() {
                        show("High Performance");
                    }
                };

                let lowBattery = {
                    condition: new SignalComp("level < 30")
                };

                EMA.exhibit(battery, {level: battery.charge});
                EMA.addPartialMethod(lowBattery, videoCard, "graph", function() {show("Low Performance")} );
                EMA.deploy(lowBattery);
            `;

            const results = detector.detect(code);

            // Should detect both EMA.exhibit and EMA.addPartialMethod
            expect(results).toHaveLength(2);
            
            const exhibitResult = results.find(r => r.type === "refinement_exhibit");
            expect(exhibitResult).toMatchObject({
                type: "refinement_exhibit",
                targetObject: "battery",
                mappings: {
                    level: "battery.charge",
                },
            });
            
            const addPartialMethodResult = results.find(r => r.type === "refinement_addPartialMethod");
            expect(addPartialMethodResult).toMatchObject({
                type: "refinement_addPartialMethod",
                layerObject: "lowBattery",
                targetObject: "videoCard",
                methodName: "graph",
                hasImplementation: true
            });
        });
    });
});
