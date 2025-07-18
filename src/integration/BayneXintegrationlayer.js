// ================================
// BAYNEX.A.X INTEGRATION LAYER
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

const EventEmitter = require('events');

class BayneXIntegrationLayer extends EventEmitter {
    constructor() {
        super();
        this.components = new Map();
        this.eventBus = new EventEmitter();
        this.systemState = {
            initialized: false,
            components_ready: 0,
            total_components: 0,
            errors: [],
            status: 'initializing'
        };

        this.setupEventBus();
    }

    // ================================
    // COMPONENT REGISTRATION
    // ================================
    registerComponent(name, component) {
        console.log(`🔌 Registering component: ${name}`);
        
        this.components.set(name, {
            instance: component,
            status: 'registered',
            initialized: false,
            dependencies: component.dependencies || [],
            lastHealthCheck: null
        });

        this.systemState.total_components++;
        
        // Set up component event forwarding
        this.setupComponentEvents(name, component);
        
        return this;
    }

    setupComponentEvents(name, component) {
        // Forward all component events through the event bus
        const originalEmit = component.emit ? component.emit.bind(component) : () => {};
        
        if (component.emit) {
            component.emit = (event, ...args) => {
                // Emit on the component itself
                originalEmit(event, ...args);
                
                // Forward to integration layer event bus
                this.eventBus.emit(`${name}:${event}`, {
                    component: name,
                    event,
                    data: args,
                    timestamp: Date.now()
                });
                
                // Also emit on main integration layer
                this.emit(`component:${event}`, {
                    component: name,
                    event,
                    data: args,
                    timestamp: Date.now()
                });
            };
        }
    }

    // ================================
    // EVENT BUS SETUP
    // ================================
    setupEventBus() {
        console.log('🚌 Setting up Event Bus...');

        // Core trading events
        this.eventBus.on('core:trade_signal', this.handleTradeSignal.bind(this));
        this.eventBus.on('core:trade_executed', this.handleTradeExecuted.bind(this));
        this.eventBus.on('core:trade_closed', this.handleTradeClosed.bind(this));

        // AI learning events
        this.eventBus.on('ai:pattern_detected', this.handlePatternDetected.bind(this));
        this.eventBus.on('ai:strategy_evolved', this.handleStrategyEvolved.bind(this));
        this.eventBus.on('ai:learning_update', this.handleLearningUpdate.bind(this));

        // Risk management events
        this.eventBus.on('risk:limit_exceeded', this.handleRiskLimitExceeded.bind(this));
        this.eventBus.on('risk:emergency_stop', this.handleEmergencyStop.bind(this));
        this.eventBus.on('risk:position_adjusted', this.handlePositionAdjusted.bind(this));

        // Platform events
        this.eventBus.on('platform:connected', this.handlePlatformConnected.bind(this));
        this.eventBus.on('platform:disconnected', this.handlePlatformDisconnected.bind(this));
        this.eventBus.on('platform:error', this.handlePlatformError.bind(this));

        // Data events
        this.eventBus.on('data:market_update', this.handleMarketUpdate.bind(this));
        this.eventBus.on('data:analysis_complete', this.handleAnalysisComplete.bind(this));

        // Goal tracking events
        this.eventBus.on('goals:target_reached', this.handleTargetReached.bind(this));
        this.eventBus.on('goals:milestone_achieved', this.handleMilestoneAchieved.bind(this));

        // Strategy events
        this.eventBus.on('strategy:performance_update', this.handleStrategyPerformance.bind(this));
        this.eventBus.on('strategy:retired', this.handleStrategyRetired.bind(this));
        this.eventBus.on('strategy:created', this.handleStrategyCreated.bind(this));

        console.log('✅ Event Bus configured');
    }

    // ================================
    // SYSTEM INITIALIZATION
    // ================================
    async initializeSystem() {
        console.log('🚀 Initializing BAYNEX.A.X Integration Layer...');
        
        try {
            // Check component dependencies
            await this.validateDependencies();
            
            // Initialize components in dependency order
            await this.initializeComponentsInOrder();
            
            // Start inter-component communication
            await this.startCommunication();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            this.systemState.initialized = true;
            this.systemState.status = 'running';
            
            console.log('✅ BAYNEX.A.X Integration Layer initialized successfully!');
            this.emit('system:ready');
            
        } catch (error) {
            console.error('❌ Integration Layer initialization failed:', error);
            this.systemState.status = 'error';
            this.systemState.errors.push(error.message);
            this.emit('system:error', error);
            throw error;
        }
    }

    async validateDependencies() {
        console.log('🔍 Validating component dependencies...');
        
        for (const [name, component] of this.components) {
            for (const dep of component.dependencies) {
                if (!this.components.has(dep)) {
                    throw new Error(`Component ${name} requires ${dep} but it's not registered`);
                }
            }
        }
        
        console.log('✅ All dependencies validated');
    }

    async initializeComponentsInOrder() {
        console.log('⚙️ Initializing components in dependency order...');
        
        const initOrder = this.calculateInitializationOrder();
        
        for (const componentName of initOrder) {
            await this.initializeComponent(componentName);
        }
    }

