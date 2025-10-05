/**
 * Graph Renderer for COP-lens
 * Converts ObjectDependencyDetector results to Cytoscape.js visualization
 */

class GraphRenderer {
    constructor() {
        this.styleConfig = this.getDefaultStyles();
        this.layoutConfig = this.getDefaultLayouts();
    }

    /**
     * Convert dependency graph to Cytoscape.js format with enhanced styling
     * @param {Object} dependencyGraph - Output from ObjectDependencyDetector.getDependencyGraph()
     * @returns {Object} Complete Cytoscape.js configuration
     */
    render(dependencyGraph) {
        // Support both 'hierarchy' and 'hierarchyLevels' naming
        const hierarchyLevels = dependencyGraph.hierarchy || dependencyGraph.hierarchyLevels;
        
        // Apply hierarchy levels to nodes
        const nodesWithHierarchy = this.applyHierarchyToNodes(
            dependencyGraph.nodes,
            hierarchyLevels
        );

        const cytoscapeConfig = {
            elements: {
                nodes: this.processNodes(nodesWithHierarchy),
                edges: this.processEdges(dependencyGraph.edges)
            },
            style: this.styleConfig,
            layout: this.getHierarchyLayout(hierarchyLevels),
            metadata: {
                ...dependencyGraph.summary,
                generated: new Date().toISOString(),
                renderer: 'COP-lens GraphRenderer v1.0'
            }
        };

        return cytoscapeConfig;
    }

    /**
     * Apply hierarchy levels to nodes for positioning
     * @param {Array} nodes - Array of node objects
     * @param {Map} hierarchyLevels - Map of nodeId -> level
     * @returns {Array} Nodes with hierarchy level added
     */
    applyHierarchyToNodes(nodes, hierarchyLevels) {
        if (!hierarchyLevels) {
            console.warn('⚠️ No hierarchy levels provided, using default layout');
            return nodes;
        }

        console.log('📊 Applying hierarchy to nodes...');
        console.log('  Nodes:', nodes.length);
        console.log('  Hierarchy levels:', hierarchyLevels.size);

        const nodesWithHierarchy = nodes.map(node => {
            const level = hierarchyLevels.get(node.data.id) || 0;
            console.log(`    ${node.data.id}: level ${level}`);
            
            return {
                ...node,
                data: {
                    ...node.data,
                    hierarchyLevel: level
                }
            };
        });

        console.log('✅ Hierarchy applied to all nodes');
        return nodesWithHierarchy;
    }

    /**
     * Get hierarchy-based layout configuration
     * @param {Map} hierarchyLevels - Map of nodeId -> level
     * @returns {Object} Cytoscape layout configuration
     */
    getHierarchyLayout(hierarchyLevels) {
        if (!hierarchyLevels || hierarchyLevels.size === 0) {
            console.warn('⚠️ No hierarchy levels, falling back to COSE layout');
            return this.layoutConfig.cose;
        }

        console.log('📊 Calculating hierarchy layout...');
        console.log('  Total nodes:', hierarchyLevels.size);

        // Group nodes by level
        const nodesByLevel = new Map();
        for (const [nodeId, level] of hierarchyLevels) {
            if (!nodesByLevel.has(level)) {
                nodesByLevel.set(level, []);
            }
            nodesByLevel.get(level).push(nodeId);
        }

        console.log('  Levels found:', nodesByLevel.size);
        for (const [level, nodes] of nodesByLevel) {
            console.log(`    Level ${level}: ${nodes.length} nodes`);
        }

        // Pre-calculate positions for all nodes
        const positions = {};
        const levelSpacing = 150;
        const nodeSpacing = 200;

        for (const [level, nodesAtLevel] of nodesByLevel) {
            const nodeCount = nodesAtLevel.length;
            
            nodesAtLevel.forEach((nodeId, index) => {
                // Center nodes horizontally
                const xOffset = (index - (nodeCount - 1) / 2) * nodeSpacing;
                positions[nodeId] = {
                    x: xOffset,
                    y: level * levelSpacing
                };
                
                console.log(`    ${nodeId}: (${xOffset}, ${level * levelSpacing})`);
            });
        }

        console.log('✅ Hierarchy positions calculated:', Object.keys(positions).length, 'nodes');

        return {
            name: 'preset',
            positions: positions,
            fit: true,
            padding: 50
        };
    }

