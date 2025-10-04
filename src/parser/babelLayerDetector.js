const { BabelBaseDetector } = require("./babelBaseDetector");

/**
 * Babel-based Layer Detector
 * Detects both object literal layers and new Layer() constructor patterns
 */
class BabelLayerDetector extends BabelBaseDetector {
    /**
     * Get Babel visitor object
     * @param {Array} results - Array to collect results
     * @returns {Object} Visitor object
     */
    getVisitors(results) {
        return {
            // Detect: new Layer("name")
            NewExpression: (path) => {
                if (path.node.callee.name === 'Layer') {
                    // Check if this is EMAjs Layer
                    if (this.isFromEMAjs(path, 'Layer')) {
                        const layerInfo = this.extractLayerFromConstructor(path);
                        if (layerInfo) {
                            results.push(layerInfo);
                        }
                    }
                }
            },
            
            // Detect: { condition: "...", enter: ..., exit: ... }
            VariableDeclarator: (path) => {
                if (path.node.init?.type === 'ObjectExpression') {
                    if (this.isLayerObject(path.node.init)) {
                        const layerInfo = this.extractLayerFromObject(path);
                        if (layerInfo) {
                            results.push(layerInfo);
                        }
                    }
                }
            }
        };
    }

    /**
     * Extract layer info from new Layer() constructor
     * @param {Object} path - Babel path object
     * @returns {Object|null} Layer info
     */
    extractLayerFromConstructor(path) {
        const varDeclarator = path.parentPath.node;
        const varName = varDeclarator.id?.name || 'anonymous';
        const constructorArg = path.node.arguments[0]?.value || varName;
        
        return {
            name: varName,
            layerName: constructorArg,
            condition: "defined separately",
            conditionType: "external",
            type: "layer",
            constructorStyle: true,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Check if object expression is a layer object
     * @param {Object} objectExpr - ObjectExpression node
     * @returns {boolean} True if this is a layer object
     */
    isLayerObject(objectExpr) {
        const propNames = objectExpr.properties.map(p => p.key?.name).filter(Boolean);
        
        // Must have 'condition' property
        if (!propNames.includes('condition')) {
            return false;
        }
        
        // Get condition value
        const conditionProp = objectExpr.properties.find(p => p.key?.name === 'condition');
        if (!conditionProp) {
            return false;
        }
        
        const conditionValue = this.getConditionValue(conditionProp.value);
        
        // Reject if unknown/invalid
        if (conditionValue === "unknown" || conditionValue.trim() === "") {
            return false;
        }
        
        return true;
    }

    /**
     * Extract layer info from object literal
     * @param {Object} path - Babel path object
     * @returns {Object|null} Layer info
     */
    extractLayerFromObject(path) {
        const varName = path.node.id?.name || 'anonymous';
        const conditionProp = path.node.init.properties.find(p => p.key?.name === 'condition');
        
        if (!conditionProp) {
            return null;
        }
        
        const conditionValue = this.getConditionValue(conditionProp.value);
        const conditionType = this.isSignalCondition(conditionProp.value) ? 'signal' : 'string';
        
        return {
            name: varName,
            condition: conditionValue,
            conditionType: conditionType,
            type: "layer",
            constructorStyle: false,
            ...this.getNodeInfo(path.node)
        };
    }

    /**
     * Get condition value from AST node
     * @param {Object} valueNode - AST node
     * @returns {string} Condition expression
     */
    getConditionValue(valueNode) {
        // String literal: condition: "gyroLevel > 45"
        if (valueNode.type === "StringLiteral") {
            return valueNode.value;
        }
        
        // SignalComp: condition: new SignalComp("level < 30")
        if (valueNode.type === "NewExpression" &&
            valueNode.callee.name === "SignalComp" &&
            valueNode.arguments.length > 0) {
            const arg = valueNode.arguments[0];
            if (arg.type === "StringLiteral") {
                return arg.value;
            }
        }
        
        return "unknown";
    }

    /**
     * Check if condition uses SignalComp
     * @param {Object} valueNode - AST node
     * @returns {boolean} True if using SignalComp
     */
    isSignalCondition(valueNode) {
        return (
            valueNode.type === "NewExpression" &&
            valueNode.callee.name === "SignalComp"
        );
    }
}

module.exports = { BabelLayerDetector };
