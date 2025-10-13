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
            console.log('🔄 Runtime update: ' + layerName + ' -> ' + status);
            
            // Store runtime status
            runtimeStatusMap[layerName] = { status: status, signals: signals, timestamp: Date.now() };
            
            ${generateDetailPanelUpdate()}
        }
    `;
}



/**
 * Detail panel update
 */
function generateDetailPanelUpdate() {
    return `
            // Update detail panel if open
            const detailPanel = document.getElementById('node-detail-panel');
            if (!detailPanel || !detailPanel.classList.contains('visible')) {
                return; // Panel not open
            }
            
            const detailTitle = document.getElementById('detail-title');
            if (!detailTitle) return;
            
            // Check if this is the refinement related to this layer
            const titleText = detailTitle.textContent;
            
            // Get the current node data from the graph
            let currentNodeData = null;
            if (window.cy) {
                // Strategy 1: Find the layer node first, then find refinements connected to it
                const layerNodes = window.cy.nodes('[type="layer"]');
                let targetLayerNode = null;
                
                for (let i = 0; i < layerNodes.length; i++) {
                    const layerNode = layerNodes[i];
                    const layerData = layerNode.data();
                    
                    // Match by layer name (from runtime) - try both name and layerName properties
                    if (layerData.name === layerName || layerData.layerName === layerName) {
                        targetLayerNode = layerNode;
                        break;
                    }
                }
                
                if (targetLayerNode) {
                    // Find refinement nodes connected to this layer
                    const layerId = targetLayerNode.data().id;
                    const connectedEdges = window.cy.edges('[source="' + layerId + '"]');
                    
                    for (let i = 0; i < connectedEdges.length; i++) {
                        const edge = connectedEdges[i];
                        const targetNodeId = edge.data().target;
                        const targetNode = window.cy.getElementById(targetNodeId);
                        
                        if (targetNode.length > 0) {
                            const targetData = targetNode.data();
                            
                            // Check if this is a refinement and if it's currently displayed
                            if (targetData.type === 'refinement') {
                                const panel = document.getElementById('node-detail-panel');
                                const detailTitle = document.getElementById('detail-title');
                                if (panel && detailTitle) {
                                    const titleText = detailTitle.textContent;
                                    // Check if this refinement is currently displayed
                                    if (titleText.indexOf(targetData.name) !== -1 || 
                                        titleText.indexOf(targetData.id) !== -1) {
                                        currentNodeData = targetData;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // If we found the node and it's currently displayed, re-render the detail panel
            if (currentNodeData) {
                console.log('🔄 Re-rendering detail panel for: ' + layerName);
                showNodeDetail(currentNodeData);
            }
    `;
}

module.exports = {
    getRuntimeStatusHandlerCode
};
