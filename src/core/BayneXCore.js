// ================================
// BAYNEX.A.X CORE TRADING ENGINE
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

const EventEmitter = require('events');

class BayneXCore extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.activeTrades = new Map();
        this.tradingQueue = [];
        this.emergencyStopActivated = false;
        this.dependencies = ['platforms', 'riskManager', 'dataProcessor'];
        
        this.config = {
            maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES) || 5,
            tradeTimeout: 300000, // 5 minutes
            retryAttempts: 3,
            emergencyStopThreshold: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 1000
        };
        
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalVolume: 0,
            averageExecutionTime: 0
        };
    }

    async initialize() {
        console.log('🎯 Initializing BAYNEX.A.X Core Trading Engine...');
        
        try {
            // Set up trade monitoring
            this.startTradeMonitoring();
            
            // Initialize trade queue processor
            this.startTradeQueueProcessor();
            
            console.log('✅ Core Trading Engine initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Core initialization failed:', error);
            throw error;
        }
    }

    async start() {
        if (this.isActive) {
            console.log('⚠️ Core Trading Engine is already active');
            return;
        }

        console.log('▶️ Starting Core Trading Engine...');
        
        try {
            this.isActive = true;
            this.emergencyStopActivated = false;
            
            // Start main trading loop
            this.mainTradingLoop();
            
            console.log('✅ Core Trading Engine is now active');
            this.emit('engine_started');
            
        } catch (error) {
            console.error('❌ Failed to start Core Trading Engine:', error);
            this.isActive = false;
            throw error;
        }
    }

    async stop() {
        console.log('⏹️ Stopping Core Trading Engine...');
        
        this.isActive = false;
        
        // Close all active trades
        await this.closeAllActiveTrades();
        
        // Clear trading queue
        this.tradingQueue = [];
        
        console.log('✅ Core Trading Engine stopped');
        this.emit('engine_stopped');
    }

    async emergencyStop() {
        console.log('🚨 EMERGENCY STOP - Core Trading Engine');
        
        this.emergencyStopActivated = true;
        this.isActive = false;
        
        // Immediately close all trades
        await this.emergencyCloseAllTrades();
        
        // Clear all queues
        this.tradingQueue = [];
        
        this.emit('emergency_stop', { 
            reason: 'Emergency stop activated',
            timestamp: new Date(),
            activeTrades: this.activeTrades.size
        });
    }

    // ================================
    // MAIN TRADING LOOP
    // ================================
    async mainTradingLoop() {
        while (this.isActive && !this.emergencyStopActivated) {
            try {
                // Process pending signals
                await this.processSignalQueue();
                
                // Monitor active trades
                await this.monitorActiveTrades();
                
                // Check system health
                await this.checkSystemHealth();
                
                // Small delay to prevent overwhelming
                await this.sleep(1000);
                
            } catch (error) {
                console.error('❌ Error in main trading loop:', error);
                this.emit('trading_error', error);
                
                // Continue after brief pause
                await this.sleep(5000);
            }
        }
    }

    async processSignalQueue() {
        while (this.tradingQueue.length > 0 && this.activeTrades.size < this.config.maxConcurrentTrades) {
            const signal = this.tradingQueue.shift();
            
            try {
                await this.executeTradeSignal(signal);
            } catch (error) {
                console.error('❌ Failed to execute trade signal:', error);
                this.emit('trade_execution_failed', { signal, error: error.message });
            }
        }
    }

    // ================================
    // TRADE EXECUTION
    // ================================
    async executeTradeSignal(signal) {
        const startTime = Date.now();
        
        console.log(`🎯 Executing trade signal: ${signal.direction} ${signal.asset}`);
        
        try {
            // Validate signal
            if (!this.validateTradeSignal(signal)) {
                throw new Error('Invalid trade signal');
            }
            
            // Check risk limits
            const riskManager = this.getComponent('riskManager');
            if (riskManager && !await riskManager.validateTrade(signal)) {
                throw new Error('Trade rejected by risk manager');
            }
            
            // Get platform connector
            const platforms = this.getComponent('platforms');
            if (!platforms) {
                throw new Error('Platform connector not available');
            }
            
            // Execute trade on platform
            const tradeResult = await platforms.executeTrade({
                platform: signal.platform || 'deriv',
                asset: signal.asset,
                direction: signal.direction,
                amount: signal.amount,
                duration: signal.duration || 300, // 5 minutes default
                strategy: signal.strategy
            });
            
            // Create trade record
            const trade = {
                id: tradeResult.id || this.generateTradeId(),
                signal: signal,
                platform: signal.platform || 'deriv',
                asset: signal.asset,
                direction: signal.direction,
                amount: signal.amount,
                entryPrice: tradeResult.entryPrice,
                entryTime: new Date(),
                status: 'active',
                contractId: tradeResult.contractId,
                executionTime: Date.now() - startTime
            };
            
            // Add to active trades
            this.activeTrades.set(trade.id, trade);
            
            // Update statistics
            this.updateTradeStats(trade);
            
            // Emit trade executed event
            this.emit('trade_executed', trade);
            
            console.log(`✅ Trade executed: ${trade.id}`);
            
            return trade;
            
        } catch (error) {
            console.error(`❌ Trade execution failed:`, error);
            this.stats.failedTrades++;
            
            this.emit('trade_execution_failed', {
                signal,
                error: error.message,
                executionTime: Date.now() - startTime
            });
            
            throw error;
        }
    }

    validateTradeSignal(signal) {
        // Basic validation
        if (!signal.asset || !signal.direction || !signal.amount) {
            return false;
        }
        
        // Check direction
        if (!['CALL', 'PUT', 'call', 'put'].includes(signal.direction)) {
            return false;
        }
        
        // Check amount
        if (signal.amount <= 0 || signal.amount > 1000) {
            return false;
        }
        
        // Check confidence if provided
        if (signal.confidence !== undefined && (signal.confidence < 0 || signal.confidence > 1)) {
            return false;
        }
        
        return true;
    }

    // ================================
    // TRADE MONITORING
    // ================================
    startTradeMonitoring() {
        setInterval(async () => {
            await this.monitorActiveTrades();
        }, 5000); // Check every 5 seconds
    }

    async monitorActiveTrades() {
        for (const [tradeId, trade] of this.activeTrades) {
            try {
                await this.checkTradeStatus(trade);
            } catch (error) {
                console.error(`❌ Error monitoring trade ${tradeId}:`, error);
            }
        }
    }

    async checkTradeStatus(trade) {
        const platforms = this.getComponent('platforms');
        if (!platforms) return;
        
        try {
            const status = await platforms.getTradeStatus(trade.platform, trade.contractId);
            
            if (status.status === 'closed' || status.status === 'expired') {
                await this.handleTradeClose(trade, status);
            } else if (status.status === 'cancelled') {
                await this.handleTradeCancellation(trade, status);
            }
            
        } catch (error) {
            console.error(`❌ Error checking trade status:`, error);
        }
    }

    async handleTradeClose(trade, status) {
        console.log(`📊 Trade closed: ${trade.id}`);
        
        // Update trade record
        trade.status = 'closed';
        trade.exitPrice = status.exitPrice;
        trade.exitTime = new Date();
        trade.profit = status.profit || 0;
        trade.result = status.result || (trade.profit > 0 ? 'win' : 'loss');
        
        // Remove from active trades
        this.activeTrades.delete(trade.id);
        
        // Update statistics
        this.updateClosedTradeStats(trade);
        
        // Emit trade closed event
        this.emit('trade_closed', trade);
        
        // Store in database
        const database = this.getComponent('database');
        if (database) {
            await database.saveTrade(trade);
        }
    }

    async handleTradeCancellation(trade, status) {
        console.log(`❌ Trade cancelled: ${trade.id}`);
        
        trade.status = 'cancelled';
        trade.exitTime = new Date();
        trade.result = 'cancelled';
        
        this.activeTrades.delete(trade.id);
        
        this.emit('trade_cancelled', trade);
    }

    // ================================
    // TRADE QUEUE MANAGEMENT
    // ================================
    startTradeQueueProcessor() {
        setInterval(async () => {
            if (this.tradingQueue.length > 0 && this.isActive) {
                await this.processSignalQueue();
            }
        }, 2000); // Process queue every 2 seconds
    }

    queueTradeSignal(signal) {
        if (this.emergencyStopActivated) {
            console.log('🛑 Trade signal rejected - Emergency stop active');
            return false;
        }
        
        if (this.tradingQueue.length >= 50) {
            console.log('⚠️ Trade queue full, removing oldest signal');
            this.tradingQueue.shift();
        }
        
        signal.queuedAt = new Date();
        this.tradingQueue.push(signal);
        
        console.log(`📝 Trade signal queued: ${signal.direction} ${signal.asset}`);
        return true;
    }

    // ================================
    // STATISTICS & MONITORING
    // ================================
    updateTradeStats(trade) {
        this.stats.totalTrades++;
        this.stats.totalVolume += trade.amount;
        
        if (trade.executionTime) {
            this.stats.averageExecutionTime = 
                (this.stats.averageExecutionTime * (this.stats.totalTrades - 1) + trade.executionTime) / 
                this.stats.totalTrades;
        }
    }

    updateClosedTradeStats(trade) {
        if (trade.result === 'win') {
            this.stats.successfulTrades++;
        }
    }

    async checkSystemHealth() {
        // Check for excessive losses
        const totalLoss = Array.from(this.activeTrades.values())
            .reduce((sum, trade) => sum + (trade.profit < 0 ? Math.abs(trade.profit) : 0), 0);
        
        if (totalLoss > this.config.emergencyStopThreshold) {
            console.log('🚨 Emergency stop threshold reached');
            await this.emergencyStop();
        }
        
        // Check for stuck trades
        const now = Date.now();
        for (const trade of this.activeTrades.values()) {
            if (now - trade.entryTime.getTime() > this.config.tradeTimeout) {
                console.log(`⚠️ Trade timeout detected: ${trade.id}`);
                await this.handleTradeTimeout(trade);
            }
        }
    }

    async handleTradeTimeout(trade) {
        console.log(`⏰ Handling trade timeout: ${trade.id}`);
        
        try {
            const platforms = this.getComponent('platforms');
            if (platforms) {
                await platforms.closeTradeManually(trade.platform, trade.contractId);
            }
        } catch (error) {
            console.error('❌ Failed to close timed out trade:', error);
        }
// ================================
// BAYNEX.A.X CORE TRADING ENGINE
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

const EventEmitter = require('events');

class BayneXCore extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.activeTrades = new Map();
        this.tradingQueue = [];
        this.emergencyStopActivated = false;
        this.dependencies = ['platforms', 'riskManager', 'dataProcessor'];
        
        this.config = {
            maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES) || 5,
            tradeTimeout: 300000, // 5 minutes
            retryAttempts: 3,
            emergencyStopThreshold: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 1000
        };
        
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalVolume: 0,
            averageExecutionTime: 0
        };
    }

    async initialize() {
        console.log('🎯 Initializing BAYNEX.A.X Core Trading Engine...');
        
        try {
            // Set up trade monitoring
            this.startTradeMonitoring();
            
            // Initialize trade queue processor
            this.startTradeQueueProcessor();
            
            console.log('✅ Core Trading Engine initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Core initialization failed:', error);
            throw error;
        }
    }

    async start() {
        if (this.isActive) {
            console.log('⚠️ Core Trading Engine is already active');
            return;
        }

        console.log('▶️ Starting Core Trading Engine...');
        
        try {
            this.isActive = true;
            this.emergencyStopActivated = false;
            
            // Start main trading loop
            this.mainTradingLoop();
            
            console.log('✅ Core Trading Engine is now active');
            this.emit('engine_started');
            
        } catch (error) {
            console.error('❌ Failed to start Core Trading Engine:', error);
            this.isActive = false;
            throw error;
        }
    }

    async stop() {
        console.log('⏹️ Stopping Core Trading Engine...');
        
        this.isActive = false;
        
        // Close all active trades
        await this.closeAllActiveTrades();
        
        // Clear trading queue
        this.tradingQueue = [];
        
        console.log('✅ Core Trading Engine stopped');
        this.emit('engine_stopped');
    }

    async emergencyStop() {
        console.log('🚨 EMERGENCY STOP - Core Trading Engine');
        
        this.emergencyStopActivated = true;
        this.isActive = false;
        
        // Immediately close all trades
        await this.emergencyCloseAllTrades();
        
        // Clear all queues
        this.tradingQueue = [];
        
        this.emit('emergency_stop', { 
            reason: 'Emergency stop activated',
            timestamp: new Date(),
            activeTrades: this.activeTrades.size
        });
    }

    // ================================
    // MAIN TRADING LOOP
    // ================================
    async mainTradingLoop() {
        while (this.isActive && !this.emergencyStopActivated) {
            try {
                // Process pending signals
                await this.processSignalQueue();
                
                // Monitor active trades
                await this.monitorActiveTrades();
                
                // Check system health
                await this.checkSystemHealth();
                
                // Small delay to prevent overwhelming
                await this.sleep(1000);
                
            } catch (error) {
                console.error('❌ Error in main trading loop:', error);
                this.emit('trading_error', error);
                
                // Continue after brief pause
                await this.sleep(5000);
            }
        }
    }

    async processSignalQueue() {
        while (this.tradingQueue.length > 0 && this.activeTrades.size < this.config.maxConcurrentTrades) {
            const signal = this.tradingQueue.shift();
            
            try {
                await this.executeTradeSignal(signal);
            } catch (error) {
                console.error('❌ Failed to execute trade signal:', error);
                this.emit('trade_execution_failed', { signal, error: error.message });
            }
        }
    }

    // ================================
    // TRADE EXECUTION
    // ================================
    async executeTradeSignal(signal) {
        const startTime = Date.now();
        
        console.log(`🎯 Executing trade signal: ${signal.direction} ${signal.asset}`);
        
        try {
            // Validate signal
            if (!this.validateTradeSignal(signal)) {
                throw new Error('Invalid trade signal');
            }
            
            // Check risk limits
            const riskManager = this.getComponent('riskManager');
            if (riskManager && !await riskManager.validateTrade(signal)) {
                throw new Error('Trade rejected by risk manager');
            }
            
            // Get platform connector
            const platforms = this.getComponent('platforms');
            if (!platforms) {
                throw new Error('Platform connector not available');
            }
            
            // Execute trade on platform
            const tradeResult = await platforms.executeTrade({
                platform: signal.platform || 'deriv',
                asset: signal.asset,
                direction: signal.direction,
                amount: signal.amount,
                duration: signal.duration || 300, // 5 minutes default
                strategy: signal.strategy
            });
            
            // Create trade record
            const trade = {
                id: tradeResult.id || this.generateTradeId(),
                signal: signal,
                platform: signal.platform || 'deriv',
                asset: signal.asset,
                direction: signal.direction,
                amount: signal.amount,
                entryPrice: tradeResult.entryPrice,
                entryTime: new Date(),
                status: 'active',
                contractId: tradeResult.contractId,
                executionTime: Date.now() - startTime
            };
            
            // Add to active trades
            this.activeTrades.set(trade.id, trade);
            
            // Update statistics
            this.updateTradeStats(trade);
            
            // Emit trade executed event
            this.emit('trade_executed', trade);
            
            console.log(`✅ Trade executed: ${trade.id}`);
            
            return trade;
            
        } catch (error) {
            console.error(`❌ Trade execution failed:`, error);
            this.stats.failedTrades++;
            
            this.emit('trade_execution_failed', {
                signal,
                error: error.message,
                executionTime: Date.now() - startTime
            });
            
            throw error;
        }
    }

    validateTradeSignal(signal) {
        // Basic validation
        if (!signal.asset || !signal.direction || !signal.amount) {
            return false;
        }
        
        // Check direction
        if (!['CALL', 'PUT', 'call', 'put'].includes(signal.direction)) {
            return false;
        }
        
        // Check amount
        if (signal.amount <= 0 || signal.amount > 1000) {
            return false;
        }
        
        // Check confidence if provided
        if (signal.confidence !== undefined && (signal.confidence < 0 || signal.confidence > 1)) {
            return false;
        }
        
        return true;
    }

    // ================================
    // TRADE MONITORING
    // ================================
    startTradeMonitoring() {
        setInterval(async () => {
            await this.monitorActiveTrades();
        }, 5000); // Check every 5 seconds
    }

    async monitorActiveTrades() {
        for (const [tradeId, trade] of this.activeTrades) {
            try {
                await this.checkTradeStatus(trade);
            } catch (error) {
                console.error(`❌ Error monitoring trade ${tradeId}:`, error);
            }
        }
    }

    async checkTradeStatus(trade) {
        const platforms = this.getComponent('platforms');
        if (!platforms) return;
        
        try {
            const status = await platforms.getTradeStatus(trade.platform, trade.contractId);
            
            if (status.status === 'closed' || status.status === 'expired') {
                await this.handleTradeClose(trade, status);
            } else if (status.status === 'cancelled') {
                await this.handleTradeCancellation(trade, status);
            }
            
        } catch (error) {
            console.error(`❌ Error checking trade status:`, error);
        }
    }

    async handleTradeClose(trade, status) {
        console.log(`📊 Trade closed: ${trade.id}`);
        
        // Update trade record
        trade.status = 'closed';
        trade.exitPrice = status.exitPrice;
        trade.exitTime = new Date();
        trade.profit = status.profit || 0;
        trade.result = status.result || (trade.profit > 0 ? 'win' : 'loss');
        
        // Remove from active trades
        this.activeTrades.delete(trade.id);
        
        // Update statistics
        this.updateClosedTradeStats(trade);
        
        // Emit trade closed event
        this.emit('trade_closed', trade);
        
        // Store in database
        const database = this.getComponent('database');
        if (database) {
            await database.saveTrade(trade);
        }
    }

    async handleTradeCancellation(trade, status) {
        console.log(`❌ Trade cancelled: ${trade.id}`);
        
        trade.status = 'cancelled';
        trade.exitTime = new Date();
        trade.result = 'cancelled';
        
        this.activeTrades.delete(trade.id);
        
        this.emit('trade_cancelled', trade);
    }

    // ================================
    // TRADE QUEUE MANAGEMENT
    // ================================
    startTradeQueueProcessor() {
        setInterval(async () => {
            if (this.tradingQueue.length > 0 && this.isActive) {
                await this.processSignalQueue();
            }
        }, 2000); // Process queue every 2 seconds
    }

    queueTradeSignal(signal) {
        if (this.emergencyStopActivated) {
            console.log('🛑 Trade signal rejected - Emergency stop active');
            return false;
        }
        
        if (this.tradingQueue.length >= 50) {
            console.log('⚠️ Trade queue full, removing oldest signal');
            this.tradingQueue.shift();
        }
        
        signal.queuedAt = new Date();
        this.tradingQueue.push(signal);
        
        console.log(`📝 Trade signal queued: ${signal.direction} ${signal.asset}`);
        return true;
    }

    // ================================
    // STATISTICS & MONITORING
    // ================================
    updateTradeStats(trade) {
        this.stats.totalTrades++;
        this.stats.totalVolume += trade.amount;
        
        if (trade.executionTime) {
            this.stats.averageExecutionTime = 
                (this.stats.averageExecutionTime * (this.stats.totalTrades - 1) + trade.executionTime) / 
                this.stats.totalTrades;
        }
    }

    updateClosedTradeStats(trade) {
        if (trade.result === 'win') {
            this.stats.successfulTrades++;
        }
    }

    async checkSystemHealth() {
        // Check for excessive losses
        const totalLoss = Array.from(this.activeTrades.values())
            .reduce((sum, trade) => sum + (trade.profit < 0 ? Math.abs(trade.profit) : 0), 0);
        
        if (totalLoss > this.config.emergencyStopThreshold) {
            console.log('🚨 Emergency stop threshold reached');
            await this.emergencyStop();
        }
        
        // Check for stuck trades
        const now = Date.now();
        for (const trade of this.activeTrades.values()) {
            if (now - trade.entryTime.getTime() > this.config.tradeTimeout) {
                console.log(`⚠️ Trade timeout detected: ${trade.id}`);
                await this.handleTradeTimeout(trade);
            }
        }
    }

    async handleTradeTimeout(trade) {
        console.log(`⏰ Handling trade timeout: ${trade.id}`);
        
        try {
            const platforms = this.getComponent('platforms');
            if (platforms) {
                await platforms.closeTradeManually(trade.platform, trade.contractId);
            }
        } catch (error) {
            console.error('❌ Failed to close timed out trade:', error);
        }
    }

    // ================================
    // EMERGENCY PROCEDURES
    // ================================
    async closeAllActiveTrades() {
        console.log(`⏹️ Closing ${this.activeTrades.size} active trades...`);
        
        const platforms = this.getComponent('platforms');
        if (!platforms) return;
        
        const closePromises = Array.from(this.activeTrades.values()).map(async (trade) => {
            try {
                await platforms.closeTradeManually(trade.platform, trade.contractId);
            } catch (error) {
                console.error(`❌ Failed to close trade ${trade.id}:`, error);
            }
        });
        
        await Promise.allSettled(closePromises);
        this.activeTrades.clear();
    }

    async emergencyCloseAllTrades() {
        console.log('🚨 EMERGENCY - Closing all trades immediately');
        
        const platforms = this.getComponent('platforms');
        if (!platforms) return;
        
        // Force close all trades without waiting
        for (const trade of this.activeTrades.values()) {
            platforms.emergencyCloseTrade(trade.platform, trade.contractId)
                .catch(error => console.error(`❌ Emergency close failed for ${trade.id}:`, error));
        }
        
        this.activeTrades.clear();
    }

    // ================================
    // UTILITY METHODS
    // ================================
    generateTradeId() {
        return `BAYNEX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            ...this.stats,
            activeTrades: this.activeTrades.size,
            queuedSignals: this.tradingQueue.length,
            isActive: this.isActive,
            emergencyStopActivated: this.emergencyStopActivated
        };
    }

    getActiveTrades() {
        return Array.from(this.activeTrades.values());
    }

    healthCheck() {
        return {
            status: this.isActive && !this.emergencyStopActivated ? 'healthy' : 'stopped',
            activeTrades: this.activeTrades.size,
            queuedSignals: this.tradingQueue.length,
            totalTrades: this.stats.totalTrades,
            successRate: this.stats.totalTrades > 0 ? 
                (this.stats.successfulTrades / this.stats.totalTrades * 100).toFixed(2) + '%' : '0%'
        };
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

module.exports = BayneXCore;
