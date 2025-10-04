const { BabelBaseDetector } = require("./babelBaseDetector");

/**
 * Babel-based Object Dependency Detector
 * Detects OOP dependencies: classes, instances, composition, aggregation
 */
class BabelObjectDependencyDetector extends BabelBaseDetector {
    constructor() {
        super();
        this.classes = new Map();
        this.instances = new Map();
        this.dependencies = [];
        this.methods = new Map();
        this.currentClass = null;
        this.parameterClassMap = new Map();
    }

    /**
     * Override detect to reset state
     */
    detect(code) {
        this.reset();
        return super.detect(code);
    }

    /**
     * Reset internal state
     */
    reset() {
        this.classes.clear();
        this.instances.clear();
        this.dependencies = [];
        this.methods.clear();
        this.currentClass = null;
        this.parameterClassMap = new Map();
    }

    /**
     * Get Babel visitor object
     * @param {Array} results - Array to collect results (not used, we collect internally)
     * @returns {Object} Visitor object
     */
    getVisitors(results) {
        return {
            ClassDeclaration: (path) => {
                this.detectClass(path);
            },
            
            ClassMethod: (path) => {
                if (path.node.kind === 'constructor') {
                    this.detectConstructor(path);
                } else if (path.node.kind === 'method') {
                    this.detectMethod(path);
                }
            },
            
            NewExpression: (path) => {
                if (this.currentClass) {
                    this.detectNewExpression(path);
                }
            },
            
            AssignmentExpression: (path) => {
                if (this.currentClass) {
                    this.detectConstructorAssignment(path);
                }
            }
        };
    }

    /**
     * Override detect to return graph format
     */
    detect(code) {
        this.reset();
        const ast = this.parseCode(code);
        const visitors = this.getVisitors([]);
        
        const traverse = require('@babel/traverse').default;
        traverse(ast, visitors);
        
        return this.getDependencyGraph();
    }

    /**
     * Detect class declaration
     * @param {Object} path - Babel path
     */
    detectClass(path) {
        const className = path.node.id ? path.node.id.name : 'AnonymousClass';
        
        const classInfo = {
            type: 'class',
            name: className,
            id: className,
            file: this.currentFile || 'unknown',
            line: path.node.loc ? path.node.loc.start.line : 0,
            description: `${className} class definition`,
            properties: [],
            methods: [],
            constructor: null
        };
        
        this.classes.set(className, classInfo);
        this.currentClass = className;
    }

    /**
     * Detect constructor
     * @param {Object} path - Babel path
     */
    detectConstructor(path) {
        if (!this.currentClass) return;
        
        const classInfo = this.classes.get(this.currentClass);
        if (!classInfo) return;
        
        const paramNames = path.node.params.map(param => param.name);
        classInfo.constructor = {
            line: path.node.loc ? path.node.loc.start.line : 0,
            params: paramNames
        };
        
        // Build parameter to class mapping
        paramNames.forEach(paramName => {
            const className = paramName.charAt(0).toUpperCase() + paramName.slice(1);
            this.parameterClassMap.set(paramName, className);
        });
    }

    /**
     * Detect method
     * @param {Object} path - Babel path
     */
    detectMethod(path) {
        if (!this.currentClass) return;
        
        const methodName = path.node.key.name;
        const methodKey = `${this.currentClass}.${methodName}`;
        
        const methodInfo = {
            type: 'method',
            name: methodName,
            id: methodKey,
            className: this.currentClass,
            file: this.currentFile || 'unknown',
            line: path.node.loc ? path.node.loc.start.line : 0,
            description: `${this.currentClass}.${methodName}()`,
            params: path.node.params.map(p => p.name || 'anonymous')
        };
        
        this.methods.set(methodKey, methodInfo);
        
        const classInfo = this.classes.get(this.currentClass);
        if (classInfo) {
            classInfo.methods.push(methodInfo);
        }
    }

    /**
     * Detect new expression
     * @param {Object} path - Babel path
     */
    detectNewExpression(path) {
        // Will be handled in constructor assignments
    }

    /**
     * Detect assignment in constructor
     * @param {Object} path - Babel path
     */
    detectConstructorAssignment(path) {
        const node = path.node;
        
        if (node.left && node.left.type === 'MemberExpression' &&
            node.left.object && node.left.object.type === 'ThisExpression' &&
            node.left.property) {
            
            const propertyName = node.left.property.name;
            
            if (node.right && node.right.type === 'NewExpression') {
                this.detectComposition(propertyName, node.right, node);
            } else if (node.right && node.right.type === 'Identifier') {
                this.detectAggregation(propertyName, node.right, node);
            } else {
                this.detectProperty(propertyName, node);
            }
        }
    }

