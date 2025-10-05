/**
 * DependencyGraphProvider - 依存グラフ機能の提供
 * 
 * 責務:
 * - 解析結果から依存グラフデータを構築
 * - 階層情報の計算
 * - WebView表示用のデータ提供
 */
class DependencyGraphProvider {
    constructor(analysisResult, globalStore = null) {
        this.result = analysisResult;
        this.globalStore = globalStore;
    }

    /**
     * 依存グラフを構築
     * @returns {Object} グラフデータ {nodes, edges, hierarchy, summary}
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
        
        // 階層情報を計算
        const hierarchy = this.calculateHierarchy(dependencies);

        return {
            nodes: dependencies.nodes || [],
            edges: dependencies.edges || [],
            hierarchy,
            summary: this.calculateSummary(dependencies)
        };
    }

    /**
     * 階層情報を計算
     * 依存関係に基づいてノードの階層レベルを決定
     * @param {Object} dependencies - 依存関係データ
     * @returns {Map} ノードIDと階層レベルのマップ
     */
    calculateHierarchy(dependencies) {
        const hierarchy = new Map();
        const { nodes, edges } = dependencies;

        if (!nodes || nodes.length === 0) {
            return hierarchy;
        }

        // 入次数を計算
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

        // ルートノード（入次数0）を見つける
        const roots = [];
        for (const [nodeId, degree] of inDegree) {
            if (degree === 0) {
                roots.push(nodeId);
                hierarchy.set(nodeId, 0);
            }
        }

        // BFSで階層レベルを計算
        if (roots.length > 0 && edges) {
            const queue = roots.map(id => ({ id, level: 0 }));
            const visited = new Set(roots);

            while (queue.length > 0) {
                const { id, level } = queue.shift();

                // このノードから出ている依存関係を探す
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
     * サマリー情報を計算
     * @param {Object} dependencies - 依存関係データ
     * @returns {Object} サマリー
     */
    calculateSummary(dependencies) {
        const nodes = dependencies.nodes || [];
        const edges = dependencies.edges || [];

        // 既存のsummaryがあればそれを使い、不足分を追加
        const existingSummary = dependencies.summary || {};
        
        return {
            totalNodes: existingSummary.totalNodes || nodes.length,
            totalEdges: existingSummary.totalEdges || edges.length,
            classes: existingSummary.classes || nodes.filter(n => n.data.type === 'class').length,
            instances: existingSummary.instances || nodes.filter(n => n.data.type === 'instance').length,
            dependencies: existingSummary.dependencies || edges.length,
            methods: existingSummary.methods || 0
        };
    }

    /**
     * 空のグラフを生成
     * @returns {Object} 空のグラフデータ
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
     * サマリー情報を取得
     * @returns {Object} サマリー
     */
    getSummary() {
        const graph = this.buildGraph();
        return graph.summary;
    }

    /**
     * ノード一覧を取得
     * @returns {Array} ノード配列
     */
    getNodes() {
        if (!this.result || !this.result.dependencies) {
            return [];
        }
        return this.result.dependencies.nodes || [];
    }

    /**
     * エッジ一覧を取得
     * @returns {Array} エッジ配列
     */
    getEdges() {
        if (!this.result || !this.result.dependencies) {
            return [];
        }
        return this.result.dependencies.edges || [];
    }

    /**
     * 階層情報を取得
     * @returns {Map} 階層情報
     */
    getHierarchy() {
        const graph = this.buildGraph();
        return graph.hierarchy;
    }
}

module.exports = { DependencyGraphProvider };
