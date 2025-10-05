const { BabelBaseDetector } = require("./babelBaseDetector");

/**
 * Symbol groups for COP constructs
 */
const SymbolGroup = {
    LAYER: 'layer',
    TARGET: 'target',
    EMA_API: 'ema-api',
    SIGNAL: 'signal'
};

/**
 * Symbol roles within groups
 */
const SymbolRole = {
    // Layer group
    LAYER_DEFINITION: 'layer-definition',
    LAYER_REFERENCE: 'layer-reference',
    
    // Target group
    TARGET_OBJECT: 'target-object',
    TARGET_METHOD: 'target-method',
    
    // EMA API group
    EMA_OBJECT: 'ema-object',
    EMA_METHOD: 'ema-method',
    
    // Signal group
    SIGNAL_DEFINITION: 'signal-definition',
    SIGNAL_REFERENCE: 'signal-reference'
};

/**
 * Unified Symbol Detector for COP constructs
 * Detects all symbols with their positions, groups, and roles
 */
class BabelSymbolDetector extends BabelBaseDetector {
    /**
     * Get Babel visitor object
     * @param {Array} results - Array to collect symbol results
     * @returns {Object} Visitor object
     */
    getVisitors(results) {
        return {
            // Layer definitions: new Layer("name") or { condition: "..." }
            NewExpression: (path) => {
                if (path.node.callee.name === 'Layer') {
                    this.detectLayerDefinition(path, results);
                }
                
                if (path.node.callee.name === 'Signal') {
                    this.detectSignalDefinition(path, results);
                }
            },
            
            VariableDeclarator: (path) => {
                if (path.node.init?.type === 'ObjectExpression') {
                    if (this.isLayerObject(path.node.init)) {
                        this.detectLayerDefinition(path, results);
                    }
                }
            },
            
            // EMA API calls
            CallExpression: (path) => {
                const callExpr = path.node;
                
                // EMA.method() calls
                if (callExpr.callee.type === 'MemberExpression' &&
                    callExpr.callee.object.name === 'EMA') {
                    
                    this.detectEMAAPICall(path, results);
                }
            },
            
            // Generic identifier tracking for references
            Identifier: (path) => {
                // Skip if this identifier is being defined (not a reference)
                if (path.parent.type === 'VariableDeclarator' && path.parent.id === path.node) {
                    return;
                }
                
                // Skip object keys
                if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) {
                    return;
                }
                
                // Track potential layer/signal references
                this.detectIdentifierReference(path, results);
            }
        };
    }

    /**
     * Detect layer definition and create symbol
     * @param {Object} path - Babel path
     * @param {Array} results - Results array
     */
    detectLayerDefinition(path, results) {
        let layerName = null;
        let node = null;
        
        if (path.node.type === 'NewExpression') {
            // new Layer("landscape")
            const varDeclarator = path.parentPath.node;
            layerName = varDeclarator.id?.name;
            node = varDeclarator.id; // Point to variable name (not "Layer" keyword)
        } else {
            // const landscape = { condition: "..." }
            layerName = path.node.id?.name;
            node = path.node.id; // Point to variable name
        }
        
        if (!layerName || !node) return;
        
        results.push({
            text: layerName,
            group: SymbolGroup.LAYER,
            role: SymbolRole.LAYER_DEFINITION,
            range: {
                start: node.start,
                end: node.end
            },
            line: node.loc.start.line,
            metadata: {
                definitionType: path.node.type === 'NewExpression' ? 'constructor' : 'object-literal'
            }
        });
    }

    /**
     * Detect Signal definition
     * @param {Object} path - Babel path
     * @param {Array} results - Results array
     */
    detectSignalDefinition(path, results) {
        const varDeclarator = path.parentPath.node;
        const signalName = varDeclarator.id?.name;
        
        if (!signalName) return;
        
        results.push({
            text: signalName,
            group: SymbolGroup.SIGNAL,
            role: SymbolRole.SIGNAL_DEFINITION,
            range: {
                start: path.node.callee.start,
                end: path.node.callee.end
            },
            line: path.node.loc.start.line,
            metadata: {
                initialValue: path.node.arguments[0]?.value
            }
        });
    }

    /**
     * Detect EMA API call and extract symbols
     * @param {Object} path - Babel path
     * @param {Array} results - Results array
     */
    detectEMAAPICall(path, results) {
        const callExpr = path.node;
        const methodName = callExpr.callee.property.name;
        
        // Add EMA object symbol
        results.push({
            text: 'EMA',
            group: SymbolGroup.EMA_API,
            role: SymbolRole.EMA_OBJECT,
            range: {
                start: callExpr.callee.object.start,
                end: callExpr.callee.object.end
            },
            line: callExpr.loc.start.line,
            metadata: {
                method: methodName
            }
        });
        
        // Add EMA method symbol
        results.push({
            text: methodName,
            group: SymbolGroup.EMA_API,
            role: SymbolRole.EMA_METHOD,
            range: {
                start: callExpr.callee.property.start,
                end: callExpr.callee.property.end
            },
            line: callExpr.loc.start.line,
            metadata: {
                apiType: methodName
            }
        });
        
        // Extract target objects and methods based on API type
        const args = callExpr.arguments;
        
        switch (methodName) {
            case 'exhibit':
                if (args[0]?.name) {
                    this.addTargetSymbol(args[0], results, 'exhibit');
                }
                break;
                
            case 'addPartialMethod':
                // Layer reference (arg 0)
                if (args[0]?.name) {
                    this.addLayerReference(args[0], results);
                }
                // Target object (arg 1)
                if (args[1]?.name) {
                    this.addTargetSymbol(args[1], results, 'addPartialMethod');
                }
                // Method name (arg 2)
                if (args[2]?.value) {
                    this.addTargetMethod(args[2], results);
                }
                break;
                
            case 'deploy':
                // Layer reference
                if (args[0]?.name) {
                    this.addLayerReference(args[0], results);
                }
                break;
        }
    }

    /**
     * Add layer reference symbol
     * @param {Object} node - AST node
     * @param {Array} results - Results array
     */
    addLayerReference(node, results) {
        results.push({
            text: node.name,
            group: SymbolGroup.LAYER,
            role: SymbolRole.LAYER_REFERENCE,
            range: {
                start: node.start,
                end: node.end
            },
            line: node.loc.start.line,
            metadata: {}
        });
    }

    /**
     * Add target object symbol
     * @param {Object} node - AST node
     * @param {Array} results - Results array
     * @param {string} context - Usage context (exhibit, addPartialMethod)
     */
    addTargetSymbol(node, results, context) {
        results.push({
            text: node.name,
            group: SymbolGroup.TARGET,
            role: SymbolRole.TARGET_OBJECT,
            range: {
                start: node.start,
                end: node.end
            },
            line: node.loc.start.line,
            metadata: {
                context
            }
        });
    }

    /**
     * Add target method symbol
     * @param {Object} node - AST node (StringLiteral)
     * @param {Array} results - Results array
     */
    addTargetMethod(node, results) {
        results.push({
            text: node.value,
            group: SymbolGroup.TARGET,
            role: SymbolRole.TARGET_METHOD,
            range: {
                start: node.start,
                end: node.end
            },
            line: node.loc.start.line,
            metadata: {}
        });
    }

    /**
     * Detect identifier references (layer/signal usage)
     * @param {Object} path - Babel path
     * @param {Array} results - Results array
     */
    detectIdentifierReference(path, results) {
        // Check if this identifier references a layer or signal
        const name = path.node.name;
        const binding = path.scope.getBinding(name);
        
        if (!binding) return;
        
        // Check if it's a layer or signal by examining the binding
        const declarator = binding.path.node;
        
        // Check for new Layer() or new Signal()
        if (declarator.init?.type === 'NewExpression') {
            const constructorName = declarator.init.callee.name;
            
            if (constructorName === 'Layer') {
                results.push({
                    text: name,
                    group: SymbolGroup.LAYER,
                    role: SymbolRole.LAYER_REFERENCE,
                    range: {
                        start: path.node.start,
                        end: path.node.end
                    },
                    line: path.node.loc.start.line,
                    metadata: {
                        referencesSymbol: name
                    }
                });
            } else if (constructorName === 'Signal') {
                results.push({
                    text: name,
                    group: SymbolGroup.SIGNAL,
                    role: SymbolRole.SIGNAL_REFERENCE,
                    range: {
                        start: path.node.start,
                        end: path.node.end
                    },
                    line: path.node.loc.start.line,
                    metadata: {
                        referencesSymbol: name
                    }
                });
            }
        }
    }

    /**
     * Check if object expression is a layer object
     * @param {Object} objectExpr - ObjectExpression node
     * @returns {boolean} True if this is a layer object
     */
    isLayerObject(objectExpr) {
        const propNames = objectExpr.properties.map(p => p.key?.name).filter(Boolean);
        return propNames.includes('condition');
    }
}

module.exports = { 
    BabelSymbolDetector,
    SymbolGroup,
    SymbolRole
};
