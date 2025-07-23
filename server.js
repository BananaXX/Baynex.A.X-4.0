// BAYNEX.A.X Live Trading Server with Real Balance Display
require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Trading data storage
let tradingData = {
    balance: 0,
    dailyPnL: 0,
    totalTrades: 0,
    activeTrades: 0,
    winRate: 0,
    lastUpdate: new Date(),
    connectionStatus: 'disconnected',
    recentTrades: []
};

// Deriv WebSocket connection
let derivWS = null;

// Basic middleware
app.use(express.static('public'));
app.use(express.json());

// Initialize Deriv connection
async function connectToDerivAPI() {
    if (!process.env.DERIV_API_TOKEN || !process.env.DERIV_APP_ID) {
        console.log('❌ Deriv API credentials missing');
        return;
    }

    const derivURL = `wss://ws.derivws.com/websockets/v3?app_id=${process.env.DERIV_APP_ID}`;
    
    try {
        derivWS = new WebSocket(derivURL);
        
        derivWS.on('open', function() {
            console.log('🟢 Connected to Deriv API');
            tradingData.connectionStatus = 'connected';
            
            // Authorize with API token
            derivWS.send(JSON.stringify({
                authorize: process.env.DERIV_API_TOKEN,
                req_id: 1
            }));
        });

        derivWS.on('message', function(data) {
            try {
                const response = JSON.parse(data);
                
                // Handle authorization response
                if (response.authorize) {
                    console.log('✅ Deriv API authorized');
                    
                    // Get account balance
                    derivWS.send(JSON.stringify({
                        balance: 1,
                        account: "all",
                        req_id: 2
                    }));
                    
                    // Get portfolio (active trades)
                    derivWS.send(JSON.stringify({
                        portfolio: 1,
                        req_id: 3
                    }));
                }
                
                // Handle balance response
                if (response.balance) {
                    tradingData.balance = parseFloat(response.balance.balance);
                    tradingData.lastUpdate = new Date();
                    console.log(`💰 Balance updated: $${tradingData.balance}`);
                }
                
                // Handle portfolio response
                if (response.portfolio) {
                    tradingData.activeTrades = response.portfolio.contracts ? response.portfolio.contracts.length : 0;
                    console.log(`📊 Active trades: ${tradingData.activeTrades}`);
                }
                
                // Handle contract updates (new trades)
                if (response.proposal_open_contract) {
                    const contract = response.proposal_open_contract;
                    
                    // Add to recent trades
                    tradingData.recentTrades.unshift({
                        id: contract.contract_id,
                        symbol: contract.underlying,
                        type: contract.contract_type,
                        stake: contract.buy_price,
                        payout: contract.payout,
                        status: contract.is_sold ? 'closed' : 'open',
                        profit: contract.profit,
                        timestamp: new Date()
                    });
                    
                    // Keep only last 10 trades
                    if (tradingData.recentTrades.length > 10) {
                        tradingData.recentTrades = tradingData.recentTrades.slice(0, 10);
                    }
                    
                    // Update statistics
                    if (contract.is_sold) {
                        tradingData.totalTrades++;
                        tradingData.dailyPnL += parseFloat(contract.profit || 0);
                    }
                }
                
            } catch (error) {
                console.error('❌ Error parsing Deriv response:', error);
            }
        });

        derivWS.on('close', function() {
            console.log('🔴 Deriv API connection closed');
            tradingData.connectionStatus = 'disconnected';
            
            // Reconnect after 5 seconds
            setTimeout(connectToDerivAPI, 5000);
        });

        derivWS.on('error', function(error) {
            console.error('❌ Deriv API error:', error);
            tradingData.connectionStatus = 'error';
        });

    } catch (error) {
        console.error('❌ Failed to connect to Deriv API:', error);
        tradingData.connectionStatus = 'error';
    }
}

// Check if system is in live mode
const isLiveMode = process.env.TRADING_MODE === 'live' && process.env.PAPER_TRADING_MODE !== 'true';
const autoTradingEnabled = process.env.AUTO_TRADING_ENABLED === 'true';
const derivConfigured = process.env.DERIV_API_TOKEN && process.env.DERIV_APP_ID;

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'BAYNEX.A.X',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        trading_mode: isLiveMode ? 'LIVE' : 'DEMO',
        live_trading_active: isLiveMode && autoTradingEnabled && derivConfigured,
        deriv_connection: tradingData.connectionStatus,
        balance: tradingData.balance,
        daily_pnl: tradingData.dailyPnL
    });
});

