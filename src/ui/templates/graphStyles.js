/**
 * CSS Styles for Dependency Graph View
 * All styles for the Cytoscape graph visualization
 */

function getGraphStyles() {
    return `
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
        
        /* Activation Styles */
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
    `;
}

module.exports = { getGraphStyles };
