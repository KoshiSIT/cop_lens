const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Serve static files from 'public' directory
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Remote Editor Web Server started`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📂 Serving files from: ${path.join(__dirname, 'public')}`);
    console.log(`\n💡 Open http://localhost:${PORT} in your browser`);
    console.log(`🔄 Server is running... (Press Ctrl+C to stop)\n`);
});

// Error handling
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port.`);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Log unexpected exit
process.on('exit', (code) => {
    console.log(`⚠️  Process exiting with code: ${code}`);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});
