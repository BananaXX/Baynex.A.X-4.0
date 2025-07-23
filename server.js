#!/usr/bin/env node

// server.js - Complete BAYNEX.A.X System (Standalone)
// Binary Autonomous Yield Navigation & Execution X-System

require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         🚀 BAYNEX.A.X LIVE TRADING SYSTEM                   ║
║               Binary Autonomous Yield Navigation & Execution X-System        ║
║                                Version 1.0.0                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Deriv API Connector
class DerivConnector {
    constructor() {
        this.apiToken = process.env.DERIV_API_TOKEN;
        this.appId = process.env.DERIV_APP_ID || '1089';
        this.endpoint = 'wss://ws.derivws.com/websockets/v3';
        this.demo = process.env.DERIV_DEMO === 'true';
        
        this.ws = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.balance = 0;
        this.currency = 'USD';
        this.requestId = 1;
        this.pendingRequests = new Map();
        this.activeContracts = new Map();
        
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            connectionUptime: Date.now()
        };
        
        console.log(`🔗 Deriv Configuration:`);
        console.log(`   Mode: ${this.demo ? 'DEMO' : 'LIVE'}`);
        console.log(`   Token: ${this.apiToken ? '***' + this.apiToken.slice(-4) : 'NOT SET'}`);
    }
    
    async initialize() {
        if (!this.apiToken) {
            console.log('⚠️  No Deriv API token found.');
            console.log('   Set DERIV_API_TOKEN environment variable to enable trading.');
            return false;
        }
        
        try {
            await this.connect();
            await this.authenticate();
            await this.subscribeToBalance();
            
            console.log(`✅ Deriv Connected Successfully`);
            console.log(`   Account Type: ${this.demo ? 'DEMO' : 'LIVE'}`);
            console.log(`   Balance: ${this.balance} ${this.currency}`);
            
            if (!this.demo) {
                console.log('');
                console.log('🚨🚨🚨 LIVE TRADING ENABLED - REAL MONEY 🚨🚨🚨');
                console.log('   All trades will affect your actual account balance!');
                console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
                console.log('');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Deriv connection failed:', error.message);
            return false;
        }
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to Deriv WebSocket...');
            
            this.ws = new WebSocket(`${this.endpoint}?app_id=${this.appId}`);
            
            this.ws.on('open', () => {
                this.isConnected = true;
                console.log('✅ WebSocket connection established');
                resolve();
            });
            
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            
            this.ws.on('close', (code, reason) => {
                this.isConnected = false;
                this.isAuthenticated = false;
                console.log(`❌ Deriv connection closed: ${code} - ${reason}`);
                setTimeout(() => this.reconnect(), 5000);
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ Deriv WebSocket error:', error);
                reject(error);
            });
            
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout after 10 seconds'));
                }
            }, 10000);
        });
    }
    
    async reconnect() {
        if (!this.isConnected && this.apiToken) {
            console.log('🔄 Attempting to reconnect to Deriv...');
            try {
                await this.initialize();
            } catch (error) {
                console.error('❌ Reconnection failed:', error.message);
                setTimeout(() => this.reconnect(), 10000);
            }
        }
    }
    
    async authenticate() {
        console.log('🔐 Authenticating with Deriv API...');
        
        const response = await this.sendRequest({ authorize: this.apiToken });
        
        if (response.error) {
            throw new Error(`Authentication failed: ${response.error.message}`);
        }
        
        this.isAuthenticated = true;
        console.log(`✅ Authenticated as: ${response.authorize.email}`);
        return response.authorize;
    }
    
    async subscribeToBalance() {
        console.log('💰 Subscribing to balance updates...');
        
        const response = await this.sendRequest({ balance: 1, subscribe: 1 });
        
        if (response.error) {
            throw new Error(`Balance subscription failed: ${response.error.message}`);
        }
        
        this.balance = parseFloat(response.balance.balance);
        this.currency = response.balance.currency;
        
        return response.balance;
    }
    
    async executeTrade(params) {
        const { asset = 'R_10', direction = 'CALL', amount = 1.0, duration = 300 } = params;
        
        if (!this.isConnected || !this.isAuthenticated) {
            throw new Error('Not connected to Deriv');
        }
        
        console.log(`🎯 Executing ${this.demo ? 'DEMO' : 'LIVE'} trade:`);
        console.log(`   Asset: ${asset}`);
        console.log(`   Direction: ${direction}`);
        console.log(`   Amount: $${amount}`);
        console.log(`   Duration: ${duration}s`);
        
        // Validate trade parameters
        if (amount < 0.35) {
            throw new Error('Minimum trade amount is $0.35');
        }
        
        if (amount > this.balance) {
            throw new Error(`Insufficient balance. Available: ${this.balance} ${this.currency}`);
        }
        
        const contractParams = {
            buy: 1,
            price: amount,
            parameters: {
                contract_type: direction.toLowerCase(),
                symbol: asset,
                duration: duration,
                duration_unit: 's',
                basis: 'stake',
                amount: amount
            }
        };
        
        const response = await this.sendRequest(contractParams);
        
        if (response.error) {
            this.stats.failedTrades++;
            throw new Error(`Trade execution failed: ${response.error.message}`);
        }
        
        const contract = response.buy;
        this.stats.totalTrades++;
        
        const trade = {
            id: contract.contract_id,
            contractId: contract.contract_id,
            asset: asset,
            direction: direction,
            amount: amount,
            entryPrice: contract.start_spot,
            entryTime: new Date(contract.start_time * 1000),
            expiryTime: new Date((contract.start_time + duration) * 1000),
            payout: contract.payout,
            cost: contract.buy_price,
            status: 'active',
            platform: 'deriv'
        };
        
        this.activeContracts.set(contract.contract_id, trade);
        
        console.log(`✅ Trade executed successfully:`);
        console.log(`   Contract ID: ${contract.contract_id}`);
        console.log(`   Entry Price: ${contract.start_spot}`);
        console.log(`   Potential Payout: ${contract.payout}`);
        
        // Subscribe to contract updates
        this.subscribeToContract(contract.contract_id);
        
        return trade;
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
    
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('Not connected to Deriv WebSocket'));
                return;
            }
            
            const requestId = this.requestId++;
            const message = { ...request, req_id: requestId };
            
            this.pendingRequests.set(requestId, { resolve, reject, timestamp: Date.now() });
            this.ws.send(JSON.stringify(message));
            
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout after 30 seconds'));
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
            switch (message.msg_type) {
                case 'balance':
                    this.handleBalanceUpdate(message.balance);
                    break;
                    
                case 'proposal_open_contract':
                    this.handleContractUpdate(message.proposal_open_contract);
                    break;
                    
                default:
                    break;
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
    
    handleBalanceUpdate(balanceData) {
        const previousBalance = this.balance;
        this.balance = parseFloat(balanceData.balance);
        this.currency = balanceData.currency;
        
        const change = this.balance - previousBalance;
        
        if (Math.abs(change) > 0.01) {
            console.log(`💰 Balance updated: ${this.balance} ${this.currency} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`);
        }
    }
    
    handleContractUpdate(contractData) {
        const contractId = contractData.contract_id;
        const trade = this.activeContracts.get(contractId);
        
        if (!trade) return;
        
        if (contractData.is_expired) {
            trade.status = 'completed';
            trade.result = contractData.profit > 0 ? 'win' : 'loss';
            trade.profit = contractData.profit;
            trade.exitTime = new Date();
            trade.exitPrice = contractData.exit_spot;
            
            if (trade.result === 'win') {
                this.stats.successfulTrades++;
            }
            this.stats.totalProfit += contractData.profit;
            
            console.log(`📊 Trade completed:`);
            console.log(`   Contract: ${contractId}`);
            console.log(`   Result: ${trade.result.toUpperCase()}`);
            console.log(`   Profit: ${contractData.profit} ${this.currency}`);
            console.log(`   Exit Price: ${contractData.exit_spot}`);
            
            this.activeContracts.delete(contractId);
        }
    }
    
    getStats() {
        return {
            connected: this.isConnected,
            authenticated: this.isAuthenticated,
            balance: this.balance,
            currency: this.currency,
            demo: this.demo,
            activeContracts: this.activeContracts.size,
            connectionUptime: Date.now() - this.stats.connectionUptime,
            ...this.stats
        };
    }
}

