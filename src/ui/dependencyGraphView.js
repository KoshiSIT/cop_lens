/**
 * Dependency Graph View for VSCode WebView
 * Manages the WebView panel for displaying dependency graphs
 */

const vscode = require('vscode');
const GraphRenderer = require('../graph/graphRenderer');
const logger = require('../utils/logger');

class DependencyGraphView {
    constructor(context) {
        this.context = context;
        this.renderer = new GraphRenderer();
        this.currentPanel = null;
    }

    /**
     * Show dependency graph in WebView panel
     * @param {Object} dependencyGraph - Graph data from ObjectDependencyDetector
     * @param {string} title - Panel title
     * @param {string} fileName - Source file name for context
     */
    show(dependencyGraph, title = 'COP Dependency Graph', fileName = 'Unknown') {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.currentPanel) {
            // If panel exists, update it
            this.currentPanel.reveal(columnToShowIn);
            this.updateContent(dependencyGraph, title, fileName);
        } else {
            // Create new panel
            this.currentPanel = vscode.window.createWebviewPanel(
                'copDependencyGraph',
                title,
                columnToShowIn || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            // Set initial content
            this.updateContent(dependencyGraph, title, fileName);

            // Handle panel disposal
            this.currentPanel.onDidDispose(
                () => {
                    this.currentPanel = null;
                },
                null,
                this.context.subscriptions
            );

            // Handle messages from webview
            this.currentPanel.webview.onDidReceiveMessage(
                message => this.handleWebviewMessage(message),
                undefined,
                this.context.subscriptions
            );
        }
    }

    /**
     * Update WebView content with new graph data
     * @param {Object} dependencyGraph - Graph data
     * @param {string} title - Panel title
     * @param {string} fileName - Source file name
     */
    updateContent(dependencyGraph, title, fileName) {
        if (!this.currentPanel) return;

        // Render graph data to Cytoscape.js format
        const cytoscapeConfig = this.renderer.render(dependencyGraph);
        
        // Add VSCode-specific metadata
        cytoscapeConfig.metadata.fileName = fileName;
        cytoscapeConfig.metadata.vscodeVersion = vscode.version;

        // Generate HTML with enhanced VSCode integration
        const html = this.generateVSCodeHTML(cytoscapeConfig, title, fileName);
        
        this.currentPanel.webview.html = html;

        // Update panel title with summary
        const summary = dependencyGraph.summary;
        this.currentPanel.title = `${title} (${summary.classes} classes, ${summary.dependencies} deps)`;
    }

    /**
     * Update runtime status in the detail panel
     * @param {string} layerName - Layer name
     * @param {string} status - 'ACTIVE' | 'INACTIVE'
     * @param {Object} signals - Signal values
     */
    updateRuntimeStatus(layerName, status, signals) {
        if (!this.currentPanel) {
            logger.warn('[UI] Cannot update runtime status: panel is null');
            return;
        }

        logger.log('[UI] Updating runtime status: ' + layerName + ' -> ' + status);
        logger.log('[UI] Sending postMessage to webview...');

        // Send update to webview
        this.currentPanel.webview.postMessage({
            command: 'updateRuntimeStatus',
            layerName: layerName,
            status: status,
            signals: signals,
            timestamp: Date.now()
        });
    }

    /**
     * Handle messages from webview (node clicks, etc.)
     * @param {Object} message - Message from webview
     */
    handleWebviewMessage(message) {
        switch (message.command) {
            case 'goToLocation':
                this.goToSourceLocation(message.file, message.line);
                break;
            
            case 'showInfo':
                vscode.window.showInformationMessage(message.text);
                break;
                
            case 'refresh':
                this.refreshCurrentGraph();
                break;
                
            case 'export':
                this.exportGraph(message.format);
                break;
                
            case 'logRuntimeUpdate':
                console.log('📝 Received logRuntimeUpdate message:', message);
                this.logRuntimeUpdate(message);
                break;
                
            default:
                console.log('Unknown webview message:', message);
        }
    }

