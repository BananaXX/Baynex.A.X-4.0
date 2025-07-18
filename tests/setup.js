// tests/setup.js - Test Environment Setup for BAYNEX.A.X

const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = 3001;
process.env.WS_PORT = 8081;
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.TRADING_ENABLED = 'false';
process.env.TRADING_MODE = 'demo';

// Mock console for cleaner test output
const originalConsole = { ...console };

// Setup test directories
const testDataDir = path.join(__dirname, '../data/test');
const testLogsDir = path.join(__dirname, '../logs/test');

// Create test directories if they don't exist
if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
}

if (!fs.existsSync(testLogsDir)) {
    fs.mkdirSync(testLogsDir, { recursive: true });
}

// Mock configuration for tests
const testConfig = {
    system: {
        name: 'BAYNEX.A.X Test',
        version: '1.0.0',
        environment: 'test',
        logLevel: 'error'
    },
    trading: {
        enabled: false,
        mode: 'demo',
        maxDailyTrades: 10,
        maxSimultaneousTrades: 2,
        defaultTradeAmount: 1.0
    },
    risk: {
        enabled: true,
        maxDailyLoss: 5.0,
        maxDrawdown: 5.0,
        stopLossPercentage: 1.0,
        takeProfitPercentage: 2.0
    },
    ai: {
        enabled: false,
        learningRate: 0.1,
        minDataPoints: 10
    },
    platforms: {
        deriv: { enabled: false, demo: true },
        mt5: { enabled: false, demo: true },
        iq: { enabled: false, demo: true }
    },
    notifications: {
        enabled: false,
        telegram: { enabled: false },
        whatsapp: { enabled: false },
        voice: { enabled: false }
    },
    web: {
        enabled: false,
        port: 3001,
        wsPort: 8081
    }
};

// Write test configuration
const testConfigPath = path.join(testDataDir, 'config.json');
fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

// Global test utilities
global.testUtils = {
    // Test data generator
    generateTradeData: () => ({
        id: 'test_trade_' + Date.now(),
        platform: 'deriv',
        symbol: 'R_10',
        direction: 'call',
        amount: 1.0,
        entryPrice: 100.0,
        exitPrice: 101.0,
        result: 'win',
        pnl: 0.95,
        timestamp: Date.now(),
        strategy: 'test_strategy'
    }),
    
    // Mock WebSocket
    createMockWebSocket: () => ({
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        readyState: 1
    }),
    
    // Mock HTTP response
    createMockResponse: () => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis()
    }),
    
    // Mock HTTP request
    createMockRequest: (overrides = {}) => ({
        body: {},
        params: {},
        query: {},
        headers: {},
        user: { id: 'test_user', email: 'test@example.com', role: 'ADMIN' },
        ...overrides
    }),
    
    // Wait utility for async tests
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Clean test data
    cleanTestData: () => {
        const files = ['trades.json', 'goals.json', 'strategies.json', 'performance.json'];
        files.forEach(file => {
            const filePath = path.join(testDataDir, file);
            if (fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
            }
        });
    },
    
    // Mock logger
    createMockLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        logTrade: jest.fn(),
        logBalance: jest.fn(),
        logStrategy: jest.fn(),
        logRisk: jest.fn(),
        logGoal: jest.fn(),
        logPerformance: jest.fn()
    })
};

// Global mocks
global.fetch = jest.fn();

// Mock WebSocket globally
global.WebSocket = jest.fn().mockImplementation(() => global.testUtils.createMockWebSocket());

// Mock Firebase
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    auth: () => ({
        verifyIdToken: jest.fn().mockResolvedValue({
            uid: 'test_uid',
            email: 'test@example.com'
        })
    })
}));

// Mock trading platform APIs
jest.mock('deriv-api', () => jest.fn());
jest.mock('mt5-connector', () => jest.fn());
jest.mock('iq-option-api', () => jest.fn());

// Mock notification services
jest.mock('node-telegram-bot-api', () => jest.fn());
jest.mock('twilio', () => () => ({
    messages: {
        create: jest.fn().mockResolvedValue({ sid: 'test_sid' })
    }
}));

// Setup and teardown
beforeAll(() => {
    // Suppress console output during tests unless debugging
    if (!process.env.DEBUG_TESTS) {
        console.log = jest.fn();
        console.info = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
    }
});

afterAll(() => {
    // Restore console
    Object.assign(console, originalConsole);
    
    // Clean up test files
    global.testUtils.cleanTestData();
});

beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset fetch mock
    global.fetch.mockClear();
    
    // Clean test data before each test
    global.testUtils.cleanTestData();
});

afterEach(() => {
    // Additional cleanup after each test if needed
});

// Custom Jest matchers
expect.extend({
    toBeValidTradeData(received) {
        const required = ['id', 'platform', 'symbol', 'direction', 'amount', 'result', 'timestamp'];
        const missing = required.filter(field => !(field in received));
        
        if (missing.length > 0) {
            return {
                message: () => `Expected valid trade data, missing fields: ${missing.join(', ')}`,
                pass: false
            };
        }
        
        return {
            message: () => 'Expected valid trade data',
            pass: true
        };
    },
    
    toBeValidGoalData(received) {
        const required = ['id', 'title', 'type', 'targetValue', 'currentValue', 'progress'];
        const missing = required.filter(field => !(field in received));
        
        if (missing.length > 0) {
            return {
                message: () => `Expected valid goal data, missing fields: ${missing.join(', ')}`,
                pass: false
            };
        }
        
        return {
            message: () => 'Expected valid goal data',
            pass: true
        };
    },
    
    toHaveValidCurrency(received) {
        const currencyRegex = /^\$\d+\.\d{2}$/;
        const pass = currencyRegex.test(received);
        
        return {
            message: () => `Expected ${received} to be a valid currency format ($0.00)`,
            pass
        };
    }
});

// Test configuration constants
global.TEST_CONFIG = {
    TIMEOUT: 5000,
    PORTS: {
        HTTP: 3001,
        WS: 8081
    },
    PATHS: {
        DATA: testDataDir,
        LOGS: testLogsDir,
        CONFIG: testConfigPath
    },
    MOCK_DATA: {
        USER: {
            id: 'test_user_123',
            email: 'test@baynex-ax.com',
            role: 'ADMIN',
            uid: 'firebase_test_uid'
        },
        TRADE: {
            id: 'test_trade_123',
            platform: 'deriv',
            symbol: 'R_10',
            direction: 'call',
            amount: 1.0,
            result: 'win',
            pnl: 0.95
        },
        GOAL: {
            id: 'test_goal_123',
            title: 'Test Daily Profit',
            type: 'daily_profit',
            targetValue: 10.0,
            currentValue: 5.0,
            progress: 50
        }
    }
};

// Export for use in other test files
module.exports = {
    testUtils: global.testUtils,
    TEST_CONFIG: global.TEST_CONFIG
};
