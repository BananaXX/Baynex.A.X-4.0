// ================================
// BAYNEX.A.X PLATFORM CONNECTORS
// Binary Autonomous Yield Navigation & Execution X-System
// ================================

const EventEmitter = require('events');
const DerivConnector = require('./DerivConnector');
const MT5Connector = require('./MT5Connector');
const IQConnector = require('./IQConnector');

class PlatformConnectors extends EventEmitter {
    constructor() {
        super();
        this.platforms = new Map();
        this.activePlatform = null;
        this.marketData = new Map();
        this.connectionAttempts = new Map();
        this.maxRetries = 3;
        this.dependencies = [];
        
        this.config = {
            priorityOrder: ['deriv', 'mt5', 'iq'],
            autoFailover: true,
            connectionTimeout: 30000,
            heartbeatInterval: 30000
        };
        
        this.stats = {
            totalConnections: 0,
            failedConnections: 0,
            reconnections: 0,
            totalTrades: 0,
            platformUptime: new Map()
        };
    }

    async initialize() {
        console.log('🔌 Initializing Platform Connectors...');
        
        try {
            // Initialize platform connectors
            await this.initializePlatforms();
            
            // Start connection monitoring
            this.startConnectionMonitoring();
            
            // Start market data collection
            this.startMarketDataCollection();
            
            console.log('✅ Platform Connectors initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Platform Connectors initialization failed:', error);
            throw error;
        }
    }

    async initializePlatforms() {
        console.log('⚙️ Setting up platform connections...');
        
        // Initialize Deriv platform
        if (process.env.DERIV_APP_ID && process.env.DERIV_API_TOKEN) {
            const derivPlatform = new DerivConnector({
                appId: process.env.DERIV_APP_ID,
                apiToken: process.env.DERIV_API_TOKEN,
                endpoint: process.env.DERIV_ENDPOINT || 'wss://ws.derivws.com/websockets/v3'
            });
            
            this.platforms.set('deriv', derivPlatform);
            console.log('📊 Deriv platform configured');
        }
        
        // Initialize MT5 platform
        if (process.env.MT5_LOGIN && process.env.MT5_PASSWORD && process.env.MT5_SERVER) {
            const mt5Platform = new MT5Connector({
                login: process.env.MT5_LOGIN,
                password: process.env.MT5_PASSWORD,
                server: process.env.MT5_SERVER,
                path: process.env.MT5_PATH
            });
            
            this.platforms.set('mt5', mt5Platform);
            console.log('📈 MT5 platform configured');
        }
        
        // Initialize IQ Option platform
        if (process.env.IQ_EMAIL && process.env.IQ_PASSWORD) {
            const iqPlatform = new IQConnector({
                email: process.env.IQ_EMAIL,
                password: process.env.IQ_PASSWORD,
                mode: process.env.IQ_MODE || 'real'
            });
            
            this.platforms.set('iq', iqPlatform);
            console.log('📱 IQ Option platform configured');
        }
        
        // Connect to platforms in priority order
        await this.connectPlatforms();
    }

    async connectPlatforms() {
        console.log('🔗 Connecting to trading platforms...');
        
        for (const platformName of this.config.priorityOrder) {
            const platform = this.platforms.get(platformName);
            if (platform) {
                try {
                    console.log(`🔌 Connecting to ${platformName.toUpperCase()}...`);
                    
                    const startTime = Date.now();
                    await platform.connect();
                    
                    const connectionTime = Date.now() - startTime;
                    this.stats.totalConnections++;
                    this.stats.platformUptime.set(platformName, startTime);
                    
                    console.log(`✅ ${platformName.toUpperCase()} connected in ${connectionTime}ms`);
                    
                    // Set as active platform if none set
                    if (!this.activePlatform) {
                        this.activePlatform = platformName;
                        console.log(`🎯 ${platformName.toUpperCase()} set as active platform`);
                    }
                    
                    // Set up platform event handlers
                    this.setupPlatformEvents(platformName, platform);
                    
                } catch (error) {
                    console.error(`❌ Failed to connect to ${platformName.toUpperCase()}:`, error.message);
                    this.stats.failedConnections++;
                    this.connectionAttempts.set(platformName, 
                        (this.connectionAttempts.get(platformName) || 0) + 1);
                }
            }
        }
        
        if (!this.activePlatform) {
            throw new Error('No trading platforms could be connected');
        }
    }

    setupPlatformEvents(platformName, platform) {
        // Forward platform events
        platform.on('connected', () => {
            this.emit('platform_connected', { platform: platformName });
        });
        
        platform.on('disconnected', () => {
            this.emit('platform_disconnected', { platform: platformName });
            this.handleDisconnection(platformName);
        });
        
        platform.on('error', (error) => {
            this.emit('platform_error', { platform: platformName, error });
            this.handlePlatformError(platformName, error);
        });
        
        platform.on('trade_executed', (trade) => {
            this.emit('trade_executed', { ...trade, platform: platformName });
        });
        
        platform.on('trade_closed', (trade) => {
            this.emit('trade_closed', { ...trade, platform: platformName });
        });
        
        platform.on('market_data', (data) => {
            this.handleMarketData(platformName, data);
        });
    }

