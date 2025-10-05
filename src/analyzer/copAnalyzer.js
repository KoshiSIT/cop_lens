const { BabelLayerDetector } = require('../parser/babelLayerDetector');
const { BabelRefinementDetector } = require('../parser/babelRefinementDetector');
const { BabelObjectDependencyDetector } = require('../parser/babelObjectDependencyDetector');

/**
 * COPAnalyzer - 共通の解析フロー
 * 
 * すべてのCOP機能（Hover、TreeView、依存グラフ）の基盤となる統合解析器
 * 
 * 責務:
 * - 各種Detectorを統合して実行
 * - 解析結果を統一フォーマットで返す
 * - シンボルインデックスの構築
 */
class COPAnalyzer {
    constructor(filePath) {
        this.filePath = filePath;
        
        // 各種Detector
        this.layerDetector = new BabelLayerDetector();
        this.refinementDetector = new BabelRefinementDetector();
        this.dependencyDetector = new BabelObjectDependencyDetector();
    }
    
    /**
     * コードを解析して統合結果を返す
     * @param {string} code - 解析対象のコード
     * @returns {Object} 統合解析結果
     */
    analyze(code) {
        // null/undefined対策
        if (!code) {
            return this.createEmptyResult();
        }
        
        try {
            // 現在のファイルパスを各Detectorに設定
            this.layerDetector.setCurrentFile(this.filePath);
            this.refinementDetector.setCurrentFile(this.filePath);
            this.dependencyDetector.setCurrentFile(this.filePath);
            
            // 1. 各種構文を検出
            const layers = this.layerDetector.detect(code);
            const refinements = this.refinementDetector.detect(code);
            const dependencies = this.dependencyDetector.detect(code);
            
            // 2. シンボルインデックスを構築
            const symbolIndex = this.buildSymbolIndex(layers, refinements, dependencies);
            
            // 3. 統合結果を返す
            return {
                filePath: this.filePath,
                layers,
                refinements,
                dependencies,
                symbolIndex
            };
            
        } catch (error) {
            // 構文エラーなどでも例外を投げない
            console.error(`[COPAnalyzer] Parse error in ${this.filePath}:`);
            console.error(`  ${error.message}`);
            if (error.loc) {
                console.error(`  at line ${error.loc.line}, column ${error.loc.column}`);
            }
            return this.createEmptyResult();
        }
    }
    
    /**
     * シンボルインデックスを構築
     * 位置ベースで高速検索できるように行番号でソート
     * 
     * @param {Array} layers - Layer情報
     * @param {Array} refinements - Refinement情報
     * @param {Object} dependencies - 依存関係情報
     * @returns {Array} ソート済みシンボルインデックス
     */
    buildSymbolIndex(layers, refinements, dependencies) {
        const symbols = [];
        
        // Layerをシンボルに追加
        if (layers && layers.length > 0) {
            layers.forEach(layer => {
                symbols.push({
                    name: layer.name || layer.layerName,
                    type: 'layer',
                    line: layer.line,
                    range: layer.range,
                    data: layer
                });
            });
        }
        
        // Refinementをシンボルに追加
        if (refinements && refinements.length > 0) {
            refinements.forEach(refinement => {
                symbols.push({
                    name: `${refinement.targetClass}.${refinement.methodName}`,
                    type: 'refinement',
                    line: refinement.line,
                    range: refinement.range,
                    data: refinement
                });
            });
        }
        
        // Dependencyのノードをシンボルに追加
        if (dependencies && dependencies.nodes) {
            dependencies.nodes.forEach(node => {
                const nodeData = node.data;
                if (nodeData && nodeData.line) {
                    symbols.push({
                        name: nodeData.id,
                        type: nodeData.type || 'class',
                        line: nodeData.line,
                        range: nodeData.range,
                        data: nodeData
                    });
                }
            });
        }
        
        // 行番号でソート
        symbols.sort((a, b) => (a.line || 0) - (b.line || 0));
        
        return symbols;
    }
    
    /**
     * 空の解析結果を生成
     * @returns {Object} 空の解析結果
     */
    createEmptyResult() {
        return {
            filePath: this.filePath,
            layers: [],
            refinements: [],
            dependencies: {
                nodes: [],
                edges: [],
                summary: {
                    totalNodes: 0,
                    totalEdges: 0
                }
            },
            symbolIndex: []
        };
    }
}

module.exports = { COPAnalyzer };
