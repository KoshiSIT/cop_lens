/**
 * HoverProvider - Hover機能の提供
 * 
 * 責務:
 * - カーソル位置からエンティティを検索
 * - Hover表示用のコンテンツ生成
 */
class HoverProvider {
    constructor(analysisResult, globalStore = null) {
        this.result = analysisResult;
        this.globalStore = globalStore;
    }

    /**
     * 指定位置のHover情報を提供
     * @param {Object} position - {line, character}
     * @returns {Object|null} Hover情報 or null
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
     * 指定位置のエンティティを検索
     * @param {Object} position - {line, character}
     * @returns {Object|null} エンティティ or null
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

        // symbolIndexは行番号でソート済み
        // 二分探索で効率的に検索
        const targetLine = position.line + 1; // VSCodeは0始まり、ASTは1始まり
        return this.binarySearchSymbol(this.result.symbolIndex, targetLine);
    }

    /**
     * 二分探索でシンボルを検索（高速化）
     * @param {Array} symbols - ソート済みシンボル配列
     * @param {number} targetLine - 検索対象の行番号
     * @returns {Object|null} 見つかったシンボル or null
     */
    binarySearchSymbol(symbols, targetLine) {
        if (!symbols || symbols.length === 0) {
            return null;
        }

        // まず完全一致を探す（二分探索）
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
        
        // 完全一致がない場合、範囲チェック
        // targetLineを含む範囲を持つシンボルを探す
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
     * Hover表示用コンテンツを生成
     * @param {Object} entity - エンティティ
     * @returns {string|null} Markdownコンテンツ or null
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
     * Layer用Hoverコンテンツ
     */
    generateLayerHover(entity) {
        const { name, data } = entity;
        let content = `### 🔵 Layer Instance: \`${name}\`

`;

        // Layer name
        if (data.layerName && data.layerName !== name) {
            content += `**Layer Name:** \`${data.layerName}\`

`;
        }

        // Declaration
        content += `**Declared at:** line ${entity.line}

`;

        // --- Condition Section ---
        if (data.condition && data.condition !== 'not defined') {
            content += `---

`;
            content += `### 📋 Condition

`;
            content += `\`\`\`javascript
${data.condition}
\`\`\`

`;
            
            if (data.conditionType) {
                const typeLabel = data.conditionType === 'SignalComp' ? '🔄 SignalComp (reactive)' : '📝 String';
                content += `**Type:** ${typeLabel}

`;
            }
            
            if (data.conditionLine) {
                content += `**Defined at:** line ${data.conditionLine}

`;
            }
        } else {
            content += `⚠️ **Condition:** Not defined

`;
        }

        // --- Lifecycle Callbacks Section ---
        const hasCallbacks = data.onEnter || data.onExit;
        if (hasCallbacks) {
            content += `---

`;
            content += `### 🔄 Lifecycle Callbacks

`;

            if (data.onEnter) {
                const funcType = data.onEnter.functionType === 'arrow' ? '(arrow)' : '(regular)';
                content += `**onEnter** ${funcType}  
`;
                content += `└─ Defined at line ${data.onEnter.line}

`;
            }

            if (data.onExit) {
                const funcType = data.onExit.functionType === 'arrow' ? '(arrow)' : '(regular)';
                content += `**onExit** ${funcType}  
`;
                content += `└─ Defined at line ${data.onExit.line}

`;
            }
        }

        // --- Refinements Section ---
        const refinements = this.findRelatedRefinements(name);
        if (refinements.length > 0) {
            content += `---

`;
            content += `### ✨ Refinements (${refinements.length})

`;
            
            refinements.forEach(ref => {
                const target = ref.targetObject || ref.targetClass || 'unknown';
                const method = ref.methodName || 'unknown';
                content += `• \`${target}.${method}()\` at line ${ref.line}
`;
            });
            content += `
`;
        }

        return content;
    }

    /**
     * 指定Layerに関連するRefinementを検索
     * @param {string} layerName - Layer instance名
     * @returns {Array} 関連するRefinement配列
     */
    findRelatedRefinements(layerName) {
        if (!this.result || !this.result.refinements) {
            return [];
        }

        return this.result.refinements.filter(ref => {
            return ref.layerObject === layerName;
        });
    }

    /**
     * Refinement用Hoverコンテンツ
     */
    generateRefinementHover(entity) {
        const { name, data } = entity;
        
        // Refinementのタイプに応じてアイコンを選択
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
        
        let content = `### ${icon} ${title}

`;

        // Layer情報
        if (data.layerObject) {
            content += `**Layer:** \`${data.layerObject}\`

`;
        }

        // ターゲット情報
        if (data.targetObject) {
            content += `**Target:** \`${data.targetObject}\`

`;
        }

        if (data.targetClass) {
            content += `**Class:** \`${data.targetClass}\`

`;
        }

        // メソッド情報
        if (data.methodName) {
            content += `**Method:** \`${data.methodName}()\`

`;
        }

        // mappings (for exhibit)
        if (data.mappings && Array.isArray(data.mappings)) {
            content += `**Mappings:**
`;
            data.mappings.forEach(mapping => {
                content += `  • \`${mapping.key}\` ← \`${mapping.value}\`
`;
            });
            content += `
`;
        }

        content += `**Line:** ${entity.line}`;

        return content;
    }

    /**
     * Class用Hoverコンテンツ
     */
    generateClassHover(entity) {
        const { name } = entity;
        return `### Class: \`${name}\`\n\n**Line:** ${entity.line}`;
    }

    /**
     * デフォルトHoverコンテンツ
     */
    generateDefaultHover(entity) {
        const { name, type } = entity;
        return `### ${type}: \`${name}\`\n\n**Line:** ${entity.line}`;
    }
}

module.exports = { HoverProvider };
