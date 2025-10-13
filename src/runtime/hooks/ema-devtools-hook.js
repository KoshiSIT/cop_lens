/**
 * EMA DevTools Hook - Browser Side
 * 
 * このスクリプトはブラウザで実行され、EMA.jsのAPIをMonkey Patchして
 * ランタイムイベントをVSCodeに送信します
 * 
 * 使い方:
 * <script src="./js/ema/loader.js"></script>
 * <script src="./ema-devtools-hook.js"></script>  ← このファイル
 * <script src="./js/app.js"></script>
 */

(function() {
    'use strict';

    const PROTOCOL_VERSION = '1.0.0';
    const DEVTOOLS_WS_URL = 'ws://localhost:8765';
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000; // 2秒

    /**
     * DevTools WebSocket接続マネージャー
     */
    class EMADevToolsConnection {
        constructor() {
            this.ws = null;
            this.connected = false;
            this.reconnectAttempts = 0;
            this.reconnectTimer = null;
        }

        /**
         * WebSocket接続を開始
         */
        connect() {
            try {
                console.log('🔌 Connecting to EMA DevTools...');
                this.ws = new WebSocket(DEVTOOLS_WS_URL);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('✅ Connected to EMA DevTools');
                };

                this.ws.onerror = (error) => {
                    this.connected = false;
                    console.log('⚠️ EMA DevTools not available (this is OK if not debugging)');
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    console.log('🔌 Disconnected from EMA DevTools');
                    this.scheduleReconnect();
                };

            } catch (error) {
                console.log('DevTools connection failed:', error.message);
            }
        }

        /**
         * 再接続をスケジュール
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
         * イベントを送信
         * @param {string} type - イベントタイプ
         * @param {Object} data - イベントデータ
         */
        emit(type, data) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return; // 接続していない場合は静かに無視
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
         * 切断
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
     * EMA.jsが読み込まれるまで待つ
     * @returns {Promise<void>}
     */
    function waitForEMA() {
        return new Promise((resolve) => {
            // まず即座にチェック
            if (window.EMA && window.Layer && window.Signal) {
                console.log('✅ EMA.js detected');
                resolve();
                return;
            }

            // 存在しない場合のみポーリング
            const maxWaitTime = 5000; // 5秒
            const startTime = Date.now();

            const check = setInterval(() => {
                // EMA.jsの主要なAPIが利用可能かチェック
                if (window.EMA && window.Layer && window.Signal) {
                    clearInterval(check);
                    console.log('✅ EMA.js detected');
                    resolve();
                }

                // タイムアウト
                if (Date.now() - startTime > maxWaitTime) {
                    clearInterval(check);
                    console.warn('⚠️ EMA.js not found after 5 seconds. Hooks not applied.');
                    resolve(); // エラーにはしない
                }
            }, 100); // 100msごとにチェック
        });
    }

    /**
     * Signal値を収集
     * EMA.exhibit()で公開されたSignalの現在値を取得
     * @returns {Object} Signal名 → 値のマップ
     */
    function collectSignalValues() {
        const signals = {};

        // グローバルスコープから公開されたSignalを探す
        // EMA.exhibit(obj, { signalName: signal })の結果を探索
        
        // 実装方法1: window上のオブジェクトを探索
        // （RemoteEditorのような構造を想定）
        try {
            for (const key in window) {
                const obj = window[key];
                if (obj && typeof obj === 'object') {
                    for (const prop in obj) {
                        const value = obj[prop];
                        // Signalオブジェクトを検出
                        if (value && typeof value === 'object' && 
                            value.constructor && value.constructor.name === 'Signal') {
                            signals[prop] = value.value;
                        }
                    }
                }
            }
        } catch (e) {
            // アクセス不可のプロパティは無視
        }

        return signals;
    }

    /**
     * Monkey Patchを適用
     * @param {EMADevToolsConnection} devtools - DevTools接続
     */
    function applyMonkeyPatches(devtools) {
        console.log('🐵 Applying EMA DevTools monkey patches...');

        // ----- 1. EMA.deploy のパッチ -----
        if (window.EMA && typeof window.EMA.deploy === 'function') {
            const originalDeploy = window.EMA.deploy;
            
            window.EMA.deploy = function(layer) {
                // enter/exitコールバックをラップ
                if (typeof layer.enter === 'function') {
                    const originalEnter = layer.enter;
                    layer.enter = function() {
                        // Layer有効化イベントを送信
                        const signals = collectSignalValues();
                        if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                            window.__EMA_DEVTOOLS__.connection.emit('layer:activate', {
                                layerName: layer.name || 'anonymous',
                                condition: layer.condition || 'none',
                                signals: signals
                            });
                        }
                        // 元のenterを実行
                        return originalEnter.apply(this, arguments);
                    };
                }

                if (typeof layer.exit === 'function') {
                    const originalExit = layer.exit;
                    layer.exit = function() {
                        // Layer無効化イベントを送信
                        const signals = collectSignalValues();
                        if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                            window.__EMA_DEVTOOLS__.connection.emit('layer:deactivate', {
                                layerName: layer.name || 'anonymous',
                                signals: signals
                            });
                        }
                        // 元のexitを実行
                        return originalExit.apply(this, arguments);
                    };
                }

                // Layer配備イベントを送信
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:deploy', {
                        layerName: layer.name || 'anonymous',
                        condition: layer.condition || 'none',
                        hasEnter: typeof layer.enter === 'function',
                        hasExit: typeof layer.exit === 'function'
                    });
                }

                // 元の処理を実行
                return originalDeploy.apply(this, arguments);
            };

            console.log('  ✅ Patched EMA.deploy');
        }

        // ----- 2. Layer.prototype.activate のパッチ -----
        if (window.Layer && window.Layer.prototype) {
            const originalActivate = window.Layer.prototype.activate;
            
            window.Layer.prototype.activate = function() {
                // Signal値を収集
                const signals = collectSignalValues();

                // Layer有効化イベントを送信
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:activate', {
                        layerName: this.name || 'anonymous',
                        condition: this.condition || 'none',
                        signals: signals
                    });
                }

                // 元の処理を実行
                return originalActivate.apply(this, arguments);
            };

            console.log('  ✅ Patched Layer.prototype.activate');
        }

        // ----- 3. Layer.prototype.deactivate のパッチ -----
        if (window.Layer && window.Layer.prototype) {
            const originalDeactivate = window.Layer.prototype.deactivate;
            
            window.Layer.prototype.deactivate = function() {
                // Signal値を収集
                const signals = collectSignalValues();

                // Layer無効化イベントを送信
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('layer:deactivate', {
                        layerName: this.name || 'anonymous',
                        signals: signals
                    });
                }

                // 元の処理を実行
                return originalDeactivate.apply(this, arguments);
            };

            console.log('  ✅ Patched Layer.prototype.deactivate');
        }

        // ----- 4. EMA.addPartialMethod のパッチ -----
        if (window.EMA && typeof window.EMA.addPartialMethod === 'function') {
            const originalAddPartialMethod = window.EMA.addPartialMethod;
            
            window.EMA.addPartialMethod = function(layer, targetPrototype, methodName, refinementFn) {
                // クラス名を取得
                const className = targetPrototype.constructor.name || 'Anonymous';

                // Refinement追加イベントを送信
                if (window.__EMA_DEVTOOLS__ && window.__EMA_DEVTOOLS__.connection) {
                    window.__EMA_DEVTOOLS__.connection.emit('refinement:add', {
                        layerName: layer.name || 'anonymous',
                        className: className,
                        methodName: methodName
                    });
                }

                // 元の処理を実行
                return originalAddPartialMethod.apply(this, arguments);
            };

            console.log('  ✅ Patched EMA.addPartialMethod');
        }

        console.log('✅ EMA DevTools monkey patches applied successfully');
    }

    /**
     * 初期化
     */
    async function initialize() {
        console.log('🚀 EMA DevTools Hook initializing...');

        // DevTools接続を確立
        const devtools = new EMADevToolsConnection();
        devtools.connect();

        // EMA.jsが読み込まれるまで待つ
        await waitForEMA();

        // Monkey Patchを適用
        if (window.EMA && window.Layer) {
            applyMonkeyPatches(devtools);
        } else {
            console.warn('⚠️ EMA.js not found. DevTools hooks not applied.');
        }

        // グローバルに保存（デバッグ用）
        window.__EMA_DEVTOOLS__ = {
            connection: devtools,
            version: PROTOCOL_VERSION
        };
    }

    // DOMContentLoaded後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // 既にロード済みの場合は即座に実行
        initialize();
    }

})();
