// src/utils/index.js
const BayneXLogger = require('./Logger');
const BayneXHelpers = require('./Helpers');

module.exports = {
    // Export classes
    BayneXLogger,
    BayneXHelpers,
    
    // Factory functions
    createLogger: (options = {}) => new BayneXLogger(options),
    
    // Direct helper methods for convenience
    ...BayneXHelpers,
    
    // Common utility collections
    time: {
        getCurrentTimestamp: BayneXHelpers.getCurrentTimestamp,
        formatTimestamp: BayneXHelpers.formatTimestamp,
        getTimeAgo: BayneXHelpers.getTimeAgo,
        getDuration: BayneXHelpers.getDuration,
        isToday: BayneXHelpers.isToday,
        isThisWeek: BayneXHelpers.isThisWeek,
        isThisMonth: BayneXHelpers.isThisMonth,
        delay: BayneXHelpers.delay
    },
    
    format: {
        currency: BayneXHelpers.formatCurrency,
        percentage: BayneXHelpers.formatPercentage,
        number: BayneXHelpers.formatNumber,
        largeNumber: BayneXHelpers.formatLargeNumber,
        bytes: BayneXHelpers.formatBytes,
        timestamp: BayneXHelpers.formatTimestamp
    },
    
    validate: {
        email: BayneXHelpers.isValidEmail,
        url: BayneXHelpers.isValidURL,
        json: BayneXHelpers.isValidJSON,
        tradeAmount: BayneXHelpers.isValidTradeAmount,
        percentage: BayneXHelpers.isValidPercentage
    },
    
    generate: {
        id: BayneXHelpers.generateId,
        uuid: BayneXHelpers.generateUUID,
        tradeId: BayneXHelpers.generateTradeId,
        strategyId: BayneXHelpers.generateStrategyId,
        sessionId: BayneXHelpers.generateSessionId,
        randomString: BayneXHelpers.generateRandomString,
        hash: BayneXHelpers.generateHash
    },
    
    array: {
        shuffle: BayneXHelpers.shuffle,
        chunk: BayneXHelpers.chunk,
        unique: BayneXHelpers.unique,
        groupBy: BayneXHelpers.groupBy,
        sortBy: BayneXHelpers.sortBy,
        findLast: BayneXHelpers.findLast
    },
    
    object: {
        deepClone: BayneXHelpers.deepClone,
        deepMerge: BayneXHelpers.deepMerge,
        pick: BayneXHelpers.pick,
        omit: BayneXHelpers.omit,
        getNestedValue: BayneXHelpers.getNestedValue,
        setNestedValue: BayneXHelpers.setNestedValue,
        flattenObject: BayneXHelpers.flattenObject
    },
    
    string: {
        capitalize: BayneXHelpers.capitalize,
        camelToKebab: BayneXHelpers.camelToKebab,
        kebabToCamel: BayneXHelpers.kebabToCamel,
        truncate: BayneXHelpers.truncate,
        sanitize: BayneXHelpers.sanitizeString
    },
    
    async: {
        delay: BayneXHelpers.delay,
        timeout: BayneXHelpers.timeout,
        retry: BayneXHelpers.retry,
        debounce: BayneXHelpers.debounce,
        throttle: BayneXHelpers.throttle
    },
    
    trading: {
        calculatePnL: BayneXHelpers.calculatePnL,
        calculateWinRate: BayneXHelpers.calculateWinRate,
        calculateDrawdown: BayneXHelpers.calculateDrawdown,
        calculateRiskReward: BayneXHelpers.calculateRiskReward,
        calculatePositionSize: BayneXHelpers.calculatePositionSize,
        getPlatformMinAmount: BayneXHelpers.getPlatformMinAmount,
        formatTradeDirection: BayneXHelpers.formatTradeDirection
    },
    
    market: {
        calculateSMA: BayneXHelpers.calculateSMA,
        calculateEMA: BayneXHelpers.calculateEMA,
        calculateRSI: BayneXHelpers.calculateRSI,
        detectTrend: BayneXHelpers.detectTrend
    },
    
    system: {
        getSystemInfo: BayneXHelpers.getSystemInfo,
        createTimer: BayneXHelpers.createTimer,
        measurePerformance: BayneXHelpers.measurePerformance,
        measureAsyncPerformance: BayneXHelpers.measureAsyncPerformance
    },
    
    file: {
        ensureDirectory: BayneXHelpers.ensureDirectory,
        fileExists: BayneXHelpers.fileExists,
        getFileSize: BayneXHelpers.getFileSize,
        getFileExtension: BayneXHelpers.getFileExtension,
        sanitizeFilename: BayneXHelpers.sanitizeFilename
    },
    
    color: {
        hexToRgb: BayneXHelpers.hexToRgb,
        rgbToHex: BayneXHelpers.rgbToHex,
        adjustBrightness: BayneXHelpers.adjustBrightness
    },
    
    // Constants and enums
    constants: {
        PLATFORMS: {
            DERIV: 'deriv',
            MT5: 'mt5',
            IQ: 'iq'
        },
        
        TRADE_DIRECTIONS: {
            CALL: 'call',
            PUT: 'put',
            UP: 'up',
            DOWN: 'down',
            BUY: 'buy',
            SELL: 'sell'
        },
        
        TRADE_RESULTS: {
            WIN: 'win',
            LOSS: 'loss',
            BREAKEVEN: 'breakeven',
            PENDING: 'pending',
            CANCELLED: 'cancelled'
        },
        
        MARKET_TRENDS: {
            UPTREND: 'uptrend',
            DOWNTREND: 'downtrend',
            SIDEWAYS: 'sideways'
        },
        
        STRATEGY_TYPES: {
            MOMENTUM: 'momentum',
            REVERSAL: 'reversal',
            BREAKOUT: 'breakout',
            BOUNDARY_BREAKER: 'boundary_breaker',
            SWING: 'swing',
            MARTINGALE: 'martingale',
            ANTI_MARTINGALE: 'anti_martingale',
            GRID: 'grid',
            HEDGING: 'hedging'
        },
        
        RISK_LEVELS: {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        },
        
        SYSTEM_STATES: {
            STARTING: 'starting',
            RUNNING: 'running',
            PAUSED: 'paused',
            STOPPING: 'stopping',
            STOPPED: 'stopped',
            ERROR: 'error'
        },
        
        LOG_LEVELS: {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warn',
            ERROR: 'error'
        },
        
        DEFAULT_TIMEFRAMES: {
            M1: '1m',
            M5: '5m',
            M15: '15m',
            M30: '30m',
            H1: '1h',
            H4: '4h',
            D1: '1d'
        },
        
        NOTIFICATION_TYPES: {
            TRADE: 'trade',
            BALANCE: 'balance',
            STRATEGY: 'strategy',
            RISK: 'risk',
            GOAL: 'goal',
            SYSTEM: 'system',
            ERROR: 'error'
        }
    },
    
    // Error handling utilities
    error: {
        createError: (message, code, details = {}) => {
            const error = new Error(message);
            error.code = code;
            error.details = details;
            error.timestamp = Date.now();
            return error;
        },
        
        isOperationalError: (error) => {
            return error.isOperational === true;
        },
        
        formatError: (error) => {
            return {
                message: error.message,
                code: error.code || 'UNKNOWN_ERROR',
                stack: error.stack,
                details: error.details || {},
                timestamp: error.timestamp || Date.now()
            };
        },
        
        sanitizeErrorForLogging: (error) => {
            const sanitized = { ...error };
            
            // Remove sensitive information
            if (sanitized.details) {
                const sensitiveKeys = ['password', 'token', 'key', 'secret'];
                sensitiveKeys.forEach(key => {
                    if (sanitized.details[key]) {
                        sanitized.details[key] = '[REDACTED]';
                    }
                });
            }
            
            return sanitized;
        }
    },
    
    // Math utilities
    math: {
        clamp: BayneXHelpers.clamp,
        randomBetween: BayneXHelpers.randomBetween,
        randomIntBetween: BayneXHelpers.randomIntBetween,
        roundToDecimals: BayneXHelpers.roundToDecimals,
        
        average: (numbers) => {
            return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        },
        
        median: (numbers) => {
            const sorted = [...numbers].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        },
        
        standardDeviation: (numbers) => {
            const avg = module.exports.math.average(numbers);
            const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
            const avgSquareDiff = module.exports.math.average(squareDiffs);
            return Math.sqrt(avgSquareDiff);
        },
        
        percentile: (numbers, percentile) => {
            const sorted = [...numbers].sort((a, b) => a - b);
            const index = (percentile / 100) * (sorted.length - 1);
            
            if (Math.floor(index) === index) {
                return sorted[index];
            } else {
                const lower = sorted[Math.floor(index)];
                const upper = sorted[Math.ceil(index)];
                return lower + (upper - lower) * (index - Math.floor(index));
            }
        }
    },
    
    // Environment utilities
    env: {
        isDevelopment: () => process.env.NODE_ENV === 'development',
        isProduction: () => process.env.NODE_ENV === 'production',
        isTest: () => process.env.NODE_ENV === 'test',
        
        get: (key, defaultValue = null) => {
            return process.env[key] || defaultValue;
        },
        
        getRequired: (key) => {
            const value = process.env[key];
            if (!value) {
                throw new Error(`Required environment variable ${key} is not set`);
            }
            return value;
        },
        
        getBoolean: (key, defaultValue = false) => {
            const value = process.env[key];
            if (!value) return defaultValue;
            return value.toLowerCase() === 'true' || value === '1';
        },
        
        getNumber: (key, defaultValue = 0) => {
            const value = process.env[key];
            if (!value) return defaultValue;
            const num = Number(value);
            return isNaN(num) ? defaultValue : num;
        },
        
        getArray: (key, delimiter = ',', defaultValue = []) => {
            const value = process.env[key];
            if (!value) return defaultValue;
            return value.split(delimiter).map(item => item.trim());
        }
    }
};
