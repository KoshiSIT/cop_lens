/**
 * Timeline View
 * 
 * Displays runtime events in a timeline visualization using Vis.js
 */

const vscode = require('vscode');
const path = require('path');

class TimelineView {
    constructor(context, runtimeEventHandler) {
        this.context = context;
        this.runtimeEventHandler = runtimeEventHandler;
        this.panel = null;
        this.events = [];
    }

    /**
     * Show timeline view
     */
    show() {
        // Create or reveal webview panel
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'copTimeline',
            '📊 COP Timeline',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = null;
            },
            null,
            this.context.subscriptions
        );

        // Load existing events
        this.loadExistingEvents();
    }

    /**
     * Load existing events from RuntimeEventHandler
     */
    loadExistingEvents() {
        if (!this.runtimeEventHandler) {
            return;
        }

        const layerStates = this.runtimeEventHandler.getAllLayerStates();
        const events = [];

        // Convert layer states to timeline events
        layerStates.forEach((state, layerName) => {
            // Add activation events
            if (state.status === 'ACTIVE' || state.status === 'INACTIVE') {
                events.push({
                    id: `${layerName}_${state.lastUpdate}`,
                    content: state.status === 'ACTIVE' ? '🟠' : '⚪',
                    start: new Date(state.lastUpdate),
                    type: 'point',
                    className: state.status === 'ACTIVE' ? 'event-active' : 'event-inactive',
                    title: `${layerName}: ${state.status}<br>at ${new Date(state.lastUpdate).toLocaleTimeString()}`,
                    data: {
                        layerName,
                        status: state.status,
                        signals: state.signals,
                        timestamp: state.lastUpdate
                    }
                });
            }
        });

        if (events.length > 0) {
            this.sendToWebview({
                command: 'loadEvents',
                events: events
            });
        }
    }

    /**
     * Add new event to timeline
     */
    addEvent(event) {
        console.log('📊 [Timeline] Adding event:', event.type, event.timestamp);
        this.events.push(event);

        if (this.panel) {
            const timelineEvent = this.convertToTimelineEvent(event);
            console.log('📊 [Timeline] Converted event:', timelineEvent);
            this.sendToWebview({
                command: 'addEvent',
                event: timelineEvent
            });
        } else {
            console.log('📊 [Timeline] Panel not visible, event queued');
        }
    }

    /**
     * Convert runtime event to Vis.js timeline event
     */
    convertToTimelineEvent(event) {
        let content = '';
        let className = '';
        let title = '';

        switch (event.type) {
            case 'layer:deploy':
                content = '🟩';
                className = 'event-deploy';
                title = `Layer Deployed: ${event.data.layerName}`;
                break;
            case 'layer:activate':
                content = '🟠';
                className = 'event-activate';
                title = `Layer Activated: ${event.data.layerName}`;
                break;
            case 'layer:deactivate':
                content = '⚪';
                className = 'event-deactivate event-large';
                title = `Layer Deactivated: ${event.data.layerName}`;
                break;
            case 'refinement:add':
                content = '🟡';
                className = 'event-refinement';
                title = `Refinement Added: ${event.data.className}.${event.data.methodName}`;
                break;
            default:
                content = '●';
                className = 'event-default';
                title = event.type;
        }

        return {
            id: `${event.type}_${event.timestamp}`,
            content: content,
            start: new Date(event.timestamp),
            type: 'point',
            className: className,
            title: title,
            data: event.data
        };
    }

    /**
     * Send message to webview
     */
    sendToWebview(message) {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * Handle messages from webview
     */
    handleMessage(message) {
        switch (message.command) {
            case 'eventClicked':
                console.log('Event clicked:', message.eventId);
                // TODO: Show detail panel
                break;
            case 'ready':
                console.log('Timeline webview ready');
                this.loadExistingEvents();
                break;
        }
    }

    /**
     * Get webview HTML content
     */
    getWebviewContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>COP Timeline</title>
    
    <!-- Vis.js Timeline CSS -->
    <link href="https://unpkg.com/vis-timeline@7.7.3/styles/vis-timeline-graph2d.min.css" rel="stylesheet" type="text/css" />
    
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        
        h2 {
            margin-top: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        #timeline-container {
            width: 100%;
            height: 200px;
            border: 1px solid var(--vscode-editorWidget-border);
            background: var(--vscode-editor-background);
        }
        
        .vis-timeline {
            border: none;
            font-family: var(--vscode-font-family);
        }
        
        .vis-item {
            border: 2px solid white !important;
            background: rgba(255, 255, 255, 0.1) !important;
            font-size: 32px !important;
            padding: 4px !important;
        }
        
        .event-activate .vis-item-content {
            color: #FF9800;
        }
        
        .event-deactivate .vis-item-content {
            color: #9E9E9E;
            font-size: 24px;
        }
        
        .event-deploy .vis-item-content {
            color: #4CAF50;
        }
        
        .event-refinement .vis-item-content {
            color: #FFD700;
        }
        
        .vis-item.vis-selected {
            background: var(--vscode-list-activeSelectionBackground);
        }
        
        #info {
            margin-top: 20px;
            padding: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
        }
        
        #event-detail {
            margin-top: 20px;
            padding: 16px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            display: none;
        }
        
        #event-detail.visible {
            display: block;
        }
        
        .detail-row {
            margin: 8px 0;
        }
        
        .detail-label {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <h2>📱 RemoteEditor - Event Timeline</h2>
    
    <div id="info">
        <strong>Events:</strong> <span id="event-count">0</span> |
        <strong>Time Range:</strong> <span id="time-range">-</span>
    </div>
    
    <div id="timeline-container"></div>
    
    <div id="event-detail">
        <h3>Event Details</h3>
        <div id="detail-content"></div>
    </div>
    
    <!-- Vis.js Timeline JS -->
    <script src="https://unpkg.com/vis-timeline@7.7.3/standalone/umd/vis-timeline-graph2d.min.js"></script>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Initialize timeline
        const container = document.getElementById('timeline-container');
        const options = {
            height: '200px',
            margin: {
                item: 10,
                axis: 5
            },
            zoomMin: 1000,
            zoomMax: 1000 * 60 * 60 * 24,
            orientation: 'top',
            selectable: true,
            multiselect: false
        };
        
        const items = new vis.DataSet([]);
        const timeline = new vis.Timeline(container, items, options);
        
        // Event selection
        timeline.on('select', function (properties) {
            if (properties.items.length > 0) {
                const itemId = properties.items[0];
                const item = items.get(itemId);
                showEventDetail(item);
                
                vscode.postMessage({
                    command: 'eventClicked',
                    eventId: itemId,
                    data: item.data
                });
            }
        });
        
        // Show event detail
        function showEventDetail(item) {
            const detailPanel = document.getElementById('event-detail');
            const detailContent = document.getElementById('detail-content');
            
            let html = '<div class="detail-row">';
            html += '<span class="detail-label">Event:</span> ' + item.content + ' ' + item.title;
            html += '</div>';
            
            html += '<div class="detail-row">';
            html += '<span class="detail-label">Time:</span> ' + item.start.toLocaleString();
            html += '</div>';
            
            if (item.data) {
                html += '<div class="detail-row">';
                html += '<span class="detail-label">Data:</span><br>';
                html += '<pre>' + JSON.stringify(item.data, null, 2) + '</pre>';
                html += '</div>';
            }
            
            detailContent.innerHTML = html;
            detailPanel.classList.add('visible');
        }
        
        // Update info
        function updateInfo() {
            const count = items.length;
            document.getElementById('event-count').textContent = count;
            
            if (count > 0) {
                const allItems = items.get();
                const times = allItems.map(item => item.start.getTime());
                const minTime = new Date(Math.min(...times));
                const maxTime = new Date(Math.max(...times));
                const duration = (maxTime - minTime) / 1000;
                
                document.getElementById('time-range').textContent = 
                    duration.toFixed(1) + 's (' + minTime.toLocaleTimeString() + ' - ' + maxTime.toLocaleTimeString() + ')';
            } else {
                document.getElementById('time-range').textContent = '-';
            }
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('📊 [Timeline WebView] Received message:', message.command, message);
            
            switch (message.command) {
                case 'loadEvents':
                    console.log('📊 [Timeline WebView] Loading events:', message.events.length);
                    items.clear();
                    items.add(message.events);
                    updateInfo();
                    timeline.fit();
                    break;
                    
                case 'addEvent':
                    console.log('📊 [Timeline WebView] Adding event:', message.event);
                    items.add(message.event);
                    updateInfo();
                    timeline.fit();
                    break;
                    
                case 'clear':
                    console.log('📊 [Timeline WebView] Clearing events');
                    items.clear();
                    updateInfo();
                    break;
            }
        });
        
        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
    }
}

module.exports = TimelineView;
