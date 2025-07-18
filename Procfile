// ================================
// BAYNEX.A.X SERVER - DEPLOYMENT ENTRY POINT
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import BAYNEX.A.X System
const BayneXSystem = require('./BayneXSystem');
const WebSocketServer = require('./src/web/WebSocketServer');

class BayneXServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = process.env.PORT || 3000;
        this.bayneXSystem = null;
        this.webSocketServer = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        }));

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        this.app.use(express.static(path.join(__dirname, 'src/web/dashboard')));
        this.app.use('/assets', express.static(path.join(__dirname, 'src/web/dashboard/assets')));
    }

    setupRoutes() {
        // Health check route
        this.app.get('/health', (req, res) => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: require('./package.json').version,
                system: this.bayneXSystem ? this.bayneXSystem.getSystemStatus() : null
            };
            res.json(health);
        });

        // API routes
        this.app.get('/api/status', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }
            res.json(this.bayneXSystem.getSystemStatus());
        });

        this.app.get('/api/stats', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }
            res.json(this.bayneXSystem.getSystemStats());
        });

        this.app.post('/api/control/:action', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }

            const { action } = req.params;
            
            switch (action) {
                case 'start':
                    this.bayneXSystem.start()
                        .then(() => res.json({ success: true, message: 'System started' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                case 'stop':
                    this.bayneXSystem.stop()
                        .then(() => res.json({ success: true, message: 'System stopped' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                case 'restart':
                    this.bayneXSystem.restart()
                        .then(() => res.json({ success: true, message: 'System restarted' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                default:
                    res.status(400).json({ error: 'Invalid action' });
            }
        });

        // Serve dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });

        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });

        // API documentation
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'BAYNEX.A.X API',
                version: '1.0.0',
                endpoints: {
                    'GET /health': 'System health check',
                    'GET /api/status': 'Trading system status',
                    'GET /api/stats': 'Performance statistics',
                    'POST /api/control/start': 'Start trading system',
                    'POST /api/control/stop': 'Stop trading system',
                    'POST /api/control/restart': 'Restart trading system'
                }
            });
        });

        // Catch all route
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Not Found',
                message: 'The requested resource was not found',
                path: req.path
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            
            res.status(err.status || 500).json({
                error: err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            });
        });
    }

    async initializeBayneX() {
        console.log('🚀 Initializing BAYNEX.A.X System...');
        
        try {
            this.bayneXSystem = new BayneXSystem();
            await this.bayneXSystem.initialize();
            
            // Initialize WebSocket server
            this.webSocketServer = new WebSocketServer(this.server);
            await this.webSocketServer.initialize();
            
            // Auto-start if configured
            if (process.env.AUTO_START !== 'false') {
                await this.bayneXSystem.start();
            }
            
            console.log('✅ BAYNEX.A.X System initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize BAYNEX.A.X:', error);
            throw error;
        }
    }

    async start() {
        try {
            // Initialize BAYNEX.A.X system
            await this.initializeBayneX();
            
            // Start HTTP server
            this.server.listen(this.port, () => {
                console.log(`
🌟 ================================ 🌟
    BAYNEX.A.X SERVER ONLINE
🌟 ================================ 🌟

🚀 Server: http://localhost:${this.port}
📊 Dashboard: http://localhost:${this.port}/dashboard
🔍 Health Check: http://localhost:${this.port}/health
📡 API: http://localhost:${this.port}/api

🤖 Autonomous Trading: ${this.bayneXSystem?.isRunning ? 'ACTIVE' : 'STANDBY'}
🧠 AI Learning: ${process.env.AI_LEARNING_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}
💰 Paper Trading: ${process.env.PAPER_TRADING_MODE === 'true' ? 'ON' : 'OFF'}

Ready to generate profits! 💎🚀
                `);
            });
// ================================
// BAYNEX.A.X SERVER - DEPLOYMENT ENTRY POINT
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import BAYNEX.A.X System
const BayneXSystem = require('./BayneXSystem');
const WebSocketServer = require('./src/web/WebSocketServer');

class BayneXServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = process.env.PORT || 3000;
        this.bayneXSystem = null;
        this.webSocketServer = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        }));

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        this.app.use(express.static(path.join(__dirname, 'src/web/dashboard')));
        this.app.use('/assets', express.static(path.join(__dirname, 'src/web/dashboard/assets')));
    }

    setupRoutes() {
        // Health check route
        this.app.get('/health', (req, res) => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: require('./package.json').version,
                system: this.bayneXSystem ? this.bayneXSystem.getSystemStatus() : null
            };
            res.json(health);
        });

        // API routes
        this.app.get('/api/status', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }
            res.json(this.bayneXSystem.getSystemStatus());
        });

        this.app.get('/api/stats', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }
            res.json(this.bayneXSystem.getSystemStats());
        });

        this.app.post('/api/control/:action', (req, res) => {
            if (!this.bayneXSystem) {
                return res.status(503).json({ error: 'System not initialized' });
            }

            const { action } = req.params;
            
            switch (action) {
                case 'start':
                    this.bayneXSystem.start()
                        .then(() => res.json({ success: true, message: 'System started' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                case 'stop':
                    this.bayneXSystem.stop()
                        .then(() => res.json({ success: true, message: 'System stopped' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                case 'restart':
                    this.bayneXSystem.restart()
                        .then(() => res.json({ success: true, message: 'System restarted' }))
                        .catch(err => res.status(500).json({ error: err.message }));
                    break;
                
                default:
                    res.status(400).json({ error: 'Invalid action' });
            }
        });

        // Serve dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });

        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });

        // API documentation
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'BAYNEX.A.X API',
                version: '1.0.0',
                endpoints: {
                    'GET /health': 'System health check',
                    'GET /api/status': 'Trading system status',
                    'GET /api/stats': 'Performance statistics',
                    'POST /api/control/start': 'Start trading system',
                    'POST /api/control/stop': 'Stop trading system',
                    'POST /api/control/restart': 'Restart trading system'
                }
            });
        });

        // Catch all route
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/web/dashboard/index.html'));
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Not Found',
                message: 'The requested resource was not found',
                path: req.path
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            
            res.status(err.status || 500).json({
                error: err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            });
        });
    }

    async initializeBayneX() {
        console.log('🚀 Initializing BAYNEX.A.X System...');
        
        try {
            this.bayneXSystem = new BayneXSystem();
            await this.bayneXSystem.initialize();
            
            // Initialize WebSocket server
            this.webSocketServer = new WebSocketServer(this.server);
            await this.webSocketServer.initialize();
            
            // Auto-start if configured
            if (process.env.AUTO_START !== 'false') {
                await this.bayneXSystem.start();
            }
            
            console.log('✅ BAYNEX.A.X System initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize BAYNEX.A.X:', error);
            throw error;
        }
    }

    async start() {
        try {
            // Initialize BAYNEX.A.X system
            await this.initializeBayneX();
            
            // Start HTTP server
            this.server.listen(this.port, () => {
                console.log(`
🌟 ================================ 🌟
    BAYNEX.A.X SERVER ONLINE
🌟 ================================ 🌟

🚀 Server: http://localhost:${this.port}
📊 Dashboard: http://localhost:${this.port}/dashboard
🔍 Health Check: http://localhost:${this.port}/health
📡 API: http://localhost:${this.port}/api

🤖 Autonomous Trading: ${this.bayneXSystem?.isRunning ? 'ACTIVE' : 'STANDBY'}
🧠 AI Learning: ${process.env.AI_LEARNING_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}
💰 Paper Trading: ${process.env.PAPER_TRADING_MODE === 'true' ? 'ON' : 'OFF'}

Ready to generate profits! 💎🚀
                `);
            });

            // Graceful shutdown handling
            this.setupGracefulShutdown();
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
            
            try {
                // Stop BAYNEX.A.X system
                if (this.bayneXSystem) {
                    console.log('⏹️ Stopping BAYNEX.A.X system...');
                    await this.bayneXSystem.stop();
                }
                
                // Close WebSocket server
                if (this.webSocketServer) {
                    console.log('🔌 Closing WebSocket connections...');
                    await this.webSocketServer.close();
                }
                
                // Close HTTP server
                this.server.close(() => {
                    console.log('✅ Server closed successfully');
                    process.exit(0);
                });
                
                // Force exit after 30 seconds
                setTimeout(() => {
                    console.log('⚠️ Force closing server...');
                    process.exit(1);
                }, 30000);
                
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    getStats() {
        return {
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            trading: this.bayneXSystem ? this.bayneXSystem.getSystemStats() : null
        };
    }
}

// Create and start server
const server = new BayneXServer();

// Start server if run directly
if (require.main === module) {
    server.start().catch(console.error);
}

module.exports = server;￼Enter