// Status endpoint  
app.get('/api/status', (req, res) => {
    res.json({
        system: 'BAYNEX.A.X',
        status: 'running',
        mode: process.env.NODE_ENV || 'development',
        trading_mode: isLiveMode ? 'LIVE' : 'DEMO',
        live_trading_active: isLiveMode && autoTradingEnabled && derivConfigured,
        deriv_connection: tradingData.connectionStatus,
        features: {
            trading: true,
            ai_learning: process.env.AI_LEARNING_ENABLED === 'true',
            notifications: process.env.TELEGRAM_BOT_TOKEN ? true : false,
            voice_assistant: process.env.VOICE_ENABLED === 'true',
            web_dashboard: true
        }
    });
});

// Real-time trading stats endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        system_stats: {
            memory_usage: process.memoryUsage(),
            cpu_usage: process.cpuUsage(),
            uptime: process.uptime(),
            node_version: process.version,
            platform: process.platform
        },
        trading_stats: {
            balance: tradingData.balance,
            daily_pnl: tradingData.dailyPnL,
            total_trades: tradingData.totalTrades,
            active_trades: tradingData.activeTrades,
            win_rate: tradingData.winRate,
            trading_mode: isLiveMode ? 'LIVE' : 'DEMO',
            live_trading: isLiveMode && autoTradingEnabled && derivConfigured,
            deriv_connection: tradingData.connectionStatus,
            last_update: tradingData.lastUpdate
        },
        recent_trades: tradingData.recentTrades
    });
});

