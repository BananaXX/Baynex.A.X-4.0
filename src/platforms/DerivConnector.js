// src/platforms/DerivConnector.js
// Deriv WebSocket API Connector for Live Trading

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class DerivConnector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            appId: options.appId || process.env.DERIV_APP_ID || '1089',
            apiToken: options.apiToken || process.env.DERIV_API_TOKEN,
            endpoint: options.endpoint || process.env.DERIV_ENDPOINT || 'wss://ws.derivws.com/websockets/v3',
            demo: options.demo === true, // Default to live unless explicitly set to demo
            ...options
        };
        
        this.ws = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.requestId = 1;
        this.pendingRequests = new Map();
        
        this.accountInfo = null;
        this.balance = 0;
        this.currency = 'USD';
        this.activeContracts = new Map();
        this.marketData = new Map();
        
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            connectionUptime: 0,
            lastTradeTime: null
        };
        
        // Trading parameters
        this.tradingConfig = {
            minAmount: 0.35, // Minimum trade amount for Deriv
            maxAmount: 1000,
            defaultDuration: 300, // 5 minutes
            supportedAssets: [
                'R_10', 'R_25', 'R_50', 'R_75', 'R_100', // Volatility indices
                'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', // Forex
                'CRASH1000', 'BOOM1000', 'CRASH500', 'BOOM500' // Crash/Boom
            ]
        };
    }
    
    async initialize() {
        try {
            console.log('🔌 Initializing Deriv Connector...');
            
            if (!this.config.apiToken) {
                throw new Error('Deriv API token is required. Please set DERIV_API_TOKEN environment variable.');
            }
            
            await this.connect();
            await this.authenticate();
            await this.getAccountInfo();
            await this.subscribeToBalance();
            
            console.log(`✅ Deriv Connector initialized successfully`);
            console.log(`   Account Type: ${this.config.demo ? 'Demo' : 'LIVE'}`);
            console.log(`   Balance: ${this.balance} ${this.currency}`);
            
            if (!this.config.demo) {
                console.log('   🚨 LIVE TRADING ENABLED - REAL MONEY TRADES 🚨');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Deriv Connector initialization failed:', error.message);
            throw error;
        }
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔗 Connecting to Deriv WebSocket: ${this.config.endpoint}`);
                
                this.ws = new WebSocket(`${this.config.endpoint}?app_id=${this.config.appId}`);
                
                this.ws.on('open', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('✅ Connected to Deriv WebSocket');
                    this.emit('connected');
                    resolve();
                });
                
                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });
                
                this.ws.on('close', (code, reason) => {
                    this.isConnected = false;
                    this.isAuthenticated = false;
                    console.log(`❌ Deriv WebSocket connection closed: ${code} - ${reason}`);
                    this.emit('disconnected', { code, reason });
                    this.handleReconnect();
                });
                
                this.ws.on('error', (error) => {
                    console.error('❌ Deriv WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                });
                
                // Connection timeout
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async authenticate() {
        console.log('🔐 Authenticating with Deriv API...');
        
        const response = await this.sendRequest({
            authorize: this.config.apiToken
        });
        
        if (response.error) {
            throw new Error(`Authentication failed: ${response.error.message}`);
        }
        
        this.isAuthenticated = true;
        this.accountInfo = response.authorize;
        console.log(`✅ Authenticated as: ${this.accountInfo.email}`);
        
        return response.authorize;
    }
    
    async getAccountInfo() {
        const response = await this.sendRequest({
            get_account_status: 1
        });
        
        if (response.error) {
            throw new Error(`Failed to get account info: ${response.error.message}`);
        }
        
        return response.get_account_status;
    }
    
    async subscribeToBalance() {
        console.log('💰 Subscribing to balance updates...');
        
        const response = await this.sendRequest({
            balance: 1,
            subscribe: 1
        });
        
        if (response.error) {
            throw new Error(`Failed to subscribe to balance: ${response.error.message}`);
        }
        
        this.balance = parseFloat(response.balance.balance);
        this.currency = response.balance.currency;
        
        console.log(`💰 Current balance: ${this.balance} ${this.currency}`);
        
        this.emit('balance_update', {
            platform: 'deriv',
            balance: this.balance,
            currency: this.currency,
            totalBalance: this.balance,
            change: 0
        });
        
        return response.balance;
    }
    
    async executeTrade(params) {
        try {
            const {
                asset = 'R_10',
                direction = 'CALL',
                amount = 1.0,
                duration = 300,
                barrier = null,
                basis = 'stake'
            } = params;
            
            console.log(`🎯 Executing trade: ${direction} ${asset} - Amount: ${amount}`);
            
            // Validate trade parameters
            this.validateTradeParams(params);
            
            // Prepare contract parameters
            const contractParams = {
                buy: 1,
                price: amount,
                parameters: {
                    contract_type: direction.toLowerCase(),
                    symbol: asset,
                    duration: duration,
                    duration_unit: 's',
                    basis: basis,
                    amount: amount
                }
            };
            
            // Add barrier for barrier options
            if (barrier) {
                contractParams.parameters.barrier = barrier;
            }
            
            // Execute the trade
            const response = await this.sendRequest(contractParams);
            
            if (response.error) {
                this.stats.failedTrades++;
                throw new Error(`Trade execution failed: ${response.error.message}`);
            }
            
            const contract = response.buy;
            const trade = {
                id: contract.contract_id,
                contractId: contract.contract_id,
                platform: 'deriv',
                asset: asset,
                direction: direction.toUpperCase(),
                amount: amount,
                entryPrice: contract.start_spot,
                entryTime: new Date(contract.start_time * 1000),
                expiryTime: new Date((contract.start_time + duration) * 1000),
                status: 'active',
                payout: contract.payout,
                cost: contract.buy_price
            };
            
            // Store active contract
            this.activeContracts.set(contract.contract_id, trade);
            
            // Update statistics
            this.stats.totalTrades++;
            this.stats.lastTradeTime = Date.now();
            
            console.log(`✅ Trade executed successfully: ${contract.contract_id}`);
            
            // Subscribe to contract updates
            this.subscribeToContract(contract.contract_id);
            
            this.emit('trade_executed', trade);
            
            return trade;
            
        } catch (error) {
            console.error('❌ Trade execution failed:', error.message);
            this.stats.failedTrades++;
            throw error;
        }
    }
    
    async subscribeToContract(contractId) {
        try {
            await this.sendRequest({
                proposal_open_contract: 1,
                contract_id: contractId,
                subscribe: 1
            });
        } catch (error) {
            console.error(`Failed to subscribe to contract ${contractId}:`, error.message);
        }
    }
    
    validateTradeParams(params) {
        const { asset, direction, amount } = params;
        
        if (!asset) {
            throw new Error('Asset is required');
        }
        
        if (!direction || !['CALL', 'PUT'].includes(direction.toUpperCase())) {
            throw new Error('Direction must be CALL or PUT');
        }
        
        if (!amount || amount < this.tradingConfig.minAmount) {
            throw new Error(`Amount must be at least ${this.tradingConfig.minAmount}`);
        }
        
        if (amount > this.tradingConfig.maxAmount) {
            throw new Error(`Amount cannot exceed ${this.tradingConfig.maxAmount}`);
        }
        
        if (amount > this.balance) {
            throw new Error('Insufficient balance');
        }
    }
    
    async getBalance() {
        try {
            const response = await this.sendRequest({
                balance: 1
            });
            
            if (response.error) {
                throw new Error(`Failed to get balance: ${response.error.message}`);
            }
            
            this.balance = parseFloat(response.balance.balance);
            this.currency = response.balance.currency;
            
            return {
                platform: 'deriv',
                balance: this.balance,
                currency: this.currency,
                totalBalance: this.balance
            };
        } catch (error) {
            console.error('Failed to get balance:', error.message);
            throw error;
        }
    }
    
    async getActiveContracts() {
        try {
            const response = await this.sendRequest({
                portfolio: 1
            });
            
            if (response.error) {
                throw new Error(`Failed to get portfolio: ${response.error.message}`);
            }
            
            return response.portfolio.contracts || [];
        } catch (error) {
            console.error('Failed to get active contracts:', error.message);
            return [];
        }
    }
    
    async closeContract(contractId) {
        try {
            const response = await this.sendRequest({
                sell: contractId,
                price: 0 // Sell at market price
            });
            
            if (response.error) {
                throw new Error(`Failed to close contract: ${response.error.message}`);
            }
            
            console.log(`✅ Contract closed: ${contractId}`);
            
            return response.sell;
        } catch (error) {
            console.error(`Failed to close contract ${contractId}:`, error.message);
            throw error;
        }
    }
    
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('Not connected to Deriv WebSocket'));
                return;
            }
            
            const requestId = this.requestId++;
            const message = {
                ...request,
                req_id: requestId
            };
            
            // Store pending request
            this.pendingRequests.set(requestId, { resolve, reject, timestamp: Date.now() });
            
            // Send request
            this.ws.send(JSON.stringify(message));
            
            // Set timeout for request
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Handle response to pending request
            if (message.req_id && this.pendingRequests.has(message.req_id)) {
                const { resolve } = this.pendingRequests.get(message.req_id);
                this.pendingRequests.delete(message.req_id);
                resolve(message);
                return;
            }
            
            // Handle subscription updates
            if (message.msg_type) {
                this.handleSubscriptionUpdate(message);
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
    
    handleSubscriptionUpdate(message) {
        switch (message.msg_type) {
            case 'balance':
                this.handleBalanceUpdate(message.balance);
                break;
                
            case 'proposal_open_contract':
                this.handleContractUpdate(message.proposal_open_contract);
                break;
                
            case 'tick':
                this.handleTickUpdate(message.tick);
                break;
                
            default:
                // Handle other subscription types
                break;
        }
    }
    
    handleBalanceUpdate(balanceData) {
        const previousBalance = this.balance;
        this.balance = parseFloat(balanceData.balance);
        this.currency = balanceData.currency;
        
        const change = this.balance - previousBalance;
        
        console.log(`💰 Balance updated: ${this.balance} ${this.currency} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`);
        
        this.emit('balance_update', {
            platform: 'deriv',
            balance: this.balance,
            currency: this.currency,
            totalBalance: this.balance,
            change: change,
            timestamp: Date.now()
        });
    }
    
    handleContractUpdate(contractData) {
        const contractId = contractData.contract_id;
        const trade = this.activeContracts.get(contractId);
        
        if (!trade) return;
        
        // Update trade status
        if (contractData.is_expired) {
            trade.status = 'completed';
            trade.result = contractData.profit > 0 ? 'win' : 'loss';
            trade.profit = contractData.profit;
            trade.exitTime = new Date();
            
            // Update statistics
            if (trade.result === 'win') {
                this.stats.successfulTrades++;
            }
            this.stats.totalProfit += contractData.profit;
            
            console.log(`📊 Trade completed: ${contractId} - ${trade.result.toUpperCase()} - Profit: ${contractData.profit}`);
            
            // Remove from active contracts
            this.activeContracts.delete(contractId);
            
            this.emit('trade_closed', trade);
        } else {
            // Update current profit/loss
            trade.currentProfit = contractData.profit;
            trade.currentPrice = contractData.current_spot;
            
            this.emit('trade_update', trade);
        }
    }
    
    handleTickUpdate(tickData) {
        const symbol = tickData.symbol;
        const price = tickData.quote;
        
        this.marketData.set(symbol, {
            price: price,
            timestamp: Date.now(),
            symbol: symbol
        });
        
        this.emit('market_data', {
            asset: symbol,
            price: price,
            timestamp: tickData.epoch * 1000
        });
    }
    
    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.emit('max_reconnect_attempts_reached');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting to Deriv (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(async () => {
            try {
                await this.connect();
                await this.authenticate();
                await this.subscribeToBalance();
                console.log('✅ Successfully reconnected to Deriv');
            } catch (error) {
                console.error('❌ Reconnection failed:', error.message);
                this.handleReconnect();
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    
    getHealthStatus() {
        return {
            status: this.isConnected && this.isAuthenticated ? 'healthy' : 'unhealthy',
            connected: this.isConnected,
            authenticated: this.isAuthenticated,
            balance: this.balance,
            currency: this.currency,
            activeContracts: this.activeContracts.size,
            stats: this.stats
        };
    }
    
    getStats() {
        return {
            ...this.stats,
            balance: this.balance,
            currency: this.currency,
            activeContracts: this.activeContracts.size,
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated
        };
    }
    
    async shutdown() {
        console.log('🔌 Shutting down Deriv Connector...');
        
        try {
            // Close all active positions
            for (const [contractId] of this.activeContracts) {
                try {
                    await this.closeContract(contractId);
                } catch (error) {
                    console.error(`Failed to close contract ${contractId}:`, error.message);
                }
            }
            
            // Close WebSocket connection
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            
            this.isConnected = false;
            this.isAuthenticated = false;
            
            console.log('✅ Deriv Connector shutdown complete');
        } catch (error) {
            console.error('❌ Error during Deriv Connector shutdown:', error);
        }
    }
}

module.exports = DerivConnector;
