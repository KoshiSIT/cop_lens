/**
 * HTML Template for Dependency Graph View
 * Generates the HTML structure (without embedded JavaScript)
 */

const { getGraphStyles } = require('./graphStyles');

/**
 * Generate complete HTML structure
 * @param {string} title - Panel title
 * @param {string} fileName - Source file name
 * @returns {string} HTML structure
 */
function generateGraphTemplate(title, fileName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.21.1/cytoscape.min.js"></script>
    <style>
        ${getGraphStyles()}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span>🔍 ${title}</span>
            <span class="file-info">• ${fileName}</span>
        </div>
        <div class="controls">
            <button class="control-btn" id="refresh-btn" title="Refresh Graph">🔄</button>
        </div>
    </div>
    
    <div id="cy"></div>
    
    <!-- Node Detail Panel (hidden by default) -->
    <div id="node-detail-panel" class="node-detail-panel">
        <div class="node-detail-header">
            <div class="node-detail-title" id="detail-title">Node Details</div>
            <button class="node-detail-close" id="close-detail">✕ Close</button>
        </div>
        <div id="detail-content"></div>
    </div>
    
    <div class="info-panel">
        <div class="legend">
            <!-- Node Types -->
            <div class="legend-section">
                <h4>Nodes</h4>
                <div class="legend-item">
                    <div class="legend-color legend-round" style="background: #4CAF50;"></div>
                    <span>Class</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-round" style="background: #FF9800;"></div>
                    <span>Instance</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-round" style="background: #757575;"></div>
                    <span>External</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-round" style="background: #FDD835;"></div>
                    <span>Method</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-rect" style="background: #FFF9C4; border-color: #FBC02D;"></div>
                    <span>Layer</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-rect" style="background: #F8BBD0; border-color: #E91E63;"></div>
                    <span>Refinement</span>
                </div>
            </div>
            
            <!-- Edge Types -->
            <div class="legend-section">
                <h4>Edges</h4>
                <div class="legend-item">
                    <div class="legend-line" style="background: #2196F3;"></div>
                    <span>Composition</span>
                </div>
                <div class="legend-item">
                    <div class="legend-line legend-dashed" style="border-color: #9C27B0;"></div>
                    <span>Has Refinement</span>
                </div>
                <div class="legend-item">
                    <div class="legend-line" style="background: #F44336;"></div>
                    <span>Refined By</span>
                </div>
                <div class="legend-item">
                    <div class="legend-line legend-dotted" style="border-color: #607D8B;"></div>
                    <span>Has Method</span>
                </div>
            </div>
        </div>
        <div id="node-info">
            Click nodes to jump to source code. Drag to move, scroll to zoom.
            <div class="clickable-hint">💡 Nodes are clickable - they'll take you to the source!</div>
        </div>
    </div>

    <script>
        // Script will be injected here
        {{SCRIPT_CONTENT}}
    </script>
</body>
</html>`;
}

module.exports = {
    generateGraphTemplate
};
