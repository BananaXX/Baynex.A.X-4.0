// src/config/index.js
const BayneXConfigManager = require('./ConfigManager');

module.exports = {
    BayneXConfigManager,
    
    // Factory function
    createConfigManager: (options = {}) => {
        return new BayneXConfigManager(options);
    },
    
    // Environment helpers
    environment: {
        isDevelopment: () => process.env.NODE_ENV === 'development',
        isProduction: () => process.env.NODE_ENV === 'production',
        isTest: () => process.env.NODE_ENV === 'test',
        
        getEnvironment: () => process.env.NODE_ENV || 'development',
        
        requireEnvVar: (name, defaultValue = null) => {
            const value = process.env[name];
            if (value === undefined || value === '') {
                if (defaultValue !== null) {
                    return defaultValue;
                }
                throw new Error(`Required environment variable ${name} is not set`);
            }
            return value;
        },
        
        getEnvVar: (name, defaultValue = null) => {
            return process.env[name] || defaultValue;
        },
        
        getBooleanEnvVar: (name, defaultValue = false) => {
            const value = process.env[name];
            if (value === undefined || value === '') return defaultValue;
            return value.toLowerCase() === 'true' || value === '1';
        },
        
        getNumberEnvVar: (name, defaultValue = 0) => {
            const value = process.env[name];
            if (value === undefined || value === '') return defaultValue;
            const num = Number(value);
            return isNaN(num) ? defaultValue : num;
        }
    },
    
    // Configuration constants
    constants: {
        // Trading modes
        TRADING_MODES: {
            DEMO: 'demo',
            LIVE: 'live'
        },
        
        // System environments
        ENVIRONMENTS: {
            DEVELOPMENT: 'development',
            PRODUCTION: 'production',
            TEST: 'test'
        },
        
        // Log levels
        LOG_LEVELS: {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warn',
            ERROR: 'error'
        },
        
        // Voice modes
        VOICE_MODES: {
            SMART: 'smart',
            FULL: 'full',
            SILENT: 'silent'
        },
        
        // Voice personalities
        VOICE_PERSONALITIES: {
            PROFESSIONAL: 'professional',
            FRIENDLY: 'friendly',
            ANALYTICAL: 'analytical'
        },
        
        // Strategy adaptation speeds
        ADAPTATION_SPEEDS: {
            SLOW: 'slow',
            MEDIUM: 'medium',
            FAST: 'fast'
        },
        
        // Default ports
        DEFAULT_PORTS: {
            HTTP: 3000,
            WEBSOCKET: 8080,
            API: 3001
        },
        
        // Default timeouts
        DEFAULT_TIMEOUTS: {
            CONNECTION: 30000,
            REQUEST: 10000,
            SESSION: 3600000
        },
        
        // Default limits
        DEFAULT_LIMITS: {
            MAX_TRADES_PER_DAY: 100,
            MAX_SIMULTANEOUS_TRADES: 5,
            MAX_DAILY_LOSS: 25.0,
            MAX_DRAWDOWN: 10.0,
            MIN_TRADE_AMOUNT: 0.35,
            MAX_TRADE_AMOUNT: 100.0
        }
    },
    
    // Configuration validation helpers
    validators: {
        // Validate port number
        validatePort: (port) => {
            const num = Number(port);
            return Number.isInteger(num) && num >= 1 && num <= 65535;
        },
        
        // Validate percentage
        validatePercentage: (value) => {
            const num = Number(value);
            return !isNaN(num) && num >= 0 && num <= 100;
        },
        
        // Validate positive number
        validatePositiveNumber: (value) => {
            const num = Number(value);
            return !isNaN(num) && num > 0;
        },
        
        // Validate email format
        validateEmail: (email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        
        // Validate URL format
        validateURL: (url) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        
        // Validate trading amount
        validateTradeAmount: (amount, min = 0.35, max = 100) => {
            const num = Number(amount);
            return !isNaN(num) && num >= min && num <= max;
        },
        
        // Validate timeout value
        validateTimeout: (timeout) => {
            const num = Number(timeout);
            return Number.isInteger(num) && num >= 1000; // At least 1 second
        },
        
        // Validate API key format (basic check)
        validateAPIKey: (key) => {
            return typeof key === 'string' && key.length >= 8 && key.trim() === key;
        }
    },
    
    // Configuration templates
    templates: {
        // Development configuration template
        development: {
            system: {
                environment: 'development',
                logLevel: 'debug'
            },
            trading: {
                enabled: false,
                mode: 'demo'
            },
            platforms: {
                deriv: { demo: true },
                mt5: { demo: true },
                iq: { demo: true }
            },
            web: {
                port: 3000,
                wsPort: 8080
            }
        },
        
        // Production configuration template
        production: {
            system: {
                environment: 'production',
                logLevel: 'info'
            },
            trading: {
                enabled: true,
                mode: 'live'
            },
            web: {
                port: process.env.PORT || 3000,
                enableSSL: true
            },
            data: {
                backupEnabled: true,
                encryptionEnabled: true
            }
        },
        
        // Conservative trading template
        conservative: {
            trading: {
                maxDailyTrades: 20,
                maxSimultaneousTrades: 2,
                defaultTradeAmount: 1.0
            },
            risk: {
                maxDailyLoss: 10.0,
                maxDrawdown: 5.0,
                stopLossPercentage: 1.5,
                takeProfitPercentage: 3.0,
                cooldownAfterLoss: 600000 // 10 minutes
            },
            strategies: {
                maxActiveStrategies: 1,
                performanceThreshold: 70.0,
                adaptationSpeed: 'slow'
            }
        },
        
        // Aggressive trading template
        aggressive: {
            trading: {
                maxDailyTrades: 100,
                maxSimultaneousTrades: 5,
                defaultTradeAmount: 5.0
            },
            risk: {
                maxDailyLoss: 50.0,
                maxDrawdown: 15.0,
                stopLossPercentage: 3.0,
                takeProfitPercentage: 6.0,
                cooldownAfterLoss: 60000 // 1 minute
            },
            strategies: {
                maxActiveStrategies: 3,
                performanceThreshold: 55.0,
                adaptationSpeed: 'fast'
            }
        }
    },
    
    // Configuration utilities
    utils: {
        // Merge configuration objects
        mergeConfigs: (target, source) => {
            const result = JSON.parse(JSON.stringify(target));
            
            for (const [key, value] of Object.entries(source)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    result[key] = module.exports.utils.mergeConfigs(result[key] || {}, value);
                } else {
                    result[key] = value;
                }
            }
            
            return result;
        },
        
        // Get nested configuration value
        getNestedValue: (obj, path, defaultValue = undefined) => {
            const keys = path.split('.');
            let current = obj;
            
            for (const key of keys) {
                if (current === null || current === undefined || !(key in current)) {
                    return defaultValue;
                }
                current = current[key];
            }
            
            return current;
        },
        
        // Set nested configuration value
        setNestedValue: (obj, path, value) => {
            const keys = path.split('.');
            let current = obj;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!(keys[i] in current)) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return obj;
        },
        
        // Sanitize sensitive configuration for logging
        sanitizeConfig: (config) => {
            const sensitiveKeys = ['password', 'token', 'key', 'secret', 'apikey'];
            const sanitized = JSON.parse(JSON.stringify(config));
            
            const sanitizeObject = (obj) => {
                for (const [key, value] of Object.entries(obj)) {
                    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                        obj[key] = '***REDACTED***';
                    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        sanitizeObject(value);
                    }
                }
            };
            
            sanitizeObject(sanitized);
            return sanitized;
        },
        
        // Validate configuration against schema
        validateConfiguration: (config, schema) => {
            const errors = [];
            
            const validateObject = (obj, schemaObj, path = '') => {
                for (const [key, schemaValue] of Object.entries(schemaObj)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    const value = obj[key];
                    
                    if (schemaValue.required && (value === undefined || value === null)) {
                        errors.push(`Required field missing: ${currentPath}`);
                        continue;
                    }
                    
                    if (value === undefined || value === null) continue;
                    
                    if (schemaValue.type && typeof value !== schemaValue.type) {
                        errors.push(`Invalid type for ${currentPath}: expected ${schemaValue.type}, got ${typeof value}`);
                    }
                    
                    if (schemaValue.enum && !schemaValue.enum.includes(value)) {
                        errors.push(`Invalid value for ${currentPath}: must be one of [${schemaValue.enum.join(', ')}]`);
                    }
                    
                    if (schemaValue.properties && typeof value === 'object') {
                        validateObject(value, schemaValue.properties, currentPath);
                    }
                }
            };
            
            validateObject(config, schema);
            return errors;
        }
    }
};
