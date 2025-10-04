const { BabelBaseDetector } = require("./babelBaseDetector");

/**
 * Babel-based Refinement Detector
 * Detects EMA refinement operations: exhibit(), addPartialMethod(), deploy()
 */
class BabelRefinementDetector extends BabelBaseDetector {
    /**
     * Get Babel visitor object
     * @param {Array} results - Array to collect results
     * @returns {Object} Visitor object
     */
    getVisitors(results) {
        return {
            CallExpression: (path) => {
                const callExpr = path.node;
                
                // Check if it's an EMA method call
                if (callExpr.callee.type === 'MemberExpression' &&
                    callExpr.callee.object.name === 'EMA') {
                    
                    // Verify this is EMAjs (optional check - commented out for flexibility)
                    // if (!this.isFromEMAjs(path, 'EMA')) {
                    //     return;
                    // }
                    
                    const methodName = callExpr.callee.property.name;
                    
                    switch (methodName) {
                        case 'exhibit':
                            const exhibitInfo = this.extractExhibit(path);
                            if (exhibitInfo) results.push(exhibitInfo);
                            break;
                            
                        case 'addPartialMethod':
                            const partialInfo = this.extractAddPartialMethod(path);
                            if (partialInfo) results.push(partialInfo);
                            break;
                            
                        case 'deploy':
                            const deployInfo = this.extractDeploy(path);
                            if (deployInfo) results.push(deployInfo);
                            break;
                    }
                }
                
                // Check for Layer.proceed()
                if (callExpr.callee.type === 'MemberExpression' &&
                    callExpr.callee.object.name === 'Layer' &&
                    callExpr.callee.property.name === 'proceed') {
                    
                    // Optional: verify from EMAjs
                    // if (this.isFromEMAjs(path, 'Layer')) {
                        const proceedInfo = this.extractProceed(path);
                        if (proceedInfo) results.push(proceedInfo);
                    // }
                }
            }
        };
    }

    /**
     * Extract EMA.exhibit information
     * @param {Object} path - Babel path object
     * @returns {Object|null} Exhibit information
     */
    extractExhibit(path) {
        const args = path.node.arguments;
        
        if (args.length < 2) return null;
        
        const targetObject = args[0].name || null;
        if (!targetObject) return null;
        
        const mappings = this.extractPropertyMappings(args[1]);
        if (!mappings) return null;
        
        return {
            type: "refinement_exhibit",
            targetObject: targetObject,
            mappings: mappings,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Extract property mappings from object expression
     * @param {Object} objNode - ObjectExpression node
     * @returns {Array|null} Array of property mappings
     */
    extractPropertyMappings(objNode) {
        if (objNode.type !== 'ObjectExpression') return null;
        
        const mappings = [];
        
        for (const prop of objNode.properties) {
            if (prop.type === 'ObjectProperty') {
                const key = prop.key.name || prop.key.value;
                
                // Handle different value types
                let value = null;
                if (prop.value.type === 'Identifier') {
                    value = prop.value.name;
                } else if (prop.value.type === 'MemberExpression') {
                    // screen.gyroscope → "screen.gyroscope"
                    value = this.getMemberExpressionName(prop.value);
                } else if (prop.value.type === 'Literal') {
                    value = prop.value.value;
                }
                
                if (key && value) {
                    mappings.push({ key, value });
                }
            }
        }
        
        return mappings.length > 0 ? mappings : null;
    }
    
    /**
     * Get full name of MemberExpression (e.g., "screen.gyroscope")
     * @param {Object} node - MemberExpression node
     * @returns {string} Full member expression name
     */
    getMemberExpressionName(node) {
        if (node.type === 'Identifier') {
            return node.name;
        }
        if (node.type === 'MemberExpression') {
            const object = this.getMemberExpressionName(node.object);
            const property = node.property.name;
            return `${object}.${property}`;
        }
        return '';
    }

    /**
     * Extract EMA.addPartialMethod information
     * @param {Object} path - Babel path object
     * @returns {Object|null} AddPartialMethod information
     */
    extractAddPartialMethod(path) {
        const args = path.node.arguments;
        
        if (args.length < 4) return null;
        
        // Argument 1: Layer object
        const layerObject = args[0].name || null;
        if (!layerObject) return null;
        
        // Argument 2: Target object
        const targetObject = args[1].name || null;
        if (!targetObject) return null;
        
        // Argument 3: Method name
        const methodName = args[2].value || null;
        if (!methodName) return null;
        
        // Argument 4: Implementation
        const hasImplementation = this.isFunctionLike(args[3]);
        
        return {
            type: "refinement_addPartialMethod",
            layerObject,
            targetObject,
            methodName,
            hasImplementation,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Extract EMA.deploy information
     * @param {Object} path - Babel path object
     * @returns {Object|null} Deploy information
     */
    extractDeploy(path) {
        const args = path.node.arguments;
        
        if (args.length < 1) return null;
        
        const layerObject = args[0].name || null;
        if (!layerObject) return null;
        
        return {
            type: "refinement_deploy",
            layerObject,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Extract Layer.proceed information
     * @param {Object} path - Babel path object
     * @returns {Object|null} Proceed information
     */
    extractProceed(path) {
        return {
            type: "refinement_proceed",
            argumentCount: path.node.arguments.length,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Check if node is function-like
     * @param {Object} node - AST node
     * @returns {boolean} True if function-like
     */
    isFunctionLike(node) {
        return node.type === 'FunctionExpression' || 
               node.type === 'ArrowFunctionExpression';
    }
}

module.exports = { BabelRefinementDetector };
