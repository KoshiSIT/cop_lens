/**
 * Graph Script Generator
 * Generates the JavaScript code that runs inside the WebView
 * This code must be generated as a string because WebView cannot load external JS files
 */

/**
 * Generate complete script content for WebView
 * @param {Object} cytoscapeConfig - Cytoscape configuration object
 * @returns {string} JavaScript code as string
 */
function generateGraphScript(cytoscapeConfig) {
    return `
        const vscode = acquireVsCodeApi();
        
        // Store runtime status for all layers
        const runtimeStatusMap = {};
        const cytoscapeConfig = ${JSON.stringify(cytoscapeConfig, null, 2)};
        
        ${generateDebugCode()}
        ${generateCytoscapeInitCode()}
        ${generateHelperFunctions()}
        ${generateNodeDetailHandler()}
        ${generateRuntimeStatusHandler()}
        ${generateEventHandlers()}
        ${generateMessageListener()}
    `;
}

/**
 * Debug initialization code
 */
function generateDebugCode() {
    return `
        // Debug information
        const debugElement = document.getElementById('debug-info');
        let debugInfo = '';
        
        debugInfo += '🔍 WebView Debug Info:<br>';
        debugInfo += '- Cytoscape available: ' + (typeof cytoscape !== 'undefined') + '<br>';
        debugInfo += '- Config loaded: ' + (!!cytoscapeConfig) + '<br>';
        debugInfo += '- Nodes count: ' + cytoscapeConfig.elements.nodes.length + '<br>';
        debugInfo += '- Edges count: ' + cytoscapeConfig.elements.edges.length + '<br>';
        debugInfo += '- Container element: ' + (!!document.getElementById('cy')) + '<br>';
        
        console.log('🔍 WebView Debug Info:');
        console.log('- Cytoscape available:', typeof cytoscape !== 'undefined');
        console.log('- Config loaded:', !!cytoscapeConfig);
        console.log('- Nodes count:', cytoscapeConfig.elements.nodes.length);
        console.log('- Edges count:', cytoscapeConfig.elements.edges.length);
        console.log('- Container element:', !!document.getElementById('cy'));
    `;
}

/**
 * Cytoscape initialization code
 */
