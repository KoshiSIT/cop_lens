/**
 * GlobalCOPDataStore - Manages COP information for entire project
 * 
 * Responsibilities:
 * - Store analysis results for entire project
 * - Incrementally update on file save/update
 * - Provide interface for features to retrieve data
 */
class GlobalCOPDataStore {
    constructor() {
        // Analysis results per file path
        this.fileAnalysisResults = new Map(); // filePath -> COPAnalyzer result
        
        // Unified index (searchable across all files)
        this.globalSymbolIndex = []; // All symbols (sorted)
        
        // Project root
        this.projectRoot = null;
        
        // Dependency graph (entire project)
        this.dependencyGraph = null;
    }

    /**
     * Set project root
     */
    setProjectRoot(projectRoot) {
        this.projectRoot = projectRoot;
    }

    /**
     * Check if project has changed
     * @param {string} newProjectRoot - New project root
     * @returns {boolean} true if project has changed
     */
    hasProjectChanged(newProjectRoot) {
        return this.projectRoot !== null && this.projectRoot !== newProjectRoot;
    }

    /**
     * Clear store (when switching to new project)
     */
    clear() {
        console.log('[GlobalStore] Clearing all data for new project');
        this.fileAnalysisResults.clear();
        this.globalSymbolIndex = [];
        this.dependencyGraph = null;
        // Do not clear projectRoot (will be overwritten by next setProjectRoot)
    }

    /**
     * Add/update file analysis result
     * @param {string} filePath - File path
     * @param {Object} analysisResult - Analysis result from COPAnalyzer
     */
    updateFile(filePath, analysisResult) {
        this.fileAnalysisResults.set(filePath, analysisResult);
        this.rebuildIndices();
    }

    /**
     * Delete file analysis result
     * @param {string} filePath - File path
     */
    removeFile(filePath) {
        this.fileAnalysisResults.delete(filePath);
        this.rebuildIndices();
    }

    /**
     * Rebuild all indices
     */
    rebuildIndices() {
        // Rebuild global symbol index
        this.globalSymbolIndex = [];
        
        for (const [filePath, result] of this.fileAnalysisResults) {
            if (result.symbolIndex) {
                // Add file information to each symbol
                result.symbolIndex.forEach(symbol => {
                    this.globalSymbolIndex.push({
                        ...symbol,
                        filePath,
                        fileUri: `file://${filePath}`
                    });
                });
            }
        }
        
        // Sort by line number (within same file)
        this.globalSymbolIndex.sort((a, b) => {
            if (a.filePath !== b.filePath) {
                return a.filePath.localeCompare(b.filePath);
            }
            return (a.line || 0) - (b.line || 0);
        });
    }

    /**
     * Update dependency graph
     * @param {Object} dependencyGraph - Dependency graph from ProjectAnalyzer
     */
    setDependencyGraph(dependencyGraph) {
        this.dependencyGraph = dependencyGraph;
    }

    /**
     * Search for entity at specified position
     * @param {string} filePath - File path
     * @param {Object} position - {line, character}
     * @returns {Object|null} Entity
     */
    findEntityAt(filePath, position) {
        const result = this.fileAnalysisResults.get(filePath);
        if (!result || !result.symbolIndex) {
            return null;
        }

        const targetLine = position.line + 1; // VSCode is 0-indexed, AST is 1-indexed
        return this.binarySearchSymbol(result.symbolIndex, targetLine);
    }

    /**
     * Search for symbol using binary search (optimized)
     * @param {Array} symbols - Sorted symbol array
     * @param {number} targetLine - Target line number for search
     * @returns {Object|null} Found symbol or null
     */
    binarySearchSymbol(symbols, targetLine) {
        if (!symbols || symbols.length === 0) {
            return null;
        }

        // First search for exact match (binary search)
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
        
        // If no exact match, check range
        // Search for symbol with range containing targetLine
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
     * Get all Entities in specified file
     * @param {string} filePath - File path
     * @returns {Array} Array of Entities
     */
    getEntitiesForFile(filePath) {
        const result = this.fileAnalysisResults.get(filePath);
        if (!result || !result.symbolIndex) {
            return [];
        }
        return result.symbolIndex;
    }

    /**
     * Get analysis result for specified file
     * @param {string} filePath - File path
     * @returns {Object|null} Analysis result
     */
    getFileAnalysis(filePath) {
        return this.fileAnalysisResults.get(filePath) || null;
    }

    /**
     * Get dependency graph
     * @returns {Object|null} Dependency graph
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
     * Get all Layer definitions (entire project)
     * @returns {Array} Array of Layers
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
     * Get all Refinement definitions (entire project)
     * @returns {Array} Array of Refinements
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
     * Search for Layer by name (entire project)
     * @param {string} layerName - Layer name
     * @returns {Object|null} Layer definition
     */
    findLayerByName(layerName) {
        const layers = this.getAllLayers();
        return layers.find(layer => layer.name === layerName || layer.layerName === layerName) || null;
    }

    /**
     * Get statistics
     * @returns {Object} Statistics
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
     * Clear store
     */
    clear() {
        this.fileAnalysisResults.clear();
        this.globalSymbolIndex = [];
        this.dependencyGraph = null;
    }
}

module.exports = { GlobalCOPDataStore };
