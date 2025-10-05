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
        return this.dependencyGraph;
    }

    /**
     * すべてのLayer定義を取得（プロジェクト全体）
     * @returns {Array} Layer配列
     */
    getAllLayers() {
        const layers = [];
        for (const [filePath, result] of this.fileAnalysisResults) {
            if (result.layers) {
                result.layers.forEach(layer => {
                    layers.push({
                        ...layer,
                        filePath,
                        fileUri: `file://${filePath}`
                    });
                });
            }
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
            if (result.refinements) {
                result.refinements.forEach(refinement => {
                    refinements.push({
                        ...refinement,
                        filePath,
                        fileUri: `file://${filePath}`
                    });
                });
            }
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
            totalLayers += (result.layers || []).length;
            totalRefinements += (result.refinements || []).length;
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
