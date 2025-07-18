// server.js - Main Entry Point for BAYNEX.A.X
const BayneXSystem = require('./BayneXSystem');
const path = require('path');
const fs = require('fs');

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║    ██████╗  █████╗ ██╗   ██╗███╗   ██╗███████╗██╗  ██╗   █████╗   ██╗  ██╗    ║
║    ██╔══██╗██╔══██╗╚██╗ ██╔╝████╗  ██║██╔════╝╚██╗██╔╝  ██╔══██╗  ╚██╗██╔╝    ║
║    ██████╔╝███████║ ╚████╔╝ ██╔██╗ ██║█████╗   ╚███╔╝   ███████║   ╚███╔╝     ║
║    ██╔══██╗██╔══██║  ╚██╔╝  ██║╚██╗██║██╔══╝   ██╔██╗   ██╔══██║   ██╔██╗     ║
║    ██████╔╝██║  ██║   ██║   ██║ ╚████║███████╗██╔╝ ██╗██║  ██║██╗██╔╝ ██╗    ║
║    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝    ║
║                                                                               ║
║              Binary Autonomous Yield Navigation & Execution X-System         ║
║                            Advanced AI Trading Platform                       ║
║                                   Version 1.0.0                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

// Configuration defaults for different environments
const getEnvironmentConfig = () => {
    const env = process.env.NODE_ENV || 'development';
    
    const baseConfig = {
        configPath: path.join(__dirname, 'data', 'config.json')
    };
    
    const envConfigs = {
        development: {
            ...baseConfig,
            config: {
                system: {
                    environment: 'development',
                    logLevel: 'debug'
                },
                web: {
                    port: process.env.PORT || 3000,
                    wsPort: process.env.WS_PORT || 8080
                },
                trading: {
                    enabled: false,
                    mode: 'demo'
                }
            }
        },
        
        production: {
            ...baseConfig,
            config: {
                system: {
                    environment: 'production',
                    logLevel: process.env.LOG_LEVEL || 'info'
                },
                web: {
                    port: process.env.PORT || 3000,
                    wsPort: process.env.WS_PORT || 8080,
                    jwtSecret: process.env.JWT_SECRET || 'baynex-production-secret'
                },
                trading: {
                    enabled: process.env.TRADING_ENABLED === 'true',
                    mode: process.env.TRADING_MODE || 'demo'
                },
                platforms: {
                    deriv: {
                        enabled: process.env.DERIV_ENABLED === 'true',
                        apiToken: process.env.DERIV_API_TOKEN,
                        appId: process.env.DERIV_APP_ID,
                        demo: process.env.DERIV_DEMO !== 'false'
                    },
                    mt5: {
                        enabled: process.env.MT5_ENABLED === 'true',
                        server: process.env.MT5_SERVER,
                        login: process.env.MT5_LOGIN,
                        password: process.env.MT5_PASSWORD,
                        demo: process.env.MT5_DEMO !== 'false'
                    },
                    iq: {
                        enabled: process.env.IQ_ENABLED === 'true',
                        email: process.env.IQ_EMAIL,
                        password: process.env.IQ_PASSWORD,
                        demo: process.env.IQ_DEMO !== 'false'
                    }
                },
                notifications: {
                    telegram: {
                        enabled: process.env.TELEGRAM_ENABLED === 'true',
                        botToken: process.env.TELEGRAM_BOT_TOKEN,
                        chatId: process.env.TELEGRAM_CHAT_ID
                    },
                    whatsapp: {
                        enabled: process.env.WHATSAPP_ENABLED === 'true',
                        apiKey: process.env.WHATSAPP_API_KEY,
                        phoneNumber: process.env.WHATSAPP_PHONE
                    }
                },
                firebase: {
                    enabled: process.env.FIREBASE_ENABLED === 'true',
                    apiKey: process.env.FIREBASE_API_KEY,
                    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
                    appId: process.env.FIREBASE_APP_ID
                }
            }
        },
        
        test: {
            ...baseConfig,
            config: {
                system: {
                    environment: 'test',
                    logLevel: 'error'
                },
                web: {
                    port: 3001,
                    wsPort: 8081
                },
                trading: {
                    enabled: false,
                    mode: 'demo'
                }
            }
        }
    };
    
    return envConfigs[env] || envConfigs.development;
};

