/**
 * HoverProvider - Provides hover functionality
 * 
 * Responsibilities:
 * - Search for entity at cursor position
 * - Generate content for hover display
 * - Generate jumpable links
 */
class HoverProvider {
    constructor(analysisResult, globalStore = null) {
        this.result = analysisResult;
        this.globalStore = globalStore;
    }

    /**
     * Provide hover information at specified position
     * @param {Object} position - {line, character}
     * @returns {Object|null} Hover information or null
     */
    provideHover(position) {
        const entity = this.findEntityAt(position);
        if (!entity) {
            return null;
        }

        const content = this.generateHoverContent(entity);
        if (!content) {
            return null;
        }

        return {
            contents: content,
            range: entity.range
        };
    }

    /**
     * Search for entity at specified position
     * @param {Object} position - {line, character}
     * @returns {Object|null} Entity or null
     */
    findEntityAt(position, filePath = null) {
        // Use globalStore if available
        if (this.globalStore && filePath) {
            return this.globalStore.findEntityAt(filePath, position);
        }
        
        // Fallback to local result
        if (!this.result || !this.result.symbolIndex) {
            return null;
        }

        // symbolIndex is sorted by line number
        // Efficiently search using binary search
        const targetLine = position.line + 1; // VSCode is 0-indexed, AST is 1-indexed
        return this.binarySearchSymbol(this.result.symbolIndex, targetLine);
    }

    /**
     * Search for symbol using binary search (optimized)
     * @param {Array} symbols - Sorted symbol array
     * @param {number} targetLine - Target line number for search
     * @returns {Object|null} Found symbol or null
     */
    binarySearchSymbol(symbols, targetLine) {
        if (!symbols || symbols.length === 0) {
            return null;
        }

        // First search for exact match (binary search)
        let left = 0;
        let right = symbols.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const symbol = symbols[mid];
            
            if (symbol.line === targetLine) {
                return symbol;
            } else if (symbol.line < targetLine) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        // If no exact match, check range
        // Search for symbol with range containing targetLine
        for (const symbol of symbols) {
            if (symbol.range) {
                const { start, end } = symbol.range;
                if (targetLine >= start.line && targetLine <= end.line) {
                    return symbol;
                }
            }
        }
        
        return null;
    }

    /**
     * Generate content for hover display
     * @param {Object} entity - Entity
     * @returns {string|null} Markdown content or null
     */
    generateHoverContent(entity) {
        if (!entity) {
            return null;
        }

        switch (entity.type) {
            case 'layer':
                return this.generateLayerHover(entity);
            case 'refinement':
            case 'refinement_exhibit':
            case 'refinement_partial_method':
                return this.generateRefinementHover(entity);
            case 'class':
                return this.generateClassHover(entity);
            default:
                return this.generateDefaultHover(entity);
        }
    }

