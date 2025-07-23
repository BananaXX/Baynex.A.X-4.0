// BayneXSystem.js - Main System Orchestrator
// Binary Autonomous Yield Navigation & Execution X-System

const { EventEmitter } = require('events');
const path = require('path');

// Core Components
const BayneXConfigManager = require('./src/config/ConfigManager');
const BayneXLogger = require('./src/utils/Logger');
const DatabaseManager = require('./src/data/DatabaseManager');
const BayneXCore = require('./src/core/BayneXCore');
const BayneXIntegrationLayer = require('./src/integration/BayneXIntegrationLayer');

// AI and Learning
const AILearningEngine = require('./src/ai/AILearningEngine');
const StrategyManager = require('./src/ai/StrategyManager');

// Platform Connectors
const PlatformConnectors = require('./src/platforms/PlatformConnectors');
const DerivConnector = require('./src/platforms/DerivConnector');

// Trading Systems
const TradingStrategies = require('./src/strategies/TradingStrategies');
const RiskManager = require('./src/risk/RiskManager');

// Interface Systems
const NotificationSystem = require('./src/notifications/NotificationSystem');
const VoiceAssistant = require('./src/voice/VoiceAssistant');
const BayneXWebModule = require('./src/web/index');
const GoalTracker = require('./src/goals/GoalTracker');

class BayneXSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.state = 'initializing';
        this.startTime = Date.now();
        this.components = {};
        this.systemMetrics = {
            tradesExecuted: 0,
            totalProfit: 0,
            systemUptime: 0,
            lastBalanceUpdate: null,
            activePlatforms: []
        };
        
        this.options = {
            configPath: options.configPath || path.join(__dirname, 'data/config.json'),
            ...options.config
        };
        
        this.logger = null;
        this.config = null;
        
        // Auto-initialize
        this.initialize().catch(error => {
            console.error('System initialization failed:', error);
            this.emit('error', error);
        });
    }
    
    async initialize() {
        try {
            console.log('🚀 Initializing BAYNEX.A.X System Components...');
            
            // Initialize configuration manager
            await this.initializeConfiguration(this.options);
            
            // Initialize logger
            await this.initializeLogger();
            
            // Initialize database
            await this.initializeDatabase();
            
            // Initialize core components
            await this.initializeCoreComponents();
            
            // Initialize AI and learning systems
            await this.initializeAI();
            
            // Initialize platform connectors
            await this.initializePlatforms();
            
            // Initialize trading systems
            await this.initializeTradingSystems();
            
            // Initialize interface systems
            await this.initializeInterfaceSystems();
            
            // Setup component interconnections
            await this.setupComponentConnections();
            
            // Start system monitoring
            this.startSystemMonitoring();
            
            this.state = 'ready';
            this.logger.info('System', 'BAYNEX.A.X System fully initialized and ready');
            
            this.emit('system_ready');
            
        } catch (error) {
            this.state = 'error';
            console.error('BAYNEX.A.X initialization failed:', error);
            
            if (this.logger) {
                this.logger.error('System', 'Initialization failed', { error: error.message, stack: error.stack });
            }
            
            throw error;
        }
    }
    
    async initializeConfiguration(options) {
        this.logger = console; // Temporary logger until proper logger is initialized
        
        this.logger.log('🔧 Initializing Configuration Manager...');
        
        this.components.config = new BayneXConfigManager({
            configPath: options.configPath || path.join(__dirname, 'data/config.json'),
            ...options.config
        });
        
        await this.components.config.init();
        this.config = this.components.config;
        
        this.logger.log('✅ Configuration Manager initialized');
    }
    
    async initializeLogger() {
        console.log('📝 Initializing Logger...');
        
        this.components.logger = new BayneXLogger({
            level: this.config.get('system.logLevel', 'info'),
            logPath: path.join(__dirname, 'logs'),
            enableConsole: true,
            enableFile: true,
            ...this.config.get('logging', {})
        });
        
        await this.components.logger.initialize();
        this.logger = this.components.logger;
        
        this.logger.info('System', 'Logger initialized successfully');
    }
    
    async initializeDatabase() {
        this.logger.info('System', 'Initializing Database Manager...');
        
        this.components.database = new DatabaseManager({
            dataPath: path.join(__dirname, 'data'),
            ...this.config.get('data', {})
        });
        
        await this.components.database.initialize();
        
        this.logger.info('System', 'Database Manager initialized');
    }
    
    async initializeCoreComponents() {
        this.logger.info('System', 'Initializing Core Components...');
        
        // Initialize Core System
        this.components.core = new BayneXCore({
            config: this.config,
            logger: this.logger,
            database: this.components.database
        });
        
        await this.components.core.initialize();
        
        // Initialize Integration Layer
        this.components.integration = new BayneXIntegrationLayer({
            config: this.config,
            logger: this.logger
        });
        
        await this.components.integration.initialize();
        
        this.logger.info('System', 'Core Components initialized');
    }
    
    async initializeAI() {
        this.logger.info('System', 'Initializing AI Learning Engine...');
        
        // Initialize AI Learning Engine
        this.components.aiEngine = new AILearningEngine({
            config: this.config,
            logger: this.logger,
            database: this.components.database
        });
        
        await this.components.aiEngine.initialize();
        
        // Initialize Strategy Manager
        this.components.strategyManager = new StrategyManager({
            config: this.config,
            logger: this.logger,
            aiEngine: this.components.aiEngine
        });
        
        await this.components.strategyManager.initialize();
        
        this.logger.info('System', 'AI systems initialized');
    }
    
    async initializePlatforms() {
        this.logger.info('System', 'Initializing Platform Connectors...');
        
        this.components.platforms = new PlatformConnectors({
            config: this.config,
            logger: this.logger
        });
        
        await this.components.platforms.initialize();
        
        this.logger.info('System', 'Platform Connectors initialized');
    }
    
    async initializeTradingSystems() {
        this.logger.info('System', 'Initializing Trading Systems...');
        
        // Initialize Trading Strategies
        this.components.strategies = new TradingStrategies({
            config: this.config,
            logger: this.logger,
            aiEngine: this.components.aiEngine
        });
        
        await this.components.strategies.initialize();
        
        // Initialize Risk Manager
        this.components.riskManager = new RiskManager({
            config: this.config,
            logger: this.logger,
            database: this.components.database
        });
        
        await this.components.riskManager.initialize();
        
        this.logger.info('System', 'Trading Systems initialized');
    }
    
    async initializeInterfaceSystems() {
        this.logger.info('System', 'Initializing Interface Systems...');
        
        // Initialize Notification System
        this.components.notifications = new NotificationSystem({
            config: this.config,
            logger: this.logger
        });
        
        await this.components.notifications.initialize();
        
        // Initialize Voice Assistant
        this.components.voice = new VoiceAssistant({
            config: this.config,
            logger: this.logger
        });
        
        await this.components.voice.initialize();
        
        // Initialize Web Module
        this.components.web = new BayneXWebModule({
            port: this.config.get('web.port', 3000),
            wsPort: this.config.get('web.wsPort', 8080),
            config: this.config,
            logger: this.logger
        });
        
        await this.components.web.initialize();
        
        // Initialize Goal Tracker
        this.components.goalTracker = new GoalTracker({
            config: this.config,
            logger: this.logger,
            database: this.components.database
        });
        
        await this.components.goalTracker.initialize();
        
        this.logger.info('System', 'Interface Systems initialized');
    }
    
    async setupComponentConnections() {
        this.logger.info('System', 'Setting up component interconnections...');
        
        // Connect platform events to core system
        this.components.platforms.on('trade_executed', (trade) => {
            this.handleTradeExecuted(trade);
        });
        
        this.components.platforms.on('balance_update', (balance) => {
            this.handleBalanceUpdate(balance);
        });
        
        this.components.platforms.on('platform_connected', (platform) => {
            this.logger.info('System', `Platform connected: ${platform.platform}`);
            this.systemMetrics.activePlatforms.push(platform.platform);
        });
        
        this.components.platforms.on('platform_disconnected', (platform) => {
            this.logger.warn('System', `Platform disconnected: ${platform.platform}`);
            this.systemMetrics.activePlatforms = this.systemMetrics.activePlatforms.filter(p => p !== platform.platform);
        });
        
        // Connect AI learning to trade results
        this.components.core.on('trade_completed', (trade) => {
            this.components.aiEngine.processTrade(trade);
        });
        
        // Connect risk manager to trading system
        this.components.riskManager.on('risk_alert', (alert) => {
            this.handleRiskAlert(alert);
        });
        
        // Connect voice assistant to system events
        this.on('trade_executed', (trade) => {
            this.components.voice.announceTradeExecution(trade);
        });
        
        this.on('balance_update', (balance) => {
            this.components.voice.announceBalanceUpdate(balance);
        });
        
        // Connect web module to system events
        this.on('trade_executed', (trade) => {
            this.components.web.broadcastTradeUpdate(trade);
        });
        
        this.on('balance_update', (balance) => {
            this.components.web.broadcastBalanceUpdate(balance);
        });
        
        this.logger.info('System', 'Component connections established');
    }
    
    startSystemMonitoring() {
        this.logger.info('System', 'Starting system monitoring...');
        
        // Update system metrics every 30 seconds
        setInterval(() => {
            this.updateSystemMetrics();
        }, 30000);
        
        // Perform system health check every 5 minutes
        setInterval(() => {
            this.performHealthCheck();
        }, 300000);
        
        this.logger.info('System', 'System monitoring started');
    }
    
    async startTrading() {
        try {
            this.logger.info('System', 'Starting autonomous trading...');
            
            if (!this.components.platforms.isAnyPlatformConnected()) {
                throw new Error('No trading platforms are connected');
            }
            
            // Enable trading in core system
            await this.components.core.startTrading();
            
            // Start strategy execution
            await this.components.strategies.startExecution();
            
            // Enable risk monitoring
            await this.components.riskManager.startMonitoring();
            
            this.logger.info('System', 'Autonomous trading started successfully');
            this.emit('trading_started');
            
            return true;
        } catch (error) {
            this.logger.error('System', 'Failed to start trading', { error: error.message });
            throw error;
        }
    }
    
    async stopTrading() {
        try {
            this.logger.info('System', 'Stopping autonomous trading...');
            
            // Stop strategy execution
            await this.components.strategies.stopExecution();
            
            // Stop trading in core system
            await this.components.core.stopTrading();
            
            // Stop risk monitoring
            await this.components.riskManager.stopMonitoring();
            
            this.logger.info('System', 'Autonomous trading stopped');
            this.emit('trading_stopped');
            
            return true;
        } catch (error) {
            this.logger.error('System', 'Failed to stop trading', { error: error.message });
            throw error;
        }
    }
    
    handleTradeExecuted(trade) {
        this.systemMetrics.tradesExecuted++;
        this.systemMetrics.lastTradeTime = Date.now();
        
        this.logger.info('System', 'Trade executed', {
            platform: trade.platform,
            asset: trade.asset,
            direction: trade.direction,
            amount: trade.amount
        });
        
        // Store trade in database
        this.components.database.storeTrade(trade);
        
        // Send notifications
        this.components.notifications.sendTradeNotification(trade);
        
        this.emit('trade_executed', trade);
    }
    
    handleBalanceUpdate(balance) {
        this.systemMetrics.lastBalanceUpdate = Date.now();
        this.systemMetrics.currentBalance = balance.totalBalance;
        
        this.logger.debug('System', 'Balance updated', {
            platform: balance.platform,
            balance: balance.totalBalance,
            change: balance.change
        });
        
        // Update goal progress
        this.components.goalTracker.updateProgress(balance);
        
        this.emit('balance_update', balance);
    }
    
    handleRiskAlert(alert) {
        this.logger.warn('System', 'Risk alert triggered', {
            type: alert.type,
            severity: alert.severity,
            message: alert.message
        });
        
        // Take appropriate action based on alert severity
        if (alert.severity === 'critical') {
            this.emergencyStop();
        }
        
        // Send urgent notification
        this.components.notifications.sendRiskAlert(alert);
        
        this.emit('risk_alert', alert);
    }
    
    async emergencyStop() {
        this.logger.error('System', 'Emergency stop triggered');
        
        try {
            // Stop all trading immediately
            await this.stopTrading();
            
            // Close all open positions
            await this.components.platforms.closeAllPositions();
            
            // Send emergency notifications
            this.components.notifications.sendEmergencyNotification('Emergency stop activated');
            
            this.emit('emergency_stop');
        } catch (error) {
            this.logger.error('System', 'Emergency stop failed', { error: error.message });
        }
    }
    
    updateSystemMetrics() {
        this.systemMetrics.systemUptime = Date.now() - this.startTime;
        
        // Get current balances from all platforms
        const balances = this.components.platforms.getAllBalances();
        if (balances) {
            this.systemMetrics.totalBalance = balances.total;
            this.systemMetrics.dailyPnL = balances.dailyPnL;
        }
        
        this.emit('metrics_updated', this.systemMetrics);
    }
    
    performHealthCheck() {
        const healthStatus = {
            timestamp: Date.now(),
            overall: 'healthy',
            components: {}
        };
        
        // Check each component
        for (const [name, component] of Object.entries(this.components)) {
            if (typeof component.getHealthStatus === 'function') {
                healthStatus.components[name] = component.getHealthStatus();
            } else {
                healthStatus.components[name] = { status: 'unknown' };
            }
        }
        
        // Determine overall health
        const unhealthyComponents = Object.values(healthStatus.components)
            .filter(status => status.status !== 'healthy');
        
        if (unhealthyComponents.length > 0) {
            healthStatus.overall = 'degraded';
            this.logger.warn('System', 'System health degraded', { unhealthyComponents });
        }
        
        this.emit('health_check', healthStatus);
    }
    
    getSystemStatus() {
        return {
            state: this.state,
            uptime: Date.now() - this.startTime,
            components: Object.keys(this.components),
            metrics: this.systemMetrics,
            trading: {
                enabled: this.components.core?.isTradingEnabled() || false,
                activePlatforms: this.systemMetrics.activePlatforms
            }
        };
    }
    
    async getBalance() {
        try {
            return await this.components.platforms.getAllBalances();
        } catch (error) {
            this.logger.error('System', 'Failed to get balance', { error: error.message });
            return null;
        }
    }
    
    async placeTrade(tradeParams) {
        try {
            return await this.components.core.executeTrade(tradeParams);
        } catch (error) {
            this.logger.error('System', 'Failed to place trade', { error: error.message });
            throw error;
        }
    }
    
    async initiateShutdown(signal = 'SIGTERM') {
        this.logger.info('System', `Initiating graceful shutdown (${signal})...`);
        
        try {
            // Stop trading first
            if (this.components.core?.isTradingEnabled()) {
                await this.stopTrading();
            }
            
            // Shutdown components in reverse order
            const shutdownOrder = [
                'web', 'voice', 'notifications', 'goalTracker',
                'riskManager', 'strategies', 'platforms',
                'aiEngine', 'strategyManager', 'core',
                'integration', 'database', 'logger'
            ];
            
            for (const componentName of shutdownOrder) {
                if (this.components[componentName] && typeof this.components[componentName].shutdown === 'function') {
                    this.logger.info('System', `Shutting down ${componentName}...`);
                    await this.components[componentName].shutdown();
                }
            }
            
            this.state = 'stopped';
            console.log('✅ BAYNEX.A.X System shutdown complete');
            
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }
}

module.exports = BayneXSystem;
