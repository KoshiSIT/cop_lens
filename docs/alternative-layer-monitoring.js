/**
 * Alternative Monkey Patch approach: Monitor _active property
 * 
 * This is an alternative to the current implementation which patches enter/exit callbacks.
 * Instead, this approach monitors the _active property of Layer objects.
 */

/**
 * Patch Layer constructor to monitor _active property
 */
function patchLayerActiveProperty() {
    if (!window.Layer) {
        console.warn('Layer constructor not found');
        return;
    }

    // Store original Layer constructor
    const OriginalLayer = window.Layer;
    
    // Create wrapper constructor
    window.Layer = function(originalLayer) {
        // Call original constructor
        const layer = new OriginalLayer(originalLayer);
        
        // Store original _active value
        let internalActive = layer._active;
        const layerName = layer.name || 'anonymous';
        
        // Override _active property with getter/setter
        Object.defineProperty(layer, '_active', {
            get() {
                return internalActive;
            },
            set(value) {
                const changed = internalActive !== value;
                internalActive = value;
                
                if (changed && window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    const signals = collectSignalValues();
                    
                    if (value) {
                        // Layer activated
                        window.__EMA_DEVTOOLS__.connection.emit('layer:activate', {
                            layerName: layerName,
                            signals: signals
                        });
                    } else {
                        // Layer deactivated
                        window.__EMA_DEVTOOLS__.connection.emit('layer:deactivate', {
                            layerName: layerName,
                            signals: signals
                        });
                    }
                }
            },
            configurable: true,
            enumerable: true
        });
        
        return layer;
    };
    
    // Copy static properties
    Object.setPrototypeOf(window.Layer, OriginalLayer);
    window.Layer.prototype = OriginalLayer.prototype;
}

/**
 * Comparison of two approaches:
 * 
 * Current Implementation (enter/exit callbacks):
 * ✅ Precise event timing
 * ✅ Can detect user-defined callbacks
 * ✅ Can add additional processing
 * ❌ Need to wrap callback functions
 * 
 * Alternative Implementation (_active property):
 * ✅ Simpler implementation
 * ✅ Detects all _active changes
 * ❌ Timing may differ slightly from callbacks
 * ❌ Cannot monitor user callback logic
 * ❌ Object.defineProperty may not work correctly on Layer objects
 * 
 * CONCLUSION: Current implementation is better for this use case
 */

// Export for documentation purposes only
// (This alternative approach is NOT recommended for production use)
module.exports = {
    patchLayerActiveProperty
};
