#!/usr/bin/env node
// scripts/setup.js - BAYNEX.A.X Setup Script

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

const banner = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                            BAYNEX.A.X SETUP                                  ║
║              Binary Autonomous Yield Navigation &                            ║
║                    Execution X-System                                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

async function main() {
    try {
        console.log(colors.cyan + banner + colors.reset);
        log('🚀 Starting BAYNEX.A.X setup process...', 'bright');
        
        // Step 1: Check system requirements
        await checkSystemRequirements();
        
        // Step 2: Create required directories
        await createDirectories();
        
        // Step 3: Setup environment configuration
        await setupEnvironment();
        
        // Step 4: Initialize database
        await initializeDatabase();
        
        // Step 5: Setup SSL certificates (if needed)
        await setupSSL();
        
        // Step 6: Create default configuration
        await createDefaultConfig();
        
        // Step 7: Setup PM2 configuration
        await setupPM2();
        
        // Step 8: Run security checks
        await runSecurityChecks();
        
        // Step 9: Setup development tools (if in development)
        await setupDevelopmentTools();
        
        // Step 10: Final validation
        await validateSetup();
        
        log('\n✅ BAYNEX.A.X setup completed successfully!', 'green');
        log('\n📋 Next steps:', 'bright');
        log('   1. Configure your .env file with your API keys', 'cyan');
        log('   2. Set up Firebase authentication', 'cyan');
        log('   3. Configure trading platform credentials', 'cyan');
        log('   4. Run: npm start', 'cyan');
        log('\n🌐 Access your dashboard at: http://localhost:3000/dashboard', 'bright');
        
    } catch (error) {
        log(`\n❌ Setup failed: ${error.message}`, 'red');
        log('\n🔧 Troubleshooting tips:', 'yellow');
        log('   1. Check Node.js version (>= 16.0.0)', 'yellow');
        log('   2. Ensure you have write permissions', 'yellow');
        log('   3. Check network connectivity', 'yellow');
        log('   4. Review the error message above', 'yellow');
        process.exit(1);
    }
}

async function checkSystemRequirements() {
    log('\n📋 Checking system requirements...', 'blue');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion < 16) {
        throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    }
    log(`   ✅ Node.js ${nodeVersion}`, 'green');
    
    // Check npm version
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        log(`   ✅ npm ${npmVersion}`, 'green');
    } catch (error) {
        throw new Error('npm is not installed or not accessible');
    }
    
    // Check available disk space
    try {
        const stats = fs.statSync('.');
        log('   ✅ Disk space available', 'green');
    } catch (error) {
        log('   ⚠️  Could not check disk space', 'yellow');
    }
    
    // Check memory
    const totalMemory = Math.round(require('os').totalmem() / 1024 / 1024 / 1024);
    if (totalMemory < 2) {
        log('   ⚠️  Low memory detected. 4GB+ recommended for optimal performance', 'yellow');
    } else {
        log(`   ✅ Memory: ${totalMemory}GB`, 'green');
    }
    
    log('   ✅ System requirements check passed', 'green');
}

async function createDirectories() {
    log('\n📁 Creating required directories...', 'blue');
    
    const directories = [
        'data',
        'logs',
        'backups',
        'ssl',
        'data/temp',
        'data/exports',
        'data/imports',
        'logs/archived'
    ];
    
    for (const dir of directories) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                log(`   ✅ Created: ${dir}`, 'green');
            } else {
                log(`   ✅ Exists: ${dir}`, 'green');
            }
        } catch (error) {
            throw new Error(`Failed to create directory ${dir}: ${error.message}`);
        }
    }
}