    // ================================
    // TRADING OPERATIONS
    // ================================
    async executeTrade(params) {
        const { platform, asset, direction, amount, duration, strategy } = params;
        
        console.log(`🎯 Executing trade: ${direction} ${asset} on ${platform || this.activePlatform}`);
        
        try {
            // Determine which platform to use
            const targetPlatform = platform || this.activePlatform;
            const platformConnector = this.platforms.get(targetPlatform);
            
            if (!platformConnector) {
                throw new Error(`Platform ${targetPlatform} not available`);
            }
            
            if (!platformConnector.isConnected) {
                throw new Error(`Platform ${targetPlatform} not connected`);
            }
            
            // Validate trade parameters
            const validatedParams = await this.validateTradeParams(targetPlatform, params);
            
            // Execute trade on platform
            const result = await platformConnector.executeTrade(validatedParams);
            
            // Track trade statistics
            this.stats.totalTrades++;
            
            return {
                ...result,
                platform: targetPlatform,
                executedAt: new Date()
            };
            
        } catch (error) {
            console.error('❌ Trade execution failed:', error);
            
            // Try failover if enabled
            if (this.config.autoFailover && platform !== this.activePlatform) {
                return await this.executeTradeWithFailover(params);
            }
            
            throw error;
        }
    }

    async executeTradeWithFailover(params) {
        console.log('🔄 Attempting trade execution with failover...');
        
        for (const platformName of this.config.priorityOrder) {
            if (platformName === params.platform) continue; // Skip failed platform
            
            const platform = this.platforms.get(platformName);
            if (platform && platform.isConnected) {
                try {
                    return await this.executeTrade({ ...params, platform: platformName });
                } catch (error) {
                    console.error(`❌ Failover attempt failed on ${platformName}:`, error.message);
                }
            }
        }
        
        throw new Error('All platform failover attempts failed');
    }

    async validateTradeParams(platform, params) {
        const platformConnector = this.platforms.get(platform);
        
        // Get platform-specific limits
        const limits = await platformConnector.getTradingLimits(params.asset);
        
        // Validate amount
        let validAmount = params.amount;
        if (validAmount < limits.minAmount) {
            validAmount = limits.minAmount;
            console.log(`⚠️ Amount adjusted to minimum: ${validAmount}`);
        }
        if (validAmount > limits.maxAmount) {
            validAmount = limits.maxAmount;
            console.log(`⚠️ Amount adjusted to maximum: ${validAmount}`);
        }
        
        return {
            ...params,
            amount: validAmount,
            duration: params.duration || limits.defaultDuration
        };
    }

    // ================================
    // TRADE MONITORING
    // ================================
    async getTradeStatus(platform, contractId) {
        const platformConnector = this.platforms.get(platform);
        if (!platformConnector) {
            throw new Error(`Platform ${platform} not available`);
        }
        
        return await platformConnector.getTradeStatus(contractId);
    }

    async closeTradeManually(platform, contractId) {
        const platformConnector = this.platforms.get(platform);
        if (!platformConnector) {
            throw new Error(`Platform ${platform} not available`);
        }
        
        return await platformConnector.closeTrade(contractId);
    }

    async emergencyCloseTrade(platform, contractId) {
        const platformConnector = this.platforms.get(platform);
        if (!platformConnector) {
            console.error(`❌ Platform ${platform} not available for emergency close`);
            return;
        }
        
        try {
            return await platformConnector.emergencyCloseTrade(contractId);
        } catch (error) {
            console.error(`❌ Emergency close failed:`, error);
        }
    }

    // ================================
    // MARKET DATA MANAGEMENT
    // ================================
    startMarketDataCollection() {
        console.log('📊 Starting market data collection...');
        
        for (const [platformName, platform] of this.platforms) {
            if (platform.isConnected) {
                platform.startMarketDataStream();
            }
        }
    }

    handleMarketData(platform, data) {
        const { asset, price, timestamp } = data;
        
        if (!this.marketData.has(asset)) {
            this.marketData.set(asset, {
                platforms: new Map(),
                latestPrice: null,
                lastUpdate: null
            });
        }
        
        const assetData = this.marketData.get(asset);
        assetData.platforms.set(platform, { price, timestamp });
        assetData.latestPrice = price;
        assetData.lastUpdate = timestamp;
        
        // Emit consolidated market data
        this.emit('market_data', {
            asset,
            price,
            platform,
            timestamp
        });
    }

    getMarketData(asset) {
        return this.marketData.get(asset);
    }

    getAllMarketData() {
        const result = {};
        for (const [asset, data] of this.marketData) {
            result[asset] = {
                price: data.latestPrice,
                lastUpdate: data.lastUpdate,
                platforms: Object.fromEntries(data.platforms)
            };
        }
        return result;
    }

