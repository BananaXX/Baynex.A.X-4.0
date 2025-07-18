// ================================
// BAYNEX.A.X DATA PROCESSOR
// Real-Time Market Data Pipeline & Analysis
// ================================

const EventEmitter = require('events');

class DataProcessor extends EventEmitter {
    constructor() {
        super();
        this.dependencies = ['platforms', 'database'];
        this.isProcessing = false;
        
        // Data storage
        this.marketData = new Map();
        this.processedData = new Map();
        this.indicators = new Map();
        
        // Processing configuration
        this.config = {
            maxHistoryLength: 1000,
            processingInterval: 1000, // 1 second
            indicatorUpdateInterval: 5000, // 5 seconds
            saveInterval: 60000, // 1 minute
            cleanupInterval: 3600000, // 1 hour
            supportedAssets: [
                'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
                'BOOM500', 'BOOM1000', 'CRASH500', 'CRASH1000',
                'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'
            ]
        };
        
        // Statistics
        this.stats = {
            totalDataPoints: 0,
            processedDataPoints: 0,
            indicatorsCalculated: 0,
            lastProcessingTime: null,
            processingErrors: 0
        };
        
        // Technical indicators calculator
        this.technicalIndicators = new TechnicalIndicators();
        
        // Data validator
        this.validator = new DataValidator();
    }

    async initialize() {
        console.log('📊 Initializing Data Processor...');
        
        try {
            // Initialize data structures
            this.initializeDataStructures();
            
            // Load historical data
            await this.loadHistoricalData();
            
            // Set up data processing pipeline
            this.setupProcessingPipeline();
            
            console.log('✅ Data Processor initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Data Processor initialization failed:', error);
            throw error;
        }
    }

    initializeDataStructures() {
        console.log('🏗️ Initializing data structures...');
        
        for (const asset of this.config.supportedAssets) {
            this.marketData.set(asset, {
                asset: asset,
                rawData: [],
                ohlc: [],
                volume: [],
                timestamps: [],
                lastUpdate: null,
                isActive: false
            });
            
            this.processedData.set(asset, {
                asset: asset,
                trends: [],
                patterns: [],
                signals: [],
                volatility: [],
                momentum: []
            });
            
            this.indicators.set(asset, {
                asset: asset,
                sma: { 5: [], 10: [], 20: [], 50: [] },
                ema: { 12: [], 26: [] },
                rsi: { 14: [] },
                macd: { line: [], signal: [], histogram: [] },
                bollinger: { upper: [], middle: [], lower: [] },
                atr: { 14: [] },
                stochastic: { k: [], d: [] },
                support: [],
                resistance: []
            });
        }
        
        console.log(`✅ Data structures initialized for ${this.config.supportedAssets.length} assets`);
    }

