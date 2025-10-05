const { SymbolGroup, SymbolRole } = require('../parser/babelSymbolDetector');

/**
 * Symbol Registry for efficient symbol lookup and grouping
 * Uses sorted index for O(log n) position-based search
 * and maps for O(1) group/name-based access
 */
class SymbolRegistry {
    constructor() {
        this.symbols = [];              // All symbols (for iteration)
        this.symbolIndex = [];          // Sorted by position (for binary search)
        this.groupedSymbols = new Map(); // Group -> Symbols
        this.namedSymbols = new Map();   // Name -> Symbols
        this.layerInfo = new Map();      // Layer name -> aggregated info
    }

    /**
     * Build registry from symbol array
     * @param {Array} symbols - Array of symbol objects
     */
    build(symbols) {
        this.symbols = symbols;
        this._buildIndex();
        this._groupByCategory();
        this._buildNamedIndex();
        this._aggregateLayerInfo();
    }

    /**
     * Build sorted index for position-based search
     * @private
     */
    _buildIndex() {
        this.symbolIndex = this.symbols.map((symbol, index) => ({
            start: symbol.range.start,
            end: symbol.range.end,
            symbolIndex: index
        })).sort((a, b) => a.start - b.start);
    }

    /**
     * Group symbols by their category
     * @private
     */
    _groupByCategory() {
        this.groupedSymbols.clear();
        
        for (const symbol of this.symbols) {
            if (!this.groupedSymbols.has(symbol.group)) {
                this.groupedSymbols.set(symbol.group, []);
            }
            this.groupedSymbols.get(symbol.group).push(symbol);
        }
    }

    /**
     * Build name-based index
     * @private
     */
    _buildNamedIndex() {
        this.namedSymbols.clear();
        
        for (const symbol of this.symbols) {
            const name = symbol.text;
            if (!this.namedSymbols.has(name)) {
                this.namedSymbols.set(name, []);
            }
            this.namedSymbols.get(name).push(symbol);
        }
    }

    /**
     * Aggregate layer-related information
     * @private
     */
    _aggregateLayerInfo() {
        this.layerInfo.clear();
        
        // Find all layer definitions
        const layerSymbols = this.getSymbolsByGroup(SymbolGroup.LAYER);
        
        for (const symbol of layerSymbols) {
            if (symbol.role === SymbolRole.LAYER_DEFINITION) {
                const layerName = symbol.text;
                
                // Find all references to this layer
                const references = this.getSymbolsByName(layerName)
                    .filter(s => s.role === SymbolRole.LAYER_REFERENCE);
                
                // Find related refinements (from existing detection results)
                // This will be populated by merging with RefinementDetector results
                
                this.layerInfo.set(layerName, {
                    definition: symbol,
                    references: references,
                    refinements: [], // Will be populated later
                    usageCount: references.length
                });
            }
        }
    }

    /**
     * Find symbol at given position (binary search: O(log n))
     * @param {number} position - Character position in document
     * @returns {Object|null} Symbol at position or null
     */
    findSymbolAtPosition(position) {
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
                // Found symbol containing this position
                return this.symbols[entry.symbolIndex];
            }
        }
        
        return null;
    }

    /**
     * Get all symbols in a group
     * @param {string} group - Symbol group (from SymbolGroup enum)
     * @returns {Array} Array of symbols
     */
    getSymbolsByGroup(group) {
        return this.groupedSymbols.get(group) || [];
    }

    /**
     * Get all symbols with a specific name
     * @param {string} name - Symbol name
     * @returns {Array} Array of symbols
     */
    getSymbolsByName(name) {
        return this.namedSymbols.get(name) || [];
    }

    /**
     * Get aggregated layer information
     * @param {string} layerName - Layer name
     * @returns {Object|null} Layer info or null
     */
    getLayerInfo(layerName) {
        return this.layerInfo.get(layerName) || null;
    }

    /**
     * Get all layer names
     * @returns {Array} Array of layer names
     */
    getLayerNames() {
        return Array.from(this.layerInfo.keys());
    }

    /**
     * Merge with refinement detection results
     * @param {Array} refinementResults - Results from BabelRefinementDetector
     */
    mergeRefinementResults(refinementResults) {
        for (const refinement of refinementResults) {
            if (refinement.type === 'refinement_addPartialMethod' ||
                refinement.type === 'refinement_deploy') {
                
                const layerName = refinement.layerObject;
                const info = this.layerInfo.get(layerName);
                
                if (info) {
                    info.refinements.push(refinement);
                }
            }
        }
    }

    /**
     * Get symbol statistics (for debugging/info)
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            total: this.symbols.length,
            byGroup: {
                layers: this.getSymbolsByGroup(SymbolGroup.LAYER).length,
                targets: this.getSymbolsByGroup(SymbolGroup.TARGET).length,
                emaAPI: this.getSymbolsByGroup(SymbolGroup.EMA_API).length,
                signals: this.getSymbolsByGroup(SymbolGroup.SIGNAL).length
            },
            layerDefinitions: Array.from(this.layerInfo.keys()).length
        };
    }
}

module.exports = { SymbolRegistry };
