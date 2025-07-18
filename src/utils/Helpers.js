// src/utils/Helpers.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class BayneXHelpers {
    // ID Generation
    static generateId(prefix = '', length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return prefix ? `${prefix}_${result}` : result;
    }
    
    static generateTradeId() {
        return this.generateId('trade', 12);
    }
    
    static generateStrategyId() {
        return this.generateId('strategy', 10);
    }
    
    static generateSessionId() {
        return this.generateId('session', 16);
    }
    
    static generateUUID() {
        return crypto.randomUUID();
    }
    
    // Time and Date Utilities
    static getCurrentTimestamp() {
        return Date.now();
    }
    
    static formatTimestamp(timestamp, format = 'ISO') {
        const date = new Date(timestamp);
        
        switch (format) {
            case 'ISO':
                return date.toISOString();
            case 'human':
                return date.toLocaleString();
            case 'date':
                return date.toLocaleDateString();
            case 'time':
                return date.toLocaleTimeString();
            case 'trading':
                return date.toISOString().replace('T', ' ').substr(0, 19);
            default:
                return date.toString();
        }
    }
    
    static getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return `${seconds}s ago`;
    }
    
    static getDuration(startTime, endTime = Date.now()) {
        const diff = endTime - startTime;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    
    static isToday(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }
    
    static isThisWeek(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        return date >= weekStart;
    }
    
    static isThisMonth(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        return date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }
    
    // Number and Currency Utilities
    static formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
    
    static formatPercentage(value, decimals = 1) {
        return `${value.toFixed(decimals)}%`;
    }
    
    static formatNumber(number, decimals = 2) {
        return Number(number).toFixed(decimals);
    }
    
    static formatLargeNumber(number) {
        if (number >= 1000000) {
            return (number / 1000000).toFixed(1) + 'M';
        } else if (number >= 1000) {
            return (number / 1000).toFixed(1) + 'K';
        }
        return number.toString();
    }
    
    static roundToDecimals(number, decimals = 2) {
        return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    static randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    static randomIntBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // String Utilities
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    static camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }
    
    static kebabToCamel(str) {
        return str.replace(/-./g, x => x[1].toUpperCase());
    }
    
    static truncate(str, length = 50, suffix = '...') {
        if (str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    }
    
    static sanitizeString(str) {
        return str.replace(/[<>\"'&]/g, '');
    }
    
    static generateRandomString(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Array Utilities
    static shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    static unique(array) {
        return [...new Set(array)];
    }
    
    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = typeof key === 'function' ? key(item) : item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }
    
    static sortBy(array, key, direction = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            
            if (direction === 'desc') {
                return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            }
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        });
    }
    
    static findLast(array, predicate) {
        for (let i = array.length - 1; i >= 0; i--) {
            if (predicate(array[i], i, array)) {
                return array[i];
            }
        }
        return undefined;
    }
    
    // Object Utilities
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    static deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    static pick(obj, keys) {
        const result = {};
        keys.forEach(key => {
            if (key in obj) {
                result[key] = obj[key];
            }
        });
        return result;
    }
    
    static omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => {
            delete result[key];
        });
        return result;
    }
    
    static getNestedValue(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }
    
    static setNestedValue(obj, path, value) {
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
    }
    
    static flattenObject(obj, prefix = '', separator = '.') {
        const flattened = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}${separator}${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    Object.assign(flattened, this.flattenObject(obj[key], newKey, separator));
                } else {
                    flattened[newKey] = obj[key];
                }
            }
        }
        
        return flattened;
    }
    
    // Validation Utilities
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    static isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    static isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }
    
    static isValidTradeAmount(amount, min = 0.35, max = 1000) {
        const num = Number(amount);
        return !isNaN(num) && num >= min && num <= max;
    }
    
    static isValidPercentage(value) {
        const num = Number(value);
        return !isNaN(num) && num >= 0 && num <= 100;
    }
    
    // File and Path Utilities
    static async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.error(`Failed to create directory ${dirPath}:`, error);
            return false;
        }
    }
    
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }
    
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }
    
    static sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    }
    
    // Async Utilities
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static timeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ms)
            )
        ]);
    }
    
    static async retry(fn, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await this.delay(delay * attempt);
                }
            }
        }
        
        throw lastError;
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Trading-specific Utilities
    static calculatePnL(entryPrice, exitPrice, direction, amount) {
        if (direction === 'call' || direction === 'up') {
            return exitPrice > entryPrice ? amount : -amount;
        } else {
            return exitPrice < entryPrice ? amount : -amount;
        }
    }
    
    static calculateWinRate(wins, losses) {
        const total = wins + losses;
        return total > 0 ? (wins / total) * 100 : 0;
    }
    
    static calculateDrawdown(peakBalance, currentBalance) {
        if (peakBalance <= 0) return 0;
        return ((peakBalance - currentBalance) / peakBalance) * 100;
    }
    
    static calculateRiskReward(stopLoss, takeProfit, entryPrice) {
        const risk = Math.abs(entryPrice - stopLoss);
        const reward = Math.abs(takeProfit - entryPrice);
        return risk > 0 ? reward / risk : 0;
    }
    
    static calculatePositionSize(accountBalance, riskPercentage, stopLossDistance) {
        const riskAmount = accountBalance * (riskPercentage / 100);
        return riskAmount / stopLossDistance;
    }
    
    static getPlatformMinAmount(platform) {
        const minimums = {
            deriv: 0.35,
            mt5: 1.0,
            iq: 1.0
        };
        return minimums[platform.toLowerCase()] || 1.0;
    }
    
    static formatTradeDirection(direction) {
        const directions = {
            call: 'CALL',
            put: 'PUT',
            up: 'UP',
            down: 'DOWN',
            buy: 'BUY',
            sell: 'SELL'
        };
        return directions[direction.toLowerCase()] || direction.toUpperCase();
    }
    
    // Market Analysis Utilities
    static calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }
    
    static calculateEMA(prices, period) {
        if (prices.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }
    
    static calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return null;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    static detectTrend(prices, period = 20) {
        if (prices.length < period) return 'sideways';
        
        const recentPrices = prices.slice(-period);
        const firstPrice = recentPrices[0];
        const lastPrice = recentPrices[recentPrices.length - 1];
        
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;
        
        if (change > 1) return 'uptrend';
        if (change < -1) return 'downtrend';
        return 'sideways';
    }
    
    // System Utilities
    static getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV || 'development'
        };
    }
    
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    static hashString(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }
    
    static generateHash(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return this.hashString(str);
    }
    
    // Color Utilities for UI
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    static adjustBrightness(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const factor = 1 + (percent / 100);
        const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
        const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
        const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
        
        return this.rgbToHex(r, g, b);
    }
    
    // Performance measurement
    static createTimer() {
        const start = process.hrtime.bigint();
        return {
            elapsed: () => {
                const end = process.hrtime.bigint();
                return Number(end - start) / 1000000; // Convert to milliseconds
            }
        };
    }
    
    static measurePerformance(name, fn) {
        const timer = this.createTimer();
        const result = fn();
        const elapsed = timer.elapsed();
        
        console.log(`[Performance] ${name}: ${elapsed.toFixed(2)}ms`);
        return result;
    }
    
    static async measureAsyncPerformance(name, fn) {
        const timer = this.createTimer();
        const result = await fn();
        const elapsed = timer.elapsed();
        
        console.log(`[Performance] ${name}: ${elapsed.toFixed(2)}ms`);
        return result;
    }
}

module.exports = BayneXHelpers;