function generateCytoscapeInitCode() {
    return `
        if (!cytoscapeConfig.elements.nodes.length) {
            console.error('❌ No nodes in config!');
            debugInfo += '<strong style="color: #ffaa00;">❌ No nodes found in data!</strong><br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
        } else if (typeof cytoscape === 'undefined') {
            console.error('❌ Cytoscape.js not loaded!');
            debugInfo += '<strong style="color: #ffaa00;">❌ Cytoscape.js library not loaded!</strong><br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
        } else {
            debugInfo += '<strong style="color: #00ff00;">✅ All checks passed!</strong><br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
            
            console.log('🚀 Initializing Cytoscape...');
            debugInfo += '🚀 Initializing Cytoscape...<br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
            
            let cy;
            try {
                // Filter edges to only include those with existing source and target nodes
                const nodeIds = new Set(cytoscapeConfig.elements.nodes.map(n => n.data.id));
                const validEdges = cytoscapeConfig.elements.edges.filter(edge => {
                    const hasSource = nodeIds.has(edge.data.source);
                    const hasTarget = nodeIds.has(edge.data.target);
                    if (!hasSource || !hasTarget) {
                        console.warn('Skipping invalid edge:', edge.data.id, 'source:', edge.data.source, 'target:', edge.data.target);
                    }
                    return hasSource && hasTarget;
                });
                
                cy = cytoscape({
                    container: document.getElementById('cy'),
                    elements: [
                        ...cytoscapeConfig.elements.nodes,
                        ...validEdges
                    ],
                    style: cytoscapeConfig.style,
                    layout: cytoscapeConfig.layout,
                    zoomingEnabled: true,
                    userZoomingEnabled: true,
                    panningEnabled: true,
                    userPanningEnabled: true,
                    boxSelectionEnabled: false,
                    selectionType: 'single'
                });
                
            } catch (error) {
                console.error('❌ Cytoscape initialization failed:', error);
                debugInfo += '<strong style="color: #ff0000;">❌ Cytoscape init failed: ' + error.message + '</strong><br>';
                if (debugElement) debugElement.innerHTML = debugInfo;
                cy = null;
            }
            
            if (cy) {
                // Store cy instance globally for runtime updates
                window.cy = cy;
                console.log('✅ Cytoscape initialized');
                console.log('- Cytoscape instance:', !!cy);
                console.log('- Elements added:', cy.elements().length);
                console.log('- Nodes:', cy.nodes().length);
                console.log('- Edges:', cy.edges().length);
                console.log('- Container size:', cy.container().clientWidth, 'x', cy.container().clientHeight);
                
                debugInfo += '✅ Cytoscape initialized!<br>';
                debugInfo += '- Elements: ' + cy.elements().length + '<br>';
                debugInfo += '- Nodes: ' + cy.nodes().length + '<br>';
                debugInfo += '- Edges: ' + cy.edges().length + '<br>';
                debugInfo += '- Container: ' + cy.container().clientWidth + 'x' + cy.container().clientHeight + '<br>';
                if (debugElement) debugElement.innerHTML = debugInfo;
            
                // Force resize and fit
                setTimeout(() => {
                    console.log('🔄 Forcing resize and fit...');
                    cy.resize();
                    cy.fit();
                    console.log('- After fit - zoom:', cy.zoom(), 'center:', cy.center());
                }, 500);
                
                ${generateCytoscapeHandlers()}
                
                // Initialize info panel
                document.getElementById('node-info').innerHTML = 
                    '<strong>📊 Graph Summary</strong><br>' +
                    'Classes: ' + cytoscapeConfig.metadata.classes + '<br>' +
                    'Instances: ' + cytoscapeConfig.metadata.instances + '<br>' +
                    'Dependencies: ' + cytoscapeConfig.metadata.dependencies + '<br>' +
                    '<div class="clickable-hint">💡 Click nodes to navigate to source code!</div>';

                console.log('🚀 COP-lens Dependency Graph loaded in VSCode:', cytoscapeConfig.metadata);
            }
        }
    `;
}

/**
 * Helper functions
 */
function generateHelperFunctions() {
    return `
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Jump to method function
        window.jumpToMethod = function(file, line) {
            try {
                vscode.postMessage({
                    command: 'goToLocation',
                    file: file,
                    line: line
                });
            } catch (error) {
                console.error('Error jumping to method:', error);
            }
        };
    `;
}

/**
 * Node detail handler - will be imported from separate file later
 */
function generateNodeDetailHandler() {
    const { getNodeDetailHandlerCode } = require('../handlers/nodeDetailHandler');
    return getNodeDetailHandlerCode();
}

/**
 * Runtime status handler - will be imported from separate file later
 */
function generateRuntimeStatusHandler() {
    const { getRuntimeStatusHandlerCode } = require('../handlers/runtimeStatusHandler');
    return getRuntimeStatusHandlerCode();
}

/**
 * Event handlers (node click, edge click, etc.)
 */
function generateEventHandlers() {
    const { getEventHandlersCode } = require('../handlers/graphEventHandler');
    return getEventHandlersCode();
}

/**
 * Cytoscape event handlers (to be called after cy initialization)
 */
function generateCytoscapeHandlers() {
    return `
        // Close detail panel handlers
        const closeBtn = document.getElementById('close-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                const panel = document.getElementById('node-detail-panel');
                if (panel) {
                    panel.classList.remove('visible');
                }
            });
        }
        
        const detailPanel = document.getElementById('node-detail-panel');
        if (detailPanel) {
            detailPanel.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('visible');
                }
            });
        }
        
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            vscode.postMessage({
                command: 'refresh'
            });
        });
    `;
}

/**
 * Message listener for runtime updates
 */
function generateMessageListener() {
    return `
        // Listen for runtime status updates from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'updateRuntimeStatus') {
                updateLayerRuntimeStatus(message.layerName, message.status, message.signals);
            }
        });
    `;
}

module.exports = {
    generateGraphScript
};
