/**
 * HoverProvider - Hover機能の提供
 * 
 * 責務:
 * - カーソル位置からエンティティを検索
 * - Hover表示用のコンテンツ生成
 * - ジャンプ可能なリンクの生成
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
     * Layer用Hoverコンテンツ（ジャンプリンク付き）
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

        // --- Refinements Section ---
        const refinements = this.findRelatedRefinements(name);
        if (refinements.length > 0) {
            // ターゲットごとにグループ化（Base別に分類）
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
            
            // 各ターゲットメソッドごとに表示（Base と Refinement を同列に）
            for (const [key, group] of refinementsByTarget) {
                const { targetClassName, methodName, refinements: refs } = group;
                
                // クラス情報を取得
                const classInfo = this.findClassByName(targetClassName);
                
                // --- Base Section (文脈に依存しない元の実装) ---
                lines.push(`### 📦 Base: \`${targetClassName}.${methodName}()\``);
                lines.push('');
                
                // クラスへのジャンプリンク
                if (classInfo) {
                    const classLink = this.makeJumpLink(classInfo.line, classInfo.file);
                    lines.push(`**Class:** \`${targetClassName}\` ${classLink}`);
                    
                    // メソッドへのジャンプリンク
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
                
                // --- Refinement Section (文脈依存の動作) ---
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
     * Refinement用Hoverコンテンツ（ジャンプリンク付き）
     */
    generateRefinementHover(entity) {
        const { name, data } = entity;
        const lines = [];
        
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
        
        lines.push(`### ${icon} ${title}`);
        lines.push('');

        // Layer情報（ジャンプリンク付き）
        if (data.layerObject) {
            const layerEntity = this.findLayerByName(data.layerObject);
            if (layerEntity) {
                lines.push(`**Layer:** \`${data.layerObject}\` ${this.makeJumpLink(layerEntity.line)}`);
            } else {
                lines.push(`**Layer:** \`${data.layerObject}\``);
            }
            lines.push('');
        }

        // ターゲット情報（クラス定義へのジャンプリンク付き）
        const targetClassName = data.targetObject || data.targetClass;
        if (targetClassName) {
            const classInfo = this.findClassByName(targetClassName);
            if (classInfo) {
                const jumpLink = this.makeJumpLink(classInfo.line, classInfo.file);
                lines.push(`**Target Class:** \`${targetClassName}\` ${jumpLink}`);
                lines.push('');
                
                // メソッド情報（メソッド定義へのジャンプリンク付き）
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
     * Class用Hoverコンテンツ
     */
    generateClassHover(entity) {
        const { name } = entity;
        return `### Class: \`${name}\`\n\n**Line:** ${entity.line} ${this.makeJumpLink(entity.line)}`;
    }

    /**
     * デフォルトHoverコンテンツ
     */
    generateDefaultHover(entity) {
        const { name, type } = entity;
        return `### ${type}: \`${name}\`\n\n**Line:** ${entity.line} ${this.makeJumpLink(entity.line)}`;
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
     * 名前でLayerを検索
     * @param {string} layerName - Layer名
     * @returns {Object|null} Layer entity or null
     */
    findLayerByName(layerName) {
        if (!this.result || !this.result.layers) {
            return null;
        }

        return this.result.layers.find(layer => layer.name === layerName);
    }

    /**
     * 名前でクラスを検索（GlobalStoreまたはローカル結果から）
     * @param {string} className - クラス名
     * @returns {Object|null} クラス情報 or null
     */
    findClassByName(className) {
        // GlobalStoreから検索
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
        
        // ローカル結果から検索
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
     * ジャンプリンク用のMarkdownを生成
     * @param {number} line - 行番号
     * @param {string} filePath - ファイルパス (オプション)
     * @param {string} label - リンクラベル (デフォルト: "↗")
     * @returns {string} Markdownリンク
     */
    makeJumpLink(line, filePath = null, label = "↗") {
        const args = filePath ? { line, file: filePath } : line;
        const argsJson = JSON.stringify(args);
        const encodedArgs = encodeURIComponent(argsJson);
        return `[${label}](command:cop-lens.goToLine?${encodedArgs})`;
    }
}

module.exports = { HoverProvider };
