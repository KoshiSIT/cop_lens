/**
 * Dependency Graph View for VSCode WebView
 * Manages the WebView panel for displaying dependency graphs
 */

const vscode = require('vscode');
const GraphRenderer = require('../graph/graphRenderer');
const logger = require('../utils/logger');
const { getGraphStyles } = require('./templates/graphStyles');

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
        const vscode = acquireVsCodeApi();
        
        // Store runtime status for all layers
        const runtimeStatusMap = {};
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
            if (debugElement) debugElement.innerHTML = debugInfo;
        } else if (typeof cytoscape === 'undefined') {
            console.error('❌ Cytoscape.js not loaded!');
            debugInfo += '<strong style="color: #ffaa00;">❌ Cytoscape.js library not loaded!</strong><br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
        
        } else {
            debugInfo += '<strong style="color: #00ff00;">✅ All checks passed!</strong><br>';
            if (debugElement) debugElement.innerHTML = debugInfo;
            
            // Initialize Cytoscape
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
                
                // Runtime status section (if available for this layer)
                const layerName = data.layerObject || data.name;
                if (runtimeStatusMap[layerName]) {
                    const runtime = runtimeStatusMap[layerName];
                    const isActive = runtime.status === 'ACTIVE';
                    const statusColor = isActive ? '#4CAF50' : '#999';
                    const statusBg = isActive ? 'rgba(76,175,80,0.1)' : 'rgba(150,150,150,0.1)';
                    const statusIcon = isActive ? '🟢' : '⚪';
                    
                    html += '<div class="node-detail-section" style="border: 2px solid ' + statusColor + '; background: ' + statusBg + ';">';
                    html += '<div class="node-detail-section-title">' + statusIcon + ' Activation</div>';
                    html += '<div class="node-detail-content">';
                    html += '<div><strong>Activation:</strong> ' + runtime.status + '</div>';
                    if (runtime.signals && Object.keys(runtime.signals).length > 0) {
                        html += '<div style="margin-top: 8px;"><strong>Signals:</strong></div>';
                        html += '<div style="font-size: 12px; font-family: monospace;">' + JSON.stringify(runtime.signals, null, 2) + '</div>';
                    }
                    const timeAgo = Math.round((Date.now() - runtime.timestamp) / 1000);
                    html += '<div style="margin-top: 8px; font-size: 11px; color: var(--vscode-descriptionForeground);">Updated ' + timeAgo + 's ago</div>';
                    html += '</div></div>';
                }
                
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
            
            const message = event.data;
            
            if (message.command === 'updateRuntimeStatus') {
                console.log('Calling updateLayerRuntimeStatus...');
                updateLayerRuntimeStatus(message.layerName, message.status, message.signals);
            }
        });
        
        // Function to update layer runtime status in the detail panel
        function updateLayerRuntimeStatus(layerName, status, signals) {
            console.log('Runtime update received: ' + layerName + ' -> ' + status);
            
            // Store runtime status
            runtimeStatusMap[layerName] = { status: status, signals: signals, timestamp: Date.now() };
            
            // Add runtime status node to graph
            if (window.cy && typeof window.cy.getElementById === 'function') {
                const runtimeNodeId = 'runtime-' + layerName;
                
                // Check if runtime node already exists
                let runtimeNode = window.cy.getElementById(runtimeNodeId);
                
                if (runtimeNode.length === 0) {
                    // Create new runtime status node
                    window.cy.add({
                        group: 'nodes',
                        data: {
                            id: runtimeNodeId,
                            label: 'Runtime: ' + layerName,
                            type: 'runtime',
                            status: status
                        },
                        position: { x: 100, y: 100 }
                    });
                    runtimeNode = window.cy.getElementById(runtimeNodeId);
                } else {
                    // Update existing node
                    runtimeNode.data('status', status);
                }
                
                // Update node style based on status
                if (status === 'ACTIVE') {
                    runtimeNode.style({
                        'background-color': '#4CAF50',
                        'border-width': 3,
                        'border-color': '#2E7D32'
                    });
                } else {
                    runtimeNode.style({
                        'background-color': '#999',
                        'border-width': 2,
                        'border-color': '#666'
                    });
                }
                
                console.log('Runtime node updated in graph');
            }
            
            // Update in detail panel if open
            const detailPanel = document.getElementById('node-detail-panel');
            if (!detailPanel || !detailPanel.classList.contains('visible')) {
                return; // Panel not open
            }
            
            const detailTitle = document.getElementById('detail-title');
            if (!detailTitle) return;
            
            // Check if this is the correct layer
            const titleText = detailTitle.textContent;
            if (titleText.indexOf(layerName) === -1 && titleText.indexOf('onlineLayerDefinition') === -1) {
                return; // Different layer
            }
            
            // Add runtime status at the top of detail content
            const detailContent = document.getElementById('detail-content');
            if (!detailContent) return;
            
            // Remove existing runtime status if present
            const existingStatus = detailContent.querySelector('.runtime-status-display');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            // Create new runtime status display
            const statusDiv = document.createElement('div');
            statusDiv.className = 'runtime-status-display';
            statusDiv.style.cssText = 'padding: 12px; margin-bottom: 12px; border: 2px solid ' + (status === 'ACTIVE' ? '#4CAF50' : '#999') + '; border-radius: 4px; background: ' + (status === 'ACTIVE' ? 'rgba(76,175,80,0.1)' : 'rgba(150,150,150,0.1)') + ';';
            
            const statusText = document.createElement('div');
            statusText.style.cssText = 'font-weight: bold; font-size: 14px;';
            statusText.textContent = 'Activation: ' + status;
            
            statusDiv.appendChild(statusText);
            
            // Add signals if present
            if (signals && Object.keys(signals).length > 0) {
                const signalsText = document.createElement('div');
                signalsText.style.cssText = 'margin-top: 8px; font-size: 12px;';
                signalsText.textContent = 'Signals: ' + JSON.stringify(signals);
                statusDiv.appendChild(signalsText);
            }
            
            // Insert at the beginning
            detailContent.insertBefore(statusDiv, detailContent.firstChild);
            
            console.log('Runtime status updated in detail panel');
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