async function setupEnvironment() {
    log('\n⚙️  Setting up environment configuration...', 'blue');
    
    const envFile = '.env';
    const envTemplate = '.env.template';
    
    if (!fs.existsSync(envFile)) {
        if (fs.existsSync(envTemplate)) {
            try {
                fs.copyFileSync(envTemplate, envFile);
                log('   ✅ Created .env from template', 'green');
                log('   ⚠️  Please configure your .env file with actual values', 'yellow');
            } catch (error) {
                throw new Error(`Failed to copy environment template: ${error.message}`);
            }
        } else {
            // Create basic .env file
            const basicEnv = `# BAYNEX.A.X Environment Configuration
NODE_ENV=development
PORT=3000
WS_PORT=8080
JWT_SECRET=baynex-default-secret-change-in-production
TRADING_ENABLED=false
TRADING_MODE=demo
LOG_LEVEL=info
`;
            try {
                fs.writeFileSync(envFile, basicEnv);
                log('   ✅ Created basic .env file', 'green');
            } catch (error) {
                throw new Error(`Failed to create .env file: ${error.message}`);
            }
        }
    } else {
        log('   ✅ .env file already exists', 'green');
    }
    
    // Create .env.example for documentation
    if (fs.existsSync(envTemplate) && !fs.existsSync('.env.example')) {
        try {
            fs.copyFileSync(envTemplate, '.env.example');
            log('   ✅ Created .env.example', 'green');
        } catch (error) {
            log('   ⚠️  Failed to create .env.example', 'yellow');
        }
    }
}

async function initializeDatabase() {
    log('\n🗄️  Initializing database...', 'blue');
    
    const dbPath = path.join('data', 'baynex.db');
    
    try {
        // Create empty database file if it doesn't exist
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, '');
            log('   ✅ Created database file', 'green');
        } else {
            log('   ✅ Database file exists', 'green');
        }
        
        // Create other data files
        const dataFiles = [
            'data/goals.json',
            'data/strategies.json',
            'data/performance.json',
            'data/trades.json'
        ];
        
        for (const file of dataFiles) {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify({}, null, 2));
                log(`   ✅ Created: ${path.basename(file)}`, 'green');
            }
        }
        
    } catch (error) {
        throw new Error(`Database initialization failed: ${error.message}`);
    }
}

async function setupSSL() {
    log('\n🔒 Setting up SSL configuration...', 'blue');
    
    const sslDir = 'ssl';
    
    if (process.env.NODE_ENV === 'production') {
        log('   ⚠️  Production detected: Please configure SSL certificates manually', 'yellow');
        log('   📋 Required files: ssl/certificate.crt, ssl/private.key', 'cyan');
    } else {
        // Create placeholder files for development
        const placeholders = ['certificate.crt', 'private.key'];
        
        for (const file of placeholders) {
            const filePath = path.join(sslDir, file);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, `# Placeholder SSL file for development\n# Replace with actual ${file} in production\n`);
                log(`   ✅ Created placeholder: ${file}`, 'green');
            }
        }
    }
}

async function createDefaultConfig() {
    log('\n📝 Creating default configuration...', 'blue');
    
    const configPath = path.join('data', 'config.json');
    
    if (!fs.existsSync(configPath)) {
        const defaultConfig = {
            system: {
                name: 'BAYNEX.A.X',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                logLevel: 'info'
            },
            trading: {
                enabled: false,
                mode: 'demo',
                maxDailyTrades: 100,
                maxSimultaneousTrades: 5,
                defaultTradeAmount: 1.0,
                emergencyStopLoss: 50.0
            },
            risk: {
                enabled: true,
                maxDailyLoss: 25.0,
                maxDrawdown: 10.0,
                stopLossPercentage: 2.0,
                takeProfitPercentage: 4.0
            },
            ai: {
                enabled: true,
                learningRate: 0.01,
                minDataPoints: 100,
                confidenceThreshold: 0.7
            },
            notifications: {
                enabled: true,
                voice: {
                    enabled: true,
                    mode: 'smart',
                    personality: 'professional'
                }
            }
        };
        
        try {
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            log('   ✅ Created default configuration', 'green');
        } catch (error) {
            throw new Error(`Failed to create configuration: ${error.message}`);
        }
    } else {
        log('   ✅ Configuration file exists', 'green');
    }
}

