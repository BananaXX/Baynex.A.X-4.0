// ================================
// BAYNEX.A.X VOICE ASSISTANT - BAYNEXA AI
// Intelligent Voice Interface & Communication
// ================================

const EventEmitter = require('events');

class VoiceAssistant extends EventEmitter {
    constructor() {
        super();
        this.dependencies = [];
        this.isInitialized = false;
        this.isEnabled = process.env.VOICE_ENABLED === 'true';
        this.isSpeaking = false;
        
        // Voice configuration
        this.config = {
            language: process.env.VOICE_LANGUAGE || 'en-US',
            speed: parseFloat(process.env.VOICE_SPEED) || 1.0,
            volume: parseFloat(process.env.VOICE_VOLUME) || 0.8,
            pitch: parseFloat(process.env.VOICE_PITCH) || 1.0,
            voice: process.env.VOICE_SELECTION || 'default',
            announcementMode: process.env.VOICE_ANNOUNCEMENTS || 'important_only' // all, important_only, critical_only, off
        };
        
        // Speech queue
        this.speechQueue = [];
        this.isProcessingQueue = false;
        this.maxQueueSize = 10;
        
        // Voice personality and responses
        this.personality = {
            name: 'Baynexa',
            greeting: 'Hello! I am Baynexa, your AI trading assistant.',
            style: 'professional', // professional, friendly, enthusiastic
            useEmojis: false // Voice doesn't need emojis, but text responses might
        };
        
        // Statistics
        this.stats = {
            totalAnnouncements: 0,
            successfulAnnouncements: 0,
            failedAnnouncements: 0,
            averageResponseTime: 0,
            lastAnnouncement: null,
            conversationTurns: 0
        };
        
        // Command recognition patterns
        this.commandPatterns = new Map();
        this.setupCommandPatterns();
        
        // Speech synthesis and recognition
        this.speechSynthesis = null;
        this.speechRecognition = null;
        this.isListening = false;
        
        // Response templates
        this.responseTemplates = {
            trade: {
                executed: [
                    "Trade executed on {asset}, {direction} direction with {amount} dollars",
                    "New {direction} trade placed on {asset} for {amount} dollars",
                    "Trading {asset} with {direction} position, stake amount {amount} dollars"
                ],
                closed: [
                    "Trade closed on {asset}. Result: {result}. Profit: {profit} dollars",
                    "{result} on {asset}. We {profit_verb} {profit} dollars",
                    "Position closed on {asset}. {result} with {profit} dollars {profit_direction}"
                ]
            },
            system: {
                startup: [
                    "Baynex AI trading system is now online and ready for autonomous trading",
                    "Trading system activated. All systems operational.",
                    "Baynexa AI is ready to generate profits. Let's make money!"
                ],
                shutdown: [
                    "Trading system shutting down. All positions have been closed safely.",
                    "Baynexa AI going offline. See you next time!",
                    "System shutdown complete. Trading session ended."
                ],
                error: [
                    "Alert: System error detected. {message}",
                    "Warning: {message}. Please check system status.",
                    "Attention required: {message}"
                ]
            },
            achievement: [
                "Congratulations! Achievement unlocked: {title}",
                "Excellent work! You've achieved: {title}",
                "Great job! New achievement: {title}"
            ],
            emergency: [
                "Emergency stop activated. All trading has been halted immediately.",
                "Critical alert: Emergency procedures in effect. Trading stopped.",
                "Warning: Emergency stop triggered. System is now in safe mode."
            ]
        };
    }

    async initialize() {
        console.log('🎤 Initializing Baynexa AI Voice Assistant...');
        
        try {
            if (!this.isEnabled) {
                console.log('🔇 Voice Assistant disabled in configuration');
                return true;
            }
            
            // Initialize speech synthesis
            await this.initializeSpeechSynthesis();
            
            // Initialize speech recognition if available
            await this.initializeSpeechRecognition();
            
            // Start speech queue processor
            this.startSpeechQueueProcessor();
            
            this.isInitialized = true;
            console.log('✅ Baynexa AI Voice Assistant initialized');
            
            // Welcome message
            await this.speak(this.getRandomResponse(this.responseTemplates.system.startup));
            
            return true;
            
        } catch (error) {
            console.error('❌ Voice Assistant initialization failed:', error);
            // Don't throw error - system can work without voice
            console.log('⚠️ Continuing without voice capabilities');
            return false;
        }
    }

