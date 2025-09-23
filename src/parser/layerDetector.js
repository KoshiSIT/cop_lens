const acorn = require("acorn");

/**
 * Layer detection result type
 * @property {number} line - Line number in source code
 * @property {string} name - Name of the detected layer
 * @property {string} condition - Condition expression
 * @property {string} conditionType - Type of condition ('signal' | 'string')
 * @property {string} type - Result type ('layer')
 */

/**
 * Detect layer definitions from JavaScript code
 * Detection criteria: Objects with valid 'condition' property
 * @param {string} code - JavaScript code to analyze
 * @returns {results[]} Array of detected layers
 */
function detectLayers(code) {
    const results = [];

    try {
        const ast = acorn.parse(code, {
            ecmaVersion: 2020,
            sourceType: "script",
            locations: true,
        });

        walkAST(ast, (node) => {
            if (node.type === "VariableDeclaration") {
                for (const declarator of node.declarations) {
                    if (isLayerObject(declarator)) {
                        const layerInfo = extractLayerInfo(declarator, node);
                        results.push(layerInfo);
                    }
                }
            }
        });
    } catch (error) {
        console.error("Layer detection parse error:", error.message);
    }

    return results;
}

/**
 * Enhanced validation: Check if variable declarator defines a valid layer object
 * @param {Object} declarator - VariableDeclarator AST node
 * @returns {boolean} True if this is a valid layer object
 */
function isLayerObject(declarator) {
    // Step 1: Basic structure check
    if (!declarator.init || declarator.init.type !== "ObjectExpression") {
        return false;
    }

    // Step 2: Condition property existence check
    if (!hasConditionProperty(declarator.init)) {
        return false;
    }

    // Step 3: Condition value validation check
    const conditionProperty = findConditionProperty(declarator.init);
    if (!conditionProperty) {
        return false;
    }

    const conditionValue = getConditionValue(conditionProperty.value);

    // Step 4: Reject if condition is unknown/invalid
    if (conditionValue === "unknown" || conditionValue.trim() === "") {
        return false;
    }

    return true;
}

/**
 * Check if object expression has 'condition' property
 * @param {Object} objectExpression - ObjectExpression AST node
 * @returns {boolean} True if condition property exists
 */
function hasConditionProperty(objectExpression) {
    return objectExpression.properties.some(
        (property) =>
            property.key &&
            property.key.type === "Identifier" &&
            property.key.name === "condition",
    );
}

/**
 * Extract layer information from AST nodes (optimized version)
 * @param {Object} declarator - VariableDeclarator AST node
 * @param {Object} variableNode - VariableDeclaration AST node
 * @returns {Object} Layer information object
 */
function extractLayerInfo(declarator, variableNode) {
    const conditionProperty = findConditionProperty(declarator.init);
    const conditionValue = getConditionValue(conditionProperty.value);

    return {
        name: declarator.id.name,
        condition: conditionValue,
        line: variableNode.loc ? variableNode.loc.start.line : null,
        startPos: variableNode.start,
        endPos: variableNode.end,
        conditionType:
            conditionProperty.value.type === "NewExpression" ? "signal" : "string",
        type: "layer",
    };
}

/**
 * Find condition property in object expression
 * @param {Object} objectExpression - ObjectExpression AST node
 * @returns {Object} Property AST node for condition
 */
function findConditionProperty(objectExpression) {
    return objectExpression.properties.find(
        (property) => property.key && property.key.name === "condition",
    );
}

/**
 * Get condition value from AST node (supports string literals and SignalComp)
 * @param {Object} valueNode - AST node representing condition value
 * @returns {string} Condition expression as string
 */
function getConditionValue(valueNode) {
    // String literal: condition: "gyroLevel > 45"
    if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
        return valueNode.value;
    }

    // SignalComp constructor: condition: new SignalComp("level < 30")
    if (
        valueNode.type === "NewExpression" &&
        valueNode.callee &&
        valueNode.callee.name === "SignalComp" &&
        valueNode.arguments.length > 0
    ) {
        const arg = valueNode.arguments[0];
        if (arg.type === "Literal" && typeof arg.value === "string") {
            return arg.value;
        }
    }

    return "unknown";
}

/**
 * Check if condition uses SignalComp (Signal-based condition)
 * @param {Object} valueNode - AST node representing condition value
 * @returns {boolean} True if using SignalComp
 */
function isSignalCondition(valueNode) {
    return (
        valueNode.type === "NewExpression" &&
        valueNode.callee &&
        valueNode.callee.name === "SignalComp" &&
        valueNode.arguments.length > 0 &&
        valueNode.arguments[0].type === "Literal" &&
        typeof valueNode.arguments[0].value === "string"
    );
}

/**
 * Check if condition uses string literal
 * @param {Object} valueNode - AST node representing condition value
 * @returns {boolean} True if using string literal
 */
function isStringCondition(valueNode) {
    return (
        valueNode.type === "Literal" &&
        typeof valueNode.value === "string" &&
        valueNode.value.trim() !== ""
    );
}

/**
 * Recursively walk through AST nodes
 * @param {Object} node - Current AST node
 * @param {Function} callback - Function to call for each node
 */
function walkAST(node, callback) {
    callback(node);

    for (const key in node) {
        const child = node[key];
        if (typeof child === "object" && child !== null) {
            if (Array.isArray(child)) {
                child.forEach((item) => {
                    if (isASTNode(item)) {
                        walkAST(item, callback);
                    }
                });
            } else if (isASTNode(child)) {
                walkAST(child, callback);
            }
        }
    }
}

/**
 * Check if object is an AST node
 * @param {any} obj - Object to check
 * @returns {boolean} True if object is an AST node
 */
function isASTNode(obj) {
    return (
        typeof obj === "object" && obj !== null && typeof obj.type === "string"
    );
}

module.exports = { detectLayers };
