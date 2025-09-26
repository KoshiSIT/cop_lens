const acorn = require("acorn");

/**
 * Base class for all COP construct detectors
 * Provides common AST parsing, walking, and utility functionality
 */
class BaseDetector {
    /**
     * Main detection method - parses code and walks AST
     * @param {string} code - JavaScript code to analyze
     * @returns {Array} Array of detected constructs
     */
    detect(code) {
        const results = [];

        try {
            const ast = this.parseCode(code);
            this.walkAST(ast, (node) => {
                const detected = this.detectNode(node);
                if (detected) {
                    if (Array.isArray(detected)) {
                        results.push(...detected);
                    } else {
                        results.push(detected);
                    }
                }
            });
        } catch (error) {
            console.error(`${this.constructor.name} parse error:`, error.message);
        }

        return results;
    }

    /**
     * Abstract method - must be implemented by subclasses
     * @param {Object} node - AST node to analyze
     * @returns {Object|Array|null} Detected construct(s) or null
     */
    detectNode(node) {
        throw new Error("detectNode must be implemented by subclass");
    }

    // ========== AST Parsing & Walking ==========

    /**
     * Parse JavaScript code into AST
     * @param {string} code - JavaScript code
     * @returns {Object} AST object
     */
    parseCode(code) {
        return acorn.parse(code, {
            ecmaVersion: 2020,
            sourceType: "script",
            locations: true,
        });
    }

    /**
     * Recursively walk through AST nodes
     * @param {Object} node - Current AST node
     * @param {Function} callback - Function to call for each node
     */
    walkAST(node, callback) {
        callback(node);

        for (const key in node) {
            const child = node[key];
            if (typeof child === "object" && child !== null) {
                if (Array.isArray(child)) {
                    child.forEach((item) => {
                        if (this.isASTNode(item)) {
                            this.walkAST(item, callback);
                        }
                    });
                } else if (this.isASTNode(child)) {
                    this.walkAST(child, callback);
                }
            }
        }
    }

    /**
     * Check if object is an AST node
     * @param {any} obj - Object to check
     * @returns {boolean} True if object is an AST node
     */
    isASTNode(obj) {
        return (
            typeof obj === "object" && obj !== null && typeof obj.type === "string"
        );
    }

    // ========== Common Helper Methods ==========

    /**
     * Helper method to get basic node information
     * @param {Object} node - AST node
     * @returns {Object} Basic node information
     */
    getNodeInfo(node) {
        return {
            line: node.loc ? node.loc.start.line : null,
            startPos: node.start,
            endPos: node.end,
        };
    }

    /**
     * Get identifier name from AST node
     * @param {Object} node - AST node
     * @returns {string|null} Identifier name or null
     */
    getIdentifierName(node) {
        if (node.type === "Identifier") {
            return node.name;
        }
        return null;
    }

    /**
     * Get literal value from AST node
     * @param {Object} node - AST node
     * @returns {any|null} Literal value or null
     */
    getLiteralValue(node) {
        if (node.type === "Literal") {
            return node.value;
        }
        return null;
    }

    /**
     * Get property value from AST node (supports member expressions)
     * @param {Object} node - Property value AST node
     * @returns {string|null} Property value as string or null
     */
    getPropertyValue(node) {
        if (node.type === "Identifier") {
            return node.name;
        }
        if (node.type === "MemberExpression") {
            const object = this.getPropertyValue(node.object);
            const property =
                node.property.type === "Identifier" ? node.property.name : null;
            if (object && property) {
                return `${object}.${property}`;
            }
        }
        if (node.type === "Literal") {
            return String(node.value);
        }
        return "unknown";
    }

    /**
     * Get property key from AST node
     * @param {Object} node - Property key AST node
     * @returns {string|null} Property key or null
     */
    getPropertyKey(node) {
        if (node.type === "Identifier") {
            return node.name;
        }
        if (node.type === "Literal" && typeof node.value === "string") {
            return node.value;
        }
        return null;
    }
}

module.exports = { BaseDetector };