    /**
     * Process nodes for Cytoscape.js format
     * @param {Array} nodes - Raw nodes from dependency graph
     * @returns {Array} Processed nodes with enhanced metadata
     */
    processNodes(nodes) {
        return nodes.map(node => {
            const processedNode = {
                data: {
                    ...node.data,
                    // Add display-specific properties
                    displayName: this.getDisplayName(node.data),
                    tooltip: this.generateTooltip(node.data),
                    classes: this.getNodeClasses(node.data)
                }
            };

            // Add position hints for better initial layout
            if (node.data.type === 'class') {
                processedNode.classes = 'class-node';
            } else if (node.data.type === 'instance') {
                processedNode.classes = 'instance-node';
            }

            return processedNode;
        });
    }

    /**
     * Process edges for Cytoscape.js format
     * @param {Array} edges - Raw edges from dependency graph
     * @returns {Array} Processed edges with styling classes
     */
    processEdges(edges) {
        return edges.map(edge => {
            const processedEdge = {
                data: {
                    ...edge.data,
                    // Add unique edge ID
                    id: `${edge.data.source}-${edge.data.target}-${edge.data.type}`,
                    displayLabel: this.getEdgeLabel(edge.data),
                    tooltip: this.generateEdgeTooltip(edge.data),
                    classes: this.getEdgeClasses(edge.data)
                }
            };

            // Add edge-specific classes for styling
            processedEdge.classes = `${edge.data.type}-edge`;

            return processedEdge;
        });
    }

    /**
     * Generate display name for nodes
     * @param {Object} nodeData - Node data object
     * @returns {string} Display name
     */
    getDisplayName(nodeData) {
        if (nodeData.type === 'instance') {
            return `${nodeData.name}
:${nodeData.className}`;
        }
        if (nodeData.type === 'external') {
            return `${nodeData.name}
(ext)`;
        }
        return nodeData.name;
    }

    /**
     * Generate tooltip content for nodes
     * @param {Object} nodeData - Node data object
     * @returns {string} HTML tooltip content
     */
    generateTooltip(nodeData) {
        let tooltip = `<strong>${nodeData.name}</strong><br>`;
        tooltip += `Type: ${nodeData.type}<br>`;
        tooltip += `File: ${nodeData.file}<br>`;
        tooltip += `Line: ${nodeData.line}`;
        
        if (nodeData.type === 'class') {
            tooltip += `<br>Properties: ${nodeData.properties || 0}`;
            tooltip += `<br>Methods: ${nodeData.methods || 0}`;
        } else if (nodeData.type === 'instance') {
            tooltip += `<br>Class: ${nodeData.className}`;
        } else if (nodeData.type === 'external') {
            tooltip += `<br>Source: External library`;
        }

        if (nodeData.description) {
            tooltip += `<br><em>${nodeData.description}</em>`;
        }

        return tooltip;
    }

    /**
     * Generate tooltip for edges
     * @param {Object} edgeData - Edge data object  
     * @returns {string} HTML tooltip content
     */
    generateEdgeTooltip(edgeData) {
        let tooltip = `<strong>${edgeData.source} → ${edgeData.target}</strong><br>`;
        tooltip += `Relationship: ${edgeData.type}<br>`;
        
        if (edgeData.property) {
            tooltip += `Property: ${edgeData.property}<br>`;
        }
        if (edgeData.parameter) {
            tooltip += `Parameter: ${edgeData.parameter}<br>`;
        }
        if (edgeData.file && edgeData.line) {
            tooltip += `Location: ${edgeData.file}:${edgeData.line}<br>`;
        }
        if (edgeData.code) {
            tooltip += `Code: <code>${edgeData.code}</code>`;
        }
        if (edgeData.description) {
            tooltip += `<br><em>${edgeData.description}</em>`;
        }

        return tooltip;
    }