    async loadHistoricalData() {
        console.log('📈 Loading historical market data...');
        
        try {
            const database = this.getComponent('database');
            if (!database) return;
            
            for (const asset of this.config.supportedAssets) {
                const historicalData = await database.getHistoricalData(asset);
                
                if (historicalData && historicalData.length > 0) {
                    const assetData = this.marketData.get(asset);
                    assetData.rawData = historicalData.slice(-this.config.maxHistoryLength);
                    assetData.lastUpdate = new Date();
                    
                    // Process historical data
                    await this.processHistoricalData(asset);
                    
                    console.log(`📊 Loaded ${historicalData.length} historical points for ${asset}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading historical data:', error);
        }
    }

    async processHistoricalData(asset) {
        const assetData = this.marketData.get(asset);
        
        if (assetData.rawData.length > 0) {
            // Calculate all indicators for historical data
            await this.calculateAllIndicators(asset);
            
            // Process patterns and trends
            await this.analyzePatterns(asset);
            
            console.log(`✅ Historical data processed for ${asset}`);
        }
    }

    setupProcessingPipeline() {
        console.log('⚙️ Setting up data processing pipeline...');
        
        // Main processing loop
        setInterval(() => {
            this.processRealtimeData();
        }, this.config.processingInterval);
        
        // Indicator calculation loop
        setInterval(() => {
            this.updateAllIndicators();
        }, this.config.indicatorUpdateInterval);
        
        // Data persistence loop
        setInterval(() => {
            this.saveProcessedData();
        }, this.config.saveInterval);
        
        // Cleanup old data
        setInterval(() => {
            this.cleanupOldData();
        }, this.config.cleanupInterval);
        
        console.log('✅ Processing pipeline established');
    }

    // ================================
    // REAL-TIME DATA PROCESSING
    // ================================
    async startMonitoring() {
        if (this.isProcessing) return;
        
        console.log('▶️ Starting real-time data monitoring...');
        this.isProcessing = true;
        
        // Subscribe to platform data feeds
        const platforms = this.getComponent('platforms');
        if (platforms) {
            platforms.on('market_data', this.handleMarketData.bind(this));
        }
        
        console.log('✅ Real-time monitoring active');
    }

    async stopMonitoring() {
        console.log('⏹️ Stopping data monitoring...');
        this.isProcessing = false;
    }

    handleMarketData(data) {
        if (!this.isProcessing) return;
        
        try {
            const { asset, price, timestamp, volume, bid, ask } = data;
            
            // Validate incoming data
            if (!this.validator.validateMarketData(data)) {
                this.stats.processingErrors++;
                return;
            }
            
            // Store raw data
            this.storeRawData(asset, {
                price: price,
                bid: bid || price,
                ask: ask || price,
                volume: volume || 0,
                timestamp: timestamp || new Date(),
                spread: ask && bid ? ask - bid : 0
            });
            
            this.stats.totalDataPoints++;
            
        } catch (error) {
            console.error('❌ Error handling market data:', error);
            this.stats.processingErrors++;
        }
    }

    storeRawData(asset, dataPoint) {
        const assetData = this.marketData.get(asset);
        if (!assetData) return;
        
        // Add to raw data
        assetData.rawData.push(dataPoint);
        assetData.lastUpdate = new Date();
        assetData.isActive = true;
        
        // Maintain size limit
        if (assetData.rawData.length > this.config.maxHistoryLength) {
            assetData.rawData.shift();
        }
        
        // Create OHLC data
        this.updateOHLC(asset, dataPoint);
        
        // Emit processed data
        this.emit('data_updated', {
            asset: asset,
            price: dataPoint.price,
            timestamp: dataPoint.timestamp
        });
    }

    updateOHLC(asset, dataPoint) {
        const assetData = this.marketData.get(asset);
        const currentMinute = Math.floor(dataPoint.timestamp.getTime() / 60000);
        
        // Get or create current minute OHLC
        let currentOHLC = assetData.ohlc[assetData.ohlc.length - 1];
        
        if (!currentOHLC || Math.floor(currentOHLC.timestamp.getTime() / 60000) !== currentMinute) {
            // New minute, create new OHLC
            currentOHLC = {
                timestamp: new Date(currentMinute * 60000),
                open: dataPoint.price,
                high: dataPoint.price,
                low: dataPoint.price,
                close: dataPoint.price,
                volume: dataPoint.volume
            };
            assetData.ohlc.push(currentOHLC);
        } else {
            // Update existing OHLC
            currentOHLC.high = Math.max(currentOHLC.high, dataPoint.price);
            currentOHLC.low = Math.min(currentOHLC.low, dataPoint.price);
            currentOHLC.close = dataPoint.price;
            currentOHLC.volume += dataPoint.volume;
        }
        
        // Maintain OHLC size limit
        if (assetData.ohlc.length > this.config.maxHistoryLength) {
            assetData.ohlc.shift();
        }
    }

    processRealtimeData() {
        if (!this.isProcessing) return;
        
        try {
            for (const asset of this.config.supportedAssets) {
                const assetData = this.marketData.get(asset);
                
                if (assetData.isActive && assetData.rawData.length > 0) {
                    // Process recent data
                    this.processAssetData(asset);
                    this.stats.processedDataPoints++;
                }
            }
            
            this.stats.lastProcessingTime = new Date();
            
        } catch (error) {
            console.error('❌ Error in real-time processing:', error);
            this.stats.processingErrors++;
        }
    }

    processAssetData(asset) {
        const assetData = this.marketData.get(asset);
        const processed = this.processedData.get(asset);
        
        if (assetData.rawData.length < 10) return;
        
        // Calculate trends
        const trend = this.calculateTrend(assetData.rawData);
        processed.trends.push({
            value: trend,
            timestamp: new Date()
        });
        
        // Calculate volatility
        const volatility = this.calculateVolatility(assetData.rawData);
        processed.volatility.push({
            value: volatility,
            timestamp: new Date()
        });
        
        // Calculate momentum
        const momentum = this.calculateMomentum(assetData.rawData);
        processed.momentum.push({
            value: momentum,
            timestamp: new Date()
        });
        
        // Maintain processed data size
        this.maintainDataSize(processed);
        
        // Emit analysis results
        this.emit('data_analysis', {
            asset: asset,
            trend: trend,
            volatility: volatility,
            momentum: momentum,
            timestamp: new Date()
        });
    }

    // ================================
    // TECHNICAL INDICATORS
    // ================================
    updateAllIndicators() {
        for (const asset of this.config.supportedAssets) {
            const assetData = this.marketData.get(asset);
            
            if (assetData.isActive && assetData.rawData.length >= 50) {
                this.calculateAllIndicators(asset);
            }
        }
    }

    async calculateAllIndicators(asset) {
        try {
            const assetData = this.marketData.get(asset);
            const indicators = this.indicators.get(asset);
            const prices = assetData.rawData.map(d => d.price);
            const highs = assetData.ohlc.map(d => d.high);
            const lows = assetData.ohlc.map(d => d.low);
            const closes = assetData.ohlc.map(d => d.close);
            const volumes = assetData.ohlc.map(d => d.volume);
            
            // Moving Averages
            indicators.sma[5] = this.technicalIndicators.sma(prices, 5);
            indicators.sma[10] = this.technicalIndicators.sma(prices, 10);
            indicators.sma[20] = this.technicalIndicators.sma(prices, 20);
            indicators.sma[50] = this.technicalIndicators.sma(prices, 50);
            
            // Exponential Moving Averages
            indicators.ema[12] = this.technicalIndicators.ema(prices, 12);
            indicators.ema[26] = this.technicalIndicators.ema(prices, 26);
            
            // RSI
            indicators.rsi[14] = this.technicalIndicators.rsi(prices, 14);
            
            // MACD
            const macd = this.technicalIndicators.macd(prices);
            indicators.macd.line = macd.line;
            indicators.macd.signal = macd.signal;
            indicators.macd.histogram = macd.histogram;
            
            // Bollinger Bands
            const bollinger = this.technicalIndicators.bollingerBands(prices, 20, 2);
            indicators.bollinger.upper = bollinger.upper;
            indicators.bollinger.middle = bollinger.middle;
            indicators.bollinger.lower = bollinger.lower;
            
            // ATR
            if (highs.length >= 14) {
                indicators.atr[14] = this.technicalIndicators.atr(highs, lows, closes, 14);
            }
            
            // Stochastic
            if (highs.length >= 14) {
                const stochastic = this.technicalIndicators.stochastic(highs, lows, closes, 14, 3);
                indicators.stochastic.k = stochastic.k;
                indicators.stochastic.d = stochastic.d;
            }
            
            // Support and Resistance
            indicators.support = this.technicalIndicators.findSupport(lows);
            indicators.resistance = this.technicalIndicators.findResistance(highs);
            
            this.stats.indicatorsCalculated++;
            
            // Emit indicator update
            this.emit('indicators_updated', {
                asset: asset,
                indicators: indicators,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error(`❌ Error calculating indicators for ${asset}:`, error);
        }
    }

    // ================================
    // PATTERN ANALYSIS
    // ================================
    async analyzePatterns(asset) {
        const assetData = this.marketData.get(asset);
        const processed = this.processedData.get(asset);
        const prices = assetData.rawData.map(d => d.price);
        
        if (prices.length < 50) return;
        
        // Detect chart patterns
        const patterns = [
            this.detectDoubleTop(prices),
            this.detectDoubleBottom(prices),
            this.detectHeadAndShoulders(prices),
            this.detectTriangle(prices),
            this.detectFlag(prices),
            this.detectWedge(prices)
        ].filter(pattern => pattern !== null);
        
        for (const pattern of patterns) {
            processed.patterns.push({
                ...pattern,
                timestamp: new Date(),
                asset: asset
            });
            
            // Emit pattern detection
            this.emit('pattern_detected', {
                asset: asset,
                pattern: pattern,
                timestamp: new Date()
            });
        }
        
        // Maintain pattern history
        if (processed.patterns.length > 100) {
            processed.patterns = processed.patterns.slice(-100);
        }
    }

    detectDoubleTop(prices) {
        // Simplified double top detection
        if (prices.length < 50) return null;
        
        const recent = prices.slice(-50);
        const peaks = this.findPeaks(recent);
        
        if (peaks.length >= 2) {
            const lastTwo = peaks.slice(-2);
            const heightDiff = Math.abs(lastTwo[1].value - lastTwo[0].value) / lastTwo[0].value;
            
            if (heightDiff < 0.02) { // Within 2%
                return {
                    type: 'double_top',
                    confidence: 0.7,
                    level: (lastTwo[0].value + lastTwo[1].value) / 2,
                    signal: 'bearish'
                };
            }
        }
        
        return null;
    }

    detectDoubleBottom(prices) {
        // Simplified double bottom detection
        if (prices.length < 50) return null;
        
        const recent = prices.slice(-50);
        const troughs = this.findTroughs(recent);
        
        if (troughs.length >= 2) {
            const lastTwo = troughs.slice(-2);
            const heightDiff = Math.abs(lastTwo[1].value - lastTwo[0].value) / lastTwo[0].value;
            
            if (heightDiff < 0.02) { // Within 2%
                return {
                    type: 'double_bottom',
                    confidence: 0.7,
                    level: (lastTwo[0].value + lastTwo[1].value) / 2,
                    signal: 'bullish'
                };
            }
        }
        
        return null;
    }

    detectHeadAndShoulders(prices) {
        // Simplified head and shoulders detection
        if (prices.length < 30) return null;
        
        const recent = prices.slice(-30);
        const peaks = this.findPeaks(recent);
        
        if (peaks.length >= 3) {
            const lastThree = peaks.slice(-3);
            
            // Check for head and shoulders pattern
            const [leftShoulder, head, rightShoulder] = lastThree;
            
            if (head.value > leftShoulder.value && head.value > rightShoulder.value) {
                const shoulderDiff = Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value;
                
                if (shoulderDiff < 0.03) { // Shoulders within 3%
                    return {
                        type: 'head_and_shoulders',
                        confidence: 0.8,
                        neckline: (leftShoulder.value + rightShoulder.value) / 2,
                        signal: 'bearish'
                    };
                }
            }
        }
        
        return null;
    }

    detectTriangle(prices) {
        // Simplified triangle pattern detection
        if (prices.length < 40) return null;
        
        const recent = prices.slice(-40);
        const highs = this.findPeaks(recent);
        const lows = this.findTroughs(recent);
        
        if (highs.length >= 3 && lows.length >= 3) {
            // Check for converging trend lines
            const highTrend = this.calculateTrendLine(highs.slice(-3));
            const lowTrend = this.calculateTrendLine(lows.slice(-3));
            
            if (Math.abs(highTrend.slope) > 0.001 && Math.abs(lowTrend.slope) > 0.001) {
                const convergence = highTrend.slope * lowTrend.slope < 0;
                
                if (convergence) {
                    return {
                        type: 'triangle',
                        confidence: 0.6,
                        direction: highTrend.slope < 0 ? 'descending' : 'ascending',
                        signal: 'breakout_pending'
                    };
                }
            }
        }
        
        return null;
    }

    detectFlag(prices) {
        // Simplified flag pattern detection
        return null; // Placeholder
    }

    detectWedge(prices) {
        // Simplified wedge pattern detection
        return null; // Placeholder
    }

    // ================================
    // CALCULATION UTILITIES
    // ================================
    calculateTrend(data) {
        if (data.length < 2) return 0;
        
        const recent = data.slice(-20);
        const prices = recent.map(d => d.price);
        
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        
        return (lastPrice - firstPrice) / firstPrice;
    }

    calculateVolatility(data) {
        if (data.length < 20) return 0;
        
        const recent = data.slice(-20);
        const prices = recent.map(d => d.price);
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push(Math.log(prices[i] / prices[i - 1]));
        }
        
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    calculateMomentum(data) {
        if (data.length < 10) return 0;
        
        const recent = data.slice(-10);
        const prices = recent.map(d => d.price);
        
        const current = prices[prices.length - 1];
        const past = prices[0];
        
        return (current - past) / past;
    }

    findPeaks(prices) {
        const peaks = [];
        const window = 5;
        
        for (let i = window; i < prices.length - window; i++) {
            let isPeak = true;
            
            for (let j = -window; j <= window; j++) {
                if (j !== 0 && prices[i + j] >= prices[i]) {
                    isPeak = false;
                    break;
                }
            }
            
            if (isPeak) {
                peaks.push({
                    index: i,
                    value: prices[i]
                });
            }
        }
        
        return peaks;
    }

    findTroughs(prices) {
        const troughs = [];
        const window = 5;
        
        for (let i = window; i < prices.length - window; i++) {
            let isTrough = true;
            
            for (let j = -window; j <= window; j++) {
                if (j !== 0 && prices[i + j] <= prices[i]) {
                    isTrough = false;
                    break;
                }
            }
            
            if (isTrough) {
                troughs.push({
                    index: i,
                    value: prices[i]
                });
            }
        }
        
        return troughs;
    }

    calculateTrendLine(points) {
        if (points.length < 2) return { slope: 0, intercept: 0 };
        
        const n = points.length;
        const sumX = points.reduce((sum, p) => sum + p.index, 0);
        const sumY = points.reduce((sum, p) => sum + p.value, 0);
        const sumXY = points.reduce((sum, p) => sum + p.index * p.value, 0);
        const sumXX = points.reduce((sum, p) => sum + p.index * p.index, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept };
    }

    // ================================
    // DATA MANAGEMENT
    // ================================
    maintainDataSize(processed) {
        const maxSize = this.config.maxHistoryLength;
        
        if (processed.trends.length > maxSize) {
            processed.trends = processed.trends.slice(-maxSize);
        }
        if (processed.volatility.length > maxSize) {
            processed.volatility = processed.volatility.slice(-maxSize);
        }
        if (processed.momentum.length > maxSize) {
            processed.momentum = processed.momentum.slice(-maxSize);
        }
    }

    async saveProcessedData() {
        try {
            const database = this.getComponent('database');
            if (!database) return;
            
            for (const asset of this.config.supportedAssets) {
                const assetData = this.marketData.get(asset);
                
                if (assetData.isActive && assetData.rawData.length > 0) {
                    // Save recent raw data
                    const recentData = assetData.rawData.slice(-100);
                    await database.saveMarketData(asset, recentData);
                    
                    // Save indicators
                    const indicators = this.indicators.get(asset);
                    await database.saveIndicators(asset, indicators);
                }
            }
            
        } catch (error) {
            console.error('❌ Error saving processed data:', error);
        }
    }

    cleanupOldData() {
        console.log('🧹 Cleaning up old data...');
        
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        
        for (const asset of this.config.supportedAssets) {
            const assetData = this.marketData.get(asset);
            
            // Remove old raw data
            assetData.rawData = assetData.rawData.filter(
                d => d.timestamp.getTime() > cutoffTime
            );
            
            // Remove old OHLC data
            assetData.ohlc = assetData.ohlc.filter(
                d => d.timestamp.getTime() > cutoffTime
            );
            
            // Check if asset is still active
            if (assetData.lastUpdate && Date.now() - assetData.lastUpdate.getTime() > 300000) {
                assetData.isActive = false;
            }
        }
    }

    // ================================
    // API METHODS
    // ================================
    async getCurrentMarketData() {
        const result = {};
        
        for (const asset of this.config.supportedAssets) {
            const assetData = this.marketData.get(asset);
            
            if (assetData.isActive && assetData.rawData.length > 0) {
                const latest = assetData.rawData[assetData.rawData.length - 1];
                const indicators = this.indicators.get(asset);
                const processed = this.processedData.get(asset);
                
                result[asset] = {
                    asset: asset,
                    price: latest.price,
                    bid: latest.bid,
                    ask: latest.ask,
                    volume: latest.volume,
                    timestamp: latest.timestamp,
                    spread: latest.spread,
                    prices: assetData.rawData.map(d => d.price),
                    recentPrices: assetData.rawData.slice(-50).map(d => d.price),
                    ohlc: assetData.ohlc.slice(-100),
                    indicators: indicators,
                    trend: processed.trends.length > 0 ? processed.trends[processed.trends.length - 1].value : 0,
                    volatility: processed.volatility.length > 0 ? processed.volatility[processed.volatility.length - 1].value : 0,
                    momentum: processed.momentum.length > 0 ? processed.momentum[processed.momentum.length - 1].value : 0
                };
            }
        }
        
        return result;
    }

    getAssetData(asset) {
        const assetData = this.marketData.get(asset);
        const indicators = this.indicators.get(asset);
        const processed = this.processedData.get(asset);
        
        if (!assetData || !assetData.isActive) return null;
        
        return {
            asset: asset,
            data: assetData,
            indicators: indicators,
            processed: processed,
            isActive: assetData.isActive
        };
    }

    getProcessingStats() {
        return {
            ...this.stats,
            activeAssets: Array.from(this.marketData.values()).filter(d => d.isActive).length,
            totalAssets: this.config.supportedAssets.length,
            isProcessing: this.isProcessing
        };
    }

    healthCheck() {
        const activeAssets = Array.from(this.marketData.values()).filter(d => d.isActive).length;
        
        return {
            status: this.isProcessing ? 'processing' : 'stopped',
            activeAssets: activeAssets,
            totalDataPoints: this.stats.totalDataPoints,
            processingErrors: this.stats.processingErrors,
            lastProcessing: this.stats.lastProcessingTime,
            errorRate: this.stats.totalDataPoints > 0 ? 
                (this.stats.processingErrors / this.stats.totalDataPoints * 100).toFixed(2) + '%' : '0%'
        };
    }

    async start() {
        console.log('▶️ Starting Data Processor...');
        await this.startMonitoring();
    }

    async stop() {
        console.log('⏹️ Stopping Data Processor...');
        await this.stopMonitoring();
        await this.saveProcessedData();
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

// ================================
// TECHNICAL INDICATORS CLASS
// ================================
class TechnicalIndicators {
    sma(prices, period) {
        const result = [];
        
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
        
        return result;
    }

    ema(prices, period) {
        const result = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA
        const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        result.push(firstSMA);
        
        for (let i = period; i < prices.length; i++) {
            const ema = (prices[i] * multiplier) + (result[result.length - 1] * (1 - multiplier));
            result.push(ema);
        }
        
        return result;
    }

    rsi(prices, period = 14) {
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        const result = [];
        
        for (let i = period - 1; i < changes.length; i++) {
            const gains = changes.slice(i - period + 1, i + 1).filter(change => change > 0);
            const losses = changes.slice(i - period + 1, i + 1).filter(change => change < 0);
            
            const avgGain = gains.reduce((a, b) => a + b, 0) / period;
            const avgLoss = Math.abs(losses.reduce((a, b) => a + b, 0)) / period;
            
            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
        
        return result;
    }

    macd(prices, fast = 12, slow = 26, signal = 9) {
        const emaFast = this.ema(prices, fast);
        const emaSlow = this.ema(prices, slow);
        
        const macdLine = [];
        const start = Math.max(emaFast.length, emaSlow.length) - Math.min(emaFast.length, emaSlow.length);
        
        for (let i = start; i < Math.min(emaFast.length, emaSlow.length); i++) {
            macdLine.push(emaFast[i] - emaSlow[i]);
        }
        
        const signalLine = this.ema(macdLine, signal);
        const histogram = [];
        
        const signalStart = macdLine.length - signalLine.length;
        for (let i = signalStart; i < macdLine.length; i++) {
            histogram.push(macdLine[i] - signalLine[i - signalStart]);
        }
        
        return {
            line: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }

    bollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.sma(prices, period);
        const upper = [];
        const middle = sma;
        const lower = [];
        
        for (let i = period - 1; i < prices.length; i++) {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
            const standardDeviation = Math.sqrt(variance);
            
            upper.push(mean + (standardDeviation * stdDev));
            lower.push(mean - (standardDeviation * stdDev));
        }
        
        return { upper, middle, lower };
    }

    atr(highs, lows, closes, period = 14) {
        const trueRanges = [];
        
        for (let i = 1; i < closes.length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevClose = closes[i - 1];
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        return this.sma(trueRanges, period);
    }

    stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
        const k = [];
        
        for (let i = kPeriod - 1; i < closes.length; i++) {
            const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
            const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
            const currentClose = closes[i];
            
            const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
            k.push(kValue);
        }
        
        const d = this.sma(k, dPeriod);
        
        return { k, d };
    }

    findSupport(lows) {
        if (lows.length < 50) return [];
        
        const recent = lows.slice(-50);
        const supports = [];
        
        // Find significant low points
        for (let i = 5; i < recent.length - 5; i++) {
            let isSupport = true;
            
            for (let j = -5; j <= 5; j++) {
                if (j !== 0 && recent[i + j] <= recent[i]) {
                    isSupport = false;
                    break;
                }
            }
            
            if (isSupport) {
                supports.push(recent[i]);
            }
        }
        
        return supports.slice(-5); // Return last 5 support levels
    }

    findResistance(highs) {
        if (highs.length < 50) return [];
        
        const recent = highs.slice(-50);
        const resistances = [];
        
        // Find significant high points
        for (let i = 5; i < recent.length - 5; i++) {
            let isResistance = true;
            
            for (let j = -5; j <= 5; j++) {
                if (j !== 0 && recent[i + j] >= recent[i]) {
                    isResistance = false;
                    break;
                }
            }
            
            if (isResistance) {
                resistances.push(recent[i]);
            }
        }
        
        return resistances.slice(-5); // Return last 5 resistance levels
    }
}

// ================================
// DATA VALIDATOR CLASS
// ================================
class DataValidator {
    validateMarketData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Required fields
        if (!data.asset || !data.price) return false;
        
        // Price validation
        if (typeof data.price !== 'number' || data.price <= 0) return false;
        
        // Timestamp validation
        if (data.timestamp && !(data.timestamp instanceof Date)) return false;
        
        // Volume validation
        if (data.volume !== undefined && (typeof data.volume !== 'number' || data.volume < 0)) return false;
        
        // Bid/Ask validation
        if (data.bid !== undefined && (typeof data.bid !== 'number' || data.bid <= 0)) return false;
        if (data.ask !== undefined && (typeof data.ask !== 'number' || data.ask <= 0)) return false;
        
        // Spread validation
        if (data.bid && data.ask && data.bid > data.ask) return false;
        
        return true;
    }
}

module.exports = DataProcessor;
