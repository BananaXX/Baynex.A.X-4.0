// ================================
// BAYNEX.A.X DATABASE MANAGER
// SQLite Data Persistence & Analytics
// ================================

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DATABASE_PATH || './data/baynex.db';
        this.isConnected = false;
        this.dependencies = [];
        
        this.config = {
            encryption: process.env.DATABASE_ENCRYPTION === 'true',
            compression: process.env.DATABASE_COMPRESSION === 'true',
            autoBackup: process.env.DATABASE_AUTO_BACKUP === 'true',
            backupInterval: parseInt(process.env.DATABASE_BACKUP_INTERVAL) || 3600000, // 1 hour
            maxBackups: 10,
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            cacheSize: 10000
        };
        
        this.stats = {
            totalQueries: 0,
            successfulQueries: 0,
            failedQueries: 0,
            lastBackup: null,
            dbSize: 0,
            connections: 0
        };
        
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'BAYNEX_DEFAULT_KEY_2024';
    }

    async initialize() {
        console.log('💾 Initializing Database Manager...');
        
        try {
            // Ensure data directory exists
            await this.ensureDataDirectory();
            
            // Connect to database
            await this.connect();
            
            // Initialize schema
            await this.initializeSchema();
            
            // Set up database optimization
            await this.optimizeDatabase();
            
            // Start backup scheduler if enabled
            if (this.config.autoBackup) {
                this.startBackupScheduler();
            }
            
            console.log('✅ Database Manager initialized');
            console.log(`💾 Database: ${this.dbPath}`);
            console.log(`🔐 Encryption: ${this.config.encryption ? 'Enabled' : 'Disabled'}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Database Manager initialization failed:', error);
            throw error;
        }
    }

    async ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        
        try {
            await fs.access(dataDir);
        } catch (error) {
            await fs.mkdir(dataDir, { recursive: true });
            console.log(`📁 Created data directory: ${dataDir}`);
        }
    }

    async connect() {
        console.log('🔌 Connecting to SQLite database...');
        
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (error) => {
                if (error) {
                    reject(error);
                } else {
                    this.isConnected = true;
                    this.stats.connections++;
                    console.log('✅ Database connected successfully');
                    resolve();
                }
            });
        });
    }

    async optimizeDatabase() {
        console.log('⚡ Optimizing database performance...');
        
        const optimizations = [
            `PRAGMA journal_mode = ${this.config.journalMode}`,
            `PRAGMA synchronous = ${this.config.synchronous}`,
            `PRAGMA cache_size = ${this.config.cacheSize}`,
            'PRAGMA foreign_keys = ON',
            'PRAGMA temp_store = MEMORY',
            'PRAGMA mmap_size = 268435456' // 256MB
        ];
        
        for (const pragma of optimizations) {
            await this.run(pragma);
        }
        
        console.log('✅ Database optimized');
    }

    async initializeSchema() {
        console.log('🏗️ Initializing database schema...');
        
        const schemas = [
            this.createTradesTable(),
            this.createStrategiesTable(),
            this.createMarketDataTable(),
            this.createIndicatorsTable(),
            this.createRiskEventsTable(),
            this.createGoalsTable(),
            this.createAchievementsTable(),
            this.createSystemLogsTable(),
            this.createDailyStatsTable(),
            this.createUsersTable(),
            this.createConfigTable()
        ];
        
        for (const schema of schemas) {
            await this.run(schema);
        }
        
        // Create indexes for performance
        await this.createIndexes();
        
        console.log('✅ Database schema initialized');
    }

    createTradesTable() {
        return `
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                platform TEXT NOT NULL,
                asset TEXT NOT NULL,
                direction TEXT NOT NULL,
                amount REAL NOT NULL,
                entry_price REAL,
                exit_price REAL,
                profit REAL,
                strategy_id TEXT,
                strategy_name TEXT,
                confidence REAL,
                entry_time INTEGER,
                exit_time INTEGER,
                duration INTEGER,
                status TEXT DEFAULT 'active',
                result TEXT,
                commission REAL DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createStrategiesTable() {
        return `
            CREATE TABLE IF NOT EXISTS strategies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                parameters TEXT, -- JSON
                indicators TEXT, -- JSON
                rules TEXT, -- JSON
                performance TEXT, -- JSON
                evolution TEXT, -- JSON
                status TEXT DEFAULT 'active',
                confidence REAL DEFAULT 0.5,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createMarketDataTable() {
        return `
            CREATE TABLE IF NOT EXISTS market_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset TEXT NOT NULL,
                price REAL NOT NULL,
                bid REAL,
                ask REAL,
                volume REAL DEFAULT 0,
                spread REAL DEFAULT 0,
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createIndicatorsTable() {
        return `
            CREATE TABLE IF NOT EXISTS indicators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset TEXT NOT NULL,
                indicator_name TEXT NOT NULL,
                period INTEGER,
                value REAL,
                data TEXT, -- JSON for complex indicators
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createRiskEventsTable() {
        return `
            CREATE TABLE IF NOT EXISTS risk_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                description TEXT,
                severity TEXT DEFAULT 'info',
                data TEXT, -- JSON
                account_balance REAL,
                daily_pl REAL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createGoalsTable() {
        return `
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                target_value REAL,
                current_value REAL DEFAULT 0,
                deadline INTEGER,
                status TEXT DEFAULT 'active',
                priority TEXT DEFAULT 'medium',
                category TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createAchievementsTable() {
        return `
            CREATE TABLE IF NOT EXISTS achievements (
                id TEXT PRIMARY KEY,
                goal_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                points INTEGER DEFAULT 0,
                badge TEXT,
                achieved_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (goal_id) REFERENCES goals (id)
            )
        `;
    }

    createSystemLogsTable() {
        return `
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                component TEXT,
                data TEXT, -- JSON
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createDailyStatsTable() {
        return `
            CREATE TABLE IF NOT EXISTS daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                trades_count INTEGER DEFAULT 0,
                profit REAL DEFAULT 0,
                loss REAL DEFAULT 0,
                net_pl REAL DEFAULT 0,
                win_rate REAL DEFAULT 0,
                account_balance REAL,
                max_drawdown REAL DEFAULT 0,
                best_strategy TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createUsersTable() {
        return `
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE,
                password_hash TEXT,
                role TEXT DEFAULT 'trader',
                preferences TEXT, -- JSON
                last_login INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    createConfigTable() {
        return `
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT,
                description TEXT,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `;
    }

    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(entry_time)',
            'CREATE INDEX IF NOT EXISTS idx_trades_platform ON trades(platform)',
            'CREATE INDEX IF NOT EXISTS idx_trades_asset ON trades(asset)',
            'CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id)',
            'CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)',
            'CREATE INDEX IF NOT EXISTS idx_market_data_asset ON market_data(asset)',
            'CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_indicators_asset ON indicators(asset)',
            'CREATE INDEX IF NOT EXISTS idx_indicators_name ON indicators(indicator_name)',
            'CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(event_type)',
            'CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)',
            'CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)'
        ];
        
        for (const index of indexes) {
            await this.run(index);
        }
    }

    // ================================
    // CORE DATABASE OPERATIONS
    // ================================
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(error) {
                if (error) {
                    console.error('❌ Database run error:', error);
                    reject(error);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) {
                    console.error('❌ Database get error:', error);
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) {
                    console.error('❌ Database all error:', error);
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // ================================
    // TRADING DATA OPERATIONS
    // ================================
    async saveTrade(trade) {
        try {
            const sql = `
                INSERT OR REPLACE INTO trades (
                    id, platform, asset, direction, amount, entry_price, exit_price,
                    profit, strategy_id, strategy_name, confidence, entry_time,
                    exit_time, duration, status, result, commission
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                trade.id,
                trade.platform,
                trade.asset,
                trade.direction,
                trade.amount,
                trade.entry_price || trade.entryPrice,
                trade.exit_price || trade.exitPrice,
                trade.profit,
                trade.strategy_id || trade.strategyId,
                trade.strategy_name || trade.strategy,
                trade.confidence,
                trade.entry_time ? new Date(trade.entry_time).getTime() / 1000 : 
                trade.entryTime ? new Date(trade.entryTime).getTime() / 1000 : null,
                trade.exit_time ? new Date(trade.exit_time).getTime() / 1000 : 
                trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : null,
                trade.duration,
                trade.status,
                trade.result,
                trade.commission || 0
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
            console.log(`💾 Trade saved: ${trade.id}`);
            
        } catch (error) {
            console.error('❌ Error saving trade:', error);
            this.stats.failedQueries++;
            throw error;
        }
        
        this.stats.totalQueries++;
    }

    async getTrade(tradeId) {
        try {
            const sql = 'SELECT * FROM trades WHERE id = ?';
            const trade = await this.get(sql, [tradeId]);
            
            this.stats.successfulQueries++;
            return trade;
            
        } catch (error) {
            console.error('❌ Error getting trade:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getTradeHistory(limit = 100, offset = 0) {
        try {
            const sql = `
                SELECT * FROM trades 
                ORDER BY entry_time DESC 
                LIMIT ? OFFSET ?
            `;
            
            const trades = await this.all(sql, [limit, offset]);
            this.stats.successfulQueries++;
            
            return trades;
            
        } catch (error) {
            console.error('❌ Error getting trade history:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getCompletedTradesCount() {
        try {
            const sql = "SELECT COUNT(*) as count FROM trades WHERE status = 'closed'";
            const result = await this.get(sql);
            
            this.stats.successfulQueries++;
            return result.count;
            
        } catch (error) {
            console.error('❌ Error getting completed trades count:', error);
            this.stats.failedQueries++;
            return 0;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getWinningTradesCount() {
        try {
            const sql = "SELECT COUNT(*) as count FROM trades WHERE result = 'win'";
            const result = await this.get(sql);
            
            this.stats.successfulQueries++;
            return result.count;
            
        } catch (error) {
            console.error('❌ Error getting winning trades count:', error);
            this.stats.failedQueries++;
            return 0;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getDailyTradeCount() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const sql = `
                SELECT COUNT(*) as count FROM trades 
                WHERE date(entry_time, 'unixepoch') = ?
            `;
            
            const result = await this.get(sql, [today]);
            this.stats.successfulQueries++;
            
            return result.count;
            
        } catch (error) {
            console.error('❌ Error getting daily trade count:', error);
            this.stats.failedQueries++;
            return 0;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // STRATEGY DATA OPERATIONS
    // ================================
    async saveStrategy(strategy) {
        try {
            const sql = `
                INSERT OR REPLACE INTO strategies (
                    id, name, type, description, parameters, indicators,
                    rules, performance, evolution, status, confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                strategy.id,
                strategy.name,
                strategy.type,
                strategy.description,
                JSON.stringify(strategy.parameters),
                JSON.stringify(strategy.indicators),
                JSON.stringify(strategy.rules),
                JSON.stringify(strategy.performance),
                JSON.stringify(strategy.evolution),
                strategy.status,
                strategy.confidence
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
            console.log(`💾 Strategy saved: ${strategy.name}`);
            
        } catch (error) {
            console.error('❌ Error saving strategy:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getStrategy(strategyId) {
        try {
            const sql = 'SELECT * FROM strategies WHERE id = ?';
            const strategy = await this.get(sql, [strategyId]);
            
            if (strategy) {
                // Parse JSON fields
                strategy.parameters = JSON.parse(strategy.parameters || '{}');
                strategy.indicators = JSON.parse(strategy.indicators || '[]');
                strategy.rules = JSON.parse(strategy.rules || '{}');
                strategy.performance = JSON.parse(strategy.performance || '{}');
                strategy.evolution = JSON.parse(strategy.evolution || '{}');
            }
            
            this.stats.successfulQueries++;
            return strategy;
            
        } catch (error) {
            console.error('❌ Error getting strategy:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getAllStrategies() {
        try {
            const sql = 'SELECT * FROM strategies ORDER BY created_at DESC';
            const strategies = await this.all(sql);
            
            // Parse JSON fields for each strategy
            for (const strategy of strategies) {
                strategy.parameters = JSON.parse(strategy.parameters || '{}');
                strategy.indicators = JSON.parse(strategy.indicators || '[]');
                strategy.rules = JSON.parse(strategy.rules || '{}');
                strategy.performance = JSON.parse(strategy.performance || '{}');
                strategy.evolution = JSON.parse(strategy.evolution || '{}');
            }
            
            this.stats.successfulQueries++;
            return strategies;
            
        } catch (error) {
            console.error('❌ Error getting all strategies:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // MARKET DATA OPERATIONS
    // ================================
    async saveMarketData(asset, dataPoints) {
        try {
            const sql = `
                INSERT INTO market_data (asset, price, bid, ask, volume, spread, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const point of dataPoints) {
                const params = [
                    asset,
                    point.price,
                    point.bid || point.price,
                    point.ask || point.price,
                    point.volume || 0,
                    point.spread || 0,
                    Math.floor(point.timestamp.getTime() / 1000)
                ];
                
                await this.run(sql, params);
            }
            
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving market data:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getHistoricalData(asset, limit = 1000) {
        try {
            const sql = `
                SELECT * FROM market_data 
                WHERE asset = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            
            const data = await this.all(sql, [asset, limit]);
            this.stats.successfulQueries++;
            
            return data.map(row => ({
                price: row.price,
                bid: row.bid,
                ask: row.ask,
                volume: row.volume,
                spread: row.spread,
                timestamp: new Date(row.timestamp * 1000)
            }));
            
        } catch (error) {
            console.error('❌ Error getting historical data:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // INDICATOR OPERATIONS
    // ================================
    async saveIndicators(asset, indicators) {
        try {
            // Clear old indicators for this asset (keep last 24 hours)
            const cutoff = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
            await this.run('DELETE FROM indicators WHERE asset = ? AND timestamp < ?', [asset, cutoff]);
            
            const sql = `
                INSERT INTO indicators (asset, indicator_name, period, value, data)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            // Save each indicator type
            for (const [indicatorName, indicatorData] of Object.entries(indicators)) {
                if (indicatorName === 'asset') continue;
                
                const params = [
                    asset,
                    indicatorName,
                    null, // period (would be specific to each indicator)
                    null, // single value (for simple indicators)
                    JSON.stringify(indicatorData)
                ];
                
                await this.run(sql, params);
            }
            
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving indicators:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // RISK & ANALYTICS OPERATIONS
    // ================================
    async saveRiskEvent(event) {
        try {
            const sql = `
                INSERT INTO risk_events (event_type, description, severity, data, account_balance, daily_pl)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                event.type,
                event.description,
                event.severity || 'info',
                JSON.stringify(event.data || {}),
                event.data?.balance,
                event.data?.dailyPL
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving risk event:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async saveDailyRiskStats(stats) {
        try {
            const sql = `
                INSERT OR REPLACE INTO daily_stats (
                    date, trades_count, profit, loss, net_pl, account_balance
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                stats.date,
                stats.tradesExecuted,
                stats.profit,
                stats.loss,
                stats.netPL,
                stats.accountBalance
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving daily stats:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getRiskHistory() {
        try {
            const sql = `
                SELECT 
                    MAX(account_balance) as peak_balance,
                    MIN(account_balance) as lowest_balance,
                    MAX(daily_pl) as best_day,
                    MIN(daily_pl) as worst_day,
                    SUM(CASE WHEN daily_pl > 0 THEN daily_pl ELSE 0 END) as total_profit,
                    SUM(CASE WHEN daily_pl < 0 THEN ABS(daily_pl) ELSE 0 END) as total_loss
                FROM daily_stats
            `;
            
            const result = await this.get(sql);
            this.stats.successfulQueries++;
            
            return result;
            
        } catch (error) {
            console.error('❌ Error getting risk history:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // GOALS & ACHIEVEMENTS
    // ================================
    async saveGoal(goal) {
        try {
            const sql = `
                INSERT OR REPLACE INTO goals (
                    id, type, title, description, target_value, current_value,
                    deadline, status, priority, category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                goal.id,
                goal.type,
                goal.title,
                goal.description,
                goal.target_value || goal.targetValue,
                goal.current_value || goal.currentValue,
                goal.deadline ? new Date(goal.deadline).getTime() / 1000 : null,
                goal.status,
                goal.priority,
                goal.category
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving goal:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getGoals() {
        try {
            const sql = 'SELECT * FROM goals ORDER BY created_at DESC';
            const goals = await this.all(sql);
            
            this.stats.successfulQueries++;
            return goals;
            
        } catch (error) {
            console.error('❌ Error getting goals:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async saveAchievement(achievement) {
        try {
            const sql = `
                INSERT INTO achievements (id, goal_id, title, description, points, badge)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                achievement.id,
                achievement.goal_id || achievement.goalId,
                achievement.title,
                achievement.description,
                achievement.points,
                achievement.badge
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving achievement:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // SYSTEM OPERATIONS
    // ================================
    async saveSystemLog(level, message, component, data = null) {
        try {
            const sql = `
                INSERT INTO system_logs (level, message, component, data)
                VALUES (?, ?, ?, ?)
            `;
            
            const params = [
                level,
                message,
                component,
                data ? JSON.stringify(data) : null
            ];
            
            await this.run(sql, params);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving system log:', error);
            this.stats.failedQueries++;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getSystemLogs(level = null, limit = 100) {
        try {
            let sql = 'SELECT * FROM system_logs';
            const params = [];
            
            if (level) {
                sql += ' WHERE level = ?';
                params.push(level);
            }
            
            sql += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);
            
            const logs = await this.all(sql, params);
            this.stats.successfulQueries++;
            
            return logs;
            
        } catch (error) {
            console.error('❌ Error getting system logs:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async saveConfig(key, value, description = null) {
        try {
            const sql = `
                INSERT OR REPLACE INTO config (key, value, description)
                VALUES (?, ?, ?)
            `;
            
            await this.run(sql, [key, value, description]);
            this.stats.successfulQueries++;
            
        } catch (error) {
            console.error('❌ Error saving config:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getConfig(key) {
        try {
            const sql = 'SELECT value FROM config WHERE key = ?';
            const result = await this.get(sql, [key]);
            
            this.stats.successfulQueries++;
            return result ? result.value : null;
            
        } catch (error) {
            console.error('❌ Error getting config:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // ANALYTICS & REPORTING
    // ================================
    async getPerformanceAnalytics(days = 30) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
                    SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END) as total_profit,
                    SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END) as total_loss,
                    AVG(profit) as avg_profit,
                    MAX(profit) as best_trade,
                    MIN(profit) as worst_trade,
                    strategy_name as best_strategy
                FROM trades 
                WHERE entry_time > strftime('%s', 'now', '-${days} days')
                AND status = 'closed'
                GROUP BY strategy_name
                ORDER BY total_profit DESC
            `;
            
            const analytics = await this.all(sql);
            this.stats.successfulQueries++;
            
            return analytics;
            
        } catch (error) {
            console.error('❌ Error getting performance analytics:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    async getStrategyPerformance(strategyId) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losses,
                    SUM(profit) as net_profit,
                    AVG(profit) as avg_profit,
                    MAX(profit) as best_trade,
                    MIN(profit) as worst_trade
                FROM trades 
                WHERE strategy_id = ? AND status = 'closed'
            `;
            
            const performance = await this.get(sql, [strategyId]);
            this.stats.successfulQueries++;
            
            return performance;
            
        } catch (error) {
            console.error('❌ Error getting strategy performance:', error);
            this.stats.failedQueries++;
            throw error;
        } finally {
            this.stats.totalQueries++;
        }
    }

    // ================================
    // BACKUP & MAINTENANCE
    // ================================
    startBackupScheduler() {
        console.log('📅 Starting backup scheduler...');
        
        setInterval(async () => {
            await this.createBackup();
        }, this.config.backupInterval);
    }

    async createBackup() {
        try {
            console.log('💾 Creating database backup...');
            
            const backupDir = process.env.DATABASE_BACKUP_PATH || './backups';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `baynex-backup-${timestamp}.db`);
            
            // Ensure backup directory exists
            await fs.mkdir(backupDir, { recursive: true });
            
            // Copy database file
            await fs.copyFile(this.dbPath, backupPath);
            
            // Compress if enabled
            if (this.config.compression) {
                // Implementation would compress the backup file
                console.log('🗜️ Backup compression not implemented yet');
            }
            
            // Clean old backups
            await this.cleanOldBackups(backupDir);
            
            this.stats.lastBackup = new Date();
            console.log(`✅ Backup created: ${backupPath}`);
            
        } catch (error) {
            console.error('❌ Error creating backup:', error);
        }
    }

    async cleanOldBackups(backupDir) {
        try {
            const files = await fs.readdir(backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('baynex-backup-') && file.endsWith('.db'))
                .sort()
                .reverse();
            
            if (backupFiles.length > this.config.maxBackups) {
                const filesToDelete = backupFiles.slice(this.config.maxBackups);
                
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(backupDir, file));
                    console.log(`🗑️ Deleted old backup: ${file}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error cleaning old backups:', error);
        }
    }

    async vacuum() {
        try {
            console.log('🧹 Running database vacuum...');
            await this.run('VACUUM');
            console.log('✅ Database vacuum completed');
            
        } catch (error) {
            console.error('❌ Error running vacuum:', error);
        }
    }

    async analyze() {
        try {
            console.log('📊 Running database analyze...');
            await this.run('ANALYZE');
            console.log('✅ Database analyze completed');
            
        } catch (error) {
            console.error('❌ Error running analyze:', error);
        }
    }

    async getDatabaseSize() {
        try {
            const stats = await fs.stat(this.dbPath);
            this.stats.dbSize = stats.size;
            return stats.size;
            
        } catch (error) {
            console.error('❌ Error getting database size:', error);
            return 0;
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================
    encrypt(data) {
        if (!this.config.encryption) return data;
        
        const cipher = crypto.createCipher('aes192', this.encryptionKey);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(encryptedData) {
        if (!this.config.encryption) return encryptedData;
        
        const decipher = crypto.createDecipher('aes192', this.encryptionKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    getStats() {
        return {
            ...this.stats,
            isConnected: this.isConnected,
            successRate: this.stats.totalQueries > 0 ? 
                (this.stats.successfulQueries / this.stats.totalQueries * 100).toFixed(2) + '%' : '0%'
        };
    }

    healthCheck() {
        return {
            status: this.isConnected ? 'connected' : 'disconnected',
            totalQueries: this.stats.totalQueries,
            successfulQueries: this.stats.successfulQueries,
            failedQueries: this.stats.failedQueries,
            successRate: this.stats.totalQueries > 0 ? 
                (this.stats.successfulQueries / this.stats.totalQueries * 100).toFixed(2) + '%' : '0%',
            lastBackup: this.stats.lastBackup,
            dbSize: this.stats.dbSize
        };
    }

    async start() {
        console.log('▶️ Starting Database Manager...');
        if (!this.isConnected) {
            await this.connect();
        }
    }

    async stop() {
        console.log('⏹️ Stopping Database Manager...');
        
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((error) => {
                    if (error) {
                        console.error('❌ Error closing database:', error);
                    } else {
                        console.log('✅ Database closed successfully');
                    }
                    this.isConnected = false;
                    resolve();
                });
            });
        }
    }
}

module.exports = DatabaseManager;