    /**
     * Hover content for Layer (with jump links)
     */
    generateLayerHover(entity) {
        const { name, data } = entity;
        const lines = [];
        
        lines.push(`### 🔵 Layer Instance: \`${name}\``);
        lines.push('');

        // Layer name
        if (data.layerName && data.layerName !== name) {
            lines.push(`**Layer Name:** \`${data.layerName}\``);
            lines.push('');
        }

        // Declaration (with jump link)
        lines.push(`**Declared at:** line ${entity.line} ${this.makeJumpLink(entity.line)}`);
        lines.push('');

        // --- Condition Section ---
        if (data.condition && data.condition !== 'not defined') {
            lines.push('---');
            lines.push('');
            lines.push('### 📋 Condition');
            lines.push('');
            lines.push('```javascript');
            lines.push(data.condition);
            lines.push('```');
            lines.push('');
            
            if (data.conditionType) {
                const typeLabel = data.conditionType === 'SignalComp' ? '🔄 SignalComp (reactive)' : '📝 String';
                lines.push(`**Type:** ${typeLabel}`);
                lines.push('');
            }
            
            if (data.conditionLine) {
                lines.push(`**Defined at:** line ${data.conditionLine} ${this.makeJumpLink(data.conditionLine)}`);
                lines.push('');
            }
        } else {
            lines.push('⚠️ **Condition:** Not defined');
            lines.push('');
        }

        // --- Lifecycle Callbacks Section ---
        const hasCallbacks = data.onEnter || data.onExit;
        if (hasCallbacks) {
            lines.push('---');
            lines.push('');
            lines.push('### 🔄 Lifecycle Callbacks');
            lines.push('');

            if (data.onEnter) {
                const funcType = data.onEnter.functionType === 'arrow' ? '(arrow)' : '(regular)';
                lines.push(`**onEnter** ${funcType}`);
                lines.push(`└─ Defined at line ${data.onEnter.line} ${this.makeJumpLink(data.onEnter.line)}`);
                lines.push('');
            }

            if (data.onExit) {
                const funcType = data.onExit.functionType === 'arrow' ? '(arrow)' : '(regular)';
                lines.push(`**onExit** ${funcType}`);
                lines.push(`└─ Defined at line ${data.onExit.line} ${this.makeJumpLink(data.onExit.line)}`);
                lines.push('');
            }
        }

        // --- COP Operations Section ---
        const copOperations = this.findRelatedCOPOperations(name);
        if (copOperations.length > 0) {
            lines.push('---');
            lines.push('');
            lines.push(`### ⚙️ COP Operations (${copOperations.length})`);
            lines.push('');
            
            copOperations.forEach(op => {
                const opLink = this.makeJumpLink(op.line);
                let opName = 'Unknown operation';
                
                if (op.type === 'refinement_proceed') {
                    opName = '`Layer.proceed()`';
                } else if (op.type === 'refinement_deploy') {
                    opName = '`EMA.deploy()`';
                } else if (op.type === 'refinement_exhibit') {
                    opName = '`exhibit()`';
                }
                
                lines.push(`• ${opName} at line ${op.line} ${opLink}`);
            });
            lines.push('');
        }

        // --- Refinements Section ---
        const refinements = this.findRelatedRefinements(name);
        if (refinements.length > 0) {
            // Group by target (classified by Base)
            const refinementsByTarget = new Map();
            
            refinements.forEach(ref => {
                const targetClassName = ref.targetObject || ref.targetClass || 'unknown';
                const methodName = ref.methodName || 'unknown';
                const key = `${targetClassName}.${methodName}`;
                
                if (!refinementsByTarget.has(key)) {
                    refinementsByTarget.set(key, {
                        targetClassName,
                        methodName,
                        refinements: []
                    });
                }
                
                refinementsByTarget.get(key).refinements.push(ref);
            });
            
            lines.push('---');
            lines.push('');
            
            // Display for each target method (Base and Refinement on same level)
            for (const [key, group] of refinementsByTarget) {
                const { targetClassName, methodName, refinements: refs } = group;
                
                // Get class information
                const classInfo = this.findClassByName(targetClassName);
                
                // --- Base Section (original implementation independent of context) ---
                lines.push(`### 📦 Base: \`${targetClassName}.${methodName}()\``);
                lines.push('');
                
                // Jump link to class
                if (classInfo) {
                    const classLink = this.makeJumpLink(classInfo.line, classInfo.file);
                    lines.push(`**Class:** \`${targetClassName}\` ${classLink}`);
                    
                    // Jump link to method
                    if (classInfo.methodsMap && classInfo.methodsMap[methodName]) {
                        const methodInfo = classInfo.methodsMap[methodName];
                        const methodLink = this.makeJumpLink(methodInfo.line, methodInfo.file);
                        lines.push(`**Method:** \`${methodName}()\` ${methodLink}`);
                    } else {
                        lines.push(`**Method:** \`${methodName}()\` (definition not found)`);
                    }
                } else {
                    lines.push(`**Target:** \`${targetClassName}.${methodName}()\` (class not found)`);
                }
                
                lines.push('');
                lines.push('---');
                lines.push('');
                
                // --- Refinement Section (context-dependent behavior) ---
                lines.push(`### ✨ Refinement: \`${targetClassName}.${methodName}()\``);
                lines.push('');
                lines.push(`**Context-dependent behaviors (${refs.length}):**`);
                lines.push('');
                
                refs.forEach(ref => {
                    const refLink = this.makeJumpLink(ref.line);
                    lines.push(`• Line ${ref.line} ${refLink}`);
                });
                
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Hover content for Refinement (with jump links)
     */
    generateRefinementHover(entity) {
        const { name, data } = entity;
        const lines = [];
        
        // Select icon based on Refinement type
        let icon = '✨';
        let title = 'Refinement';
        
        if (data.type === 'refinement_addPartialMethod' || data.type === 'refinement_partial_method') {
            icon = '🔧';
            title = 'Partial Method';
        } else if (data.type === 'refinement_exhibit') {
            icon = '📤';
            title = 'Exhibit';
        } else if (data.type === 'refinement_deploy') {
            icon = '🚀';
            title = 'Deploy';
        } else if (data.type === 'refinement_proceed') {
            icon = '➡️';
            title = 'Proceed';
        }
        
        lines.push(`### ${icon} ${title}`);
        lines.push('');

        // Layer information (with jump link)
        if (data.layerObject) {
            const layerEntity = this.findLayerByName(data.layerObject);
            if (layerEntity) {
                lines.push(`**Layer:** \`${data.layerObject}\` ${this.makeJumpLink(layerEntity.line)}`);
            } else {
                lines.push(`**Layer:** \`${data.layerObject}\``);
            }
            lines.push('');
        }

        // Target information (with jump link to class definition)
        const targetClassName = data.targetObject || data.targetClass;
        if (targetClassName) {
            const classInfo = this.findClassByName(targetClassName);
            if (classInfo) {
                const jumpLink = this.makeJumpLink(classInfo.line, classInfo.file);
                lines.push(`**Target Class:** \`${targetClassName}\` ${jumpLink}`);
                lines.push('');
                
                // Method information (with jump link to method definition)
                if (data.methodName && classInfo.methodsMap && classInfo.methodsMap[data.methodName]) {
                    const methodInfo = classInfo.methodsMap[data.methodName];
                    const methodJumpLink = this.makeJumpLink(methodInfo.line, methodInfo.file);
                    lines.push(`**Method:** \`${data.methodName}()\` ${methodJumpLink}`);
                    lines.push('');
                } else if (data.methodName) {
                    lines.push(`**Method:** \`${data.methodName}()\` (definition not found)`);
                    lines.push('');
                }
            } else {
                lines.push(`**Target:** \`${targetClassName}\` (class not found)`);
                lines.push('');
                if (data.methodName) {
                    lines.push(`**Method:** \`${data.methodName}()\``);
                    lines.push('');
                }
            }
        }

        // mappings (for exhibit)
        if (data.mappings && Array.isArray(data.mappings)) {
            lines.push('**Mappings:**');
            data.mappings.forEach(mapping => {
                lines.push(`  • \`${mapping.key}\` ← \`${mapping.value}\``);
            });
            lines.push('');
        }

        lines.push(`**Line:** ${entity.line} ${this.makeJumpLink(entity.line)}`);

        return lines.join('\n');
    }

    /**
     * Hover content for Class
     */
    generateClassHover(entity) {
        const { name } = entity;
        return `### Class: \`${name}\`\n\n**Line:** ${entity.line} ${this.makeJumpLink(entity.line)}`;
    }

    /**
     * Default hover content
     */
    generateDefaultHover(entity) {
        const { name, type } = entity;
        return `### ${type}: \`${name}\`\n\n**Line:** ${entity.line} ${this.makeJumpLink(entity.line)}`;
    }

    /**
     * Search for Refinements related to specified Layer
     * @param {string} layerName - Layer instance name
     * @returns {Array} Array of related Refinements
     */
    findRelatedRefinements(layerName) {
        const refinements = this.result ? this.result.getRefinements() : [];
        return refinements.filter(ref => {
            return ref.layerObject === layerName;
        });
    }

    /**
     * Search for COP operations related to specified Layer
     * @param {string} layerName - Layer instance name
     * @returns {Array} Array of related COP operations
     */
    findRelatedCOPOperations(layerName) {
        const copOperations = this.result ? this.result.getCOPOperations() : [];
        return copOperations.filter(op => {
            return op.layerObject === layerName;
        });
    }

    /**
     * Search for Layer by name
     * @param {string} layerName - Layer name
     * @returns {Object|null} Layer entity or null
     */
    findLayerByName(layerName) {
        const layers = this.result ? this.result.getLayers() : [];
        return layers.find(layer => layer.name === layerName);
    }

    /**
     * Search for class by name (from GlobalStore or local results)
     * @param {string} className - Class name
     * @returns {Object|null} Class information or null
     */
    findClassByName(className) {
        // Search from GlobalStore
        if (this.globalStore && this.globalStore.dependencyGraph) {
            const graph = this.globalStore.dependencyGraph;
            if (graph.nodes) {
                const classNode = graph.nodes.find(n => 
                    n.data.type === 'class' && n.data.id === className
                );
                if (classNode) {
                    return classNode.data;
                }
            }
        }
        
        // Search from local results
        if (this.result && this.result.dependencies && this.result.dependencies.nodes) {
            const classNode = this.result.dependencies.nodes.find(n =>
                n.data.type === 'class' && n.data.id === className
            );
            if (classNode) {
                return classNode.data;
            }
        }
        
        return null;
    }

    /**
     * Generate Markdown for jump link
     * @param {number} line - Line number
     * @param {string} filePath - File path (optional)
     * @param {string} label - Link label (default: "↗")
     * @returns {string} Markdown link
     */
    makeJumpLink(line, filePath = null, label = "↗") {
        const args = filePath ? { line, file: filePath } : line;
        const argsJson = JSON.stringify(args);
        const encodedArgs = encodeURIComponent(argsJson);
        return `[${label}](command:cop-lens.goToLine?${encodedArgs})`;
    }
}

module.exports = { HoverProvider };