    calculateInitializationOrder() {
        // Topological sort based on dependencies
        const visited = new Set();
        const order = [];
        
        const visit = (name) => {
            if (visited.has(name)) return;
            visited.add(name);
            
            const component = this.components.get(name);
            if (component) {
                for (const dep of component.dependencies) {
                    visit(dep);
                }
                order.push(name);
            }
        };
        
        for (const name of this.components.keys()) {
            visit(name);
        }
        
        return order;
    }

    async initializeComponent(name) {
        console.log(`🔧 Initializing component: ${name}`);
        
        const component = this.components.get(name);
        if (!component) {
            throw new Error(`Component ${name} not found`);
        }
        
        try {
            component.status = 'initializing';
            
            // Initialize the component
            if (typeof component.instance.initialize === 'function') {
                await component.instance.initialize();
            }
            
            component.initialized = true;
            component.status = 'ready';
            this.systemState.components_ready++;
            
            console.log(`✅ ${name} initialized successfully`);
            this.emit('component:initialized', { name, component });
            
        } catch (error) {
            console.error(`❌ Failed to initialize ${name}:`, error);
            component.status = 'error';
            this.systemState.errors.push(`${name}: ${error.message}`);
            throw error;
        }
    }

    // ================================
    // EVENT HANDLERS
    // ================================
    async handleTradeSignal(data) {
        console.log('📊 Trade signal received:', data.data[0]);
        
        const signal = data.data[0];
        
        // Validate signal through risk manager
        const riskManager = this.getComponent('riskManager');
        if (riskManager && !await riskManager.validateSignal(signal)) {
            console.log('🛡️ Signal rejected by risk manager');
            return;
        }
        
        // Send to strategy manager for execution decision
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager) {
            await strategyManager.processSignal(signal);
        }
        
        // Notify voice assistant
        const voice = this.getComponent('voice');
        if (voice && signal.confidence > 0.8) {
            await voice.speak(`High confidence ${signal.direction} signal detected for ${signal.asset}`);
        }
        
