const vscode = require('vscode');
const { SymbolGroup, SymbolRole } = require('../parser/babelSymbolDetector');

/**
 * Hover Provider for COP symbols
 * Displays contextual information when hovering over COP constructs
 * Now uses unified COPAnalysisResult for data access
 */
class COPHoverProvider {
    constructor(analysisResult) {
        this.analysisResult = analysisResult;
    }

    /**
     * Set the analysis result data source
     * @param {COPAnalysisResult} analysisResult - Analysis result to use for hover information
     */
    setAnalysisResult(analysisResult) {
        this.analysisResult = analysisResult;
    }

    /**
     * Provide hover information
     * @param {vscode.TextDocument} document - Current document
     * @param {vscode.Position} position - Cursor position
     * @returns {vscode.Hover|null} Hover object or null
     */
    provideHover(document, position) {
        if (!this.analysisResult) {
            return null;
        }

        const offset = document.offsetAt(position);
        const result = this.analysisResult.findByPosition(offset);

        if (!result) {
            return null;
        }

        // Generate hover content based on entity
        const content = this.generateHoverContent(result.entity, result.symbol);
        
        if (!content) {
            return null;
        }

        return new vscode.Hover(
            content,
            new vscode.Range(
                document.positionAt(result.symbol.range.start),
                document.positionAt(result.symbol.range.end)
            )
        );
    }

    /**
     * Generate hover content based on entity and symbol
     * @param {Object} entity - Entity object from COPAnalysisResult
     * @param {Object} symbol - Symbol object that was hovered
     * @returns {vscode.MarkdownString|null} Hover content
     */
    generateHoverContent(entity, symbol) {
        // Determine hover type based on entity type and symbol role
        if (entity.type === 'layer') {
            return this.generateLayerHover(entity, symbol);
        } else if (entity.type.startsWith('refinement_')) {
            return this.generateRefinementHover(entity, symbol);
        } else if (symbol.role === 'layer-reference') {
            return this.generateLayerReferenceHover(entity, symbol);
        } else if (symbol.role === 'target-object') {
            return this.generateTargetHover(entity, symbol);
        }
        
        return null;
    }

    /**
     * Generate hover for Layer definition
     * @param {Object} entity - Layer entity
     * @param {Object} symbol - Symbol that was hovered
     * @returns {vscode.MarkdownString} Hover content
     */
    generateLayerHover(entity, symbol) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`### 📋 Layer Definition

`);
        md.appendMarkdown(`**Name:** \`${entity.name}\`

`);
        md.appendMarkdown(`**Line:** ${entity.line}

`);
        
        // Show condition
        if (entity.details.condition) {
            md.appendMarkdown(`**Condition:** \`${entity.details.condition}\`

`);
        }

        // Show refinements
        if (entity.refinements && entity.refinements.length > 0) {
            md.appendMarkdown(`**Refinements:**

`);
            for (const ref of entity.refinements.slice(0, 5)) {
                if (ref.details.type === 'refinement_addPartialMethod') {
                    md.appendMarkdown(`- \`${ref.details.targetObject}.${ref.details.methodName}()\` (line ${ref.line})
`);
                } else if (ref.details.type === 'refinement_deploy') {
                    md.appendMarkdown(`- Deployed (line ${ref.line})
`);
                }
            }
            if (entity.refinements.length > 5) {
                md.appendMarkdown(`
*...and ${entity.refinements.length - 5} more*
`);
            }
        }

        return md;
    }

    /**
     * Generate hover for Layer reference
     * @param {Object} entity - Entity containing the reference
     * @param {Object} symbol - Layer reference symbol
     * @returns {vscode.MarkdownString} Hover content
     */
    generateLayerReferenceHover(entity, symbol) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        md.appendMarkdown(`### 📋 Layer Reference

`);
        md.appendMarkdown(`**Name:** \`${symbol.text}\`

`);
        
        // Find the layer definition
        const layerInfo = this.analysisResult.getLayerInfo(symbol.text);
        if (layerInfo && layerInfo.definition) {
            md.appendMarkdown(`**Defined at:** line ${layerInfo.definition.line}

`);
            if (layerInfo.definition.details.condition) {
                md.appendMarkdown(`**Condition:** \`${layerInfo.definition.details.condition}\`

`);
            }
            md.appendMarkdown(`*Click to go to definition*
`);
        }

        return md;
    }

    /**
     * Generate hover for Refinement
     * @param {Object} entity - Refinement entity
     * @param {Object} symbol - Symbol that was hovered
     * @returns {vscode.MarkdownString} Hover content
     */
    generateRefinementHover(entity, symbol) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        const details = entity.details;
        
        if (details.type === 'refinement_addPartialMethod') {
            md.appendMarkdown(`### 🔧 Partial Method

`);
            md.appendMarkdown(`**Target:** \`${details.targetObject}.${details.methodName}()\`

`);
            md.appendMarkdown(`**Layer:** \`${details.layerObject}\`

`);
            md.appendMarkdown(`**Line:** ${entity.line}

`);
            
            // Link to layer info
            const layerInfo = this.analysisResult.getLayerInfo(details.layerObject);
            if (layerInfo && layerInfo.definition) {
                md.appendMarkdown(`**Layer Condition:** \`${layerInfo.definition.details.condition}\`

`);
            }
        } else if (details.type === 'refinement_deploy') {
            md.appendMarkdown(`### 🚀 Layer Deploy

`);
            md.appendMarkdown(`**Layer:** \`${details.layerObject}\`

`);
            md.appendMarkdown(`**Line:** ${entity.line}

`);
        } else if (details.type === 'refinement_exhibit') {
            md.appendMarkdown(`### 📤 Exhibit

`);
            md.appendMarkdown(`**Target:** \`${details.targetObject}\`

`);
            if (details.mappings) {
                md.appendMarkdown(`**Mappings:**

`);
                for (const mapping of details.mappings) {
                    md.appendMarkdown(`- \`${mapping.key}\` → \`${mapping.value}\`
`);
                }
            }
        }

        return md;
    }

    /**
     * Generate hover for Target symbols
     * @param {Object} entity - Entity containing target
     * @param {Object} symbol - Target symbol
     * @returns {vscode.MarkdownString} Hover content
     */
    generateTargetHover(entity, symbol) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        md.appendMarkdown(`### 🎯 Target Object

`);
        md.appendMarkdown(`**Name:** \`${symbol.text}\`

`);

        // Find all refinements for this target
        const refinements = this.analysisResult.entities.filter(e => 
            e.details && e.details.targetObject === symbol.text &&
            e.details.type === 'refinement_addPartialMethod'
        );

        if (refinements.length > 0) {
            md.appendMarkdown(`**Methods refined:**

`);
            const methods = [...new Set(refinements.map(r => r.details.methodName))];
            for (const method of methods) {
                md.appendMarkdown(`- \`${method}()\`
`);
            }
        }

        return md;
    }
}

module.exports = { COPHoverProvider };
