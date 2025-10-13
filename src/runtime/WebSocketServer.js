/**
 * Runtime WebSocket Server
 * 
 * VSCode拡張側で起動するWebSocketサーバー
 * ブラウザで実行中のアプリからのランタイムイベントを受信する
 */

const WebSocket = require('ws');

/**
 * WebSocketサーバークラス
 */
class RuntimeWebSocketServer {
    constructor(port = 8765) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
        this.messageHandlers = [];
        this.connectionHandlers = [];
        this.disconnectionHandlers = [];
    }

    /**
     * サーバーを起動
     * @returns {Promise<boolean>} 成功時true
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocket.Server({ port: this.port });

                this.wss.on('listening', () => {
                    console.log(`✅ EMA DevTools WebSocket Server started on ws://localhost:${this.port}`);
                    resolve(true);
                });

                this.wss.on('connection', (ws) => {
                    this.handleConnection(ws);
                });

                this.wss.on('error', (error) => {
                    console.error('WebSocket Server error:', error);
                    
                    // EADDRINUSE エラー（ポートが既に使用中）の場合
                    if (error.code === 'EADDRINUSE') {
                        console.log(`⚠️ Port ${this.port} is already in use`);
                        reject(new Error(`Port ${this.port} is already in use`));
                    } else {
                        reject(error);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * クライアント接続時の処理
     * @param {WebSocket} ws - WebSocketクライアント
     */
    handleConnection(ws) {
        console.log('📱 EMA DevTools client connected');
        this.clients.add(ws);

        // 接続ハンドラーを実行
        this.connectionHandlers.forEach(handler => handler());

        // メッセージ受信
        ws.on('message', (data) => {
            try {
                const message = data.toString();
                // メッセージハンドラーを実行
                this.messageHandlers.forEach(handler => handler(message));
            } catch (error) {
                console.error('Failed to process message:', error);
            }
        });

        // 切断時
        ws.on('close', () => {
            console.log('📴 EMA DevTools client disconnected');
            this.clients.delete(ws);
            
            // 切断ハンドラーを実行
            this.disconnectionHandlers.forEach(handler => handler());
        });

        // エラー時
        ws.on('error', (error) => {
            console.error('Client connection error:', error);
            this.clients.delete(ws);
        });
    }

    /**
     * サーバーを停止
     * @returns {Promise<void>}
     */
    async stop() {
        return new Promise((resolve) => {
            if (!this.wss) {
                resolve();
                return;
            }

            // すべてのクライアントを切断
            this.clients.forEach(ws => {
                ws.close();
            });
            this.clients.clear();

            // サーバーを閉じる
            this.wss.close(() => {
                console.log('🛑 EMA DevTools WebSocket Server stopped');
                this.wss = null;
                resolve();
            });
        });
    }

    /**
     * メッセージ受信ハンドラーを登録
     * @param {Function} handler - (message: string) => void
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * クライアント接続ハンドラーを登録
     * @param {Function} handler - () => void
     */
    onConnection(handler) {
        this.connectionHandlers.push(handler);
    }

    /**
     * クライアント切断ハンドラーを登録
     * @param {Function} handler - () => void
     */
    onDisconnection(handler) {
        this.disconnectionHandlers.push(handler);
    }

    /**
     * 接続中のクライアントがあるか
     * @returns {boolean}
     */
    hasClients() {
        return this.clients.size > 0;
    }

    /**
     * 接続中のクライアント数
     * @returns {number}
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * すべてのクライアントにメッセージを送信
     * @param {string} message - 送信するメッセージ
     */
    broadcast(message) {
        this.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * サーバーが起動中か
     * @returns {boolean}
     */
    isRunning() {
        return this.wss !== null;
    }
}

module.exports = RuntimeWebSocketServer;
