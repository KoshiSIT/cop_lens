/**
 * Object Dependency Detector for COP-lens
 * Detects object-oriented programming dependencies in JavaScript code
 * 
 * Phase 1: Basic class and property detection
 */

const { BaseDetector } = require('./baseDetector');

class ObjectDependencyDetector extends BaseDetector {
    constructor() {
        super();
        this.classes = new Map();     // className -> ClassInfo
        this.instances = new Map();   // instanceName -> InstanceInfo  
        this.dependencies = [];       // DependencyInfo[]
        this.currentClass = null;     // Track current class context
    }

    /**
     * Main detection method - called by BaseDetector
     * @param {Object} node - AST node
     * @returns {Array} Array of detected elements
     */
    detectNode(node) {
        const results = [];

        try {
            switch (node.type) {
                case 'ClassDeclaration':
                    results.push(this.detectClass(node));
                    break;
                case 'MethodDefinition':
                    if (node.kind === 'constructor') {
                        results.push(...this.detectConstructor(node));
                    }
                    break;
                case 'NewExpression':
                    results.push(...this.detectNewExpression(node));
                    break;
                case 'AssignmentExpression':
                    results.push(...this.detectAssignment(node));
                    break;
            }
        } catch (error) {
            console.error('Error detecting node:', error);
        }

        return results.filter(Boolean);
    }

    /**
     * Detect class declarations
     * @param {Object} node - ClassDeclaration AST node
     * @returns {Object} ClassInfo object
     */
    detectClass(node) {
        const className = node.id ? node.id.name : 'AnonymousClass';
        
        const classInfo = {
            type: 'class',
            name: className,
            id: className,
            file: this.currentFile || 'unknown',
            line: node.loc ? node.loc.start.line : 0,
            description: `${className} class definition`,
            properties: [],
            methods: [],
            constructor: null
        };

        this.classes.set(className, classInfo);
        
        // Set current class context and walk through class body
        const previousClass = this.currentClass;
        this.currentClass = className;
        
        // Reset to previous class after processing this class
        // (This will be handled by the AST traversal naturally)

        return classInfo;
    }

    /**
     * Detect constructor and its properties
     * @param {Object} node - MethodDefinition AST node (constructor)
     * @returns {Array} Array of detected properties and dependencies
     */
    detectConstructor(node) {
        const results = [];
        
        if (!this.currentClass) return results;

        const classInfo = this.classes.get(this.currentClass);
        if (!classInfo) return results;

        // Store constructor info with parameter names
        const paramNames = node.value.params.map(param => param.name);
        classInfo.constructor = {
            line: node.loc ? node.loc.start.line : 0,
            params: paramNames
        };
        
        // Store parameter to class mapping for aggregation detection
        this.parameterClassMap = this.parameterClassMap || new Map();
        paramNames.forEach(paramName => {
            // Simple heuristic: capitalize parameter name as class name
            const inferredClassName = paramName.charAt(0).toUpperCase() + paramName.slice(1);
            this.parameterClassMap.set(paramName, inferredClassName);
        });

        // Walk through constructor body to find property assignments
        if (node.value && node.value.body) {
            this.walkAST(node.value.body, (childNode) => {
                if (childNode.type === 'AssignmentExpression') {
                    const assignment = this.detectConstructorAssignment(childNode);
                    if (assignment) {
                        results.push(assignment);
                    }
                }
            });
        }

        return results;
    }

    /**
     * Detect property assignments in constructor
     * @param {Object} node - AssignmentExpression AST node
     * @returns {Object|null} Property or dependency info
     */
    detectConstructorAssignment(node) {
        // Check for this.property = value pattern
        if (node.left && node.left.type === 'MemberExpression' &&
            node.left.object && node.left.object.type === 'ThisExpression' &&
            node.left.property) {
            
            const propertyName = node.left.property.name;
            const className = this.currentClass;
            
            // Check if right side is 'new' expression (composition)
            if (node.right && node.right.type === 'NewExpression') {
                return this.detectComposition(propertyName, node.right, node);
            }
            // Check if right side is identifier (aggregation from parameter)
            else if (node.right && node.right.type === 'Identifier') {
                return this.detectAggregation(propertyName, node.right, node);
            }
            // Simple property assignment
            else {
                return this.detectProperty(propertyName, node);
            }
        }
        
        return null;
    }

