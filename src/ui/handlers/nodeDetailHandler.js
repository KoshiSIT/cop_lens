/**
 * Node Detail Handler
 * Generates code for displaying node details in the panel
 */

/**
 * Generate node detail handler code
 * @returns {string} JavaScript code as string
 */
function getNodeDetailHandlerCode() {
    return `
        // Function to show node detail panel
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
                
                // Build content
                let html = '';
                
                ${generateRuntimeStatusSection()}
                ${generateBasicInfoSection()}
                ${generateTypeSpecificSections()}
                
                content.innerHTML = html;
                panel.classList.add('visible');
            } catch (error) {
                console.error('Error showing node detail:', error);
                alert('Failed to show node details: ' + error.message);
            }
        }
    `;
}

/**
 * Runtime status section
 */
function generateRuntimeStatusSection() {
    return `
                // Runtime status section (if available for this layer)
                // Use layerName (actual layer.name) instead of layerObject (variable name)
                const layerName = data.layerName || data.name;
                
                const runtime = runtimeStatusMap[layerName];
                const isActive = runtime && runtime.status === 'ACTIVE';
                
                // Runtime status is now shown inline with each code section (ACTIVE/INACTIVE badges)
                // No need for a separate Activation section at the top
    `;
}

/**
 * Basic info section
 */
function generateBasicInfoSection() {
    return `
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
    `;
}

/**
 * Type-specific sections (class, instance, refinement)
 */
function generateTypeSpecificSections() {
    return `
                // Type-specific content
                if (data.type === 'class' && data.methodsMap) {
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
                    // Check runtime status for this refinement's layer
                    // Use layerName (actual layer.name) instead of layerObject (variable name)
                    const layerName = data.layerName || data.name;
                    const runtime = runtimeStatusMap[layerName];
                    const isActive = runtime && runtime.status === 'ACTIVE';
                    
                    html += '<div class="node-detail-section">';
                    html += '<div class="node-detail-section-title">🎯 Refinement Target</div>';
                    html += '<div class="node-detail-content">';
                    html += \`<div><strong>Target Class:</strong> \${data.targetObject || 'Unknown'}</div>\`;
                    html += \`<div><strong>Target Method:</strong> \${data.methodName || 'Unknown'}</div>\`;
                    if (data.layerObject) {
                        html += \`<div><strong>Layer:</strong> \${data.layerObject}</div>\`;
                    }
                    html += '</div></div>';
                    
                    // Determine which code is currently active
                    const originalActive = !isActive;
                    const refinementActive = isActive;
                    
                    // Original Method Section
                    if (data.targetMethodCode) {
                        const opacity = originalActive ? '1.0' : '0.4';
                        const borderColor = originalActive ? 'var(--vscode-editorInfo-foreground)' : 'var(--vscode-editorWidget-border)';
                        const bgColor = originalActive ? 'var(--vscode-editor-background)' : 'var(--vscode-editorWidget-background)';
                        const badge = originalActive ? '🟢 ACTIVE' : '⚪ INACTIVE';
                        
                        html += '<div class="node-detail-section code-section" style="opacity: ' + opacity + '; border-left: 3px solid ' + borderColor + ';">';
                        html += '<div class="code-section-header">';
                        html += '<div class="node-detail-section-title">📄 Original Method <span style="margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ' + (originalActive ? 'rgba(76,175,80,0.2)' : 'rgba(150,150,150,0.2)') + ';">' + badge + '</span></div>';
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
                            html += '<pre class="code-container" style="background: ' + bgColor + ';"><code>' + escapeHtml(data.targetMethodCode) + '</code></pre>';
                        }
                        html += '</div></div>';
                    }
                    
                    // Refinement Code Section
                    if (data.implementationCode) {
                        const opacity = refinementActive ? '1.0' : '0.4';
                        const borderColor = refinementActive ? '#4CAF50' : 'var(--vscode-editorWidget-border)';
                        const bgColor = refinementActive ? 'var(--vscode-editor-background)' : 'var(--vscode-editorWidget-background)';
                        const badge = refinementActive ? '🟢 ACTIVE' : '⚪ INACTIVE';
                        const layerLabel = data.layerObject ? ' (' + data.layerObject + ')' : '';
                        
                        html += '<div class="node-detail-section code-section" style="opacity: ' + opacity + '; border-left: 3px solid ' + borderColor + ';">';
                        html += '<div class="code-section-header">';
                        html += '<div class="node-detail-section-title">🔧 Refinement Code' + layerLabel + ' <span style="margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ' + (refinementActive ? 'rgba(76,175,80,0.2)' : 'rgba(150,150,150,0.2)') + ';">' + badge + '</span></div>';
                        html += \`<button class="jump-button" onclick="jumpToMethod('\${data.file}', \${data.line})">🔗 Jump to Refinement</button>\`;
                        html += '</div>';
                        html += '<div class="node-detail-content">';
                        html += '<pre class="code-container" style="background: ' + bgColor + ';"><code>' + escapeHtml(data.implementationCode) + '</code></pre>';
                        html += '</div></div>';
                    }
                }
    `;
}

module.exports = {
    getNodeDetailHandlerCode
};
