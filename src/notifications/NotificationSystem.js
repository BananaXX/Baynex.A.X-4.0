// ================================
// BAYNEX.A.X NOTIFICATION SYSTEM
// Multi-Channel Alert & Communication Hub
// ================================

const EventEmitter = require('events');
const TelegramBot = require('./TelegramBot');
const WhatsAppBot = require('./WhatsAppBot');
const EmailNotifier = require('./EmailNotifier');

class NotificationSystem extends EventEmitter {
    constructor() {
        super();
        this.dependencies = [];
        this.isActive = true;
        
        // Notification channels
        this.channels = new Map();
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            telegram: {
                enabled: process.env.TELEGRAM_ENABLED === 'true',
                botToken: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID,
                parseMode: process.env.TELEGRAM_PARSE_MODE || 'HTML'
            },
            whatsapp: {
                enabled: process.env.WHATSAPP_ENABLED === 'true',
                apiKey: process.env.WHATSAPP_API_KEY,
                number: process.env.WHATSAPP_NUMBER
            },
            email: {
                enabled: process.env.EMAIL_ENABLED === 'true',
                service: process.env.EMAIL_SERVICE || 'gmail',
                user: process.env.EMAIL_USER,
                password: process.env.EMAIL_PASSWORD,
                to: process.env.EMAIL_TO
            },
            voice: {
                enabled: process.env.VOICE_ENABLED === 'true'
            },
            dashboard: {
                enabled: process.env.WEB_DASHBOARD_ENABLED === 'true'
            }
        };
        
        // Notification queue and throttling
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        this.throttleMap = new Map();
        this.maxQueueSize = 100;
        this.processingInterval = 2000; // 2 seconds between notifications
        
        // Statistics
        this.stats = {
            totalSent: 0,
            successfulSent: 0,
            failedSent: 0,
            telegramSent: 0,
            whatsappSent: 0,
            emailSent: 0,
            lastNotification: null
        };
        
