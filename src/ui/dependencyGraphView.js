/**
 * Dependency Graph View for VSCode WebView
 * Manages the WebView panel for displaying dependency graphs
 */

const vscode = require('vscode');
const GraphRenderer = require('../graph/graphRenderer');
const logger = require('../utils/logger');
const { getGraphStyles } = require('./templates/graphStyles');
const { generateGraphTemplate } = require('./templates/graphTemplate');
const { generateGraphScript } = require('./templates/graphScript');

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
        // Generate HTML template
        const htmlTemplate = generateGraphTemplate(title, fileName);
        
        // Generate script content
        const scriptContent = generateGraphScript(cytoscapeConfig);
        
        // Combine template and script
        return htmlTemplate.replace('{{SCRIPT_CONTENT}}', scriptContent);
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