    /**
     * Detect composition relationship (this.prop = new Class())
     * @param {string} propertyName - Property name
     * @param {Object} newExpr - NewExpression AST node
     * @param {Object} assignNode - Assignment AST node
     * @returns {Object} Composition dependency info
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
        
        // Also create instance info
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

        return dependency;
    }

    /**
     * Detect aggregation relationship (this.prop = param)
     * @param {string} propertyName - Property name
     * @param {Object} identifier - Identifier AST node
     * @param {Object} assignNode - Assignment AST node
     * @returns {Object} Aggregation dependency info
     */
    detectAggregation(propertyName, identifier, assignNode) {
        const paramName = identifier.name;
        
        // Use parameter to class mapping if available
        let targetClass = 'UnknownClass';
        if (this.parameterClassMap && this.parameterClassMap.has(paramName)) {
            targetClass = this.parameterClassMap.get(paramName);
        } else {
            // Fallback heuristic: capitalize parameter name
            targetClass = paramName.charAt(0).toUpperCase() + paramName.slice(1);
        }
        
        const dependency = {
            type: 'aggregation',
            source: this.currentClass,
            target: targetClass,
            property: propertyName,
            parameter: paramName,
            file: this.currentFile || 'unknown',
            line: assignNode.loc ? assignNode.loc.start.line : 0,
            description: `${this.currentClass} uses ${paramName} parameter as ${propertyName}`,
            code: `this.${propertyName} = ${paramName}`
        };

        this.dependencies.push(dependency);
        return dependency;
    }

    /**
     * Detect simple property assignment
     * @param {string} propertyName - Property name
     * @param {Object} assignNode - Assignment AST node
     * @returns {Object} Property info
     */
    detectProperty(propertyName, assignNode) {
        const classInfo = this.classes.get(this.currentClass);
        if (!classInfo) return null;

        const property = {
            type: 'property',
            name: propertyName,
            className: this.currentClass,
            line: assignNode.loc ? assignNode.loc.start.line : 0,
            description: `Property ${propertyName} in ${this.currentClass}`
        };

        classInfo.properties.push(property);
        return property;
    }

    /**
     * Detect new expressions outside constructor
     * @param {Object} node - NewExpression AST node
     * @returns {Array} Array of instantiation dependencies
     */
    detectNewExpression(node) {
        // Skip new expressions - they are handled by detectConstructor
        // This method is for future expansion (method-level instantiation)
        return [];
    }

    /**
     * Detect assignment expressions
     * @param {Object} node - AssignmentExpression AST node  
     * @returns {Array} Array of detected assignments
     */
    detectAssignment(node) {
        // This will be expanded for method-level assignments
        return [];
    }

    /**
     * Get all detection results in dependency graph format
     * @returns {Object} Complete dependency graph
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
            
            // For composition, use instance node ID
            if (dep.type === 'composition') {
                targetId = `${dep.source}_${dep.property}`;
            }
            // For aggregation with unknown classes, create external node
            else if (dep.type === 'aggregation' && dep.target === 'UnknownClass') {
                // Don't create edge to UnknownClass, skip it for now
                console.log(`⚠️ Skipping aggregation to UnknownClass from ${dep.source}.${dep.property}`);
                continue;
            }
            // For other cases, check if target class exists
            else if (!this.classes.has(dep.target)) {
                // Add external class node if it doesn't exist
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
                    source: dep.source,
                    target: targetId,
                    type: dep.type,
                    property: dep.property,
                    parameter: dep.parameter,
                    file: dep.file,
                    line: dep.line,
                    description: dep.description,
                    code: dep.code
                }
            });

            // For composition, add instance -> class edge only if target class exists
            if (dep.type === 'composition') {
                const targetClassExists = this.classes.has(dep.target);
                if (targetClassExists) {
                    edges.push({
                        data: {
                            source: `${dep.source}_${dep.property}`,
                            target: dep.target,
                            type: 'instanceOf',
                            description: `${dep.property} is instance of ${dep.target}`
                        }
                    });
                } else {
                    // Add external class node for unknown classes
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
                    
                    edges.push({
                        data: {
                            source: `${dep.source}_${dep.property}`,
                            target: dep.target,
                            type: 'instanceOf',
                            description: `${dep.property} is instance of ${dep.target} (external)`
                        }
                    });
                }
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

    /**
     * Reset detector state
     */
    reset() {
        super.reset();
        this.classes.clear();
        this.instances.clear();
        this.dependencies = [];
        this.currentClass = null;
        this.parameterClassMap = new Map();
    }

    /**
     * Set current file context
     * @param {string} filePath - Current file path
     */
    setCurrentFile(filePath) {
        this.currentFile = filePath;
    }
}

module.exports = ObjectDependencyDetector;