        // Message templates
        this.templates = {
            tradeAlert: {
                title: '💰 Trade Alert',
                telegram: this.getTelegramTradeTemplate(),
                whatsapp: this.getWhatsAppTradeTemplate(),
                email: this.getEmailTradeTemplate()
            },
            systemAlert: {
                title: '🤖 System Alert',
                telegram: this.getTelegramSystemTemplate(),
                whatsapp: this.getWhatsAppSystemTemplate(),
                email: this.getEmailSystemTemplate()
            },
            achievement: {
                title: '🎯 Achievement Unlocked',
                telegram: this.getTelegramAchievementTemplate(),
                whatsapp: this.getWhatsAppAchievementTemplate(),
                email: this.getEmailAchievementTemplate()
            },
            dailySummary: {
                title: '📊 Daily Summary',
                telegram: this.getTelegramDailySummaryTemplate(),
                whatsapp: this.getWhatsAppDailySummaryTemplate(),
                email: this.getEmailDailySummaryTemplate()
            }
        };
    }

    async initialize() {
        console.log('📱 Initializing Notification System...');
        
        try {
            // Initialize notification channels
            await this.initializeChannels();
            
            // Start notification queue processor
            this.startQueueProcessor();
            
            // Test connections
            await this.testConnections();
            
            this.isInitialized = true;
            console.log('✅ Notification System initialized');
            
            // Send initialization notification
            await this.sendSystemAlert({
                type: 'system_startup',
                message: '🚀 BAYNEX.A.X Notification System Online'
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Notification System initialization failed:', error);
            throw error;
        }
    }

    async initializeChannels() {
        console.log('📢 Initializing notification channels...');
        
        // Initialize Telegram Bot
        if (this.config.telegram.enabled && this.config.telegram.botToken) {
            try {
                const telegramBot = new TelegramBot(this.config.telegram);
                await telegramBot.initialize();
                this.channels.set('telegram', telegramBot);
                console.log('✅ Telegram bot initialized');
            } catch (error) {
                console.error('❌ Telegram initialization failed:', error);
            }
        }
        
        // Initialize WhatsApp Bot
        if (this.config.whatsapp.enabled && this.config.whatsapp.apiKey) {
            try {
                const whatsappBot = new WhatsAppBot(this.config.whatsapp);
                await whatsappBot.initialize();
                this.channels.set('whatsapp', whatsappBot);
                console.log('✅ WhatsApp bot initialized');
            } catch (error) {
                console.error('❌ WhatsApp initialization failed:', error);
            }
        }
        
        // Initialize Email Notifier
        if (this.config.email.enabled && this.config.email.user) {
            try {
                const emailNotifier = new EmailNotifier(this.config.email);
                await emailNotifier.initialize();
                this.channels.set('email', emailNotifier);
                console.log('✅ Email notifier initialized');
            } catch (error) {
                console.error('❌ Email initialization failed:', error);
            }
        }
        
        console.log(`📱 ${this.channels.size} notification channels active`);
    }

    async testConnections() {
        console.log('🔍 Testing notification connections...');
        
        for (const [channelName, channel] of this.channels) {
            try {
                const isConnected = await channel.testConnection();
                if (isConnected) {
                    console.log(`✅ ${channelName} connection test passed`);
                } else {
                    console.log(`⚠️ ${channelName} connection test failed`);
                }
            } catch (error) {
                console.error(`❌ ${channelName} connection test error:`, error);
            }
        }
    }

    // ================================
    // NOTIFICATION METHODS
    // ================================
    async sendTradeAlert(trade) {
        if (!this.isActive) return;
        
        console.log(`📊 Sending trade alert: ${trade.id}`);
        
        const notification = {
            type: 'trade_alert',
            priority: this.getTracePriority(trade),
            data: trade,
            channels: ['telegram', 'whatsapp'],
            timestamp: new Date()
        };
        
        await this.queueNotification(notification);
    }

    async sendSystemAlert(alert) {
        if (!this.isActive) return;
        
        console.log(`🤖 Sending system alert: ${alert.type}`);
        
        const notification = {
            type: 'system_alert',
            priority: alert.critical ? 'high' : 'medium',
            data: alert,
            channels: alert.critical ? ['telegram', 'whatsapp', 'email'] : ['telegram'],
            timestamp: new Date()
        };
        
        await this.queueNotification(notification);
    }

    async sendAchievementAlert(achievement) {
        if (!this.isActive) return;
        
        console.log(`🎯 Sending achievement alert: ${achievement.title}`);
        
        const notification = {
            type: 'achievement',
            priority: 'medium',
            data: achievement,
            channels: ['telegram', 'whatsapp'],
            timestamp: new Date()
        };
        
        await this.queueNotification(notification);
    }

    async sendDailySummary(summary) {
        if (!this.isActive) return;
        
        console.log(`📊 Sending daily summary`);
        
        const notification = {
            type: 'daily_summary',
            priority: 'low',
            data: summary,
            channels: ['telegram', 'email'],
            timestamp: new Date()
        };
        
        await this.queueNotification(notification);
    }

    async sendCriticalAlert(alert) {
        console.log(`🚨 Sending critical alert: ${alert.type || 'Unknown'}`);
        
        const notification = {
            type: 'critical_alert',
            priority: 'critical',
            data: alert,
            channels: ['telegram', 'whatsapp', 'email'],
            timestamp: new Date(),
            immediate: true // Skip queue for critical alerts
        };
        
        if (notification.immediate) {
            await this.processNotification(notification);
        } else {
            await this.queueNotification(notification);
        }
    }

    async sendEmergencyAlert(event) {
        console.log(`🛑 Sending emergency alert: ${event.reason || 'Emergency condition'}`);
        
        const notification = {
            type: 'emergency_alert',
            priority: 'critical',
            data: event,
            channels: ['telegram', 'whatsapp', 'email'],
            timestamp: new Date(),
            immediate: true
        };
        
        await this.processNotification(notification);
    }

    // ================================
    // QUEUE MANAGEMENT
    // ================================
    async queueNotification(notification) {
        // Check throttling
        if (this.isThrottled(notification)) {
            console.log(`⏱️ Notification throttled: ${notification.type}`);
            return;
        }
        
        // Add to queue
        if (this.notificationQueue.length >= this.maxQueueSize) {
            // Remove oldest notification
            this.notificationQueue.shift();
            console.log('⚠️ Notification queue full, removed oldest item');
        }
        
        this.notificationQueue.push(notification);
        console.log(`📝 Notification queued: ${notification.type} (${this.notificationQueue.length} in queue)`);
        
        // Update throttle map
        this.updateThrottleMap(notification);
    }

    startQueueProcessor() {
        console.log('⚙️ Starting notification queue processor...');
        
        setInterval(async () => {
            if (!this.isProcessingQueue && this.notificationQueue.length > 0) {
                await this.processQueue();
            }
        }, this.processingInterval);
    }

    async processQueue() {
        if (this.notificationQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        
        try {
            // Sort by priority
            this.notificationQueue.sort((a, b) => {
                const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
                return priorities[b.priority] - priorities[a.priority];
            });
            
            const notification = this.notificationQueue.shift();
            await this.processNotification(notification);
            
        } catch (error) {
            console.error('❌ Error processing notification queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async processNotification(notification) {
        console.log(`📤 Processing notification: ${notification.type}`);
        
        try {
            const template = this.templates[notification.type] || this.templates.systemAlert;
            
            // Send to each requested channel
            for (const channelName of notification.channels) {
                const channel = this.channels.get(channelName);
                
                if (channel) {
                    try {
                        const message = this.formatMessage(template, notification.data, channelName);
                        await channel.sendMessage(message);
                        
                        this.updateChannelStats(channelName, true);
                        console.log(`✅ Sent via ${channelName}: ${notification.type}`);
                        
                    } catch (error) {
                        console.error(`❌ Failed to send via ${channelName}:`, error);
                        this.updateChannelStats(channelName, false);
                    }
                } else {
                    console.log(`⚠️ Channel not available: ${channelName}`);
                }
            }
            
            this.stats.totalSent++;
            this.stats.successfulSent++;
            this.stats.lastNotification = new Date();
            
        } catch (error) {
            console.error('❌ Error processing notification:', error);
            this.stats.totalSent++;
            this.stats.failedSent++;
        }
    }

    // ================================
    // MESSAGE FORMATTING
    // ================================
    formatMessage(template, data, channel) {
        const channelTemplate = template[channel] || template.telegram;
        
        // Replace placeholders in template
        let message = channelTemplate;
        
        // Common replacements
        const replacements = {
            '{timestamp}': new Date().toLocaleString(),
            '{date}': new Date().toDateString(),
            '{time}': new Date().toLocaleTimeString()
        };
        
        // Data-specific replacements
        if (data) {
            Object.keys(data).forEach(key => {
                const value = data[key];
                if (typeof value !== 'object') {
                    replacements[`{${key}}`] = value;
                }
            });
        }
        
        // Apply replacements
        Object.keys(replacements).forEach(placeholder => {
            message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacements[placeholder]);
        });
        
        return message;
    }

    // ================================
    // MESSAGE TEMPLATES
    // ================================
    getTelegramTradeTemplate() {
        return `
💰 <b>TRADE EXECUTED</b>

📊 <b>Asset:</b> {asset}
📈 <b>Direction:</b> {direction}
💵 <b>Amount:</b> ${this.formatCurrency('{amount}')}
🎯 <b>Strategy:</b> {strategy}
⏰ <b>Time:</b> {timestamp}

{result ? '✅ <b>Result:</b> ' + '{result}' : '⏳ <b>Status:</b> Active'}
{profit ? '💰 <b>P&L:</b> ' + this.formatCurrency('{profit}') : ''}

🤖 <i>BAYNEX.A.X Auto-Trading</i>
        `.trim();
    }

    getWhatsAppTradeTemplate() {
        return `
💰 *TRADE EXECUTED*

📊 Asset: {asset}
📈 Direction: {direction}
💵 Amount: ${this.formatCurrency('{amount}')}
🎯 Strategy: {strategy}
⏰ Time: {timestamp}

{result ? '✅ Result: ' + '{result}' : '⏳ Status: Active'}
{profit ? '💰 P&L: ' + this.formatCurrency('{profit}') : ''}

🤖 BAYNEX.A.X Auto-Trading
        `.trim();
    }

    getEmailTradeTemplate() {
        return `
        <h2>💰 BAYNEX.A.X Trade Execution</h2>
        
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Asset:</strong></td><td>{asset}</td></tr>
            <tr><td><strong>Direction:</strong></td><td>{direction}</td></tr>
            <tr><td><strong>Amount:</strong></td><td>${this.formatCurrency('{amount}')}</td></tr>
            <tr><td><strong>Strategy:</strong></td><td>{strategy}</td></tr>
            <tr><td><strong>Time:</strong></td><td>{timestamp}</td></tr>
            {result ? '<tr><td><strong>Result:</strong></td><td>{result}</td></tr>' : ''}
            {profit ? '<tr><td><strong>P&L:</strong></td><td>' + this.formatCurrency('{profit}') + '</td></tr>' : ''}
        </table>
        
        <p><em>Automated notification from BAYNEX.A.X Trading System</em></p>
        `.trim();
    }

    getTelegramSystemTemplate() {
        return `
🤖 <b>SYSTEM ALERT</b>

🔔 <b>Type:</b> {type}
📝 <b>Message:</b> {message}
⏰ <b>Time:</b> {timestamp}

{status ? '📊 <b>Status:</b> ' + '{status}' : ''}
{balance ? '💰 <b>Balance:</b> ' + this.formatCurrency('{balance}') : ''}

🛡️ <i>BAYNEX.A.X Security System</i>
        `.trim();
    }

    getWhatsAppSystemTemplate() {
        return `
🤖 *SYSTEM ALERT*

🔔 Type: {type}
📝 Message: {message}
⏰ Time: {timestamp}

{status ? '📊 Status: ' + '{status}' : ''}
{balance ? '💰 Balance: ' + this.formatCurrency('{balance}') : ''}

🛡️ BAYNEX.A.X Security System
        `.trim();
    }

    getEmailSystemTemplate() {
        return `
        <h2>🤖 BAYNEX.A.X System Alert</h2>
        
        <div style="background-color: #f0f0f0; padding: 15px; border-left: 4px solid #ff6b35;">
            <h3>{type}</h3>
            <p>{message}</p>
            <p><strong>Time:</strong> {timestamp}</p>
            {status ? '<p><strong>Status:</strong> {status}</p>' : ''}
            {balance ? '<p><strong>Balance:</strong> ' + this.formatCurrency('{balance}') + '</p>' : ''}
        </div>
        
        <p><em>System notification from BAYNEX.A.X</em></p>
        `.trim();
    }

    getTelegramAchievementTemplate() {
        return `
🎯 <b>ACHIEVEMENT UNLOCKED!</b>

🏆 <b>Title:</b> {title}
📝 <b>Description:</b> {description}
💎 <b>Points:</b> {points}
⏰ <b>Achieved:</b> {timestamp}

🎉 <i>Congratulations from BAYNEX.A.X!</i>
        `.trim();
    }

    getWhatsAppAchievementTemplate() {
        return `
🎯 *ACHIEVEMENT UNLOCKED!*

🏆 Title: {title}
📝 Description: {description}
💎 Points: {points}
⏰ Achieved: {timestamp}

🎉 Congratulations from BAYNEX.A.X!
        `.trim();
    }

    getEmailAchievementTemplate() {
        return `
        <h2>🎯 Achievement Unlocked!</h2>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px;">
            <h3>🏆 {title}</h3>
            <p>{description}</p>
            <p><strong>Points Earned:</strong> {points}</p>
            <p><strong>Achieved At:</strong> {timestamp}</p>
        </div>
        
        <p>🎉 <strong>Congratulations on this achievement!</strong></p>
        <p><em>Keep up the great work with BAYNEX.A.X</em></p>
        `.trim();
    }

    getTelegramDailySummaryTemplate() {
        return `
📊 <b>DAILY TRADING SUMMARY</b>

📅 <b>Date:</b> {date}
💰 <b>Net P&L:</b> ${this.formatCurrency('{dailyProfit}')}
📈 <b>Trades:</b> {tradesExecuted}
🎯 <b>Win Rate:</b> {winRate}%
⏱️ <b>Uptime:</b> {systemUptime}h

{bestStrategy ? '🏆 <b>Best Strategy:</b> ' + '{bestStrategy}' : ''}

📊 <i>BAYNEX.A.X Daily Report</i>
        `.trim();
    }

    getWhatsAppDailySummaryTemplate() {
        return `
📊 *DAILY TRADING SUMMARY*

📅 Date: {date}
💰 Net P&L: ${this.formatCurrency('{dailyProfit}')}
📈 Trades: {tradesExecuted}
🎯 Win Rate: {winRate}%
⏱️ Uptime: {systemUptime}h

{bestStrategy ? '🏆 Best Strategy: ' + '{bestStrategy}' : ''}

📊 BAYNEX.A.X Daily Report
        `.trim();
    }

    getEmailDailySummaryTemplate() {
        return `
        <h2>📊 BAYNEX.A.X Daily Summary</h2>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h3>📅 {date}</h3>
            
            <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                <tr style="background-color: #e0e0e0;">
                    <td style="padding: 10px; border: 1px solid #ccc;"><strong>Metric</strong></td>
                    <td style="padding: 10px; border: 1px solid #ccc;"><strong>Value</strong></td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ccc;">Net P&L</td>
                    <td style="padding: 10px; border: 1px solid #ccc;">${this.formatCurrency('{dailyProfit}')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ccc;">Total Trades</td>
                    <td style="padding: 10px; border: 1px solid #ccc;">{tradesExecuted}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ccc;">Win Rate</td>
                    <td style="padding: 10px; border: 1px solid #ccc;">{winRate}%</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ccc;">System Uptime</td>
                    <td style="padding: 10px; border: 1px solid #ccc;">{systemUptime} hours</td>
                </tr>
                {bestStrategy ? '<tr><td style="padding: 10px; border: 1px solid #ccc;">Best Strategy</td><td style="padding: 10px; border: 1px solid #ccc;">{bestStrategy}</td></tr>' : ''}
            </table>
        </div>
        
        <p><em>Automated daily report from BAYNEX.A.X</em></p>
        `.trim();
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getTracePriority(trade) {
        if (!trade) return 'low';
        
        const amount = parseFloat(trade.amount) || 0;
        const profit = parseFloat(trade.profit) || 0;
        
        if (Math.abs(profit) > 100 || amount > 100) return 'high';
        if (Math.abs(profit) > 50 || amount > 50) return 'medium';
        return 'low';
    }

    isThrottled(notification) {
        const key = `${notification.type}_${notification.channels.join('_')}`;
        const lastSent = this.throttleMap.get(key);
        const throttleTime = this.getThrottleTime(notification.priority);
        
        if (lastSent && Date.now() - lastSent < throttleTime) {
            return true;
        }
        
        return false;
    }

    getThrottleTime(priority) {
        switch (priority) {
            case 'critical': return 0; // No throttling for critical
            case 'high': return 10000; // 10 seconds
            case 'medium': return 30000; // 30 seconds
            case 'low': return 60000; // 1 minute
            default: return 30000;
        }
    }

    updateThrottleMap(notification) {
        const key = `${notification.type}_${notification.channels.join('_')}`;
        this.throttleMap.set(key, Date.now());
    }

    updateChannelStats(channelName, success) {
        if (success) {
            this.stats.successfulSent++;
            this.stats[`${channelName}Sent`]++;
        } else {
            this.stats.failedSent++;
        }
    }

    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    // ================================
    // CONFIGURATION & MANAGEMENT
    // ================================
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('📱 Notification System configuration updated');
        
        // Reinitialize channels if config changed
        if (newConfig.telegram || newConfig.whatsapp || newConfig.email) {
            this.initializeChannels();
        }
    }

    async enableChannel(channelName) {
        this.config[channelName].enabled = true;
        await this.initializeChannels();
        console.log(`✅ ${channelName} channel enabled`);
    }

    async disableChannel(channelName) {
        this.config[channelName].enabled = false;
        this.channels.delete(channelName);
        console.log(`❌ ${channelName} channel disabled`);
    }

    getActiveChannels() {
        return Array.from(this.channels.keys());
    }

    getStats() {
        return {
            ...this.stats,
            activeChannels: this.channels.size,
            queueSize: this.notificationQueue.length,
            isActive: this.isActive,
            successRate: this.stats.totalSent > 0 ? 
                (this.stats.successfulSent / this.stats.totalSent * 100).toFixed(2) + '%' : '0%'
        };
    }

    async sendTestNotification() {
        console.log('🧪 Sending test notification...');
        
        const testNotification = {
            type: 'system_alert',
            priority: 'medium',
            data: {
                type: 'test',
                message: 'This is a test notification from BAYNEX.A.X',
                timestamp: new Date().toLocaleString()
            },
            channels: this.getActiveChannels(),
            timestamp: new Date()
        };
        
        await this.processNotification(testNotification);
    }

    clearQueue() {
        this.notificationQueue = [];
        console.log('🗑️ Notification queue cleared');
    }

    healthCheck() {
        const channelsHealth = {};
        for (const [name, channel] of this.channels) {
            channelsHealth[name] = channel.isConnected || true;
        }
        
        return {
            status: this.isActive ? 'active' : 'inactive',
            initialized: this.isInitialized,
            activeChannels: this.channels.size,
            queueSize: this.notificationQueue.length,
            totalSent: this.stats.totalSent,
            successRate: this.stats.totalSent > 0 ? 
                (this.stats.successfulSent / this.stats.totalSent * 100).toFixed(2) + '%' : '0%',
            channels: channelsHealth,
            lastNotification: this.stats.lastNotification
        };
    }

    async start() {
        console.log('▶️ Starting Notification System...');
        this.isActive = true;
        
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async stop() {
        console.log('⏹️ Stopping Notification System...');
        this.isActive = false;
        
        // Process remaining queue items
        while (this.notificationQueue.length > 0 && this.notificationQueue.length < 10) {
            await this.processQueue();
        }
        
        // Close channel connections
        for (const [name, channel] of this.channels) {
            try {
                if (typeof channel.disconnect === 'function') {
                    await channel.disconnect();
                }
            } catch (error) {
                console.error(`❌ Error disconnecting ${name}:`, error);
            }
        }
        
        console.log('✅ Notification System stopped');
    }
}

module.exports = NotificationSystem;