    // ================================
    // CONNECTION MONITORING
    // ================================
    startConnectionMonitoring() {
        console.log('🔍 Starting connection monitoring...');
        
        setInterval(async () => {
            await this.monitorConnections();
        }, this.config.heartbeatInterval);
    }

    async monitorConnections() {
        for (const [platformName, platform] of this.platforms) {
            try {
                if (!platform.isConnected) {
                    console.log(`⚠️ Platform ${platformName} disconnected, attempting reconnection...`);
                    await this.attemptReconnection(platformName);
                } else {
                    // Ping platform to check health
                    await platform.ping();
                }
            } catch (error) {
                console.error(`❌ Connection monitoring error for ${platformName}:`, error);
            }
        }
    }

    async attemptReconnection(platformName) {
        const platform = this.platforms.get(platformName);
        const attempts = this.connectionAttempts.get(platformName) || 0;
        
        if (attempts >= this.maxRetries) {
            console.log(`❌ Max reconnection attempts reached for ${platformName}`);
            return false;
        }
        
        try {
            console.log(`🔄 Reconnecting to ${platformName} (attempt ${attempts + 1}/${this.maxRetries})`);
            
            await platform.connect();
            
            this.connectionAttempts.set(platformName, 0); // Reset counter
            this.stats.reconnections++;
            
            console.log(`✅ Successfully reconnected to ${platformName}`);
            
            // Switch active platform if needed
            if (!this.getActivePlatformConnector()?.isConnected) {
                this.activePlatform = platformName;
                console.log(`🎯 Switched active platform to ${platformName}`);
            }
            
            return true;
            
        } catch (error) {
            this.connectionAttempts.set(platformName, attempts + 1);
            console.error(`❌ Reconnection failed for ${platformName}:`, error.message);
            return false;
        }
    }

    handleDisconnection(platformName) {
        console.log(`🔌 Platform ${platformName} disconnected`);
        
        // Switch active platform if needed
        if (this.activePlatform === platformName) {
            this.switchActivePlatform();
        }
    }

    handlePlatformError(platformName, error) {
        console.error(`❌ Platform error from ${platformName}:`, error);
        
        // Attempt to recover or switch platforms
        if (error.critical) {
            this.switchActivePlatform();
        }
    }

    switchActivePlatform() {
        console.log('🔄 Switching active platform...');
        
        for (const platformName of this.config.priorityOrder) {
            const platform = this.platforms.get(platformName);
            if (platform && platform.isConnected && platformName !== this.activePlatform) {
                this.activePlatform = platformName;
                console.log(`🎯 Switched active platform to ${platformName}`);
                return true;
            }
        }
        
        console.error('❌ No alternative platforms available');
        this.emit('all_platforms_unavailable');
        return false;
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getActivePlatformConnector() {
        return this.platforms.get(this.activePlatform);
    }

    getPlatformConnector(platformName) {
        return this.platforms.get(platformName);
    }

    getConnectedPlatforms() {
        const connected = [];
        for (const [name, platform] of this.platforms) {
            if (platform.isConnected) {
                connected.push(name);
            }
        }
        return connected;
    }

    async getAccountInfo(platform) {
        const platformConnector = this.platforms.get(platform || this.activePlatform);
        if (!platformConnector) {
            throw new Error(`Platform ${platform} not available`);
        }
        
        return await platformConnector.getAccountInfo();
    }

    async getTradingLimits(platform, asset) {
        const platformConnector = this.platforms.get(platform || this.activePlatform);
        if (!platformConnector) {
            throw new Error(`Platform ${platform} not available`);
        }
        
        return await platformConnector.getTradingLimits(asset);
    }

    getStats() {
        return {
            ...this.stats,
            activePlatform: this.activePlatform,
            connectedPlatforms: this.getConnectedPlatforms(),
            totalPlatforms: this.platforms.size,
            marketDataAssets: this.marketData.size
        };
    }

    healthCheck() {
        const connectedPlatforms = this.getConnectedPlatforms();
        
        return {
            status: connectedPlatforms.length > 0 ? 'healthy' : 'critical',
            activePlatform: this.activePlatform,
            connectedPlatforms,
            totalPlatforms: this.platforms.size,
            marketDataActive: this.marketData.size > 0,
            stats: this.getStats()
        };
    }

    async start() {
        console.log('▶️ Starting Platform Connectors...');
        
        // Ensure platforms are connected
        if (this.getConnectedPlatforms().length === 0) {
            await this.connectPlatforms();
        }
        
        // Start market data collection
        this.startMarketDataCollection();
        
        console.log('✅ Platform Connectors started');
    }

    async stop() {
        console.log('⏹️ Stopping Platform Connectors...');
        
        // Disconnect all platforms
        for (const [platformName, platform] of this.platforms) {
            try {
                await platform.disconnect();
                console.log(`✅ ${platformName} disconnected`);
            } catch (error) {
                console.error(`❌ Error disconnecting ${platformName}:`, error);
            }
        }
        
        console.log('✅ Platform Connectors stopped');
    }
}

module.exports = PlatformConnectors;
