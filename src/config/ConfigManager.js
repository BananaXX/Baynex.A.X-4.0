// src/config/ConfigManager.js
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class BayneXConfigManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            configPath: options.configPath || path.join(__dirname, '../data/config.json'),
            defaultConfigPath: options.defaultConfigPath || path.join(__dirname, 'defaults.json'),
            autoSave: options.autoSave !== false,
            saveInterval: options.saveInterval || 60000, // 1 minute
            validateOnLoad: options.validateOnLoad !== false,
            encryptSensitive: options.encryptSensitive || false,
            ...options
        };
        
        this.config = {};
        this.defaults = {};
        this.schema = this.getConfigSchema();
        this.saveTimer = null;
        this.isLoaded = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing Configuration Manager...');
            
            // Load default configuration
            await this.loadDefaults();
            
            // Load user configuration
            await this.loadConfig();
            
            // Setup auto-save if enabled
            if (this.options.autoSave) {
                this.setupAutoSave();
            }
            
            this.isLoaded = true;
            this.log('Configuration Manager initialized successfully');
            
            this.emit('initialized', this.config);
        } catch (error) {
            this.log(`Configuration Manager initialization error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    getConfigSchema() {
        return {
            // System Configuration
            system: {
                type: 'object',
                required: true,
                properties: {
                    name: { type: 'string', default: 'BAYNEX.A.X' },
                    version: { type: 'string', default: '1.0.0' },
                    environment: { type: 'string', enum: ['development', 'production', 'test'], default: 'development' },
                    logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
                    maxMemoryUsage: { type: 'number', default: 512 }, // MB
                    maxCpuUsage: { type: 'number', default: 80 } // %
                }
            },
            
            // Trading Configuration
            trading: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: false },
                    mode: { type: 'string', enum: ['demo', 'live'], default: 'demo' },
                    maxDailyTrades: { type: 'number', default: 100 },
                    maxSimultaneousTrades: { type: 'number', default: 5 },
                    defaultTradeAmount: { type: 'number', default: 1.0 },
                    maxTradeAmount: { type: 'number', default: 100.0 },
                    minTradeAmount: { type: 'number', default: 0.35 },
                    emergencyStopLoss: { type: 'number', default: 50.0 }, // $
                    autoRestart: { type: 'boolean', default: true },
                    restartDelay: { type: 'number', default: 30000 } // ms
                }
            },
            
            // Risk Management
            risk: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    maxDailyLoss: { type: 'number', default: 25.0 },
                    maxDrawdown: { type: 'number', default: 10.0 }, // %
                    stopLossPercentage: { type: 'number', default: 2.0 },
                    takeProfitPercentage: { type: 'number', default: 4.0 },
                    maxRiskPerTrade: { type: 'number', default: 1.0 }, // %
                    cooldownAfterLoss: { type: 'number', default: 300000 }, // ms
                    emergencyStopEnabled: { type: 'boolean', default: true }
                }
            },
            
            // Platform Configurations
            platforms: {
                type: 'object',
                required: true,
                properties: {
                    deriv: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            apiToken: { type: 'string', sensitive: true },
                            appId: { type: 'string', sensitive: true },
                            server: { type: 'string', default: 'ws.binaryws.com' },
                            minTradeAmount: { type: 'number', default: 0.35 },
                            maxTradeAmount: { type: 'number', default: 50.0 },
                            supportedAssets: { type: 'array', default: ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'] }
                        }
                    },
                    mt5: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            server: { type: 'string' },
                            login: { type: 'string', sensitive: true },
                            password: { type: 'string', sensitive: true },
                            minTradeAmount: { type: 'number', default: 1.0 },
                            maxTradeAmount: { type: 'number', default: 100.0 }
                        }
                    },
                    iq: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            email: { type: 'string', sensitive: true },
                            password: { type: 'string', sensitive: true },
                            minTradeAmount: { type: 'number', default: 1.0 },
                            maxTradeAmount: { type: 'number', default: 50.0 }
                        }
                    }
                }
            },
            
            // Strategy Configuration
            strategies: {
                type: 'object',
                required: true,
                properties: {
                    learningEnabled: { type: 'boolean', default: true },
                    maxActiveStrategies: { type: 'number', default: 3 },
                    strategyRotationInterval: { type: 'number', default: 3600000 }, // 1 hour
                    performanceThreshold: { type: 'number', default: 60.0 }, // % win rate
                    adaptationSpeed: { type: 'string', enum: ['slow', 'medium', 'fast'], default: 'medium' },
                    enabledStrategies: {
                        type: 'array',
                        default: ['momentum', 'reversal', 'breakout', 'boundary_breaker']
                    }
                }
            },
            
            // AI Learning Configuration
            ai: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    learningRate: { type: 'number', default: 0.01 },
                    minDataPoints: { type: 'number', default: 100 },
                    maxMemorySize: { type: 'number', default: 10000 },
                    retrainInterval: { type: 'number', default: 86400000 }, // 24 hours
                    confidenceThreshold: { type: 'number', default: 0.7 },
                    enablePatternRecognition: { type: 'boolean', default: true },
                    enableMarketPhaseDetection: { type: 'boolean', default: true }
                }
            },
            
            // Notification Configuration
            notifications: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    telegram: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            botToken: { type: 'string', sensitive: true },
                            chatId: { type: 'string', sensitive: true },
                            notifications: {
                                type: 'array',
                                default: ['trades', 'profits', 'losses', 'goals', 'alerts']
                            }
                        }
                    },
                    whatsapp: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            apiKey: { type: 'string', sensitive: true },
                            phoneNumber: { type: 'string', sensitive: true },
                            notifications: {
                                type: 'array',
                                default: ['major_profits', 'major_losses', 'goals', 'alerts']
                            }
                        }
                    },
                    voice: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: true },
                            mode: { type: 'string', enum: ['smart', 'full', 'silent'], default: 'smart' },
                            personality: { type: 'string', enum: ['professional', 'friendly', 'analytical'], default: 'professional' },
                            language: { type: 'string', default: 'en-US' }
                        }
                    }
                }
            },
            
            // Web Interface Configuration
            web: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    port: { type: 'number', default: 3000 },
                    wsPort: { type: 'number', default: 8080 },
                    jwtSecret: { type: 'string', sensitive: true },
                    sessionTimeout: { type: 'number', default: 3600000 }, // 1 hour
                    maxConnections: { type: 'number', default: 100 },
                    rateLimit: { type: 'number', default: 100 }, // requests per minute
                    enableSSL: { type: 'boolean', default: false },
                    sslCertPath: { type: 'string' },
                    sslKeyPath: { type: 'string' }
                }
            },
            
            // Firebase Configuration
            firebase: {
                type: 'object',
                properties: {
                    enabled: { type: 'boolean', default: true },
                    apiKey: { type: 'string', sensitive: true },
                    authDomain: { type: 'string' },
                    projectId: { type: 'string' },
                    storageBucket: { type: 'string' },
                    messagingSenderId: { type: 'string' },
                    appId: { type: 'string' },
                    serviceAccountKey: { type: 'string', sensitive: true }
                }
            },
            
            // Data Storage Configuration
            data: {
                type: 'object',
                required: true,
                properties: {
                    retentionDays: { type: 'number', default: 90 },
                    backupEnabled: { type: 'boolean', default: true },
                    backupInterval: { type: 'number', default: 86400000 }, // 24 hours
                    maxBackups: { type: 'number', default: 30 },
                    compressionEnabled: { type: 'boolean', default: true },
                    encryptionEnabled: { type: 'boolean', default: false }
                }
            }
        };
    }
    
    async loadDefaults() {
        try {
            // Generate defaults from schema
            this.defaults = this.generateDefaultsFromSchema(this.schema);
            
            // Try to load from file if it exists
            try {
                const data = await fs.readFile(this.options.defaultConfigPath, 'utf8');
                const fileDefaults = JSON.parse(data);
                this.defaults = this.mergeConfigs(this.defaults, fileDefaults);
            } catch (error) {
                // File doesn't exist, use schema defaults
                this.log('No default config file found, using schema defaults');
            }
            
            this.log('Default configuration loaded');
        } catch (error) {
            this.log(`Failed to load defaults: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async loadConfig() {
        try {
            // Start with defaults
            this.config = JSON.parse(JSON.stringify(this.defaults));
            
            // Load user configuration if it exists
            try {
                const data = await fs.readFile(this.options.configPath, 'utf8');
                const userConfig = JSON.parse(data);
                
                // Decrypt sensitive values if encryption is enabled
                if (this.options.encryptSensitive) {
                    this.decryptSensitiveValues(userConfig);
                }
                
                // Merge with defaults
                this.config = this.mergeConfigs(this.config, userConfig);
                
                this.log('User configuration loaded and merged');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.log('No user config file found, creating from defaults');
                    await this.saveConfig();
                } else {
                    throw error;
                }
            }
            
            // Validate configuration
            if (this.options.validateOnLoad) {
                this.validateConfig();
            }
            
            // Apply environment variable overrides
            this.applyEnvironmentOverrides();
            
            this.log('Configuration loaded successfully');
        } catch (error) {
            this.log(`Failed to load configuration: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async saveConfig() {
        try {
            let configToSave = JSON.parse(JSON.stringify(this.config));
            
            // Encrypt sensitive values if encryption is enabled
            if (this.options.encryptSensitive) {
                configToSave = this.encryptSensitiveValues(configToSave);
            }
            
            // Ensure directory exists
            const dir = path.dirname(this.options.configPath);
            await fs.mkdir(dir, { recursive: true });
            
            // Save configuration
            await fs.writeFile(
                this.options.configPath,
                JSON.stringify(configToSave, null, 2),
                'utf8'
            );
            
            this.log('Configuration saved successfully');
            this.emit('config_saved', this.config);
        } catch (error) {
            this.log(`Failed to save configuration: ${error.message}`, 'error');
            throw error;
        }
    }
    
    generateDefaultsFromSchema(schema, defaults = {}) {
        for (const [key, value] of Object.entries(schema)) {
            if (value.type === 'object' && value.properties) {
                defaults[key] = this.generateDefaultsFromSchema(value.properties, {});
            } else if (value.default !== undefined) {
                defaults[key] = value.default;
            }
        }
        return defaults;
    }
    
    mergeConfigs(target, source) {
        const result = JSON.parse(JSON.stringify(target));
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfigs(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }
    
    validateConfig() {
        const errors = [];
        this.validateObject(this.config, this.schema, '', errors);
        
        if (errors.length > 0) {
            const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
            this.log(errorMessage, 'error');
            throw new Error(errorMessage);
        }
        
        this.log('Configuration validation passed');
    }
    
    validateObject(obj, schema, path, errors) {
        for (const [key, schemaValue] of Object.entries(schema)) {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            
            // Check required fields
            if (schemaValue.required && (value === undefined || value === null)) {
                errors.push(`Required field missing: ${currentPath}`);
                continue;
            }
            
            if (value === undefined || value === null) continue;
            
            // Type validation
            if (schemaValue.type) {
                if (!this.validateType(value, schemaValue.type)) {
                    errors.push(`Invalid type for ${currentPath}: expected ${schemaValue.type}, got ${typeof value}`);
                    continue;
                }
            }
            
            // Enum validation
            if (schemaValue.enum && !schemaValue.enum.includes(value)) {
                errors.push(`Invalid value for ${currentPath}: must be one of [${schemaValue.enum.join(', ')}]`);
            }
            
            // Nested object validation
            if (schemaValue.type === 'object' && schemaValue.properties) {
                this.validateObject(value, schemaValue.properties, currentPath, errors);
            }
            
            // Range validation
            if (typeof value === 'number') {
                if (schemaValue.min !== undefined && value < schemaValue.min) {
                    errors.push(`Value for ${currentPath} below minimum: ${value} < ${schemaValue.min}`);
                }
                if (schemaValue.max !== undefined && value > schemaValue.max) {
                    errors.push(`Value for ${currentPath} above maximum: ${value} > ${schemaValue.max}`);
                }
            }
        }
    }
    
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default:
                return true;
        }
    }
    
    applyEnvironmentOverrides() {
        // Apply environment variable overrides with BAYNEX_ prefix
        const envPrefix = 'BAYNEX_';
        
        Object.keys(process.env).forEach(key => {
            if (key.startsWith(envPrefix)) {
                const configPath = key.substring(envPrefix.length).toLowerCase().split('_');
                const value = this.parseEnvironmentValue(process.env[key]);
                
                this.setNestedValue(this.config, configPath, value);
                this.log(`Applied environment override: ${configPath.join('.')} = ${value}`);
            }
        });
    }
    
    parseEnvironmentValue(value) {
        // Try to parse as JSON first
        try {
            return JSON.parse(value);
        } catch {
            // Return as string if not valid JSON
            return value;
        }
    }
    
    setNestedValue(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }
    
    // Configuration Access Methods
    get(path, defaultValue = undefined) {
        return this.getNestedValue(this.config, path.split('.'), defaultValue);
    }
    
    set(path, value) {
        this.setNestedValue(this.config, path.split('.'), value);
        this.emit('config_changed', { path, value, config: this.config });
        
        if (this.options.autoSave) {
            // Debounced save will be triggered by auto-save timer
        }
    }
    
    getNestedValue(obj, path, defaultValue = undefined) {
        let current = obj;
        for (const key of path) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        return current;
    }
    
    has(path) {
        return this.getNestedValue(this.config, path.split('.'), Symbol('not-found')) !== Symbol('not-found');
    }
    
    // Convenience methods for common config sections
    getSystemConfig() {
        return this.get('system', {});
    }
    
    getTradingConfig() {
        return this.get('trading', {});
    }
    
    getRiskConfig() {
        return this.get('risk', {});
    }
    
    getPlatformConfig(platform) {
        return this.get(`platforms.${platform}`, {});
    }
    
    getStrategyConfig() {
        return this.get('strategies', {});
    }
    
    getAIConfig() {
        return this.get('ai', {});
    }
    
    getNotificationConfig() {
        return this.get('notifications', {});
    }
    
    getWebConfig() {
        return this.get('web', {});
    }
    
    getFirebaseConfig() {
        return this.get('firebase', {});
// src/config/ConfigManager.js
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class BayneXConfigManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            configPath: options.configPath || path.join(__dirname, '../data/config.json'),
            defaultConfigPath: options.defaultConfigPath || path.join(__dirname, 'defaults.json'),
            autoSave: options.autoSave !== false,
            saveInterval: options.saveInterval || 60000, // 1 minute
            validateOnLoad: options.validateOnLoad !== false,
            encryptSensitive: options.encryptSensitive || false,
            ...options
        };
        
        this.config = {};
        this.defaults = {};
        this.schema = this.getConfigSchema();
        this.saveTimer = null;
        this.isLoaded = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing Configuration Manager...');
            
            // Load default configuration
            await this.loadDefaults();
            
            // Load user configuration
            await this.loadConfig();
            
            // Setup auto-save if enabled
            if (this.options.autoSave) {
                this.setupAutoSave();
            }
            
            this.isLoaded = true;
            this.log('Configuration Manager initialized successfully');
            
            this.emit('initialized', this.config);
        } catch (error) {
            this.log(`Configuration Manager initialization error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    getConfigSchema() {
        return {
            // System Configuration
            system: {
                type: 'object',
                required: true,
                properties: {
                    name: { type: 'string', default: 'BAYNEX.A.X' },
                    version: { type: 'string', default: '1.0.0' },
                    environment: { type: 'string', enum: ['development', 'production', 'test'], default: 'development' },
                    logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
                    maxMemoryUsage: { type: 'number', default: 512 }, // MB
                    maxCpuUsage: { type: 'number', default: 80 } // %
                }
            },
            
            // Trading Configuration
            trading: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: false },
                    mode: { type: 'string', enum: ['demo', 'live'], default: 'demo' },
                    maxDailyTrades: { type: 'number', default: 100 },
                    maxSimultaneousTrades: { type: 'number', default: 5 },
                    defaultTradeAmount: { type: 'number', default: 1.0 },
                    maxTradeAmount: { type: 'number', default: 100.0 },
                    minTradeAmount: { type: 'number', default: 0.35 },
                    emergencyStopLoss: { type: 'number', default: 50.0 }, // $
                    autoRestart: { type: 'boolean', default: true },
                    restartDelay: { type: 'number', default: 30000 } // ms
                }
            },
            
            // Risk Management
            risk: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    maxDailyLoss: { type: 'number', default: 25.0 },
                    maxDrawdown: { type: 'number', default: 10.0 }, // %
                    stopLossPercentage: { type: 'number', default: 2.0 },
                    takeProfitPercentage: { type: 'number', default: 4.0 },
                    maxRiskPerTrade: { type: 'number', default: 1.0 }, // %
                    cooldownAfterLoss: { type: 'number', default: 300000 }, // ms
                    emergencyStopEnabled: { type: 'boolean', default: true }
                }
            },
            
            // Platform Configurations
            platforms: {
                type: 'object',
                required: true,
                properties: {
                    deriv: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            apiToken: { type: 'string', sensitive: true },
                            appId: { type: 'string', sensitive: true },
                            server: { type: 'string', default: 'ws.binaryws.com' },
                            minTradeAmount: { type: 'number', default: 0.35 },
                            maxTradeAmount: { type: 'number', default: 50.0 },
                            supportedAssets: { type: 'array', default: ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'] }
                        }
                    },
                    mt5: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            server: { type: 'string' },
                            login: { type: 'string', sensitive: true },
                            password: { type: 'string', sensitive: true },
                            minTradeAmount: { type: 'number', default: 1.0 },
                            maxTradeAmount: { type: 'number', default: 100.0 }
                        }
                    },
                    iq: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            demo: { type: 'boolean', default: true },
                            email: { type: 'string', sensitive: true },
                            password: { type: 'string', sensitive: true },
                            minTradeAmount: { type: 'number', default: 1.0 },
                            maxTradeAmount: { type: 'number', default: 50.0 }
                        }
                    }
                }
            },
            
            // Strategy Configuration
            strategies: {
                type: 'object',
                required: true,
                properties: {
                    learningEnabled: { type: 'boolean', default: true },
                    maxActiveStrategies: { type: 'number', default: 3 },
                    strategyRotationInterval: { type: 'number', default: 3600000 }, // 1 hour
                    performanceThreshold: { type: 'number', default: 60.0 }, // % win rate
                    adaptationSpeed: { type: 'string', enum: ['slow', 'medium', 'fast'], default: 'medium' },
                    enabledStrategies: {
                        type: 'array',
                        default: ['momentum', 'reversal', 'breakout', 'boundary_breaker']
                    }
                }
            },
            
            // AI Learning Configuration
            ai: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    learningRate: { type: 'number', default: 0.01 },
                    minDataPoints: { type: 'number', default: 100 },
                    maxMemorySize: { type: 'number', default: 10000 },
                    retrainInterval: { type: 'number', default: 86400000 }, // 24 hours
                    confidenceThreshold: { type: 'number', default: 0.7 },
                    enablePatternRecognition: { type: 'boolean', default: true },
                    enableMarketPhaseDetection: { type: 'boolean', default: true }
                }
            },
            
            // Notification Configuration
            notifications: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    telegram: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            botToken: { type: 'string', sensitive: true },
                            chatId: { type: 'string', sensitive: true },
                            notifications: {
                                type: 'array',
                                default: ['trades', 'profits', 'losses', 'goals', 'alerts']
                            }
                        }
                    },
                    whatsapp: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: false },
                            apiKey: { type: 'string', sensitive: true },
                            phoneNumber: { type: 'string', sensitive: true },
                            notifications: {
                                type: 'array',
                                default: ['major_profits', 'major_losses', 'goals', 'alerts']
                            }
                        }
                    },
                    voice: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean', default: true },
                            mode: { type: 'string', enum: ['smart', 'full', 'silent'], default: 'smart' },
                            personality: { type: 'string', enum: ['professional', 'friendly', 'analytical'], default: 'professional' },
                            language: { type: 'string', default: 'en-US' }
                        }
                    }
                }
            },
            
            // Web Interface Configuration
            web: {
                type: 'object',
                required: true,
                properties: {
                    enabled: { type: 'boolean', default: true },
                    port: { type: 'number', default: 3000 },
                    wsPort: { type: 'number', default: 8080 },
                    jwtSecret: { type: 'string', sensitive: true },
                    sessionTimeout: { type: 'number', default: 3600000 }, // 1 hour
                    maxConnections: { type: 'number', default: 100 },
                    rateLimit: { type: 'number', default: 100 }, // requests per minute
                    enableSSL: { type: 'boolean', default: false },
                    sslCertPath: { type: 'string' },
                    sslKeyPath: { type: 'string' }
                }
            },
            
            // Firebase Configuration
            firebase: {
                type: 'object',
                properties: {
                    enabled: { type: 'boolean', default: true },
                    apiKey: { type: 'string', sensitive: true },
                    authDomain: { type: 'string' },
                    projectId: { type: 'string' },
                    storageBucket: { type: 'string' },
                    messagingSenderId: { type: 'string' },
                    appId: { type: 'string' },
                    serviceAccountKey: { type: 'string', sensitive: true }
                }
            },
            
            // Data Storage Configuration
            data: {
                type: 'object',
                required: true,
                properties: {
                    retentionDays: { type: 'number', default: 90 },
                    backupEnabled: { type: 'boolean', default: true },
                    backupInterval: { type: 'number', default: 86400000 }, // 24 hours
                    maxBackups: { type: 'number', default: 30 },
                    compressionEnabled: { type: 'boolean', default: true },
                    encryptionEnabled: { type: 'boolean', default: false }
                }
            }
        };
    }
    
    async loadDefaults() {
        try {
            // Generate defaults from schema
            this.defaults = this.generateDefaultsFromSchema(this.schema);
            
            // Try to load from file if it exists
            try {
                const data = await fs.readFile(this.options.defaultConfigPath, 'utf8');
                const fileDefaults = JSON.parse(data);
                this.defaults = this.mergeConfigs(this.defaults, fileDefaults);
            } catch (error) {
                // File doesn't exist, use schema defaults
                this.log('No default config file found, using schema defaults');
            }
            
            this.log('Default configuration loaded');
        } catch (error) {
            this.log(`Failed to load defaults: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async loadConfig() {
        try {
            // Start with defaults
            this.config = JSON.parse(JSON.stringify(this.defaults));
            
            // Load user configuration if it exists
            try {
                const data = await fs.readFile(this.options.configPath, 'utf8');
                const userConfig = JSON.parse(data);
                
                // Decrypt sensitive values if encryption is enabled
                if (this.options.encryptSensitive) {
                    this.decryptSensitiveValues(userConfig);
                }
                
                // Merge with defaults
                this.config = this.mergeConfigs(this.config, userConfig);
                
                this.log('User configuration loaded and merged');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.log('No user config file found, creating from defaults');
                    await this.saveConfig();
                } else {
                    throw error;
                }
            }
            
            // Validate configuration
            if (this.options.validateOnLoad) {
                this.validateConfig();
            }
            
            // Apply environment variable overrides
            this.applyEnvironmentOverrides();
            
            this.log('Configuration loaded successfully');
        } catch (error) {
            this.log(`Failed to load configuration: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async saveConfig() {
        try {
            let configToSave = JSON.parse(JSON.stringify(this.config));
            
            // Encrypt sensitive values if encryption is enabled
            if (this.options.encryptSensitive) {
                configToSave = this.encryptSensitiveValues(configToSave);
            }
            
            // Ensure directory exists
            const dir = path.dirname(this.options.configPath);
            await fs.mkdir(dir, { recursive: true });
            
            // Save configuration
            await fs.writeFile(
                this.options.configPath,
                JSON.stringify(configToSave, null, 2),
                'utf8'
            );
            
            this.log('Configuration saved successfully');
            this.emit('config_saved', this.config);
        } catch (error) {
            this.log(`Failed to save configuration: ${error.message}`, 'error');
            throw error;
        }
    }
    
    generateDefaultsFromSchema(schema, defaults = {}) {
        for (const [key, value] of Object.entries(schema)) {
            if (value.type === 'object' && value.properties) {
                defaults[key] = this.generateDefaultsFromSchema(value.properties, {});
            } else if (value.default !== undefined) {
                defaults[key] = value.default;
            }
        }
        return defaults;
    }
    
    mergeConfigs(target, source) {
        const result = JSON.parse(JSON.stringify(target));
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfigs(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }
    
    validateConfig() {
        const errors = [];
        this.validateObject(this.config, this.schema, '', errors);
        
        if (errors.length > 0) {
            const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
            this.log(errorMessage, 'error');
            throw new Error(errorMessage);
        }
        
        this.log('Configuration validation passed');
    }
    
    validateObject(obj, schema, path, errors) {
        for (const [key, schemaValue] of Object.entries(schema)) {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            
            // Check required fields
            if (schemaValue.required && (value === undefined || value === null)) {
                errors.push(`Required field missing: ${currentPath}`);
                continue;
            }
            
            if (value === undefined || value === null) continue;
            
            // Type validation
            if (schemaValue.type) {
                if (!this.validateType(value, schemaValue.type)) {
                    errors.push(`Invalid type for ${currentPath}: expected ${schemaValue.type}, got ${typeof value}`);
                    continue;
                }
            }
            
            // Enum validation
            if (schemaValue.enum && !schemaValue.enum.includes(value)) {
                errors.push(`Invalid value for ${currentPath}: must be one of [${schemaValue.enum.join(', ')}]`);
            }
            
            // Nested object validation
            if (schemaValue.type === 'object' && schemaValue.properties) {
                this.validateObject(value, schemaValue.properties, currentPath, errors);
            }
            
            // Range validation
            if (typeof value === 'number') {
                if (schemaValue.min !== undefined && value < schemaValue.min) {
                    errors.push(`Value for ${currentPath} below minimum: ${value} < ${schemaValue.min}`);
                }
                if (schemaValue.max !== undefined && value > schemaValue.max) {
                    errors.push(`Value for ${currentPath} above maximum: ${value} > ${schemaValue.max}`);
                }
            }
        }
    }
    
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default:
                return true;
        }
    }
    
    applyEnvironmentOverrides() {
        // Apply environment variable overrides with BAYNEX_ prefix
        const envPrefix = 'BAYNEX_';
        
        Object.keys(process.env).forEach(key => {
            if (key.startsWith(envPrefix)) {
                const configPath = key.substring(envPrefix.length).toLowerCase().split('_');
                const value = this.parseEnvironmentValue(process.env[key]);
                
                this.setNestedValue(this.config, configPath, value);
                this.log(`Applied environment override: ${configPath.join('.')} = ${value}`);
            }
        });
    }
    
    parseEnvironmentValue(value) {
        // Try to parse as JSON first
        try {
            return JSON.parse(value);
        } catch {
            // Return as string if not valid JSON
            return value;
        }
    }
    
    setNestedValue(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }
    
    // Configuration Access Methods
    get(path, defaultValue = undefined) {
        return this.getNestedValue(this.config, path.split('.'), defaultValue);
    }
    
    set(path, value) {
        this.setNestedValue(this.config, path.split('.'), value);
        this.emit('config_changed', { path, value, config: this.config });
        
        if (this.options.autoSave) {
            // Debounced save will be triggered by auto-save timer
        }
    }
    
    getNestedValue(obj, path, defaultValue = undefined) {
        let current = obj;
        for (const key of path) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        return current;
    }
    
    has(path) {
        return this.getNestedValue(this.config, path.split('.'), Symbol('not-found')) !== Symbol('not-found');
    }
    
    // Convenience methods for common config sections
    getSystemConfig() {
        return this.get('system', {});
    }
    
    getTradingConfig() {
        return this.get('trading', {});
    }
    
    getRiskConfig() {
        return this.get('risk', {});
    }
    
    getPlatformConfig(platform) {
        return this.get(`platforms.${platform}`, {});
    }
    
    getStrategyConfig() {
        return this.get('strategies', {});
    }
    
    getAIConfig() {
        return this.get('ai', {});
    }
    
    getNotificationConfig() {
        return this.get('notifications', {});
    }
    
    getWebConfig() {
        return this.get('web', {});
    }
    
    getFirebaseConfig() {
        return this.get('firebase', {});
    }
    
    getDataConfig() {
        return this.get('data', {});
    }
    
    // Security methods (placeholder - implement actual encryption as needed)
    encryptSensitiveValues(config) {
        // TODO: Implement actual encryption
        return config;
    }
    
    decryptSensitiveValues(config) {
        // TODO: Implement actual decryption
        return config;
    }
    
    // Auto-save setup
    setupAutoSave() {
        this.saveTimer = setInterval(async () => {
            try {
                await this.saveConfig();
            } catch (error) {
                this.log(`Auto-save failed: ${error.message}`, 'error');
            }
        }, this.options.saveInterval);
    }
    
    // Reset configuration
    async resetToDefaults() {
        this.config = JSON.parse(JSON.stringify(this.defaults));
        await this.saveConfig();
        this.emit('config_reset', this.config);
        this.log('Configuration reset to defaults');
    }
    
    // Export/Import
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }
    
    async importConfig(configString) {
        try {
            const importedConfig = JSON.parse(configString);
            
            // Validate imported config
            const tempConfig = this.mergeConfigs(this.defaults, importedConfig);
            this.validateObject(tempConfig, this.schema, '', []);
            
            this.config = tempConfig;
            await this.saveConfig();
            
            this.emit('config_imported', this.config);
            this.log('Configuration imported successfully');
        } catch (error) {
            this.log(`Configuration import failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Cleanup
    async cleanup() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
        
        if (this.options.autoSave) {
            await this.saveConfig();
        }
        
        this.log('Configuration Manager cleanup complete');
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ConfigManager] [${level.toUpperCase()}] ${message}`);
        
        this.emit('log', { timestamp, level, message, component: 'ConfigManager' });
    }
}

module.exports = BayneXConfigManager;