// Startup validation
const validateEnvironment = () => {
    const requiredDirs = [
        path.join(__dirname, 'data'),
        path.join(__dirname, 'logs'),
        path.join(__dirname, 'backups')
    ];
    
    // Create required directories
    requiredDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion < 16) {
        console.error(`❌ Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
        process.exit(1);
    }
    
    console.log(`✅ Node.js version: ${nodeVersion}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Platform: ${process.platform} (${process.arch})`);
};

// Health check endpoint for deployment platforms
const createHealthCheckServer = (port) => {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'BAYNEX.A.X',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            }));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
    
    server.listen(port, () => {
        console.log(`🏥 Health check server running on port ${port}`);
    });
    
    return server;
};

// Main startup function
async function startBayneXSystem() {
    try {
        console.log(banner);
        console.log('🚀 Starting BAYNEX.A.X System...\n');
        
        // Validate environment
        validateEnvironment();
        
        // Get configuration for current environment
        const config = getEnvironmentConfig();
        
        console.log('📋 System Configuration:');
        console.log(`   Environment: ${config.config.system.environment}`);
        console.log(`   Log Level: ${config.config.system.logLevel}`);
        console.log(`   Web Port: ${config.config.web.port}`);
        console.log(`   WebSocket Port: ${config.config.web.wsPort}`);
        console.log(`   Trading Enabled: ${config.config.trading.enabled}`);
        console.log(`   Trading Mode: ${config.config.trading.mode}\n`);
        
        // Create health check server (useful for deployment platforms)
        if (process.env.HEALTH_CHECK_PORT) {
            createHealthCheckServer(process.env.HEALTH_CHECK_PORT);
        }
        
        // Initialize BAYNEX.A.X system
        console.log('🔧 Initializing BAYNEX.A.X System...\n');
        
        const bayneXSystem = new BayneXSystem(config);
        
        // Wait for system to be ready
        await new Promise((resolve, reject) => {
            bayneXSystem.once('system_ready', resolve);
            bayneXSystem.once('error', reject);
            
            // Timeout after 2 minutes
            setTimeout(() => {
                reject(new Error('System initialization timeout'));
            }, 120000);
        });
        
        console.log('\n✅ BAYNEX.A.X System is fully operational!');
        console.log('\n📊 System Status:');
        const status = bayneXSystem.getSystemStatus();
        console.log(`   State: ${status.state}`);
        console.log(`   Components: ${Object.keys(status.components).length} loaded`);
        console.log(`   Uptime: ${Math.round(status.uptime / 1000)}s`);
        
        // Log access URLs
        const webPort = config.config.web.port;
        console.log('\n🌐 Access URLs:');
        console.log(`   Dashboard: http://localhost:${webPort}/dashboard`);
        console.log(`   Health Check: http://localhost:${webPort}/health`);
        console.log(`   API: http://localhost:${webPort}/api`);
        
        // Set up graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
            await bayneXSystem.initiateShutdown(signal);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        });
        
        // Success message
        console.log('\n🎯 BAYNEX.A.X is now ready for autonomous trading operations!');
        console.log('   Type Ctrl+C to stop the system gracefully.\n');
        
        return bayneXSystem;
        
    } catch (error) {
        console.error('\n💥 Failed to start BAYNEX.A.X:', error.message);
        
        if (error.stack) {
            console.error('\n📋 Stack trace:');
            console.error(error.stack);
        }
        
        console.log('\n🔧 Troubleshooting tips:');
        console.log('   1. Check all required environment variables are set');
        console.log('   2. Ensure all dependencies are installed (npm install)');
        console.log('   3. Verify file permissions for data and logs directories');
        console.log('   4. Check Node.js version is 16 or higher');
        console.log('   5. Review the error message above for specific issues');
        
        process.exit(1);
    }
}

// Export for testing
module.exports = {
    startBayneXSystem,
    getEnvironmentConfig,
    validateEnvironment
};

// Start system if this file is run directly
if (require.main === module) {
    startBayneXSystem().catch(error => {
        console.error('Startup error:', error);
        process.exit(1);
    });
}
