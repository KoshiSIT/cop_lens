const { BabelBaseDetector } = require("./babelBaseDetector");

/**
 * Babel-based Layer Detector
 * Detects both object literal layers and new Layer() constructor patterns
 * Enhanced with instance property tracking (condition, onEnter, onExit)
 */
class BabelLayerDetector extends BabelBaseDetector {
    constructor() {
        super();
        // Map for tracking instances (cleared on each detect())
        this.layerInstances = null;
    }
    
    /**
     * Override detect to initialize layerInstances
     */
    detect(code) {
        // Initialize map for each new detection
        this.layerInstances = new Map();
        return super.detect(code);
    }

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
                    // Check if this is EMAjs Layer (optional check)
                    // Skip check if in testing or Layer is not imported
                    const isEMAjs = this.isFromEMAjs(path, 'Layer');
                    if (isEMAjs || !isEMAjs) {  // Always register for now
                        this.registerLayerInstance(path);
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
            },

            // Detect: layerXXX.condition = ...
            // Detect: layerXXX.onEnter = ...
            // Detect: layerXXX.onExit = ...
            // Detect: this.layerDef = { condition: ... }
            AssignmentExpression: (path) => {
                const left = path.node.left;
                const right = path.node.right;
                
                // Case 1: this.layerDef = { condition: "..." }
                if (left.type === 'MemberExpression' &&
                    left.object.type === 'ThisExpression' &&
                    right.type === 'ObjectExpression') {
                    
                    if (this.isLayerObject(right)) {
                        const propertyName = left.property.name;
                        const layerInfo = this.extractLayerFromAssignment(propertyName, right, path.node);
                        if (layerInfo) {
                            results.push(layerInfo);
                        }
                    }
                }
                
                // Case 2: layerXXX.condition = ...
                if (left.type === 'MemberExpression' &&
                    left.object.type === 'Identifier') {
                    
                    const instanceName = left.object.name;
                    const propertyName = left.property.name;
                    
                    // Check if this instance is a Layer
                    if (this.layerInstances.has(instanceName)) {
                        this.addPropertyToInstance(
                            instanceName, 
                            propertyName, 
                            path.node.right,
                            path.node
                        );
                    }
                }
            },

            // Integrate results at program end
            Program: {
                exit: () => {
                    // Add all Layer instance information to results
                    for (const [name, instance] of this.layerInstances) {
                        results.push(this.buildLayerResult(name, instance));
                    }
                }
            }
        };
    }

    /**
     * Register Layer instance
     * @param {Object} path - Babel path object
     */
    registerLayerInstance(path) {
        const varDeclarator = path.parentPath?.node;
        if (!varDeclarator || varDeclarator.type !== 'VariableDeclarator') {
            return;
        }

        const varName = varDeclarator.id?.name;
        if (!varName) {
            return;
        }

        const constructorArg = path.node.arguments[0]?.value || varName;
        
        this.layerInstances.set(varName, {
            name: varName,
            layerName: constructorArg,
            declaration: this.getNodeInfo(path.node),
            properties: {},
            constructorStyle: true
        });

        console.log(`[LayerDetector] Registered Layer instance: ${varName}`);
    }

    /**
     * Add property to instance
     * @param {string} instanceName - Instance name
     * @param {string} propertyName - Property name
     * @param {Object} valueNode - Value AST node
     * @param {Object} assignmentNode - Assignment statement AST node
     */
    addPropertyToInstance(instanceName, propertyName, valueNode, assignmentNode) {
        const instance = this.layerInstances.get(instanceName);
        if (!instance) {
            return;
        }

        // Only target condition, onEnter, onExit
        if (!['condition', 'onEnter', 'onExit'].includes(propertyName)) {
            return;
        }

        const propertyInfo = this.extractPropertyValue(propertyName, valueNode, assignmentNode);
        if (propertyInfo) {
            instance.properties[propertyName] = propertyInfo;
            console.log(`[LayerDetector] Added ${propertyName} to ${instanceName} at line ${propertyInfo.line}`);
        }
    }

    /**
     * Extract property value
     * @param {string} propertyName - Property name
     * @param {Object} valueNode - Value AST node
     * @param {Object} assignmentNode - Assignment statement AST node
     * @returns {Object|null} Property information
     */
    extractPropertyValue(propertyName, valueNode, assignmentNode) {
        const baseInfo = this.getNodeInfo(assignmentNode);

        if (propertyName === 'condition') {
            return this.extractConditionValue(valueNode, baseInfo);
        } else if (propertyName === 'onEnter' || propertyName === 'onExit') {
            return this.extractCallbackValue(valueNode, baseInfo);
        }

        return null;
    }

    /**
     * Extract condition value
     * @param {Object} valueNode - Value AST node
     * @param {Object} baseInfo - Base location info
     * @returns {Object|null} Condition information
     */
    extractConditionValue(valueNode, baseInfo) {
        // new SignalComp("expression")
        if (valueNode.type === 'NewExpression' &&
            valueNode.callee.name === 'SignalComp' &&
            valueNode.arguments.length > 0) {
            
            const arg = valueNode.arguments[0];
            if (arg.type === 'StringLiteral') {
                return {
                    type: 'SignalComp',
                    expression: arg.value,
                    ...baseInfo
                };
            }
        }

        // String literal: "expression"
        if (valueNode.type === 'StringLiteral') {
            return {
                type: 'string',
                expression: valueNode.value,
                ...baseInfo
            };
        }

        return {
            type: 'unknown',
            expression: 'complex expression',
            ...baseInfo
        };
    }

    /**
     * Extract callback value
     * @param {Object} valueNode - Value AST node
     * @param {Object} baseInfo - Base location info
     * @returns {Object|null} Callback information
     */
    extractCallbackValue(valueNode, baseInfo) {
        // function() { ... } or () => { ... }
        if (valueNode.type === 'FunctionExpression' ||
            valueNode.type === 'ArrowFunctionExpression') {
            
            return {
                type: 'function',
                functionType: valueNode.type === 'ArrowFunctionExpression' ? 'arrow' : 'regular',
                ...baseInfo
            };
        }

        // Identifier (function reference)
        if (valueNode.type === 'Identifier') {
            return {
                type: 'function_reference',
                name: valueNode.name,
                ...baseInfo
            };
        }

        return null;
    }

    /**
     * Build Layer result
     * @param {string} name - Instance name
     * @param {Object} instance - Instance information
     * @returns {Object} Layer result
     */
    buildLayerResult(name, instance) {
        const result = {
            name: instance.name,
            layerName: instance.layerName,
            type: 'layer',
            constructorStyle: instance.constructorStyle,
            ...instance.declaration
        };

        // condition property
        if (instance.properties.condition) {
            const cond = instance.properties.condition;
            result.condition = cond.expression;
            result.conditionType = cond.type;
            result.conditionLine = cond.line;
        } else {
            result.condition = 'not defined';
            result.conditionType = 'none';
        }

        // onEnter property
        if (instance.properties.onEnter) {
            result.onEnter = instance.properties.onEnter;
        }

        // onExit property
        if (instance.properties.onExit) {
            result.onExit = instance.properties.onExit;
        }

        return result;
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
     * Extract Layer information from assignment expression (this.layerDef = {...})
     * @param {string} varName - Property name
     * @param {Object} objectNode - ObjectExpression node
     * @param {Object} assignmentNode - AssignmentExpression node
     * @returns {Object|null} Layer information
     */
    extractLayerFromAssignment(varName, objectNode, assignmentNode) {
        const conditionProp = objectNode.properties.find(p => p.key?.name === 'condition');
        
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
            ...this.getNodeInfo(assignmentNode)
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
