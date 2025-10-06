/**
 * GlobalCOPDataStore - プロジェクト全体のCOP情報を管理
 * 
 * 責務:
 * - プロジェクト全体の解析結果を保持
 * - ファイル保存/更新時に増分更新
 * - 各機能がデータを取り出すインターフェースを提供
 */
class GlobalCOPDataStore {
    constructor() {
        // ファイルパスごとの解析結果
        this.fileAnalysisResults = new Map(); // filePath -> COPAnalyzer result
        
        // 統合インデックス（全ファイルから検索可能）
        this.globalSymbolIndex = []; // すべてのシンボル（ソート済み）
        
        // プロジェクトルート
        this.projectRoot = null;
        
        // 依存グラフ（プロジェクト全体）
        this.dependencyGraph = null;
    }

    /**
     * プロジェクトルートを設定
     */
    setProjectRoot(projectRoot) {
        this.projectRoot = projectRoot;
    }

    /**
     * プロジェクトが変更されたかチェック
     * @param {string} newProjectRoot - 新しいプロジェクトルート
     * @returns {boolean} プロジェクトが変更された場合true
     */
    hasProjectChanged(newProjectRoot) {
        return this.projectRoot !== null && this.projectRoot !== newProjectRoot;
    }

    /**
     * ストアをクリア（新しいプロジェクトに切り替わったとき）
     */
    clear() {
        console.log('[GlobalStore] Clearing all data for new project');
        this.fileAnalysisResults.clear();
        this.globalSymbolIndex = [];
        this.dependencyGraph = null;
        // projectRootはクリアしない（次のsetProjectRootで上書きされる）
    }

    /**
     * ファイルの解析結果を追加/更新
     * @param {string} filePath - ファイルパス
     * @param {Object} analysisResult - COPAnalyzerからの解析結果
     */
    updateFile(filePath, analysisResult) {
        this.fileAnalysisResults.set(filePath, analysisResult);
        this.rebuildIndices();
    }

    /**
     * ファイルの解析結果を削除
     * @param {string} filePath - ファイルパス
     */
    removeFile(filePath) {
        this.fileAnalysisResults.delete(filePath);
        this.rebuildIndices();
    }

    /**
     * すべてのインデックスを再構築
     */
    rebuildIndices() {
        // グローバルシンボルインデックスを再構築
        this.globalSymbolIndex = [];
        
        for (const [filePath, result] of this.fileAnalysisResults) {
            if (result.symbolIndex) {
                // 各シンボルにファイル情報を追加
                result.symbolIndex.forEach(symbol => {
                    this.globalSymbolIndex.push({
                        ...symbol,
                        filePath,
                        fileUri: `file://${filePath}`
                    });
                });
            }
        }
        
        // 行番号でソート（同じファイル内で）
        this.globalSymbolIndex.sort((a, b) => {
            if (a.filePath !== b.filePath) {
                return a.filePath.localeCompare(b.filePath);
            }
            return (a.line || 0) - (b.line || 0);
        });
    }

    /**
     * 依存グラフを更新
     * @param {Object} dependencyGraph - ProjectAnalyzerからの依存グラフ
     */
    setDependencyGraph(dependencyGraph) {
        this.dependencyGraph = dependencyGraph;
    }

    /**
     * 指定位置のエンティティを検索
     * @param {string} filePath - ファイルパス
     * @param {Object} position - {line, character}
     * @returns {Object|null} エンティティ
     */
    findEntityAt(filePath, position) {
        const result = this.fileAnalysisResults.get(filePath);
        if (!result || !result.symbolIndex) {
            return null;
        }

        const targetLine = position.line + 1; // VSCodeは0始まり、ASTは1始まり
        return this.binarySearchSymbol(result.symbolIndex, targetLine);
    }

    /**
     * 二分探索でシンボルを検索（高速化）
     * @param {Array} symbols - ソート済みシンボル配列
     * @param {number} targetLine - 検索対象の行番号
     * @returns {Object|null} 見つかったシンボル or null
     */
    binarySearchSymbol(symbols, targetLine) {
        if (!symbols || symbols.length === 0) {
            return null;
        }

        // まず完全一致を探す（二分探索）
        let left = 0;
        let right = symbols.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const symbol = symbols[mid];
            
            if (symbol.line === targetLine) {
                return symbol;
            } else if (symbol.line < targetLine) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        // 完全一致がない場合、範囲チェック
        // targetLineを含む範囲を持つシンボルを探す
        for (const symbol of symbols) {
            if (symbol.range) {
                const { start, end } = symbol.range;
                if (targetLine >= start.line && targetLine <= end.line) {
                    return symbol;
                }
            }
        }
        
        return null;
    }

