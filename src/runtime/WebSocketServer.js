/**
 * Runtime WebSocket Server
 * 
 * WebSocket server running on VSCode extension side
 * Receives runtime events from browser-side applications
 */

const WebSocket = require('ws');

/**
 * WebSocket server class
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
     * Start server
     * @returns {Promise<boolean>} true on success
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocket.Server({ port: this.port });

                this.wss.on('listening', () => {
                    console.log(`✅ Runtime WebSocket Server started on ws://localhost:${this.port}`);
                    resolve(true);
                });

                this.wss.on('connection', (ws) => {
                    this.handleConnection(ws);
                });

                this.wss.on('error', (error) => {
                    console.error('WebSocket Server error:', error);
                    
                    // EADDRINUSE error (port already in use)
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
     * Handle client connection
     * @param {WebSocket} ws - WebSocket client
     */
    handleConnection(ws) {
        console.log('🔗 Runtime client connected');
        this.clients.add(ws);

        // Execute connection handlers
        this.connectionHandlers.forEach(handler => handler());

        // Receive messages
        ws.on('message', (data) => {
            try {
                const message = data.toString();
                // Execute message handlers
                this.messageHandlers.forEach(handler => handler(message));
            } catch (error) {
                console.error('Failed to process message:', error);
            }
        });

        // On disconnect
        ws.on('close', () => {
            console.log('📴 Runtime client disconnected');
            this.clients.delete(ws);
            
            // Execute disconnection handlers
            this.disconnectionHandlers.forEach(handler => handler());
        });

        // On error
        ws.on('error', (error) => {
            console.error('Client connection error:', error);
            this.clients.delete(ws);
        });
    }

    /**
     * Stop server
     * @returns {Promise<void>}
     */
    async stop() {
        return new Promise((resolve) => {
            if (!this.wss) {
                resolve();
                return;
            }

            // Disconnect all clients
            this.clients.forEach(ws => {
                ws.close();
            });
            this.clients.clear();

            // Close server
            this.wss.close(() => {
                console.log('🛑 Runtime WebSocket Server stopped');
                this.wss = null;
                resolve();
            });
        });
    }

    /**
     * Register message handler
     * @param {Function} handler - (message: string) => void
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Register connection handler
     * @param {Function} handler - () => void
     */
    onConnection(handler) {
        this.connectionHandlers.push(handler);
    }

    /**
     * Register disconnection handler
     * @param {Function} handler - () => void
     */
    onDisconnection(handler) {
        this.disconnectionHandlers.push(handler);
    }

    /**
     * Check if there are connected clients
     * @returns {boolean}
     */
    hasClients() {
        return this.clients.size > 0;
    }

    /**
     * Get number of connected clients
     * @returns {number}
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * Send message to all clients
     * @param {string} message - Message to send
     */
    broadcast(message) {
        this.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * Check if server is running
     * @returns {boolean}
     */
    isRunning() {
        return this.wss !== null;
    }
}

module.exports = RuntimeWebSocketServer;
