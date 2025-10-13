/**
 * Runtime Event Handler
 * 
 * Receives and processes runtime events sent from browser,
 * updates GlobalStore and reflects changes in UI
 */

const GlobalStore = require('../analyzer/globalCOPDataStore');
const logger = require('../utils/logger');

/**
 * RuntimeEventHandler class
 */
class RuntimeEventHandler {
    constructor(dependencyGraphView = null) {
        this.layerStates = new Map(); // layerName -> LayerRuntimeState
        this.eventListeners = [];
        this.dependencyGraphView = dependencyGraphView;
    }

    /**
     * Process event
     * @param {string} eventJson - JSON event string
     */
    handleMessage(eventJson) {
        try {
            const event = JSON.parse(eventJson);
            
            // Protocol version check
            if (event.protocolVersion !== '1.0.0') {
                console.warn(`Unsupported protocol version: ${event.protocolVersion}`);
            }

            // Process by event type
            switch (event.type) {
                case 'layer:deploy':
                    this.handleLayerDeploy(event);
                    break;
                
                case 'layer:activate':
                    this.handleLayerActivate(event);
                    break;
                
                case 'layer:deactivate':
                    this.handleLayerDeactivate(event);
                    break;
                
                case 'refinement:add':
                    this.handleRefinementAdd(event);
                    break;
                
                default:
                    console.warn(`Unknown event type: ${event.type}`);
            }

            // Notify listeners
            this.notifyListeners(event);

        } catch (error) {
            console.error('Failed to handle runtime event:', error);
        }
    }

    /**
     * Handle layer deploy event
     * @param {Object} event - LayerDeployEvent
     */
    handleLayerDeploy(event) {
        const { layerName, condition, hasEnter, hasExit } = event.data;
        
        logger.log(`📦 Layer deployed: ${layerName} (condition: ${condition})`);

        // Record initial state
        this.layerStates.set(layerName, {
            layerName: layerName,
            status: 'UNKNOWN', // Not yet activated/deactivated
            signals: {},
            lastUpdate: event.timestamp,
            condition: condition,
            hasEnter: hasEnter,
            hasExit: hasExit
        });

        // Record in GlobalStore (optional)
        // Add runtime info to GlobalStore as needed
    }

    /**
     * Handle layer activate event
     * @param {Object} event - LayerActivateEvent
     */
    handleLayerActivate(event) {
        const { layerName, condition, signals } = event.data;
        
        logger.log(`🟢 Layer activated: ${layerName}`);
        logger.log(`   Signals:`, signals);

        // Update state
        const state = this.layerStates.get(layerName) || {
            layerName: layerName,
            condition: condition
        };

        state.status = 'ACTIVE';
        state.signals = signals;
        state.lastUpdate = event.timestamp;

        this.layerStates.set(layerName, state);

        // Update GlobalStore
        this.updateGlobalStore(layerName, 'ACTIVE', signals);
    }

    /**
     * Handle layer deactivate event
     * @param {Object} event - LayerDeactivateEvent
     */
    handleLayerDeactivate(event) {
        const { layerName, signals } = event.data;
        
        logger.log(`⚪ Layer deactivated: ${layerName}`);
        logger.log(`   Signals:`, signals);

        // Update state
        const state = this.layerStates.get(layerName) || {
            layerName: layerName
        };

        state.status = 'INACTIVE';
        state.signals = signals;
        state.lastUpdate = event.timestamp;

        this.layerStates.set(layerName, state);

        // Update GlobalStore
        this.updateGlobalStore(layerName, 'INACTIVE', signals);
    }

    /**
     * Handle refinement add event
     * @param {Object} event - RefinementAddEvent
     */
    handleRefinementAdd(event) {
        const { layerName, className, methodName } = event.data;
        
        logger.log(`🔧 Refinement added: ${layerName}.${className}.${methodName}`);

        // Currently, refinements are already detected by static analysis
        // In future, this can be used to record dynamically added refinements
    }

    /**
     * Update runtime state in GlobalStore
     * @param {string} layerName - Layer name
     * @param {string} status - 'ACTIVE' | 'INACTIVE'
     * @param {Object} signals - Signal values
     */
    updateGlobalStore(layerName, status, signals) {
        // Notify UI
        if (this.dependencyGraphView) {
            logger.log(`[UI] Updating runtime status: ${layerName} -> ${status}`);
            this.dependencyGraphView.updateRuntimeStatus(layerName, status, signals);
        }
        
        logger.log(`Runtime state noted: ${layerName} -> ${status}`);
    }

    /**
     * Get layer state
     * @param {string} layerName - Layer name
     * @returns {Object|null} LayerRuntimeState
     */
    getLayerState(layerName) {
        return this.layerStates.get(layerName) || null;
    }

    /**
     * Get all layer states
     * @returns {Map} layerName -> LayerRuntimeState
     */
    getAllLayerStates() {
        return this.layerStates;
    }

    /**
     * Clear all states
     */
    clearStates() {
        this.layerStates.clear();
        logger.log('🧹 Cleared all runtime states');
    }

    /**
     * Register event listener
     * @param {Function} listener - (event) => void
     */
    addEventListener(listener) {
        this.eventListeners.push(listener);
    }

    /**
     * Notify event listeners
     * @param {Object} event - RuntimeEvent
     */
    notifyListeners(event) {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Event listener error:', error);
            }
        });
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        const states = Array.from(this.layerStates.values());
        
        return {
            totalLayers: states.length,
            activeLayers: states.filter(s => s.status === 'ACTIVE').length,
            inactiveLayers: states.filter(s => s.status === 'INACTIVE').length,
            unknownLayers: states.filter(s => s.status === 'UNKNOWN').length
        };
    }
}

module.exports = RuntimeEventHandler;
