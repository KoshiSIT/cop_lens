/**
 * Unified COP Analysis Result
 * Central data store for all COP constructs (Layers, Refinements, Signals)
 * Provides multiple indices for efficient access from different UI components
 */
class COPAnalysisResult {
    constructor() {
        // Central storage: all COP entities
        this.entities = [];
        
        // Indices for efficient access
        this.symbolIndex = [];           // Sorted by position (for Hover)
        this.nameIndex = new Map();      // Name-based (for reference search)
        this.lineIndex = new Map();      // Line-based (for TreeView navigation)
        this.typeIndex = new Map();      // Type-based (for TreeView grouping)
        
        // Legacy format arrays (for backward compatibility)
        this.layerResults = [];
        this.refinementResults = [];
    }

    /**
     * Merge layer detection results into entities
     * @param {Array} layerResults - Results from BabelLayerDetector
     */
    mergeLayerResults(layerResults) {
        this.layerResults = layerResults; // Keep for backward compat
        
        for (const layer of layerResults) {
            const entity = {
                id: `layer_${layer.name}_${layer.line}`,
                type: 'layer',
                name: layer.name,
                line: layer.line,
                
                // Position info (for Hover/Definition)
                position: {
                    start: layer.startPos,
                    end: layer.endPos
                },
                
                // Layer-specific details (for TreeView)
                details: {
                    condition: layer.condition,
                    conditionType: layer.conditionType,
                    constructorStyle: layer.constructorStyle,
                    layerName: layer.layerName
                },
                
                // Symbols (for Hover) - will be populated by mergeSymbols()
                symbols: [],
                
                // Relations
                references: [],
                refinements: [],
                
                // Original data
                _original: layer
            };
            
            this.entities.push(entity);
        }
    }

    /**
     * Merge refinement detection results into entities
     * @param {Array} refinementResults - Results from BabelRefinementDetector
     */
    mergeRefinementResults(refinementResults) {
        this.refinementResults = refinementResults; // Keep for backward compat
        
        for (const refinement of refinementResults) {
            const entity = {
                id: `${refinement.type}_${refinement.line}`,
                type: refinement.type, // refinement_exhibit, refinement_addPartialMethod, etc.
                name: this._getRefinementName(refinement),
                line: refinement.line,
                
                position: {
                    start: refinement.startPos,
                    end: refinement.endPos
                },
                
                details: refinement, // Store all refinement details
                
                symbols: this._extractRefinementSymbols(refinement),
                
                _original: refinement
            };
            
            this.entities.push(entity);
            
            // Link refinement to layer
            if (refinement.layerObject) {
                this._linkRefinementToLayer(refinement.layerObject, entity);
            }
        }
    }

    /**
     * Merge symbol detection results
     * @param {Array} symbols - Results from BabelSymbolDetector
     */
    mergeSymbols(symbols) {
        // Enhance entities with additional symbols
        for (const symbol of symbols) {
            // Find matching entity by line and name
            const entity = this.entities.find(e => 
                e.line === symbol.line && e.name === symbol.text
            );
            
            if (entity) {
                // Add symbol to existing entity
                if (!entity.symbols) {
                    entity.symbols = [];
                }
                entity.symbols.push(symbol);
            } else {
                // Create new entity for standalone symbols (like references)
                const newEntity = {
                    id: `symbol_${symbol.text}_${symbol.line}`,
                    type: `${symbol.group}_symbol`,
                    name: symbol.text,
                    line: symbol.line,
                    position: {
                        start: symbol.range.start,
                        end: symbol.range.end
                    },
                    details: {
                        group: symbol.group,
                        role: symbol.role,
                        metadata: symbol.metadata
                    },
                    symbols: [symbol],
                    _original: symbol
                };
                
                this.entities.push(newEntity);
            }
        }
    }

    /**
     * Build all indices for efficient access
     */
    buildIndices() {
        this._buildSymbolIndex();
        this._buildNameIndex();
        this._buildLineIndex();
        this._buildTypeIndex();
    }

    /**
     * Build position-sorted symbol index for O(log n) hover lookup
     * @private
     */
    _buildSymbolIndex() {
        this.symbolIndex = [];
        
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (entity.symbols) {
                for (const symbol of entity.symbols) {
                    this.symbolIndex.push({
                        start: symbol.range.start,
                        end: symbol.range.end,
                        entityIndex: i,
                        symbol: symbol
                    });
                }
            }
        }
        
