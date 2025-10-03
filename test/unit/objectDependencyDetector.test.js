/**
 * Test for ObjectDependencyDetector
 * Tests basic class and property detection functionality
 */

const ObjectDependencyDetector = require('../../src/parser/objectDependencyDetector');
const acorn = require('acorn');

describe('ObjectDependencyDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new ObjectDependencyDetector();
        detector.setCurrentFile('test-file.js');
    });

    describe('Class Detection', () => {
        test('should detect basic class declaration', () => {
            const code = `
                class RemoteEditor {
                    constructor() {
                        this.name = "editor";
                    }
                }
            `;

            const ast = acorn.parse(code, { 
                ecmaVersion: 'latest', 
                sourceType: 'module',
                locations: true 
            });
            
            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            expect(graph.nodes).toHaveLength(1);
            expect(graph.nodes[0].data.name).toBe('RemoteEditor');
            expect(graph.nodes[0].data.type).toBe('class');
            expect(graph.summary.classes).toBe(1);
        });

        test('should detect multiple classes', () => {
            const code = `
                class RemoteEditor {
                    constructor() {}
                }
                
                class Editor {
                    constructor() {}
                }
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            expect(graph.summary.classes).toBe(2);
            expect(graph.nodes).toHaveLength(2);
            
            const classNames = graph.nodes.map(n => n.data.name);
            expect(classNames).toContain('RemoteEditor');
            expect(classNames).toContain('Editor');
        });
    });

    describe('Composition Detection', () => {
        test('should detect composition relationship', () => {
            const code = `
                class RemoteEditor {
                    constructor() {
                        this.editor = new Editor();
                        this.server = new Server();
                    }
                }
                
                class Editor {}
                class Server {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            // Should have 3 classes + 2 instances = 5 nodes
            expect(graph.summary.classes).toBe(3);
            expect(graph.summary.instances).toBe(2);
            expect(graph.nodes).toHaveLength(5);

            // Check composition edges
            const compositionEdges = graph.edges.filter(e => e.data.type === 'composition');
            expect(compositionEdges).toHaveLength(2);

            // Check specific composition
            const editorComposition = compositionEdges.find(e => 
                e.data.source === 'RemoteEditor' && e.data.property === 'editor'
            );
            expect(editorComposition).toBeDefined();
            expect(editorComposition.data.target).toBe('RemoteEditor_editor');
            expect(editorComposition.data.description).toContain('creates Editor instance');
        });

        test('should create instance nodes for composition', () => {
            const code = `
                class RemoteEditor {
                    constructor() {
                        this.editor = new Editor();
                    }
                }
                
                class Editor {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            // Find instance node
            const instanceNode = graph.nodes.find(n => 
                n.data.type === 'instance' && n.data.name === 'editor'
            );
            
            expect(instanceNode).toBeDefined();
            expect(instanceNode.data.className).toBe('Editor');
            expect(instanceNode.data.id).toBe('RemoteEditor_editor');

            // Check instanceOf edge
            const instanceOfEdge = graph.edges.find(e => 
                e.data.type === 'instanceOf' && 
                e.data.source === 'RemoteEditor_editor' &&
                e.data.target === 'Editor'
            );
            expect(instanceOfEdge).toBeDefined();
        });
    });

    describe('Aggregation Detection', () => {
        test('should detect aggregation relationship', () => {
            const code = `
                class EditorWidget {
                    constructor(editor) {
                        this.editor = editor;
                        this.render = new Render();
                    }
                }
                
                class Render {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            // Find aggregation edge
            const aggregationEdges = graph.edges.filter(e => e.data.type === 'aggregation');
            expect(aggregationEdges).toHaveLength(1);

            const editorAggregation = aggregationEdges[0];
            expect(editorAggregation.data.source).toBe('EditorWidget');
            expect(editorAggregation.data.property).toBe('editor');
            expect(editorAggregation.data.parameter).toBe('editor');
            expect(editorAggregation.data.description).toContain('uses editor parameter');
        });
    });

    describe('Complex Scenarios', () => {
        test('should handle remote-editor.js structure', () => {
            const code = `
                class RemoteEditor {
                    constructor() {
                        this.editor = new Editor();
                        this.workRemote = new WorkRemote();
                        this.server = new Server();
                    }
                }
                
                class EditorWidget {
                    constructor(editor) {
                        this.editor = editor;
                        this.render = new Render();
                    }
                }
                
                class Editor {}
                class WorkRemote {}
                class Server {}
                class Render {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            console.log('Graph Summary:', graph.summary);
            console.log('Nodes:', graph.nodes.length);
            console.log('Edges:', graph.edges.length);

            // Verify structure
            expect(graph.summary.classes).toBe(6); // RemoteEditor, EditorWidget, Editor, WorkRemote, Server, Render
            expect(graph.summary.instances).toBe(4); // editor, workRemote, server, render
            expect(graph.summary.dependencies).toBe(5); // 3 compositions + 1 aggregation + 1 composition

            // Check composition relationships
            const compositions = graph.edges.filter(e => e.data.type === 'composition');
            expect(compositions).toHaveLength(4); // RemoteEditor: 3, EditorWidget: 1

            // Check aggregation relationships  
            const aggregations = graph.edges.filter(e => e.data.type === 'aggregation');
            expect(aggregations).toHaveLength(1); // EditorWidget constructor parameter
        });

        test('should provide detailed dependency information', () => {
            const code = `
                class RemoteEditor {
                    constructor() {
                        this.editor = new Editor();
                    }
                }
                
                class Editor {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            // Check composition edge details
            const compositionEdge = graph.edges.find(e => e.data.type === 'composition');
            expect(compositionEdge.data.file).toBe('test-file.js');
            expect(compositionEdge.data.line).toBeGreaterThan(0);
            expect(compositionEdge.data.code).toBe('this.editor = new Editor()');
        });
    });

    describe('Edge Cases', () => {
        test('should handle classes without constructors', () => {
            const code = `
                class SimpleClass {
                    method() {
                        return "test";
                    }
                }
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            expect(graph.summary.classes).toBe(1);
            expect(graph.summary.instances).toBe(0);
            expect(graph.summary.dependencies).toBe(0);
        });

        test('should handle empty classes', () => {
            const code = `
                class EmptyClass {}
            `;

            const results = detector.detect(code);
            const graph = detector.getDependencyGraph();

            expect(graph.summary.classes).toBe(1);
            expect(graph.nodes[0].data.name).toBe('EmptyClass');
        });
    });
});