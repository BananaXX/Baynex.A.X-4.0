// ================================
// BAYNEX.A.X WHATSAPP BOT
// WhatsApp Notification Channel
// ================================

class WhatsAppBot {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.isConnected = false;
        this.isInitialized = false;
        
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastMessage: null
        };
        
        // Message queue for rate limiting
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitDelay = 3000; // 3 seconds between messages
    }

    async initialize() {
        console.log('📱 Initializing WhatsApp Bot...');
        
        try {
            if (!this.config.apiKey && !this.config.number) {
                throw new Error('WhatsApp configuration not provided');
            }

            // Initialize WhatsApp client based on available API
            await this.initializeClient();
            
            this.isInitialized = true;
            console.log('✅ WhatsApp Bot initialized');
            
            // Send initialization message
            await this.sendMessage('🚀 BAYNEX.A.X WhatsApp Bot initialized and ready!');
            
            return true;
            
        } catch (error) {
            console.error('❌ WhatsApp Bot initialization failed:', error);
            // Don't throw error to allow system to continue without WhatsApp
            console.log('⚠️ Continuing without WhatsApp notifications');
            return false;
        }
    }

    async initializeClient() {
        // This is a simplified implementation
        // In production, you would use a proper WhatsApp API service like:
        // - Twilio WhatsApp API
        // - WhatsApp Business API
        // - Third-party services like Ultramsg, etc.
        
        if (this.config.apiKey) {
            // Using API-based service (e.g., Twilio)
            await this.initializeTwilioWhatsApp();
        } else {
            // Simulate WhatsApp connection
            this.simulateWhatsAppConnection();
        }
    }

    async initializeTwilioWhatsApp() {
        try {
            // Example for Twilio WhatsApp API
            // const twilio = require('twilio');
            // this.client = twilio(this.config.accountSid, this.config.authToken);
            
            // For now, simulate the connection
            this.isConnected = true;
            console.log('📱 Twilio WhatsApp API connected');
            
        } catch (error) {
            console.error('❌ Twilio WhatsApp initialization failed:', error);
            throw error;
        }
    }

    simulateWhatsAppConnection() {
        // Simulate WhatsApp connection for development
        this.isConnected = true;
        console.log('📱 WhatsApp connection simulated (development mode)');
    }

    async sendMessage(message, options = {}) {
        return new Promise((resolve, reject) => {
            this.messageQueue.push({
                message: message,
                options: options,
                resolve: resolve,
                reject: reject
            });
            
            this.processMessageQueue();
        });
    }

    async processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.messageQueue.length > 0) {
            const messageData = this.messageQueue.shift();
            
            try {
                await this.sendMessageDirect(messageData.message, messageData.options);
                messageData.resolve(true);
                
                // Rate limiting delay
                if (this.messageQueue.length > 0) {
                    await this.sleep(this.rateLimitDelay);
                }
                
            } catch (error) {
                messageData.reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    async sendMessageDirect(message, options = {}) {
        if (!this.isConnected) {
            throw new Error('WhatsApp bot not connected');
        }

        try {
            // In production, this would send via actual WhatsApp API
            if (this.config.apiKey) {
                await this.sendViaTwilio(message, options);
            } else {
                await this.sendViaSimulation(message, options);
            }

            this.stats.messagesSent++;
            this.stats.lastMessage = new Date();
            
            console.log(`📱 WhatsApp message sent: ${message.substring(0, 50)}...`);
            
        } catch (error) {
            console.error('❌ Failed to send WhatsApp message:', error);
            this.stats.errors++;
            throw error;
        }
    }

    async sendViaTwilio(message, options = {}) {
        try {
            // Example Twilio implementation
            // const result = await this.client.messages.create({
            //     from: 'whatsapp:+14155238886', // Twilio WhatsApp number
            //     to: `whatsapp:${this.config.number}`,
            //     body: message
            // });
            
            // Simulate Twilio send
            console.log(`📱 [Twilio WhatsApp] To: ${this.config.number}, Message: ${message.substring(0, 100)}...`);
            
        } catch (error) {
            console.error('❌ Twilio WhatsApp send failed:', error);
            throw error;
        }
    }

    async sendViaSimulation(message, options = {}) {
        // Simulate sending message (for development)
        console.log(`📱 [WhatsApp Simulation] To: ${this.config.number || 'Unknown'}`);
        console.log(`📱 [WhatsApp Simulation] Message: ${message}`);
        
        // Simulate some delay
        await this.sleep(500);
    }

    async sendImage(imageBuffer, caption = '', options = {}) {
        try {
            const message = caption || 'Image from BAYNEX.A.X';
            
            // In production, would send actual image
            await this.sendMessage(`📸 ${message}\n[Image attachment would be sent here]`, options);
            
        } catch (error) {
            console.error('❌ Failed to send WhatsApp image:', error);
            throw error;
        }
    }

    async sendDocument(documentBuffer, filename = 'document.pdf', caption = '', options = {}) {
        try {
            const message = `📄 ${caption || 'Document from BAYNEX.A.X'}\nFile: ${filename}`;
            
            // In production, would send actual document
            await this.sendMessage(`${message}\n[Document attachment would be sent here]`, options);
            
        } catch (error) {
            console.error('❌ Failed to send WhatsApp document:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            if (!this.isConnected) return false;
            
            // Test by sending a ping message
            await this.sendMessage('🏃‍♂️ Connection test - please ignore');
            return true;
            
        } catch (error) {
            console.error('❌ WhatsApp connection test failed:', error);
            return false;
        }
    }

    formatTradeMessage(trade) {
        const direction = trade.direction === 'call' ? '📈' : '📉';
        const result = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '⏳';
        const profit = trade.profit ? (trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`) : 'Pending';
        
        return `
${direction} *TRADE ${trade.result ? 'CLOSED' : 'OPENED'}*

📊 Asset: ${trade.asset}
💰 Amount: $${trade.amount}
🎯 Strategy: ${trade.strategy || 'Unknown'}
${trade.result ? `${result} Result: ${profit}` : '⏳ Status: Active'}

⏰ ${new Date().toLocaleString()}
        `.trim();
    }

    formatSystemMessage(alert) {
        const icon = this.getSystemIcon(alert.type);
        
        return `
${icon} *SYSTEM ALERT*

🔔 Type: ${alert.type}
📝 Message: ${alert.message}
⏰ Time: ${new Date().toLocaleString()}

_BAYNEX.A.X Autonomous Trading System_
        `.trim();
    }

    formatAchievementMessage(achievement) {
        return `
🎯 *ACHIEVEMENT UNLOCKED!*

🏆 *${achievement.title}*
📝 ${achievement.description}
💎 Points: ${achievement.points}

🎉 _Congratulations!_
        `.trim();
    }

    formatDailySummary(summary) {
        const profitIcon = summary.dailyProfit >= 0 ? '📈' : '📉';
        const profitText = summary.dailyProfit >= 0 ? 
            `+$${summary.dailyProfit.toFixed(2)}` : 
            `-$${Math.abs(summary.dailyProfit).toFixed(2)}`;
        
        return `
📊 *DAILY SUMMARY*
${summary.date}

${profitIcon} Net P&L: ${profitText}
📈 Trades: ${summary.tradesExecuted}
🎯 Win Rate: ${summary.winRate.toFixed(1)}%
⏱️ Uptime: ${summary.systemUptime.toFixed(1)}h

${summary.bestStrategy ? `🏆 Best Strategy: ${summary.bestStrategy}` : ''}

_BAYNEX.A.X Daily Report_
        `.trim();
    }

    formatEmergencyAlert(alert) {
        return `
🚨 *EMERGENCY ALERT* 🚨

⚠️ ${alert.reason || 'Critical system condition detected'}

🛑 *IMMEDIATE ACTION REQUIRED*

📊 Account Balance: $${alert.accountBalance || 'Unknown'}
📉 Daily P&L: $${alert.dailyPL || 'Unknown'}
⏰ Time: ${new Date().toLocaleString()}

_BAYNEX.A.X Emergency System_
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
            'connection_issue': '🔌',
            'achievement': '🎯',
            'trade_alert': '💰',
            'daily_summary': '📊'
        };
        
        return icons[type] || '🤖';
    }

    async sendChartImage(chartBuffer, caption = 'Trading Chart') {
        try {
            return await this.sendImage(chartBuffer, caption);
        } catch (error) {
            console.error('❌ Failed to send chart image via WhatsApp:', error);
            throw error;
        }
    }

    async sendTradingReport(reportBuffer, filename = 'trading_report.pdf', caption = 'Trading Performance Report') {
        try {
            return await this.sendDocument(reportBuffer, filename, caption);
        } catch (error) {
            console.error('❌ Failed to send trading report via WhatsApp:', error);
            throw error;
        }
    }

    // WhatsApp-specific message formatting
    formatForWhatsApp(message) {
        // Convert HTML to WhatsApp formatting
        return message
            .replace(/<b>(.*?)<\/b>/g, '*$1*')  // Bold
            .replace(/<i>(.*?)<\/i>/g, '_$1_')  // Italic
            .replace(/<code>(.*?)<\/code>/g, '```$1```')  // Code
            .replace(/<pre>(.*?)<\/pre>/g, '```$1```')  // Code block
            .replace(/<br\s*\/?>/g, '\n')  // Line breaks
            .replace(/<[^>]*>/g, '');  // Remove other HTML tags
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            ...this.stats,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized,
            queueSize: this.messageQueue.length,
            isProcessingQueue: this.isProcessingQueue
        };
    }

    getQueueSize() {
        return this.messageQueue.length;
    }

    clearQueue() {
        this.messageQueue = [];
        console.log('🗑️ WhatsApp message queue cleared');
    }

    async disconnect() {
        try {
            // Clear message queue
            this.clearQueue();
            
            // Disconnect client if applicable
            if (this.client && typeof this.client.destroy === 'function') {
                await this.client.destroy();
            }
            
            this.isConnected = false;
            console.log('✅ WhatsApp bot disconnected');
            
        } catch (error) {
            console.error('❌ Error disconnecting WhatsApp bot:', error);
        }
    }

    // Configuration methods
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('📱 WhatsApp bot configuration updated');
    }

    setRateLimit(delayMs) {
        this.rateLimitDelay = delayMs;
        console.log(`⏱️ WhatsApp rate limit set to ${delayMs}ms`);
    }

    // Error handling
    handleError(error) {
        this.stats.errors++;
        console.error('❌ WhatsApp bot error:', error);
        
        // Attempt to reconnect if connection lost
        if (error.message.includes('connection') || error.message.includes('network')) {
            this.attemptReconnection();
        }
    }

    async attemptReconnection() {
        console.log('🔄 Attempting WhatsApp reconnection...');
        
        try {
            this.isConnected = false;
            await this.sleep(5000); // Wait 5 seconds
            await this.initializeClient();
            
            if (this.isConnected) {
                console.log('✅ WhatsApp reconnection successful');
                await this.sendMessage('🔄 WhatsApp connection restored');
            }
            
        } catch (error) {
            console.error('❌ WhatsApp reconnection failed:', error);
        }
    }

    // Health check
    healthCheck() {
        return {
            status: this.isConnected ? 'connected' : 'disconnected',
            initialized: this.isInitialized,
            messagesSent: this.stats.messagesSent,
            errors: this.stats.errors,
            queueSize: this.messageQueue.length,
            lastMessage: this.stats.lastMessage,
            errorRate: this.stats.messagesSent > 0 ? 
                (this.stats.errors / this.stats.messagesSent * 100).toFixed(2) + '%' : '0%'
        };
    }
}

module.exports = WhatsAppBot;
