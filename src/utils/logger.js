/**
 * Logger utility
 * Logs all messages to both console and file
 */

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

class Logger {
    constructor() {
        this.logBuffer = [];
        this.maxBufferSize = 100; // Keep last 100 entries
        this.logFilePath = null;
    }

    /**
     * Initialize logger with workspace path
     */
    initialize() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.logFilePath = path.join(workspaceFolder.uri.fsPath, '.cop-lens-debug.log');
            // Clear log file on initialization
            this.clearLogFile();
            this.log('🚀 Logger initialized');
        }
    }

    /**
     * Clear log file
     */
    clearLogFile() {
        if (this.logFilePath) {
            try {
                fs.writeFileSync(this.logFilePath, '', 'utf8');
            } catch (error) {
                console.error('Failed to clear log file:', error);
            }
        }
    }

    /**
     * Format log entry
     */
    formatEntry(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        return `[${timestamp}] [${level}] ${message}`;
    }

    /**
     * Write to log file
     */
    writeToFile(entry) {
        if (!this.logFilePath) return;

        try {
            fs.appendFileSync(this.logFilePath, entry + '\n', 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Log message
     */
    log(...args) {
        const entry = this.formatEntry('INFO', ...args);
        console.log(...args);
        this.writeToFile(entry);
    }

    /**
     * Log warning
     */
    warn(...args) {
        const entry = this.formatEntry('WARN', ...args);
        console.warn(...args);
        this.writeToFile(entry);
    }

    /**
     * Log error
     */
    error(...args) {
        const entry = this.formatEntry('ERROR', ...args);
        console.error(...args);
        this.writeToFile(entry);
    }

    /**
     * Log info (alias for log)
     */
    info(...args) {
        this.log(...args);
    }

    /**
     * Get log file path
     */
    getLogFilePath() {
        return this.logFilePath;
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
