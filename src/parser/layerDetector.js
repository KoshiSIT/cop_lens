const { BaseDetector } = require("./baseDetector");

/**
 * Layer detection result type
 * @property {number} line - Line number in source code
 * @property {string} name - Name of the detected layer
 * @property {string} condition - Condition expression
 * @property {string} conditionType - Type of condition ('signal' | 'string')
 * @property {string} type - Result type ('layer')
 */

/**
 * Detector for COP layer definitions
 * Detects objects with valid 'condition' property
 */
class LayerDetector extends BaseDetector {
    /**
     * Detect layer definitions from AST node
     * @param {Object} node - AST node to analyze
     * @returns {Array|null} Array of detected layer objects or null
     */
    detectNode(node) {
        if (node.type === "VariableDeclaration") {
            return this.detectLayerDeclarations(node);
        }
        return null;
    }

    /**
     * Detect layer objects in variable declaration
     * @param {Object} node - VariableDeclaration AST node
     * @returns {Array} Array of detected layer objects
     */
    detectLayerDeclarations(node) {
        const results = [];

        for (const declarator of node.declarations) {
            if (this.isLayerObject(declarator)) {
                const layerInfo = this.extractLayerInfo(declarator, node);
                if (layerInfo) {
                    results.push(layerInfo);
                }
            }
        }

        return results.length > 0 ? results : null;
    }

    /**
     * Enhanced validation: Check if variable declarator defines a valid layer object
     * @param {Object} declarator - VariableDeclarator AST node
     * @returns {boolean} True if this is a valid layer object
     */
    isLayerObject(declarator) {
        // Step 1: Basic structure check
        if (!declarator.init || declarator.init.type !== "ObjectExpression") {
            return false;
        }

        // Step 2: Condition property existence check
        if (!this.hasConditionProperty(declarator.init)) {
            return false;
        }

        // Step 3: Condition value validation check
        const conditionProperty = this.findConditionProperty(declarator.init);
        if (!conditionProperty) {
            return false;
        }

        const conditionValue = this.getConditionValue(conditionProperty.value);

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
    hasConditionProperty(objectExpression) {
        return objectExpression.properties.some(
            (property) =>
                property.key &&
                property.key.type === "Identifier" &&
                property.key.name === "condition",
        );
    }

    /**
     * Extract layer information from AST nodes
     * @param {Object} declarator - VariableDeclarator AST node
     * @param {Object} variableNode - VariableDeclaration AST node
     * @returns {Object} Layer information object
     */
    extractLayerInfo(declarator, variableNode) {
        const conditionProperty = this.findConditionProperty(declarator.init);
        const conditionValue = this.getConditionValue(conditionProperty.value);

        return {
            name: declarator.id.name,
            condition: conditionValue,
            conditionType:
                conditionProperty.value.type === "NewExpression" ? "signal" : "string",
            type: "layer",
            ...this.getNodeInfo(variableNode),
        };
    }

    /**
     * Find condition property in object expression
     * @param {Object} objectExpression - ObjectExpression AST node
     * @returns {Object} Property AST node for condition
     */
    findConditionProperty(objectExpression) {
        return objectExpression.properties.find(
            (property) => property.key && property.key.name === "condition",
        );
    }

    /**
     * Get condition value from AST node (supports string literals and SignalComp)
     * @param {Object} valueNode - AST node representing condition value
     * @returns {string} Condition expression as string
     */
    getConditionValue(valueNode) {
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
    isSignalCondition(valueNode) {
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
    isStringCondition(valueNode) {
        return (
            valueNode.type === "Literal" &&
            typeof valueNode.value === "string" &&
            valueNode.value.trim() !== ""
        );
    }
}

module.exports = { LayerDetector };