    /**
     * Detect composition
     */
    detectComposition(propertyName, newExpr, assignNode) {
        const targetClass = newExpr.callee ? newExpr.callee.name : 'UnknownClass';
        
        const dependency = {
            type: 'composition',
            source: this.currentClass,
            target: targetClass,
            property: propertyName,
            file: this.currentFile || 'unknown',
            line: assignNode.loc ? assignNode.loc.start.line : 0,
            description: `${this.currentClass} creates ${targetClass} instance as ${propertyName}`,
            code: `this.${propertyName} = new ${targetClass}()`
        };
        
        this.dependencies.push(dependency);
        
        const instanceInfo = {
            type: 'instance',
            name: propertyName,
            id: `${this.currentClass}_${propertyName}`,
            className: targetClass,
            file: this.currentFile || 'unknown',
            line: assignNode.loc ? assignNode.loc.start.line : 0,
            description: `${targetClass} instance in ${this.currentClass}`
        };
        
        this.instances.set(`${this.currentClass}_${propertyName}`, instanceInfo);
    }

    /**
     * Detect aggregation
     */
    detectAggregation(propertyName, identifier, assignNode) {
        const paramName = identifier.name;
        
        let targetClass = 'UnknownClass';
        if (this.parameterClassMap && this.parameterClassMap.has(paramName)) {
            targetClass = this.parameterClassMap.get(paramName);
        } else {
            targetClass = paramName.charAt(0).toUpperCase() + paramName.slice(1);
        }
        
        const dependency = {
            type: 'aggregation',
            source: this.currentClass,
            target: targetClass,
            property: propertyName,
            file: this.currentFile || 'unknown',
            line: assignNode.loc ? assignNode.loc.start.line : 0,
            description: `${this.currentClass} aggregates ${targetClass} as ${propertyName}`,
            code: `this.${propertyName} = ${paramName}`
        };
        
        this.dependencies.push(dependency);
    }

    /**
     * Detect property
     */
    detectProperty(propertyName, assignNode) {
        const classInfo = this.classes.get(this.currentClass);
        if (classInfo) {
            classInfo.properties.push({
                name: propertyName,
                line: assignNode.loc ? assignNode.loc.start.line : 0
            });
        }
    }

    /**
     * Detect assignment (placeholder)
     */
    detectAssignment(path) {
        // Future implementation
    }

    /**
     * Get dependency graph
     */
    getDependencyGraph() {
        const nodes = [];
        const edges = [];
        
        // Add class nodes
        for (const [className, classInfo] of this.classes) {
            nodes.push({
                data: {
                    id: className,
                    name: className,
                    type: 'class',
                    file: classInfo.file,
                    line: classInfo.line,
                    description: classInfo.description,
                    properties: classInfo.properties.length,
                    methods: classInfo.methods.length
                }
            });
        }
        
        // Add instance nodes
        for (const [instanceKey, instanceInfo] of this.instances) {
            nodes.push({
                data: {
                    id: instanceInfo.id,
                    name: instanceInfo.name,
                    type: 'instance',
                    className: instanceInfo.className,
                    file: instanceInfo.file,
                    line: instanceInfo.line,
                    description: instanceInfo.description
                }
            });
        }
        
        // Add dependency edges
        for (const dep of this.dependencies) {
            let targetId = dep.target;
            
            if (dep.type === 'composition') {
                targetId = `${dep.source}_${dep.property}`;
            }
            
            edges.push({
                data: {
                    source: dep.source,
                    target: targetId,
                    type: dep.type,
                    property: dep.property,
                    description: dep.description
                }
            });
            
            // For composition, add instance -> class edge
            if (dep.type === 'composition') {
                const targetClassExists = this.classes.has(dep.target);
                
                if (!targetClassExists) {
                    // Add external class node if it doesn't exist yet
                    const externalNodeExists = nodes.some(n => n.data.id === dep.target);
                    if (!externalNodeExists) {
                        nodes.push({
                            data: {
                                id: dep.target,
                                name: dep.target,
                                type: 'external',
                                file: 'external library',
                                line: 0,
                                description: `External class: ${dep.target}`
                            }
                        });
                    }
                }
                
                edges.push({
                    data: {
                        source: targetId,
                        target: dep.target,
                        type: 'instanceOf',
                        description: `${dep.property} is instance of ${dep.target}${targetClassExists ? '' : ' (external)'}`
                    }
                });
            }
        }
        
        return {
            nodes,
            edges,
            summary: {
                classes: this.classes.size,
                instances: this.instances.size,
                dependencies: this.dependencies.length
            }
        };
    }
}

module.exports = { BabelObjectDependencyDetector };
