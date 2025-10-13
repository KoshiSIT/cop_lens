/**
 * Runtime Status Handler
 * Generates code for updating runtime status in the graph and detail panel
 */

/**
 * Generate runtime status handler code
 * @returns {string} JavaScript code as string
 */
function getRuntimeStatusHandlerCode() {
    return `
        // Function to update layer runtime status
        function updateLayerRuntimeStatus(layerName, status, signals) {
            console.log('Runtime update received: ' + layerName + ' -> ' + status);
            
            // Store runtime status
            runtimeStatusMap[layerName] = { status: status, signals: signals, timestamp: Date.now() };
            
            ${generateRuntimeNodeUpdate()}
            ${generateDetailPanelUpdate()}
        }
    `;
}

/**
 * Runtime node update in graph
 */
function generateRuntimeNodeUpdate() {
    return `
            // Add/update runtime status node in graph
            if (window.cy && typeof window.cy.getElementById === 'function') {
                const runtimeNodeId = 'runtime-' + layerName;
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
    `;
}

/**
 * Detail panel update
 */
function generateDetailPanelUpdate() {
    return `
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
    `;
}

module.exports = {
    getRuntimeStatusHandlerCode
};
