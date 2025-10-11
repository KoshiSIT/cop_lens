const { BabelLayerDetector } = require('../parser/babelLayerDetector');
const { BabelRefinementDetector } = require('../parser/babelRefinementDetector');
const { BabelObjectDependencyDetector } = require('../parser/babelObjectDependencyDetector');
const { COPAnalysisResult } = require('./copAnalysisResult');

/**
 * COPAnalyzer - Common analysis flow
 * 
 * Unified analyzer that serves as the foundation for all COP features (Hover, TreeView, Dependency Graph)
 * 
 * Responsibilities:
 * - Integrate and execute various Detectors
 * - Return analysis results in unified format
 * - Build symbol index
 */
class COPAnalyzer {
    constructor(filePath) {
        this.filePath = filePath;
        
        // Various Detectors
        this.layerDetector = new BabelLayerDetector();
        this.refinementDetector = new BabelRefinementDetector();
        this.dependencyDetector = new BabelObjectDependencyDetector();
    }
    
    /**
     * Analyze code and return unified results
     * @param {string} code - Code to analyze
     * @returns {Object} Unified analysis results
     */
    analyze(code) {
        // Handle null/undefined
        if (!code) {
            return this.createEmptyResult();
        }
        
        try {
            // Set current file path to each Detector
            this.layerDetector.setCurrentFile(this.filePath);
            this.refinementDetector.setCurrentFile(this.filePath);
            this.dependencyDetector.setCurrentFile(this.filePath);
            
            // 1. Detect various constructs
            const layers = this.layerDetector.detect(code);
            const refinements = this.refinementDetector.detect(code);
            const dependencies = this.dependencyDetector.detect(code);
            
            // 2. Integrate into COPAnalysisResult
            const result = new COPAnalysisResult();
            result.mergeLayerResults(layers);
            result.mergeRefinementResults(refinements);  // Classification happens here
            
            // 3. Merge Layer nodes into dependencies graph
            result.dependencies = this.mergeCOPIntoGraph(dependencies, layers, refinements);
            
            result.buildIndices();
            
            // 4. Return integrated result
            return result;
            
        } catch (error) {
            // Do not throw exceptions even on syntax errors
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
                
                // Get target method code
                const methodKey = `${refinement.targetObject}.${refinement.methodName}`;
                let targetMethodCode = null;
                let targetMethodLine = null;
                let targetMethodFile = null;
                
                // Try to find the method in classes
                const targetClass = this.result.classes?.find(c => c.name === refinement.targetObject);
                if (targetClass && targetClass.methodsMap) {
                    const method = targetClass.methodsMap[refinement.methodName];
                    if (method) {
                        targetMethodCode = method.code;
                        targetMethodLine = method.line;
                        targetMethodFile = method.file;
                    }
                }
                
                // Add refinement node
                filteredNodes.push({
                    data: {
                        id: refId,
                        label: `${refinement.targetObject}.${refinement.methodName}`,
                        name: refinement.methodName,
                        type: 'refinement',
                        file: this.filePath,
                        line: refinement.line,
                        description: `Refinement: ${refinement.targetObject}.${refinement.methodName}()`,
                        implementationCode: refinement.implementationCode || null,
                        targetObject: refinement.targetObject,
                        methodName: refinement.methodName,
                        layerObject: refinement.layerObject,
                        targetMethodCode: targetMethodCode,
                        targetMethodLine: targetMethodLine,
                        targetMethodFile: targetMethodFile
                    }
                });
                
                // Edge: Layer → Refinement (layer has this refinement)
                if (refinement.layerObject) {
                    updatedEdges.push({
                        data: {
                            source: `Layer_${refinement.layerObject}`,
                            target: refId,
                            type: 'has_refinement',
                            description: `Layer ${refinement.layerObject} defines this refinement`
                        }
                    });
                }
                
                // Edge: Method → Refinement (method is refined by this refinement)
                // Use dot notation to match existing method node IDs
                const methodId = `${refinement.targetObject}.${refinement.methodName}`;
                updatedEdges.push({
                    data: {
                        source: methodId,
                        target: refId,
                        type: 'refined_by',
                        description: `${refinement.targetObject}.${refinement.methodName}() is refined by this layer`
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
     * Build symbol index
     * Sorted by line number for fast position-based search
     * 
     * @param {Array} layers - Layer information
     * @param {Array} refinements - Refinement information
     * @param {Object} dependencies - Dependency information
     * @returns {Array} Sorted symbol index
     */
    buildSymbolIndex(layers, refinements, dependencies) {
        const symbols = [];
        
        // Add layers to symbols
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
        
        // Add refinements to symbols
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
        
        // Add dependency nodes to symbols
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
        
        // Sort by line number
        symbols.sort((a, b) => (a.line || 0) - (b.line || 0));
        
        return symbols;
    }
    
    /**
     * Generate empty analysis result
     * @returns {Object} Empty analysis result
     */
    createEmptyResult() {
        return new COPAnalysisResult();
    }
}

module.exports = { COPAnalyzer };