    /**
     * Get edge label for display
     * @param {Object} edgeData - Edge data object
     * @returns {string} Display label
     */
    getEdgeLabel(edgeData) {
        if (edgeData.type === 'instanceOf') {
            return '';
        }
        return edgeData.property || edgeData.parameter || '';
    }

    /**
     * Get CSS classes for nodes
     * @param {Object} nodeData - Node data object
     * @returns {string} Space-separated CSS classes
     */
    getNodeClasses(nodeData) {
        const classes = [nodeData.type];
        
        // Add special classes based on node properties
        if (nodeData.type === 'class' && nodeData.properties > 0) {
            classes.push('has-properties');
        }
        if (nodeData.type === 'instance') {
            classes.push('instance');
        }

        return classes.join(' ');
    }

    /**
     * Get CSS classes for edges
     * @param {Object} edgeData - Edge data object
     * @returns {string} Space-separated CSS classes
     */
    getEdgeClasses(edgeData) {
        return edgeData.type;
    }

    /**
     * Default Cytoscape.js styles matching the demo
     * @returns {Array} Cytoscape.js style configuration
     */
    getDefaultStyles() {
        return [
            // Node base style
            {
                selector: 'node',
                style: {
                    'width': 80,
                    'height': 80,
                    'font-size': '12px',
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'color': '#333',
                    'text-wrap': 'wrap',
                    'text-max-width': '60px',
                    'border-width': 2,
                    'border-color': '#ccc',
                    'background-fit': 'cover'
                }
            },

            // Class nodes (green)
            {
                selector: 'node[type="class"]',
                style: {
                    'background-color': '#4CAF50',
                    'label': 'data(name)',
                    'shape': 'round-rectangle',
                    'border-color': '#2E7D32'
                }
            },

            // Instance nodes (orange)
            {
                selector: 'node[type="instance"]',
                style: {
                    'background-color': '#FF9800',
                    'label': 'data(displayName)',
                    'shape': 'round-rectangle',
                    'border-color': '#E65100',
                    'font-size': '10px'
                }
            },

            // External class nodes (gray)
            {
                selector: 'node[type="external"]',
                style: {
                    'background-color': '#757575',
                    'label': 'data(name)',
                    'shape': 'round-rectangle',
                    'border-color': '#424242',
                    'font-size': '11px',
                    'opacity': 0.8
                }
            },

            // Method nodes (yellow)
            {
                selector: 'node[type="method"]',
                style: {
                    'background-color': '#FFC107',
                    'label': 'data(name)',
                    'shape': 'round-rectangle',
                    'border-color': '#FF6F00',
                    'font-size': '10px',
                    'width': 70,
                    'height': 70
                }
            },

            // Edge base style
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'font-size': '10px',
                    'text-rotation': 'autorotate',
                    'text-margin-x': 0,
                    'text-margin-y': -10
                }
            },

            // Composition edges (blue)
            {
                selector: 'edge[type="composition"]',
                style: {
                    'line-color': '#2196F3',
                    'target-arrow-color': '#2196F3',
                    'width': 3,
                    'label': 'data(displayLabel)'
                }
            },

            // Aggregation edges (purple)
            {
                selector: 'edge[type="aggregation"]',
                style: {
                    'line-color': '#9C27B0',
                    'target-arrow-color': '#9C27B0',
                    'width': 2,
                    'line-style': 'dashed',
                    'label': 'data(displayLabel)'
                }
            },

