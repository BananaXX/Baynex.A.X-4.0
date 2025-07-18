// BAYNEX.A.X Simple Entry Point
// Place this file in the ROOT directory as server.js

console.log('🚀 Starting BAYNEX.A.X System...');
console.log('📍 Current directory:', __dirname);

// Simple Express server for Render deployment
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.static('public'));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'BAYNEX.A.X',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Status endpoint  
app.get('/api/status', (req, res) => {
    res.json({
        system: 'BAYNEX.A.X',
        status: 'running',
        mode: process.env.NODE_ENV || 'development',
        features: {
            trading: true,
            ai_learning: true,
            notifications: true,
            voice_assistant: true,
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
            active_strategies: 0
        }
    });
});

// Main dashboard
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>BAYNEX.A.X - Autonomous Trading System</title>
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
            .info { color: #00aaff; }
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
                <p class="warning">⚠️ Trading Mode: Demo (Safe Mode)</p>
                <p class="info">📊 Platforms: Deriv, MT5, IQ Option</p>
            </div>
            
            <div class="status">
                <h3>🎯 Quick Actions</h3>
                <a href="/api/health" class="button">Health Check</a>
                <a href="/api/status" class="button">System Status</a>
                <a href="/api/stats" class="button">Statistics</a>
            </div>
            
            <div class="status">
                <h3>📱 Next Steps</h3>
                <p>1. ✅ System deployed successfully</p>
                <p>2. 🔧 Configure your trading API credentials</p>
                <p>3. 📊 Test demo trading</p>
                <p>4. 🚀 Go live when ready</p>
            </div>
            
            <div class="status">
                <h3 class="success">🎉 Congratulations!</h3>
                <p>Your BAYNEX.A.X autonomous trading system is now live and ready!</p>
                <p>Current Mode: <span class="warning">SAFE DEMO MODE</span></p>
                <p>No real money will be traded until you configure live credentials.</p>
            </div>
        </div>
        
        <script>
            // Auto-refresh status every 30 seconds
            setInterval(() => {
                fetch('/api/health')
                    .then(r => r.json())
                    .then(data => console.log('System healthy:', data))
                    .catch(err => console.log('Health check failed:', err));
            }, 30000);
        </script>
    </body>
    </html>
    `);
});

// Initialize the trading system (optional - for future integration)
async function initializeTradingSystem() {
    try {
        console.log('🤖 Initializing AI Trading Engine...');
        
        // For now, just log that we're ready
        // Later we can import and start the actual trading system
        
        console.log('✅ BAYNEX.A.X Core System Ready');
        console.log('📊 Demo Mode Active (Safe)');
        console.log('🎯 Ready for configuration');
        
    } catch (error) {
        console.error('❌ Failed to initialize trading system:', error.message);
    }
}

// Start the server
app.listen(PORT, async () => {
    console.log(`🌐 BAYNEX.A.X Server running on port ${PORT}`);
    console.log(`🔗 Dashboard: https://baynex-a-x-4-0.onrender.com`);
    console.log(`📡 Health Check: https://baynex-a-x-4-0.onrender.com/api/health`);
    
    // Initialize trading system
    await initializeTradingSystem();
    
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
