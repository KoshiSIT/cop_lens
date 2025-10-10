/**
 * TreeViewProvider - Provides TreeView functionality
 * 
 * Responsibilities:
 * - Generate TreeView items from analysis results
 * - Generate display names, descriptions, icons, and tooltips
 * - Provide data structures for VSCode UI integration
 */
class TreeViewProvider {
    constructor(analysisResult, globalStore = null) {
        this.result = analysisResult;
        this.globalStore = globalStore;
    }

    /**
     * Build item list for TreeView
     * @returns {Array} Array of TreeItem-equivalent objects
     */
    buildTreeItems() {
        if (!this.result || !this.result.symbolIndex || this.result.symbolIndex.length === 0) {
            return [{
                label: 'No COP constructs detected',
                description: '',
                tooltip: 'No layers or refinements detected in the current file.',
                type: 'info'
            }];
        }

        return this.result.symbolIndex.map(entity => this.createTreeItem(entity));
    }

    /**
     * Create a single TreeItem
     * @param {Object} entity - Symbol entity
     * @returns {Object} TreeItem-equivalent object
     */
    createTreeItem(entity) {
        return {
            label: this.getDisplayName(entity),
            description: this.getDescription(entity),
            tooltip: this.getTooltip(entity),
            type: entity.type,
            line: entity.line,
            iconType: this.getIconType(entity),
            command: {
                command: 'cop-lens.goToLine',
                title: 'Go to Line',
                arguments: [entity.line]
            }
        };
    }

    /**
     * Get display name
     * @param {Object} entity - Entity
     * @returns {string} Display name
     */
    getDisplayName(entity) {
        const { type, name, line, data } = entity;

        switch (type) {
            case 'layer':
                return `${name} (line ${line})`;
            case 'class':
                return `${name} (line ${line})`;
            default:
                // Check if it's a refinement type
                if (type.startsWith('refinement_')) {
                    return this.getRefinementDisplayName(data, line);
                }
                return `${name || 'Unknown'} (line ${line})`;
        }
    }

    /**
     * Get display name for Refinement
     */
    getRefinementDisplayName(data, line) {
        if (!data) return `Refinement (line ${line})`;

        switch (data.type) {
            case 'refinement_exhibit':
                return `EMA.exhibit (line ${line})`;
            case 'refinement_addPartialMethod':
            case 'refinement_partial_method':
                return `EMA.addPartialMethod (line ${line})`;
            case 'refinement_proceed':
                return `Layer.proceed (line ${line})`;
            case 'refinement_deploy':
                return `EMA.deploy (line ${line})`;
            default:
                return `Refinement (line ${line})`;
        }
    }

    /**
     * Get description
     * @param {Object} entity - Entity
     * @returns {string} Description
     */
    getDescription(entity) {
        const { type, data } = entity;

        switch (type) {
            case 'layer':
                return data.condition || '';
            case 'class':
                return 'Class definition';
            default:
                // Check if it's a refinement type
                if (type.startsWith('refinement_')) {
                    return this.getRefinementDescription(data);
                }
                return '';
        }
    }

    /**
     * Get description for Refinement
     */
    getRefinementDescription(data) {
        if (!data) return '';

        switch (data.type) {
            case 'refinement_exhibit':
                if (data.mappings) {
                    const mappingKeys = Object.keys(data.mappings);
                    return `${data.targetObject} → ${mappingKeys.join(', ')}`;
                }
                return data.targetObject || '';
            
            case 'refinement_addPartialMethod':
            case 'refinement_partial_method':
                return `${data.targetObject}.${data.methodName} ← ${data.layerObject}`;
            
            case 'refinement_proceed':
                return 'Call base method';
            
            case 'refinement_deploy':
                return `Deploy layer: ${data.layerObject}`;
            
            default:
                return 'Refinement';
        }
    }

    /**
     * Get tooltip
     * @param {Object} entity - Entity
     * @returns {string} Tooltip
     */
    getTooltip(entity) {
        const { type, name, data } = entity;

        switch (type) {
            case 'layer':
                return this.getLayerTooltip(name, data);
            case 'class':
                return `Class: ${name}`;
            default:
                // Check if it's a refinement type
                if (type.startsWith('refinement_')) {
                    return this.getRefinementTooltip(data);
                }
                return name || 'Unknown';
        }
    }

    /**
     * Tooltip for Layer
     */
    getLayerTooltip(name, data) {
        let tooltip = `Layer: ${name}`;
        
        if (data.condition) {
            tooltip += `\nCondition: ${data.condition}`;
        }
        
        if (data.conditionType) {
            tooltip += `\nType: ${data.conditionType}`;
        }
        
        return tooltip;
    }

    /**
     * Tooltip for Refinement
     */
    getRefinementTooltip(data) {
        if (!data) return 'Refinement';

        switch (data.type) {
            case 'refinement_exhibit':
                let tooltip = `EMA.exhibit: ${data.targetObject}`;
                if (data.mappings) {
                    const mappings = Object.entries(data.mappings)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n');
                    tooltip += `\nMappings:\n${mappings}`;
                }
                return tooltip;
            
            case 'refinement_addPartialMethod':
            case 'refinement_partial_method':
                return `EMA.addPartialMethod\nLayer: ${data.layerObject}\nTarget: ${data.targetObject}\nMethod: ${data.methodName}`;
            
            case 'refinement_proceed':
                return 'Layer.proceed() - Call base method implementation';
            
            case 'refinement_deploy':
                return `EMA.deploy\nLayer: ${data.layerObject}\nActivates layer within current scope`;
            
            default:
                return 'Refinement';
        }
    }

    /**
     * Get icon type (returns VSCode ThemeIcon type)
     * @param {Object} entity - Entity
     * @returns {Object} {icon: string, color: string}
     */
    getIconType(entity) {
        const { type, data } = entity;

        switch (type) {
            case 'layer':
                if (data.conditionType === 'signal') {
                    return { icon: 'circle-filled', color: 'charts.blue' };
                } else if (data.conditionType === 'string') {
                    return { icon: 'circle-filled', color: 'charts.green' };
                } else {
                    return { icon: 'circle-filled', color: 'charts.gray' };
                }
            
            case 'class':
                return { icon: 'symbol-class', color: 'charts.yellow' };
            
            default:
                // Check if it's a refinement type
                if (type.startsWith('refinement_')) {
                    return this.getRefinementIcon(data);
                }
                return { icon: 'question', color: 'charts.gray' };
        }
    }

    /**
     * Icon for Refinement
     */
    getRefinementIcon(data) {
        if (!data) return { icon: 'question', color: 'charts.gray' };

        switch (data.type) {
            case 'refinement_exhibit':
                return { icon: 'symbol-interface', color: 'charts.purple' };
            case 'refinement_addPartialMethod':
            case 'refinement_partial_method':
                return { icon: 'symbol-method', color: 'charts.orange' };
            case 'refinement_proceed':
                return { icon: 'arrow-right', color: 'charts.yellow' };
            case 'refinement_deploy':
                return { icon: 'rocket', color: 'charts.red' };
            default:
                return { icon: 'question', color: 'charts.gray' };
        }
    }
}

module.exports = { TreeViewProvider };
