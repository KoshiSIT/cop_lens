const { BabelLayerDetector } = require('../parser/babelLayerDetector');
const { BabelRefinementDetector } = require('../parser/babelRefinementDetector');
const { BabelObjectDependencyDetector } = require('../parser/babelObjectDependencyDetector');
const { COPAnalysisResult } = require('./copAnalysisResult');

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
            
            // 2. COPAnalysisResultに統合
            const result = new COPAnalysisResult();
            result.mergeLayerResults(layers);
            result.mergeRefinementResults(refinements);  // ← ここで分類される
            
            // 3. Layerノードをdependenciesグラフにマージ
            result.dependencies = this.mergeCOPIntoGraph(dependencies, layers, refinements);
            
            result.buildIndices();
            
            // 4. 統合結果を返す
            return result;
            
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
     * Merge COP constructs (Layers, Refinements) into the dependency graph
     * @param {Object} graph - Dependency graph from BabelObjectDependencyDetector
     * @param {Array} layers - Detected layers
     * @param {Array} refinements - Detected refinements
     * @returns {Object} Enhanced graph with COP nodes and edges
     */
    mergeCOPIntoGraph(graph, layers, refinements) {
        const nodes = [...(graph.nodes || [])];
        const edges = [...(graph.edges || [])];
        
        // Build a map of layer names for quick lookup
        const layerNames = new Set(layers.map(l => l.name));
        
        // Remove Layer instance nodes that have corresponding Layer definitions
        // We'll replace them with Layer definition nodes
        const filteredNodes = nodes.filter(node => {
            if (node.data.type === 'instance' && node.data.className === 'Layer') {
                const instanceName = node.data.name;
                // Check if there's a Layer definition with this name
                if (layerNames.has(instanceName)) {
                    console.log(`[COPAnalyzer] Removing duplicate Layer instance: ${instanceName}`);
                    return false; // Remove this instance node
                }
            }
            return true;
        });
        
        // Update edges to point to Layer definition nodes instead of instance nodes
        const updatedEdges = edges.map(edge => {
            // If edge target is a Layer instance, redirect to Layer definition
            const targetNode = nodes.find(n => n.data.id === edge.data.target);
            if (targetNode && targetNode.data.type === 'instance' && targetNode.data.className === 'Layer') {
                const layerName = targetNode.data.name;
                if (layerNames.has(layerName)) {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            target: `Layer_${layerName}`
                        }
                    };
                }
            }
            return edge;
        });
        
        // Add Layer nodes (these replace the instance nodes)
        for (const layer of layers) {
            filteredNodes.push({
                data: {
                    id: `Layer_${layer.name}`,
                    label: layer.name,
                    name: layer.name,
                    type: 'layer',
                    file: this.filePath,
                    line: layer.line,
                    description: `Layer: ${layer.name}`,
                    condition: layer.condition,
                    conditionType: layer.conditionType
                }
            });
        }
        
        // Add Refinement nodes and edges
        for (const refinement of refinements) {
            const refType = refinement.type;
            
            if (refType === 'refinement_addPartialMethod') {
                const refId = `Refinement_${refinement.targetObject}_${refinement.methodName}`;
                
                // Add refinement node
                filteredNodes.push({
                    data: {
                        id: refId,
                        label: `${refinement.targetObject}.${refinement.methodName}`,
                        name: refinement.methodName,
                        type: 'refinement',
                        file: this.filePath,
                        line: refinement.line,
                        description: `Refinement: ${refinement.targetObject}.${refinement.methodName}()`
                    }
                });
                
                // Edge: Refinement → Layer
                if (refinement.layerObject) {
                    updatedEdges.push({
                        data: {
                            source: refId,
                            target: `Layer_${refinement.layerObject}`,
                            type: 'belongs_to_layer',
                            description: `Refinement belongs to layer ${refinement.layerObject}`
                        }
                    });
                }
                
                // Edge: Refinement → Method (original method)
                // Use dot notation to match existing method node IDs
                const methodId = `${refinement.targetObject}.${refinement.methodName}`;
                updatedEdges.push({
                    data: {
                        source: refId,
                        target: methodId,
                        type: 'refines',
                        description: `Refines ${refinement.targetObject}.${refinement.methodName}()`
                    }
                });
            }
        }
        
        return {
            nodes: filteredNodes,
            edges: updatedEdges,
            summary: {
                ...graph.summary,
                layers: layers.length,
                refinements: refinements.length
            }
        };
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
        return new COPAnalysisResult();
    }
}

module.exports = { COPAnalyzer };
