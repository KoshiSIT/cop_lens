const { COPAnalyzer } = require('./copAnalyzer');
const { FileCollector } = require('../utils/fileCollector');
const { BabelObjectDependencyDetector } = require('../parser/babelObjectDependencyDetector');
const fs = require('fs');

/**
 * UnifiedProjectAnalyzer - プロジェクト全体の統合解析
 * 
 * 責務:
 * - プロジェクト全体のファイルを収集
 * - 各ファイルをCOPAnalyzerで解析
 * - 依存グラフを構築
 * - GlobalCOPDataStoreに保存する形式で結果を返す
 */
class UnifiedProjectAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.fileCollector = new FileCollector(projectRoot);
    }

    /**
     * プロジェクト全体を解析
     * @returns {Object} { fileResults: Map, dependencyGraph: Object }
     */
    async analyzeProject(store = null) {
        console.log(`[UnifiedAnalyzer] Analyzing project: ${this.projectRoot}`);
        
        // Step 1: ファイル収集
        const jsFiles = this.fileCollector.collectAllJavaScriptFiles();
        console.log(`[UnifiedAnalyzer] Found ${jsFiles.length} JavaScript files`);
        
        if (jsFiles.length === 0) {
            return this.createEmptyResult();
        }

        // Step 2: 各ファイルのCOP構文解析
        const fileResults = new Map();
        const errors = [];
        let successCount = 0;
        
        for (const file of jsFiles) {
            try {
                const code = fs.readFileSync(file, 'utf8');
                const copAnalyzer = new COPAnalyzer(file);
                const result = copAnalyzer.analyze(code);
                fileResults.set(file, result);
                successCount++;
                
                // If store is provided, save results immediately
                if (store) {
                    store.updateFile(file, result);
                }
            } catch (error) {
                console.error(`[UnifiedAnalyzer] Error analyzing ${file}:`, error.message);
                errors.push({ file, error: error.message });
                // エラーでもスキップして続行
            }
        }
        
        // エラーサマリーをログ出力
        if (errors.length > 0) {
            console.warn(`[UnifiedAnalyzer] ${errors.length} files failed to analyze`);
            console.warn(`[UnifiedAnalyzer] Successfully analyzed: ${successCount}/${jsFiles.length}`);
        }

        // Step 3: 依存グラフの構築
        const dependencyGraph = await this.buildDependencyGraph(fileResults);
        
        // If store is provided, save dependency graph
        if (store) {
            store.setDependencyGraph(dependencyGraph);
        }

        console.log(`[UnifiedAnalyzer] Analysis complete: ${fileResults.size} files analyzed`);

        return {
            fileResults,
            dependencyGraph
        };
    }

    /**
     * 依存グラフを構築
     * @param {Map} fileResults - ファイルごとの解析結果
     * @returns {Object} 統合された依存グラフ
     */
    async buildDependencyGraph(fileResults) {
        const allNodes = [];
        const allEdges = [];
        
        // 各ファイルの依存グラフをマージ
        for (const [filePath, result] of fileResults) {
            if (result.dependencies) {
                // ノードを追加（重複チェック）
                if (result.dependencies.nodes) {
                    for (const node of result.dependencies.nodes) {
                        // ファイルパスとIDの組み合わせで一意性を判定
                        const uniqueId = `${filePath}::${node.data.id}`;
                        const exists = allNodes.some(n => {
                            const existingUniqueId = `${n.data.filePath}::${n.data.id}`;
                            return existingUniqueId === uniqueId;
                        });
                        
                        if (!exists) {
                            // ノードにファイル情報を追加
                            const enhancedNode = {
                                ...node,
                                data: {
                                    ...node.data,
                                    filePath,
                                    fileUri: `file://${filePath}`
                                }
                            };
                            allNodes.push(enhancedNode);
                        }
                    }
                }
                
                // エッジを追加（重複チェック）
                if (result.dependencies.edges) {
                    for (const edge of result.dependencies.edges) {
                        const exists = allEdges.some(e => 
                            e.data.source === edge.data.source && 
                            e.data.target === edge.data.target &&
                            e.data.type === edge.data.type
                        );
                        if (!exists) {
                            allEdges.push(edge);
                        }
                    }
                }
            }
        }

        // Remove duplicate Layer instance nodes
        // If a Layer definition node exists with the same name, remove the instance node
        const layerDefinitionNames = new Set(
            allNodes.filter(n => n.data.type === 'layer').map(n => n.data.name)
        );
        
        const filteredNodes = allNodes.filter(node => {
            if (node.data.type === 'instance' && node.data.className === 'Layer') {
                const instanceName = node.data.name;
                if (layerDefinitionNames.has(instanceName)) {
                    console.log(`[UnifiedAnalyzer] Removing duplicate Layer instance: ${instanceName}`);
                    return false;
                }
            }
            return true;
        });
        
        // Get IDs of removed Layer instance nodes
        const removedLayerInstanceIds = new Set();
        allNodes.forEach(node => {
            if (node.data.type === 'instance' && 
                node.data.className === 'Layer' &&
                layerDefinitionNames.has(node.data.name)) {
                removedLayerInstanceIds.add(node.data.id);
            }
        });
        
        // Update edges: redirect from/to removed Layer instances to Layer definition nodes
        const updatedEdgesStep1 = allEdges.map(edge => {
            let newEdge = edge;
            
            // If source is a removed Layer instance, redirect to Layer definition
            if (removedLayerInstanceIds.has(edge.data.source)) {
                const sourceNode = allNodes.find(n => n.data.id === edge.data.source);
                if (sourceNode && layerDefinitionNames.has(sourceNode.data.name)) {
                    console.log(`[UnifiedAnalyzer] Redirecting edge source: ${edge.data.source} → Layer_${sourceNode.data.name}`);
                    newEdge = {
                        ...newEdge,
                        data: {
                            ...newEdge.data,
                            source: `Layer_${sourceNode.data.name}`
                        }
                    };
                }
            }
            
            // If target is a removed Layer instance, redirect to Layer definition
            if (removedLayerInstanceIds.has(edge.data.target)) {
                const targetNode = allNodes.find(n => n.data.id === edge.data.target);
                if (targetNode && layerDefinitionNames.has(targetNode.data.name)) {
                    console.log(`[UnifiedAnalyzer] Redirecting edge target: ${edge.data.target} → Layer_${targetNode.data.name}`);
                    newEdge = {
                        ...newEdge,
                        data: {
                            ...newEdge.data,
                            target: `Layer_${targetNode.data.name}`
                        }
                    };
                }
            }
            
            return newEdge;
        });
        
        // Remove duplicate edges after redirection
        const updatedEdges = updatedEdgesStep1.filter((edge, index, self) => {
            // Check if this edge is a duplicate
            const isDuplicate = self.findIndex(e => 
                e.data.source === edge.data.source &&
                e.data.target === edge.data.target &&
                e.data.type === edge.data.type
            ) !== index;
            
            return !isDuplicate;
        });

        // サマリーを計算
        const summary = {
            totalNodes: filteredNodes.length,
            totalEdges: updatedEdges.length,
            classes: filteredNodes.filter(n => n.data.type === 'class').length,
            instances: filteredNodes.filter(n => n.data.type === 'instance').length,
            layers: filteredNodes.filter(n => n.data.type === 'layer').length,
            dependencies: updatedEdges.length
        };

        return {
            nodes: filteredNodes,
            edges: updatedEdges,
            summary
        };
    }

    /**
     * 空の結果を作成
     */
    createEmptyResult() {
        return {
            fileResults: new Map(),
            dependencyGraph: {
                nodes: [],
                edges: [],
                summary: {
                    totalNodes: 0,
                    totalEdges: 0,
                    classes: 0,
                    instances: 0,
                    dependencies: 0
                }
            }
        };
    }
}

module.exports = { UnifiedProjectAnalyzer };
