/**
 * Timeline View
 * 
 * Displays runtime events in a simple timeline visualization
 * Pure HTML/CSS/JS implementation (no external libraries)
 */

const vscode = require('vscode');

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

        // Send queued events
        if (this.events.length > 0) {
            console.log(`📊 [Timeline] Sending ${this.events.length} queued events`);
            this.sendToWebview({
                command: 'loadEvents',
                events: this.events
            });
        }
    }

    /**
     * Add new event to timeline
     */
    addEvent(event) {
        console.log('📊 [Timeline] Adding event:', event.type, event.timestamp);
        
        const timelineEvent = {
            type: event.type,
            timestamp: event.timestamp,
            data: event.data
        };
        
        this.events.push(timelineEvent);

        if (this.panel) {
            this.sendToWebview({
                command: 'addEvent',
                event: timelineEvent
            });
        } else {
            console.log('📊 [Timeline] Panel not visible, event queued');
        }
    }

    /**
     * Clear all events from timeline
     */
    clear() {
        console.log('📊 [Timeline] Clearing all events');
        this.events = [];

        if (this.panel) {
            this.sendToWebview({
                command: 'clear'
            });
        }
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
                console.log('📊 [Timeline] Event clicked:', message.event);
                // TODO: Show detail panel or jump to code
                break;
            case 'ready':
                console.log('📊 [Timeline] WebView ready');
                // Send all existing events
                if (this.events.length > 0) {
                    this.sendToWebview({
                        command: 'loadEvents',
                        events: this.events
                    });
                }
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
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        
        h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        
        #info {
            margin-bottom: 16px;
            padding: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
        }
        
        .timeline-container {
            position: relative;
            margin-bottom: 24px;
        }
        
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
        }
        
        .timeline-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .zoom-button {
            padding: 4px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .zoom-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .zoom-level {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .timeline-track {
            position: relative;
            height: 150px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            overflow-x: auto;
            overflow-y: hidden;
        }
        
        .time-scale {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 20px;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-editorWidget-border);
        }
        
        .events-layer {
            position: absolute;
            top: 20px;
            left: 0;
            width: 100%;
            bottom: 0;
            transition: width 0.2s ease;
            padding: 0 20px;
        }
        
        .event {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        
        .event:hover {
            transform: translate(-50%, -50%) scale(1.3);
            box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
            z-index: 10;
        }
        
        .event.large {
            width: 32px;
            height: 32px;
            font-size: 24px;
        }
        
        .event-mint {
            background: #98D8C8;
        }
        
        .event-yellow {
            background: #FFD700;
        }
        
        .event-orange {
            background: #FF9800;
        }
        
        .event-gray {
            background: #9E9E9E;
        }
        
        .event-blue {
            background: #2196F3;
        }
        
        .event-green {
            background: #4CAF50;
        }
        
        .tooltip {
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 12px;
            background: var(--vscode-editorHoverWidget-background);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            font-size: 12px;
            z-index: 100;
        }
        
        .event:hover .tooltip {
            opacity: 1;
        }
        
        #event-detail {
            padding: 16px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            display: none;
        }
        
        #event-detail.visible {
            display: block;
        }
        
        #event-detail h3 {
            font-size: 16px;
            margin-bottom: 12px;
        }
        
        .detail-row {
            margin: 8px 0;
            line-height: 1.6;
        }
        
        .detail-label {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        pre {
            margin-top: 4px;
            padding: 8px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h2>Timeline</h2>
    
    <div id="info">
        <strong>Events:</strong> <span id="event-count">0</span>
    </div>
    
    <div class="timeline-container">
        <div class="timeline-header">
            <span>📱 RemoteEditor</span>
            <div class="timeline-controls">
                <button class="zoom-button" onclick="zoomOut()">-</button>
                <span class="zoom-level" id="zoom-level">100%</span>
                <button class="zoom-button" onclick="zoomIn()">+</button>
                <button class="zoom-button" onclick="zoomFit()">Fit</button>
            </div>
            <span id="event-count-2">0 events</span>
        </div>
        
        <div class="timeline-track">
            <div class="time-scale" id="time-scale">
                <!-- Time labels will be inserted here -->
            </div>
            <div class="events-layer" id="events-layer">
                <!-- Events will be inserted here -->
            </div>
        </div>
    </div>
    
    <div id="event-detail">
        <h3>Event Details</h3>
        <div id="detail-content"></div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        let events = [];
        let minTime = null;
        let maxTime = null;
        let zoomLevel = 1.0; // 1.0 = 100%
        
        // Event type configuration
        const EVENT_CONFIG = {
            'layer:created': {
                emoji: '🟢',
                className: 'event-mint',
                label: 'Layer Created'
            },
            'layer:deploy': {
                emoji: '🟩',
                className: 'event-green',
                label: 'Layer Deployed'
            },
            'layer:activate': {
                emoji: '🟠',
                className: 'event-orange',
                label: 'Layer Activated'
            },
            'layer:deactivate': {
                emoji: '🔵',
                className: 'event-blue large',
                label: 'Layer Deactivated'
            },
            'refinement:add': {
                emoji: '🟡',
                className: 'event-yellow',
                label: 'Refinement Added'
            }
        };
        
        // Update time scale
        function updateTimeScale() {
            if (events.length === 0) {
                return;
            }
            
            const timestamps = events.map(e => e.timestamp);
            minTime = Math.min(...timestamps);
            maxTime = Math.max(...timestamps);
            const range = maxTime - minTime || 1000;
            
            const timeScale = document.getElementById('time-scale');
            timeScale.innerHTML = '';
            
            // Create 5 time labels (relative to minTime = 0)
            for (let i = 0; i <= 4; i++) {
                const relativeTime = (range * i / 4);
                const label = document.createElement('span');
                label.textContent = relativeTime.toFixed(0) + 'ms';
                timeScale.appendChild(label);
            }
        }
        
        // Calculate position (with margins)
        function calculatePosition(timestamp) {
            if (!minTime || !maxTime || minTime === maxTime) {
                return 50;
            }
            const range = maxTime - minTime;
            const position = ((timestamp - minTime) / range);
            
            // Add 2% margin on both sides to prevent cutoff
            const margin = 0.02;
            return (margin + position * (1 - 2 * margin)) * 100;
        }
        
        // Render events
        function renderEvents() {
            const eventsLayer = document.getElementById('events-layer');
            eventsLayer.innerHTML = '';
            
            events.forEach((event, index) => {
                const config = EVENT_CONFIG[event.type] || {
                    emoji: '●',
                    className: 'event-default',
                    label: event.type
                };
                
                const eventEl = document.createElement('div');
                eventEl.className = 'event ' + config.className;
                eventEl.style.left = calculatePosition(event.timestamp) + '%';
                eventEl.textContent = config.emoji;
                eventEl.dataset.index = index;
                
                // Tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                const relativeTime = (event.timestamp - minTime).toFixed(0);
                tooltip.textContent = config.label + ' at +' + relativeTime + 'ms';
                eventEl.appendChild(tooltip);
                
                // Click handler
                eventEl.addEventListener('click', () => {
                    showEventDetail(event);
                    vscode.postMessage({
                        command: 'eventClicked',
                        event: event
                    });
                });
                
                eventsLayer.appendChild(eventEl);
            });
            
            updateInfo();
        }
        
        // Update info
        function updateInfo() {
            document.getElementById('event-count').textContent = events.length;
            document.getElementById('event-count-2').textContent = events.length + ' events';
        }
        
        // Show event detail
        function showEventDetail(event) {
            const config = EVENT_CONFIG[event.type] || { label: event.type };
            const detailPanel = document.getElementById('event-detail');
            const detailContent = document.getElementById('detail-content');
            
            let html = '<div class="detail-row">';
            html += '<span class="detail-label">Event:</span> ' + config.label;
            html += '</div>';
            
            html += '<div class="detail-row">';
            const relativeTime = (event.timestamp - minTime).toFixed(0);
            html += '<span class="detail-label">Time:</span> +' + relativeTime + 'ms (from start)';
            html += '</div>';
            
            if (event.data) {
                html += '<div class="detail-row">';
                html += '<span class="detail-label">Data:</span>';
                html += '<pre>' + JSON.stringify(event.data, null, 2) + '</pre>';
                html += '</div>';
            }
            
            detailContent.innerHTML = html;
            detailPanel.classList.add('visible');
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('📊 [Timeline WebView] Received:', message.command);
            
            switch (message.command) {
                case 'loadEvents':
                    console.log('📊 [Timeline WebView] Loading', message.events.length, 'events');
                    events = message.events;
                    updateTimeScale();
                    renderEvents();
                    break;
                    
                case 'addEvent':
                    console.log('📊 [Timeline WebView] Adding event:', message.event.type);
                    events.push(message.event);
                    updateTimeScale();
                    renderEvents();
                    break;
                    
                case 'clear':
                    console.log('📊 [Timeline WebView] Clearing all events');
                    events = [];
                    minTime = null;
                    maxTime = null;
                    document.getElementById('time-scale').innerHTML = '';
                    document.getElementById('event-detail').classList.remove('visible');
                    renderEvents();
                    break;
            }
        });
        
        // Zoom functions
        function zoomIn() {
            zoomLevel = Math.min(zoomLevel * 1.5, 10.0);
            updateZoom();
        }
        
        function zoomOut() {
            zoomLevel = Math.max(zoomLevel / 1.5, 0.1);
            updateZoom();
        }
        
        function zoomFit() {
            zoomLevel = 1.0;
            updateZoom();
        }
        
        function updateZoom() {
            const eventsLayer = document.getElementById('events-layer');
            eventsLayer.style.width = (zoomLevel * 100) + '%';
            
            document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
            
            // Re-render events with new positions
            renderEvents();
        }
        
        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });
        console.log('📊 [Timeline WebView] Ready');
    </script>
</body>
</html>`;
    }
}

module.exports = TimelineView;
