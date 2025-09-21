const fs = require("fs");
const acorn = require("acorn");

/**
 * Main function to display AST structure of a JavaScript file
 * @param {string} filePath - Path to the JavaScript file to analyze
 */
function displayAST(filePath) {
    try {
        console.log(`\n=== AST Analysis for ${filePath} ===\n`);
        const code = fs.readFileSync(filePath, "utf-8");
        console.log(`File loaded: ${filePath}`);

        // Parse JavaScript code into AST
        const ast = acorn.parse(code, {
            ecmaVersion: 2020, // Support ES2020 syntax
            sourceType: "script", // CommonJS format (require support)
            locations: true, // Include line number information
        });

        console.log("AST parsing successful.");
        analyzeAST(ast);
    } catch (error) {
        console.error("Error during AST analysis:", error.message);
        if (error.loc) {
            console.error(`   at line ${error.loc.line}, column ${error.loc.column}`);
        }
    }
}

/**
 * Analyze AST and display statistics
 * @param {Object} ast - The parsed AST object
 */
function analyzeAST(ast) {
    console.log("Starting AST analysis...");

    const stats = {
        totalNodes: 0,
        variableDeclarations: 0,
        objectExpressions: 0,
        nodeTypes: {}, // Detailed count of each node type
    };

    // Walk through all AST nodes and collect statistics
    walkAST(ast, (node) => {
        stats.totalNodes++;

        // Count each node type
        stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;

        if (node.type === "VariableDeclaration") {
            stats.variableDeclarations++;
        }
        if (node.type === "ObjectExpression") {
            stats.objectExpressions++;
        }
    });

    // Display basic statistics
    console.log("\n--- AST Statistics ---");
    console.log(`Total nodes: ${stats.totalNodes}`);
    console.log(`Variable declarations: ${stats.variableDeclarations}`);
    console.log(`Object expressions: ${stats.objectExpressions}`);

    // Display node types in descending order
    console.log("\n--- Node Types (sorted by frequency) ---");
    Object.entries(stats.nodeTypes)
        .sort(([, a], [, b]) => b - a) // Sort by count descending
        .forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
}

/**
 * Recursively walk through AST nodes
 * @param {Object} node - Current AST node
 * @param {Function} callback - Function to call for each node
 */
function walkAST(node, callback) {
    // Process current node
    callback(node);

    // Recursively process child nodes
    for (const key in node) {
        const child = node[key];

        if (typeof child === "object" && child !== null) {
            if (Array.isArray(child)) {
                // Process array elements
                for (const elem of child) {
                    if (isASTNode(elem)) {
                        walkAST(elem, callback);
                    }
                }
            } else if (isASTNode(child)) {
                // Process single AST node
                walkAST(child, callback);
            }
        }
    }
}

/**
 * Check if an object is an AST node
 * @param {any} obj - Object to check
 * @returns {boolean} True if the object is an AST node
 */
function isASTNode(obj) {
    return (
        typeof obj === "object" && obj !== null && typeof obj.type === "string"
    );
}

// Command line execution
if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        console.log("Usage: node dep-tools/ast-viewer.js <file-path>");
        console.log("Example: node dep-tools/ast-viewer.js examples/example7.js");
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    displayAST(filePath);
}

module.exports = { displayAST };
