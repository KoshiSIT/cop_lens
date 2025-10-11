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
    constructor(filePath, globalStore = null) {
        this.filePath = filePath;
        this.globalStore = globalStore;
        
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
        
        // Extract deploy calls from refinements
        const deployCalls = refinements.filter(r => r.type === 'refinement_deploy');
        console.log(`[COPAnalyzer] Found ${deployCalls.length} deploy calls`);
        
        // Build a map of layer definitions by variable name
        const layerDefsByVarName = new Map();
        layers.forEach(layer => {
            layerDefsByVarName.set(layer.name, layer);
        });
        
        // Build a set of deployed layer variable names
        const deployedLayerNames = new Set();
        deployCalls.forEach(deploy => {
            if (deploy.layerReference?.type === 'variable') {
                const varName = deploy.layerReference.name;
                if (layerDefsByVarName.has(varName)) {
                    deployedLayerNames.add(varName);
                    console.log(`[COPAnalyzer] Layer "${varName}" is deployed`);
                } else {
                    console.log(`[COPAnalyzer] Warning: deploy(${varName}) but layer definition not found`);
                }
            }
        });
        
        // Only process deployed layers
        const deployedLayers = layers.filter(l => deployedLayerNames.has(l.name));
        console.log(`[COPAnalyzer] ${deployedLayers.length}/${layers.length} layers are deployed`);
        
        // Build a map of deployed layer names for quick lookup
        const layerNames = new Set(deployedLayers.map(l => l.name));
        
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
        
        // Add Layer nodes (only deployed layers)
        for (const layer of deployedLayers) {
            const nodeId = `Layer_${layer.name}`;
            
            // Use layerName (from 'name' property) if available, otherwise use variable name
            const displayName = layer.layerName || layer.name;
            
            filteredNodes.push({
                data: {
                    id: nodeId,
                    label: displayName,
                    name: layer.name,  // Variable name
                    layerName: displayName,  // Layer name (from 'name' property)
                    type: 'layer',
                    file: this.filePath,
                    line: layer.line,
                    description: `Layer: ${displayName}`,
                    condition: layer.condition,
                    conditionType: layer.conditionType,
                    hasOnEnter: !!layer.onEnter,
                    hasOnExit: !!layer.onExit
                }
            });
            
            console.log(`[COPAnalyzer] Added deployed layer node: ${nodeId} (${displayName})`);
        }
        
        // Add Refinement nodes and edges
        console.log(`[COPAnalyzer] Processing ${refinements.length} refinements`);
        for (const refinement of refinements) {
            const refType = refinement.type;
            console.log(`[COPAnalyzer] Processing refinement:`, refType, refinement.targetObject, refinement.methodName);
            
            if (refType === 'refinement_addPartialMethod') {
                const refId = `Refinement_${refinement.targetObject}_${refinement.methodName}`;
                
                // Get target method code
                const methodKey = `${refinement.targetObject}.${refinement.methodName}`;
                let targetMethodCode = null;
                let targetMethodLine = null;
                let targetMethodFile = null;
                
                // Try to find the method in graph nodes (same file)
                const targetClassNode = graph.nodes?.find(n => 
                    n.data.type === 'class' && 
                    n.data.name === refinement.targetObject
                );
                
                if (targetClassNode && targetClassNode.data.methodsMap) {
                    const method = targetClassNode.data.methodsMap[refinement.methodName];
                    if (method) {
                        targetMethodCode = method.code;
                        targetMethodLine = method.line;
                        targetMethodFile = method.file;
                    }
                }
                
                // Note: GlobalStore is not yet populated during initial analysis
                // Target method code will be added later by extension.js before display
                if (!targetMethodCode) {
                    console.log(`[COPAnalyzer] Target class ${refinement.targetObject} not in current file, will be resolved from GlobalStore later`);
                }
                
                // Determine layer variable name from reference
                let layerVarName = null;
                if (refinement.layerReference) {
                    if (refinement.layerReference.type === 'variable') {
                        layerVarName = refinement.layerReference.name;
                    }
                } else if (refinement.layerObject) {
                    // Fallback to old property for backward compatibility
                    layerVarName = refinement.layerObject;
                }
                
                // Get layer display name if available
                let layerDisplayName = layerVarName;
                if (layerVarName && layerDefsByVarName.has(layerVarName)) {
                    const layerDef = layerDefsByVarName.get(layerVarName);
                    layerDisplayName = layerDef.layerName || layerVarName;
                }
                
                // Add refinement node
                console.log(`[COPAnalyzer] Adding refinement node: ${refId}`);
                console.log(`[COPAnalyzer] Target method code found:`, !!targetMethodCode);
                console.log(`[COPAnalyzer] Code length:`, targetMethodCode?.length || 0);
                console.log(`[COPAnalyzer] Target file:`, targetMethodFile);
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
                        layerObject: layerVarName,  // Variable name
                        layerName: layerDisplayName,  // Display name (from 'name' property)
                        targetMethodCode: targetMethodCode,
                        targetMethodLine: targetMethodLine,
                        targetMethodFile: targetMethodFile
                    }
                });
                
                // Edge: Layer → Refinement (layer has this refinement)
                if (layerVarName) {
                    // Check if this layer is deployed
                    if (deployedLayerNames.has(layerVarName)) {
                        updatedEdges.push({
                            data: {
                                source: `Layer_${layerVarName}`,
                                target: refId,
                                type: 'has_refinement',
                                description: `Layer ${layerVarName} defines this refinement`
                            }
                        });
                        console.log(`[COPAnalyzer] Linked refinement to deployed layer: ${layerVarName}`);
                    } else {
                        console.log(`[COPAnalyzer] Warning: Refinement references non-deployed layer: ${layerVarName}`);
                        // Don't create edge to non-existent layer node
                    }
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