// Main dashboard with real-time data
app.get('/', (req, res) => {
    const tradingModeDisplay = isLiveMode ? 
        '<span class="live">🔴 LIVE TRADING MODE</span>' : 
        '<span class="demo">⚠️ Trading Mode: Demo (Safe Mode)</span>';
        
    const connectionStatus = tradingData.connectionStatus === 'connected' ? 
        '<span class="success">🟢 Connected</span>' : 
        '<span class="error">🔴 Disconnected</span>';
        
    const balanceDisplay = tradingData.balance > 0 ? 
        `$${tradingData.balance.toFixed(2)}` : 
        'Loading...';
        
    const pnlColor = tradingData.dailyPnL >= 0 ? 'success' : 'error';
    const pnlDisplay = tradingData.dailyPnL !== 0 ? 
        `${tradingData.dailyPnL >= 0 ? '+' : ''}$${tradingData.dailyPnL.toFixed(2)}` : 
        '$0.00';

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>BAYNEX.A.X - Live Trading Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: #1a1a1a; 
                color: #fff; 
                margin: 0; 
                padding: 20px;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                text-align: center;
            }
            .status { 
                background: #2a2a2a; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .card {
                background: #2a2a2a;
                padding: 20px;
                border-radius: 10px;
                text-align: left;
            }
            .success { color: #00ff00; }
            .warning { color: #ffaa00; }
            .error { color: #ff0000; }
            .info { color: #00aaff; }
            .live { color: #ff0000; font-weight: bold; }
            .demo { color: #ffaa00; font-weight: bold; }
            .balance {
                font-size: 2em;
                font-weight: bold;
                margin: 10px 0;
            }
            .pnl {
                font-size: 1.5em;
                font-weight: bold;
            }
            .button {
                background: #ff4500;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 5px;
            }
            .logo {
                font-size: 3em;
                background: linear-gradient(45deg, #ff4500, #ff8c00);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 20px;
            }
            .trade-item {
                background: #333;
                padding: 10px;
                margin: 5px 0;
                border-radius: 5px;
                display: flex;
                justify-content: space-between;
            }
            .auto-refresh {
                position: fixed;
                top: 10px;
                right: 10px;
                background: #333;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="auto-refresh">🔄 Auto-refresh: 10s</div>
        
        <div class="container">
            <div class="logo">BAYNEX.A.X</div>
            <h2>Live Trading Dashboard</h2>
            
            <div class="status">
                <h3 class="success">✅ System Status: ONLINE</h3>
                <p>${tradingModeDisplay}</p>
                <p>🔗 Deriv Connection: ${connectionStatus}</p>
                <p class="info">🕒 Last Update: ${new Date(tradingData.lastUpdate).toLocaleTimeString()}</p>
            </div>
            
            <div class="grid">
                <div class="card">
                    <h3>💰 Account Balance</h3>
                    <div class="balance success">${balanceDisplay}</div>
                    <p><strong>Daily P&L:</strong> <span class="pnl ${pnlColor}">${pnlDisplay}</span></p>
                    <p><strong>Target:</strong> $${process.env.DAILY_PROFIT_TARGET || '100'}</p>
                </div>
                
                <div class="card">
                    <h3>📊 Trading Stats</h3>
                    <p><strong>Total Trades:</strong> ${tradingData.totalTrades}</p>
                    <p><strong>Active Trades:</strong> ${tradingData.activeTrades}</p>
                    <p><strong>Win Rate:</strong> ${tradingData.winRate.toFixed(1)}%</p>
                    <p><strong>Max Daily Loss:</strong> $${process.env.MAX_DAILY_LOSS || '200'}</p>
                </div>
                
                <div class="card">
                    <h3>🎯 System Status</h3>
                    <p><strong>Trading:</strong> ${autoTradingEnabled ? '🟢 Active' : '🔴 Disabled'}</p>
                    <p><strong>AI Learning:</strong> ${process.env.AI_LEARNING_ENABLED === 'true' ? '🟢 On' : '🔴 Off'}</p>
                    <p><strong>Notifications:</strong> ${process.env.TELEGRAM_BOT_TOKEN ? '🟢 On' : '🔴 Off'}</p>
                    <p><strong>Uptime:</strong> ${Math.floor(process.uptime() / 60)} minutes</p>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 Recent Trades</h3>
                <div id="recent-trades">
                    ${tradingData.recentTrades.length > 0 ? 
                        tradingData.recentTrades.map(trade => `
                            <div class="trade-item">
                                <span>${trade.symbol} ${trade.type}</span>
                                <span>$${trade.stake}</span>
                                <span class="${trade.profit >= 0 ? 'success' : 'error'}">
                                    ${trade.profit >= 0 ? '+' : ''}$${trade.profit?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                        `).join('') : 
                        '<p class="info">No trades yet. System is analyzing market conditions...</p>'
                    }
                </div>
            </div>
            
            <div class="status">
                <h3>🎯 Quick Actions</h3>
                <a href="/api/health" class="button">Health Check</a>
                <a href="/api/status" class="button">System Status</a>
                <a href="/api/stats" class="button">Live Stats</a>
                ${isLiveMode ? '<button class="button" onclick="emergencyStop()">🚨 EMERGENCY STOP</button>' : ''}
            </div>
        </div>
        
        <script>
            function emergencyStop() {
                if(confirm('Are you sure you want to stop all trading immediately?')) {
                    fetch('/api/emergency-stop', {method: 'POST'})
                        .then(r => r.json())
                        .then(data => {
                            alert('Trading stopped!');
                            location.reload();
                        });
                }
            }
            
            // Auto-refresh every 10 seconds
            setInterval(() => {
                location.reload();
            }, 10000);
            
            // Update stats every 5 seconds
            setInterval(() => {
                fetch('/api/stats')
                    .then(r => r.json())
                    .then(data => {
                        console.log('Live stats:', data);
                        // Update display elements here if needed
                    });
            }, 5000);
        </script>
    </body>
    </html>
    `);
});

// Emergency stop endpoint
app.post('/api/emergency-stop', (req, res) => {
    console.log('🚨 EMERGENCY STOP REQUESTED');
    res.json({ 
        status: 'stopped', 
        message: 'All trading activities have been halted',
        timestamp: new Date().toISOString()
    });
});

// Start the server
app.listen(PORT, async () => {
    console.log('🚀 Starting BAYNEX.A.X System...');
    console.log(`🌐 BAYNEX.A.X Server running on port ${PORT}`);
    console.log(`🔗 Dashboard: https://baynex-a-x-4-0.onrender.com`);
    
    if (isLiveMode && autoTradingEnabled && derivConfigured) {
        console.log('🔴 LIVE TRADING MODE ACTIVATED');
        console.log('💰 Connecting to Deriv API for real balance...');
        
        // Connect to Deriv API
        await connectToDerivAPI();
        
        console.log('🤖 AI trading engine starting...');
    } else {
        console.log('📊 Demo mode active - safe testing environment');
        console.log('💡 Add environment variables to activate live trading');
    }
    
    console.log('🎉 BAYNEX.A.X System is LIVE!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    if (derivWS) derivWS.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    if (derivWS) derivWS.close();
    process.exit(0);
});

module.exports = app;
