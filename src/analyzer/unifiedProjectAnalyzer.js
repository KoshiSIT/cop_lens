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
        
        // Update edges to point to Layer definition nodes
        const updatedEdges = allEdges.map(edge => {
            // Find if target is a removed Layer instance
            const targetIsRemovedInstance = allNodes.some(n => 
                n.data.id === edge.data.target && 
                n.data.type === 'instance' && 
                n.data.className === 'Layer' &&
                layerDefinitionNames.has(n.data.name)
            );
            
            if (targetIsRemovedInstance) {
                // Find the target node to get its name
                const targetNode = allNodes.find(n => n.data.id === edge.data.target);
                if (targetNode) {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            target: `Layer_${targetNode.data.name}`
                        }
                    };
                }
            }
            return edge;
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