    /**
     * Log runtime update to file
     * @param {Object} message - Log message
     */
    logRuntimeUpdate(message) {
        const vscode = require('vscode');
        const fs = require('fs');
        const path = require('path');
        
        try {
            // Log file path (in workspace root)
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.warn('No workspace folder found for logging');
                return;
            }
            
            const logFilePath = path.join(workspaceFolder.uri.fsPath, '.cop-lens-runtime.log');
            
            // Create log entry
            const logEntry = `[${message.timestamp}] ${message.layerName} -> ${message.status}\n` +
                             `  Signals: ${JSON.stringify(message.signals)}\n\n`;
            
            // Overwrite file (keep only latest)
            fs.writeFileSync(logFilePath, logEntry, 'utf8');
            
            console.log(`✅ Runtime update logged to: ${logFilePath}`);
        } catch (error) {
            console.error('Failed to write runtime log:', error);
        }
    }

    /**
     * Navigate to source location in editor
     * @param {string} filePath - File path
     * @param {number} line - Line number (1-based)
     */
    async goToSourceLocation(filePath, line) {
        try {
            // Convert relative path to absolute if needed
            let fullPath = filePath;
            if (!filePath.startsWith('/')) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    fullPath = vscode.Uri.joinPath(workspaceFolder.uri, filePath).fsPath;
                }
            }

            const document = await vscode.workspace.openTextDocument(fullPath);
            const editor = await vscode.window.showTextDocument(document);
            
            // Jump to specific line (convert to 0-based)
            const position = new vscode.Position(Math.max(0, line - 1), 0);
            const range = new vscode.Range(position, position);
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            
            // Highlight the line briefly
            const decoration = vscode.window.createTextEditorDecorationType({
                backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
                isWholeLine: true
            });
            
            editor.setDecorations(decoration, [range]);
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                decoration.dispose();
            }, 2000);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open file: ${filePath}. ${error.message}`);
        }
    }

    /**
     * Refresh current graph (re-analyze current file)
     */
    refreshCurrentGraph() {
        vscode.commands.executeCommand('cop-lens.showDependencyGraph');
    }

    /**
     * Export graph in specified format
     * @param {string} format - Export format ('png', 'svg', 'json')
     */
    async exportGraph(format) {
        // This would be implemented to export the graph
        // For now, show a placeholder message
        vscode.window.showInformationMessage(`Export to ${format} - Coming soon!`);
    }

    /**
     * Generate VSCode-integrated HTML with enhanced messaging
     * @param {Object} cytoscapeConfig - Cytoscape.js configuration
     * @param {string} title - Page title
     * @param {string} fileName - Source file name
     * @returns {string} HTML content with VSCode integration
     */
    generateVSCodeHTML(cytoscapeConfig, title, fileName) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.21.1/cytoscape.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow: hidden;
        }
        
        .header {
            padding: 8px 16px;
            background-color: var(--vscode-titleBar-activeBackground);
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 32px;
            box-sizing: border-box;
        }
        
        .title {
            font-size: 13px;
            font-weight: normal;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .file-info {
            font-size: 11px;
            opacity: 0.8;
        }
        
        .controls {
            display: flex;
            gap: 4px;
        }
        
        .control-btn {
            padding: 3px 8px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            font-size: 11px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .control-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .control-btn.active {
            background-color: var(--vscode-button-background);
            box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
        }
        
        #cy {
            width: 100%;
            height: calc(100vh - 32px);
            min-height: 400px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        
        .info-panel {
            position: absolute;
            bottom: 12px;
            left: 12px;
            background-color: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-notifications-border);
            border-radius: 4px;
            padding: 12px;
            max-width: 350px;
            font-size: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            backdrop-filter: blur(8px);
        }
        
        .legend {
            display: flex;
            gap: 12px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }
        
        .legend-color {
            width: 10px;
            height: 10px;
            border-radius: 2px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .legend-line {
            width: 16px;
            height: 2px;
            position: relative;
        }
        
        .legend-line::after {
            content: '';
            position: absolute;
            right: -3px;
            top: -1px;
            width: 0;
            height: 0;
            border-left: 3px solid;
            border-top: 2px solid transparent;
            border-bottom: 2px solid transparent;
        }
        
        #node-info {
            margin-top: 8px;
            min-height: 24px;
            line-height: 1.3;
        }
        
        .clickable-hint {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 4px;
        }
        
        .refresh-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            color: var(--vscode-button-secondaryForeground);
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 11px;
            cursor: pointer;
        }
        
        /* Expanded node detail panel */
        .node-detail-panel {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-focusBorder);
            border-radius: 8px;
            padding: 16px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
        }
        
        .node-detail-panel.visible {
            display: block;
        }
        
        .node-detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .node-detail-title {
            font-size: 16px;
            font-weight: bold;
            color: var(--vscode-editor-foreground);
        }
        
        .node-detail-close {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .node-detail-close:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .node-detail-section {
            margin-bottom: 16px;
        }
        
        .node-detail-section-title {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }
        
        .node-detail-content {
            font-size: 12px;
            line-height: 1.5;
            font-family: var(--vscode-editor-font-family);
        }
        
        .method-item {
            padding: 6px 8px;
            margin: 4px 0;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 2px;
            cursor: pointer;
        }
        
        .method-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .method-name {
            font-weight: bold;
            color: var(--vscode-symbolIcon-functionForeground);
        }
        
        .method-params {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .property-item {
            padding: 4px 8px;
            margin: 2px 0;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 2px;
        }
        
        .code-section {
            position: relative;
        }
        
        .code-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .jump-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        }
        
        .jump-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .code-container {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 11px;
            line-height: 1.4;
            border: 1px solid var(--vscode-panel-border);
        }
        
        /* Runtime Status Styles */
        .runtime-status-section {
            border-left: 3px solid var(--vscode-charts-blue);
            background: var(--vscode-editor-inactiveSelectionBackground);
        }
        
        .runtime-status {
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        .status-active {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        
        .status-inactive {
            background: rgba(158, 158, 158, 0.1);
            border: 1px solid rgba(158, 158, 158, 0.3);
        }
        
        .signals-container {
            margin-top: 4px;
            padding-left: 12px;
        }
        
        .signal-item {
            font-size: 11px;
            padding: 2px 0;
            font-family: var(--vscode-editor-font-family);
        }
        
        .signal-name {
            color: var(--vscode-symbolIcon-variableForeground);
            font-weight: 600;
        }
        
        .signal-value {
            color: var(--vscode-debugTokenExpression-number);
            font-family: monospace;
        }
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
            <div id="debug-info" style="background: #ff4444; color: white; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                <strong>🔍 Loading...</strong><br>
                Checking Cytoscape.js and data...
            </div>
            Click nodes to jump to source code. Drag to move, scroll to zoom.
            <div class="clickable-hint">💡 Nodes are clickable - they'll take you to the source!</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const cytoscapeConfig = ${JSON.stringify(cytoscapeConfig, null, 2)};
        
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
        
        if (!cytoscapeConfig.elements.nodes.length) {
            console.error('❌ No nodes in config!');
            debugInfo += '<strong style="color: #ffaa00;">❌ No nodes found in data!</strong><br>';
            debugElement.innerHTML = debugInfo;
        } else if (typeof cytoscape === 'undefined') {
            console.error('❌ Cytoscape.js not loaded!');
            debugInfo += '<strong style="color: #ffaa00;">❌ Cytoscape.js library not loaded!</strong><br>';
            debugElement.innerHTML = debugInfo;
        
        } else {
            debugInfo += '<strong style="color: #00ff00;">✅ All checks passed!</strong><br>';
            debugElement.innerHTML = debugInfo;
            
            // Initialize Cytoscape
        console.log('🚀 Initializing Cytoscape...');
        debugInfo += '🚀 Initializing Cytoscape...<br>';
        debugElement.innerHTML = debugInfo;
        
        let cy;
        try {
            cy = cytoscape({
            container: document.getElementById('cy'),
            elements: [
                ...cytoscapeConfig.elements.nodes,
                ...cytoscapeConfig.elements.edges
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
            debugElement.innerHTML = debugInfo;
            cy = null;
        }
        
        if (cy) {
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
            debugElement.innerHTML = debugInfo;
        
            // Force resize and fit
            setTimeout(() => {
                console.log('🔄 Forcing resize and fit...');
                cy.resize();
                cy.fit();
                console.log('- After fit - zoom:', cy.zoom(), 'center:', cy.center());
            }, 500);

        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Function to show node detail panel (define before use)
        function showNodeDetail(data) {
            console.log('📋 showNodeDetail called with data:', data);
            try {
                const panel = document.getElementById('node-detail-panel');
                const title = document.getElementById('detail-title');
                const content = document.getElementById('detail-content');
                
                console.log('🔍 Panel elements:', { panel: !!panel, title: !!title, content: !!content });
                
                if (!panel || !title || !content) {
                    console.error('❌ Detail panel elements not found');
                    alert('Error: Detail panel elements not found. Panel=' + !!panel + ', Title=' + !!title + ', Content=' + !!content);
                    return;
                }
                
                console.log('✅ All panel elements found');
                
                // Set title
                title.textContent = \`\${data.name} (\${data.type})\`;
                
                // Build content based on node type
                let html = '';
                
                // Basic info section
                html += '<div class="node-detail-section">';
                html += '<div class="node-detail-section-title">📋 Basic Information</div>';
                html += '<div class="node-detail-content">';
                html += \`<div><strong>File:</strong> \${data.file}</div>\`;
                html += \`<div><strong>Line:</strong> \${data.line}</div>\`;
                if (data.description) {
                    html += \`<div><strong>Description:</strong> \${data.description}</div>\`;
                }
                html += '</div></div>';
                
                // Type-specific content
                if (data.type === 'class' && data.methodsMap) {
                    // Show methods
                    html += '<div class="node-detail-section">';
                    html += '<div class="node-detail-section-title">🔧 Methods (' + Object.keys(data.methodsMap).length + ')</div>';
                    html += '<div class="node-detail-content">';
                    
                    for (const [methodName, methodInfo] of Object.entries(data.methodsMap)) {
                        const params = methodInfo.params || [];
                        const paramsStr = params.length > 0 ? params.join(', ') : '';
                        html += \`<div class="method-item" onclick="jumpToMethod('\${methodInfo.file}', \${methodInfo.line})">\`;
                        html += \`<span class="method-name">\${methodName}</span>\`;
                        html += \`<span class="method-params">(\${paramsStr})</span>\`;
                        html += \`<div style="font-size: 10px; color: var(--vscode-descriptionForeground);">Line \${methodInfo.line}</div>\`;
                        html += '</div>';
                    }
                    
                    html += '</div></div>';
                }
                
                if (data.type === 'class' && data.properties > 0) {
                    html += '<div class="node-detail-section">';
                    html += '<div class="node-detail-section-title">📦 Properties</div>';
                    html += '<div class="node-detail-content">';
                    html += \`<div class="property-item">\${data.properties} properties detected</div>\`;
                    html += '</div></div>';
                }
                
                if (data.type === 'instance') {
                    html += '<div class="node-detail-section">';
                    html += '<div class="node-detail-section-title">🔗 Instance Information</div>';
                    html += '<div class="node-detail-content">';
                    html += \`<div><strong>Class:</strong> \${data.className}</div>\`;
                    html += '</div></div>';
                }
                
                if (data.type === 'refinement') {
                    // Show refinement info
                    html += '<div class="node-detail-section">';
                    html += '<div class="node-detail-section-title">🎯 Refinement Target</div>';
                    html += '<div class="node-detail-content">';
                    html += \`<div><strong>Target Class:</strong> \${data.targetObject || 'Unknown'}</div>\`;
                    html += \`<div><strong>Target Method:</strong> \${data.methodName || 'Unknown'}</div>\`;
                    if (data.layerObject) {
                        html += \`<div><strong>Layer:</strong> \${data.layerObject}</div>\`;
                    }
                    html += '</div></div>';
                    
                    // Show target method code (Original)
                    if (data.targetMethodCode) {
                        html += '<div class="node-detail-section code-section">';
                        html += '<div class="code-section-header">';
                        html += '<div class="node-detail-section-title">📄 Original Method</div>';
                        if (data.targetMethodFile && data.targetMethodFile !== 'external' && data.targetMethodLine) {
                            html += \`<button class="jump-button" onclick="jumpToMethod('\${data.targetMethodFile}', \${data.targetMethodLine})">🔗 Jump to Original</button>\`;
                        }
                        html += '</div>';
                        html += '<div class="node-detail-content">';
                        if (data.targetMethodFile === 'external') {
                            html += '<div style="padding: 12px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; font-style: italic;">';
                            html += \`ℹ️ The original method \${data.targetObject}.\${data.methodName}() is defined in another file.<br>\`;
                            html += 'Use "Go to Definition" or search to find it.';
                            html += '</div>';
                        } else {
                            html += '<pre class="code-container"><code>' + escapeHtml(data.targetMethodCode) + '</code></pre>';
                        }
                        html += '</div></div>';
                    }
                    
                    // Show refinement implementation code
                    if (data.implementationCode) {
                        html += '<div class="node-detail-section code-section">';
                        html += '<div class="code-section-header">';
                        html += '<div class="node-detail-section-title">🔧 Refinement Code</div>';
                        html += \`<button class="jump-button" onclick="jumpToMethod('\${data.file}', \${data.line})">🔗 Jump to Refinement</button>\`;
                        html += '</div>';
                        html += '<div class="node-detail-content">';
                        html += '<pre class="code-container"><code>' + escapeHtml(data.implementationCode) + '</code></pre>';
                        html += '</div></div>';
                    }
                }
                
                content.innerHTML = html;
                panel.classList.add('visible');
            } catch (error) {
                console.error('Error showing node detail:', error);
                alert('Failed to show node details: ' + error.message);
            }
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
        
        // Close detail panel handler
        const closeBtn = document.getElementById('close-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                const panel = document.getElementById('node-detail-panel');
                if (panel) {
                    panel.classList.remove('visible');
                }
            });
        }
        
        // Close panel when clicking outside
        const detailPanel = document.getElementById('node-detail-panel');
        if (detailPanel) {
            detailPanel.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('visible');
                }
            });
        }
        
        // Node interaction handlers
        let clickCount = 0;
        let clickTimer = null;
        
        // Node click handler with double-click detection
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            
            clickCount++;
            console.log('🖱️ Node clicked:', clickCount, 'times -', data.name);
            
            if (clickCount === 1) {
                // First click - wait to see if there's a second click
                clickTimer = setTimeout(() => {
                    console.log('✅ Single click confirmed -', data.name);
                    // Single click - show detail panel
                    showNodeDetail(data);
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                // Second click within timeout - it's a double click
                clearTimeout(clickTimer);
                clickCount = 0;
                
                console.log('✅✅ Double click detected -', data.name);
                console.log('🔗 Jumping to source');
                
                // Double click - jump to source
                let info = '<strong>📦 ' + data.name + '</strong><br>';
                info += 'Type: ' + data.type + '<br>';
                info += 'File: ' + data.file + '<br>';
                info += 'Line: ' + data.line;
                
                if (data.type === 'class') {
                    info += '<br>Properties: ' + (data.properties || 0);
                    const methodCount = data.methodsMap ? Object.keys(data.methodsMap).length : 0;
                    info += '<br>Methods: ' + methodCount;
                } else if (data.type === 'instance') {
                    info += '<br>Class: ' + data.className;
                }
                
                if (data.description) {
                    info += '<br><em>' + data.description + '</em>';
                }
                
                info += '<div class="clickable-hint">💡 Single-click to see details | Double-click jumps to source</div>';
                
                document.getElementById('node-info').innerHTML = info;
                
                // Navigate to source
                if (data.file && data.line) {
                    vscode.postMessage({
                        command: 'goToLocation',
                        file: data.file,
                        line: data.line
                    });
                }
            }
        });
            

        


        // Enhanced edge click handler
        cy.on('tap', 'edge', function(evt) {
            const edge = evt.target;
            const data = edge.data();
            
            let info = '<strong>🔗 ' + data.source + ' → ' + data.target + '</strong><br>';
            info += 'Type: ' + data.type + '<br>';
            
            if (data.property) {
                info += 'Property: ' + data.property + '<br>';
            }
            if (data.parameter) {
                info += 'Parameter: ' + data.parameter + '<br>';
            }
            if (data.file && data.line) {
                info += 'Location: ' + data.file + ':' + data.line + '<br>';
            }
            if (data.code) {
                info += 'Code: <code>' + data.code + '</code><br>';
            }
            if (data.description) {
                info += '<em>' + data.description + '</em>';
            }
            
            if (data.file && data.line) {
                info += '<div class="clickable-hint">💡 Click again to jump to source code!</div>';
                // Send message to VSCode to navigate to source
                vscode.postMessage({
                    command: 'goToLocation',
                    file: data.file,
                    line: data.line
                });
            }
            
            document.getElementById('node-info').innerHTML = info;
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            vscode.postMessage({
                command: 'refresh'
            });
        });

        // Initialize info panel
        document.getElementById('node-info').innerHTML = 
            '<strong>📊 Graph Summary</strong><br>' +
            'Classes: ' + cytoscapeConfig.metadata.classes + '<br>' +
            'Instances: ' + cytoscapeConfig.metadata.instances + '<br>' +
            'Dependencies: ' + cytoscapeConfig.metadata.dependencies + '<br>' +
            '<div class="clickable-hint">💡 Click nodes to navigate to source code!</div>';

            console.log('🚀 COP-lens Dependency Graph loaded in VSCode:', cytoscapeConfig.metadata);
        }
        // End of cy initialization check
        }
        // End of main validation check
        
        // Listen for runtime status updates from extension
        window.addEventListener('message', event => {
            console.log('WebView received message:', event.data);
            
            // Debug: Show in debug panel
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.innerHTML += '<br>📨 Message received: ' + JSON.stringify(event.data);
            }
            
            const message = event.data;
            
            if (message.command === 'updateRuntimeStatus') {
                console.log('Calling updateLayerRuntimeStatus...');
                updateLayerRuntimeStatus(message.layerName, message.status, message.signals);
            }
        });
        
        // Function to update layer runtime status in the detail panel
        function updateLayerRuntimeStatus(layerName, status, signals) {
            console.log('Runtime update received: ' + layerName + ' -> ' + status);
            
            // Show alert to confirm it works
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.innerHTML += '<br>Runtime: ' + layerName + ' -> ' + status;
            }
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose of current panel
     */
    dispose() {
        if (this.currentPanel) {
            this.currentPanel.dispose();
            this.currentPanel = null;
        }
    }
}

module.exports = DependencyGraphView;