    async initializeSpeechSynthesis() {
        console.log('🔊 Initializing speech synthesis...');
        
        // Check if running in browser environment
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.speechSynthesis = window.speechSynthesis;
            console.log('✅ Browser speech synthesis available');
        } else {
            // Node.js environment - use system TTS
            await this.initializeNodeTTS();
        }
    }

    async initializeNodeTTS() {
        try {
            // Try to use system TTS (macOS 'say' command, Windows SAPI, Linux espeak)
            const os = require('os');
            const platform = os.platform();
            
            if (platform === 'darwin') {
                // macOS
                this.ttsCommand = 'say';
                console.log('🍎 macOS TTS (say) available');
            } else if (platform === 'win32') {
                // Windows
                this.ttsCommand = 'powershell';
                this.ttsArgs = ['-Command', 'Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak'];
                console.log('🪟 Windows TTS (SAPI) available');
            } else {
                // Linux - try espeak
                this.ttsCommand = 'espeak';
                console.log('🐧 Linux TTS (espeak) available');
            }
            
        } catch (error) {
            console.log('⚠️ System TTS not available, using text-only mode');
            this.speechSynthesis = null;
        }
    }

    async initializeSpeechRecognition() {
        console.log('🎙️ Initializing speech recognition...');
        
        // Check if running in browser environment
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (SpeechRecognition) {
                this.speechRecognition = new SpeechRecognition();
                this.speechRecognition.continuous = true;
                this.speechRecognition.interimResults = false;
                this.speechRecognition.lang = this.config.language;
                
                this.speechRecognition.onresult = this.handleSpeechResult.bind(this);
                this.speechRecognition.onerror = this.handleSpeechError.bind(this);
                
                console.log('✅ Browser speech recognition available');
            }
        } else {
            console.log('🔇 Speech recognition not available in Node.js environment');
        }
    }

    setupCommandPatterns() {
        console.log('🧠 Setting up voice command patterns...');
        
        // System commands
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(what's|what is)\s+(the\s+)?system status/i, 'getSystemStatus');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*how\s+are\s+we\s+doing/i, 'getPerformanceStatus');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(what's|what is)\s+(the\s+)?balance/i, 'getAccountBalance');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*stop\s+trading/i, 'stopTrading');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*start\s+trading/i, 'startTrading');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*emergency\s+stop/i, 'emergencyStop');
        
        // Performance commands
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(show|tell)\s+me\s+(today's|todays)\s+(performance|results)/i, 'getDailyPerformance');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(what's|what is)\s+(the\s+)?win\s+rate/i, 'getWinRate');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*how\s+much\s+(profit|money)\s+did\s+we\s+make/i, 'getTotalProfit');
        
        // Strategy commands
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(what's|what is)\s+(the\s+)?best\s+strategy/i, 'getBestStrategy');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*how\s+many\s+strategies\s+are\s+active/i, 'getActiveStrategies');
        
        // General commands
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(hello|hi|hey)/i, 'greet');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*help/i, 'showHelp');
        this.commandPatterns.set(/^(hey )?baynexa,?\s*(thank you|thanks)/i, 'acknowledgeThank');
        
        console.log(`✅ ${this.commandPatterns.size} voice command patterns configured`);
    }

    // ================================
    // SPEECH SYNTHESIS
    // ================================
    async speak(text, options = {}) {
        if (!this.isEnabled || !text) return;
        
        // Filter based on announcement mode
        if (!this.shouldAnnounce(options.priority || 'normal')) {
            return;
        }
        
        console.log(`🎤 Baynexa: "${text}"`);
        
        // Add to speech queue
        this.addToSpeechQueue(text, options);
        
        this.stats.totalAnnouncements++;
    }

    addToSpeechQueue(text, options = {}) {
        if (this.speechQueue.length >= this.maxQueueSize) {
            // Remove oldest item if queue is full
            this.speechQueue.shift();
            console.log('⚠️ Speech queue full, removed oldest item');
        }
        
        this.speechQueue.push({
            text: text,
            options: options,
            timestamp: new Date()
        });
        
        this.processSpeechQueue();
    }

    startSpeechQueueProcessor() {
        // Process speech queue every 2 seconds
        setInterval(() => {
            if (!this.isProcessingQueue && this.speechQueue.length > 0) {
                this.processSpeechQueue();
            }
        }, 2000);
    }

    async processSpeechQueue() {
        if (this.isProcessingQueue || this.speechQueue.length === 0 || this.isSpeaking) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            const speechItem = this.speechQueue.shift();
            await this.speakDirect(speechItem.text, speechItem.options);
        } catch (error) {
            console.error('❌ Error processing speech queue:', error);
            this.stats.failedAnnouncements++;
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async speakDirect(text, options = {}) {
        if (this.isSpeaking) return;
        
        this.isSpeaking = true;
        const startTime = Date.now();
        
        try {
            if (this.speechSynthesis && typeof window !== 'undefined') {
                await this.speakBrowser(text, options);
            } else if (this.ttsCommand) {
                await this.speakSystem(text, options);
            } else {
                // Text-only mode - just log
                console.log(`🗣️ [Voice]: ${text}`);
            }
            
            const responseTime = Date.now() - startTime;
            this.updateResponseTimeStats(responseTime);
            this.stats.successfulAnnouncements++;
            this.stats.lastAnnouncement = new Date();
            
        } catch (error) {
            console.error('❌ Speech synthesis error:', error);
            this.stats.failedAnnouncements++;
        } finally {
            this.isSpeaking = false;
        }
    }

    async speakBrowser(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.speechSynthesis) {
                reject(new Error('Speech synthesis not available'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure voice settings
            utterance.rate = options.speed || this.config.speed;
            utterance.volume = options.volume || this.config.volume;
            utterance.pitch = options.pitch || this.config.pitch;
            utterance.lang = options.language || this.config.language;
            
            // Set voice if available
            const voices = this.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const preferredVoice = voices.find(voice => 
                    voice.name.includes(this.config.voice) || 
                    voice.lang === this.config.language
                );
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }
            }
            
            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);
            
            this.speechSynthesis.speak(utterance);
        });
    }

    async speakSystem(text, options = {}) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            let command, args;
            
            if (this.ttsCommand === 'say') {
                // macOS
                command = 'say';
                args = ['-r', Math.round((options.speed || this.config.speed) * 200), text];
            } else if (this.ttsCommand === 'powershell') {
                // Windows
                command = 'powershell';
                args = ['-Command', `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${text.replace(/'/g, "''")}'); $synth.Dispose()`];
            } else if (this.ttsCommand === 'espeak') {
                // Linux
                command = 'espeak';
                args = ['-s', Math.round((options.speed || this.config.speed) * 150), text];
            } else {
                reject(new Error('No TTS command available'));
                return;
            }
            
            const process = spawn(command, args);
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`TTS command failed with code ${code}`));
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    // ================================
    // SPEECH RECOGNITION
    // ================================
    startListening() {
        if (!this.speechRecognition || this.isListening) return;
        
        try {
            this.speechRecognition.start();
            this.isListening = true;
            console.log('🎙️ Baynexa is now listening...');
        } catch (error) {
            console.error('❌ Failed to start speech recognition:', error);
        }
    }

    stopListening() {
        if (!this.speechRecognition || !this.isListening) return;
        
        try {
            this.speechRecognition.stop();
            this.isListening = false;
            console.log('🔇 Baynexa stopped listening');
        } catch (error) {
            console.error('❌ Failed to stop speech recognition:', error);
        }
    }

    handleSpeechResult(event) {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        const confidence = event.results[event.results.length - 1][0].confidence;
        
        console.log(`🎙️ Heard: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
        
        if (confidence > 0.7) {
            this.processVoiceCommand(transcript);
        }
    }

    handleSpeechError(event) {
        console.error('❌ Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
            console.log('⚠️ Microphone access denied');
        }
    }

    // ================================
    // COMMAND PROCESSING
    // ================================
    async processVoiceCommand(transcript) {
        console.log(`🧠 Processing voice command: "${transcript}"`);
        
        this.stats.conversationTurns++;
        
        // Find matching command pattern
        for (const [pattern, command] of this.commandPatterns) {
            if (pattern.test(transcript)) {
                console.log(`✅ Matched command: ${command}`);
                await this.executeCommand(command, transcript);
                return;
            }
        }
        
        // No specific command matched - provide general response
        await this.handleUnknownCommand(transcript);
    }

    async executeCommand(command, transcript) {
        try {
            switch (command) {
                case 'getSystemStatus':
                    await this.announceSystemStatus();
                    break;
                    
                case 'getPerformanceStatus':
                    await this.announcePerformanceStatus();
                    break;
                    
                case 'getAccountBalance':
                    await this.announceAccountBalance();
                    break;
                    
                case 'stopTrading':
                    await this.handleStopTradingCommand();
                    break;
                    
                case 'startTrading':
                    await this.handleStartTradingCommand();
                    break;
                    
                case 'emergencyStop':
                    await this.handleEmergencyStopCommand();
                    break;
                    
                case 'getDailyPerformance':
                    await this.announceDailyPerformance();
                    break;
                    
                case 'getWinRate':
                    await this.announceWinRate();
                    break;
                    
                case 'getTotalProfit':
                    await this.announceTotalProfit();
                    break;
                    
                case 'getBestStrategy':
                    await this.announceBestStrategy();
                    break;
                    
                case 'getActiveStrategies':
                    await this.announceActiveStrategies();
                    break;
                    
                case 'greet':
                    await this.handleGreeting();
                    break;
                    
                case 'showHelp':
                    await this.showVoiceHelp();
                    break;
                    
                case 'acknowledgeThank':
                    await this.handleThankYou();
                    break;
                    
                default:
                    await this.handleUnknownCommand(transcript);
            }
            
        } catch (error) {
            console.error(`❌ Error executing command ${command}:`, error);
            await this.speak('Sorry, I encountered an error processing that command.');
        }
    }

    // ================================
    // COMMAND HANDLERS
    // ================================
    async announceSystemStatus() {
        // Get system status from main system
        const system = this.getComponent('system');
        if (system) {
            const status = system.getSystemStatus();
            const uptime = status.uptime ? Math.round(status.uptime / 1000 / 60) : 0;
            
            await this.speak(
                `System status: ${status.isRunning ? 'Running' : 'Stopped'}. ` +
                `Current balance: ${this.formatCurrency(status.currentBalance)}. ` +
                `Uptime: ${uptime} minutes. ` +
                `${status.activeStrategies} strategies active.`
            );
        } else {
            await this.speak('System status information is not available.');
        }
    }

    async announcePerformanceStatus() {
        const system = this.getComponent('system');
        if (system) {
            const stats = system.getSystemStats();
            
            await this.speak(
                `Today's performance: ${this.formatCurrency(stats.dailyProfit)} profit. ` +
                `Total trades: ${stats.totalTrades}. ` +
                `Win rate: ${stats.winRate.toFixed(1)} percent.`
            );
        } else {
            await this.speak('Performance data is not available.');
        }
    }

    async announceAccountBalance() {
        const riskManager = this.getComponent('riskManager');
        if (riskManager) {
            const balance = riskManager.getAccountBalance();
            await this.speak(`Current account balance is ${this.formatCurrency(balance)}.`);
        } else {
            await this.speak('Account balance information is not available.');
        }
    }

    async handleStopTradingCommand() {
        await this.speak('Stopping trading system. Please wait.');
        
        const system = this.getComponent('system');
        if (system) {
            try {
                await system.stop();
                await this.speak('Trading system has been stopped successfully.');
            } catch (error) {
                await this.speak('Failed to stop trading system. Please check the dashboard.');
            }
        }
    }

    async handleStartTradingCommand() {
        await this.speak('Starting trading system. Please wait.');
        
        const system = this.getComponent('system');
        if (system) {
            try {
                await system.start();
                await this.speak('Trading system has been started successfully.');
            } catch (error) {
                await this.speak('Failed to start trading system. Please check the dashboard.');
            }
        }
    }

    async handleEmergencyStopCommand() {
        await this.speak('Emergency stop initiated. Halting all trading immediately.');
        
        const system = this.getComponent('system');
        if (system) {
            await system.emergencyShutdown();
        }
        
        await this.speak('Emergency stop completed. All trading has been halted.');
    }

    async announceDailyPerformance() {
        const system = this.getComponent('system');
        if (system) {
            const stats = system.getSystemStats();
            const profitText = stats.dailyProfit >= 0 ? 'made' : 'lost';
            
            await this.speak(
                `Today's performance summary: ` +
                `We ${profitText} ${this.formatCurrency(Math.abs(stats.dailyProfit))}. ` +
                `Executed ${stats.totalTrades} trades with a ${stats.winRate.toFixed(1)} percent win rate.`
            );
        }
    }

    async announceWinRate() {
        const system = this.getComponent('system');
        if (system) {
            const stats = system.getSystemStats();
            await this.speak(`Current win rate is ${stats.winRate.toFixed(1)} percent.`);
        }
    }

    async announceTotalProfit() {
        const system = this.getComponent('system');
        if (system) {
            const stats = system.getSystemStats();
            const totalText = stats.totalProfit >= 0 ? 'made' : 'lost';
            
            await this.speak(
                `Total profit: We have ${totalText} ${this.formatCurrency(Math.abs(stats.totalProfit))} ` +
                `across ${stats.totalTrades} trades.`
            );
        }
    }

    async announceBestStrategy() {
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager) {
            const bestStrategy = strategyManager.getBestPerformingStrategy();
            if (bestStrategy) {
                await this.speak(
                    `Best performing strategy is ${bestStrategy.name} ` +
                    `with a ${bestStrategy.performance.winRate.toFixed(1)} percent win rate.`
                );
            } else {
                await this.speak('No strategy performance data available yet.');
            }
        }
    }

    async announceActiveStrategies() {
        const strategyManager = this.getComponent('strategyManager');
        if (strategyManager) {
            const count = strategyManager.getActiveStrategiesCount();
            await this.speak(`Currently ${count} trading strategies are active.`);
        }
    }

    async handleGreeting() {
        const greetings = [
            `Hello! I'm Baynexa, your AI trading assistant. How can I help you today?`,
            `Hi there! Baynexa here. What would you like to know about your trading performance?`,
            `Greetings! I'm ready to assist you with your trading system.`
        ];
        
        await this.speak(this.getRandomResponse(greetings));
    }

    async showVoiceHelp() {
        await this.speak(
            'Here are some things you can ask me: ' +
            'System status, account balance, daily performance, win rate, ' +
            'best strategy, stop trading, or start trading. ' +
            'Just say "Hey Baynexa" followed by your question.'
        );
    }

    async handleThankYou() {
        const responses = [
            "You're welcome! Happy to help with your trading success.",
            "My pleasure! Let's keep making profits together.",
            "Anytime! I'm here to help you succeed."
        ];
        
        await this.speak(this.getRandomResponse(responses));
    }

    async handleUnknownCommand(transcript) {
        const responses = [
            "I'm not sure I understand that command. Try asking about system status, balance, or performance.",
            "I didn't catch that. You can ask me about trading performance, account balance, or system status.",
            "Could you please rephrase that? I can help with system information and trading statistics."
        ];
        
        await this.speak(this.getRandomResponse(responses));
    }

    // ================================
    // TRADING EVENT HANDLERS
    // ================================
    async announceTradeExecution(trade) {
        if (!this.shouldAnnounce('normal')) return;
        
        const template = this.getRandomResponse(this.responseTemplates.trade.executed);
        const message = this.formatTemplate(template, {
            asset: trade.asset,
            direction: trade.direction,
            amount: trade.amount
        });
        
        await this.speak(message, { priority: 'normal' });
    }

    async announceTradeClose(trade) {
        const priority = Math.abs(trade.profit) > 50 ? 'important' : 'normal';
        
        if (!this.shouldAnnounce(priority)) return;
        
        const template = this.getRandomResponse(this.responseTemplates.trade.closed);
        const message = this.formatTemplate(template, {
            asset: trade.asset,
            result: trade.result,
            profit: Math.abs(trade.profit).toFixed(2),
            profit_verb: trade.profit >= 0 ? 'made' : 'lost',
            profit_direction: trade.profit >= 0 ? 'profit' : 'loss'
        });
        
        await this.speak(message, { priority: priority });
    }

    async announceAchievement(achievement) {
        if (!this.shouldAnnounce('important')) return;
        
        const template = this.getRandomResponse(this.responseTemplates.achievement);
        const message = this.formatTemplate(template, {
            title: achievement.title
        });
        
        await this.speak(message, { priority: 'important' });
    }

    async announceSystemAlert(alert) {
        const priority = alert.critical ? 'critical' : 'important';
        
        if (!this.shouldAnnounce(priority)) return;
        
        if (alert.type === 'emergency_stop') {
            const template = this.getRandomResponse(this.responseTemplates.emergency);
            await this.speak(template, { priority: 'critical' });
        } else {
            const template = this.getRandomResponse(this.responseTemplates.system.error);
            const message = this.formatTemplate(template, {
                message: alert.message || alert.type
            });
            
            await this.speak(message, { priority: priority });
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================
    shouldAnnounce(priority) {
        switch (this.config.announcementMode) {
            case 'all':
                return true;
            case 'important_only':
                return ['important', 'critical'].includes(priority);
            case 'critical_only':
                return priority === 'critical';
            case 'off':
                return false;
            default:
                return priority !== 'low';
        }
    }

    getRandomResponse(responses) {
        if (Array.isArray(responses)) {
            return responses[Math.floor(Math.random() * responses.length)];
        }
        return responses;
    }

    formatTemplate(template, data) {
        let formatted = template;
        
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            formatted = formatted.replace(new RegExp(placeholder, 'g'), value);
        }
        
        return formatted;
    }

    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        const absValue = Math.abs(value);
        
        if (absValue >= 1000) {
            return `${(value / 1000).toFixed(1)} thousand dollars`;
        } else if (absValue < 1) {
            return `${(value * 100).toFixed(0)} cents`;
        } else {
            return `${value.toFixed(2)} dollars`;
        }
    }

    updateResponseTimeStats(responseTime) {
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.successfulAnnouncements - 1) + responseTime) / 
            this.stats.successfulAnnouncements;
    }

    // ================================
    // CONFIGURATION & MANAGEMENT
    // ================================
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🎤 Voice Assistant configuration updated');
    }

    setAnnouncementMode(mode) {
        this.config.announcementMode = mode;
        console.log(`🔊 Announcement mode set to: ${mode}`);
        
        const confirmationMessages = {
            'all': 'I will now announce all trading activities.',
            'important_only': 'I will now announce only important events.',
            'critical_only': 'I will now announce only critical alerts.',
            'off': 'Voice announcements are now disabled.'
        };
        
        if (mode !== 'off') {
            this.speak(confirmationMessages[mode] || 'Announcement mode updated.');
        }
    }

    setVoiceSpeed(speed) {
        this.config.speed = Math.max(0.1, Math.min(3.0, speed));
        console.log(`🎤 Voice speed set to: ${this.config.speed}`);
    }

    setVoiceVolume(volume) {
        this.config.volume = Math.max(0.0, Math.min(1.0, volume));
        console.log(`🔊 Voice volume set to: ${this.config.volume}`);
    }

    clearSpeechQueue() {
        this.speechQueue = [];
        console.log('🗑️ Speech queue cleared');
    }

    getStats() {
        return {
            ...this.stats,
            isEnabled: this.isEnabled,
            isInitialized: this.isInitialized,
            isSpeaking: this.isSpeaking,
            isListening: this.isListening,
            queueSize: this.speechQueue.length,
            announcementMode: this.config.announcementMode,
            successRate: this.stats.totalAnnouncements > 0 ? 
                (this.stats.successfulAnnouncements / this.stats.totalAnnouncements * 100).toFixed(2) + '%' : '0%'
        };
    }

    healthCheck() {
        return {
            status: this.isEnabled ? (this.isInitialized ? 'active' : 'initializing') : 'disabled',
            initialized: this.isInitialized,
            speechSynthesis: !!this.speechSynthesis,
            speechRecognition: !!this.speechRecognition,
            totalAnnouncements: this.stats.totalAnnouncements,
            successRate: this.stats.totalAnnouncements > 0 ? 
                (this.stats.successfulAnnouncements / this.stats.totalAnnouncements * 100).toFixed(2) + '%' : '0%',
            queueSize: this.speechQueue.length,
            lastAnnouncement: this.stats.lastAnnouncement
        };
    }

    async start() {
        console.log('▶️ Starting Voice Assistant...');
        
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.speechRecognition && this.isEnabled) {
            this.startListening();
        }
    }

    async stop() {
        console.log('⏹️ Stopping Voice Assistant...');
        
        if (this.speechRecognition && this.isListening) {
            this.stopListening();
        }
        
        // Clear speech queue
        this.clearSpeechQueue();
        
        // Final goodbye message
        if (this.isEnabled) {
            await this.speak('Baynexa AI signing off. Goodbye!');
        }
    }

    // Method to receive component references
    getComponent(name) {
        // This will be set by the integration layer
        return null;
    }
}

module.exports = VoiceAssistant;