        // Update dashboard
        this.broadcastToClients('trade_signal', signal);
    }

    async handleTradeExecuted(data) {
        console.log('💰 Trade executed:', data.data[0]);
        
        const trade = data.data[0];
        
        // Update goal tracker
        const goalTracker = this.getComponent('goalTracker');
        if (goalTracker) {
            await goalTracker.recordTrade(trade);
        }
        
        // Send notifications
        const notifications = this.getComponent('notifications');
        if (notifications) {
            await notifications.sendTradeAlert(trade);
        }
        
        // Update AI learning
        const aiEngine = this.getComponent('aiEngine');
        if (aiEngine) {
            aiEngine.recordTradeExecution(trade);
        }
        
        // Update dashboard
        this.broadcastToClients('trade_executed', trade);
    }

    async handleTradeClosed(data) {
        console.log('📈 Trade closed:', data.data[0]);
        
        const trade = data.data[0];
        
        // Update AI learning with outcome
        const aiEngine = this.getComponent('aiEngine');
        if (aiEngine) {
            await aiEngine.learnFromTradeOutcome(trade);
        }
        
        // Update strategy performance
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager) {
            await strategyManager.updateStrategyPerformance(trade);
        }
        
        // Check goal achievements
        const goalTracker = this.getComponent('goalTracker');
        if (goalTracker) {
            await goalTracker.checkAchievements(trade);
        }
        
        // Voice announcement for significant trades
        const voice = this.getComponent('voice');
        if (voice && Math.abs(trade.profit) > 50) {
            const message = trade.profit > 0 
                ? `Great win! Made ${trade.profit.toFixed(2)} dollars profit`
                : `Loss recorded: ${Math.abs(trade.profit).toFixed(2)} dollars`;
            await voice.speak(message);
        }
        
        // Update dashboard
        this.broadcastToClients('trade_closed', trade);
    }

    async handlePatternDetected(data) {
        console.log('🧠 AI pattern detected:', data.data[0]);
        
        const pattern = data.data[0];
        
        // Notify strategy manager
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager) {
            await strategyManager.handleNewPattern(pattern);
        }
        
        // Update dashboard
        this.broadcastToClients('pattern_detected', pattern);
    }

    async handleEmergencyStop(data) {
        console.log('🛑 EMERGENCY STOP TRIGGERED:', data.data[0]);
        
        const stopEvent = data.data[0];
        
        // Stop all trading immediately
        const core = this.getComponent('core');
        if (core) {
            await core.emergencyStop();
        }
        
        // Voice announcement
        const voice = this.getComponent('voice');
        if (voice) {
            await voice.speak('Emergency stop activated. All trading has been halted.');
        }
        
        // Critical notifications
        const notifications = this.getComponent('notifications');
        if (notifications) {
            await notifications.sendCriticalAlert(stopEvent);
        }
        
        // Update dashboard
        this.broadcastToClients('emergency_stop', stopEvent);
    }

    async handleTargetReached(data) {
        console.log('🎯 Target reached:', data.data[0]);
        
        const achievement = data.data[0];
        
        // Celebration voice announcement
        const voice = this.getComponent('voice');
        if (voice) {
            await voice.speak(`Congratulations! ${achievement.description} target reached!`);
        }
        
        // Send celebration notification
        const notifications = this.getComponent('notifications');
        if (notifications) {
            await notifications.sendAchievementAlert(achievement);
        }
        
        // Update dashboard
        this.broadcastToClients('target_reached', achievement);
    }

    async handleMarketUpdate(data) {
        const marketData = data.data[0];
        
        // Distribute to all interested components
        const aiEngine = this.getComponent('aiEngine');
        if (aiEngine && typeof aiEngine.processMarketData === 'function') {
            aiEngine.processMarketData(marketData);
        }
        
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager && typeof strategyManager.updateMarketData === 'function') {
            strategyManager.updateMarketData(marketData);
        }
        
        // Update dashboard (throttled)
        this.throttledDashboardUpdate('market_data', marketData);
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getComponent(name) {
        const component = this.components.get(name);
        return component ? component.instance : null;
    }

    broadcastToClients(event, data) {
        // Send to WebSocket server for dashboard updates
        const webSocket = this.getComponent('webSocket');
        if (webSocket && typeof webSocket.broadcast === 'function') {
            webSocket.broadcast(event, data);
        }
    }

    throttledDashboardUpdate(event, data) {
        // Throttle high-frequency updates
        if (!this.updateThrottles) this.updateThrottles = new Map();
        
        const now = Date.now();
        const lastUpdate = this.updateThrottles.get(event) || 0;
        
        if (now - lastUpdate > 1000) { // Max 1 update per second
            this.broadcastToClients(event, data);
            this.updateThrottles.set(event, now);
        }
    }

    startCommunication() {
        console.log('📡 Starting inter-component communication...');
        
        // Set up component cross-references
        this.setupComponentCrossReferences();
        
        console.log('✅ Inter-component communication started');
    }

    setupComponentCrossReferences() {
        // Give each component access to others through integration layer
        for (const [name, component] of this.components) {
            component.instance.getComponent = this.getComponent.bind(this);
        }
    }

    startHealthMonitoring() {
        console.log('🏥 Starting health monitoring...');
        
        setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Health check every 30 seconds
    }

    async performHealthCheck() {
        for (const [name, component] of this.components) {
            try {
                if (typeof component.instance.healthCheck === 'function') {
                    const health = await component.instance.healthCheck();
                    component.lastHealthCheck = {
                        timestamp: Date.now(),
                        status: health.status || 'healthy',
                        details: health
                    };
                } else {
                    component.lastHealthCheck = {
                        timestamp: Date.now(),
                        status: 'healthy',
                        details: { message: 'No health check method available' }
                    };
                }
            } catch (error) {
                console.error(`❌ Health check failed for ${name}:`, error);
                component.lastHealthCheck = {
                    timestamp: Date.now(),
                    status: 'unhealthy',
                    details: { error: error.message }
                };
            }
        }
    }

    getSystemHealth() {
        const health = {
            overall: 'healthy',
            components: {},
            uptime: Date.now() - (this.startTime || Date.now()),
            errors: this.systemState.errors
        };

        for (const [name, component] of this.components) {
            health.components[name] = {
                status: component.status,
                initialized: component.initialized,
                lastHealthCheck: component.lastHealthCheck
            };

            if (component.status === 'error' || 
                (component.lastHealthCheck && component.lastHealthCheck.status === 'unhealthy')) {
                health.overall = 'degraded';
            }
        }

        return health;
    }

    // ================================
    // SYSTEM CONTROL
    // ================================
    async start() {
        console.log('▶️ Starting BAYNEX.A.X Integrated System...');
        
        this.startTime = Date.now();
        
        // Start all components
        for (const [name, component] of this.components) {
            if (typeof component.instance.start === 'function') {
                console.log(`▶️ Starting ${name}...`);
                try {
                    await component.instance.start();
                } catch (error) {
                    console.error(`❌ Failed to start ${name}:`, error);
                }
            }
        }
        
        this.emit('system:started');
        console.log('✅ All components started successfully!');
    }

    async stop() {
        console.log('⏹️ Stopping BAYNEX.A.X Integrated System...');
        
        // Stop all components in reverse order
        const stopOrder = this.calculateInitializationOrder().reverse();
        
        for (const name of stopOrder) {
            const component = this.components.get(name);
            if (component && typeof component.instance.stop === 'function') {
                console.log(`⏹️ Stopping ${name}...`);
                try {
                    await component.instance.stop();
                } catch (error) {
                    console.error(`❌ Failed to stop ${name}:`, error);
                }
            }
        }
        
        this.emit('system:stopped');
        console.log('✅ All components stopped successfully!');
    }

    async restart() {
        console.log('🔄 Restarting BAYNEX.A.X Integrated System...');
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause
        await this.start();
    }
}

module.exports = BayneXIntegrationLayer;
