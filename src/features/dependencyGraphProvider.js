/**
 * DependencyGraphProvider - Provides dependency graph functionality
 * 
 * Responsibilities:
 * - Build dependency graph data from analysis results
 * - Calculate hierarchy information
 * - Provide data for WebView display
 */
class DependencyGraphProvider {
    constructor(analysisResult, globalStore = null) {
        this.result = analysisResult;
        this.globalStore = globalStore;
    }

    /**
     * Build dependency graph
     * @returns {Object} Graph data {nodes, edges, hierarchy, summary}
     */
    buildGraph() {
        // Use globalStore if available
        if (this.globalStore) {
            const globalGraph = this.globalStore.getDependencyGraph();
            if (globalGraph) {
                const hierarchy = this.calculateHierarchy(globalGraph);
                return {
                    nodes: globalGraph.nodes || [],
                    edges: globalGraph.edges || [],
                    hierarchy,
                    summary: this.calculateSummary(globalGraph)
                };
            }
        }
        
        // Fallback to local result
        if (!this.result || !this.result.dependencies) {
            return this.createEmptyGraph();
        }

        const { dependencies } = this.result;
        
        // Calculate hierarchy information
        const hierarchy = this.calculateHierarchy(dependencies);

        return {
            nodes: dependencies.nodes || [],
            edges: dependencies.edges || [],
            hierarchy,
            summary: this.calculateSummary(dependencies)
        };
    }

    /**
     * Calculate hierarchy information
     * Determine node hierarchy levels based on dependencies
     * @param {Object} dependencies - Dependency data
     * @returns {Map} Map of node IDs to hierarchy levels
     */
    calculateHierarchy(dependencies) {
        const hierarchy = new Map();
        const { nodes, edges } = dependencies;

        if (!nodes || nodes.length === 0) {
            return hierarchy;
        }

        // Calculate in-degree
        const inDegree = new Map();
        nodes.forEach(node => {
            inDegree.set(node.data.id, 0);
        });

        if (edges) {
            edges.forEach(edge => {
                const targetId = edge.data.target;
                if (inDegree.has(targetId)) {
                    inDegree.set(targetId, inDegree.get(targetId) + 1);
                }
            });
        }

        // Find root nodes (in-degree 0)
        const roots = [];
        for (const [nodeId, degree] of inDegree) {
            if (degree === 0) {
                roots.push(nodeId);
                hierarchy.set(nodeId, 0);
            }
        }

        // Calculate hierarchy levels with BFS
        if (roots.length > 0 && edges) {
            const queue = roots.map(id => ({ id, level: 0 }));
            const visited = new Set(roots);

            while (queue.length > 0) {
                const { id, level } = queue.shift();

                // Find dependencies outgoing from this node
                edges.forEach(edge => {
                    if (edge.data.source === id) {
                        const targetId = edge.data.target;
                        if (!visited.has(targetId)) {
                            visited.add(targetId);
                            hierarchy.set(targetId, level + 1);
                            queue.push({ id: targetId, level: level + 1 });
                        }
                    }
                });
            }
        }

        return hierarchy;
    }

    /**
     * Calculate summary information
     * @param {Object} dependencies - Dependency data
     * @returns {Object} Summary
     */
    calculateSummary(dependencies) {
        const nodes = dependencies.nodes || [];
        const edges = dependencies.edges || [];

        // Use existing summary if available, add missing parts
        const existingSummary = dependencies.summary || {};
        
        // Calculate total methods (from each class's methodsMap)
        let totalMethods = 0;
        nodes.forEach(node => {
            if (node.data.type === 'class' && node.data.methodsMap) {
                totalMethods += Object.keys(node.data.methodsMap).length;
            }
        });
        
        return {
            totalNodes: existingSummary.totalNodes || nodes.length,
            totalEdges: existingSummary.totalEdges || edges.length,
            classes: existingSummary.classes || nodes.filter(n => n.data.type === 'class').length,
            instances: existingSummary.instances || nodes.filter(n => n.data.type === 'instance').length,
            dependencies: existingSummary.dependencies || edges.length,
            methods: totalMethods
        };
    }

    /**
     * Generate empty graph
     * @returns {Object} Empty graph data
     */
    createEmptyGraph() {
        return {
            nodes: [],
            edges: [],
            hierarchy: new Map(),
            summary: {
                totalNodes: 0,
                totalEdges: 0,
                classes: 0,
                instances: 0,
                dependencies: 0,
                methods: 0
            }
        };
    }

    /**
     * Get summary information
     * @returns {Object} Summary
     */
    getSummary() {
        const graph = this.buildGraph();
        return graph.summary;
    }

    /**
     * Get list of nodes
     * @returns {Array} Node array
     */
    getNodes() {
        if (!this.result || !this.result.dependencies) {
            return [];
        }
        return this.result.dependencies.nodes || [];
    }

    /**
     * Get list of edges
     * @returns {Array} Edge array
     */
    getEdges() {
        if (!this.result || !this.result.dependencies) {
            return [];
        }
        return this.result.dependencies.edges || [];
    }

    /**
     * Get hierarchy information
     * @returns {Map} Hierarchy information
     */
    getHierarchy() {
        const graph = this.buildGraph();
        return graph.hierarchy;
    }
}

module.exports = { DependencyGraphProvider };
