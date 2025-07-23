// src/config/ConfigManager.js
// BAYNEX.A.X Configuration Management System

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class BayneXConfigManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.configPath = options.configPath || path.join(process.cwd(), 'data', 'config.json');
        this.config = {};
        this.watchers = new Map();
        this.initialized = false;
        this.dependencies = [];
        
        // Default configuration for BAYNEX.A.X
        this.defaults = {
            system: {
                name: 'BAYNEX.A.X',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'production',
                logLevel: process.env.LOG_LEVEL || 'info',
                autoRestart: true,
                healthCheckInterval: 30000
            },
            
            web: {
                port: parseInt(process.env.PORT) || 3000,
                wsPort: parseInt(process.env.WS_PORT) || 8080,
                host: process.env.HOST || '0.0.0.0',
                jwtSecret: process.env.JWT_SECRET || 'baynex-secret-key',
                corsOrigins: ['*'],
                enableDashboard: true
            },
            
            trading: {
                enabled: process.env.TRADING_ENABLED === 'true',
                mode: process.env.TRADING_MODE || 'live',
                autoStart: process.env.AUTO_START_TRADING === 'true',
                maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES) || 100,
                maxSimultaneousTrades: parseInt(process.env.MAX_SIMULTANEOUS_TRADES) || 5,
                defaultTradeAmount: parseFloat(process.env.DEFAULT_TRADE_AMOUNT) || 1.0,
                emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 50.0,
                tradingHours: {
                    start: '00:00',
                    end: '23:59',
                    timezone: 'UTC'
                }
            },
            
            platforms: {
                deriv: {
                    enabled: process.env.DERIV_ENABLED !== 'false',
                    apiToken: process.env.DERIV_API_TOKEN,
                    appId: process.env.DERIV_APP_ID || '1089',
                    endpoint: process.env.DERIV_ENDPOINT || 'wss://ws.derivws.com/websockets/v3',
                    demo: process.env.DERIV_DEMO === 'true',
                    reconnectInterval: 5000,
                    maxReconnectAttempts: 10
                },
                mt5: {
                    enabled: process.env.MT5_ENABLED === 'true',
                    server: process.env.MT5_SERVER,
                    login: process.env.MT5_LOGIN,
                    password: process.env.MT5_PASSWORD,
                    demo: process.env.MT5_DEMO === 'true'
                },
                iq: {
                    enabled: process.env.IQ_ENABLED === 'true',
                    email: process.env.IQ_EMAIL,
                    password: process.env.IQ_PASSWORD,
                    demo: process.env.IQ_DEMO === 'true'
                }
            },
            
            ai: {
                enabled: process.env.AI_LEARNING_ENABLED !== 'false',
                learningRate: parseFloat(process.env.AI_LEARNING_RATE) || 0.001,
                minDataPoints: parseInt(process.env.MIN_DATA_POINTS) || 100,
                confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7,
                patternRecognition: true,
                neuralNetworks: true,
                adaptationSpeed: process.env.ADAPTATION_SPEED || 'medium',
                trainingInterval: 3600000, // 1 hour
                maxTrainingData: 10000
            },
            
            strategies: {
                enabled: true,
                autoSwitching: true,
                performanceThreshold: 0.6,
                maxActiveStrategies: 5,
                evolutionEnabled: true,
                strategies: {
                    momentum: { enabled: true, weight: 1.0 },
                    reversal: { enabled: true, weight: 1.0 },
                    breakout: { enabled: true, weight: 1.0 },
                    boundaryBreaker: { enabled: true, weight: 1.2 },
                    martingale: { enabled: false, weight: 0.5 },
                    aiAdaptive: { enabled: true, weight: 1.5 }
                }
            },
            
            risk: {
                enabled: true,
                maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 25.0,
                maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN) || 10.0,
                stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE) || 2.0,
                takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE) || 4.0,
                dynamicPositionSizing: true,
                riskPerTrade: parseFloat(process.env.DEFAULT_RISK_PER_TRADE) || 0.02,
                maxRiskPerTrade: 0.05,
                emergencyStopEnabled: true
            },
            
            notifications: {
                enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
                telegram: {
                    enabled: process.env.TELEGRAM_ENABLED === 'true',
                    botToken: process.env.TELEGRAM_BOT_TOKEN,
                    chatId: process.env.TELEGRAM_CHAT_ID,
                    alerts: ['trade_executed', 'profit_target', 'risk_alert', 'system_status']
                },
                whatsapp: {
                    enabled: process.env.WHATSAPP_ENABLED === 'true',
                    apiKey: process.env.WHATSAPP_API_KEY,
                    phoneNumber: process.env.WHATSAPP_PHONE
                },
                email: {
                    enabled: process.env.EMAIL_ENABLED === 'true',
                    smtp: {
                        host: process.env.EMAIL_HOST,
                        port: parseInt(process.env.EMAIL_PORT) || 587,
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                    to: process.env.EMAIL_TO
                },
                voice: {
                    enabled: process.env.VOICE_ENABLED !== 'false',
                    mode: process.env.VOICE_MODE || 'smart',
                    personality: process.env.VOICE_PERSONALITY || 'professional',
                    language: 'en-US'
                }
            },
            
            goals: {
                enabled: true,
                dailyProfitTarget: parseFloat(process.env.DAILY_PROFIT_TARGET) || 25.0,
                weeklyProfitTarget: parseFloat(process.env.WEEKLY_PROFIT_TARGET) || 150.0,
                monthlyProfitTarget: parseFloat(process.env.MONTHLY_PROFIT_TARGET) || 600.0,
                targetWinRate: 0.65,
                achievements: true,
                milestones: [50, 100, 250, 500, 1000]
            },
            
            data: {
                storage: 'sqlite',
                path: './data/baynex.db',
                backup: {
                    enabled: true,
                    interval: 86400000, // 24 hours
                    retention: 30, // days
                    location: './backups'
                },
                cache: {
                    enabled: true,
                    ttl: 300000, // 5 minutes
                    maxSize: 1000
                }
            },
            
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                enableConsole: true,
                enableFile: true,
                enableRotation: true,
                maxFileSize: '10MB',
                maxFiles: 10,
                path: './logs'
            },
            
            security: {
                encryptionKey: process.env.ENCRYPTION_KEY,
                sessionSecret: process.env.SESSION_SECRET,
                rateLimiting: {
                    enabled: true,
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    max: 100 // requests
                }
            },
            
            performance: {
                monitoring: true,
                memoryLimit: 512, // MB
                cpuLimit: 80, // percentage
                alertThresholds: {
                    memory: 400, // MB
                    cpu: 70 // percentage
                }
            }
        };
    }
    
    async init() {
        try {
            console.log('🔧 Initializing Configuration Manager...');
            
            // Ensure config directory exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            // Load or create configuration
            await this.loadConfig();
            
            // Apply environment overrides
            this.applyEnvironmentOverrides();
            
            // Validate configuration
            this.validateConfig();
            
            this.initialized = true;
            console.log('✅ Configuration Manager initialized');
            
            return true;
        } catch (error) {
            console.error('❌ Configuration Manager initialization failed:', error);
            throw error;
        }
    }
    
    async loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const rawConfig = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(rawConfig);
                
                // Deep merge with defaults
                this.config = this.deepMerge(this.defaults, fileConfig);
                console.log('📄 Configuration loaded from file');
            } else {
                // Use defaults and create file
                this.config = JSON.parse(JSON.stringify(this.defaults));
                await this.saveConfig();
                console.log('📄 Created default configuration file');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load config file, using defaults:', error.message);
            this.config = JSON.parse(JSON.stringify(this.defaults));
        }
    }
    
    applyEnvironmentOverrides() {
        // System overrides
        if (process.env.NODE_ENV) this.config.system.environment = process.env.NODE_ENV;
        if (process.env.LOG_LEVEL) this.config.system.logLevel = process.env.LOG_LEVEL;
        
        // Web overrides
        if (process.env.PORT) this.config.web.port = parseInt(process.env.PORT);
        if (process.env.WS_PORT) this.config.web.wsPort = parseInt(process.env.WS_PORT);
        if (process.env.HOST) this.config.web.host = process.env.HOST;
        
        // Trading overrides
        if (process.env.TRADING_ENABLED) this.config.trading.enabled = process.env.TRADING_ENABLED === 'true';
        if (process.env.TRADING_MODE) this.config.trading.mode = process.env.TRADING_MODE;
        if (process.env.AUTO_START_TRADING) this.config.trading.autoStart = process.env.AUTO_START_TRADING === 'true';
        
        // Platform overrides
        if (process.env.DERIV_API_TOKEN) this.config.platforms.deriv.apiToken = process.env.DERIV_API_TOKEN;
        if (process.env.DERIV_DEMO) this.config.platforms.deriv.demo = process.env.DERIV_DEMO === 'true';
        
        // AI overrides
        if (process.env.AI_LEARNING_ENABLED) this.config.ai.enabled = process.env.AI_LEARNING_ENABLED === 'true';
        if (process.env.AI_LEARNING_RATE) this.config.ai.learningRate = parseFloat(process.env.AI_LEARNING_RATE);
        
        // Risk overrides
        if (process.env.MAX_DAILY_LOSS) this.config.risk.maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS);
        if (process.env.DEFAULT_RISK_PER_TRADE) this.config.risk.riskPerTrade = parseFloat(process.env.DEFAULT_RISK_PER_TRADE);
        
        console.log('🔄 Environment overrides applied');
    }
    
    validateConfig() {
        const errors = [];
        
        // Validate required fields
        if (!this.config.platforms.deriv.apiToken && this.config.platforms.deriv.enabled) {
            errors.push('Deriv API token is required when Deriv platform is enabled');
        }
        
        if (this.config.web.port < 1 || this.config.web.port > 65535) {
            errors.push('Invalid web port number');
        }
        
        if (this.config.trading.maxDailyTrades < 1) {
            errors.push('Max daily trades must be at least 1');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
        
        console.log('✅ Configuration validation passed');
    }
    
    async saveConfig() {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, configData);
            console.log('💾 Configuration saved');
        } catch (error) {
            console.error('❌ Failed to save configuration:', error.message);
        }
    }
    
    get(keyPath, defaultValue = null) {
        return this.getNestedValue(this.config, keyPath, defaultValue);
    }
    
    set(keyPath, value) {
        this.setNestedValue(this.config, keyPath, value);
        this.emit('config_changed', { keyPath, value });
        
        // Auto-save after changes
        this.saveConfig().catch(console.error);
    }
    
    getNestedValue(obj, keyPath, defaultValue = null) {
        const keys = keyPath.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }
    
    setNestedValue(obj, keyPath, value) {
        const keys = keyPath.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
    
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    getAll() {
        return JSON.parse(JSON.stringify(this.config));
    }
    
    getHealthStatus() {
        return {
            status: this.initialized ? 'healthy' : 'unhealthy',
            initialized: this.initialized,
            configPath: this.configPath,
            configSize: Object.keys(this.config).length,
            lastModified: fs.existsSync(this.configPath) ? 
                fs.statSync(this.configPath).mtime : null
        };
    }
    
    async reload() {
        console.log('🔄 Reloading configuration...');
        await this.loadConfig();
        this.applyEnvironmentOverrides();
        this.validateConfig();
        this.emit('config_reloaded');
        console.log('✅ Configuration reloaded');
    }
    
    async shutdown() {
        try {
            // Save current configuration
            await this.saveConfig();
            
            // Clear watchers
            this.watchers.clear();
            
            this.initialized = false;
            console.log('✅ Configuration Manager shutdown complete');
        } catch (error) {
            console.error('❌ Error during Configuration Manager shutdown:', error);
        }
    }
}

module.exports = BayneXConfigManager;