            // Association edges (gray)
            {
                selector: 'edge[type="association"]',
                style: {
                    'line-color': '#607D8B',
                    'target-arrow-color': '#607D8B',
                    'width': 2,
                    'line-style': 'dotted',
                    'label': 'data(displayLabel)'
                }
            },

            // InstanceOf edges (light gray)
            {
                selector: 'edge[type="instanceOf"]',
                style: {
                    'line-color': '#BDBDBD',
                    'target-arrow-color': '#BDBDBD',
                    'width': 1,
                    'opacity': 0.6
                }
            },

            // hasMethod edges (thin dotted)
            {
                selector: 'edge[type="hasMethod"]',
                style: {
                    'line-color': '#9E9E9E',
                    'target-arrow-color': '#9E9E9E',
                    'width': 1,
                    'line-style': 'dotted',
                    'opacity': 0.5
                }
            },

            // Selected/hover states
            {
                selector: 'node:selected',
                style: {
                    'border-width': 4,
                    'border-color': '#FF5722'
                }
            },

            {
                selector: 'edge:selected',
                style: {
                    'width': 4,
                    'line-color': '#FF5722',
                    'target-arrow-color': '#FF5722'
                }
            },

            // Highlighted state
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#FFD54F',
                    'line-color': '#FFD54F',
                    'target-arrow-color': '#FFD54F',
                    'border-color': '#FFB300'
                }
            }
        ];
    }

    /**
     * Default layout configurations
     * @returns {Object} Layout configurations
     */
    getDefaultLayouts() {
        return {
            cose: {
                name: 'cose',
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                fit: true,
                padding: 30,
                randomize: false,
                componentSpacing: 100,
                nodeRepulsion: 400000,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            },
            
            dagre: {
                name: 'dagre',
                directed: true,
                padding: 30,
                spacingFactor: 1.25,
                rankSep: 100,
                nodeSep: 50,
                edgeSep: 10,
                rankDir: 'TB'
            },

            circle: {
                name: 'circle',
                fit: true,
                padding: 30,
                radius: 200,
                startAngle: -Math.PI / 2,
                sweep: Math.PI * 2,
                clockwise: true
            },

            grid: {
                name: 'grid',
                fit: true,
                padding: 30,
                boundingBox: undefined,
                avoidOverlap: true,
                rows: undefined,
                cols: undefined
            }
        };
    }

    /**
     * Generate complete HTML page for WebView
     * @param {Object} cytoscapeConfig - Processed Cytoscape.js configuration
     * @param {string} title - Page title
     * @returns {string} Complete HTML content
     */
    generateHTML(cytoscapeConfig, title = 'COP-lens Dependency Graph') {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.21.1/cytoscape.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #1e1e1e;
            color: #d4d4d4;
        }
        
        .header {
            padding: 10px 20px;
            background-color: #2d2d30;
            border-bottom: 1px solid #3e3e42;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
        
        .controls {
            display: flex;
            gap: 8px;
        }
        
        .control-btn {
            padding: 4px 8px;
            background-color: #0e639c;
            border: none;
            border-radius: 2px;
            color: white;
            font-size: 11px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .control-btn:hover {
            background-color: #1177bb;
        }
        
        .control-btn.active {
            background-color: #007acc;
        }
        
        #cy {
            width: 100%;
            height: calc(100vh - 60px);
            background-color: #1e1e1e;
        }
        
        .info-panel {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background-color: #2d2d30;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            padding: 10px;
            max-width: 300px;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        
        .legend {
            display: flex;
            gap: 15px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }
        
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            border: 1px solid #666;
        }
        
        .legend-line {
            width: 20px;
            height: 2px;
            position: relative;
        }
        
        .legend-line::after {
            content: '';
            position: absolute;
            right: -4px;
            top: -2px;
            width: 0;
            height: 0;
            border-left: 4px solid;
            border-top: 2px solid transparent;
            border-bottom: 2px solid transparent;
        }
        
        #node-info {
            margin-top: 8px;
            min-height: 30px;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${title}</h1>
        <div class="controls">
            <button class="control-btn active" id="layout-cose">COSE</button>
            <button class="control-btn" id="layout-dagre">Dagre</button>
            <button class="control-btn" id="layout-circle">Circle</button>
            <button class="control-btn" id="layout-grid">Grid</button>
            <button class="control-btn" id="fit-btn">Fit</button>
            <button class="control-btn" id="center-btn">Center</button>
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
            Click nodes or edges to view details. Drag to move, scroll to zoom.
        </div>
    </div>

    <script>
        const cytoscapeConfig = ${JSON.stringify(cytoscapeConfig, null, 2)};
        
        // Initialize Cytoscape
        const cy = cytoscape({
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

        // Event handlers
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            
            let info = \`<strong>📦 \${data.name}</strong><br>\`;
            info += \`Type: \${data.type}<br>\`;
            info += \`File: \${data.file}<br>\`;
            info += \`Line: \${data.line}\`;
            
            if (data.type === 'class') {
                info += \`<br>Properties: \${data.properties || 0}\`;
                info += \`<br>Methods: \${data.methods || 0}\`;
            } else if (data.type === 'instance') {
                info += \`<br>Class: \${data.className}\`;
            }
            
            if (data.description) {
                info += \`<br><em>\${data.description}</em>\`;
            }
            
            document.getElementById('node-info').innerHTML = info;
        });

        cy.on('tap', 'edge', function(evt) {
            const edge = evt.target;
            const data = edge.data();
            
            let info = \`<strong>🔗 \${data.source} → \${data.target}</strong><br>\`;
            info += \`Type: \${data.type}<br>\`;
            
            if (data.property) {
                info += \`Property: \${data.property}<br>\`;
            }
            if (data.parameter) {
                info += \`Parameter: \${data.parameter}<br>\`;
            }
            if (data.file && data.line) {
                info += \`Location: \${data.file}:\${data.line}<br>\`;
            }
            if (data.code) {
                info += \`Code: <code>\${data.code}</code><br>\`;
            }
            if (data.description) {
                info += \`<em>\${data.description}</em>\`;
            }
            
            document.getElementById('node-info').innerHTML = info;
        });

        // Layout controls
        document.getElementById('layout-cose').addEventListener('click', () => {
            setActiveButton('layout-cose');
            cy.layout(cytoscapeConfig.layout).run();
        });

        document.getElementById('layout-dagre').addEventListener('click', () => {
            setActiveButton('layout-dagre');
            cy.layout({name: 'breadthfirst', directed: true, fit: true, padding: 30}).run();
        });

        document.getElementById('layout-circle').addEventListener('click', () => {
            setActiveButton('layout-circle');
            cy.layout({name: 'circle', fit: true, padding: 30}).run();
        });

        document.getElementById('layout-grid').addEventListener('click', () => {
            setActiveButton('layout-grid');
            cy.layout({name: 'grid', fit: true, padding: 30}).run();
        });

        document.getElementById('fit-btn').addEventListener('click', () => {
            cy.fit();
        });

        document.getElementById('center-btn').addEventListener('click', () => {
            cy.center();
        });

        function setActiveButton(activeId) {
            document.querySelectorAll('.control-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById(activeId).classList.add('active');
        }

        // Initialize info
        document.getElementById('node-info').innerHTML = \`
            <strong>📊 Graph Summary</strong><br>
            Classes: \${cytoscapeConfig.metadata.classes}<br>
            Instances: \${cytoscapeConfig.metadata.instances}<br>
            Dependencies: \${cytoscapeConfig.metadata.dependencies}<br>
            <small>Generated: \${new Date(cytoscapeConfig.metadata.generated).toLocaleString()}</small>
        \`;

        console.log('🚀 COP-lens Dependency Graph loaded:', cytoscapeConfig.metadata);
    </script>
</body>
</html>`;
    }
}

module.exports = GraphRenderer;
