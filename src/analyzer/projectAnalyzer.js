const fs = require('fs');
const path = require('path');
const { BabelObjectDependencyDetector } = require('../parser/babelObjectDependencyDetector');
const { BabelBaseDetector } = require('../parser/babelBaseDetector');

/**
 * ProjectAnalyzer - Analyzes dependency relationships across the entire project
 * 
 * Features:
 * - Recursively traverses directories to collect .js files
 * - Analyzes each file using ObjectDependencyDetector
 * - Merges results from all files to generate a unified dependency graph
 */
class ProjectAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.excludePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            '.vscode',
            '*.test.js',
            '*.spec.js'
        ];
    }

    /**
     * Analyzes the entire project
     * @returns {Promise<Object>} Merged dependency graph
     */
    async analyzeProject() {
        console.log("Analyzing project at: " + this.projectRoot);
        
        const editor = require('vscode').window.activeTextEditor;
        if (!editor) {
            console.warn("No active editor");
            return this.createEmptyGraph();
        }
        
        const entryFile = editor.document.fileName;
        const scopeDir = path.dirname(entryFile);
        console.log("Entry file: " + entryFile);
        console.log("Scope directory: " + scopeDir);
        
        // Collect all .js files in the scope directory
        const allFiles = this.collectJavaScriptFiles(scopeDir);
        console.log("Found " + allFiles.length + " JavaScript files in scope");
        
        // Analyze all files in the directory
        const visited = new Set();
        const allGraphs = [];
        
        for (const file of allFiles) {
            if (!visited.has(file)) {
                const graph = await this.traverse(file, visited, scopeDir);
                allGraphs.push(graph);
            }
        }
        
        // Merge all graphs
        const result = this.mergeGraphs(allGraphs);
        
        console.log("Analysis complete. Nodes: " + result.nodes.length + 
                    ", Edges: " + result.edges.length);
        
        return result;
    }

    /**
     * Collect all JavaScript files in a directory (non-recursive)
     * @param {string} dir - Directory path
     * @returns {Array<string>} Array of file paths
     */
    collectJavaScriptFiles(dir) {
        const files = [];
        try {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isFile() && entry.endsWith('.js')) {
                    // Skip test files
                    if (!entry.includes('.test.') && !entry.includes('.spec.')) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.error("Error reading directory " + dir + ": " + error.message);
        }
        return files;
    }

    /**
     * Traverse files recursively using DFS
     * @param {string} filePath - File to analyze
     * @param {Set} visited - Set of already visited files
     * @returns {Object} Merged dependency graph
     */
    traverse(filePath, visited = new Set(), scopeDir = null) {
        // Skip files outside scope directory
        if (scopeDir) {
            const normalizedPath = filePath.replace(/\\/g, '/');
            const normalizedScope = scopeDir.replace(/\\/g, '/');
            if (!normalizedPath.startsWith(normalizedScope)) {
                console.log("Skipping file outside scope: " + filePath);
                return { nodes: [], edges: [] };
            }
        }
        
        if (visited.has(filePath)) {
            return { nodes: [], edges: [] };
        }
        visited.add(filePath);
        
        console.log("Traversing file: " + filePath);
        
        // Step 1: Analyze this file
        const fileGraph = this.analyzeFile(filePath);
        
        // Step 2: Detect imports
        const imports = this.detectImports(filePath);
        console.log("Found " + imports.length + " imports");
        
        if (imports.length === 0) {
            return fileGraph;
        }
        
        // Step 3: Recursively traverse dependencies
        const allGraphs = [fileGraph];
        for (const imp of imports) {
            const resolvedFile = this.resolve(imp.source, filePath);
            if (resolvedFile && !visited.has(resolvedFile)) {
                const childGraph = this.traverse(resolvedFile, visited, scopeDir);
                allGraphs.push(childGraph);
            }
        }
        
        // Step 4: Merge graphs
        return this.mergeGraphs(allGraphs);
    }

    /**
     * Analyze a single file using ObjectDependencyDetector
     * @param {string} filePath - Path to the file
     * @returns {Object} Dependency graph for this file
     */
    analyzeFile(filePath) {
        try {
            const code = fs.readFileSync(filePath, 'utf8');
            const detector = new BabelObjectDependencyDetector();
            detector.setCurrentFile(filePath);
            detector.detect(code);
            return detector.getDependencyGraph();
        } catch (error) {
            console.error("Error analyzing file " + filePath + ": " + error.message);
            return { nodes: [], edges: [], hierarchyLevels: new Map(), summary: {} };
        }
    }

    /**
     * Detect import/require statements in a file
     * @param {string} filePath - Path to the file
     * @returns {Array<Object>} Array of import objects with source property
     */
    detectImports(filePath) {
        try {
            const code = fs.readFileSync(filePath, 'utf8');
            const baseDetector = new BabelBaseDetector();
            const ast = baseDetector.parseCode(code);
            
            const imports = [];
            baseDetector.walkAST(ast, (node) => {
                // CommonJS: require()
                if (node.type === 'CallExpression' && 
                    node.callee && node.callee.name === 'require' &&
                    node.arguments && node.arguments.length > 0 &&
                    node.arguments[0].type === 'Literal') {
                    imports.push({
                        source: node.arguments[0].value
                    });
                }
                
                // ES6: import
                if (node.type === 'ImportDeclaration') {
                    imports.push({
                        source: node.source.value
                    });
                }
            });
            
            return imports;
        } catch (error) {
            console.error("Error detecting imports in " + filePath + ": " + error.message);
            return [];
        }
    }



    /**
     * Resolve module path to actual file
     * @param {string} partial - Partial path like './Editor'
     * @param {string} baseFile - Base file path
     * @returns {string|null} Resolved file path or null if not found
     */
    resolve(partial, baseFile) {
        // Skip node_modules
        if (!partial.startsWith('.')) {
            return null;
        }
        
        const basedir = path.dirname(baseFile);
        
        // Try different extensions
        const candidates = [
            path.join(basedir, partial + '.js'),
            path.join(basedir, partial, 'index.js'),
            path.join(basedir, partial)
        ];
        
        for (const candidate of candidates) {
            // Skip library directories (lib, node_modules, vendor)
            const normalizedPath = candidate.replace(/\\/g, '/');
            if (normalizedPath.includes('/lib/') || 
                normalizedPath.includes('/node_modules/') ||
                normalizedPath.includes('/vendor/')) {
                console.log("Skipping library file: " + candidate);
                continue;
            }
            
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        
        console.warn("Could not resolve: " + partial + " from " + baseFile);
        return null;
    }



    /**
     * Merges dependency graphs from multiple files
     * @param {Array<Object>} graphs - Array of dependency graphs from each file
     * @returns {Object} Merged dependency graph with nodes, edges, hierarchyLevels, and summary
     */
    mergeGraphs(graphs) {
        const allNodes = [];
        const allEdges = [];
        const classLocationMap = new Map();
        
        // Phase 1: Collect all nodes and record class locations
        for (const graph of graphs) {
            if (!graph || !graph.nodes) continue;
            
            for (const node of graph.nodes) {
                allNodes.push(node);
                
                // Record class definition locations
                if (node.data && node.data.type === 'class') {
                    classLocationMap.set(node.data.name, node.data.file);
                }
            }
        }
        
        // Phase 2: Collect edges and enhance with file information
        for (const graph of graphs) {
            if (!graph || !graph.edges) continue;
            
            for (const edge of graph.edges) {
                if (!edge.data) continue;
                
                // Add file information using classLocationMap
                if (edge.data.target && classLocationMap.has(edge.data.target)) {
                    edge.data.targetFile = classLocationMap.get(edge.data.target);
                    edge.data.resolved = true;
                } else {
                    edge.data.targetFile = 'external';
                    edge.data.resolved = false;
                }
                
                allEdges.push(edge);
            }
        }
        
        // Deduplicate nodes
        const uniqueNodes = this.deduplicateNodes(allNodes);
        const uniqueEdges = this.deduplicateEdges(allEdges);
        
        // Calculate hierarchy
        const { calculateHierarchyLevels } = require('../parser/hierarchyCalculator');
        const classes = new Map();
        const instances = new Map();
        const methods = new Map();
        
        for (const node of uniqueNodes) {
            if (!node.data) continue;
            if (node.data.type === 'class') {
                classes.set(node.data.id, node.data);
            } else if (node.data.type === 'instance') {
                instances.set(node.data.id, node.data);
            } else if (node.data.type === 'method') {
                methods.set(node.data.id, node.data);
            }
        }
        
        const hierarchyLevels = calculateHierarchyLevels(classes, instances, methods, uniqueEdges);
        
        return {
            nodes: uniqueNodes,
            edges: uniqueEdges,
            hierarchyLevels: hierarchyLevels,
            summary: {
                classes: classes.size,
                instances: instances.size,
                methods: methods.size,
                dependencies: uniqueEdges.length
            }
        };
    }

    /**
     * Deduplicate nodes by ID
     * @param {Array<Object>} nodes - Array of graph nodes
     * @returns {Array<Object>} Array of unique nodes
     */
    deduplicateNodes(nodes) {
        const seen = new Map();
        const result = [];
        
        for (const node of nodes) {
            if (!node.data || !node.data.id) continue;
            
            if (!seen.has(node.data.id)) {
                seen.set(node.data.id, true);
                result.push(node);
            }
        }
        
        return result;
    }

    /**
     * Deduplicate edges by source-target-type combination
     * @param {Array<Object>} edges - Array of graph edges
     * @returns {Array<Object>} Array of unique edges
     */
    deduplicateEdges(edges) {
        const seen = new Set();
        const result = [];
        
        for (const edge of edges) {
            if (!edge.data) continue;
            
            const key = edge.data.source + '-' + edge.data.target + '-' + edge.data.type;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(edge);
            }
        }
        
        return result;
    }

    /**
     * Creates an empty graph object
     * @returns {Object} Empty dependency graph structure
     */
    createEmptyGraph() {
        return {
            nodes: [],
            edges: [],
            hierarchyLevels: new Map(),
            summary: {
                totalClasses: 0,
                totalInstances: 0,
                totalMethods: 0,
                totalDependencies: 0
            }
        };
    }
}

module.exports = { ProjectAnalyzer };
