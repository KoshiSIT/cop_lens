const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;

/**
 * Base class for Babel-based COP construct detectors
 * Provides AST parsing with Babel and visitor pattern
 */
class BabelBaseDetector {
    constructor() {
        this.currentFile = null;
    }

    /**
     * Set current file being analyzed
     * @param {string} filePath - File path
     */
    setCurrentFile(filePath) {
        this.currentFile = filePath;
    }

    /**
     * Main detection method - parses code and walks AST using Babel
     * @param {string} code - JavaScript code to analyze
     * @returns {Array} Array of detected constructs
     */
    detect(code) {
        const results = [];
        
        // Store source code for code extraction
        this.sourceCode = code;

        try {
            const ast = this.parseCode(code);
            const visitors = this.getVisitors(results);
            traverse(ast, visitors);
        } catch (error) {
            console.error(`${this.constructor.name} parse error:`, error.message);
        }

        return results;
    }

    /**
     * Abstract method - must be implemented by subclasses
     * Returns visitor object for Babel traverse
     * @param {Array} results - Array to collect results
     * @returns {Object} Visitor object
     */
    getVisitors(results) {
        throw new Error("getVisitors must be implemented by subclass");
    }

    /**
     * Parse JavaScript code into Babel AST
     * @param {string} code - JavaScript code
     * @returns {Object} Babel AST object
     */
    parseCode(code) {
        return babel.parse(code, {
            sourceType: "module",
            plugins: [],
        });
    }

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
     * Check if identifier is from EMAjs import
     * @param {Object} path - Babel path object
     * @param {string} name - Identifier name (e.g., 'Layer', 'Signal')
     * @returns {boolean} True if from EMAjs
     */
    isFromEMAjs(path, name) {
        const binding = path.scope.getBinding(name);
        
        if (!binding) {
            return false;
        }
        
        // Check if from require() or import
        const declarator = binding.path.node;
        
        // const { Layer } = require("...EMAjs...")
        if (declarator.id?.type === 'ObjectPattern' &&
            declarator.init?.type === 'CallExpression' &&
            declarator.init.callee.name === 'require') {
            
            const requirePath = declarator.init.arguments[0]?.value;
            return requirePath && requirePath.includes('EMAjs');
        }
        
        // import { Layer } from "...EMAjs..."
        if (binding.path.parent?.type === 'ImportDeclaration') {
            const importPath = binding.path.parent.source.value;
            return importPath && importPath.includes('EMAjs');
        }
        
        return false;
    }
}

module.exports = { BabelBaseDetector };
