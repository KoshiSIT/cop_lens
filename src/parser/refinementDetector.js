const { BaseDetector } = require("./baseDetector");

/**
 * Detector for EMA refinement operations
 * Currently supports: EMA.exhibit()
 */
class RefinementDetector extends BaseDetector {
    /**
     * Detect refinement constructs from AST node
     * @param {Object} node - AST node to analyze
     * @returns {Object|null} Detected refinement construct or null
     */
    detectNode(node) {
        // Only process expression statements with call expressions
        if (
            node.type === "ExpressionStatement" &&
            node.expression.type === "CallExpression"
        ) {
            return this.detectRefinementConstruct(node);
        }
        return null;
    }

    /**
     * Detect specific refinement construct
     * @param {Object} node - ExpressionStatement AST node
     * @returns {Object|null} Detected refinement construct or null
     */
    /**
     * Detect specific refinement construct
     * @param {Object} node - ExpressionStatement AST node
     * @returns {Object|null} Detected refinement construct or null
     */
    detectRefinementConstruct(node) {
        const callExpr = node.expression;

        // Check for EMA.exhibit()
        if (this.isEMAExhibit(callExpr)) {
            return this.extractExhibit(callExpr, node);
        }
        
        // Check for EMA.addPartialMethod()
        if (this.isEMAAddPartialMethod(callExpr)) {
            return this.extractAddPartialMethod(callExpr, node);
        }

        // TODO: Add other refinement constructs later
        // - Layer.proceed()

        return null;
    }

    /**
     * Check if call expression is EMA.exhibit()
     * @param {Object} callExpr - CallExpression AST node
     * @returns {boolean} True if this is EMA.exhibit call
     */
    isEMAExhibit(callExpr) {
        return (
            callExpr.callee.type === "MemberExpression" &&
            callExpr.callee.object &&
            callExpr.callee.object.name === "EMA" &&
            callExpr.callee.property &&
            callExpr.callee.property.name === "exhibit"
        );
    }

    /**
     * Check if call expression is EMA.addPartialMethod()
     * @param {Object} callExpr - CallExpression AST node
     * @returns {boolean} True if this is EMA.addPartialMethod call
     */
    isEMAAddPartialMethod(callExpr) {
        return (
            callExpr.callee.type === "MemberExpression" &&
            callExpr.callee.object &&
            callExpr.callee.object.name === "EMA" &&
            callExpr.callee.property &&
            callExpr.callee.property.name === "addPartialMethod"
        );
    }

    /**
     * Extract EMA.addPartialMethod information with step-by-step validation
     * @param {Object} callExpr - CallExpression AST node
     * @param {Object} node - Parent ExpressionStatement node
     * @returns {Object|null} Extracted addPartialMethod information
     */
    extractAddPartialMethod(callExpr, node) {
        const args = callExpr.arguments;
        
        // Step 1: Argument count validation
        if (args.length < 4) return null;
        
        // Step 2: First argument (layer object) validation
        const layerObject = this.getIdentifierName(args[0]);
        if (!layerObject) return null;
        
        // Step 3: Second argument (target object) validation
        const targetObject = this.getIdentifierName(args[1]);
        if (!targetObject) return null;
        
        // Step 4: Third argument (method name) validation
        const methodName = this.getLiteralValue(args[2]);
        if (!methodName || typeof methodName !== "string") return null;
        
        // Step 5: Fourth argument (function implementation) validation
        const hasImplementation = this.isFunctionLike(args[3]);
        
        return {
            type: "refinement_addPartialMethod",
            layerObject,
            targetObject,
            methodName,
            hasImplementation,
            ...this.getNodeInfo(node)
        };
    }

    /**
     * Check if node represents a function-like expression
     * @param {Object} node - AST node
     * @returns {boolean} True if node is function-like
     */
    isFunctionLike(node) {
        return node.type === "FunctionExpression" || 
               node.type === "ArrowFunctionExpression";
    }

    /**
     * Extract EMA.exhibit information
     * @param {Object} callExpr - CallExpression AST node
     * @param {Object} node - Parent ExpressionStatement node
     * @returns {Object|null} Extracted exhibit information
     */
    extractExhibit(callExpr, node) {
        const args = callExpr.arguments;
        if (args.length < 2) return null;

        const targetObject = this.getIdentifierName(args[0]);
        if (!targetObject) return null;

        const mappings = this.extractPropertyMappings(args[1]);
        if (!mappings) return null;

        return {
            type: "refinement_exhibit",
            targetObject: targetObject,
            mappings: mappings,
            ...this.getNodeInfo(node),
        };
    }

    /**
     * Extract property mappings from object expression
     * Example: {level: battery.charge} -> {"level": "battery.charge"}
     * @param {Object} node - ObjectExpression AST node
     * @returns {Object|null} Property mappings or null
     */
    extractPropertyMappings(node) {
        if (node.type !== "ObjectExpression") {
            return null;
        }

        const mappings = {};

        for (const property of node.properties) {
            if (property.type === "Property" && property.key && property.value) {
                const key = this.getPropertyKey(property.key);
                const value = this.getPropertyValue(property.value);

                if (key && value) {
                    mappings[key] = value;
                }
            }
        }

        return Object.keys(mappings).length > 0 ? mappings : null;
    }
}

module.exports = { RefinementDetector };
