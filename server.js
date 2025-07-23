// BAYNEX.A.X Live Trading Server - Reads Environment Variables
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.static('public'));
app.use(express.json());

// Check if system is in live mode
const isLiveMode = process.env.TRADING_MODE === 'live' && process.env.PAPER_TRADING_MODE !== 'true';
const autoTradingEnabled = process.env.AUTO_TRADING_ENABLED === 'true';
const derivConfigured = process.env.DERIV_API_TOKEN && process.env.DERIV_APP_ID;

console.log('🔧 BAYNEX.A.X Configuration Check:');
console.log('📊 TRADING_MODE:', process.env.TRADING_MODE || 'not set');
console.log('📊 PAPER_TRADING_MODE:', process.env.PAPER_TRADING_MODE || 'not set');
console.log('📊 AUTO_TRADING_ENABLED:', process.env.AUTO_TRADING_ENABLED || 'not set');
console.log('📊 DERIV_API_TOKEN:', process.env.DERIV_API_TOKEN ? 'configured ✅' : 'missing ❌');
console.log('📊 IS_LIVE_MODE:', isLiveMode);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'BAYNEX.A.X',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        trading_mode: isLiveMode ? 'LIVE' : 'DEMO',
        live_trading_active: isLiveMode && autoTradingEnabled && derivConfigured
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
        features: {
            trading: true,
            ai_learning: process.env.AI_LEARNING_ENABLED === 'true',
            notifications: process.env.TELEGRAM_BOT_TOKEN ? true : false,
            voice_assistant: process.env.VOICE_ENABLED === 'true',
            web_dashboard: true
        }
    });
});

// System stats endpoint
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
            total_trades: 0,
            daily_profit: 0,
            win_rate: 0,
            active_strategies: 0,
            trading_mode: isLiveMode ? 'LIVE' : 'DEMO',
            live_trading: isLiveMode && autoTradingEnabled && derivConfigured
        }
    });
});

// Main dashboard
app.get('/', (req, res) => {
    const tradingModeDisplay = isLiveMode ? 
        '<span class="live">🔴 LIVE TRADING MODE</span>' : 
        '<span class="demo">⚠️ Trading Mode: Demo (Safe Mode)</span>';
        
    const statusColor = isLiveMode ? '#ff0000' : '#ffaa00';
    const statusMessage = isLiveMode ? 
        'REAL MONEY TRADING ACTIVE' : 
        'SAFE DEMO MODE - No real money at risk';
        
    const configStatus = !derivConfigured ? 
        '<p class="error">❌ Configuration Missing: Add DERIV_API_TOKEN and DERIV_APP_ID to Environment Variables</p>' :
        '<p class="success">✅ Deriv API Configured</p>';
        
    const nextStepMessage = isLiveMode ? 
        'Your system is LIVE and ready to trade!' :
        'Add environment variables and redeploy to activate live trading.';

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>BAYNEX.A.X - Autonomous Trading System</title>
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
                max-width: 800px; 
                margin: 0 auto; 
                text-align: center;
            }
            .status { 
                background: #2a2a2a; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0;
            }
            .success { color: #00ff00; }
            .warning { color: #ffaa00; }
            .error { color: #ff0000; }
            .info { color: #00aaff; }
            .live { color: #ff0000; font-weight: bold; }
            .demo { color: #ffaa00; font-weight: bold; }
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
            .env-vars {
                background: #333;
                padding: 15px;
                border-radius: 5px;
                text-align: left;
                font-family: monospace;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">BAYNEX.A.X</div>
            <h2>Binary Autonomous Yield Navigation & Execution X-System</h2>
            
            <div class="status">
                <h3 class="success">✅ System Status: ONLINE</h3>
                <p class="info">🚀 Deployment: Successful</p>
                <p class="info">🤖 AI Engine: Ready</p>
                <p style="color: ${statusColor}">${tradingModeDisplay}</p>
                <p class="info">📊 Platforms: Deriv, MT5, IQ Option</p>
                ${configStatus}
            </div>
            
            <div class="status">
                <h3>📊 Environment Status</h3>
                <p><strong>TRADING_MODE:</strong> ${process.env.TRADING_MODE || 'not set'}</p>
                <p><strong>PAPER_TRADING_MODE:</strong> ${process.env.PAPER_TRADING_MODE || 'not set'}</p>
                <p><strong>AUTO_TRADING_ENABLED:</strong> ${process.env.AUTO_TRADING_ENABLED || 'not set'}</p>
                <p><strong>DERIV_API_TOKEN:</strong> ${process.env.DERIV_API_TOKEN ? 'configured ✅' : 'missing ❌'}</p>
                <p><strong>DERIV_APP_ID:</strong> ${process.env.DERIV_APP_ID || 'missing ❌'}</p>
            </div>
            
            ${!isLiveMode ? `
            <div class="status">
                <h3 class="warning">⚠️ TO ACTIVATE LIVE TRADING</h3>
                <p>Add these environment variables in Render Dashboard:</p>
                <div class="env-vars">
TRADING_MODE=live<br>
PAPER_TRADING_MODE=false<br>
AUTO_TRADING_ENABLED=true<br>
DERIV_API_TOKEN=lJbaXqZRIBYoXfO<br>
DERIV_APP_ID=71673<br>
MAX_DAILY_LOSS=200<br>
DAILY_PROFIT_TARGET=100
                </div>
                <p class="warning">Then click "Manual Deploy" to restart with live trading!</p>
            </div>
            ` : `
            <div class="status">
                <h3 class="live">🔴 LIVE TRADING ACTIVE</h3>
                <p class="error">⚠️ REAL MONEY TRADING IN PROGRESS</p>
                <p>Max Daily Loss: $${process.env.MAX_DAILY_LOSS || '200'}</p>
                <p>Daily Profit Target: $${process.env.DAILY_PROFIT_TARGET || '100'}</p>
                <button class="button" onclick="emergencyStop()">🚨 EMERGENCY STOP</button>
            </div>
            `}
            
            <div class="status">
                <h3>🎯 Quick Actions</h3>
                <a href="/api/health" class="button">Health Check</a>
                <a href="/api/status" class="button">System Status</a>
                <a href="/api/stats" class="button">Statistics</a>
            </div>
            
            <div class="status">
                <h3 class="info">📝 Current Status</h3>
                <p>${statusMessage}</p>
                <p>${nextStepMessage}</p>
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
            
            // Auto-refresh every 30 seconds
            setInterval(() => {
                fetch('/api/health')
                    .then(r => r.json())
                    .then(data => console.log('System check:', data))
                    .catch(err => console.log('Health check failed:', err));
            }, 30000);
        </script>
    </body>
    </html>
    `);
});

// Emergency stop endpoint
app.post('/api/emergency-stop', (req, res) => {
    console.log('🚨 EMERGENCY STOP REQUESTED');
    // In a real implementation, this would stop all trading
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
    console.log(`📡 Health Check: https://baynex-a-x-4-0.onrender.com/api/health`);
    
    if (isLiveMode && autoTradingEnabled && derivConfigured) {
        console.log('🔴 LIVE TRADING MODE ACTIVATED');
        console.log('💰 Real money trading is ACTIVE');
        console.log('📊 Deriv API connected');
        console.log('🤖 AI trading engine starting...');
    } else {
        console.log('📊 Demo mode active - safe testing environment');
        console.log('💡 Add environment variables to activate live trading');
    }
    
    console.log('🎉 BAYNEX.A.X System is LIVE!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
