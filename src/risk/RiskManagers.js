// ================================
// BAYNEX.A.X RISK MANAGER
// Multi-Layer Risk Protection System
// ================================

const EventEmitter = require('events');

class RiskManager extends EventEmitter {
    constructor() {
        super();
        this.dependencies = ['database'];
        this.isActive = true;
        
        // Risk configuration
        this.config = {
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 500,
            dailyProfitTarget: parseFloat(process.env.DAILY_PROFIT_TARGET) || 200,
            maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES) || 5,
            defaultRiskPerTrade: parseFloat(process.env.DEFAULT_RISK_PER_TRADE) || 0.02,
            maxRiskPerTrade: 0.05, // 5% max risk per trade
            emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 1000,
            maxDrawdown: 0.20, // 20% max drawdown
            minAccountBalance: parseFloat(process.env.MIN_TRADE_SIZE_DERIV) * 10 || 3.50,
            consecutiveLossLimit: 5,
            dailyTradeLimit: 100,
            volatilityThreshold: 0.05,
            correlationLimit: 0.8
        };
        
        // Risk tracking
        this.dailyStats = {
            profit: 0,
            loss: 0,
            netPL: 0,
            tradesExecuted: 0,
            consecutiveLosses: 0,
            lastResetDate: new Date().toDateString()
        };
        
        this.accountStats = {
            currentBalance: parseFloat(process.env.STARTING_BALANCE) || 1000,
            peakBalance: parseFloat(process.env.STARTING_BALANCE) || 1000,
            currentDrawdown: 0,
            maxDrawdown: 0,
            totalProfit: 0,
            totalLoss: 0
        };
        
        // Active risk monitors
        this.activeTrades = new Map();
        this.riskAlerts = [];
        this.emergencyStopTriggered = false;
        
        // Position sizing calculator
        this.positionSizer = new PositionSizer(this.config);
        
        // Risk metrics calculator
        this.metricsCalculator = new RiskMetricsCalculator();
        
