// src/config/ConfigManager.js
// Configuration Management System for BAYNEX.A.X

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
        
        // Default configuration
        this.defaults = {
            system: {
                name: 'BAYNEX.A.X',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'production',
                logLevel: 'info'
            },
            web: {
                port: parseInt(process.env.PORT) || 3000,
                wsPort: parseInt(process.env.WS_PORT) || 8080,
                host: process.env.HOST || '0.0.0.0'
            },
            trading: {
                enabled: process.env.TRADING_ENABLED === 'true',
                mode: process.env.TRADING_MODE || 'live',
                autoStart: process.env.AUTO_START_TRADING === 'true'
            },
            platforms: {
                deriv: {
                    enabled: process.env.DERIV_ENABLED !== 'false',
                    apiToken: process.env.DERIV_API_TOKEN,
                    appId: process.env.DERIV_APP_ID || '1089',
                    demo: process.env.DERIV_DEMO === 'true'
                }
            },
            notifications: {
                telegram: {
                    enabled: process.env.TELEGRAM_ENABLED === 'true',
                    botToken: process.env.TELEGRAM_BOT_TOKEN,
                    chatId: process.env.TELEGRAM_CHAT_ID
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
                
                // Merge with defaults
                this.config = this.deepMerge(this.defaults, fileConfig);
            } else {
                // Use defaults and create file
                this.config = { ...this.defaults };
                await this.saveConfig();
            }
            
            // Override with environment variables
            this.applyEnvironmentOverrides();
            
            console.log('📄 Configuration loaded successfully');
        } catch (error) {
            console.warn('⚠️  Failed to load config file, using defaults:', error.message);
            this.config = { ...this.defaults };
            this.applyEnvironmentOverrides();
        }
    }
    
    applyEnvironmentOverrides() {
        // Apply environment variable overrides
        if (process.env.PORT) {
            this.config.web.port = parseInt(process.env.PORT);
        }
        
        if (process.env.WS_PORT) {
            this.config.web.wsPort = parseInt(process.env.WS_PORT);
        }
        
        if (process.env.DERIV_API_TOKEN) {
            this.config.platforms.deriv.apiToken = process.env.DERIV_API_TOKEN;
        }
        
        if (process.env.TRADING_ENABLED) {
            this.config.trading.enabled = process.env.TRADING_ENABLED === 'true';
        }
        
        if (process.env.TRADING_MODE) {
            this.config.trading.mode = process.env.TRADING_MODE;
        }
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
        return { ...this.config };
    }
    
    getHealthStatus() {
        return {
            status: this.initialized ? 'healthy' : 'unhealthy',
            initialized: this.initialized,
            configPath: this.configPath,
            hasConfig: Object.keys(this.config).length > 0
        };
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
