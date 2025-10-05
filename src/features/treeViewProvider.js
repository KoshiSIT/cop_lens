/**
 * TreeViewProvider - TreeView機能の提供
 * 
 * 責務:
 * - 解析結果からTreeView用のアイテムを生成
 * - 表示名、説明、アイコン、ツールチップの生成
 * - VSCode UIとの連携用データ構造を提供
 */
class TreeViewProvider {
    constructor(analysisResult) {
        this.result = analysisResult;
    }

    /**
     * TreeView用のアイテムリストを構築
     * @returns {Array} TreeItem相当のオブジェクト配列
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
     * 単一のTreeItemを生成
     * @param {Object} entity - シンボルエンティティ
     * @returns {Object} TreeItem相当のオブジェクト
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
     * 表示名を取得
     * @param {Object} entity - エンティティ
     * @returns {string} 表示名
     */
    getDisplayName(entity) {
        const { type, name, line, data } = entity;

        switch (type) {
            case 'layer':
                return `${name} (line ${line})`;
            case 'refinement':
                return this.getRefinementDisplayName(data, line);
            case 'class':
                return `${name} (line ${line})`;
            default:
                return `${name || 'Unknown'} (line ${line})`;
        }
    }

    /**
     * Refinement用の表示名を取得
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
     * 説明文を取得
     * @param {Object} entity - エンティティ
     * @returns {string} 説明文
     */
    getDescription(entity) {
        const { type, data } = entity;

        switch (type) {
            case 'layer':
                return data.condition || '';
            case 'refinement':
                return this.getRefinementDescription(data);
            case 'class':
                return 'Class definition';
            default:
                return '';
        }
    }

    /**
     * Refinement用の説明文を取得
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
     * ツールチップを取得
     * @param {Object} entity - エンティティ
     * @returns {string} ツールチップ
     */
    getTooltip(entity) {
        const { type, name, data } = entity;

        switch (type) {
            case 'layer':
                return this.getLayerTooltip(name, data);
            case 'refinement':
                return this.getRefinementTooltip(data);
            case 'class':
                return `Class: ${name}`;
            default:
                return name || 'Unknown';
        }
    }

    /**
     * Layer用ツールチップ
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
     * Refinement用ツールチップ
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
     * アイコンタイプを取得（VSCode ThemeIconの種類を返す）
     * @param {Object} entity - エンティティ
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
            
            case 'refinement':
                return this.getRefinementIcon(data);
            
            case 'class':
                return { icon: 'symbol-class', color: 'charts.yellow' };
            
            default:
                return { icon: 'question', color: 'charts.gray' };
        }
    }

    /**
     * Refinement用アイコン
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