        this.startRiskMonitoring();
    }

    async initialize() {
        console.log('🛡️ Initializing Risk Manager...');
        
        try {
            // Load historical risk data
            await this.loadRiskHistory();
            
            // Reset daily stats if new day
            this.checkAndResetDailyStats();
            
            // Validate initial account state
            await this.validateAccountState();
            
            console.log('✅ Risk Manager initialized');
            console.log(`🛡️ Daily Loss Limit: $${this.config.maxDailyLoss}`);
            console.log(`🎯 Daily Profit Target: $${this.config.dailyProfitTarget}`);
            console.log(`📊 Current Balance: $${this.accountStats.currentBalance}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Risk Manager initialization failed:', error);
            throw error;
        }
    }

    // ================================
    // TRADE VALIDATION
    // ================================
    async validateTrade(tradeParams) {
        if (!this.isActive) {
            return { approved: false, reason: 'Risk Manager disabled' };
        }

        if (this.emergencyStopTriggered) {
            return { approved: false, reason: 'Emergency stop active' };
        }

        try {
            // Pre-trade validation checks
            const validations = [
                this.checkDailyLimits(),
                this.checkAccountBalance(tradeParams.amount),
                this.checkTradeSize(tradeParams.amount),
                this.checkConcurrentTrades(),
                this.checkConsecutiveLosses(),
                this.checkDrawdownLimit(),
                this.checkVolatilityRisk(tradeParams),
                this.checkCorrelationRisk(tradeParams)
            ];

            for (const validation of validations) {
                if (!validation.passed) {
                    console.log(`🛡️ Trade rejected: ${validation.reason}`);
                    this.recordRiskEvent('trade_rejected', validation.reason, tradeParams);
                    return { approved: false, reason: validation.reason };
                }
            }

            // Calculate position size
            const recommendedSize = this.positionSizer.calculatePositionSize(
                tradeParams.amount, 
                this.accountStats.currentBalance,
                tradeParams.strategy?.performance?.winRate || 0.5
            );

            // Approve trade with recommendations
            const approval = {
                approved: true,
                recommendedAmount: recommendedSize,
                riskLevel: this.calculateTradeRiskLevel(tradeParams),
                maxLoss: recommendedSize,
                notes: []
            };

            if (recommendedSize !== tradeParams.amount) {
                approval.notes.push(`Position size adjusted from $${tradeParams.amount} to $${recommendedSize}`);
            }

            console.log(`✅ Trade approved: ${tradeParams.direction} ${tradeParams.asset} - $${recommendedSize}`);
            
            return approval;

        } catch (error) {
            console.error('❌ Error validating trade:', error);
            return { approved: false, reason: 'Validation error' };
        }
    }

    async validateSignal(signal) {
        // Quick signal validation for high-frequency checks
        if (!this.isActive || this.emergencyStopTriggered) {
            return false;
        }

        // Basic checks
        if (this.dailyStats.tradesExecuted >= this.config.dailyTradeLimit) {
            return false;
        }

        if (this.dailyStats.netPL <= -this.config.maxDailyLoss) {
            return false;
        }

        if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
            return false;
        }

        return true;
    }

    // ================================
    // RISK CHECKS
    // ================================
    checkDailyLimits() {
        // Check daily loss limit
        if (this.dailyStats.netPL <= -this.config.maxDailyLoss) {
            return { passed: false, reason: `Daily loss limit reached: $${Math.abs(this.dailyStats.netPL)}` };
        }

        // Check daily trade limit
        if (this.dailyStats.tradesExecuted >= this.config.dailyTradeLimit) {
            return { passed: false, reason: `Daily trade limit reached: ${this.dailyStats.tradesExecuted}` };
        }

        // Check if profit target reached (optional stop)
        if (this.dailyStats.netPL >= this.config.dailyProfitTarget) {
            // Could implement profit protection here
            // For now, allow continued trading
        }

        return { passed: true };
    }

    checkAccountBalance(tradeAmount) {
        const remainingBalance = this.accountStats.currentBalance - tradeAmount;
        
        if (remainingBalance < this.config.minAccountBalance) {
            return { 
                passed: false, 
                reason: `Insufficient balance: $${this.accountStats.currentBalance} (need $${tradeAmount + this.config.minAccountBalance})` 
            };
        }

        return { passed: true };
    }

    checkTradeSize(amount) {
        const accountRisk = amount / this.accountStats.currentBalance;
        
        if (accountRisk > this.config.maxRiskPerTrade) {
            return { 
                passed: false, 
                reason: `Trade size exceeds risk limit: ${(accountRisk * 100).toFixed(1)}% (max: ${(this.config.maxRiskPerTrade * 100)}%)` 
            };
        }

        return { passed: true };
    }

    checkConcurrentTrades() {
        if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
            return { 
                passed: false, 
                reason: `Maximum concurrent trades reached: ${this.activeTrades.size}/${this.config.maxConcurrentTrades}` 
            };
        }

        return { passed: true };
    }

    checkConsecutiveLosses() {
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit) {
            return { 
                passed: false, 
                reason: `Consecutive loss limit reached: ${this.dailyStats.consecutiveLosses}` 
            };
        }

        return { passed: true };
    }

    checkDrawdownLimit() {
        if (this.accountStats.currentDrawdown > this.config.maxDrawdown) {
            return { 
                passed: false, 
                reason: `Maximum drawdown exceeded: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%` 
            };
        }

        return { passed: true };
    }

    checkVolatilityRisk(tradeParams) {
        // Check market volatility (would need actual volatility data)
        const volatility = this.getCurrentVolatility(tradeParams.asset);
        
        if (volatility > this.config.volatilityThreshold) {
            // Reduce position in high volatility
            return { 
                passed: true, 
                warning: `High volatility detected: ${(volatility * 100).toFixed(1)}%`,
                recommendation: 'Consider reducing position size'
            };
        }

        return { passed: true };
    }

    checkCorrelationRisk(tradeParams) {
        // Check for highly correlated positions
        const correlatedTrades = this.findCorrelatedTrades(tradeParams.asset);
        
        if (correlatedTrades.length > 2) {
            return { 
                passed: false, 
                reason: `Too many correlated positions: ${correlatedTrades.length} trades on similar assets` 
            };
        }

        return { passed: true };
    }

    // ================================
    // POSITION SIZING
    // ================================
    calculateOptimalPositionSize(tradeParams, accountBalance, strategyWinRate) {
        return this.positionSizer.calculatePositionSize(
            tradeParams.amount,
            accountBalance,
            strategyWinRate
        );
    }

    calculateTradeRiskLevel(tradeParams) {
        const accountRisk = tradeParams.amount / this.accountStats.currentBalance;
        const volatility = this.getCurrentVolatility(tradeParams.asset);
        const correlationRisk = this.calculateCorrelationRisk(tradeParams.asset);
        
        const riskScore = (accountRisk * 0.4) + (volatility * 0.3) + (correlationRisk * 0.3);
        
        if (riskScore < 0.02) return 'low';
        if (riskScore < 0.04) return 'medium';
        return 'high';
    }

    // ================================
    // TRADE MONITORING
    // ================================
    recordTradeStart(trade) {
        console.log(`📊 Recording trade start: ${trade.id}`);
        
        this.activeTrades.set(trade.id, {
            id: trade.id,
            asset: trade.asset,
            direction: trade.direction,
            amount: trade.amount,
            startTime: new Date(),
            maxLoss: trade.amount,
            unrealizedPL: 0
        });

        this.dailyStats.tradesExecuted++;
        this.updateRiskMetrics();
    }

    recordTradeEnd(trade) {
        console.log(`📊 Recording trade end: ${trade.id} - ${trade.result}`);
        
        this.activeTrades.delete(trade.id);
        
        const profit = trade.profit || 0;
        
        if (profit > 0) {
            this.dailyStats.profit += profit;
            this.dailyStats.consecutiveLosses = 0;
        } else {
            this.dailyStats.loss += Math.abs(profit);
            this.dailyStats.consecutiveLosses++;
        }
        
        this.dailyStats.netPL = this.dailyStats.profit - this.dailyStats.loss;
        this.accountStats.currentBalance += profit;
        this.accountStats.totalProfit += Math.max(0, profit);
        this.accountStats.totalLoss += Math.max(0, -profit);
        
        // Update peak balance and drawdown
        if (this.accountStats.currentBalance > this.accountStats.peakBalance) {
            this.accountStats.peakBalance = this.accountStats.currentBalance;
        }
        
        this.accountStats.currentDrawdown = 
            (this.accountStats.peakBalance - this.accountStats.currentBalance) / this.accountStats.peakBalance;
        
        this.accountStats.maxDrawdown = Math.max(
            this.accountStats.maxDrawdown, 
            this.accountStats.currentDrawdown
        );

        // Check for emergency conditions
        this.checkEmergencyConditions();
        
        this.updateRiskMetrics();
        
        this.emit('trade_recorded', {
            tradeId: trade.id,
            profit: profit,
            dailyPL: this.dailyStats.netPL,
            accountBalance: this.accountStats.currentBalance,
            drawdown: this.accountStats.currentDrawdown
        });
    }

    // ================================
    // RISK MONITORING
    // ================================
    startRiskMonitoring() {
        console.log('🔍 Starting risk monitoring...');
        
        // Monitor risk metrics every 30 seconds
        setInterval(() => {
            this.updateRiskMetrics();
            this.checkRiskAlerts();
        }, 30000);
        
        // Daily reset check every hour
        setInterval(() => {
            this.checkAndResetDailyStats();
        }, 3600000);
        
        // Emergency monitoring every 10 seconds
        setInterval(() => {
            this.checkEmergencyConditions();
        }, 10000);
    }

    updateRiskMetrics() {
        // Calculate real-time risk metrics
        const metrics = this.metricsCalculator.calculate(
            this.accountStats,
            this.dailyStats,
            this.activeTrades
        );
        
        this.emit('risk_metrics_updated', metrics);
    }

    checkRiskAlerts() {
        const alerts = [];
        
        // High daily loss warning
        if (this.dailyStats.netPL <= -this.config.maxDailyLoss * 0.8) {
            alerts.push({
                level: 'warning',
                type: 'daily_loss_warning',
                message: `Approaching daily loss limit: $${Math.abs(this.dailyStats.netPL)} of $${this.config.maxDailyLoss}`,
                timestamp: new Date()
            });
        }
        
        // High drawdown warning
        if (this.accountStats.currentDrawdown > this.config.maxDrawdown * 0.8) {
            alerts.push({
                level: 'warning',
                type: 'drawdown_warning',
                message: `High drawdown: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%`,
                timestamp: new Date()
            });
        }
        
        // Consecutive losses warning
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit - 1) {
            alerts.push({
                level: 'warning',
                type: 'consecutive_losses',
                message: `${this.dailyStats.consecutiveLosses} consecutive losses`,
                timestamp: new Date()
            });
        }
        
        // Low balance warning
        if (this.accountStats.currentBalance < this.config.minAccountBalance * 2) {
            alerts.push({
                level: 'critical',
                type: 'low_balance',
                message: `Low account balance: $${this.accountStats.currentBalance}`,
                timestamp: new Date()
            });
        }
        
        // Emit new alerts
        for (const alert of alerts) {
            if (!this.riskAlerts.find(a => a.type === alert.type && a.level === alert.level)) {
                this.riskAlerts.push(alert);
                this.emit('risk_alert', alert);
                
                if (alert.level === 'critical') {
                    this.handleCriticalAlert(alert);
                }
            }
        }
        
        // Clean old alerts
        this.riskAlerts = this.riskAlerts.filter(alert => 
            Date.now() - alert.timestamp.getTime() < 3600000 // Keep for 1 hour
        );
    }

    checkEmergencyConditions() {
        if (this.emergencyStopTriggered) return;
        
        // Emergency stop conditions
        const emergencyConditions = [
            this.dailyStats.netPL <= -this.config.emergencyStopLoss,
            this.accountStats.currentBalance <= this.config.minAccountBalance,
            this.accountStats.currentDrawdown >= this.config.maxDrawdown,
            this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit + 2
        ];
        
        if (emergencyConditions.some(condition => condition)) {
            this.triggerEmergencyStop();
        }
    }

    triggerEmergencyStop() {
        console.log('🚨 EMERGENCY STOP TRIGGERED - Risk Manager');
        
        this.emergencyStopTriggered = true;
        this.isActive = false;
        
        const stopReason = this.getEmergencyStopReason();
        
        this.emit('emergency_stop', {
            reason: stopReason,
            accountBalance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown,
            timestamp: new Date()
        });
        
        // Record emergency event
        this.recordRiskEvent('emergency_stop', stopReason, {
            balance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown
        });
    }

    getEmergencyStopReason() {
        if (this.dailyStats.netPL <= -this.config.emergencyStopLoss) {
            return `Emergency loss limit reached: $${Math.abs(this.dailyStats.netPL)}`;
        }
        if (this.accountStats.currentBalance <= this.config.minAccountBalance) {
            return `Account balance critically low: $${this.accountStats.currentBalance}`;
        }
        if (this.accountStats.currentDrawdown >= this.config.maxDrawdown) {
            return `Maximum drawdown exceeded: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%`;
        }
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit + 2) {
            return `Excessive consecutive losses: ${this.dailyStats.consecutiveLosses}`;
        }
        return 'Multiple risk conditions triggered';
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getCurrentVolatility(asset) {
        // Would calculate from real market data
        // Simplified implementation
        return Math.random() * 0.1; // 0-10% volatility
    }

    findCorrelatedTrades(asset) {
        // Find trades on correlated assets
        const correlatedAssets = this.getCorrelatedAssets(asset);
        
        return Array.from(this.activeTrades.values()).filter(trade =>
            correlatedAssets.includes(trade.asset)
        );
    }

    getCorrelatedAssets(asset) {
        // Define asset correlations
        const correlations = {
            'EURUSD': ['GBPUSD', 'AUDUSD', 'NZDUSD'],
            'GBPUSD': ['EURUSD', 'EURGBP'],
            'USDJPY': ['USDCHF', 'USDCAD'],
            // Add more correlations...
        };
        
        return correlations[asset] || [];
    }

    calculateCorrelationRisk(asset) {
        const correlatedTrades = this.findCorrelatedTrades(asset);
        return Math.min(correlatedTrades.length * 0.1, 0.5);
    }

    checkAndResetDailyStats() {
        const today = new Date().toDateString();
        
        if (this.dailyStats.lastResetDate !== today) {
            console.log('📅 Resetting daily risk statistics');
            
            // Store yesterday's stats before reset
            this.recordDailyStats();
            
            this.dailyStats = {
                profit: 0,
                loss: 0,
                netPL: 0,
                tradesExecuted: 0,
                consecutiveLosses: 0,
                lastResetDate: today
            };
            
            // Reset emergency stop if new day
            if (this.emergencyStopTriggered) {
                console.log('🔄 Resetting emergency stop for new trading day');
                this.emergencyStopTriggered = false;
                this.isActive = true;
            }
        }
    }

    recordDailyStats() {
        // Record daily statistics to database
        const database = this.getComponent('database');
        if (database) {
            database.saveDailyRiskStats({
                date: this.dailyStats.lastResetDate,
                profit: this.dailyStats.profit,
                loss: this.dailyStats.loss,
                netPL: this.dailyStats.netPL,
                tradesExecuted: this.dailyStats.tradesExecuted,
                accountBalance: this.accountStats.currentBalance
            });
        }
    }

    recordRiskEvent(type, description, data) {
        const event = {
            type: type,
            description: description,
            data: data,
            timestamp: new Date()
        };
        
        // Store in database
        const database = this.getComponent('database');
        if (database) {
            database.saveRiskEvent(event);
        }
        
        console.log(`🛡️ Risk event recorded: ${type} - ${description}`);
    }

    async validateAccountState() {
        // Validate account state on startup
        if (this.accountStats.currentBalance < this.config.minAccountBalance) {
            throw new Error(`Account balance too low: $${this.accountStats.currentBalance} (minimum: $${this.config.minAccountBalance})`);
        }
        
        console.log('✅ Account state validation passed');
    }

    async loadRiskHistory() {
        // Load historical risk data from database
        try {
            const database = this.getComponent('database');
            if (database) {
                const riskHistory = await database.getRiskHistory();
                if (riskHistory) {
                    // Update account stats from historical data
                    this.accountStats.maxDrawdown = riskHistory.maxDrawdown || 0;
                    this.accountStats.totalProfit = riskHistory.totalProfit || 0;
                    this.accountStats.totalLoss = riskHistory.totalLoss || 0;
                }
            }
        } catch (error) {
            console.log('📝 No risk history found, starting fresh');
        }
    }

    handleCriticalAlert(alert) {
        console.log(`🚨 CRITICAL RISK ALERT: ${alert.message}`);
        
        // Take immediate protective action
        switch (alert.type) {
            case 'low_balance':
                // Reduce position sizes
                this.config.maxRiskPerTrade *= 0.5;
                break;
                
            case 'high_drawdown':
                // Pause trading temporarily
                this.isActive = false;
                setTimeout(() => {
                    this.isActive = true;
                    console.log('🔄 Risk Manager reactivated after cooldown');
                }, 300000); // 5 minute pause
                break;
        }
    }

    // ================================
    // API METHODS
    // ================================
    async assessSignalRisk(signal) {
        return await this.validateTrade({
            asset: signal.asset,
            direction: signal.direction,
            amount: signal.amount,
            strategy: signal.strategy
        });
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🛡️ Risk Manager configuration updated');
    }

    getRiskMetrics() {
        return {
            daily: this.dailyStats,
            account: this.accountStats,
            config: this.config,
            alerts: this.riskAlerts,
            activeTrades: this.activeTrades.size,
            emergencyStop: this.emergencyStopTriggered
        };
    }

    getAccountBalance() {
        return this.accountStats.currentBalance;
    }

    getDailyPL() {
        return this.dailyStats.netPL;
    }

    healthCheck() {
        return {
            status: this.isActive ? (this.emergencyStopTriggered ? 'emergency_stop' : 'active') : 'inactive',
            accountBalance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown,
            activeTrades: this.activeTrades.size,
            riskAlerts: this.riskAlerts.length,
            emergencyStop: this.emergencyStopTriggered
        };
    }

    async start() {
        console.log('▶️ Starting Risk Manager...');
        this.isActive = true;
    }

    async stop() {
        console.log('⏹️ Stopping Risk Manager...');
        this.isActive = false;
        
        // Save current state
        this.recordDailyStats();
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

// ================================
// POSITION SIZER CLASS
// ================================
class PositionSizer {
    constructor(config) {
        this.config = config;
    }

    calculatePositionSize(requestedAmount, accountBalance, winRate) {
        // Kelly Criterion with modifications
        const kellyAmount = this.calculateKellyAmount(accountBalance, winRate);
        
        // Fixed percentage method
        const fixedPercentAmount = accountBalance * this.config.defaultRiskPerTrade;
        
        // Volatility adjustment
        const volatilityAdjusted = this.adjustForVolatility(requestedAmount);
        
        // Take the most conservative approach
        const calculatedAmount = Math.min(
            requestedAmount,
            kellyAmount,
            fixedPercentAmount,
            volatilityAdjusted
        );
        
        // Ensure minimum trade size
        const minTradeSize = parseFloat(process.env.MIN_TRADE_SIZE_DERIV) || 0.35;
        
        return Math.max(calculatedAmount, minTradeSize);
    }

    calculateKellyAmount(accountBalance, winRate) {
        // Simplified Kelly Criterion
        // f = (bp - q) / b
        // where b = odds, p = win probability, q = loss probability
        
        const b = 0.8; // 80% payout rate
        const p = winRate;
        const q = 1 - p;
        
        const f = (b * p - q) / b;
        const kellyFraction = Math.max(0, Math.min(f, 0.25)); // Cap at 25%
        
        return accountBalance * kellyFraction;
    }

    adjustForVolatility(amount) {
        // Reduce position size in high volatility
        const volatilityFactor = 0.8; // 20% reduction for high volatility
        return amount * volatilityFactor;
    }
}
// ================================
// BAYNEX.A.X RISK MANAGER
// Multi-Layer Risk Protection System
// ================================

const EventEmitter = require('events');

class RiskManager extends EventEmitter {
    constructor() {
        super();
        this.dependencies = ['database'];
        this.isActive = true;
        
        // Risk configuration
        this.config = {
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 500,
            dailyProfitTarget: parseFloat(process.env.DAILY_PROFIT_TARGET) || 200,
            maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES) || 5,
            defaultRiskPerTrade: parseFloat(process.env.DEFAULT_RISK_PER_TRADE) || 0.02,
            maxRiskPerTrade: 0.05, // 5% max risk per trade
            emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 1000,
            maxDrawdown: 0.20, // 20% max drawdown
            minAccountBalance: parseFloat(process.env.MIN_TRADE_SIZE_DERIV) * 10 || 3.50,
            consecutiveLossLimit: 5,
            dailyTradeLimit: 100,
            volatilityThreshold: 0.05,
            correlationLimit: 0.8
        };
        
        // Risk tracking
        this.dailyStats = {
            profit: 0,
            loss: 0,
            netPL: 0,
            tradesExecuted: 0,
            consecutiveLosses: 0,
            lastResetDate: new Date().toDateString()
        };
        
        this.accountStats = {
            currentBalance: parseFloat(process.env.STARTING_BALANCE) || 1000,
            peakBalance: parseFloat(process.env.STARTING_BALANCE) || 1000,
            currentDrawdown: 0,
            maxDrawdown: 0,
            totalProfit: 0,
            totalLoss: 0
        };
        
        // Active risk monitors
        this.activeTrades = new Map();
        this.riskAlerts = [];
        this.emergencyStopTriggered = false;
        
        // Position sizing calculator
        this.positionSizer = new PositionSizer(this.config);
        
        // Risk metrics calculator
        this.metricsCalculator = new RiskMetricsCalculator();
        
        this.startRiskMonitoring();
    }

    async initialize() {
        console.log('🛡️ Initializing Risk Manager...');
        
        try {
            // Load historical risk data
            await this.loadRiskHistory();
            
            // Reset daily stats if new day
            this.checkAndResetDailyStats();
            
            // Validate initial account state
            await this.validateAccountState();
            
            console.log('✅ Risk Manager initialized');
            console.log(`🛡️ Daily Loss Limit: $${this.config.maxDailyLoss}`);
            console.log(`🎯 Daily Profit Target: $${this.config.dailyProfitTarget}`);
            console.log(`📊 Current Balance: $${this.accountStats.currentBalance}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Risk Manager initialization failed:', error);
            throw error;
        }
    }

    // ================================
    // TRADE VALIDATION
    // ================================
    async validateTrade(tradeParams) {
        if (!this.isActive) {
            return { approved: false, reason: 'Risk Manager disabled' };
        }

        if (this.emergencyStopTriggered) {
            return { approved: false, reason: 'Emergency stop active' };
        }

        try {
            // Pre-trade validation checks
            const validations = [
                this.checkDailyLimits(),
                this.checkAccountBalance(tradeParams.amount),
                this.checkTradeSize(tradeParams.amount),
                this.checkConcurrentTrades(),
                this.checkConsecutiveLosses(),
                this.checkDrawdownLimit(),
                this.checkVolatilityRisk(tradeParams),
                this.checkCorrelationRisk(tradeParams)
            ];

            for (const validation of validations) {
                if (!validation.passed) {
                    console.log(`🛡️ Trade rejected: ${validation.reason}`);
                    this.recordRiskEvent('trade_rejected', validation.reason, tradeParams);
                    return { approved: false, reason: validation.reason };
                }
            }

            // Calculate position size
            const recommendedSize = this.positionSizer.calculatePositionSize(
                tradeParams.amount, 
                this.accountStats.currentBalance,
                tradeParams.strategy?.performance?.winRate || 0.5
            );

            // Approve trade with recommendations
            const approval = {
                approved: true,
                recommendedAmount: recommendedSize,
                riskLevel: this.calculateTradeRiskLevel(tradeParams),
                maxLoss: recommendedSize,
                notes: []
            };

            if (recommendedSize !== tradeParams.amount) {
                approval.notes.push(`Position size adjusted from $${tradeParams.amount} to $${recommendedSize}`);
            }

            console.log(`✅ Trade approved: ${tradeParams.direction} ${tradeParams.asset} - $${recommendedSize}`);
            
            return approval;

        } catch (error) {
            console.error('❌ Error validating trade:', error);
            return { approved: false, reason: 'Validation error' };
        }
    }

    async validateSignal(signal) {
        // Quick signal validation for high-frequency checks
        if (!this.isActive || this.emergencyStopTriggered) {
            return false;
        }

        // Basic checks
        if (this.dailyStats.tradesExecuted >= this.config.dailyTradeLimit) {
            return false;
        }

        if (this.dailyStats.netPL <= -this.config.maxDailyLoss) {
            return false;
        }

        if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
            return false;
        }

        return true;
    }

    // ================================
    // RISK CHECKS
    // ================================
    checkDailyLimits() {
        // Check daily loss limit
        if (this.dailyStats.netPL <= -this.config.maxDailyLoss) {
            return { passed: false, reason: `Daily loss limit reached: $${Math.abs(this.dailyStats.netPL)}` };
        }

        // Check daily trade limit
        if (this.dailyStats.tradesExecuted >= this.config.dailyTradeLimit) {
            return { passed: false, reason: `Daily trade limit reached: ${this.dailyStats.tradesExecuted}` };
        }

        // Check if profit target reached (optional stop)
        if (this.dailyStats.netPL >= this.config.dailyProfitTarget) {
            // Could implement profit protection here
            // For now, allow continued trading
        }

        return { passed: true };
    }

    checkAccountBalance(tradeAmount) {
        const remainingBalance = this.accountStats.currentBalance - tradeAmount;
        
        if (remainingBalance < this.config.minAccountBalance) {
            return { 
                passed: false, 
                reason: `Insufficient balance: $${this.accountStats.currentBalance} (need $${tradeAmount + this.config.minAccountBalance})` 
            };
        }

        return { passed: true };
    }

    checkTradeSize(amount) {
        const accountRisk = amount / this.accountStats.currentBalance;
        
        if (accountRisk > this.config.maxRiskPerTrade) {
            return { 
                passed: false, 
                reason: `Trade size exceeds risk limit: ${(accountRisk * 100).toFixed(1)}% (max: ${(this.config.maxRiskPerTrade * 100)}%)` 
            };
        }

        return { passed: true };
    }

    checkConcurrentTrades() {
        if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
            return { 
                passed: false, 
                reason: `Maximum concurrent trades reached: ${this.activeTrades.size}/${this.config.maxConcurrentTrades}` 
            };
        }

        return { passed: true };
    }

    checkConsecutiveLosses() {
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit) {
            return { 
                passed: false, 
                reason: `Consecutive loss limit reached: ${this.dailyStats.consecutiveLosses}` 
            };
        }

        return { passed: true };
    }

    checkDrawdownLimit() {
        if (this.accountStats.currentDrawdown > this.config.maxDrawdown) {
            return { 
                passed: false, 
                reason: `Maximum drawdown exceeded: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%` 
            };
        }

        return { passed: true };
    }

    checkVolatilityRisk(tradeParams) {
        // Check market volatility (would need actual volatility data)
        const volatility = this.getCurrentVolatility(tradeParams.asset);
        
        if (volatility > this.config.volatilityThreshold) {
            // Reduce position in high volatility
            return { 
                passed: true, 
                warning: `High volatility detected: ${(volatility * 100).toFixed(1)}%`,
                recommendation: 'Consider reducing position size'
            };
        }

        return { passed: true };
    }

    checkCorrelationRisk(tradeParams) {
        // Check for highly correlated positions
        const correlatedTrades = this.findCorrelatedTrades(tradeParams.asset);
        
        if (correlatedTrades.length > 2) {
            return { 
                passed: false, 
                reason: `Too many correlated positions: ${correlatedTrades.length} trades on similar assets` 
            };
        }

        return { passed: true };
    }

    // ================================
    // POSITION SIZING
    // ================================
    calculateOptimalPositionSize(tradeParams, accountBalance, strategyWinRate) {
        return this.positionSizer.calculatePositionSize(
            tradeParams.amount,
            accountBalance,
            strategyWinRate
        );
    }

    calculateTradeRiskLevel(tradeParams) {
        const accountRisk = tradeParams.amount / this.accountStats.currentBalance;
        const volatility = this.getCurrentVolatility(tradeParams.asset);
        const correlationRisk = this.calculateCorrelationRisk(tradeParams.asset);
        
        const riskScore = (accountRisk * 0.4) + (volatility * 0.3) + (correlationRisk * 0.3);
        
        if (riskScore < 0.02) return 'low';
        if (riskScore < 0.04) return 'medium';
        return 'high';
    }

    // ================================
    // TRADE MONITORING
    // ================================
    recordTradeStart(trade) {
        console.log(`📊 Recording trade start: ${trade.id}`);
        
        this.activeTrades.set(trade.id, {
            id: trade.id,
            asset: trade.asset,
            direction: trade.direction,
            amount: trade.amount,
            startTime: new Date(),
            maxLoss: trade.amount,
            unrealizedPL: 0
        });

        this.dailyStats.tradesExecuted++;
        this.updateRiskMetrics();
    }

    recordTradeEnd(trade) {
        console.log(`📊 Recording trade end: ${trade.id} - ${trade.result}`);
        
        this.activeTrades.delete(trade.id);
        
        const profit = trade.profit || 0;
        
        if (profit > 0) {
            this.dailyStats.profit += profit;
            this.dailyStats.consecutiveLosses = 0;
        } else {
            this.dailyStats.loss += Math.abs(profit);
            this.dailyStats.consecutiveLosses++;
        }
        
        this.dailyStats.netPL = this.dailyStats.profit - this.dailyStats.loss;
        this.accountStats.currentBalance += profit;
        this.accountStats.totalProfit += Math.max(0, profit);
        this.accountStats.totalLoss += Math.max(0, -profit);
        
        // Update peak balance and drawdown
        if (this.accountStats.currentBalance > this.accountStats.peakBalance) {
            this.accountStats.peakBalance = this.accountStats.currentBalance;
        }
        
        this.accountStats.currentDrawdown = 
            (this.accountStats.peakBalance - this.accountStats.currentBalance) / this.accountStats.peakBalance;
        
        this.accountStats.maxDrawdown = Math.max(
            this.accountStats.maxDrawdown, 
            this.accountStats.currentDrawdown
        );

        // Check for emergency conditions
        this.checkEmergencyConditions();
        
        this.updateRiskMetrics();
        
        this.emit('trade_recorded', {
            tradeId: trade.id,
            profit: profit,
            dailyPL: this.dailyStats.netPL,
            accountBalance: this.accountStats.currentBalance,
            drawdown: this.accountStats.currentDrawdown
        });
    }

    // ================================
    // RISK MONITORING
    // ================================
    startRiskMonitoring() {
        console.log('🔍 Starting risk monitoring...');
        
        // Monitor risk metrics every 30 seconds
        setInterval(() => {
            this.updateRiskMetrics();
            this.checkRiskAlerts();
        }, 30000);
        
        // Daily reset check every hour
        setInterval(() => {
            this.checkAndResetDailyStats();
        }, 3600000);
        
        // Emergency monitoring every 10 seconds
        setInterval(() => {
            this.checkEmergencyConditions();
        }, 10000);
    }

    updateRiskMetrics() {
        // Calculate real-time risk metrics
        const metrics = this.metricsCalculator.calculate(
            this.accountStats,
            this.dailyStats,
            this.activeTrades
        );
        
        this.emit('risk_metrics_updated', metrics);
    }

    checkRiskAlerts() {
        const alerts = [];
        
        // High daily loss warning
        if (this.dailyStats.netPL <= -this.config.maxDailyLoss * 0.8) {
            alerts.push({
                level: 'warning',
                type: 'daily_loss_warning',
                message: `Approaching daily loss limit: $${Math.abs(this.dailyStats.netPL)} of $${this.config.maxDailyLoss}`,
                timestamp: new Date()
            });
        }
        
        // High drawdown warning
        if (this.accountStats.currentDrawdown > this.config.maxDrawdown * 0.8) {
            alerts.push({
                level: 'warning',
                type: 'drawdown_warning',
                message: `High drawdown: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%`,
                timestamp: new Date()
            });
        }
        
        // Consecutive losses warning
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit - 1) {
            alerts.push({
                level: 'warning',
                type: 'consecutive_losses',
                message: `${this.dailyStats.consecutiveLosses} consecutive losses`,
                timestamp: new Date()
            });
        }
        
        // Low balance warning
        if (this.accountStats.currentBalance < this.config.minAccountBalance * 2) {
            alerts.push({
                level: 'critical',
                type: 'low_balance',
                message: `Low account balance: $${this.accountStats.currentBalance}`,
                timestamp: new Date()
            });
        }
        
        // Emit new alerts
        for (const alert of alerts) {
            if (!this.riskAlerts.find(a => a.type === alert.type && a.level === alert.level)) {
                this.riskAlerts.push(alert);
                this.emit('risk_alert', alert);
                
                if (alert.level === 'critical') {
                    this.handleCriticalAlert(alert);
                }
            }
        }
        
        // Clean old alerts
        this.riskAlerts = this.riskAlerts.filter(alert => 
            Date.now() - alert.timestamp.getTime() < 3600000 // Keep for 1 hour
        );
    }

    checkEmergencyConditions() {
        if (this.emergencyStopTriggered) return;
        
        // Emergency stop conditions
        const emergencyConditions = [
            this.dailyStats.netPL <= -this.config.emergencyStopLoss,
            this.accountStats.currentBalance <= this.config.minAccountBalance,
            this.accountStats.currentDrawdown >= this.config.maxDrawdown,
            this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit + 2
        ];
        
        if (emergencyConditions.some(condition => condition)) {
            this.triggerEmergencyStop();
        }
    }

    triggerEmergencyStop() {
        console.log('🚨 EMERGENCY STOP TRIGGERED - Risk Manager');
        
        this.emergencyStopTriggered = true;
        this.isActive = false;
        
        const stopReason = this.getEmergencyStopReason();
        
        this.emit('emergency_stop', {
            reason: stopReason,
            accountBalance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown,
            timestamp: new Date()
        });
        
        // Record emergency event
        this.recordRiskEvent('emergency_stop', stopReason, {
            balance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown
        });
    }

    getEmergencyStopReason() {
        if (this.dailyStats.netPL <= -this.config.emergencyStopLoss) {
            return `Emergency loss limit reached: $${Math.abs(this.dailyStats.netPL)}`;
        }
        if (this.accountStats.currentBalance <= this.config.minAccountBalance) {
            return `Account balance critically low: $${this.accountStats.currentBalance}`;
        }
        if (this.accountStats.currentDrawdown >= this.config.maxDrawdown) {
            return `Maximum drawdown exceeded: ${(this.accountStats.currentDrawdown * 100).toFixed(1)}%`;
        }
        if (this.dailyStats.consecutiveLosses >= this.config.consecutiveLossLimit + 2) {
            return `Excessive consecutive losses: ${this.dailyStats.consecutiveLosses}`;
        }
        return 'Multiple risk conditions triggered';
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getCurrentVolatility(asset) {
        // Would calculate from real market data
        // Simplified implementation
        return Math.random() * 0.1; // 0-10% volatility
    }

    findCorrelatedTrades(asset) {
        // Find trades on correlated assets
        const correlatedAssets = this.getCorrelatedAssets(asset);
        
        return Array.from(this.activeTrades.values()).filter(trade =>
            correlatedAssets.includes(trade.asset)
        );
    }

    getCorrelatedAssets(asset) {
        // Define asset correlations
        const correlations = {
            'EURUSD': ['GBPUSD', 'AUDUSD', 'NZDUSD'],
            'GBPUSD': ['EURUSD', 'EURGBP'],
            'USDJPY': ['USDCHF', 'USDCAD'],
            // Add more correlations...
        };
        
        return correlations[asset] || [];
    }

    calculateCorrelationRisk(asset) {
        const correlatedTrades = this.findCorrelatedTrades(asset);
        return Math.min(correlatedTrades.length * 0.1, 0.5);
    }

    checkAndResetDailyStats() {
        const today = new Date().toDateString();
        
        if (this.dailyStats.lastResetDate !== today) {
            console.log('📅 Resetting daily risk statistics');
            
            // Store yesterday's stats before reset
            this.recordDailyStats();
            
            this.dailyStats = {
                profit: 0,
                loss: 0,
                netPL: 0,
                tradesExecuted: 0,
                consecutiveLosses: 0,
                lastResetDate: today
            };
            
            // Reset emergency stop if new day
            if (this.emergencyStopTriggered) {
                console.log('🔄 Resetting emergency stop for new trading day');
                this.emergencyStopTriggered = false;
                this.isActive = true;
            }
        }
    }

    recordDailyStats() {
        // Record daily statistics to database
        const database = this.getComponent('database');
        if (database) {
            database.saveDailyRiskStats({
                date: this.dailyStats.lastResetDate,
                profit: this.dailyStats.profit,
                loss: this.dailyStats.loss,
                netPL: this.dailyStats.netPL,
                tradesExecuted: this.dailyStats.tradesExecuted,
                accountBalance: this.accountStats.currentBalance
            });
        }
    }

    recordRiskEvent(type, description, data) {
        const event = {
            type: type,
            description: description,
            data: data,
            timestamp: new Date()
        };
        
        // Store in database
        const database = this.getComponent('database');
        if (database) {
            database.saveRiskEvent(event);
        }
        
        console.log(`🛡️ Risk event recorded: ${type} - ${description}`);
    }

    async validateAccountState() {
        // Validate account state on startup
        if (this.accountStats.currentBalance < this.config.minAccountBalance) {
            throw new Error(`Account balance too low: $${this.accountStats.currentBalance} (minimum: $${this.config.minAccountBalance})`);
        }
        
        console.log('✅ Account state validation passed');
    }

    async loadRiskHistory() {
        // Load historical risk data from database
        try {
            const database = this.getComponent('database');
            if (database) {
                const riskHistory = await database.getRiskHistory();
                if (riskHistory) {
                    // Update account stats from historical data
                    this.accountStats.maxDrawdown = riskHistory.maxDrawdown || 0;
                    this.accountStats.totalProfit = riskHistory.totalProfit || 0;
                    this.accountStats.totalLoss = riskHistory.totalLoss || 0;
                }
            }
        } catch (error) {
            console.log('📝 No risk history found, starting fresh');
        }
    }

    handleCriticalAlert(alert) {
        console.log(`🚨 CRITICAL RISK ALERT: ${alert.message}`);
        
        // Take immediate protective action
        switch (alert.type) {
            case 'low_balance':
                // Reduce position sizes
                this.config.maxRiskPerTrade *= 0.5;
                break;
                
            case 'high_drawdown':
                // Pause trading temporarily
                this.isActive = false;
                setTimeout(() => {
                    this.isActive = true;
                    console.log('🔄 Risk Manager reactivated after cooldown');
                }, 300000); // 5 minute pause
                break;
        }
    }

    // ================================
    // API METHODS
    // ================================
    async assessSignalRisk(signal) {
        return await this.validateTrade({
            asset: signal.asset,
            direction: signal.direction,
            amount: signal.amount,
            strategy: signal.strategy
        });
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🛡️ Risk Manager configuration updated');
    }

    getRiskMetrics() {
        return {
            daily: this.dailyStats,
            account: this.accountStats,
            config: this.config,
            alerts: this.riskAlerts,
            activeTrades: this.activeTrades.size,
            emergencyStop: this.emergencyStopTriggered
        };
    }

    getAccountBalance() {
        return this.accountStats.currentBalance;
    }

    getDailyPL() {
        return this.dailyStats.netPL;
    }

    healthCheck() {
        return {
            status: this.isActive ? (this.emergencyStopTriggered ? 'emergency_stop' : 'active') : 'inactive',
            accountBalance: this.accountStats.currentBalance,
            dailyPL: this.dailyStats.netPL,
            drawdown: this.accountStats.currentDrawdown,
            activeTrades: this.activeTrades.size,
            riskAlerts: this.riskAlerts.length,
            emergencyStop: this.emergencyStopTriggered
        };
    }

    async start() {
        console.log('▶️ Starting Risk Manager...');
        this.isActive = true;
    }

    async stop() {
        console.log('⏹️ Stopping Risk Manager...');
        this.isActive = false;
        
        // Save current state
        this.recordDailyStats();
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

// ================================
// POSITION SIZER CLASS
// ================================
class PositionSizer {
    constructor(config) {
        this.config = config;
    }

    calculatePositionSize(requestedAmount, accountBalance, winRate) {
        // Kelly Criterion with modifications
        const kellyAmount = this.calculateKellyAmount(accountBalance, winRate);
        
        // Fixed percentage method
        const fixedPercentAmount = accountBalance * this.config.defaultRiskPerTrade;
        
        // Volatility adjustment
        const volatilityAdjusted = this.adjustForVolatility(requestedAmount);
        
        // Take the most conservative approach
        const calculatedAmount = Math.min(
            requestedAmount,
            kellyAmount,
            fixedPercentAmount,
            volatilityAdjusted
        );
        
        // Ensure minimum trade size
        const minTradeSize = parseFloat(process.env.MIN_TRADE_SIZE_DERIV) || 0.35;
        
        return Math.max(calculatedAmount, minTradeSize);
    }

    calculateKellyAmount(accountBalance, winRate) {
        // Simplified Kelly Criterion
        // f = (bp - q) / b
        // where b = odds, p = win probability, q = loss probability
        
        const b = 0.8; // 80% payout rate
        const p = winRate;
        const q = 1 - p;
        
        const f = (b * p - q) / b;
        const kellyFraction = Math.max(0, Math.min(f, 0.25)); // Cap at 25%
        
        return accountBalance * kellyFraction;
    }

    adjustForVolatility(amount) {
        // Reduce position size in high volatility
        const volatilityFactor = 0.8; // 20% reduction for high volatility
        return amount * volatilityFactor;
    }
}

// ================================
// RISK METRICS CALCULATOR
// ================================
class RiskMetricsCalculator {
    calculate(accountStats, dailyStats, activeTrades) {
        const metrics = {
            // Basic metrics
            accountBalance: accountStats.currentBalance,
            dailyPL: dailyStats.netPL,
            currentDrawdown: accountStats.currentDrawdown,
            
            // Risk ratios
            riskRewardRatio: this.calculateRiskRewardRatio(dailyStats),
            profitFactor: this.calculateProfitFactor(accountStats),
            sharpeRatio: this.calculateSharpeRatio(accountStats),
            
            // Position metrics
            portfolioHeat: this.calculatePortfolioHeat(activeTrades, accountStats.currentBalance),
            diversificationRatio: this.calculateDiversification(activeTrades),
            
            // Performance metrics
            winRate: this.calculateWinRate(dailyStats),
            averageWin: this.calculateAverageWin(accountStats),
            averageLoss: this.calculateAverageLoss(accountStats),
            
            timestamp: new Date()
        };
        
        return metrics;
    }

    calculateRiskRewardRatio(dailyStats) {
        if (dailyStats.loss === 0) return 0;
        return dailyStats.profit / dailyStats.loss;
    }

    calculateProfitFactor(accountStats) {
        if (accountStats.totalLoss === 0) return 0;
        return accountStats.totalProfit / accountStats.totalLoss;
    }

    calculateSharpeRatio(accountStats) {
        // Simplified Sharpe ratio calculation
        const returns = accountStats.totalProfit - accountStats.totalLoss;
        const volatility = Math.sqrt(accountStats.totalLoss); // Simplified
        
        return volatility > 0 ? returns / volatility : 0;
    }

    calculatePortfolioHeat(activeTrades, accountBalance) {
        const totalRisk = Array.from(activeTrades.values())
            .reduce((sum, trade) => sum + trade.amount, 0);
        
        return totalRisk / accountBalance;
    }

    calculateDiversification(activeTrades) {
        const assets = new Set(Array.from(activeTrades.values()).map(t => t.asset));
        return assets.size / Math.max(activeTrades.size, 1);
    }

    calculateWinRate(dailyStats) {
        const totalTrades = dailyStats.tradesExecuted;
        if (totalTrades === 0) return 0;
        
        // Approximate win rate from P&L
        return dailyStats.profit > dailyStats.loss ? 0.6 : 0.4;
    }

    calculateAverageWin(accountStats) {
        // Would need trade history for accurate calculation
        return accountStats.totalProfit / Math.max(1, accountStats.totalProfit > 0 ? 10 : 1);
    }

    calculateAverageLoss(accountStats) {
        // Would need trade history for accurate calculation
        return accountStats.totalLoss / Math.max(1, accountStats.totalLoss > 0 ? 10 : 1);
    }
}

module.exports = RiskManager;
