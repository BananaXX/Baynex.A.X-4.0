// ================================
// BAYNEX.A.X EMAIL NOTIFIER
// Email Notification Channel
// ================================

const nodemailer = require('nodemailer');

class EmailNotifier {
    constructor(config) {
        this.config = config;
        this.transporter = null;
        this.isConnected = false;
        this.isInitialized = false;
        
        this.stats = {
            emailsSent: 0,
            emailsFailed: 0,
            lastEmail: null
        };
        
        // Email queue for batch sending
        this.emailQueue = [];
        this.isProcessingQueue = false;
        this.batchSize = 5;
        this.processingInterval = 10000; // 10 seconds
    }

    async initialize() {
        console.log('📧 Initializing Email Notifier...');
        
        try {
            if (!this.config.user || !this.config.password) {
                throw new Error('Email credentials not provided');
            }

            // Create transporter
            await this.createTransporter();
            
            // Test connection
            await this.testConnection();
            
            this.isInitialized = true;
            console.log('✅ Email Notifier initialized');
            
            // Start queue processor
            this.startQueueProcessor();
            
            // Send initialization email
            await this.sendEmail({
                subject: '🚀 BAYNEX.A.X Email Notifications Active',
                text: 'Email notification system has been successfully initialized.',
                html: this.getInitializationEmailHTML()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Email Notifier initialization failed:', error);
            throw error;
        }
    }

    async createTransporter() {
        const transporterConfig = {
            service: this.config.service || 'gmail',
            auth: {
                user: this.config.user,
                pass: this.config.password
            }
        };

        // Custom SMTP configuration if provided
        if (this.config.host) {
            transporterConfig.host = this.config.host;
            transporterConfig.port = this.config.port || 587;
            transporterConfig.secure = this.config.secure || false;
            delete transporterConfig.service;
        }

        this.transporter = nodemailer.createTransporter(transporterConfig);
        
        console.log(`📧 Email transporter created for ${this.config.service || 'custom SMTP'}`);
    }

    async testConnection() {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized');
        }

        try {
            await this.transporter.verify();
            this.isConnected = true;
            console.log('✅ Email connection verified');
            
        } catch (error) {
            console.error('❌ Email connection test failed:', error);
            throw error;
        }
    }

    async sendEmail(emailData) {
        if (!this.isConnected || !this.transporter) {
            throw new Error('Email notifier not connected');
        }

        try {
            const mailOptions = {
                from: `BAYNEX.A.X <${this.config.user}>`,
                to: this.config.to,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                attachments: emailData.attachments || []
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            this.stats.emailsSent++;
            this.stats.lastEmail = new Date();
            
            console.log(`📧 Email sent: ${emailData.subject}`);
            return result;
            
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            this.stats.emailsFailed++;
            throw error;
        }
    }

    async queueEmail(emailData) {
        this.emailQueue.push({
            ...emailData,
            timestamp: new Date()
        });
        
        console.log(`📝 Email queued: ${emailData.subject} (${this.emailQueue.length} in queue)`);
    }

    startQueueProcessor() {
        console.log('⚙️ Starting email queue processor...');
        
        setInterval(async () => {
            if (!this.isProcessingQueue && this.emailQueue.length > 0) {
                await this.processEmailQueue();
            }
        }, this.processingInterval);
    }

    async processEmailQueue() {
        if (this.emailQueue.length === 0) return;

        this.isProcessingQueue = true;
        
        try {
            // Process emails in batches
            const batch = this.emailQueue.splice(0, this.batchSize);
            
            for (const emailData of batch) {
                try {
                    await this.sendEmail(emailData);
                    // Small delay between emails
                    await this.sleep(1000);
                } catch (error) {
                    console.error('❌ Failed to send queued email:', error);
                }
            }
            
        } catch (error) {
            console.error('❌ Error processing email queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    // ================================
    // MESSAGE FORMATTING
    // ================================
    async sendTradeNotification(trade) {
        const subject = `💰 Trade ${trade.result ? 'Closed' : 'Opened'} - ${trade.asset}`;
        const html = this.formatTradeEmail(trade);
        const text = this.formatTradeText(trade);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendSystemNotification(alert) {
        const subject = `🤖 System Alert - ${alert.type}`;
        const html = this.formatSystemEmail(alert);
        const text = this.formatSystemText(alert);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendDailySummary(summary) {
        const subject = `📊 Daily Trading Summary - ${summary.date}`;
        const html = this.formatDailySummaryEmail(summary);
        const text = this.formatDailySummaryText(summary);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendAchievementNotification(achievement) {
        const subject = `🎯 Achievement Unlocked - ${achievement.title}`;
        const html = this.formatAchievementEmail(achievement);
        const text = this.formatAchievementText(achievement);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendCriticalAlert(alert) {
        const subject = `🚨 CRITICAL ALERT - ${alert.type || 'System Emergency'}`;
        const html = this.formatCriticalAlertEmail(alert);
        const text = this.formatCriticalAlertText(alert);
        
        // Send immediately for critical alerts
        await this.sendEmail({ subject, html, text });
    }

    // ================================
    // HTML EMAIL TEMPLATES
    // ================================
    formatTradeEmail(trade) {
        const direction = trade.direction === 'call' ? '📈' : '📉';
        const resultIcon = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '⏳';
        const profit = trade.profit ? this.formatCurrency(trade.profit) : 'Pending';
        const profitColor = trade.profit > 0 ? '#28a745' : '#dc3545';
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <h1>${direction} Trade ${trade.result ? 'Closed' : 'Opened'}</h1>
                <p style="margin: 0; opacity: 0.9;">BAYNEX.A.X Autonomous Trading System</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Asset:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.asset}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Direction:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${direction} ${trade.direction.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${this.formatCurrency(trade.amount)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Strategy:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.strategy || 'Unknown'}</td>
                    </tr>
                    ${trade.entry_price ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Entry Price:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.entry_price}</td>
                    </tr>
                    ` : ''}
                    ${trade.exit_price ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Exit Price:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.exit_price}</td>
                    </tr>
                    ` : ''}
                    ${trade.result ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Result:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${resultIcon} ${trade.result.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>P&L:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6; color: ${profitColor}; font-weight: bold;">${profit}</td>
                    </tr>
                    ` : `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">⏳ Active</td>
                    </tr>
                    `}
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Time:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${new Date().toLocaleString()}</td>
                    </tr>
                </table>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatSystemEmail(alert) {
        const icon = this.getSystemIcon(alert.type);
        const alertColor = this.getAlertColor(alert.type);
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${alertColor}; color: white; padding: 20px; text-align: center;">
                <h1>${icon} System Alert</h1>
                <p style="margin: 0; opacity: 0.9;">${alert.type.toUpperCase()}</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="background-color: white; padding: 20px; border-left: 4px solid ${alertColor}; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: ${alertColor};">${alert.type}</h3>
                    <p style="font-size: 16px; line-height: 1.6;">${alert.message}</p>
                    <p style="color: #6c757d; margin-bottom: 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                ${alert.data ? this.formatAlertData(alert.data) : ''}
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatDailySummaryEmail(summary) {
        const profitColor = summary.dailyProfit >= 0 ? '#28a745' : '#dc3545';
        const profitIcon = summary.dailyProfit >= 0 ? '📈' : '📉';
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 20px; text-align: center;">
                <h1>📊 Daily Trading Summary</h1>
                <p style="margin: 0; opacity: 0.9;">${summary.date}</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: ${profitColor};">${profitIcon} Net P&L</h3>
                        <p style="font-size: 24px; font-weight: bold; color: ${profitColor}; margin: 0;">${this.formatCurrency(summary.dailyProfit)}</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #007bff;">📈 Trades</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 0;">${summary.tradesExecuted}</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #fd7e14;">🎯 Win Rate</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #fd7e14; margin: 0;">${summary.winRate.toFixed(1)}%</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #6f42c1;">⏱️ Uptime</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #6f42c1; margin: 0;">${summary.systemUptime.toFixed(1)}h</p>
                    </div>
                </div>
                
                ${summary.bestStrategy ? `
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #ffc107;">🏆 Best Performing Strategy</h3>
                    <p style="font-size: 18px; margin: 0;">${summary.bestStrategy}</p>
                </div>
                ` : ''}
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatAchievementEmail(achievement) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; text-align: center;">
                <h1>🎯 Achievement Unlocked!</h1>
                <p style="margin: 0; opacity: 0.9;">Congratulations!</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa; text-align: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 20px;">🏆</div>
                    <h2 style="color: #f5576c; margin-bottom: 15px;">${achievement.title}</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #6c757d; margin-bottom: 20px;">${achievement.description}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; display: inline-block;">
                        <p style="margin: 0; font-weight: bold; color: #f5576c;">💎 Points Earned: ${achievement.points}</p>
                    </div>
                </div>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatCriticalAlertEmail(alert) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
                <h1>🚨 CRITICAL ALERT</h1>
                <p style="margin: 0; opacity: 0.9;">IMMEDIATE ATTENTION REQUIRED</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #856404; margin-top: 0;">⚠️ Critical System Condition</h3>
                    <p style="color: #856404; font-size: 16px; margin-bottom: 0;">${alert.reason || alert.message || 'A critical condition has been detected in the trading system.'}</p>
                </div>
                
                ${alert.accountBalance ? `
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>Account Balance:</strong> ${this.formatCurrency(alert.accountBalance)}
                </div>
                ` : ''}
                
                ${alert.dailyPL ? `
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>Daily P&L:</strong> <span style="color: ${alert.dailyPL >= 0 ? '#28a745' : '#dc3545'};">${this.formatCurrency(alert.dailyPL)}</span>
                </div>
                ` : ''}
                
                <div style="background: white; padding: 15px; border-radius: 8px;">
                    <strong>Alert Time:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    // ================================
    // TEXT EMAIL TEMPLATES
    // ================================
    formatTradeText(trade) {
        const direction = trade.direction === 'call' ? 'CALL' : 'PUT';
        const result = trade.result ? ` - ${trade.result.toUpperCase()}` : ' - ACTIVE';
        const profit = trade.profit ? ` | P&L: ${this.formatCurrency(trade.profit)}` : '';
        
        return `
BAYNEX.A.X Trade ${trade.result ? 'Closed' : 'Opened'}

Asset: ${trade.asset}
Direction: ${direction}
Amount: ${this.formatCurrency(trade.amount)}
Strategy: ${trade.strategy || 'Unknown'}
${trade.entry_price ? `Entry Price: ${trade.entry_price}` : ''}
${trade.exit_price ? `Exit Price: ${trade.exit_price}` : ''}
Status: ${result}${profit}
Time: ${new Date().toLocaleString()}

Automated notification from BAYNEX.A.X Trading System
        `.trim();
    }

    formatSystemText(alert) {
        return `
BAYNEX.A.X System Alert

Type: ${alert.type}
Message: ${alert.message}
Time: ${new Date().toLocaleString()}

System notification from BAYNEX.A.X
        `.trim();
    }

    formatDailySummaryText(summary) {
        return `
BAYNEX.A.X Daily Trading Summary
${summary.date}

Net P&L: ${this.formatCurrency(summary.dailyProfit)}
Total Trades: ${summary.tradesExecuted}
Win Rate: ${summary.winRate.toFixed(1)}%
System Uptime: ${summary.systemUptime.toFixed(1)} hours
${summary.bestStrategy ? `Best Strategy: ${summary.bestStrategy}` : ''}

Automated daily report from BAYNEX.A.X
        `.trim();
    }

    formatAchievementText(achievement) {
        return `
🎯 ACHIEVEMENT UNLOCKED!

${achievement.title}

${achievement.description}

Points Earned: ${achievement.points}
Achieved: ${new Date().toLocaleString()}

Congratulations from BAYNEX.A.X!
        `.trim();
    }

    formatCriticalAlertText(alert) {
        return `
🚨 CRITICAL ALERT - IMMEDIATE ATTENTION REQUIRED

${alert.reason || alert.message || 'A critical condition has been detected.'}

${alert.accountBalance ? `Account Balance: ${this.formatCurrency(alert.accountBalance)}` : ''}
${alert.dailyPL ? `Daily P&L: ${this.formatCurrency(alert.dailyPL)}` : ''}
Alert Time: ${new Date().toLocaleString()}

BAYNEX.A.X Emergency System
        `.trim();
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getSystemIcon(type) {
        const icons = {
            'startup': '🚀',
            'shutdown': '⏹️',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'emergency_stop': '🛑',
            'risk_alert': '🛡️'
        };
        
        return icons[type] || '🤖';
    }

    getAlertColor(type) {
        const colors = {
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'success': '#28a745',
            'emergency_stop': '#dc3545',
            'risk_alert': '#fd7e14'
        };
        
        return colors[type] || '#6c757d';
    }

    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatAlertData(data) {
        if (!data || typeof data !== 'object') return '';
        
        const items = Object.entries(data)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `<tr><td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>${this.formatKey(key)}:</strong></td><td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${value}</td></tr>`)
            .join('');
        
        return items ? `
        <div style="background: white; padding: 20px; border-radius: 8px;">
            <h4 style="margin-top: 0;">Alert Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
                ${items}
            </table>
        </div>
        ` : '';
    }

    formatKey(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    getEmailFooter() {
        return `
        <div style="background-color: #343a40; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
                🤖 <strong>BAYNEX.A.X</strong> - Binary Autonomous Yield Navigation & Execution X-System
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">
                Automated trading system notification | ${new Date().toLocaleString()}
            </p>
        </div>
        `;
    }

    getInitializationEmailHTML() {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
// ================================
// BAYNEX.A.X EMAIL NOTIFIER
// Email Notification Channel
// ================================

const nodemailer = require('nodemailer');

class EmailNotifier {
    constructor(config) {
        this.config = config;
        this.transporter = null;
        this.isConnected = false;
        this.isInitialized = false;
        
        this.stats = {
            emailsSent: 0,
            emailsFailed: 0,
            lastEmail: null
        };
        
        // Email queue for batch sending
        this.emailQueue = [];
        this.isProcessingQueue = false;
        this.batchSize = 5;
        this.processingInterval = 10000; // 10 seconds
    }

    async initialize() {
        console.log('📧 Initializing Email Notifier...');
        
        try {
            if (!this.config.user || !this.config.password) {
                throw new Error('Email credentials not provided');
            }

            // Create transporter
            await this.createTransporter();
            
            // Test connection
            await this.testConnection();
            
            this.isInitialized = true;
            console.log('✅ Email Notifier initialized');
            
            // Start queue processor
            this.startQueueProcessor();
            
            // Send initialization email
            await this.sendEmail({
                subject: '🚀 BAYNEX.A.X Email Notifications Active',
                text: 'Email notification system has been successfully initialized.',
                html: this.getInitializationEmailHTML()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Email Notifier initialization failed:', error);
            throw error;
        }
    }

    async createTransporter() {
        const transporterConfig = {
            service: this.config.service || 'gmail',
            auth: {
                user: this.config.user,
                pass: this.config.password
            }
        };

        // Custom SMTP configuration if provided
        if (this.config.host) {
            transporterConfig.host = this.config.host;
            transporterConfig.port = this.config.port || 587;
            transporterConfig.secure = this.config.secure || false;
            delete transporterConfig.service;
        }

        this.transporter = nodemailer.createTransporter(transporterConfig);
        
        console.log(`📧 Email transporter created for ${this.config.service || 'custom SMTP'}`);
    }

    async testConnection() {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized');
        }

        try {
            await this.transporter.verify();
            this.isConnected = true;
            console.log('✅ Email connection verified');
            
        } catch (error) {
            console.error('❌ Email connection test failed:', error);
            throw error;
        }
    }

    async sendEmail(emailData) {
        if (!this.isConnected || !this.transporter) {
            throw new Error('Email notifier not connected');
        }

        try {
            const mailOptions = {
                from: `BAYNEX.A.X <${this.config.user}>`,
                to: this.config.to,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                attachments: emailData.attachments || []
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            this.stats.emailsSent++;
            this.stats.lastEmail = new Date();
            
            console.log(`📧 Email sent: ${emailData.subject}`);
            return result;
            
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            this.stats.emailsFailed++;
            throw error;
        }
    }

    async queueEmail(emailData) {
        this.emailQueue.push({
            ...emailData,
            timestamp: new Date()
        });
        
        console.log(`📝 Email queued: ${emailData.subject} (${this.emailQueue.length} in queue)`);
    }

    startQueueProcessor() {
        console.log('⚙️ Starting email queue processor...');
        
        setInterval(async () => {
            if (!this.isProcessingQueue && this.emailQueue.length > 0) {
                await this.processEmailQueue();
            }
        }, this.processingInterval);
    }

    async processEmailQueue() {
        if (this.emailQueue.length === 0) return;

        this.isProcessingQueue = true;
        
        try {
            // Process emails in batches
            const batch = this.emailQueue.splice(0, this.batchSize);
            
            for (const emailData of batch) {
                try {
                    await this.sendEmail(emailData);
                    // Small delay between emails
                    await this.sleep(1000);
                } catch (error) {
                    console.error('❌ Failed to send queued email:', error);
                }
            }
            
        } catch (error) {
            console.error('❌ Error processing email queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    // ================================
    // MESSAGE FORMATTING
    // ================================
    async sendTradeNotification(trade) {
        const subject = `💰 Trade ${trade.result ? 'Closed' : 'Opened'} - ${trade.asset}`;
        const html = this.formatTradeEmail(trade);
        const text = this.formatTradeText(trade);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendSystemNotification(alert) {
        const subject = `🤖 System Alert - ${alert.type}`;
        const html = this.formatSystemEmail(alert);
        const text = this.formatSystemText(alert);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendDailySummary(summary) {
        const subject = `📊 Daily Trading Summary - ${summary.date}`;
        const html = this.formatDailySummaryEmail(summary);
        const text = this.formatDailySummaryText(summary);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendAchievementNotification(achievement) {
        const subject = `🎯 Achievement Unlocked - ${achievement.title}`;
        const html = this.formatAchievementEmail(achievement);
        const text = this.formatAchievementText(achievement);
        
        await this.queueEmail({ subject, html, text });
    }

    async sendCriticalAlert(alert) {
        const subject = `🚨 CRITICAL ALERT - ${alert.type || 'System Emergency'}`;
        const html = this.formatCriticalAlertEmail(alert);
        const text = this.formatCriticalAlertText(alert);
        
        // Send immediately for critical alerts
        await this.sendEmail({ subject, html, text });
    }

    // ================================
    // HTML EMAIL TEMPLATES
    // ================================
    formatTradeEmail(trade) {
        const direction = trade.direction === 'call' ? '📈' : '📉';
        const resultIcon = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '⏳';
        const profit = trade.profit ? this.formatCurrency(trade.profit) : 'Pending';
        const profitColor = trade.profit > 0 ? '#28a745' : '#dc3545';
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <h1>${direction} Trade ${trade.result ? 'Closed' : 'Opened'}</h1>
                <p style="margin: 0; opacity: 0.9;">BAYNEX.A.X Autonomous Trading System</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Asset:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.asset}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Direction:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${direction} ${trade.direction.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${this.formatCurrency(trade.amount)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Strategy:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.strategy || 'Unknown'}</td>
                    </tr>
                    ${trade.entry_price ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Entry Price:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.entry_price}</td>
                    </tr>
                    ` : ''}
                    ${trade.exit_price ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Exit Price:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trade.exit_price}</td>
                    </tr>
                    ` : ''}
                    ${trade.result ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Result:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${resultIcon} ${trade.result.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>P&L:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6; color: ${profitColor}; font-weight: bold;">${profit}</td>
                    </tr>
                    ` : `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">⏳ Active</td>
                    </tr>
                    `}
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Time:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${new Date().toLocaleString()}</td>
                    </tr>
                </table>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatSystemEmail(alert) {
        const icon = this.getSystemIcon(alert.type);
        const alertColor = this.getAlertColor(alert.type);
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${alertColor}; color: white; padding: 20px; text-align: center;">
                <h1>${icon} System Alert</h1>
                <p style="margin: 0; opacity: 0.9;">${alert.type.toUpperCase()}</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="background-color: white; padding: 20px; border-left: 4px solid ${alertColor}; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: ${alertColor};">${alert.type}</h3>
                    <p style="font-size: 16px; line-height: 1.6;">${alert.message}</p>
                    <p style="color: #6c757d; margin-bottom: 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                ${alert.data ? this.formatAlertData(alert.data) : ''}
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatDailySummaryEmail(summary) {
        const profitColor = summary.dailyProfit >= 0 ? '#28a745' : '#dc3545';
        const profitIcon = summary.dailyProfit >= 0 ? '📈' : '📉';
        
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 20px; text-align: center;">
                <h1>📊 Daily Trading Summary</h1>
                <p style="margin: 0; opacity: 0.9;">${summary.date}</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: ${profitColor};">${profitIcon} Net P&L</h3>
                        <p style="font-size: 24px; font-weight: bold; color: ${profitColor}; margin: 0;">${this.formatCurrency(summary.dailyProfit)}</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #007bff;">📈 Trades</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 0;">${summary.tradesExecuted}</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #fd7e14;">🎯 Win Rate</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #fd7e14; margin: 0;">${summary.winRate.toFixed(1)}%</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #6f42c1;">⏱️ Uptime</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #6f42c1; margin: 0;">${summary.systemUptime.toFixed(1)}h</p>
                    </div>
                </div>
                
                ${summary.bestStrategy ? `
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #ffc107;">🏆 Best Performing Strategy</h3>
                    <p style="font-size: 18px; margin: 0;">${summary.bestStrategy}</p>
                </div>
                ` : ''}
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatAchievementEmail(achievement) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; text-align: center;">
                <h1>🎯 Achievement Unlocked!</h1>
                <p style="margin: 0; opacity: 0.9;">Congratulations!</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa; text-align: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 20px;">🏆</div>
                    <h2 style="color: #f5576c; margin-bottom: 15px;">${achievement.title}</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #6c757d; margin-bottom: 20px;">${achievement.description}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; display: inline-block;">
                        <p style="margin: 0; font-weight: bold; color: #f5576c;">💎 Points Earned: ${achievement.points}</p>
                    </div>
                </div>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    formatCriticalAlertEmail(alert) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
                <h1>🚨 CRITICAL ALERT</h1>
                <p style="margin: 0; opacity: 0.9;">IMMEDIATE ATTENTION REQUIRED</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #856404; margin-top: 0;">⚠️ Critical System Condition</h3>
                    <p style="color: #856404; font-size: 16px; margin-bottom: 0;">${alert.reason || alert.message || 'A critical condition has been detected in the trading system.'}</p>
                </div>
                
                ${alert.accountBalance ? `
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>Account Balance:</strong> ${this.formatCurrency(alert.accountBalance)}
                </div>
                ` : ''}
                
                ${alert.dailyPL ? `
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <strong>Daily P&L:</strong> <span style="color: ${alert.dailyPL >= 0 ? '#28a745' : '#dc3545'};">${this.formatCurrency(alert.dailyPL)}</span>
                </div>
                ` : ''}
                
                <div style="background: white; padding: 15px; border-radius: 8px;">
                    <strong>Alert Time:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    // ================================
    // TEXT EMAIL TEMPLATES
    // ================================
    formatTradeText(trade) {
        const direction = trade.direction === 'call' ? 'CALL' : 'PUT';
        const result = trade.result ? ` - ${trade.result.toUpperCase()}` : ' - ACTIVE';
        const profit = trade.profit ? ` | P&L: ${this.formatCurrency(trade.profit)}` : '';
        
        return `
BAYNEX.A.X Trade ${trade.result ? 'Closed' : 'Opened'}

Asset: ${trade.asset}
Direction: ${direction}
Amount: ${this.formatCurrency(trade.amount)}
Strategy: ${trade.strategy || 'Unknown'}
${trade.entry_price ? `Entry Price: ${trade.entry_price}` : ''}
${trade.exit_price ? `Exit Price: ${trade.exit_price}` : ''}
Status: ${result}${profit}
Time: ${new Date().toLocaleString()}

Automated notification from BAYNEX.A.X Trading System
        `.trim();
    }

    formatSystemText(alert) {
        return `
BAYNEX.A.X System Alert

Type: ${alert.type}
Message: ${alert.message}
Time: ${new Date().toLocaleString()}

System notification from BAYNEX.A.X
        `.trim();
    }

    formatDailySummaryText(summary) {
        return `
BAYNEX.A.X Daily Trading Summary
${summary.date}

Net P&L: ${this.formatCurrency(summary.dailyProfit)}
Total Trades: ${summary.tradesExecuted}
Win Rate: ${summary.winRate.toFixed(1)}%
System Uptime: ${summary.systemUptime.toFixed(1)} hours
${summary.bestStrategy ? `Best Strategy: ${summary.bestStrategy}` : ''}

Automated daily report from BAYNEX.A.X
        `.trim();
    }

    formatAchievementText(achievement) {
        return `
🎯 ACHIEVEMENT UNLOCKED!

${achievement.title}

${achievement.description}

Points Earned: ${achievement.points}
Achieved: ${new Date().toLocaleString()}

Congratulations from BAYNEX.A.X!
        `.trim();
    }

    formatCriticalAlertText(alert) {
        return `
🚨 CRITICAL ALERT - IMMEDIATE ATTENTION REQUIRED

${alert.reason || alert.message || 'A critical condition has been detected.'}

${alert.accountBalance ? `Account Balance: ${this.formatCurrency(alert.accountBalance)}` : ''}
${alert.dailyPL ? `Daily P&L: ${this.formatCurrency(alert.dailyPL)}` : ''}
Alert Time: ${new Date().toLocaleString()}

BAYNEX.A.X Emergency System
        `.trim();
    }

    // ================================
    // UTILITY METHODS
    // ================================
    getSystemIcon(type) {
        const icons = {
            'startup': '🚀',
            'shutdown': '⏹️',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'emergency_stop': '🛑',
            'risk_alert': '🛡️'
        };
        
        return icons[type] || '🤖';
    }

    getAlertColor(type) {
        const colors = {
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'success': '#28a745',
            'emergency_stop': '#dc3545',
            'risk_alert': '#fd7e14'
        };
        
        return colors[type] || '#6c757d';
    }

    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatAlertData(data) {
        if (!data || typeof data !== 'object') return '';
        
        const items = Object.entries(data)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `<tr><td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>${this.formatKey(key)}:</strong></td><td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${value}</td></tr>`)
            .join('');
        
        return items ? `
        <div style="background: white; padding: 20px; border-radius: 8px;">
            <h4 style="margin-top: 0;">Alert Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
                ${items}
            </table>
        </div>
        ` : '';
    }

    formatKey(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    getEmailFooter() {
        return `
        <div style="background-color: #343a40; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
                🤖 <strong>BAYNEX.A.X</strong> - Binary Autonomous Yield Navigation & Execution X-System
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">
                Automated trading system notification | ${new Date().toLocaleString()}
            </p>
        </div>
        `;
    }

    getInitializationEmailHTML() {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <h1>🚀 Email Notifications Active</h1>
                <p style="margin: 0; opacity: 0.9;">BAYNEX.A.X Trading System</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #155724; margin-top: 0;">✅ Email Notification System Initialized</h3>
                    <p style="color: #155724; margin-bottom: 0;">You will now receive email notifications for:</p>
                    <ul style="color: #155724;">
                        <li>Trade executions and closures</li>
                        <li>System alerts and warnings</li>
                        <li>Daily performance summaries</li>
                        <li>Achievement notifications</li>
                        <li>Critical system alerts</li>
                    </ul>
                </div>
                
                <p style="text-align: center; color: #6c757d;">
                    <strong>System Status:</strong> Online and Ready<br>
                    <strong>Initialization Time:</strong> ${new Date().toLocaleString()}
                </p>
            </div>
            
            ${this.getEmailFooter()}
        </div>
        `;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            ...this.stats,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized,
            queueSize: this.emailQueue.length,
            successRate: this.stats.emailsSent > 0 ? 
                (this.stats.emailsSent / (this.stats.emailsSent + this.stats.emailsFailed) * 100).toFixed(2) + '%' : '0%'
        };
    }

    clearQueue() {
        this.emailQueue = [];
        console.log('🗑️ Email queue cleared');
    }

    healthCheck() {
        return {
            status: this.isConnected ? 'connected' : 'disconnected',
            initialized: this.isInitialized,
            emailsSent: this.stats.emailsSent,
            emailsFailed: this.stats.emailsFailed,
            queueSize: this.emailQueue.length,
            lastEmail: this.stats.lastEmail,
            successRate: this.stats.emailsSent > 0 ? 
                (this.stats.emailsSent / (this.stats.emailsSent + this.stats.emailsFailed) * 100).toFixed(2) + '%' : '0%'
        };
    }

    async disconnect() {
        try {
            // Process remaining emails in queue
            if (this.emailQueue.length > 0 && this.emailQueue.length < 10) {
                await this.processEmailQueue();
            }
            
            if (this.transporter) {
                this.transporter.close();
            }
            
            this.isConnected = false;
            console.log('✅ Email notifier disconnected');
            
        } catch (error) {
            console.error('❌ Error disconnecting email notifier:', error);
        }
    }
}

module.exports = EmailNotifier;
