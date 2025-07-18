// src/web/index.js
const BayneXWebSocketServer = require('./WebSocketServer');
const express = require('express');
const path = require('path');
const cors = require('cors');

class BayneXWebModule {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.PORT || 3000,
            wsPort: config.wsPort || process.env.WS_PORT || 8080,
            staticPath: config.staticPath || path.join(__dirname, 'dashboard'),
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
            corsOrigins: config.corsOrigins || ['http://localhost:3000', 'https://baynex-ax.onrender.com'],
            ...config
        };
        
        this.app = express();
        this.server = null;
        this.wsServer = null;
        this.isRunning = false;
    }
    
    async initialize() {
        try {
            this.log('Initializing BAYNEX.A.X Web Module...');
            
            // Setup Express middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Initialize WebSocket server
            await this.initializeWebSocket();
            
            // Start HTTP server
            await this.startServer();
            
            this.isRunning = true;
            this.log('Web Module initialized successfully');
            
            return true;
        } catch (error) {
            this.log(`Web Module initialization failed: ${error.message}`, 'error');
            return false;
        }
    }
    
    setupMiddleware() {
        // CORS configuration
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            
            // CSP for dashboard
            if (req.path.startsWith('/dashboard') || req.path === '/') {
                res.setHeader('Content-Security-Policy', 
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://www.gstatic.com; " +
                    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' ws: wss: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;"
                );
            }
            
            next();
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            this.log(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        
        // Static files
        this.app.use('/dashboard', express.static(this.config.staticPath));
        this.app.use('/assets', express.static(path.join(this.config.staticPath, 'assets')));
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                services: {
                    webServer: this.isRunning,
                    webSocket: this.wsServer ? this.wsServer.server?.listening : false
                }
            });
        });
        
        // System status endpoint
        this.app.get('/api/status', (req, res) => {
            try {
                const status = {
                    system: 'BAYNEX.A.X',
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    services: {
                        webServer: this.isRunning,
                        webSocket: this.wsServer?.getStats() || null,
                        uptime: process.uptime()
                    }
                };
                
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: 'Failed to get system status' });
            }
        });
        
        // API endpoints for dashboard data
        this.setupAPIRoutes();
        
        // Dashboard routes
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.config.staticPath, 'index.html'));
        });
        
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(this.config.staticPath, 'index.html'));
        });
        
        // Catch-all route for SPA
        this.app.get('*', (req, res) => {
            // Only serve dashboard for non-API routes
            if (!req.path.startsWith('/api/')) {
                res.sendFile(path.join(this.config.staticPath, 'index.html'));
            } else {
                res.status(404).json({ error: 'API endpoint not found' });
            }
        });
        
        // Error handling middleware
        this.app.use(this.errorHandler.bind(this));
    }
    
    setupAPIRoutes() {
        // Authentication middleware for API routes
        const authMiddleware = (req, res, next) => {
            // Simple token validation - in production, use proper JWT validation
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            // TODO: Validate JWT token with Firebase Admin SDK
            next();
        };
        
        // Protected API routes
        this.app.use('/api/protected', authMiddleware);
        
        // Trading data endpoints
        this.app.get('/api/protected/trades', (req, res) => {
            // This would integrate with the main trading system
            res.json({
                trades: [],
                total: 0,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50
            });
        });
        
        this.app.get('/api/protected/balance', (req, res) => {
            // This would get real balance data
            res.json({
                totalBalance: 0,
                platforms: {},
                lastUpdated: new Date().toISOString()
            });
        });
        
        this.app.get('/api/protected/performance', (req, res) => {
            const timeframe = req.query.timeframe || '24h';
            
            res.json({
                timeframe,
                profit: 0,
                winRate: 0,
                totalTrades: 0,
                avgTradeTime: 0,
                chartData: []
            });
        });
        
        // Strategy management endpoints
        this.app.get('/api/protected/strategies', (req, res) => {
            res.json({
                active: [],
                available: [],
                performance: {}
            });
        });
        
        this.app.post('/api/protected/strategies/:id/toggle', (req, res) => {
            const strategyId = req.params.id;
            const { enabled } = req.body;
            
            // This would integrate with strategy manager
            res.json({
                success: true,
                strategyId,
                enabled,
                message: `Strategy ${enabled ? 'enabled' : 'disabled'} successfully`
            });
        });
        
        // Goal management endpoints
        this.app.get('/api/protected/goals', (req, res) => {
            res.json({
                active: [],
                completed: [],
                progress: {}
            });
        });
        
        this.app.post('/api/protected/goals', (req, res) => {
            const goal = req.body;
            
            // This would integrate with goal tracker
            res.json({
                success: true,
                goalId: 'goal_' + Date.now(),
                goal,
                message: 'Goal created successfully'
            });
        });
        
        // System control endpoints
        this.app.post('/api/protected/system/emergency-stop', (req, res) => {
            // This would trigger emergency stop in main system
            res.json({
                success: true,
                message: 'Emergency stop initiated',
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.post('/api/protected/system/restart', (req, res) => {
            // This would restart the trading system
            res.json({
                success: true,
                message: 'System restart initiated',
                timestamp: new Date().toISOString()
            });
        });
        
        // Export endpoints
        this.app.get('/api/protected/export/trades', (req, res) => {
            const format = req.query.format || 'csv';
            const from = req.query.from;
            const to = req.query.to;
            
            // This would generate and return trade export
            res.json({
                success: true,
                downloadUrl: `/api/protected/download/trades-${Date.now()}.${format}`,
                message: 'Export prepared successfully'
            });
        });
        
        this.app.get('/api/protected/export/performance', (req, res) => {
            const format = req.query.format || 'csv';
            
            res.json({
                success: true,
                downloadUrl: `/api/protected/download/performance-${Date.now()}.${format}`,
                message: 'Performance report prepared successfully'
            });
        });
    }
    
    async initializeWebSocket() {
        this.wsServer = new BayneXWebSocketServer({
            port: this.config.wsPort,
            jwtSecret: this.config.jwtSecret
        });
        
        // Setup WebSocket event handlers
        this.wsServer.on('client_connected', (data) => {
            this.log(`WebSocket client connected: ${data.user.email}`);
        });
        
        this.wsServer.on('client_disconnected', (data) => {
            this.log(`WebSocket client disconnected: ${data.user.email}`);
        });
        
        this.wsServer.on('user_action', (data) => {
            this.handleUserAction(data);
        });
        
        this.wsServer.on('server_error', (error) => {
            this.log(`WebSocket server error: ${error.message}`, 'error');
        });
        
        return await this.wsServer.initialize();
    }
    
    handleUserAction(actionData) {
        const { action, params, user, clientId } = actionData;
        
        this.log(`User action: ${action} by ${user.email}`);
        
        // Emit to main system for handling
        this.emit('user_action', actionData);
        
        // Send acknowledgment to client
        this.wsServer.sendToClient(clientId, {
            type: 'action_acknowledged',
            data: {
                action,
                timestamp: Date.now(),
                message: `Action ${action} received and processing`
            }
        });
    }
    
    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    this.log(`HTTP server started on port ${this.config.port}`);
                    resolve();
                }
            });
            
            this.server.on('error', (error) => {
                this.log(`HTTP server error: ${error.message}`, 'error');
            });
        });
    }
    
    errorHandler(error, req, res, next) {
        this.log(`HTTP error: ${error.message}`, 'error');
        
        // Don't leak error details in production
        const isDev = process.env.NODE_ENV === 'development';
        
        res.status(error.status || 500).json({
            error: isDev ? error.message : 'Internal server error',
            timestamp: new Date().toISOString(),
            path: req.path
        });
    }
    
    // Event emitter methods
    emit(event, data) {
        // This would be connected to the main system event emitter
        console.log(`[WebModule] Event: ${event}`, data);
    }
    
    // WebSocket broadcasting methods
    broadcastTradeUpdate(tradeData) {
        if (this.wsServer) {
            this.wsServer.onTradeUpdate(tradeData);
        }
    }
    
    broadcastBalanceUpdate(balanceData) {
        if (this.wsServer) {
            this.wsServer.onBalanceUpdate(balanceData);
        }
// src/web/index.js
const BayneXWebSocketServer = require('./WebSocketServer');
const express = require('express');
const path = require('path');
const cors = require('cors');

class BayneXWebModule {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.PORT || 3000,
            wsPort: config.wsPort || process.env.WS_PORT || 8080,
            staticPath: config.staticPath || path.join(__dirname, 'dashboard'),
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
            corsOrigins: config.corsOrigins || ['http://localhost:3000', 'https://baynex-ax.onrender.com'],
            ...config
        };
        
        this.app = express();
        this.server = null;
        this.wsServer = null;
        this.isRunning = false;
    }
    
    async initialize() {
        try {
            this.log('Initializing BAYNEX.A.X Web Module...');
            
            // Setup Express middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Initialize WebSocket server
            await this.initializeWebSocket();
            
            // Start HTTP server
            await this.startServer();
            
            this.isRunning = true;
            this.log('Web Module initialized successfully');
            
            return true;
        } catch (error) {
            this.log(`Web Module initialization failed: ${error.message}`, 'error');
            return false;
        }
    }
    
    setupMiddleware() {
        // CORS configuration
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            
            // CSP for dashboard
            if (req.path.startsWith('/dashboard') || req.path === '/') {
                res.setHeader('Content-Security-Policy', 
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://www.gstatic.com; " +
                    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' ws: wss: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;"
                );
            }
            
            next();
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            this.log(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        
        // Static files
        this.app.use('/dashboard', express.static(this.config.staticPath));
        this.app.use('/assets', express.static(path.join(this.config.staticPath, 'assets')));
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                services: {
                    webServer: this.isRunning,
                    webSocket: this.wsServer ? this.wsServer.server?.listening : false
                }
            });
        });
        
        // System status endpoint
        this.app.get('/api/status', (req, res) => {
            try {
                const status = {
                    system: 'BAYNEX.A.X',
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    services: {
                        webServer: this.isRunning,
                        webSocket: this.wsServer?.getStats() || null,
                        uptime: process.uptime()
                    }
                };
                
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: 'Failed to get system status' });
            }
        });
        
        // API endpoints for dashboard data
        this.setupAPIRoutes();
        
        // Dashboard routes
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.config.staticPath, 'index.html'));
        });
        
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(this.config.staticPath, 'index.html'));
        });
        
        // Catch-all route for SPA
        this.app.get('*', (req, res) => {
            // Only serve dashboard for non-API routes
            if (!req.path.startsWith('/api/')) {
                res.sendFile(path.join(this.config.staticPath, 'index.html'));
            } else {
                res.status(404).json({ error: 'API endpoint not found' });
            }
        });
        
        // Error handling middleware
        this.app.use(this.errorHandler.bind(this));
    }
    
    setupAPIRoutes() {
        // Authentication middleware for API routes
        const authMiddleware = (req, res, next) => {
            // Simple token validation - in production, use proper JWT validation
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            // TODO: Validate JWT token with Firebase Admin SDK
            next();
        };
        
        // Protected API routes
        this.app.use('/api/protected', authMiddleware);
        
        // Trading data endpoints
        this.app.get('/api/protected/trades', (req, res) => {
            // This would integrate with the main trading system
            res.json({
                trades: [],
                total: 0,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50
            });
        });
        
        this.app.get('/api/protected/balance', (req, res) => {
            // This would get real balance data
            res.json({
                totalBalance: 0,
                platforms: {},
                lastUpdated: new Date().toISOString()
            });
        });
        
        this.app.get('/api/protected/performance', (req, res) => {
            const timeframe = req.query.timeframe || '24h';
            
            res.json({
                timeframe,
                profit: 0,
                winRate: 0,
                totalTrades: 0,
                avgTradeTime: 0,
                chartData: []
            });
        });
        
        // Strategy management endpoints
        this.app.get('/api/protected/strategies', (req, res) => {
            res.json({
                active: [],
                available: [],
                performance: {}
            });
        });
        
        this.app.post('/api/protected/strategies/:id/toggle', (req, res) => {
            const strategyId = req.params.id;
            const { enabled } = req.body;
            
            // This would integrate with strategy manager
            res.json({
                success: true,
                strategyId,
                enabled,
                message: `Strategy ${enabled ? 'enabled' : 'disabled'} successfully`
            });
        });
        
        // Goal management endpoints
        this.app.get('/api/protected/goals', (req, res) => {
            res.json({
                active: [],
                completed: [],
                progress: {}
            });
        });
        
        this.app.post('/api/protected/goals', (req, res) => {
            const goal = req.body;
            
            // This would integrate with goal tracker
            res.json({
                success: true,
                goalId: 'goal_' + Date.now(),
                goal,
                message: 'Goal created successfully'
            });
        });
        
        // System control endpoints
        this.app.post('/api/protected/system/emergency-stop', (req, res) => {
            // This would trigger emergency stop in main system
            res.json({
                success: true,
                message: 'Emergency stop initiated',
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.post('/api/protected/system/restart', (req, res) => {
            // This would restart the trading system
            res.json({
                success: true,
                message: 'System restart initiated',
                timestamp: new Date().toISOString()
            });
        });
        
        // Export endpoints
        this.app.get('/api/protected/export/trades', (req, res) => {
            const format = req.query.format || 'csv';
            const from = req.query.from;
            const to = req.query.to;
            
            // This would generate and return trade export
            res.json({
                success: true,
                downloadUrl: `/api/protected/download/trades-${Date.now()}.${format}`,
                message: 'Export prepared successfully'
            });
        });
        
        this.app.get('/api/protected/export/performance', (req, res) => {
            const format = req.query.format || 'csv';
            
            res.json({
                success: true,
                downloadUrl: `/api/protected/download/performance-${Date.now()}.${format}`,
                message: 'Performance report prepared successfully'
            });
        });
    }
    
    async initializeWebSocket() {
        this.wsServer = new BayneXWebSocketServer({
            port: this.config.wsPort,
            jwtSecret: this.config.jwtSecret
        });
        
        // Setup WebSocket event handlers
        this.wsServer.on('client_connected', (data) => {
            this.log(`WebSocket client connected: ${data.user.email}`);
        });
        
        this.wsServer.on('client_disconnected', (data) => {
            this.log(`WebSocket client disconnected: ${data.user.email}`);
        });
        
        this.wsServer.on('user_action', (data) => {
            this.handleUserAction(data);
        });
        
        this.wsServer.on('server_error', (error) => {
            this.log(`WebSocket server error: ${error.message}`, 'error');
        });
        
        return await this.wsServer.initialize();
    }
    
    handleUserAction(actionData) {
        const { action, params, user, clientId } = actionData;
        
        this.log(`User action: ${action} by ${user.email}`);
        
        // Emit to main system for handling
        this.emit('user_action', actionData);
        
        // Send acknowledgment to client
        this.wsServer.sendToClient(clientId, {
            type: 'action_acknowledged',
            data: {
                action,
                timestamp: Date.now(),
                message: `Action ${action} received and processing`
            }
        });
    }
    
    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    this.log(`HTTP server started on port ${this.config.port}`);
                    resolve();
                }
            });
            
            this.server.on('error', (error) => {
                this.log(`HTTP server error: ${error.message}`, 'error');
            });
        });
    }
    
    errorHandler(error, req, res, next) {
        this.log(`HTTP error: ${error.message}`, 'error');
        
        // Don't leak error details in production
        const isDev = process.env.NODE_ENV === 'development';
        
        res.status(error.status || 500).json({
            error: isDev ? error.message : 'Internal server error',
            timestamp: new Date().toISOString(),
            path: req.path
        });
    }
    
    // Event emitter methods
    emit(event, data) {
        // This would be connected to the main system event emitter
        console.log(`[WebModule] Event: ${event}`, data);
    }
    
    // WebSocket broadcasting methods
    broadcastTradeUpdate(tradeData) {
        if (this.wsServer) {
            this.wsServer.onTradeUpdate(tradeData);
        }
    }
    
    broadcastBalanceUpdate(balanceData) {
        if (this.wsServer) {
            this.wsServer.onBalanceUpdate(balanceData);
        }
    }
    
    broadcastStrategyUpdate(strategyData) {
        if (this.wsServer) {
            this.wsServer.onStrategyUpdate(strategyData);
        }
    }
    
    broadcastVoiceMessage(voiceData) {
        if (this.wsServer) {
            this.wsServer.onVoiceMessage(voiceData);
        }
    }
    
    broadcastRiskAlert(riskData) {
        if (this.wsServer) {
            this.wsServer.onRiskAlert(riskData);
        }
    }
    
    broadcastGoalUpdate(goalData) {
        if (this.wsServer) {
            this.wsServer.onGoalUpdate(goalData);
        }
    }
    
    broadcastPerformanceUpdate(performanceData) {
        if (this.wsServer) {
            this.wsServer.onPerformanceUpdate(performanceData);
        }
    }
    
    // System management
    getStats() {
        return {
            httpServer: {
                running: this.isRunning,
                port: this.config.port,
                uptime: this.server ? process.uptime() : 0
            },
            webSocket: this.wsServer ? this.wsServer.getStats() : null
        };
    }
    
    async shutdown() {
        this.log('Shutting down Web Module...');
        
        try {
            // Shutdown WebSocket server
            if (this.wsServer) {
                await this.wsServer.shutdown();
            }
            
            // Shutdown HTTP server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }
            
            this.isRunning = false;
            this.log('Web Module shutdown complete');
        } catch (error) {
            this.log(`Web Module shutdown error: ${error.message}`, 'error');
        }
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [WebModule] [${level.toUpperCase()}] ${message}`);
    }
}

module.exports = {
    BayneXWebModule,
    BayneXWebSocketServer,
    
    // Factory function
    createWebModule: (config = {}) => {
        return new BayneXWebModule(config);
    }
};
