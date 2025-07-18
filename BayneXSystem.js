// BayneXSystem.js - Main System Orchestrator
const EventEmitter = require('events');
const path = require('path');

// Core modules
const { BayneXCore } = require('./src/core');
const { BayneXIntegrationLayer } = require('./src/integration');
const { AILearningEngine, StrategyManager } = require('./src/ai');
const { PlatformConnectors } = require('./src/platforms');
const { TradingStrategies } = require('./src/strategies');
const { RiskManager } = require('./src/risk');
const { DataProcessor, DatabaseManager } = require('./src/data');
const { NotificationSystem } = require('./src/notifications');
const { BaynexaVoiceAssistant } = require('./src/voice');
const { BayneXWebModule } = require('./src/web');
const { BayneXGoalTracker } = require('./src/goals');
const { BayneXConfigManager } = require('./src/config');
const { BayneXLogger, BayneXHelpers } = require('./src/utils');

class BayneXSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.version = '1.0.0';
        this.startTime = Date.now();
        this.state = 'initializing';
        this.isShuttingDown = false;
        
        // System components
        this.components = {};
        this.modules = {};
        this.services = {};
        
        // System metrics
        this.metrics = {
            totalTrades: 0,
            totalProfit: 0,
            winRate: 0,
            uptime: 0,
            lastHeartbeat: Date.now()
        };
        
        // Initialize configuration first
        this.initializeSystem(options);
    }
    
    async initializeSystem(options = {}) {
        try {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    BAYNEX.A.X STARTING                      ║
║         Binary Autonomous Yield Navigation &                ║
║              Execution X-System v${this.version}                 ║
╚══════════════════════════════════════════════════════════════╝
            `);
            
            this.state = 'initializing';
            
            // Step 1: Initialize Configuration Manager
            await this.initializeConfiguration(options);
            
            // Step 2: Initialize Logger
            await this.initializeLogger();
            
            // Step 3: Initialize Database
            await this.initializeDatabase();
            
            // Step 4: Initialize Core Components
            await this.initializeCoreComponents();
            
            // Step 5: Initialize AI and Learning Systems
            await this.initializeAI();
            
            // Step 6: Initialize Trading Systems
            await this.initializeTradingSystems();
            
            // Step 7: Initialize Platform Connectors
            await this.initializePlatforms();
            
            // Step 8: Initialize Risk Management
            await this.initializeRiskManagement();
            
            // Step 9: Initialize Notifications
            await this.initializeNotifications();
            
            // Step 10: Initialize Voice Assistant
            await this.initializeVoiceAssistant();
            
            // Step 11: Initialize Web Interface
            await this.initializeWebInterface();
            
            // Step 12: Initialize Goal Tracking
            await this.initializeGoalTracking();
            
            // Step 13: Setup System Monitoring
            await this.setupSystemMonitoring();
            
            // Step 14: Setup Event Handlers
            this.setupEventHandlers();
            
            // Step 15: Final System Validation
            await this.validateSystemIntegrity();
            
            // Step 16: Start System Services
            await this.startSystemServices();
            
            this.state = 'running';
            
            this.logger.info('System', 'BAYNEX.A.X fully initialized and running', {
                version: this.version,
                uptime: Date.now() - this.startTime,
                components: Object.keys(this.components).length,
                modules: Object.keys(this.modules).length
            });
            
            // Announce system ready
            if (this.components.voiceAssistant) {
                await this.components.voiceAssistant.speak(
                    'BAYNEX.A.X is fully operational and ready for autonomous trading execution.'
                );
            }
            
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
            logger: this.logger,
            core: this.components.core
        });
        
        await this.components.integration.initialize();
        
        // Initialize Data Processor
        this.components.dataProcessor = new DataProcessor({
            config: this.config,
            logger: this.logger,
            database: this.components.database
        });
        
        await this.components.dataProcessor.initialize();
        
        this.logger.info('System', 'Core Components initialized');
    }
    
    async initializeAI() {
        this.logger.info('System', 'Initializing AI Learning Engine...');
        
        this.components.aiEngine = new AILearningEngine({
            config: this.config.getAIConfig(),
            logger: this.logger,
            dataProcessor: this.components.dataProcessor
        });
        
        await this.components.aiEngine.initialize();
        
        this.components.strategyManager = new StrategyManager({
            config: this.config.getStrategyConfig(),
            logger: this.logger,
            aiEngine: this.components.aiEngine
        });
        
        await this.components.strategyManager.initialize();
        
        this.logger.info('System', 'AI Learning Engine initialized');
    }
    
    async initializeTradingSystems() {
        this.logger.info('System', 'Initializing Trading Systems...');
        
        this.components.tradingStrategies = new TradingStrategies({
            config: this.config.getStrategyConfig(),
            logger: this.logger,
            strategyManager: this.components.strategyManager,
            aiEngine: this.components.aiEngine
        });
        
        await this.components.tradingStrategies.initialize();
        
        this.logger.info('System', 'Trading Systems initialized');
    }
    
    async initializePlatforms() {
        this.logger.info('System', 'Initializing Platform Connectors...');
        
        this.components.platforms = new PlatformConnectors({
            config: this.config,
            logger: this.logger,
            integration: this.components.integration
        });
        
        await this.components.platforms.initialize();
        
        this.logger.info('System', 'Platform Connectors initialized');
    }
    
    async initializeRiskManagement() {
        this.logger.info('System', 'Initializing Risk Management...');
        
        this.components.riskManager = new RiskManager({
            config: this.config.getRiskConfig(),
            logger: this.logger,
            platforms: this.components.platforms,
            dataProcessor: this.components.dataProcessor
        });
        
        await this.components.riskManager.initialize();
        
        this.logger.info('System', 'Risk Management initialized');
    }
    
    async initializeNotifications() {
        this.logger.info('System', 'Initializing Notification System...');
        
        this.components.notifications = new NotificationSystem({
            config: this.config.getNotificationConfig(),
            logger: this.logger
        });
        
        await this.components.notifications.initialize();
        
        this.logger.info('System', 'Notification System initialized');
    }
    
    async initializeVoiceAssistant() {
        this.logger.info('System', 'Initializing Voice Assistant...');
        
        this.components.voiceAssistant = new BaynexaVoiceAssistant({
            config: this.config.get('notifications.voice', {}),
            logger: this.logger
        });
        
        await this.components.voiceAssistant.init();
        
        this.logger.info('System', 'Voice Assistant initialized');
    }
    
    async initializeWebInterface() {
        this.logger.info('System', 'Initializing Web Interface...');
        
        this.components.webModule = new BayneXWebModule({
            config: this.config.getWebConfig(),
            logger: this.logger
        });
        
        await this.components.webModule.initialize();
        
        this.logger.info('System', 'Web Interface initialized');
    }
    
    async initializeGoalTracking() {
        this.logger.info('System', 'Initializing Goal Tracking...');
        
        this.components.goalTracker = new BayneXGoalTracker({
            config: this.config,
            logger: this.logger,
            dataPath: path.join(__dirname, 'data/goals.json')
        });
        
        await this.components.goalTracker.init();
        
        this.logger.info('System', 'Goal Tracking initialized');
    }
    
    async setupSystemMonitoring() {
        this.logger.info('System', 'Setting up System Monitoring...');
        
        // System health monitoring
        this.healthMonitor = setInterval(() => {
            this.checkSystemHealth();
        }, 30000); // Every 30 seconds
        
        // Performance monitoring
        this.performanceMonitor = setInterval(() => {
            this.updateSystemMetrics();
        }, 60000); // Every minute
        
        // Memory monitoring
        this.memoryMonitor = setInterval(() => {
            this.checkMemoryUsage();
        }, 120000); // Every 2 minutes
        
        this.logger.info('System', 'System Monitoring setup complete');
    }
    
    setupEventHandlers() {
        this.logger.info('System', 'Setting up Event Handlers...');
        
        // Component event handlers
        this.setupComponentEventHandlers();
        
        // Trading event handlers
        this.setupTradingEventHandlers();
        
        // System event handlers
        this.setupSystemEventHandlers();
        
        // Error handling
        this.setupErrorHandling();
        
        this.logger.info('System', 'Event Handlers setup complete');
    }
    
    setupComponentEventHandlers() {
        // Platform events
        if (this.components.platforms) {
            this.components.platforms.on('trade_executed', (data) => this.handleTradeExecuted(data));
            this.components.platforms.on('balance_update', (data) => this.handleBalanceUpdate(data));
            this.components.platforms.on('connection_status', (data) => this.handleConnectionStatus(data));
        }
        
        // AI engine events
        if (this.components.aiEngine) {
            this.components.aiEngine.on('learning_update', (data) => this.handleLearningUpdate(data));
            this.components.aiEngine.on('pattern_detected', (data) => this.handlePatternDetected(data));
        }
        
        // Strategy events
        if (this.components.strategyManager) {
            this.components.strategyManager.on('strategy_changed', (data) => this.handleStrategyChanged(data));
            this.components.strategyManager.on('performance_update', (data) => this.handlePerformanceUpdate(data));
        }
        
        // Risk events
        if (this.components.riskManager) {
            this.components.riskManager.on('risk_alert', (data) => this.handleRiskAlert(data));
            this.components.riskManager.on('emergency_stop', (data) => this.handleEmergencyStop(data));
        }
        
        // Goal events
        if (this.components.goalTracker) {
            this.components.goalTracker.on('goal_completed', (data) => this.handleGoalCompleted(data));
            this.components.goalTracker.on('milestone_reached', (data) => this.handleMilestoneReached(data));
        }
        
        // Voice assistant events
        if (this.components.voiceAssistant) {
            this.components.voiceAssistant.on('voice_message', (data) => this.handleVoiceMessage(data));
            this.components.voiceAssistant.on('emergency_shutdown', (data) => this.handleVoiceEmergencyShutdown(data));
        }
        
        // Web interface events
        if (this.components.webModule) {
            this.components.webModule.on('user_action', (data) => this.handleUserAction(data));
        }
    }
    
    setupTradingEventHandlers() {
        this.on('trade_signal', async (signal) => {
            try {
                await this.executeTrade(signal);
            } catch (error) {
                this.logger.error('Trading', 'Trade execution failed', { signal, error: error.message });
            }
        });
        
        this.on('market_data', (data) => {
            if (this.components.aiEngine) {
                this.components.aiEngine.processMarketData(data);
            }
            
            if (this.components.tradingStrategies) {
                this.components.tradingStrategies.analyzeMarketData(data);
            }
        });
    }
    
    setupSystemEventHandlers() {
        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.initiateShutdown('SIGTERM'));
        process.on('SIGINT', () => this.initiateShutdown('SIGINT'));
        
        // Unhandled errors
        process.on('uncaughtException', (error) => {
            this.logger.error('System', 'Uncaught Exception', { error: error.message, stack: error.stack });
            this.initiateShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('System', 'Unhandled Promise Rejection', { reason, promise });
        });
    }
    
    setupErrorHandling() {
        this.on('error', (error) => {
            this.logger.error('System', 'System Error', { error: error.message, stack: error.stack });
        });
    }
    
    // Event Handlers
    async handleTradeExecuted(tradeData) {
        this.metrics.totalTrades++;
        
        if (tradeData.result === 'win') {
            this.metrics.totalProfit += tradeData.pnl || 0;
        } else if (tradeData.result === 'loss') {
            this.metrics.totalProfit -= Math.abs(tradeData.pnl || 0);
        }
        
        // Update win rate
        this.updateWinRate();
        
        // Update goals
        if (this.components.goalTracker) {
            this.components.goalTracker.onTradeExecuted(tradeData);
        }
        
        // Learn from trade
        if (this.components.aiEngine) {
            this.components.aiEngine.learnFromTrade(tradeData);
        }
        
        // Send notifications
        if (this.components.notifications) {
            this.components.notifications.sendTradeNotification(tradeData);
        }
        
        // Voice announcement
        if (this.components.voiceAssistant) {
            this.components.voiceAssistant.emit('trade_executed', tradeData);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastTradeUpdate(tradeData);
        }
        
        this.logger.logTrade(tradeData);
    }
    
    async handleBalanceUpdate(balanceData) {
        // Update goals
        if (this.components.goalTracker) {
            this.components.goalTracker.onBalanceUpdate(balanceData);
        }
        
        // Risk check
        if (this.components.riskManager) {
            this.components.riskManager.checkBalanceRisk(balanceData);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastBalanceUpdate(balanceData);
        }
        
        this.logger.logBalance(balanceData);
    }
    
    async handleStrategyChanged(strategyData) {
        // Voice announcement
        if (this.components.voiceAssistant) {
            this.components.voiceAssistant.emit('strategy_changed', strategyData);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastStrategyUpdate(strategyData);
        }
        
        this.logger.logStrategy(strategyData);
    }
    
    async handleRiskAlert(riskData) {
        // Emergency actions if critical
        if (riskData.level === 'critical') {
            await this.handleEmergencyStop(riskData);
            return;
        }
        
        // Voice alert
        if (this.components.voiceAssistant) {
            this.components.voiceAssistant.emit('risk_warning', riskData);
        }
        
        // Send notifications
        if (this.components.notifications) {
            this.components.notifications.sendRiskAlert(riskData);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastRiskAlert(riskData);
        }
        
        this.logger.logRisk(riskData);
    }
    
    async handleEmergencyStop(data) {
        this.logger.warn('System', 'Emergency stop triggered', data);
        
        // Stop all trading
        await this.stopTrading();
        
        // Voice announcement
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.emergencyShutdown(data.reason || 'Emergency stop triggered');
        }
        
        // Send urgent notifications
        if (this.components.notifications) {
            this.components.notifications.sendEmergencyAlert(data);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastRiskAlert({
                ...data,
                level: 'critical',
                type: 'emergency_stop'
            });
        }
    }
    
    async handleGoalCompleted(goalData) {
        // Voice celebration
        if (this.components.voiceAssistant) {
            this.components.voiceAssistant.emit('goal_achieved', goalData);
        }
        
        // Send notifications
        if (this.components.notifications) {
            this.components.notifications.sendGoalNotification(goalData);
        }
        
        // Broadcast to web clients
        if (this.components.webModule) {
            this.components.webModule.broadcastGoalUpdate(goalData);
        }
        
        this.logger.logGoal(goalData);
    }
    
    async handleUserAction(actionData) {
        const { action, params, user } = actionData;
        
        this.logger.info('System', 'User action received', { action, user: user.email });
        
        try {
            switch (action) {
                case 'start_trading':
                    await this.startTrading();
                    break;
                case 'pause_trading':
                    await this.pauseTrading();
                    break;
                case 'stop_trading':
                    await this.stopTrading();
                    break;
                case 'emergency_stop':
                    await this.handleEmergencyStop({ reason: 'User initiated emergency stop' });
                    break;
                case 'force_learning':
                    if (this.components.aiEngine) {
                        await this.components.aiEngine.forceLearningCycle();
                    }
                    break;
                case 'reset_session':
                    await this.resetTradingSession();
                    break;
                case 'change_voice_mode':
                    if (this.components.voiceAssistant) {
                        this.components.voiceAssistant.setVoiceMode(params.mode);
                    }
                    break;
                default:
                    this.logger.warn('System', 'Unknown user action', { action, params });
            }
        } catch (error) {
            this.logger.error('System', 'User action failed', { action, error: error.message });
        }
    }
    
    // Trading Control Methods
    async startTrading() {
        if (this.state !== 'running') {
            throw new Error('System must be running to start trading');
        }
        
        this.logger.info('System', 'Starting trading systems...');
        
        // Enable trading on all platforms
        if (this.components.platforms) {
            await this.components.platforms.enableTrading();
        }
        
        // Activate strategies
        if (this.components.strategyManager) {
            await this.components.strategyManager.activateStrategies();
        }
        
        this.config.set('trading.enabled', true);
        
        this.logger.info('System', 'Trading systems started');
        
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.speak('Trading systems activated. Beginning autonomous execution.');
        }
    }
    
    async pauseTrading() {
        this.logger.info('System', 'Pausing trading systems...');
        
        // Pause trading on all platforms
        if (this.components.platforms) {
            await this.components.platforms.pauseTrading();
        }
        
        // Pause strategies
        if (this.components.strategyManager) {
            await this.components.strategyManager.pauseStrategies();
        }
        
        this.config.set('trading.enabled', false);
        
        this.logger.info('System', 'Trading systems paused');
        
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.speak('Trading operations paused. System standing by.');
        }
    }
    
    async stopTrading() {
        this.logger.info('System', 'Stopping trading systems...');
        
        // Stop trading on all platforms
        if (this.components.platforms) {
            await this.components.platforms.stopTrading();
        }
        
        // Deactivate strategies
        if (this.components.strategyManager) {
            await this.components.strategyManager.deactivateStrategies();
        }
        
        this.config.set('trading.enabled', false);
        
        this.logger.info('System', 'Trading systems stopped');
        
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.speak('All trading operations stopped. System secured.');
        }
    }
    
    async resetTradingSession() {
        this.logger.info('System', 'Resetting trading session...');
        
        // Reset session data
        this.metrics.totalTrades = 0;
        this.metrics.totalProfit = 0;
        this.metrics.winRate = 0;
        
        // Reset components
        if (this.components.aiEngine) {
            await this.components.aiEngine.resetSession();
        }
        
        if (this.components.strategyManager) {
            await this.components.strategyManager.resetSession();
        }
        
        if (this.components.riskManager) {
            await this.components.riskManager.resetSession();
        }
        
        this.logger.info('System', 'Trading session reset complete');
        
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.speak('Trading session reset. All metrics cleared.');
        }
    }
    
    // System Monitoring
    checkSystemHealth() {
        try {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            const healthData = {
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                components: this.getComponentStatus()
            };
            
            // Check for health issues
            if (healthData.memory.rss > this.config.get('system.maxMemoryUsage', 512)) {
                healthData.status = 'warning';
                healthData.warnings = ['High memory usage'];
            }
            
            this.emit('system_health', healthData);
            
            if (this.components.webModule) {
                this.components.webModule.sendSystemStatus(null, {
                    type: 'system_status',
                    data: healthData
                });
            }
            
        } catch (error) {
            this.logger.error('System', 'Health check failed', { error: error.message });
        }
    }
    
    updateSystemMetrics() {
        this.metrics.uptime = Date.now() - this.startTime;
        this.metrics.lastHeartbeat = Date.now();
        
        // Update win rate
        this.updateWinRate();
        
        this.emit('metrics_updated', this.metrics);
    }
    
    updateWinRate() {
        if (this.components.dataProcessor) {
            const tradeStats = this.components.dataProcessor.getTradingStatistics();
            if (tradeStats.totalTrades > 0) {
                this.metrics.winRate = (tradeStats.wins / tradeStats.totalTrades) * 100;
            }
        }
    }
    
    checkMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const rssGB = memoryUsage.rss / 1024 / 1024 / 1024;
        
        if (rssGB > 1) { // Alert if using more than 1GB
            this.logger.warn('System', 'High memory usage detected', {
                rss: `${rssGB.toFixed(2)}GB`,
                heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
            });
        }
    }
    
    getComponentStatus() {
        const status = {};
        
        Object.entries(this.components).forEach(([name, component]) => {
            if (component && typeof component.getStatus === 'function') {
                status[name] = component.getStatus();
            } else {
                status[name] = { status: 'unknown' };
            }
        });
        
        return status;
    }
    
    // System Validation
    async validateSystemIntegrity() {
        this.logger.info('System', 'Validating system integrity...');
        
        const validations = [];
        
        // Validate core components
        if (!this.components.core) validations.push('Core system not initialized');
        if (!this.components.logger) validations.push('Logger not initialized');
        if (!this.components.config) validations.push('Configuration not initialized');
        
        // Validate trading components
        if (!this.components.platforms) validations.push('Platform connectors not initialized');
        if (!this.components.strategyManager) validations.push('Strategy manager not initialized');
        if (!this.components.riskManager) validations.push('Risk manager not initialized');
        
        if (validations.length > 0) {
            throw new Error(`System validation failed: ${validations.join(', ')}`);
        }
        
        this.logger.info('System', 'System integrity validation passed');
    }
    
    async startSystemServices() {
        this.logger.info('System', 'Starting system services...');
        
        // Start web interface if enabled
        if (this.components.webModule && this.config.get('web.enabled', true)) {
            // Web module should already be initialized and running
        }
        
        // Start trading if configured to auto-start
        if (this.config.get('trading.enabled', false)) {
            await this.startTrading();
        }
        
        this.logger.info('System', 'System services started');
    }
    
    // System Shutdown
    async initiateShutdown(signal = 'manual') {
        if (this.isShuttingDown) {
            this.logger.warn('System', 'Shutdown already in progress');
            return;
        }
        
        this.isShuttingDown = true;
        this.state = 'stopping';
        
        this.logger.info('System', `Initiating graceful shutdown (${signal})...`);
        
        if (this.components.voiceAssistant) {
            await this.components.voiceAssistant.speak('System shutdown initiated. Saving all data and closing connections.');
        }
        
        try {
            // Stop trading first
            await this.stopTrading();
            
            // Stop monitoring
            if (this.healthMonitor) clearInterval(this.healthMonitor);
            if (this.performanceMonitor) clearInterval(this.performanceMonitor);
            if (this.memoryMonitor) clearInterval(this.memoryMonitor);
            
            // Shutdown components in reverse order
            await this.shutdownComponents();
            
            this.state = 'stopped';
            this.logger.info('System', 'BAYNEX.A.X shutdown complete');
            
            // Final delay to ensure logs are written
            await BayneXHelpers.delay(1000);
            
            process.exit(0);
            
        } catch (error) {
            this.logger.error('System', 'Shutdown error', { error: error.message });
            process.exit(1);
        }
    }
    
    async shutdownComponents() {
        const components = [
            'webModule',
            'voiceAssistant',
            'notifications',
            'goalTracker',
            'riskManager',
            'platforms',
            'tradingStrategies',
            'strategyManager',
            'aiEngine',
            'dataProcessor',
            'integration',
            'core',
            'database',
            'config',
            'logger'
        ];
        
        for (const componentName of components) {
            const component = this.components[componentName];
            if (component && typeof component.cleanup === 'function') {
                try {
                    this.logger.info('System', `Shutting down ${componentName}...`);
                    await component.cleanup();
                } catch (error) {
                    this.logger.error('System', `Failed to shutdown ${componentName}`, { error: error.message });
                }
            }
        }
    }
    
    // Public API
    getSystemStatus() {
        return {
            version: this.version,
            state: this.state,
            uptime: Date.now() - this.startTime,
            metrics: this.metrics,
            components: this.getComponentStatus(),
            config: {
                tradingEnabled: this.config.get('trading.enabled'),
                environment: this.config.get('system.environment'),
                logLevel: this.config.get('system.logLevel')
            }
        };
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
    
    getConfig() {
        return this.config;
    }
    
    getLogger() {
        return this.logger;
    }
}

module.exports = BayneXSystem;