// Main BAYNEX System
class BayneXSystem {
    constructor() {
        this.deriv = new DerivConnector();
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.tradingEnabled = process.env.TRADING_ENABLED === 'true';
        this.autoTrading = false;
        this.tradeHistory = [];
        this.systemStartTime = Date.now();
        
        console.log(`⚙️  System Configuration:`);
        console.log(`   Trading Enabled: ${this.tradingEnabled}`);
        console.log(`   Auto Trading: ${process.env.AUTO_START_TRADING === 'true'}`);
        console.log(`   Port: ${this.port}`);
    }
    
    async initialize() {
        console.log('\n🚀 Initializing BAYNEX.A.X System...\n');
        
        // Setup Express server
        this.setupExpress();
        
        // Initialize Deriv connection
        const derivConnected = await this.deriv.initialize();
        
        if (derivConnected && this.tradingEnabled) {
            console.log('\n💰 Trading system ready for operations');
            
            // Start auto-trading if enabled
            if (process.env.AUTO_START_TRADING === 'true') {
                this.startAutoTrading();
            }
        } else if (!derivConnected) {
            console.log('\n⚠️  Trading disabled - Deriv connection failed');
        } else {
            console.log('\n⚠️  Trading disabled by configuration');
        }
        
        // Start web server
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log('\n🌐 BAYNEX.A.X Web Server Started:');
            console.log(`   Dashboard: http://localhost:${this.port}`);
            console.log(`   Health Check: http://localhost:${this.port}/health`);
            console.log(`   API Status: http://localhost:${this.port}/api/status`);
            console.log('\n✅ System fully operational and ready for trading!');
        });
    }
    
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const derivStats = this.deriv.getStats();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - this.systemStartTime) / 1000),
                deriv: {
                    connected: derivStats.connected,
                    authenticated: derivStats.authenticated,
                    balance: derivStats.balance,
                    currency: derivStats.currency
                },
                trading: {
                    enabled: this.tradingEnabled,
                    mode: derivStats.demo ? 'demo' : 'live',
                    autoTrading: this.autoTrading
                }
            });
        });
        
        // System status API
        this.app.get('/api/status', (req, res) => {
            const derivStats = this.deriv.getStats();
            res.json({
                system: 'BAYNEX.A.X',
                version: '1.0.0',
                status: derivStats.connected ? 'operational' : 'disconnected',
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - this.systemStartTime) / 1000),
                trading: {
                    enabled: this.tradingEnabled,
                    mode: derivStats.demo ? 'demo' : 'live',
                    autoTrading: this.autoTrading
                },
                deriv: derivStats,
                trades: {
                    total: this.tradeHistory.length,
                    recent: this.tradeHistory.slice(-10).reverse()
                }
            });
        });
        
        // Execute trade API
        this.app.post('/api/trade', async (req, res) => {
            try {
                if (!this.tradingEnabled) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Trading is disabled. Set TRADING_ENABLED=true to enable trading.' 
                    });
                }
                
                if (!this.deriv.isConnected) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Not connected to Deriv. Check your API token.' 
                    });
                }
                
                const { asset, direction, amount } = req.body;
                
                if (!asset || !direction || !amount) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing required parameters: asset, direction, amount' 
                    });
                }
                
                const trade = await this.deriv.executeTrade({ asset, direction, amount });
                
                this.tradeHistory.push({
                    ...trade,
                    timestamp: new Date().toISOString()
                });
                
                res.json({ 
                    success: true, 
                    trade: trade,
                    message: `Trade executed: ${direction} ${asset} - $${amount}`
                });
                
            } catch (error) {
                console.error('Trade execution error:', error.message);
                res.status(400).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
        
        // Emergency stop API
        this.app.post('/api/emergency-stop', (req, res) => {
            this.autoTrading = false;
            console.log('🚨 EMERGENCY STOP ACTIVATED - Auto trading disabled');
            res.json({ 
                success: true, 
                message: 'Emergency stop activated. Auto trading disabled.' 
            });
        });
        
        // Start auto trading API
        this.app.post('/api/start-auto-trading', (req, res) => {
            if (!this.tradingEnabled || !this.deriv.isConnected) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Cannot start auto trading. Check connection and trading settings.' 
                });
            }
            
            this.startAutoTrading();
            res.json({ 
                success: true, 
                message: 'Auto trading started successfully.' 
            });
        });
        
        // Main dashboard
        this.app.get(['/', '/dashboard'], (req, res) => {
            const derivStats = this.deriv.getStats();
            const statusColor = derivStats.demo ? '#00ff88' : '#ff4444';
            const statusText = derivStats.demo ? 'DEMO' : 'LIVE';
            
            res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BAYNEX.A.X Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #0c0c0c, #1a1a1a); 
            color: #fff; 
            min-height: 100vh; 
        }
        .header { 
            text-align: center; 
            padding: 30px 20px; 
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a); 
            border-bottom: 2px solid #333; 
        }
        .header h1 { 
            font-size: 3em; 
            background: linear-gradient(45deg, #ff6b35, #f7931e); 
            -webkit-background-clip: text; 
            -webkit-text-fill-color: transparent; 
            margin-bottom: 10px; 
        }
        .status-badge { 
            background: ${statusColor}; 
            color: white; 
            padding: 10px 20px; 
            border-radius: 25px; 
            font-weight: bold; 
            display: inline-block; 
            margin: 10px; 
            animation: pulse 2s infinite; 
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { 
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a); 
            border-radius: 15px; 
            padding: 25px; 
            border: 1px solid #333; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); 
        }
        .card h3 { color: #ff6b35; margin-bottom: 20px; font-size: 1.4em; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .metric-label { color: #ccc; }
        .metric-value { color: #fff; font-weight: bold; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #ccc; font-weight: 500; }
        .form-group input, .form-group select { 
            width: 100%; 
            padding: 12px; 
            background: #2a2a2a; 
            border: 1px solid #444; 
            border-radius: 8px; 
            color: #fff; 
            font-size: 16px; 
        }
        .btn { 
            background: linear-gradient(45deg, #ff6b35, #f7931e); 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: bold; 
            font-size: 16px; 
            width: 100%; 
            transition: transform 0.2s; 
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 107, 53, 0.4); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .trade-list { max-height: 400px; overflow-y: auto; }
        .trade-item { 
            background: #2a2a2a; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 8px; 
            border-left: 4px solid #ff6b35; 
        }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px; 
        }
        .connected { background: #00ff88; }
        .disconnected { background: #ff4444; }
        .warning { 
            background: linear-gradient(45deg, #ff4444, #ff6666); 
            padding: 20px; 
            border-radius: 10px; 
            margin: 20px 0; 
            text-align: center; 
            font-weight: bold; 
        }
        .footer { text-align: center; padding: 20px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 BAYNEX.A.X</h1>
        <p>Binary Autonomous Yield Navigation & Execution X-System</p>
        <div class="status-badge">
            <span class="status-indicator ${derivStats.connected ? 'connected' : 'disconnected'}"></span>
            ${statusText} TRADING ${derivStats.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
    </div>
    
    <div class="container">
        ${!derivStats.demo ? '<div class="warning">⚠️ LIVE TRADING MODE - All trades use real money from your Deriv account ⚠️</div>' : ''}
        
        <div class="grid">
            <div class="card">
                <h3>📊 System Status</h3>
                <div class="metric">
                    <span class="metric-label">System:</span>
                    <span class="metric-value">${derivStats.connected ? 'OPERATIONAL' : 'OFFLINE'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Trading Mode:</span>
                    <span class="metric-value">${statusText}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Account Balance:</span>
                    <span class="metric-value">${derivStats.balance.toFixed(2)} ${derivStats.currency}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Trades:</span>
                    <span class="metric-value">${derivStats.totalTrades}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Win Rate:</span>
                    <span class="metric-value">${derivStats.totalTrades > 0 ? ((derivStats.successfulTrades / derivStats.totalTrades) * 100).toFixed(1) : 0}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total P&L:</span>
                    <span class="metric-value" style="color: ${derivStats.totalProfit >= 0 ? '#00ff88' : '#ff4444'}">${derivStats.totalProfit >= 0 ? '+' : ''}${derivStats.totalProfit.toFixed(2)} ${derivStats.currency}</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🎯 Execute Trade</h3>
                <form id="tradeForm">
                    <div class="form-group">
                        <label>Asset:</label>
                        <select id="asset">
                            <option value="R_10">Volatility 10 Index</option>
                            <option value="R_25">Volatility 25 Index</option>
                            <option value="R_50">Volatility 50 Index</option>
                            <option value="R_75">Volatility 75 Index</option>
                            <option value="R_100">Volatility 100 Index</option>
                            <option value="frxEURUSD">EUR/USD</option>
                            <option value="frxGBPUSD">GBP/USD</option>
                            <option value="frxUSDJPY">USD/JPY</option>
                            <option value="CRASH1000">Crash 1000</option>
                            <option value="BOOM1000">Boom 1000</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Direction:</label>
                        <select id="direction">
                            <option value="CALL">CALL (Higher)</option>
                            <option value="PUT">PUT (Lower)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (${derivStats.currency}):</label>
                        <input type="number" id="amount" value="1.00" min="0.35" step="0.01" max="${derivStats.balance}">
                    </div>
                    <button type="submit" class="btn" ${!this.tradingEnabled || !derivStats.connected ? 'disabled' : ''}>
                        🚀 Execute Trade
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card">
            <h3>📈 Recent Trades</h3>
            <div class="trade-list" id="tradesList">
                ${this.tradeHistory.slice(-10).reverse().map(trade => `
                    <div class="trade-item">
                        <strong>${trade.direction} ${trade.asset}</strong> - $${trade.amount}<br>
                        Entry: ${trade.entryPrice || 'N/A'} | Status: ${trade.status}<br>
                        <small>Time: ${new Date(trade.entryTime).toLocaleString()}</small>
                    </div>
                `).join('')}
                ${this.tradeHistory.length === 0 ? '<p style="text-align: center; color: #666;">No trades executed yet</p>' : ''}
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>&copy; 2025 BAYNEX.A.X - Advanced AI Trading System</p>
    </div>
    
    <script>
        document.getElementById('tradeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Executing...';
            
            try {
                const response = await fetch('/api/trade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        asset: document.getElementById('asset').value,
                        direction: document.getElementById('direction').value,
                        amount: parseFloat(document.getElementById('amount').value)
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('✅ Trade executed successfully!\\nContract ID: ' + result.trade.contractId);
                    setTimeout(() => location.reload(), 1000);
                } else {
                    alert('❌ Trade failed: ' + result.error);
                }
            } catch (error) {
                alert('❌ Error: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
        
        // Auto-refresh every 30 seconds
        setInterval(async () => {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                console.log('Status update:', data.timestamp);
            } catch (error) {
                console.error('Status update failed:', error);
            }
        }, 30000);
        
        console.log('🚀 BAYNEX.A.X Dashboard Loaded');
        console.log('System Status: ${derivStats.connected ? 'Connected' : 'Disconnected'}');
        console.log('Trading Mode: ${statusText}');
    </script>
</body>
</html>
            `);
        });
    }
    
    startAutoTrading() {
        if (this.autoTrading) {
            console.log('🤖 Auto-trading is already running');
            return;
        }
        
        console.log('🤖 Starting auto-trading system...');
        this.autoTrading = true;
        
        const autoTrade = async () => {
            if (!this.autoTrading || !this.deriv.isConnected || this.deriv.balance < 1) {
                return;
            }
            
            try {
                const assets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
                const directions = ['CALL', 'PUT'];
                
                const asset = assets[Math.floor(Math.random() * assets.length)];
                const direction = directions[Math.floor(Math.random() * directions.length)];
                const amount = Math.min(1.0, this.deriv.balance * 0.01); // 1% of balance
                
                console.log('🤖 Auto-trade executing...');
                const trade = await this.deriv.executeTrade({ asset, direction, amount });
                
                this.tradeHistory.push({
                    ...trade,
                    timestamp: new Date().toISOString(),
                    autoTrade: true
                });
                
                console.log(`🤖 Auto-trade completed: ${trade.direction} ${trade.asset} - $${trade.amount}`);
                
            } catch (error) {
                console.error('🤖 Auto-trade failed:', error.message);
            }
        };
        
        // Execute auto-trade every 5 minutes
        setInterval(autoTrade, 300000);
    }
}

// Environment validation
function validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    if (!process.env.DERIV_API_TOKEN) {
        console.log('⚠️  DERIV_API_TOKEN not set - trading will be disabled');
        console.log('   Get your token from: https://app.deriv.com/account/api-token');
    }
    
    if (process.env.DERIV_DEMO !== 'true') {
        console.log('🚨 LIVE TRADING MODE DETECTED');
        console.log('   Set DERIV_DEMO=true for demo trading');
    }
    
    console.log('✅ Environment validation complete');
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM - shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT - shutting down gracefully...');
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
});

// Start the system
async function main() {
    try {
        validateEnvironment();
        
        const baynex = new BayneXSystem();
        await baynex.initialize();
        
    } catch (error) {
        console.error('💥 System startup failed:', error);
        process.exit(1);
    }
}

main();