        // Sort by start position
        this.symbolIndex.sort((a, b) => a.start - b.start);
    }

    /**
     * Build name-based index
     * @private
     */
    _buildNameIndex() {
        this.nameIndex.clear();
        
        for (const entity of this.entities) {
            if (!this.nameIndex.has(entity.name)) {
                this.nameIndex.set(entity.name, []);
            }
            this.nameIndex.get(entity.name).push(entity);
        }
    }

    /**
     * Build line-based index
     * @private
     */
    _buildLineIndex() {
        this.lineIndex.clear();
        
        for (const entity of this.entities) {
            if (!this.lineIndex.has(entity.line)) {
                this.lineIndex.set(entity.line, []);
            }
            this.lineIndex.get(entity.line).push(entity);
        }
    }

    /**
     * Build type-based index
     * @private
     */
    _buildTypeIndex() {
        this.typeIndex.clear();
        
        for (const entity of this.entities) {
            if (!this.typeIndex.has(entity.type)) {
                this.typeIndex.set(entity.type, []);
            }
            this.typeIndex.get(entity.type).push(entity);
        }
    }

    /**
     * Find entity at given position (binary search: O(log n))
     * @param {number} position - Character offset in document
     * @returns {Object|null} Entity at position or null
     */
    findByPosition(position) {
        let left = 0;
        let right = this.symbolIndex.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const entry = this.symbolIndex[mid];
            
            if (position < entry.start) {
                right = mid - 1;
            } else if (position > entry.end) {
                left = mid + 1;
            } else {
                // Found symbol at this position
                return {
                    entity: this.entities[entry.entityIndex],
                    symbol: entry.symbol
                };
            }
        }
        
        return null;
    }

    /**
     * Get entities by name
     * @param {string} name - Entity name
     * @returns {Array} Array of entities with matching name
     */
    getByName(name) {
        return this.nameIndex.get(name) || [];
    }

    /**
     * Get entities by line number
     * @param {number} line - Line number
     * @returns {Array} Array of entities on that line
     */
    getByLine(line) {
        return this.lineIndex.get(line) || [];
    }

    /**
     * Get entities by type
     * @param {string} type - Entity type (layer, refinement_*, etc.)
     * @returns {Array} Array of entities of that type
     */
    getByType(type) {
        return this.typeIndex.get(type) || [];
    }

    /**
     * Get all layer entities
     * @returns {Array} Array of layer entities
     */
    getLayers() {
        return this.getByType('layer');
    }

    /**
     * Get all refinement entities
     * @returns {Array} Array of refinement entities
     */
    getRefinements() {
        return this.entities.filter(e => e.type.startsWith('refinement_'));
    }

    /**
     * Get layer info (similar to SymbolRegistry.getLayerInfo)
     * @param {string} layerName - Layer name
     * @returns {Object|null} Layer info or null
     */
    getLayerInfo(layerName) {
        const layers = this.getByName(layerName).filter(e => e.type === 'layer');
        if (layers.length === 0) return null;
        
        const layer = layers[0];
        return {
            definition: layer,
            references: this._getLayerReferences(layerName),
            refinements: layer.refinements || [],
            usageCount: layer.references ? layer.references.length : 0
        };
    }

    /**
     * Get statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            total: this.entities.length,
            layers: this.getLayers().length,
            refinements: this.getRefinements().length,
            byType: Array.from(this.typeIndex.entries()).map(([type, entities]) => ({
                type,
                count: entities.length
            }))
        };
    }

    /**
     * Get refinement name for display
     * @private
     * @param {Object} refinement - Refinement object
     * @returns {string} Display name
     */
    _getRefinementName(refinement) {
        switch (refinement.type) {
            case 'refinement_exhibit':
                return `exhibit(${refinement.targetObject})`;
            case 'refinement_addPartialMethod':
                return `${refinement.targetObject}.${refinement.methodName}`;
            case 'refinement_deploy':
                return `deploy(${refinement.layerObject})`;
            case 'refinement_proceed':
                return `Layer.proceed()`;
            default:
                return refinement.type;
        }
    }

    /**
     * Extract symbols from refinement
     * @private
     * @param {Object} refinement - Refinement object
     * @returns {Array} Array of symbols
     */
    _extractRefinementSymbols(refinement) {
        const symbols = [];
        
        // Add layer reference symbol
        if (refinement.layerObject) {
            symbols.push({
                text: refinement.layerObject,
                role: 'layer-reference',
                range: { start: refinement.startPos, end: refinement.endPos }
            });
        }
        
        // Add target object symbol
        if (refinement.targetObject) {
            symbols.push({
                text: refinement.targetObject,
                role: 'target-object',
                range: { start: refinement.startPos, end: refinement.endPos }
            });
        }
        
        return symbols;
    }

    /**
     * Link refinement to its layer
     * @private
     * @param {string} layerName - Layer name
     * @param {Object} refinementEntity - Refinement entity
     */
    _linkRefinementToLayer(layerName, refinementEntity) {
        // Search entities directly instead of using nameIndex
        // (nameIndex is not yet built when this method is called)
        const layers = this.entities.filter(e => 
            e.name === layerName && e.type === 'layer'
        );
        
        for (const layer of layers) {
            if (!layer.refinements) {
                layer.refinements = [];
            }
            layer.refinements.push(refinementEntity);
        }
    }

    /**
     * Get all references to a layer
     * @private
     * @param {string} layerName - Layer name
     * @returns {Array} Array of reference entities
     */
    _getLayerReferences(layerName) {
        return this.entities.filter(e => 
            e.symbols && e.symbols.some(s => 
                s.text === layerName && s.role === 'layer-reference'
            )
        );
    }

    /**
     * Get legacy format results (for backward compatibility)
     * @returns {Array} Combined layer and refinement results
     */
    getLegacyResults() {
        return [...this.layerResults, ...this.refinementResults].sort(
            (a, b) => a.line - b.line
        );
    }
}

module.exports = { COPAnalysisResult };
