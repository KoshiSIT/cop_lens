/**
 * Dependency Graph View for VSCode WebView
 * Manages the WebView panel for displaying dependency graphs
 */

const vscode = require('vscode');
const GraphRenderer = require('../graph/graphRenderer');

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
                
            default:
                console.log('Unknown webview message:', message);
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
    
    <div class="info-panel">
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #4CAF50;"></div>
                <span>Class</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FF9800;"></div>
                <span>Instance</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #757575;"></div>
                <span>External</span>
            </div>
            <div class="legend-item">
                <div class="legend-line" style="background: #2196F3;">
                    <div style="color: #2196F3;">▶</div>
                </div>
                <span>Composition</span>
            </div>
            <div class="legend-item">
                <div class="legend-line" style="background: #9C27B0;">
                    <div style="color: #9C27B0;">▶</div>
                </div>
                <span>Aggregation</span>
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

        // Enhanced node click handler with VSCode integration
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            
            // Show info in panel
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
            
            info += '<div class="clickable-hint">💡 Click again to jump to source code!</div>';
            
            document.getElementById('node-info').innerHTML = info;
            
            // Send message to VSCode to navigate to source
            if (data.file && data.line) {
                vscode.postMessage({
                    command: 'goToLocation',
                    file: data.file,
                    line: data.line
                });
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