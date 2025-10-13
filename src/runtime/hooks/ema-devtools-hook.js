/**
 * EMA DevTools Hook - Browser Side
 * 
 * This script runs in the browser and monkey patches EMA.js APIs
 * to send runtime events to VSCode
 * 
 * Usage:
 * <script src="./js/ema/loader.js"></script>
 * <script src="./ema-devtools-hook.js"></script>  <- This file
 * <script src="./js/app.js"></script>
 */

(function() {
    'use strict';

    const PROTOCOL_VERSION = '1.0.0';
    const DEVTOOLS_WS_URL = 'ws://localhost:8765';
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000; // 2 seconds

    /**
     * DevTools WebSocket connection manager
     */
    class EMADevToolsConnection {
        constructor() {
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.reconnectTimer = null;
        }

        /**
         * Start WebSocket connection
         */
        connect() {
            try {
                console.log('🔌 Connecting to COP-lens...');
                this.ws = new WebSocket(DEVTOOLS_WS_URL);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('✅ Connected to COP-lens');
                };

                this.ws.onerror = (error) => {
                    this.connected = false;
                    console.log('⚠️ COP-lens not available (this is OK if not debugging)');
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    console.log('🔌 Disconnected from COP-lens');
                    this.scheduleReconnect();
                };

            } catch (error) {
                console.log('DevTools connection failed:', error.message);
            }
        }

        /**
         * Schedule reconnection
         */
        scheduleReconnect() {
            if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('❌ Max reconnection attempts reached. Stop trying.');
                return;
            }

            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }

            this.reconnectAttempts++;
            console.log(`⏳ Reconnecting in ${RECONNECT_DELAY}ms... (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, RECONNECT_DELAY);
        }

        /**
         * Send event
         * @param {string} type - Event type
         * @param {Object} data - Event data
         */
        emit(type, data) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return; // Silently ignore if not connected
            }

            const event = {
                type: type,
                timestamp: Date.now(),
                protocolVersion: PROTOCOL_VERSION,
                data: data
            };

            try {
                this.ws.send(JSON.stringify(event));
            } catch (error) {
                console.error('Failed to send event:', error);
            }
        }

        /**
         * Disconnect
         */
        disconnect() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    /**
     * Wait for EMA.js to be loaded
     * @returns {Promise<void>}
     */
    function waitForEMA() {
        return new Promise((resolve) => {
            // Check immediately first
            if (window.EMA && window.Layer && window.Signal) {
                console.log('✅ EMA.js detected');
                resolve();
                return;
            }

            // Poll only if not found
            const maxWaitTime = 5000; // 5 seconds
            const startTime = Date.now();

            const check = setInterval(() => {
                // Check if main EMA.js APIs are available
                if (window.EMA && window.Layer && window.Signal) {
                    clearInterval(check);
                    console.log('✅ EMA.js detected');
                    resolve();
                }

                // Timeout
                if (Date.now() - startTime > maxWaitTime) {
                    clearInterval(check);
                    console.warn('⚠️ EMA.js not found after 5 seconds. Hooks not applied.');
                    resolve(); // Don't reject
                }
            }, 100); // Check every 100ms
        });
    }

    /**
     * Registry of exhibited signals
     * Maps signal name -> signal object
     */
    const exhibitedSignals = new Map();

    /**
     * Collect signal values
     * Get current values of signals exposed via EMA.exhibit()
     * @returns {Object} Map of signal name -> value
     */
    function collectSignalValues() {
        const signals = {};

        // Get values from registered signals
        exhibitedSignals.forEach((signal, name) => {
            try {
                if (signal && typeof signal === 'object' && 'value' in signal) {
                    signals[name] = signal.value;
                }
            } catch (e) {
                console.warn(`Failed to read signal ${name}:`, e);
            }
        });

        return signals;
    }

    /**
     * Apply monkey patches
     * @param {EMADevToolsConnection} devtools - DevTools connection
     */
    function applyMonkeyPatches(devtools) {
        console.log('🐵 Applying COP-lens monkey patches...');

        // ----- 1. Patch EMA.deploy -----
        if (window.EMA && typeof window.EMA.deploy === 'function') {
            const originalDeploy = window.EMA.deploy;
            
            window.EMA.deploy = function(layer) {
                // Wrap enter/exit callbacks
                if (typeof layer.enter === 'function') {
                    const originalEnter = layer.enter;
                    layer.enter = function() {
                        // Send layer activate event
                        const signals = collectSignalValues();
                        if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                            window.__EMA_DEVTOOLS__.connection.emit('layer:activate', {
                                layerName: layer.name || 'anonymous',
                                condition: layer.condition || 'none',
                                signals: signals
                            });
                        }
                        // Execute original enter
                        return originalEnter.apply(this, arguments);
                    };
                }

                if (typeof layer.exit === 'function') {
                    const originalExit = layer.exit;
                    layer.exit = function() {
                        // Send layer deactivate event
                        const signals = collectSignalValues();
                        if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                            window.__EMA_DEVTOOLS__.connection.emit('layer:deactivate', {
                                layerName: layer.name || 'anonymous',
                                signals: signals
                            });
                        }
                        // Execute original exit
                        return originalExit.apply(this, arguments);
                    };
                }

                // Send layer deploy event
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:deploy', {
                        layerName: layer.name || 'anonymous',
                        condition: layer.condition || 'none',
                        hasEnter: typeof layer.enter === 'function',
                        hasExit: typeof layer.exit === 'function'
                    });
                }

                // Execute original processing
                return originalDeploy.apply(this, arguments);
            };

            console.log('  ✅ Patched EMA.deploy');
        }

        // ----- 2. Patch Layer.prototype.activate -----
        if (window.Layer && window.Layer.prototype) {
            const originalActivate = window.Layer.prototype.activate;
            
            window.Layer.prototype.activate = function() {
                // Collect signal values
                const signals = collectSignalValues();

                // Send layer activate event
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:activate', {
                        layerName: this.name || 'anonymous',
                        condition: this.condition || 'none',
                        signals: signals
                    });
                }

                // Execute original processing
                return originalActivate.apply(this, arguments);
            };

            console.log('  ✅ Patched Layer.prototype.activate');
        }

        // ----- 3. Patch Layer.prototype.deactivate -----
        if (window.Layer && window.Layer.prototype) {
            const originalDeactivate = window.Layer.prototype.deactivate;
            
            window.Layer.prototype.deactivate = function() {
                // Collect signal values
                const signals = collectSignalValues();

                // Send layer deactivate event
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:deactivate', {
                        layerName: this.name || 'anonymous',
                        signals: signals
                    });
                }

                // Execute original processing
                return originalDeactivate.apply(this, arguments);
            };

            console.log('  ✅ Patched Layer.prototype.deactivate');
        }

        // ----- 4. Patch EMA.exhibit -----
        if (window.EMA && typeof window.EMA.exhibit === 'function') {
            const originalExhibit = window.EMA.exhibit;
            
            window.EMA.exhibit = function(obj, signals) {
                console.log('🔍 EMA.exhibit called with signals:', Object.keys(signals));
                
                // Register all exhibited signals
                Object.keys(signals).forEach(signalName => {
                    const signal = signals[signalName];
                    if (signal && typeof signal === 'object' && signal.constructor && signal.constructor.name === 'Signal') {
                        console.log(`  ✅ Registered signal: ${signalName}`);
                        exhibitedSignals.set(signalName, signal);
                    }
                });
                
                // Execute original exhibit
                return originalExhibit.apply(this, arguments);
            };
            
            console.log('  ✅ Patched EMA.exhibit');
        }

        // ----- 5. Patch EMA.addPartialMethod -----
        if (window.EMA && typeof window.EMA.addPartialMethod === 'function') {
            const originalAddPartialMethod = window.EMA.addPartialMethod;
            
            window.EMA.addPartialMethod = function(layer, targetPrototype, methodName, refinementFn) {
                // Get class name
                const className = targetPrototype.constructor.name || 'Anonymous';

                // Send refinement add event
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('refinement:add', {
                        layerName: layer.name || 'anonymous',
                        className: className,
                        methodName: methodName
                    });
                }

                // Execute original processing
                return originalAddPartialMethod.apply(this, arguments);
            };

            console.log('  ✅ Patched EMA.addPartialMethod');
        }

        console.log('✅ COP-lens monkey patches applied successfully');
    }

    /**
     * Initialize
     */
    async function initialize() {
        console.log('🚀 COP-lens Hook initializing...');

        // Establish DevTools connection
        const devtools = new EMADevToolsConnection();
        devtools.connect();

        // Wait for EMA.js to be loaded
        await waitForEMA();

        // Apply monkey patches
        if (window.EMA && window.Layer) {
            applyMonkeyPatches(devtools);
        } else {
            console.warn('⚠️ EMA.js not found. DevTools hooks not applied.');
        }

        // Save globally (for debugging)
        window.__EMA_DEVTOOLS__ = {
            connection: devtools,
            version: PROTOCOL_VERSION
        };
    }

    // Initialize after DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // Already loaded, execute immediately
        initialize();
    }

})();
