#!/usr/bin/env node

// minimal-server.js - Single File BAYNEX.A.X System for Render Deployment
// This is a minimal working version that includes Deriv live trading

require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        BAYNEX.A.X LIVE TRADING SYSTEM                        ║
║               Binary Autonomous Yield Navigation & Execution                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

// Deriv Connector Class
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
        this.stats = {
            totalTrades: 0,
            successfulTrades: 0,
            totalProfit: 0
        };
    }
    
    async initialize() {
        if (!this.apiToken) {
            console.log('⚠️  No Deriv API token found. Set DERIV_API_TOKEN environment variable.');
            return false;
        }
        
        try {
            await this.connect();
            await this.authenticate();
            await this.subscribeToBalance();
            
            console.log(`✅ Deriv Connected - ${this.demo ? 'DEMO' : 'LIVE'} Account`);
            console.log(`💰 Balance: ${this.balance} ${this.currency}`);
            
            if (!this.demo) {
                console.log('🚨 LIVE TRADING ENABLED - REAL MONEY 🚨');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Deriv connection failed:', error.message);
            return false;
        }
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${this.endpoint}?app_id=${this.appId}`);
            
            this.ws.on('open', () => {
                this.isConnected = true;
                console.log('🔗 Connected to Deriv WebSocket');
                resolve();
            });
            
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            
            this.ws.on('close', () => {
                this.isConnected = false;
                this.isAuthenticated = false;
                console.log('❌ Deriv connection closed');
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ Deriv WebSocket error:', error);
                reject(error);
            });
            
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }
    
    async authenticate() {
        const response = await this.sendRequest({ authorize: this.apiToken });
        
        if (response.error) {
            throw new Error(`Authentication failed: ${response.error.message}`);
        }
        
        this.isAuthenticated = true;
        console.log(`🔐 Authenticated: ${response.authorize.email}`);
        return response.authorize;
    }
    
    async subscribeToBalance() {
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
        
        console.log(`🎯 Executing ${this.demo ? 'DEMO' : 'LIVE'} trade: ${direction} ${asset} - $${amount}`);
        
        if (amount < 0.35) {
            throw new Error('Minimum trade amount is $0.35');
        }
        
        if (amount > this.balance) {
            throw new Error('Insufficient balance');
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
            throw new Error(`Trade execution failed: ${response.error.message}`);
        }
        
        const contract = response.buy;
        this.stats.totalTrades++;
        
        console.log(`✅ Trade executed: Contract ${contract.contract_id}`);
        
        return {
            id: contract.contract_id,
            contractId: contract.contract_id,
            asset: asset,
            direction: direction,
            amount: amount,
            entryPrice: contract.start_spot,
            entryTime: new Date(contract.start_time * 1000),
            payout: contract.payout,
            cost: contract.buy_price,
            status: 'active'
        };
    }
    
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('Not connected to Deriv'));
                return;
            }
            
            const requestId = this.requestId++;
            const message = { ...request, req_id: requestId };
            
            this.pendingRequests.set(requestId, { resolve, reject });
            this.ws.send(JSON.stringify(message));
            
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
            
            if (message.req_id && this.pendingRequests.has(message.req_id)) {
                const { resolve } = this.pendingRequests.get(message.req_id);
                this.pendingRequests.delete(message.req_id);
                resolve(message);
                return;
            }
            
            if (message.msg_type === 'balance') {
                const previousBalance = this.balance;
                this.balance = parseFloat(message.balance.balance);
                const change = this.balance - previousBalance;
                
                if (change !== 0) {
                    console.log(`💰 Balance updated: ${this.balance} ${this.currency} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
    
    getStats() {
        return {
            connected: this.isConnected,
            authenticated: this.isAuthenticated,
            balance: this.balance,
            currency: this.currency,
            demo: this.demo,
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
    }
    
    async initialize() {
        console.log('🚀 Initializing BAYNEX.A.X System...');
        
        // Setup Express
        this.setupExpress();
        
        // Initialize Deriv
        const derivConnected = await this.deriv.initialize();
        
        if (derivConnected && this.tradingEnabled) {
            console.log('💰 Trading system ready for live operations');
            
            // Start auto-trading if enabled
            if (process.env.AUTO_START_TRADING === 'true') {
                this.startAutoTrading();
            }
        }
        
        // Start web server
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🌐 BAYNEX.A.X Dashboard: http://localhost:${this.port}`);
            console.log(`📊 API Status: http://localhost:${this.port}/api/status`);
            console.log('✅ System fully operational!');
        });
    }
    
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                deriv: this.deriv.getStats()
            });
        });
        
        // System status API
        this.app.get('/api/status', (req, res) => {
            const derivStats = this.deriv.getStats();
            res.json({
                system: 'BAYNEX.A.X',
                status: derivStats.connected ? 'operational' : 'disconnected',
                trading: {
                    enabled: this.tradingEnabled,
                    mode: derivStats.demo ? 'demo' : 'live',
                    autoTrading: this.autoTrading
                },
                deriv: derivStats,
                trades: {
                    total: this.tradeHistory.length,
                    recent: this.tradeHistory.slice(-5)
                },
                timestamp: new Date().toISOString()
            });
        });
        
        // Execute trade API
        this.app.post('/api/trade', async (req, res) => {
            try {
                if (!this.tradingEnabled) {
                    return res.status(400).json({ error: 'Trading is disabled' });
                }
                
                const { asset, direction, amount } = req.body;
                const trade = await this.deriv.executeTrade({ asset, direction, amount });
                
                this.tradeHistory.push(trade);
                res.json({ success: true, trade });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Dashboard
        this.app.get(['/', '/dashboard'], (req, res) => {
            const derivStats = this.deriv.getStats();
            const liveStatus = derivStats.demo ? 'DEMO' : 'LIVE';
            const statusColor = derivStats.demo ? '#00ff88' : '#ff4444';
            
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>BAYNEX.A.X Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #0a0a0a; color: #fff; }
        .header { text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #1a1a1a, #2a2a2a); padding: 30px; border-radius: 12px; }
        .header h1 { margin: 0; font-size: 2.5em; background: linear-gradient(45deg, #ff6b35, #f7931e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .status { background: #1a1a1a; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #333; }
        .metric { display: inline-block; margin: 15px 25px; text-align: center; }
        .value { font-size: 28px; font-weight: bold; color: ${statusColor}; }
        .label { font-size: 14px; color: #ccc; margin-top: 5px; }
        .live-indicator { background: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .trade-form { background: #1a1a1a; padding: 25px; border-radius: 12px; border: 1px solid #333; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #ccc; }
        .form-group input, .form-group select { width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 16px; }
        .btn { background: linear-gradient(45deg, #ff6b35, #f7931e); color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 107, 53, 0.3); }
        .trades { max-height: 400px; overflow-y: auto; }
        .trade-item { background: #2a2a2a; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #ff6b35; }
        .connection-status { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .connected { background: #00ff88; }
        .disconnected { background: #ff4444; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 BAYNEX.A.X</h1>
        <p>Binary Autonomous Yield Navigation & Execution X-System</p>
        <div class="live-indicator">
            <span class="connection-status ${derivStats.connected ? 'connected' : 'disconnected'}"></span>
            ${liveStatus} TRADING ${derivStats.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
    </div>
    
    <div class="status">
        <h2>📊 System Status</h2>
        <div class="metric">
            <div class="value">${derivStats.connected ? 'OPERATIONAL' : 'OFFLINE'}</div>
            <div class="label">System Status</div>
        </div>
        <div class="metric">
            <div class="value">${liveStatus}</div>
            <div class="label">Trading Mode</div>
        </div>
        <div class="metric">
            <div class="value">${derivStats.balance.toFixed(2)} ${derivStats.currency}</div>
            <div class="label">Account Balance</div>
        </div>
        <div class="metric">
            <div class="value">${derivStats.totalTrades}</div>
            <div class="label">Total Trades</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="trade-form">
            <h3>🎯 Execute Trade</h3>
            <form id="tradeForm">
                <div class="form-group">
                    <label>Asset:</label>
                    <select id="asset">
                        <option value="R_10">Volatility 10</option>
                        <option value="R_25">Volatility 25</option>
                        <option value="R_50">Volatility 50</option>
                        <option value="R_75">Volatility 75</option>
                        <option value="R_100">Volatility 100</option>
                        <option value="frxEURUSD">EUR/USD</option>
                        <option value="frxGBPUSD">GBP/USD</option>
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
                    <label>Amount ($):</label>
                    <input type="number" id="amount" value="1.00" min="0.35" step="0.01">
                </div>
                <button type="submit" class="btn">🚀 Execute Trade</button>
            </form>
        </div>
        
        <div class="trades">
            <h3>📈 Recent Trades</h3>
            <div id="tradesList">
                ${this.tradeHistory.slice(-5).reverse().map(trade => `
                    <div class="trade-item">
                        <strong>${trade.direction} ${trade.asset}</strong><br>
                        Amount: $${trade.amount} | Entry: ${trade.entryPrice || 'N/A'}<br>
                        <small>Time: ${new Date(trade.entryTime).toLocaleString()}</small>
                    </div>
                `).join('')}
                ${this.tradeHistory.length === 0 ? '<p style="color: #666; text-align: center;">No trades executed yet</p>' : ''}
            </div>
        </div>
    </div>
    
    <script>
        document.getElementById('tradeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const asset = document.getElementById('asset').value;
            const direction = document.getElementById('direction').value;
            const amount = parseFloat(document.getElementById('amount').value);
            
            try {
                const response = await fetch('/api/trade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ asset, direction, amount })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Trade executed successfully!');
                    location.reload();
                } else {
                    alert('Trade failed: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    console.log('Status update:', data);
                })
                .catch(error => console.error('Error:', error));
        }, 30000);
    </script>
</body>
</html>
            `);
        });
    }
    
    startAutoTrading() {
        console.log('🤖 Starting auto-trading...');
        this.autoTrading = true;
        
        // Simple auto-trading logic (trades every 5 minutes)
        setInterval(async () => {
            if (this.autoTrading && this.deriv.isConnected && this.deriv.balance > 1) {
                try {
                    const assets = ['R_10', 'R_25', 'R_50'];
                    const directions = ['CALL', 'PUT'];
                    
                    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
                    const amount = Math.min(1.0, this.deriv.balance * 0.02); // 2% of balance
                    
                    const trade = await this.deriv.executeTrade({
                        asset: randomAsset,
                        direction: randomDirection,
                        amount: amount
                    });
                    
                    this.tradeHistory.push(trade);
                    console.log(`🤖 Auto-trade executed: ${trade.direction} ${trade.asset} - $${trade.amount}`);
                    
                } catch (error) {
                    console.error('🤖 Auto-trade failed:', error.message);
                }
            }
        }, 300000); // 5 minutes
    }
}

// Start the system
const baynex = new BayneXSystem();
baynex.initialize().catch(error => {
    console.error('💥 System startup failed:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down BAYNEX.A.X...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down BAYNEX.A.X...');
    process.exit(0);
});
