// ================================
// BAYNEX.A.X STRATEGY MANAGER
// Dynamic Strategy Evolution & Management
// ================================

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class StrategyManager extends EventEmitter {
    constructor() {
        super();
        this.strategies = new Map();
        this.activeStrategies = new Set();
        this.strategyHistory = new Map();
        this.isExecuting = false;
        this.dependencies = ['aiEngine', 'riskManager', 'database'];
        
        this.config = {
            maxActiveStrategies: 5,
            retirementThreshold: parseFloat(process.env.STRATEGY_RETIREMENT_THRESHOLD) || 0.3,
            performanceWindow: parseInt(process.env.STRATEGY_PERFORMANCE_WINDOW) || 100,
            evolutionEnabled: process.env.STRATEGY_AUTO_EVOLUTION === 'true',
            minConfidence: parseFloat(process.env.STRATEGY_MIN_CONFIDENCE) || 0.7,
            evaluationInterval: 300000, // 5 minutes
            evolutionInterval: 3600000 // 1 hour
        };
        
        this.stats = {
            totalStrategies: 0,
            activeStrategies: 0,
            retiredStrategies: 0,
            evolutionCycles: 0,
            bestPerformingStrategy: null,
            averagePerformance: 0
        };
        
        this.initializeDefaultStrategies();
    }

    async initialize() {
        console.log('⚙️ Initializing Strategy Manager...');
        
        try {
            // Load existing strategies
            await this.loadStrategies();
            
            // Start strategy monitoring
            this.startStrategyMonitoring();
            
            // Start evolution cycles if enabled
            if (this.config.evolutionEnabled) {
                this.startEvolutionCycles();
            }
            
            console.log('✅ Strategy Manager initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Strategy Manager initialization failed:', error);
            throw error;
        }
    }

    initializeDefaultStrategies() {
        console.log('📋 Initializing default trading strategies...');
        
        // Momentum Strategy
        this.createStrategy({
            name: 'Momentum_RSI',
            type: 'momentum',
            description: 'RSI-based momentum trading',
            parameters: {
                rsiPeriod: 14,
                overbought: 70,
                oversold: 30,
                rsiThreshold: 5,
                timeframe: 5
            },
            indicators: ['RSI', 'Price'],
            rules: {
                entry: {
                    call: 'RSI < oversold AND price momentum > 0',
                    put: 'RSI > overbought AND price momentum < 0'
                },
                exit: {
                    profitTarget: 0.8,
                    stopLoss: 0.3
                }
            },
            confidence: 0.75
        });

        // Reversal Strategy
        this.createStrategy({
            name: 'Mean_Reversion',
            type: 'reversal',
            description: 'Bollinger Bands mean reversion',
            parameters: {
                bollingerPeriod: 20,
                standardDeviations: 2,
                rsiFilter: 50,
                timeframe: 5
            },
            indicators: ['BollingerBands', 'RSI', 'Price'],
            rules: {
                entry: {
                    call: 'price < bollinger.lower AND RSI < 30',
                    put: 'price > bollinger.upper AND RSI > 70'
                },
                exit: {
                    profitTarget: 0.8,
                    stopLoss: 0.4
                }
            },
            confidence: 0.7
        });

        // Breakout Strategy
        this.createStrategy({
            name: 'Breakout_Volume',
            type: 'breakout',
            description: 'Volume-confirmed breakouts',
            parameters: {
                volumeThreshold: 1.5,
                priceThreshold: 0.002,
                confirmationPeriod: 3,
                timeframe: 15
            },
            indicators: ['Volume', 'Price', 'ATR'],
            rules: {
                entry: {
                    call: 'price breaks resistance AND volume > threshold',
                    put: 'price breaks support AND volume > threshold'
                },
                exit: {
                    profitTarget: 0.85,
                    stopLoss: 0.25
                }
            },
            confidence: 0.8
        });

        // Boundary Breaker (Custom)
        this.createStrategy({
            name: 'Boundary_Breaker',
            type: 'custom',
            description: 'BAYNEX custom boundary breaking strategy',
            parameters: {
                boundaryStrength: 3,
                volumeConfirmation: true,
                rsiFilter: true,
                momentumFilter: true,
                timeframe: 10
            },
            indicators: ['Price', 'Volume', 'RSI', 'MACD', 'Support', 'Resistance'],
            rules: {
                entry: {
                    call: 'price approaches resistance AND momentum positive AND RSI neutral',
                    put: 'price approaches support AND momentum negative AND RSI neutral'
                },
                exit: {
                    profitTarget: 0.82,
                    stopLoss: 0.35
                }
            },
            confidence: 0.85
        });

        // AI-Enhanced Strategy
        this.createStrategy({
            name: 'AI_Adaptive',
            type: 'ai',
            description: 'AI-driven adaptive strategy',
            parameters: {
                confidenceThreshold: 0.75,
                adaptationRate: 0.1,
                patternRecognition: true,
                marketStateAware: true,
                timeframe: 5
            },
            indicators: ['AI_Prediction', 'Pattern_Score', 'Market_State'],
            rules: {
                entry: {
                    call: 'AI prediction > confidence threshold AND pattern positive',
                    put: 'AI prediction < (1 - confidence threshold) AND pattern negative'
                },
                exit: {
                    profitTarget: 0.8,
                    stopLoss: 0.3
                }
            },
            confidence: 0.9
        });

        console.log(`✅ ${this.strategies.size} default strategies initialized`);
    }

    createStrategy(strategyConfig) {
        const strategy = {
            id: this.generateStrategyId(),
            ...strategyConfig,
            created: new Date(),
            lastModified: new Date(),
            status: 'active',
            performance: {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalProfit: 0,
                averageProfit: 0,
                maxDrawdown: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                recentTrades: []
            },
            evolution: {
                generation: 1,
                mutations: 0,
                parentStrategy: null,
                evolutionHistory: []
            }
        };

        this.strategies.set(strategy.id, strategy);
        this.activeStrategies.add(strategy.id);
        this.stats.totalStrategies++;
        this.stats.activeStrategies++;

        console.log(`📊 Strategy created: ${strategy.name} (${strategy.id})`);
        
        this.emit('strategy_created', strategy);
        
        return strategy;
    }

    // ================================
    // STRATEGY EXECUTION
    // ================================
    async startExecution() {
        if (this.isExecuting) return;
        
        console.log('▶️ Starting strategy execution...');
        this.isExecuting = true;
        
        // Start signal generation loop
        this.signalGenerationLoop();
    }

    async stopExecution() {
        console.log('⏹️ Stopping strategy execution...');
        this.isExecuting = false;
    }

    async signalGenerationLoop() {
        while (this.isExecuting) {
            try {
                await this.generateSignals();
                await this.sleep(5000); // Generate signals every 5 seconds
            } catch (error) {
                console.error('❌ Error in signal generation loop:', error);
                await this.sleep(10000); // Wait longer on error
            }
        }
    }

    async generateSignals() {
        const activeStrategies = Array.from(this.activeStrategies)
            .map(id => this.strategies.get(id))
            .filter(strategy => strategy && strategy.status === 'active');

        for (const strategy of activeStrategies) {
            try {
                const signal = await this.evaluateStrategy(strategy);
                if (signal && signal.confidence >= this.config.minConfidence) {
                    await this.emitTradeSignal(signal);
                }
            } catch (error) {
                console.error(`❌ Error evaluating strategy ${strategy.name}:`, error);
            }
        }
    }

    async evaluateStrategy(strategy) {
        try {
            // Get current market data
            const marketData = await this.getCurrentMarketData();
            if (!marketData) return null;

            // Calculate indicators
            const indicators = await this.calculateIndicators(strategy, marketData);

            // Evaluate entry conditions
            const signal = await this.evaluateEntryConditions(strategy, indicators, marketData);

            return signal;

        } catch (error) {
            console.error(`❌ Error evaluating strategy ${strategy.name}:`, error);
            return null;
        }
    }

    async getCurrentMarketData() {
        // Get market data from data processor
        const dataProcessor = this.getComponent('dataProcessor');
        if (!dataProcessor) return null;

        return await dataProcessor.getCurrentMarketData();
    }

    async calculateIndicators(strategy, marketData) {
        const indicators = {};

        for (const indicatorName of strategy.indicators) {
            try {
                indicators[indicatorName] = await this.calculateIndicator(indicatorName, marketData, strategy.parameters);
            } catch (error) {
                console.error(`❌ Error calculating ${indicatorName}:`, error);
                indicators[indicatorName] = null;
            }
        }

        return indicators;
    }

    async calculateIndicator(name, marketData, parameters) {
        const prices = marketData.prices || [marketData.price];
        
        switch (name) {
            case 'RSI':
                return this.calculateRSI(prices, parameters.rsiPeriod || 14);
            
            case 'BollingerBands':
                return this.calculateBollingerBands(prices, parameters.bollingerPeriod || 20, parameters.standardDeviations || 2);
            
            case 'MACD':
                return this.calculateMACD(prices);
            
            case 'Volume':
                return marketData.volume || 0;
            
            case 'ATR':
                return this.calculateATR(prices);
            
            case 'Support':
                return this.findSupportLevel(prices);
            
            case 'Resistance':
                return this.findResistanceLevel(prices);
            
            case 'AI_Prediction':
                return await this.getAIPrediction(marketData);
            
            case 'Pattern_Score':
                return await this.getPatternScore(marketData);
            
            case 'Market_State':
                return await this.getMarketState();
            
            default:
                return marketData.price;
        }
    }

    async getAIPrediction(marketData) {
        const aiEngine = this.getComponent('aiEngine');
        if (!aiEngine) return { direction: 'neutral', confidence: 0.5 };

        return await aiEngine.predictTradeDirection(marketData);
    }

    async getPatternScore(marketData) {
        // Get pattern recognition score from AI engine
        const aiEngine = this.getComponent('aiEngine');
        if (!aiEngine) return 0.5;

        // Simplified pattern scoring
        return Math.random() * 0.4 + 0.3; // 0.3 to 0.7
    }

    async getMarketState() {
        // Get current market state analysis
        return {
            trend: 'neutral',
            volatility: 'medium',
            momentum: 'neutral'
        };
    }

    async evaluateEntryConditions(strategy, indicators, marketData) {
        try {
            // Evaluate rules based on strategy type
            let signal = null;

            switch (strategy.type) {
                case 'momentum':
                    signal = this.evaluateMomentumRules(strategy, indicators, marketData);
                    break;
                
                case 'reversal':
                    signal = this.evaluateReversalRules(strategy, indicators, marketData);
                    break;
                
                case 'breakout':
                    signal = this.evaluateBreakoutRules(strategy, indicators, marketData);
                    break;
                
                case 'custom':
                    signal = this.evaluateBoundaryBreakerRules(strategy, indicators, marketData);
                    break;
                
                case 'ai':
                    signal = this.evaluateAIRules(strategy, indicators, marketData);
                    break;
                
                default:
                    signal = null;
            }

            if (signal) {
                signal.strategy = strategy.name;
                signal.strategyId = strategy.id;
                signal.timestamp = new Date();
            }

            return signal;

        } catch (error) {
            console.error(`❌ Error evaluating entry conditions for ${strategy.name}:`, error);
            return null;
        }
    }

    evaluateMomentumRules(strategy, indicators, marketData) {
        const rsi = indicators.RSI;
        const price = marketData.price;
        const momentum = this.calculateMomentum(marketData.prices || [price]);

        if (rsi < strategy.parameters.oversold && momentum > 0) {
            return {
                direction: 'call',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        if (rsi > strategy.parameters.overbought && momentum < 0) {
            return {
                direction: 'put',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        return null;
    }

    evaluateReversalRules(strategy, indicators, marketData) {
        const bollinger = indicators.BollingerBands;
        const rsi = indicators.RSI;
        const price = marketData.price;

        if (!bollinger) return null;

        if (price < bollinger.lower && rsi < 30) {
            return {
                direction: 'call',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        if (price > bollinger.upper && rsi > 70) {
            return {
                direction: 'put',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        return null;
    }

    evaluateBreakoutRules(strategy, indicators, marketData) {
        const volume = indicators.Volume;
        const price = marketData.price;
        const support = indicators.Support;
        const resistance = indicators.Resistance;

        if (!support || !resistance) return null;

        const volumeThreshold = strategy.parameters.volumeThreshold || 1.5;

        if (price > resistance && volume > volumeThreshold) {
            return {
                direction: 'call',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        if (price < support && volume > volumeThreshold) {
            return {
                direction: 'put',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        return null;
    }

    evaluateBoundaryBreakerRules(strategy, indicators, marketData) {
        const price = marketData.price;
        const volume = indicators.Volume;
        const rsi = indicators.RSI;
        const momentum = this.calculateMomentum(marketData.prices || [price]);
        const support = indicators.Support;
        const resistance = indicators.Resistance;

        if (!support || !resistance) return null;

        // Boundary Breaker logic
        const nearResistance = Math.abs(price - resistance) / resistance < 0.001;
        const nearSupport = Math.abs(price - support) / support < 0.001;

        if (nearResistance && momentum > 0 && rsi > 40 && rsi < 60) {
            return {
                direction: 'call',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        if (nearSupport && momentum < 0 && rsi > 40 && rsi < 60) {
            return {
                direction: 'put',
                asset: marketData.asset,
                confidence: strategy.confidence,
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        return null;
    }

    evaluateAIRules(strategy, indicators, marketData) {
        const aiPrediction = indicators.AI_Prediction;
        const patternScore = indicators.Pattern_Score;

        if (!aiPrediction) return null;

        const confidenceThreshold = strategy.parameters.confidenceThreshold;

        if (aiPrediction.confidence >= confidenceThreshold && patternScore > 0.6) {
            return {
                direction: aiPrediction.direction,
                asset: marketData.asset,
                confidence: Math.min(aiPrediction.confidence, strategy.confidence),
                amount: this.calculateTradeAmount(strategy),
                duration: strategy.parameters.timeframe
            };
        }

        return null;
    }

    calculateTradeAmount(strategy) {
        // Calculate trade amount based on strategy performance and risk
        const baseAmount = parseFloat(process.env.MIN_TRADE_SIZE_DERIV) || 0.35;
        const maxAmount = parseFloat(process.env.MAX_TRADE_SIZE) || 50;
        
        let amount = baseAmount;

        // Adjust based on strategy performance
        if (strategy.performance.winRate > 0.7) {
            amount *= 2;
        } else if (strategy.performance.winRate < 0.4) {
            amount = baseAmount;
        }

        // Ensure within limits
        return Math.min(Math.max(amount, baseAmount), maxAmount);
    }

    async emitTradeSignal(signal) {
        console.log(`📊 Trade signal generated: ${signal.direction} ${signal.asset} (${signal.strategy})`);
        
        // Validate signal through risk manager
        const riskManager = this.getComponent('riskManager');
        if (riskManager) {
            const riskAssessment = await riskManager.assessSignalRisk(signal);
            if (!riskAssessment.approved) {
                console.log(`🛡️ Signal rejected by risk manager: ${riskAssessment.reason}`);
                return;
            }
        }

        // Emit signal for execution
        this.emit('trade_signal', signal);
    }

    // ================================
    // PERFORMANCE TRACKING
    // ================================
    async updateStrategyPerformance(trade) {
        const strategy = this.strategies.get(trade.strategyId);
        if (!strategy) return;

        console.log(`📈 Updating performance for strategy: ${strategy.name}`);

        const performance = strategy.performance;
        performance.totalTrades++;

        if (trade.result === 'win') {
            performance.winningTrades++;
        } else {
            performance.losingTrades++;
        }

        performance.winRate = performance.winningTrades / performance.totalTrades;
        performance.totalProfit += trade.profit || 0;
        performance.averageProfit = performance.totalProfit / performance.totalTrades;

        // Add to recent trades
        performance.recentTrades.push({
            id: trade.id,
            result: trade.result,
            profit: trade.profit,
            timestamp: new Date()
        });

        // Keep only last 100 trades
        if (performance.recentTrades.length > 100) {
            performance.recentTrades.shift();
        }

        // Calculate additional metrics
        this.calculateAdvancedMetrics(strategy);

        // Check for strategy retirement
        await this.evaluateStrategyRetirement(strategy);

        // Update last modified
        strategy.lastModified = new Date();

        this.emit('strategy_performance_update', {
            strategyId: strategy.id,
            name: strategy.name,
            performance: performance
        });
    }

    calculateAdvancedMetrics(strategy) {
        const recentTrades = strategy.performance.recentTrades;
        if (recentTrades.length < 10) return;

        // Calculate max drawdown
        let peak = 0;
        let maxDrawdown = 0;
        let runningProfit = 0;

        for (const trade of recentTrades) {
            runningProfit += trade.profit;
            if (runningProfit > peak) {
                peak = runningProfit;
            }
            const drawdown = peak - runningProfit;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        strategy.performance.maxDrawdown = maxDrawdown;

        // Calculate profit factor
        const wins = recentTrades.filter(t => t.profit > 0);
        const losses = recentTrades.filter(t => t.profit < 0);
        
        const totalWins = wins.reduce((sum, t) => sum + t.profit, 0);
        const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
        
        strategy.performance.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    }

    async evaluateStrategyRetirement(strategy) {
        const performance = strategy.performance;
        
        // Retirement conditions
        const shouldRetire = 
            performance.totalTrades >= this.config.performanceWindow &&
            performance.winRate < this.config.retirementThreshold;

        if (shouldRetire) {
            await this.retireStrategy(strategy.id);
        }
    }

    async retireStrategy(strategyId) {
        const strategy = this.strategies.get(strategyId);
        if (!strategy) return;

        console.log(`🏁 Retiring strategy: ${strategy.name}`);

        strategy.status = 'retired';
        strategy.retiredAt = new Date();
        
        this.activeStrategies.delete(strategyId);
        this.stats.activeStrategies--;
        this.stats.retiredStrategies++;

        this.emit('strategy_retired', {
            strategyId: strategyId,
            name: strategy.name,
            performance: strategy.performance
        });

        // Trigger evolution to replace retired strategy
        if (this.config.evolutionEnabled && this.activeStrategies.size < this.config.maxActiveStrategies) {
            await this.evolveNewStrategy();
        }
    }

    // ================================
    // STRATEGY EVOLUTION
    // ================================
    startEvolutionCycles() {
        console.log('🧬 Starting strategy evolution cycles...');
        
        setInterval(async () => {
            await this.runEvolutionCycle();
        }, this.config.evolutionInterval);
    }

    async runEvolutionCycle() {
        console.log('🧬 Running strategy evolution cycle...');
        
        try {
            // Find best performing strategies
            const topStrategies = this.getTopPerformingStrategies(2);
            
            if (topStrategies.length >= 2) {
                // Create hybrid strategy
                await this.createHybridStrategy(topStrategies[0], topStrategies[1]);
            }
            
            // Mutate existing strategies
            for (const strategy of this.getRandomStrategies(2)) {
                await this.mutateStrategy(strategy);
            }
            
            this.stats.evolutionCycles++;
            
            this.emit('evolution_cycle_complete', {
                cycle: this.stats.evolutionCycles,
                activeStrategies: this.activeStrategies.size,
                topPerformer: topStrategies[0]?.name
            });
            
        } catch (error) {
            console.error('❌ Error in evolution cycle:', error);
        }
    }

    getTopPerformingStrategies(count) {
        return Array.from(this.activeStrategies)
            .map(id => this.strategies.get(id))
            .filter(strategy => strategy && strategy.performance.totalTrades >= 20)
            .sort((a, b) => {
                // Sort by win rate and profit factor
                const scoreA = a.performance.winRate * a.performance.profitFactor;
                const scoreB = b.performance.winRate * b.performance.profitFactor;
                return scoreB - scoreA;
            })
            .slice(0, count);
    }

    getRandomStrategies(count) {
        const activeStrategies = Array.from(this.activeStrategies)
            .map(id => this.strategies.get(id))
            .filter(strategy => strategy);
        
        const shuffled = activeStrategies.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    async createHybridStrategy(parent1, parent2) {
        console.log(`🧬 Creating hybrid strategy from ${parent1.name} and ${parent2.name}`);
        
        const hybridConfig = {
            name: `Hybrid_${parent1.name.split('_')[0]}_${parent2.name.split('_')[0]}_${Date.now()}`,
            type: 'hybrid',
            description: `Hybrid of ${parent1.name} and ${parent2.name}`,
            parameters: this.mergeParameters(parent1.parameters, parent2.parameters),
            indicators: [...new Set([...parent1.indicators, ...parent2.indicators])],
            rules: this.mergeRules(parent1.rules, parent2.rules),
            confidence: (parent1.confidence + parent2.confidence) / 2
        };

        const hybridStrategy = this.createStrategy(hybridConfig);
        hybridStrategy.evolution.parentStrategy = [parent1.id, parent2.id];
        hybridStrategy.evolution.generation = Math.max(parent1.evolution.generation, parent2.evolution.generation) + 1;

        console.log(`✅ Hybrid strategy created: ${hybridStrategy.name}`);
        
        this.emit('strategy_evolved', {
            type: 'hybrid',
            strategyName: hybridStrategy.name,
            parents: [parent1.name, parent2.name],
            generation: hybridStrategy.evolution.generation
        });

        return hybridStrategy;
    }

    mergeParameters(params1, params2) {
        const merged = {};
        
        // Take average of numeric parameters
        const allKeys = new Set([...Object.keys(params1), ...Object.keys(params2)]);
        
        for (const key of allKeys) {
            const val1 = params1[key];
            const val2 = params2[key];
            
            if (typeof val1 === 'number' && typeof val2 === 'number') {
                merged[key] = (val1 + val2) / 2;
            } else {
                merged[key] = val1 || val2;
            }
        }
        
        return merged;
    }

    mergeRules(rules1, rules2) {
        // Combine entry and exit rules
        return {
            entry: {
                call: `(${rules1.entry.call}) OR (${rules2.entry.call})`,
                put: `(${rules1.entry.put}) OR (${rules2.entry.put})`
            },
            exit: {
                profitTarget: (rules1.exit.profitTarget + rules2.exit.profitTarget) / 2,
                stopLoss: (rules1.exit.stopLoss + rules2.exit.stopLoss) / 2
            }
        };
    }

    async mutateStrategy(strategy) {
        console.log(`🧬 Mutating strategy: ${strategy.name}`);
        
        const mutatedConfig = {
            ...strategy,
            name: `${strategy.name}_M${strategy.evolution.mutations + 1}`,
            parameters: this.mutateParameters(strategy.parameters),
            confidence: this.mutateConfidence(strategy.confidence)
        };

        const mutatedStrategy = this.createStrategy(mutatedConfig);
        mutatedStrategy.evolution.parentStrategy = strategy.id;
        mutatedStrategy.evolution.generation = strategy.evolution.generation + 1;
        mutatedStrategy.evolution.mutations = strategy.evolution.mutations + 1;

        console.log(`✅ Strategy mutated: ${mutatedStrategy.name}`);
        
        this.emit('strategy_evolved', {
            type: 'mutation',
            strategyName: mutatedStrategy.name,
            parent: strategy.name,
            generation: mutatedStrategy.evolution.generation
        });

        return mutatedStrategy;
    }

    mutateParameters(params) {
        const mutated = { ...params };
        
        // Randomly mutate some parameters
        for (const [key, value] of Object.entries(mutated)) {
            if (typeof value === 'number' && Math.random() < 0.3) {
                const mutationFactor = 0.9 + (Math.random() * 0.2); // ±10%
                mutated[key] = value * mutationFactor;
            }
        }
        
        return mutated;
    }

    mutateConfidence(confidence) {
        const mutation = (Math.random() - 0.5) * 0.1; // ±5%
        return Math.max(0.5, Math.min(1.0, confidence + mutation));
    }

    async evolveNewStrategy() {
        const bestStrategy = this.getTopPerformingStrategies(1)[0];
        if (bestStrategy) {
            await this.mutateStrategy(bestStrategy);
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        const gains = changes.filter(c => c > 0).slice(-period);
        const losses = changes.filter(c => c < 0).map(c => Math.abs(c)).slice(-period);
        
        const avgGain = gains.reduce((sum, g) => sum + g, 0) / period;
        const avgLoss = losses.reduce((sum, l) => sum + l, 0) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;
        
        const recentPrices = prices.slice(-period);
        const sma = recentPrices.reduce((sum, p) => sum + p, 0) / period;
        const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    calculateMACD(prices) {
        // Simplified MACD calculation
        if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
        
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = ema12 - ema26;
        
        return { macd, signal: 0, histogram: 0 };
    }

    calculateEMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1];
        
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    calculateATR(prices, period = 14) {
        // Simplified ATR calculation
        if (prices.length < period + 1) return 0;
        
        const trueRanges = [];
        for (let i = 1; i < prices.length; i++) {
            const high = Math.max(prices[i], prices[i - 1]);
            const low = Math.min(prices[i], prices[i - 1]);
            trueRanges.push(high - low);
        }
        
        const recentTR = trueRanges.slice(-period);
        return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
    }

    calculateMomentum(prices) {
        if (prices.length < 10) return 0;
        
        const current = prices[prices.length - 1];
        const past = prices[prices.length - 10];
        
        return (current - past) / past;
    }

    findSupportLevel(prices) {
        return Math.min(...prices.slice(-50));
    }

    findResistanceLevel(prices) {
        return Math.max(...prices.slice(-50));
    }

    generateStrategyId() {
        return `STRAT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ================================
    // PERSISTENCE & MONITORING
    // ================================
    async loadStrategies() {
        try {
            const strategiesPath = path.join(process.cwd(), 'data', 'strategies.json');
            
            try {
                const strategiesData = await fs.readFile(strategiesPath, 'utf8');
                const savedStrategies = JSON.parse(strategiesData);
                
                for (const strategyData of savedStrategies) {
                    this.strategies.set(strategyData.id, strategyData);
                    
                    if (strategyData.status === 'active') {
                        this.activeStrategies.add(strategyData.id);
                    }
                }
                
                console.log(`✅ Loaded ${savedStrategies.length} strategies from disk`);
                
            } catch (loadError) {
                console.log('📝 No existing strategies found, using defaults');
            }
            
        } catch (error) {
            console.error('❌ Error loading strategies:', error);
        }
    }

    async saveStrategies() {
        try {
            const strategiesArray = Array.from(this.strategies.values());
            const strategiesPath = path.join(process.cwd(), 'data', 'strategies.json');
            
            await fs.writeFile(strategiesPath, JSON.stringify(strategiesArray, null, 2));
            console.log('💾 Strategies saved successfully');
            
        } catch (error) {
            console.error('❌ Error saving strategies:', error);
        }
    }

    startStrategyMonitoring() {
        console.log('📊 Starting strategy monitoring...');
        
        setInterval(async () => {
            await this.evaluateStrategyPerformance();
        }, this.config.evaluationInterval);
        
        // Save strategies periodically
        setInterval(async () => {
            await this.saveStrategies();
        }, 600000); // Every 10 minutes
    }

    async evaluateStrategyPerformance() {
        // Update best performing strategy
        const topStrategies = this.getTopPerformingStrategies(1);
        if (topStrategies.length > 0) {
            this.stats.bestPerformingStrategy = topStrategies[0].name;
        }
        
        // Calculate average performance
        const activeStrategies = Array.from(this.activeStrategies)
            .map(id => this.strategies.get(id))
            .filter(s => s && s.performance.totalTrades > 0);
        
        if (activeStrategies.length > 0) {
            this.stats.averagePerformance = activeStrategies
                .reduce((sum, s) => sum + s.performance.winRate, 0) / activeStrategies.length;
        }
        
        this.stats.activeStrategies = this.activeStrategies.size;
    }

    // ================================
    // API METHODS
    // ================================
    getActiveStrategiesCount() {
        return this.activeStrategies.size;
    }

    getBestPerformingStrategy() {
        const topStrategies = this.getTopPerformingStrategies(1);
        return topStrategies.length > 0 ? topStrategies[0] : null;
    }

    getStrategyPerformance(strategyId) {
        const strategy = this.strategies.get(strategyId);
        return strategy ? strategy.performance : null;
    }

    getAllStrategies() {
        return Array.from(this.strategies.values());
    }

    async processSignal(signal) {
        // Process incoming signals (from AI or other sources)
        console.log(`📊 Processing signal: ${signal.direction} ${signal.asset}`);
        
        // Add signal to queue for execution
        const core = this.getComponent('core');
        if (core) {
            core.queueTradeSignal(signal);
        }
    }

    updateMarketData(marketData) {
        // Update market data for strategy evaluation
        this.currentMarketData = marketData;
    }

    handleNewPattern(pattern) {
        // Handle new patterns detected by AI
        console.log(`🧠 New pattern detected: Confidence ${pattern.confidence}`);
        
        // Could trigger strategy parameter adjustments
        if (pattern.confidence > 0.8) {
            // High confidence pattern - consider strategy adaptation
            this.adaptStrategiesToPattern(pattern);
        }
    }

    async adaptStrategiesToPattern(pattern) {
        // Adapt existing strategies to new patterns
        console.log('🔄 Adapting strategies to new pattern...');
        
        // This would modify strategy parameters based on successful patterns
        // Implementation would depend on pattern structure
    }

    healthCheck() {
        return {
            status: this.isExecuting ? 'executing' : 'stopped',
            activeStrategies: this.activeStrategies.size,
            totalStrategies: this.strategies.size,
            retiredStrategies: this.stats.retiredStrategies,
            evolutionCycles: this.stats.evolutionCycles,
            bestPerformer: this.stats.bestPerformingStrategy,
            averagePerformance: this.stats.averagePerformance
        };
    }

    async start() {
        console.log('▶️ Starting Strategy Manager...');
        await this.startExecution();
    }

    async stop() {
        console.log('⏹️ Stopping Strategy Manager...');
        await this.stopExecution();
        await this.saveStrategies();
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

module.exports = StrategyManager;
