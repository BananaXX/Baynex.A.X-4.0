// ================================
// BAYNEX.A.X TELEGRAM BOT
// Telegram Notification Channel
// ================================

const TelegramBotApi = require('node-telegram-bot-api');

class TelegramBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.isConnected = false;
        this.isInitialized = false;
        
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastMessage: null
        };
    }

    async initialize() {
        console.log('📱 Initializing Telegram Bot...');
        
        try {
            if (!this.config.botToken) {
                throw new Error('Telegram bot token not provided');
            }

            // Initialize bot
            this.bot = new TelegramBotApi(this.config.botToken, { polling: false });
            
            // Test connection
            const botInfo = await this.bot.getMe();
            console.log(`✅ Telegram Bot connected: @${botInfo.username}`);
            
            // Setup webhook if in production
            if (process.env.NODE_ENV === 'production' && process.env.TELEGRAM_WEBHOOK_URL) {
                await this.setupWebhook();
            }
            
            this.isConnected = true;
            this.isInitialized = true;
            
            // Send initialization message
            await this.sendMessage('🚀 BAYNEX.A.X Telegram Bot initialized and ready!');
            
            return true;
            
        } catch (error) {
            console.error('❌ Telegram Bot initialization failed:', error);
            throw error;
        }
    }

    async setupWebhook() {
        try {
            const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
            await this.bot.setWebHook(webhookUrl);
            console.log(`🔗 Telegram webhook set: ${webhookUrl}`);
        } catch (error) {
            console.error('❌ Failed to set Telegram webhook:', error);
        }
    }

    async sendMessage(message, options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const messageOptions = {
                parse_mode: this.config.parseMode || 'HTML',
                disable_web_page_preview: true,
                ...options
            };

            const result = await this.bot.sendMessage(
                this.config.chatId,
                message,
                messageOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram message:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendPhoto(photo, caption = '', options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const photoOptions = {
                caption: caption,
                parse_mode: this.config.parseMode || 'HTML',
                ...options
            };

            const result = await this.bot.sendPhoto(
                this.config.chatId,
                photo,
                photoOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram photo:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendDocument(document, caption = '', options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const docOptions = {
                caption: caption,
                parse_mode: this.config.parseMode || 'HTML',
                ...options
            };

            const result = await this.bot.sendDocument(
                this.config.chatId,
                document,
                docOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram document:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendMarkdownMessage(message, options = {}) {
        const messageOptions = {
            ...options,
            parse_mode: 'Markdown'
        };

        return await this.sendMessage(message, messageOptions);
    }

    async sendHTMLMessage(message, options = {}) {
        const messageOptions = {
            ...options,
            parse_mode: 'HTML'
        };

        return await this.sendMessage(message, messageOptions);
    }

    async testConnection() {
        try {
            if (!this.bot) return false;
            
            const botInfo = await this.bot.getMe();
            return botInfo && botInfo.is_bot;
            
        } catch (error) {
            console.error('❌ Telegram connection test failed:', error);
            return false;
        }
    }

    formatTradeMessage(trade) {
        const direction = trade.direction === 'call' ? '📈' : '📉';
        const result = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '⏳';
        const profit = trade.profit ? (trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`) : 'Pending';
        
        return `
${direction} <b>TRADE ${trade.result ? 'CLOSED' : 'OPENED'}</b>

📊 <b>Asset:</b> ${trade.asset}
💰 <b>Amount:</b> $${trade.amount}
🎯 <b>Strategy:</b> ${trade.strategy || 'Unknown'}
${trade.result ? `${result} <b>Result:</b> ${profit}` : '⏳ <b>Status:</b> Active'}

⏰ <i>${new Date().toLocaleString()}</i>
        `.trim();
    }

    formatSystemMessage(alert) {
        const icon = this.getSystemIcon(alert.type);
        
        return `
${icon} <b>SYSTEM ALERT</b>

🔔 <b>Type:</b> ${alert.type}
📝 <b>Message:</b> ${alert.message}
⏰ <b>Time:</b> ${new Date().toLocaleString()}

<i>BAYNEX.A.X Autonomous Trading System</i>
        `.trim();
    }

    formatAchievementMessage(achievement) {
        return `
🎯 <b>ACHIEVEMENT UNLOCKED!</b>

🏆 <b>${achievement.title}</b>
📝 ${achievement.description}
💎 <b>Points:</b> ${achievement.points}

🎉 <i>Congratulations!</i>
        `.trim();
// ================================
// BAYNEX.A.X TELEGRAM BOT
// Telegram Notification Channel
// ================================

const TelegramBotApi = require('node-telegram-bot-api');

class TelegramBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.isConnected = false;
        this.isInitialized = false;
        
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastMessage: null
        };
    }

    async initialize() {
        console.log('📱 Initializing Telegram Bot...');
        
        try {
            if (!this.config.botToken) {
                throw new Error('Telegram bot token not provided');
            }

            // Initialize bot
            this.bot = new TelegramBotApi(this.config.botToken, { polling: false });
            
            // Test connection
            const botInfo = await this.bot.getMe();
            console.log(`✅ Telegram Bot connected: @${botInfo.username}`);
            
            // Setup webhook if in production
            if (process.env.NODE_ENV === 'production' && process.env.TELEGRAM_WEBHOOK_URL) {
                await this.setupWebhook();
            }
            
            this.isConnected = true;
            this.isInitialized = true;
            
            // Send initialization message
            await this.sendMessage('🚀 BAYNEX.A.X Telegram Bot initialized and ready!');
            
            return true;
            
        } catch (error) {
            console.error('❌ Telegram Bot initialization failed:', error);
            throw error;
        }
    }

    async setupWebhook() {
        try {
            const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
            await this.bot.setWebHook(webhookUrl);
            console.log(`🔗 Telegram webhook set: ${webhookUrl}`);
        } catch (error) {
            console.error('❌ Failed to set Telegram webhook:', error);
        }
    }

    async sendMessage(message, options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const messageOptions = {
                parse_mode: this.config.parseMode || 'HTML',
                disable_web_page_preview: true,
                ...options
            };

            const result = await this.bot.sendMessage(
                this.config.chatId,
                message,
                messageOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram message:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendPhoto(photo, caption = '', options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const photoOptions = {
                caption: caption,
                parse_mode: this.config.parseMode || 'HTML',
                ...options
            };

            const result = await this.bot.sendPhoto(
                this.config.chatId,
                photo,
                photoOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram photo:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendDocument(document, caption = '', options = {}) {
        if (!this.isConnected || !this.bot) {
            throw new Error('Telegram bot not connected');
        }

        try {
            const docOptions = {
                caption: caption,
                parse_mode: this.config.parseMode || 'HTML',
                ...options
            };

            const result = await this.bot.sendDocument(
                this.config.chatId,
                document,
                docOptions
            );

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            return result;

        } catch (error) {
            console.error('❌ Failed to send Telegram document:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendMarkdownMessage(message, options = {}) {
        const messageOptions = {
            ...options,
            parse_mode: 'Markdown'
        };

        return await this.sendMessage(message, messageOptions);
    }

    async sendHTMLMessage(message, options = {}) {
        const messageOptions = {
            ...options,
            parse_mode: 'HTML'
        };

        return await this.sendMessage(message, messageOptions);
    }

    async testConnection() {
        try {
            if (!this.bot) return false;
            
            const botInfo = await this.bot.getMe();
            return botInfo && botInfo.is_bot;
            
        } catch (error) {
            console.error('❌ Telegram connection test failed:', error);
            return false;
        }
    }

    formatTradeMessage(trade) {
        const direction = trade.direction === 'call' ? '📈' : '📉';
        const result = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '⏳';
        const profit = trade.profit ? (trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`) : 'Pending';
        
        return `
${direction} <b>TRADE ${trade.result ? 'CLOSED' : 'OPENED'}</b>

📊 <b>Asset:</b> ${trade.asset}
💰 <b>Amount:</b> $${trade.amount}
🎯 <b>Strategy:</b> ${trade.strategy || 'Unknown'}
${trade.result ? `${result} <b>Result:</b> ${profit}` : '⏳ <b>Status:</b> Active'}

⏰ <i>${new Date().toLocaleString()}</i>
        `.trim();
    }

    formatSystemMessage(alert) {
        const icon = this.getSystemIcon(alert.type);
        
        return `
${icon} <b>SYSTEM ALERT</b>

🔔 <b>Type:</b> ${alert.type}
📝 <b>Message:</b> ${alert.message}
⏰ <b>Time:</b> ${new Date().toLocaleString()}

<i>BAYNEX.A.X Autonomous Trading System</i>
        `.trim();
    }

    formatAchievementMessage(achievement) {
        return `
🎯 <b>ACHIEVEMENT UNLOCKED!</b>

🏆 <b>${achievement.title}</b>
📝 ${achievement.description}
💎 <b>Points:</b> ${achievement.points}

🎉 <i>Congratulations!</i>
        `.trim();
    }

    formatDailySummary(summary) {
        const profitIcon = summary.dailyProfit >= 0 ? '📈' : '📉';
        const profitText = summary.dailyProfit >= 0 ? 
            `+$${summary.dailyProfit.toFixed(2)}` : 
            `-$${Math.abs(summary.dailyProfit).toFixed(2)}`;
        
        return `
📊 <b>DAILY SUMMARY</b>
${summary.date}

${profitIcon} <b>Net P&L:</b> ${profitText}
📈 <b>Trades:</b> ${summary.tradesExecuted}
🎯 <b>Win Rate:</b> ${summary.winRate.toFixed(1)}%
⏱️ <b>Uptime:</b> ${summary.systemUptime.toFixed(1)}h

${summary.bestStrategy ? `🏆 <b>Best Strategy:</b> ${summary.bestStrategy}` : ''}

<i>BAYNEX.A.X Daily Report</i>
        `.trim();
    }

    getSystemIcon(type) {
        const icons = {
            'startup': '🚀',
            'shutdown': '⏹️',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'emergency_stop': '🛑',
            'risk_alert': '🛡️',
            'strategy_update': '🧬',
            'balance_update': '💰',
            'connection_issue': '🔌'
        };
        
        return icons[type] || '🤖';
    }

    async sendChartImage(chartBuffer, caption = '') {
        try {
            return await this.sendPhoto(chartBuffer, caption);
        } catch (error) {
            console.error('❌ Failed to send chart image:', error);
            throw error;
        }
    }

    async sendTradingReport(reportBuffer, filename = 'trading_report.pdf') {
        try {
            return await this.sendDocument(reportBuffer, 'Trading Performance Report', {
                filename: filename
            });
        } catch (error) {
            console.error('❌ Failed to send trading report:', error);
            throw error;
        }
    }

    getStats() {
        return {
            ...this.stats,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized
        };
    }

    async disconnect() {
        if (this.bot) {
            try {
                await this.bot.stopPolling();
                this.isConnected = false;
                console.log('✅ Telegram bot disconnected');
            } catch (error) {
                console.error('❌ Error disconnecting Telegram bot:', error);
            }
        }
    }
}

module.exports = TelegramBot;