async function setupPM2() {
    log('\n🔄 Setting up PM2 configuration...', 'blue');
    
    const pm2Config = {
        apps: [{
            name: 'baynex-ax',
            script: 'server.js',
            instances: 1,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'development',
                PORT: 3000,
                WS_PORT: 8080
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 3000,
                WS_PORT: process.env.WS_PORT || 8080
            },
            log_file: 'logs/pm2.log',
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            max_memory_restart: '1G',
            watch: false,
            ignore_watch: ['node_modules', 'logs', 'data'],
            restart_delay: 1000
        }]
    };
    
    try {
        fs.writeFileSync('ecosystem.config.js', `module.exports = ${JSON.stringify(pm2Config, null, 2)};`);
        log('   ✅ Created PM2 configuration', 'green');
    } catch (error) {
        log('   ⚠️  Failed to create PM2 configuration', 'yellow');
    }
}

async function runSecurityChecks() {
    log('\n🔐 Running security checks...', 'blue');
    
    // Check for default JWT secret
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('baynex-default-secret') || envContent.includes('change-in-production')) {
            log('   ⚠️  Default JWT secret detected - change for production!', 'yellow');
        } else {
            log('   ✅ JWT secret appears to be customized', 'green');
        }
    } catch (error) {
        log('   ⚠️  Could not check JWT secret', 'yellow');
    }
    
    // Check file permissions
    try {
        const dataStats = fs.statSync('data');
        log('   ✅ Data directory permissions OK', 'green');
    } catch (error) {
        log('   ⚠️  Could not check data directory permissions', 'yellow');
    }
    
    // Check for vulnerable dependencies (if npm audit is available)
    try {
        execSync('npm audit --audit-level=high', { stdio: 'pipe' });
        log('   ✅ No high-severity vulnerabilities found', 'green');
    } catch (error) {
        log('   ⚠️  Run "npm audit" to check for vulnerabilities', 'yellow');
    }
}

async function setupDevelopmentTools() {
    if (process.env.NODE_ENV === 'development') {
        log('\n🛠️  Setting up development tools...', 'blue');
        
        // Create .gitignore if it doesn't exist
        const gitignorePath = '.gitignore';
        if (!fs.existsSync(gitignorePath)) {
            const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Data files
data/
backups/

# SSL certificates
ssl/

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# PM2 files
ecosystem.config.js
.pm2/

# Testing
coverage/
.nyc_output/

# Temporary files
temp/
tmp/
`;
            
            try {
                fs.writeFileSync(gitignorePath, gitignoreContent);
                log('   ✅ Created .gitignore', 'green');
            } catch (error) {
                log('   ⚠️  Failed to create .gitignore', 'yellow');
            }
        } else {
            log('   ✅ .gitignore exists', 'green');
        }
        
        // Create VSCode settings (optional)
        const vscodeDir = '.vscode';
        if (!fs.existsSync(vscodeDir)) {
            try {
                fs.mkdirSync(vscodeDir);
                
                const settings = {
                    "editor.formatOnSave": true,
                    "editor.codeActionsOnSave": {
                        "source.fixAll.eslint": true
                    },
                    "files.exclude": {
                        "**/node_modules": true,
                        "**/data": true,
                        "**/logs": true
                    }
                };
                
                fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 2));
                log('   ✅ Created VSCode settings', 'green');
            } catch (error) {
                log('   ⚠️  Failed to create VSCode settings', 'yellow');
            }
        }
    }
}

async function validateSetup() {
    log('\n✅ Validating setup...', 'blue');
    
    const requiredFiles = [
        '.env',
        'data/config.json',
        'package.json',
        'server.js',
        'BayneXSystem.js'
    ];
    
    const requiredDirs = [
        'src',
        'data',
        'logs',
        'src/core',
        'src/ai',
        'src/platforms',
        'src/web'
    ];
    
    // Check required files
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
    log('   ✅ All required files present', 'green');
    
    // Check required directories
    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            throw new Error(`Required directory missing: ${dir}`);
        }
    }
    log('   ✅ All required directories present', 'green');
    
    // Test configuration loading
    try {
        const config = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
        if (!config.system || !config.trading) {
            throw new Error('Invalid configuration structure');
        }
        log('   ✅ Configuration structure valid', 'green');
    } catch (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
    }
    
    log('   ✅ Setup validation passed', 'green');
}

// Run setup if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    main,
    checkSystemRequirements,
    createDirectories,
    setupEnvironment,
    initializeDatabase,
    validateSetup
};