    /**
     * 指定ファイルのすべてのエンティティを取得
     * @param {string} filePath - ファイルパス
     * @returns {Array} エンティティ配列
     */
    getEntitiesForFile(filePath) {
        const result = this.fileAnalysisResults.get(filePath);
        if (!result || !result.symbolIndex) {
            return [];
        }
        return result.symbolIndex;
    }

    /**
     * 指定ファイルの解析結果を取得
     * @param {string} filePath - ファイルパス
     * @returns {Object|null} 解析結果
     */
    getFileAnalysis(filePath) {
        return this.fileAnalysisResults.get(filePath) || null;
    }

    /**
     * 依存グラフを取得
     * @returns {Object|null} 依存グラフ
     */
    getDependencyGraph() {
        // If project-wide graph exists, return it
        if (this.dependencyGraph) {
            return this.dependencyGraph;
        }
        
        // Otherwise, aggregate graphs from all files
        const aggregatedNodes = [];
        const aggregatedEdges = [];
        const nodeIds = new Set();
        const edgeIds = new Set();
        
        for (const [filePath, analysisResult] of this.fileAnalysisResults) {
            if (analysisResult && analysisResult.dependencies) {
                const { nodes, edges } = analysisResult.dependencies;
                
                // Add unique nodes
                if (nodes) {
                    nodes.forEach(node => {
                        const nodeId = node.data?.id || node.id;
                        if (nodeId && !nodeIds.has(nodeId)) {
                            nodeIds.add(nodeId);
                            aggregatedNodes.push(node);
                        }
                    });
                }
                
                // Add unique edges
                if (edges) {
                    edges.forEach(edge => {
                        const edgeId = `${edge.source || edge.data?.source}-${edge.target || edge.data?.target}-${edge.data?.type}`;
                        if (!edgeIds.has(edgeId)) {
                            edgeIds.add(edgeId);
                            aggregatedEdges.push(edge);
                        }
                    });
                }
            }
        }
        
        // Return aggregated graph (or empty if no files analyzed)
        if (aggregatedNodes.length === 0 && aggregatedEdges.length === 0) {
            return null;
        }
        
        return {
            nodes: aggregatedNodes,
            edges: aggregatedEdges,
            summary: {
                totalNodes: aggregatedNodes.length,
                totalEdges: aggregatedEdges.length,
                source: 'aggregated'
            }
        };
    }

    /**
     * すべてのLayer定義を取得（プロジェクト全体）
     * @returns {Array} Layer配列
     */
    getAllLayers() {
        const layers = [];
        for (const [filePath, result] of this.fileAnalysisResults) {
            const layersInFile = result.getLayers ? result.getLayers() : [];
            layersInFile.forEach(layer => {
                layers.push({
                    ...layer,
                    filePath,
                    fileUri: `file://${filePath}`
                });
            });
        }
        return layers;
    }

    /**
     * すべてのRefinement定義を取得（プロジェクト全体）
     * @returns {Array} Refinement配列
     */
    getAllRefinements() {
        const refinements = [];
        for (const [filePath, result] of this.fileAnalysisResults) {
            const refinementsInFile = result.getRefinements ? result.getRefinements() : [];
            refinementsInFile.forEach(refinement => {
                refinements.push({
                    ...refinement,
                    filePath,
                    fileUri: `file://${filePath}`
                });
            });
        }
        return refinements;
    }

    /**
     * 名前でLayerを検索（プロジェクト全体）
     * @param {string} layerName - Layer名
     * @returns {Object|null} Layer定義
     */
    findLayerByName(layerName) {
        const layers = this.getAllLayers();
        return layers.find(layer => layer.name === layerName || layer.layerName === layerName) || null;
    }

    /**
     * 統計情報を取得
     * @returns {Object} 統計情報
     */
    getStatistics() {
        let totalLayers = 0;
        let totalRefinements = 0;
        let totalSymbols = 0;

        for (const result of this.fileAnalysisResults.values()) {
            totalLayers += result.getLayers ? result.getLayers().length : 0;
            totalRefinements += result.getRefinements ? result.getRefinements().length : 0;
            totalSymbols += (result.symbolIndex || []).length;
        }

        return {
            totalFiles: this.fileAnalysisResults.size,
            totalLayers,
            totalRefinements,
            totalSymbols,
            dependencyGraph: this.dependencyGraph ? {
                nodes: this.dependencyGraph.nodes?.length || 0,
                edges: this.dependencyGraph.edges?.length || 0
            } : null
        };
    }

    /**
     * ストアをクリア
     */
    clear() {
        this.fileAnalysisResults.clear();
        this.globalSymbolIndex = [];
        this.dependencyGraph = null;
    }
}

module.exports = { GlobalCOPDataStore };
