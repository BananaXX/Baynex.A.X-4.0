// src/voice/VoiceAssistant.js
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BaynexaVoiceAssistant extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            voiceMode: config.voiceMode || 'smart', // smart, silent, full
            language: config.language || 'en-US',
            personality: config.personality || 'professional',
            enabled: config.enabled !== false,
            ...config
        };
        
        this.isActive = false;
        this.currentContext = null;
        this.conversationHistory = [];
        this.voiceQueue = [];
        this.isProcessing = false;
        
        this.personalityProfiles = {
            professional: {
                greeting: "BAYNEX.A.X Voice Assistant online. Ready to execute trades and monitor your portfolio.",
                tradeAlert: "Trade executed successfully. Monitoring market conditions.",
                warningTone: "Warning detected. Implementing risk management protocols.",
                celebrationTone: "Profit target achieved! Excellent market performance."
            },
            friendly: {
                greeting: "Hey there! Baynexa here, ready to make some profits together!",
                tradeAlert: "Just made a trade! Looking good so far.",
                warningTone: "Heads up! Market's getting a bit risky, but I've got your back.",
                celebrationTone: "Boom! We just hit our profit target! Great job team!"
            },
            analytical: {
                greeting: "BAYNEX.A.X analytical voice mode activated. All systems nominal.",
                tradeAlert: "Trade execution completed. Statistical probability favorable.",
                warningTone: "Risk parameters exceeded. Implementing defensive strategies.",
                celebrationTone: "Target metrics achieved. Performance optimization successful."
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing Baynexa Voice Assistant...');
            
            // Setup voice synthesis if available
            await this.setupVoiceSynthesis();
            
            // Load conversation context
            await this.loadConversationHistory();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isActive = true;
            await this.speak(this.getPersonalityMessage('greeting'));
            
            this.log('Baynexa Voice Assistant initialized successfully');
        } catch (error) {
            this.log(`Voice Assistant initialization error: ${error.message}`, 'error');
        }
    }
    
    async setupVoiceSynthesis() {
        // Voice synthesis setup for different environments
        this.voiceCapabilities = {
            webSpeech: typeof window !== 'undefined' && 'speechSynthesis' in window,
            nodeSpeak: false,
            textToSpeech: false
        };
        
        // Try to load text-to-speech libraries
        try {
            if (typeof window === 'undefined') {
                // Node.js environment - try to load speak library
                this.nodeSpeak = require('node-speaker');
                this.voiceCapabilities.nodeSpeak = true;
            }
        } catch (error) {
            // Fallback to text output
            this.log('Voice synthesis not available, using text output');
        }
    }
    
    setupEventListeners() {
        // Listen for trading events
        this.on('trade_executed', this.handleTradeExecuted.bind(this));
        this.on('profit_target_hit', this.handleProfitTarget.bind(this));
        this.on('risk_warning', this.handleRiskWarning.bind(this));
        this.on('strategy_changed', this.handleStrategyChange.bind(this));
        this.on('platform_switch', this.handlePlatformSwitch.bind(this));
        this.on('daily_report', this.handleDailyReport.bind(this));
        this.on('goal_achieved', this.handleGoalAchieved.bind(this));
    }
    
    async speak(message, priority = 'normal') {
        if (!this.config.enabled || this.config.voiceMode === 'silent') {
            return;
        }
        
        const voiceCommand = {
            message,
            priority,
            timestamp: Date.now(),
            context: this.currentContext
        };
        
        // Add to queue based on priority
        if (priority === 'urgent') {
            this.voiceQueue.unshift(voiceCommand);
        } else {
            this.voiceQueue.push(voiceCommand);
        }
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            await this.processVoiceQueue();
        }
    }
    
    async processVoiceQueue() {
        if (this.voiceQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        while (this.voiceQueue.length > 0) {
            const command = this.voiceQueue.shift();
            await this.executeVoiceCommand(command);
            
            // Small delay between messages
            await this.delay(500);
        }
        
        this.isProcessing = false;
    }
    
    async executeVoiceCommand(command) {
        try {
            const enhancedMessage = this.enhanceMessage(command.message, command.context);
            
            // Log the voice message
            this.log(`🎤 Baynexa: ${enhancedMessage}`);
            
            // Add to conversation history
            this.addToHistory('assistant', enhancedMessage);
            
            // Emit to web dashboard for visual display
            this.emit('voice_message', {
                message: enhancedMessage,
                timestamp: Date.now(),
                priority: command.priority
            });
            
            // Actual voice synthesis
            if (this.voiceCapabilities.webSpeech && typeof window !== 'undefined') {
                await this.speakWebSpeech(enhancedMessage);
            } else if (this.voiceCapabilities.nodeSpeak) {
                await this.speakNodeJS(enhancedMessage);
            }
            
        } catch (error) {
            this.log(`Voice command execution error: ${error.message}`, 'error');
        }
    }
    
    async speakWebSpeech(message) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = this.config.language;
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve(); // Continue even if speech fails
            
            speechSynthesis.speak(utterance);
        });
    }
    
    async speakNodeJS(message) {
        // Implement Node.js text-to-speech if available
        // This is a placeholder for actual TTS implementation
        this.log(`[TTS] ${message}`);
    }
    
    enhanceMessage(message, context) {
        let enhanced = message;
        
        // Add personality touches based on configuration
        const personality = this.personalityProfiles[this.config.personality];
        
        // Add context-specific enhancements
        if (context) {
            switch (context.type) {
                case 'trade':
                    enhanced = `${enhanced} Current profit: ${context.profit || 'calculating'}`;
                    break;
                case 'risk':
                    enhanced = `${enhanced} Risk level: ${context.riskLevel || 'unknown'}`;
                    break;
                case 'goal':
                    enhanced = `${enhanced} Progress: ${context.progress || '0'}%`;
                    break;
            }
        }
        
        return enhanced;
    }
    
    async handleTradeExecuted(data) {
        const { platform, symbol, amount, direction, result } = data;
        
        this.currentContext = { type: 'trade', ...data };
        
        let message = '';
        if (this.config.voiceMode === 'full') {
            message = `Trade executed on ${platform}. ${direction} ${symbol} for ${amount}. `;
            if (result) {
                message += result === 'win' ? 'Position successful!' : 'Position closed.';
            }
        } else {
            message = this.getPersonalityMessage('tradeAlert');
        }
        
        await this.speak(message);
    }
    
    async handleProfitTarget(data) {
        const { targetAmount, currentProfit, percentage } = data;
        
        this.currentContext = { type: 'goal', progress: percentage };
        
        const message = this.getPersonalityMessage('celebrationTone') + 
                       ` Target of ${targetAmount} reached with ${currentProfit} profit!`;
        
        await this.speak(message, 'urgent');
    }
    
    async handleRiskWarning(data) {
        const { riskLevel, reason, action } = data;
        
        this.currentContext = { type: 'risk', riskLevel };
        
        const message = this.getPersonalityMessage('warningTone') + 
                       ` ${reason}. ${action} implemented.`;
        
        await this.speak(message, 'urgent');
    }
    
    async handleStrategyChange(data) {
        const { oldStrategy, newStrategy, reason } = data;
        
        if (this.config.voiceMode === 'full') {
            const message = `Strategy switched from ${oldStrategy} to ${newStrategy}. Reason: ${reason}`;
            await this.speak(message);
        }
    }
    
    async handlePlatformSwitch(data) {
        const { fromPlatform, toPlatform, reason } = data;
        
        const message = `Switching from ${fromPlatform} to ${toPlatform}. ${reason}`;
        await this.speak(message);
    }
    
    async handleDailyReport(data) {
        const { totalTrades, wins, losses, profit, winRate } = data;
        
        const message = `Daily summary: ${totalTrades} trades, ${wins} wins, ${losses} losses. ` +
                       `Win rate ${winRate}%, profit ${profit}. Excellent performance!`;
        
        await this.speak(message);
    }
    
    async handleGoalAchieved(data) {
        const { goalType, targetValue, actualValue } = data;
        
        const message = `${goalType} goal achieved! Target was ${targetValue}, achieved ${actualValue}. ` +
                       `Outstanding results!`;
        
        await this.speak(message, 'urgent');
    }
    
    // Chat interface for text-based interaction
    async processTextQuery(query, userId = 'default') {
        try {
            this.addToHistory('user', query, userId);
            
            const response = await this.generateResponse(query, userId);
            this.addToHistory('assistant', response, userId);
            
            // Speak the response if voice mode is active
            if (this.config.voiceMode !== 'silent') {
                await this.speak(response);
            }
            
            return response;
        } catch (error) {
            this.log(`Text query processing error: ${error.message}`, 'error');
            return "I'm having trouble processing that request. Please try again.";
        }
    }
    
    async generateResponse(query, userId) {
        const lowercaseQuery = query.toLowerCase();
        
        // Simple command matching (can be enhanced with NLP)
        if (lowercaseQuery.includes('status') || lowercaseQuery.includes('how are')) {
            return await this.getSystemStatus();
        }
        
        if (lowercaseQuery.includes('profit') || lowercaseQuery.includes('balance')) {
            return await this.getProfitStatus();
        }
        
        if (lowercaseQuery.includes('strategy') || lowercaseQuery.includes('trading')) {
            return await this.getStrategyStatus();
        }
        
        if (lowercaseQuery.includes('stop') || lowercaseQuery.includes('pause')) {
            return "I can help you pause trading. Would you like to stop all strategies or a specific one?";
        }
        
        if (lowercaseQuery.includes('start') || lowercaseQuery.includes('resume')) {
            return "Ready to resume trading. All systems are prepared for market execution.";
        }
        
        if (lowercaseQuery.includes('help') || lowercaseQuery.includes('commands')) {
            return this.getHelpMessage();
        }
        
        // Default response
        return "I understand. Is there anything specific about your trading performance you'd like to know?";
    }
    
    async getSystemStatus() {
        // This would integrate with the main system to get actual status
        return "All systems operational. Trading algorithms active, risk management engaged, " +
               "and monitoring market conditions. Performance is within optimal parameters.";
    }
    
    async getProfitStatus() {
        // This would integrate with the actual profit tracking
        return "Current session showing positive performance. Risk management protocols " +
               "are maintaining safe trading levels. Detailed reports available on dashboard.";
    }
    
    async getStrategyStatus() {
        // This would integrate with strategy manager
        return "Multiple strategies active including momentum and boundary breaker. " +
               "AI learning engine is continuously optimizing performance based on market conditions.";
    }
    
    getHelpMessage() {
        return "I can help you with: system status, profit reports, strategy information, " +
               "trading controls, and general assistance. Ask me about your trading performance " +
               "or say 'pause trading' to stop operations.";
    }
    
    getPersonalityMessage(type) {
        const personality = this.personalityProfiles[this.config.personality];
        return personality[type] || personality.greeting;
    }
    
    addToHistory(role, message, userId = 'system') {
        this.conversationHistory.push({
            role,
            message,
            userId,
            timestamp: Date.now()
        });
        
        // Keep only last 50 messages
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
    }
    
    async loadConversationHistory() {
        try {
            const historyPath = path.join(__dirname, '../data/conversation_history.json');
            const data = await fs.readFile(historyPath, 'utf8');
            this.conversationHistory = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is corrupted, start fresh
            this.conversationHistory = [];
        }
    }
    
    async saveConversationHistory() {
        try {
            const historyPath = path.join(__dirname, '../data/conversation_history.json');
            await fs.writeFile(historyPath, JSON.stringify(this.conversationHistory, null, 2));
        } catch (error) {
            this.log(`Failed to save conversation history: ${error.message}`, 'error');
        }
    }
    
    // Voice mode management
    setVoiceMode(mode) {
        if (['smart', 'silent', 'full'].includes(mode)) {
            this.config.voiceMode = mode;
            this.log(`Voice mode set to: ${mode}`);
            
            if (mode !== 'silent') {
                this.speak(`Voice mode changed to ${mode}`);
            }
        }
    }
    
    setPersonality(personality) {
        if (this.personalityProfiles[personality]) {
            this.config.personality = personality;
            this.speak(`Personality updated to ${personality} mode`);
        }
    }
    
    // Emergency controls
    async emergencyShutdown(reason = 'Manual shutdown') {
        await this.speak(`Emergency shutdown initiated. ${reason}`, 'urgent');
        this.isActive = false;
        await this.saveConversationHistory();
        this.emit('emergency_shutdown', { reason, timestamp: Date.now() });
    }
    
    async forceRestart() {
        await this.speak('System restart initiated', 'urgent');
        await this.saveConversationHistory();
        this.isActive = false;
        setTimeout(() => this.init(), 2000);
    }
    
    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [VoiceAssistant] [${level.toUpperCase()}] ${message}`);
        
        // Emit log for external logging systems
        this.emit('log', { timestamp, level, message, component: 'VoiceAssistant' });
    }
    
    // Statistics and analytics
    getVoiceStats() {
        return {
            isActive: this.isActive,
            voiceMode: this.config.voiceMode,
            personality: this.config.personality,
            messagesSent: this.conversationHistory.filter(h => h.role === 'assistant').length,
            queriesReceived: this.conversationHistory.filter(h => h.role === 'user').length,
            capabilities: this.voiceCapabilities
        };
    }
}

module.exports = BaynexaVoiceAssistant;
