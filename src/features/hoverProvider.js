/**
 * HoverProvider - Hover機能の提供
 * 
 * 責務:
 * - カーソル位置からエンティティを検索
 * - Hover表示用のコンテンツ生成
 */
class HoverProvider {
    constructor(analysisResult) {
        this.result = analysisResult;
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
    findEntityAt(position) {
        if (!this.result || !this.result.symbolIndex) {
            return null;
        }

        // symbolIndexは行番号でソート済み
        // 指定行に最も近いシンボルを探す
        const targetLine = position.line + 1; // VSCodeは0始まり、ASTは1始まり

        for (const symbol of this.result.symbolIndex) {
            if (symbol.line === targetLine) {
                return symbol;
            }
            
            // 範囲チェック（rangeがある場合）
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
        let content = `### Layer: \`${name}\`\n\n`;

        if (data.condition) {
            content += `**Condition:** \`${data.condition}\`\n\n`;
        }

        if (data.conditionType) {
            content += `**Type:** ${data.conditionType}\n\n`;
        }

        content += `**Line:** ${entity.line}`;

        return content;
    }

    /**
     * Refinement用Hoverコンテンツ
     */
    generateRefinementHover(entity) {
        const { name, data } = entity;
        let content = `### Refinement: \`${name}\`\n\n`;

        if (data.targetClass) {
            content += `**Target Class:** \`${data.targetClass}\`\n\n`;
        }

        if (data.methodName) {
            content += `**Method:** \`${data.methodName}\`\n\n`;
        }

        if (data.targetObject) {
            content += `**Target Object:** \`${data.targetObject}\`\n\n`;
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
