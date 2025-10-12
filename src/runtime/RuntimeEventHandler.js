/**
 * Runtime Event Handler
 * 
 * ブラウザから送信されたランタイムイベントを受信・処理し、
 * GlobalStoreを更新してUIに反映させる
 */

const GlobalStore = require('../analyzer/globalCOPDataStore');
const logger = require('../utils/logger');

/**
 * RuntimeEventHandlerクラス
 */
class RuntimeEventHandler {
    constructor(dependencyGraphView = null) {
        this.layerStates = new Map(); // layerName → LayerRuntimeState
        this.eventListeners = [];
        this.dependencyGraphView = dependencyGraphView;
    }

    /**
     * イベントを処理
     * @param {string} eventJson - JSONイベント文字列
     */
    handleMessage(eventJson) {
        try {
            const event = JSON.parse(eventJson);
            
            // プロトコルバージョンチェック
            if (event.protocolVersion !== '1.0.0') {
                console.warn(`Unsupported protocol version: ${event.protocolVersion}`);
            }

            // イベントタイプごとに処理
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

            // イベントリスナーに通知
            this.notifyListeners(event);

        } catch (error) {
            console.error('Failed to handle runtime event:', error);
        }
    }

    /**
     * Layer配備イベント処理
     * @param {Object} event - LayerDeployEvent
     */
    handleLayerDeploy(event) {
        const { layerName, condition, hasEnter, hasExit } = event.data;
        
        logger.log(`📦 Layer deployed: ${layerName} (condition: ${condition})`);

        // 初期状態を記録
        this.layerStates.set(layerName, {
            layerName: layerName,
            status: 'UNKNOWN', // まだactivate/deactivateされていない
            signals: {},
            lastUpdate: event.timestamp,
            condition: condition,
            hasEnter: hasEnter,
            hasExit: hasExit
        });

        // GlobalStoreに記録（オプション）
        // 必要に応じてGlobalStoreにランタイム情報を追加
    }

    /**
     * Layer有効化イベント処理
     * @param {Object} event - LayerActivateEvent
     */
    handleLayerActivate(event) {
        const { layerName, condition, signals } = event.data;
        
        logger.log(`🟢 Layer activated: ${layerName}`);
        logger.log(`   Signals:`, signals);

        // 状態を更新
        const state = this.layerStates.get(layerName) || {
            layerName: layerName,
            condition: condition
        };

        state.status = 'ACTIVE';
        state.signals = signals;
        state.lastUpdate = event.timestamp;

        this.layerStates.set(layerName, state);

        // GlobalStoreを更新
        this.updateGlobalStore(layerName, 'ACTIVE', signals);
    }

    /**
     * Layer無効化イベント処理
     * @param {Object} event - LayerDeactivateEvent
     */
    handleLayerDeactivate(event) {
        const { layerName, signals } = event.data;
        
        logger.log(`⚪ Layer deactivated: ${layerName}`);
        logger.log(`   Signals:`, signals);

        // 状態を更新
        const state = this.layerStates.get(layerName) || {
            layerName: layerName
        };

        state.status = 'INACTIVE';
        state.signals = signals;
        state.lastUpdate = event.timestamp;

        this.layerStates.set(layerName, state);

        // GlobalStoreを更新
        this.updateGlobalStore(layerName, 'INACTIVE', signals);
    }

    /**
     * Refinement追加イベント処理
     * @param {Object} event - RefinementAddEvent
     */
    handleRefinementAdd(event) {
        const { layerName, className, methodName } = event.data;
        
        logger.log(`🔧 Refinement added: ${layerName}.${className}.${methodName}`);

        // 現時点では静的解析で既に検出済みなので、特別な処理は不要
        // 将来的には、動的に追加されたRefinementを記録するために使用可能
    }

    /**
     * GlobalStoreにランタイム状態を更新
     * @param {string} layerName - Layer名
     * @param {string} status - 'ACTIVE' | 'INACTIVE'
     * @param {Object} signals - Signal値
     */
    updateGlobalStore(layerName, status, signals) {
        // UIに通知
        if (this.dependencyGraphView) {
            logger.log(`[UI] Updating runtime status: ${layerName} -> ${status}`);
            this.dependencyGraphView.updateRuntimeStatus(layerName, status, signals);
        }
        
        logger.log(`Runtime state noted: ${layerName} -> ${status}`);
    }

    /**
     * Layer状態を取得
     * @param {string} layerName - Layer名
     * @returns {Object|null} LayerRuntimeState
     */
    getLayerState(layerName) {
        return this.layerStates.get(layerName) || null;
    }

    /**
     * すべてのLayer状態を取得
     * @returns {Map} layerName → LayerRuntimeState
     */
    getAllLayerStates() {
        return this.layerStates;
    }

    /**
     * 状態をクリア
     */
    clearStates() {
        this.layerStates.clear();
        logger.log('🧹 Cleared all runtime states');
    }

    /**
     * イベントリスナーを登録
     * @param {Function} listener - (event) => void
     */
    addEventListener(listener) {
        this.eventListeners.push(listener);
    }

    /**
     * イベントリスナーに通知
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
     * 統計情報を取得
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
