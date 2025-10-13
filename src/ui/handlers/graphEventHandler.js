/**
 * Graph Event Handler
 * Generates code for handling node/edge clicks and other graph events
 */

/**
 * Generate event handlers code
 * @returns {string} JavaScript code as string
 */
function getEventHandlersCode() {
    return `
        // Node interaction handlers
        let clickCount = 0;
        let clickTimer = null;
        
        ${generateNodeClickHandler()}
        ${generateEdgeClickHandler()}
    `;
}

/**
 * Node click handler with double-click detection
 */
function generateNodeClickHandler() {
    return `
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
    `;
}

/**
 * Edge click handler
 */
function generateEdgeClickHandler() {
    return `
        // Edge click handler
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
                vscode.postMessage({
                    command: 'goToLocation',
                    file: data.file,
                    line: data.line
                });
            }
            
            document.getElementById('node-info').innerHTML = info;
        });
    `;
}

module.exports = {
    getEventHandlersCode
};
