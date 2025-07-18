// src/utils/Logger.js
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class BayneXLogger extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            level: options.level || process.env.LOG_LEVEL || 'info',
            logPath: options.logPath || path.join(__dirname, '../logs'),
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: options.maxFiles || 10,
            enableConsole: options.enableConsole !== false,
            enableFile: options.enableFile !== false,
            enableRotation: options.enableRotation !== false,
            dateFormat: options.dateFormat || 'YYYY-MM-DD HH:mm:ss',
            format: options.format || 'timestamp level component message data',
            enableColors: options.enableColors !== false,
            ...options
        };
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[37m',   // White
            reset: '\x1b[0m'
        };
        
        this.currentLogFile = null;
        this.logFileSize = 0;
        this.rotationNumber = 0;
        
        this.initialize();
    }
    
    async initialize() {
        try {
            if (this.options.enableFile) {
                // Ensure log directory exists
                await fs.mkdir(this.options.logPath, { recursive: true });
                
                // Initialize log file
                await this.initializeLogFile();
            }
            
            // Set up process event handlers
            this.setupProcessHandlers();
            
            this.info('Logger', 'Logger initialized successfully', {
                level: this.options.level,
                enableConsole: this.options.enableConsole,
                enableFile: this.options.enableFile,
                logPath: this.options.logPath
            });
        } catch (error) {
            console.error('Logger initialization failed:', error);
        }
    }
    
    async initializeLogFile() {
        const timestamp = new Date().toISOString().split('T')[0];
        this.currentLogFile = path.join(this.options.logPath, `baynex-${timestamp}.log`);
        
        try {
            const stats = await fs.stat(this.currentLogFile);
            this.logFileSize = stats.size;
            
            // Check if rotation is needed
            if (this.logFileSize >= this.options.maxFileSize) {
                await this.rotateLogFile();
            }
        } catch (error) {
            // File doesn't exist, create it
            this.logFileSize = 0;
        }
    }
    
    setupProcessHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.error('Process', 'Uncaught Exception', {
                error: error.message,
                stack: error.stack
            });
            
            // Give time for log to be written
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.error('Process', 'Unhandled Promise Rejection', {
                reason: reason.toString(),
                promise: promise.toString()
            });
        });
        
        // Handle process termination signals
        ['SIGTERM', 'SIGINT'].forEach(signal => {
            process.on(signal, () => {
                this.info('Process', `Received ${signal}, shutting down gracefully`);
                this.emit('shutdown', signal);
            });
        });
    }
    
    // Main logging methods
    error(component, message, data = {}) {
        this.log('error', component, message, data);
    }
    
    warn(component, message, data = {}) {
        this.log('warn', component, message, data);
    }
    
    info(component, message, data = {}) {
        this.log('info', component, message, data);
    }
    
    debug(component, message, data = {}) {
        this.log('debug', component, message, data);
    }
    
    // Core logging function
    async log(level, component, message, data = {}) {
        // Check if level should be logged
        if (this.levels[level] > this.levels[this.options.level]) {
            return;
        }
        
        const logEntry = this.createLogEntry(level, component, message, data);
        
        // Emit log event
        this.emit('log', logEntry);
        
        // Console output
        if (this.options.enableConsole) {
            this.writeToConsole(logEntry);
        }
        
        // File output
        if (this.options.enableFile) {
            await this.writeToFile(logEntry);
        }
    }
    
    createLogEntry(level, component, message, data) {
        const timestamp = new Date();
        
        return {
            timestamp,
            level: level.toUpperCase(),
            component,
            message,
            data: Object.keys(data).length > 0 ? data : undefined,
            pid: process.pid,
            memory: this.getMemoryUsage(),
            iso: timestamp.toISOString()
        };
    }
    
    writeToConsole(logEntry) {
        const formatted = this.formatLogEntry(logEntry, true);
        
        // Use appropriate console method
        switch (logEntry.level.toLowerCase()) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'debug':
                console.debug(formatted);
                break;
            default:
                console.log(formatted);
        }
    }
    
    async writeToFile(logEntry) {
        try {
            const formatted = this.formatLogEntry(logEntry, false) + '\n';
            
            // Check if rotation is needed
            if (this.options.enableRotation && 
                this.logFileSize + Buffer.byteLength(formatted) >= this.options.maxFileSize) {
                await this.rotateLogFile();
            }
            
            // Write to file
            await fs.appendFile(this.currentLogFile, formatted, 'utf8');
            this.logFileSize += Buffer.byteLength(formatted);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    
    formatLogEntry(logEntry, useColors = false) {
        const {
            timestamp,
            level,
            component,
            message,
            data,
            pid,
            memory
        } = logEntry;
        
        // Format timestamp
        const timeStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
        
        // Apply colors if enabled
        const levelStr = useColors && this.options.enableColors ? 
            `${this.colors[level.toLowerCase()] || ''}${level.padEnd(5)}${this.colors.reset}` :
            level.padEnd(5);
        
        const componentStr = `[${component}]`.padEnd(15);
        
        // Build base format
        let formatted = `${timeStr} ${levelStr} ${componentStr} ${message}`;
        
        // Add data if present
        if (data) {
            const dataStr = typeof data === 'object' ? 
                JSON.stringify(data, this.jsonReplacer, 2) : 
                data.toString();
            formatted += ` | Data: ${dataStr}`;
        }
        
        // Add memory info for debug level
        if (level.toLowerCase() === 'debug') {
            formatted += ` | Memory: ${memory.rss}MB | PID: ${pid}`;
        }
        
        return formatted;
    }
    
    jsonReplacer(key, value) {
        // Handle circular references and sensitive data
        if (typeof value === 'object' && value !== null) {
            if (value.__logged) {
                return '[Circular]';
            }
            value.__logged = true;
        }
        
        // Hide sensitive data
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apikey', 'auth'];
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            return '[REDACTED]';
        }
        
        return value;
    }
    
    async rotateLogFile() {
        if (!this.currentLogFile) return;
        
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const baseFileName = `baynex-${timestamp}`;
            
            // Find next rotation number
            this.rotationNumber++;
            const rotatedFileName = `${baseFileName}-${this.rotationNumber}.log`;
            const rotatedPath = path.join(this.options.logPath, rotatedFileName);
            
            // Rename current file
            await fs.rename(this.currentLogFile, rotatedPath);
            
            // Create new log file
            this.logFileSize = 0;
            
            // Clean up old files
            await this.cleanupOldFiles();
            
            this.info('Logger', 'Log file rotated', {
                oldFile: this.currentLogFile,
                newFile: rotatedPath,
                size: this.logFileSize
            });
        } catch (error) {
            console.error('Log rotation failed:', error);
        }
    }
    
    async cleanupOldFiles() {
        try {
            const files = await fs.readdir(this.options.logPath);
            const logFiles = files
                .filter(file => file.startsWith('baynex-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.options.logPath, file),
                    mtime: 0
                }));
            
            // Get file stats
            for (const file of logFiles) {
                try {
                    const stats = await fs.stat(file.path);
                    file.mtime = stats.mtime.getTime();
                } catch (error) {
                    // File might have been deleted
                    continue;
                }
            }
            
            // Sort by modification time (newest first)
            logFiles.sort((a, b) => b.mtime - a.mtime);
            
            // Remove excess files
            if (logFiles.length > this.options.maxFiles) {
                const filesToDelete = logFiles.slice(this.options.maxFiles);
                
                for (const file of filesToDelete) {
                    try {
                        await fs.unlink(file.path);
                        this.debug('Logger', 'Old log file deleted', { file: file.name });
                    } catch (error) {
                        console.error('Failed to delete old log file:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Log cleanup failed:', error);
        }
    }
    
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024)
        };
    }
    
    // Trading-specific logging methods
    logTrade(tradeData) {
        const { platform, symbol, direction, amount, result, pnl, strategy } = tradeData;
        
        this.info('Trade', `${result.toUpperCase()} trade executed`, {
            platform,
            symbol,
            direction,
            amount,
            pnl,
            strategy,
            timestamp: tradeData.timestamp || Date.now()
        });
    }
    
    logBalance(balanceData) {
        this.info('Balance', 'Balance updated', {
            totalBalance: balanceData.totalBalance,
            change: balanceData.change,
            platforms: balanceData.platforms
        });
    }
    
    logStrategy(strategyData) {
        this.info('Strategy', strategyData.action || 'Strategy update', {
            strategy: strategyData.name,
            performance: strategyData.performance,
            active: strategyData.active,
            changes: strategyData.changes
        });
    }
    
    logRisk(riskData) {
        const level = riskData.level === 'high' ? 'warn' : 'info';
        this[level]('Risk', riskData.message || 'Risk update', {
            level: riskData.level,
            triggers: riskData.triggers,
            actions: riskData.actions,
            metrics: riskData.metrics
        });
    }
    
    logGoal(goalData) {
        this.info('Goal', goalData.action || 'Goal update', {
            goalId: goalData.id,
            title: goalData.title,
            progress: goalData.progress,
            status: goalData.status,
            type: goalData.type
        });
    }
    
    logPerformance(performanceData) {
        this.info('Performance', 'Performance metrics updated', {
            winRate: performanceData.winRate,
            profit: performanceData.profit,
            trades: performanceData.trades,
            timeframe: performanceData.timeframe
        });
    }
    
    // System monitoring logs
    logSystemHealth(healthData) {
        const level = healthData.status === 'healthy' ? 'info' : 'warn';
        this[level]('System', 'System health check', {
            status: healthData.status,
            cpu: healthData.cpu,
            memory: healthData.memory,
            disk: healthData.disk,
            connections: healthData.connections
        });
    }
    
    logAPI(requestData) {
        this.debug('API', `${requestData.method} ${requestData.path}`, {
            status: requestData.status,
            duration: requestData.duration,
            ip: requestData.ip,
            userAgent: requestData.userAgent,
            size: requestData.size
        });
    }
    
    // Utility methods
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.options.level = level;
            this.info('Logger', 'Log level changed', { newLevel: level });
        } else {
            this.warn('Logger', 'Invalid log level', { attemptedLevel: level });
        }
    }
    
    getLevel() {
        return this.options.level;
    }
    
    isLevelEnabled(level) {
        return this.levels[level] <= this.levels[this.options.level];
    }
    
    // Create child logger with specific component
    child(component, additionalData = {}) {
        return {
            error: (message, data = {}) => this.error(component, message, { ...additionalData, ...data }),
            warn: (message, data = {}) => this.warn(component, message, { ...additionalData, ...data }),
            info: (message, data = {}) => this.info(component, message, { ...additionalData, ...data }),
            debug: (message, data = {}) => this.debug(component, message, { ...additionalData, ...data }),
            
            // Trading-specific methods
            logTrade: (tradeData) => this.logTrade({ ...additionalData, ...tradeData }),
            logBalance: (balanceData) => this.logBalance({ ...additionalData, ...balanceData }),
            logStrategy: (strategyData) => this.logStrategy({ ...additionalData, ...strategyData }),
            logRisk: (riskData) => this.logRisk({ ...additionalData, ...riskData }),
            logGoal: (goalData) => this.logGoal({ ...additionalData, ...goalData }),
            logPerformance: (performanceData) => this.logPerformance({ ...additionalData, ...performanceData })
        };
    }
    
    // Query logs (basic implementation)
    async queryLogs(options = {}) {
        try {
            const {
                level,
                component,
                startTime,
                endTime,
                limit = 100,
                search
            } = options;
            
            // For now, just read current log file
            // In production, consider using a proper log aggregation system
            const content = await fs.readFile(this.currentLogFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            let filteredLines = lines;
            
            // Apply filters
            if (level) {
                filteredLines = filteredLines.filter(line => line.includes(level.toUpperCase()));
            }
            
            if (component) {
                filteredLines = filteredLines.filter(line => line.includes(`[${component}]`));
            }
            
            if (search) {
                filteredLines = filteredLines.filter(line => line.toLowerCase().includes(search.toLowerCase()));
            }
            
            // Apply limit
            filteredLines = filteredLines.slice(-limit);
            
            return filteredLines.map(line => this.parseLogLine(line));
        } catch (error) {
            this.error('Logger', 'Log query failed', { error: error.message });
            return [];
        }
    }
    
    parseLogLine(line) {
        // Basic log line parsing
        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (\w+)\s+\[([^\]]+)\]\s+(.+)/);
        
        if (match) {
            return {
                timestamp: match[1],
                level: match[2],
                component: match[3],
                message: match[4]
            };
        }
        
        return { raw: line };
    }
    
    // Cleanup
    async cleanup() {
        this.info('Logger', 'Logger shutting down');
        
        // Remove process handlers to prevent memory leaks
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
        
        // Final log
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

module.exports = BayneXLogger;
