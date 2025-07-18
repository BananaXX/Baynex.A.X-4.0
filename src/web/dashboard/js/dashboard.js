// src/web/dashboard/js/dashboard.js

class BayneXDashboard {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.currentUser = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000;
        
        // Dashboard state
        this.dashboardData = {
            balance: 0,
            dailyPnL: 0,
            winRate: 0,
            activeStrategies: 0,
            platforms: {},
            trades: [],
            performance: {}
        };
        
        // Initialize dashboard
        this.init();
    }
    
    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Wait for auth state
            await this.waitForAuth();
            
            // Initialize components
            await this.initializeComponents();
            
            this.log('Dashboard initialized successfully');
        } catch (error) {
            this.log(`Dashboard initialization error: ${error.message}`, 'error');
            this.showError('Failed to initialize dashboard');
        }
    }
    
    async waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (window.bayneXAuth && window.bayneXAuth.getCurrentUser()) {
                    this.currentUser = window.bayneXAuth.getUserInfo();
                    resolve();
                } else {
                    // Show login modal
                    this.showLogin();
                    
                    // Listen for auth state changes
                    window.addEventListener('authStateChanged', (event) => {
                        if (event.detail.signedIn) {
                            this.currentUser = window.bayneXAuth.getUserInfo();
                            this.hideLogin();
                            resolve();
                        }
                    });
                }
            };
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkAuth);
            } else {
                checkAuth();
            }
        });
    }
    
    async initializeComponents() {
        // Update user info in header
        this.updateUserInfo();
        
        // Initialize charts
        this.initializeCharts();
        
        // Connect to WebSocket
        await this.connectWebSocket();
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup voice assistant
        this.setupVoiceAssistant();
        
        // Hide loading and show dashboard
        this.hideLoading();
        this.showDashboard();
        
        // Load initial data
        this.loadInitialData();
    }
    
    setupEventListeners() {
        // Login form
        const loginBtn = document.getElementById('login-btn');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.handleLogin());
        }
        
        if (emailInput && passwordInput) {
            [emailInput, passwordInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.handleLogin();
                });
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Emergency stop
        const emergencyStop = document.getElementById('emergency-stop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', () => this.handleEmergencyStop());
        }
        
        // Voice controls
        const voiceToggle = document.getElementById('voice-toggle');
        const voiceMode = document.getElementById('voice-mode');
        
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => this.toggleVoicePanel());
        }
        
        if (voiceMode) {
            voiceMode.addEventListener('change', (e) => this.changeVoiceMode(e.target.value));
        }
        
        // Voice panel
        const closeVoice = document.getElementById('close-voice');
        const sendVoiceMessage = document.getElementById('send-voice-message');
        const voiceTextInput = document.getElementById('voice-text-input');
        
        if (closeVoice) {
            closeVoice.addEventListener('click', () => this.hideVoicePanel());
        }
        
        if (sendVoiceMessage) {
            sendVoiceMessage.addEventListener('click', () => this.sendVoiceMessage());
        }
        
        if (voiceTextInput) {
            voiceTextInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendVoiceMessage();
            });
        }
        
        // Quick action buttons
        this.setupQuickActions();
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('online', () => this.handleConnectionRestore());
        window.addEventListener('offline', () => this.handleConnectionLoss());
    }
    
    setupQuickActions() {
        const actions = {
            'start-trading': () => this.sendUserAction('start_trading'),
            'pause-trading': () => this.sendUserAction('pause_trading'),
            'force-learning': () => this.sendUserAction('force_learning'),
            'reset-session': () => this.sendUserAction('reset_session')
        };
        
        Object.entries(actions).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });
    }
    
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.navigateToSection(section);
            });
        });
    }
    
    navigateToSection(sectionName) {
        // Remove active class from all nav items and sections
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Add active class to selected nav item and section
        const navItem = document.querySelector(`[data-section="${sectionName}"]`);
        const section = document.getElementById(`section-${sectionName}`);
        
        if (navItem) navItem.classList.add('active');
        if (section) section.classList.add('active');
        
        // Load section-specific data
        this.loadSectionData(sectionName);
    }
    
    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.updateOverviewData();
                break;
            case 'trading':
                this.updateTradingData();
                break;
            case 'strategies':
                this.loadStrategiesData();
                break;
            case 'platforms':
                this.loadPlatformsData();
                break;
            case 'performance':
                this.loadPerformanceData();
                break;
            // Add other sections as needed
        }
    }
    
    async connectWebSocket() {
        try {
            const token = await window.bayneXAuth.getUserToken();
            if (!token) {
                throw new Error('No authentication token available');
            }
            
            const wsUrl = this.getWebSocketUrl(token);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => this.handleWebSocketOpen();
            this.ws.onmessage = (event) => this.handleWebSocketMessage(event);
            this.ws.onclose = () => this.handleWebSocketClose();
            this.ws.onerror = (error) => this.handleWebSocketError(error);
            
        } catch (error) {
            this.log(`WebSocket connection error: ${error.message}`, 'error');
            this.scheduleReconnect();
        }
    }
    
    getWebSocketUrl(token) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}?token=${token}`;
    }
    
    handleWebSocketOpen() {
        this.isConnected = true;
        this.retryCount = 0;
        this.updateConnectionStatus(true);
        this.log('WebSocket connected successfully');
        
        // Subscribe to channels based on user role
        this.subscribeToChannels();
    }
    
    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.processWebSocketMessage(message);
        } catch (error) {
            this.log(`WebSocket message error: ${error.message}`, 'error');
        }
    }
    
    processWebSocketMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'connection_established':
                this.log('WebSocket connection established');
                break;
                
            case 'trade_update':
                this.handleTradeUpdate(data);
                break;
                
            case 'balance_update':
                this.handleBalanceUpdate(data);
                break;
                
            case 'strategy_update':
                this.handleStrategyUpdate(data);
                break;
                
            case 'voice_message':
                this.handleVoiceMessage(data);
                break;
                
            case 'risk_alert':
                this.handleRiskAlert(data);
                break;
                
            case 'goal_update':
                this.handleGoalUpdate(data);
                break;
                
            case 'system_status':
                this.handleSystemStatus(data);
                break;
                
            case 'performance_data':
                this.handlePerformanceUpdate(data);
                break;
                
            case 'error':
                this.handleServerError(data);
                break;
                
            default:
                this.log(`Unknown message type: ${type}`, 'warn');
        }
    }
    
    handleWebSocketClose() {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.log('WebSocket connection closed');
        this.scheduleReconnect();
    }
    
    handleWebSocketError(error) {
        this.log(`WebSocket error: ${error}`, 'error');
    }
    
    scheduleReconnect() {
        if (this.retryCount < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, this.retryCount);
            this.retryCount++;
            
            setTimeout(() => {
                this.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries})...`);
                this.connectWebSocket();
            }, delay);
        } else {
            this.log('Max reconnection attempts reached', 'error');
            this.showError('Connection lost. Please refresh the page.');
        }
    }
    
    subscribeToChannels() {
        const channels = ['trade_update', 'balance_update', 'strategy_update', 'performance_data'];
        
        // Add role-specific channels
        if (this.currentUser.role === 'ADMIN') {
            channels.push('system_status', 'risk_alert');
        }
        
        this.sendWebSocketMessage({
            type: 'subscribe',
            data: { channels }
        });
    }
    
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }
    
    sendUserAction(action, params = {}) {
        return this.sendWebSocketMessage({
            type: 'user_action',
            data: { action, params }
        });
    }
    
    // Data update handlers
    handleTradeUpdate(data) {
        // Add trade to the list
        this.dashboardData.trades.unshift(data);
        
        // Keep only last 100 trades
        if (this.dashboardData.trades.length > 100) {
            this.dashboardData.trades = this.dashboardData.trades.slice(0, 100);
        }
        
        // Update trades table
        this.updateTradesTable();
        
        // Update metrics
        this.updateTradingMetrics();
        
        // Show notification
        this.showNotification('Trade Update', `${data.direction} ${data.symbol} - ${data.result}`, 'info');
    }
    
    handleBalanceUpdate(data) {
        this.dashboardData.balance = data.totalBalance;
        this.dashboardData.dailyPnL = data.dailyPnL;
        
        // Update platform balances
        if (data.platforms) {
            this.dashboardData.platforms = { ...this.dashboardData.platforms, ...data.platforms };
        }
        
        // Update UI
        this.updateBalanceDisplay();
        this.updatePlatformStatus();
        this.updateBalanceChart();
    }
    
    handleStrategyUpdate(data) {
        this.dashboardData.activeStrategies = data.activeCount;
        
        // Update strategy display
        this.updateStrategyDisplay();
        
        if (data.change) {
            this.showNotification('Strategy Update', data.change, 'info');
        }
    }
    
    handleVoiceMessage(data) {
        this.addVoiceMessage(data.message, 'assistant');
        
        // Auto-open voice panel for urgent messages
        if (data.priority === 'urgent') {
            this.showVoicePanel();
        }
    }
    
    handleRiskAlert(data) {
        this.showNotification('Risk Alert', data.message, 'warning');
        
        // Update risk indicators
        this.updateRiskIndicators(data);
    }
    
    handleGoalUpdate(data) {
        // Update goal progress
        this.updateGoalProgress(data);
        
        if (data.achieved) {
            this.showNotification('Goal Achieved!', `${data.goalType}: ${data.value}`, 'success');
        }
    }
    
    handleSystemStatus(data) {
        this.updateSystemStatus(data);
    }
    
    handlePerformanceUpdate(data) {
        this.dashboardData.performance = { ...this.dashboardData.performance, ...data };
        this.updatePerformanceCharts();
    }
    
    handleServerError(data) {
        this.showError(data.message || 'Server error occurred');
    }
    
    // UI Update Methods
    updateUserInfo() {
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role');
        
        if (userNameEl && this.currentUser) {
            userNameEl.textContent = this.currentUser.displayName;
        }
        
        if (userRoleEl && this.currentUser) {
            userRoleEl.textContent = this.currentUser.role;
        }
    }
    
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('system-status');
        const indicator = statusEl?.querySelector('.status-indicator');
        const text = statusEl?.querySelector('span');
        
        if (indicator && text) {
            if (connected) {
                indicator.className = 'status-indicator active';
                text.textContent = 'SYSTEM ACTIVE';
            } else {
                indicator.className = 'status-indicator inactive';
                text.textContent = 'DISCONNECTED';
            }
        }
    }
    
    updateBalanceDisplay() {
        const balanceEl = document.getElementById('total-balance');
        const pnlEl = document.getElementById('daily-pnl');
        
        if (balanceEl) {
            balanceEl.textContent = this.formatCurrency(this.dashboardData.balance);
        }
        
        if (pnlEl) {
            pnlEl.textContent = this.formatCurrency(this.dashboardData.dailyPnL);
            pnlEl.className = this.dashboardData.dailyPnL >= 0 ? 'metric-value text-success' : 'metric-value text-danger';
        }
    }
    
    updateTradingMetrics() {
        const trades = this.dashboardData.trades;
        const todayTrades = trades.filter(trade => this.isToday(new Date(trade.timestamp)));
        
        const wins = todayTrades.filter(trade => trade.result === 'win').length;
        const losses = todayTrades.filter(trade => trade.result === 'loss').length;
        const total = wins + losses;
        
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        
        const winRateEl = document.getElementById('win-rate');
        const winRateTradesEl = document.getElementById('winrate-trades');
        
        if (winRateEl) {
            winRateEl.textContent = `${winRate}%`;
        }
        
        if (winRateTradesEl) {
            winRateTradesEl.textContent = `${wins}/${total} trades`;
        }
        
        this.dashboardData.winRate = winRate;
    }
    
    updateTradesTable() {
        const tbody = document.getElementById('trades-tbody');
        if (!tbody) return;
        
        // Clear existing rows
        tbody.innerHTML = '';
        
        // Add recent trades (last 20)
        const recentTrades = this.dashboardData.trades.slice(0, 20);
        
        recentTrades.forEach(trade => {
            const row = this.createTradeRow(trade);
            tbody.appendChild(row);
        });
    }
    
    createTradeRow(trade) {
        const row = document.createElement('tr');
        
        const resultClass = trade.result === 'win' ? 'text-success' : 
                           trade.result === 'loss' ? 'text-danger' : '';
        
        row.innerHTML = `
            <td>${this.formatTime(new Date(trade.timestamp))}</td>
            <td>${trade.platform}</td>
            <td>${trade.symbol}</td>
            <td>${trade.direction.toUpperCase()}</td>
            <td>${this.formatCurrency(trade.amount)}</td>
            <td class="${resultClass}">${trade.result.toUpperCase()}</td>
            <td class="${resultClass}">${this.formatCurrency(trade.pnl || 0)}</td>
        `;
        
        return row;
    }
    
    updatePlatformStatus() {
        Object.entries(this.dashboardData.platforms).forEach(([platform, data]) => {
            const card = document.getElementById(`${platform.toLowerCase()}-status`);
            if (!card) return;
            
            const indicator = card.querySelector('.status-indicator');
            const balanceEl = card.querySelector(`#${platform.toLowerCase()}-balance`);
            const tradesEl = card.querySelector(`#${platform.toLowerCase()}-trades`);
            const pnlEl = card.querySelector(`#${platform.toLowerCase()}-pnl`);
            
            if (indicator) {
                indicator.className = data.connected ? 'status-indicator active' : 'status-indicator inactive';
            }
            
            if (balanceEl) balanceEl.textContent = this.formatCurrency(data.balance || 0);
            if (tradesEl) tradesEl.textContent = data.trades || 0;
            if (pnlEl) {
                pnlEl.textContent = this.formatCurrency(data.pnl || 0);
                pnlEl.className = (data.pnl || 0) >= 0 ? 'text-success' : 'text-danger';
            }
        });
    }
    
    // Chart Management
    initializeCharts() {
        this.initializeBalanceChart();
        this.initializePnLChart();
    }
    
    initializeBalanceChart() {
        const ctx = document.getElementById('balance-chart');
        if (!ctx) return;
        
        this.charts.balance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Balance',
                    data: [],
                    borderColor: '#FF6B35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#FFFFFF' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#CCCCCC' },
                        grid: { color: '#333333' }
                    },
                    y: {
                        ticks: { color: '#CCCCCC' },
                        grid: { color: '#333333' }
                    }
                }
            }
        });
    }
    
    initializePnLChart() {
        const ctx = document.getElementById('pnl-chart');
        if (!ctx) return;
        
        this.charts.pnl = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'P&L',
                    data: [],
                    backgroundColor: function(context) {
                        const value = context.parsed.y;
                        return value >= 0 ? '#00FF88' : '#FF4444';
                    },
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#FFFFFF' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#CCCCCC' },
                        grid: { color: '#333333' }
                    },
                    y: {
                        ticks: { color: '#CCCCCC' },
                        grid: { color: '#333333' }
                    }
                }
            }
        });
    }
    
    updateBalanceChart() {
        if (!this.charts.balance) return;
        
        const chart = this.charts.balance;
        const now = new Date();
        
        // Add current balance point
        chart.data.labels.push(this.formatTime(now));
        chart.data.datasets[0].data.push(this.dashboardData.balance);
        
        // Keep only last 50 points
        if (chart.data.labels.length > 50) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.update('none');
    }
    
    // Voice Assistant
    setupVoiceAssistant() {
        // Voice assistant is already setup in event listeners
    }
    
    toggleVoicePanel() {
        const panel = document.getElementById('voice-panel');
        const button = document.getElementById('voice-toggle');
        
        if (panel.classList.contains('active')) {
            this.hideVoicePanel();
        } else {
            this.showVoicePanel();
        }
    }
    
    showVoicePanel() {
        const panel = document.getElementById('voice-panel');
        const button = document.getElementById('voice-toggle');
        
        panel.classList.add('active');
        button.classList.add('active');
    }
    
    hideVoicePanel() {
        const panel = document.getElementById('voice-panel');
        const button = document.getElementById('voice-toggle');
        
        panel.classList.remove('active');
        button.classList.remove('active');
    }
    
    sendVoiceMessage() {
        const input = document.getElementById('voice-text-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to panel
        this.addVoiceMessage(message, 'user');
        
        // Clear input
        input.value = '';
        
        // Send to server via WebSocket
        this.sendWebSocketMessage({
            type: 'voice_query',
            data: { message }
        });
    }
    
    addVoiceMessage(message, sender) {
        const messagesContainer = document.getElementById('voice-messages');
        if (!messagesContainer) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `voice-message ${sender}`;
        messageEl.textContent = message;
        
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    changeVoiceMode(mode) {
        this.sendUserAction('change_voice_mode', { mode });
    }
    
    // Authentication
    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        
        if (!email || !password) {
            this.showLoginError('Please enter both email and password');
            return;
        }
        
        try {
            const result = await window.bayneXAuth.signInWithEmail(email, password);
            
            if (result.success) {
                this.currentUser = window.bayneXAuth.getUserInfo();
                this.hideLogin();
                await this.initializeComponents();
            } else {
                this.showLoginError(result.error);
            }
        } catch (error) {
            this.showLoginError('Login failed. Please try again.');
        }
    }
    
    async handleLogout() {
        try {
            await window.bayneXAuth.signOut();
            this.cleanup();
            this.showLogin();
            this.hideDashboard();
        } catch (error) {
            this.showError('Logout failed');
        }
    }
    
    // Emergency controls
    handleEmergencyStop() {
        if (confirm('Are you sure you want to perform an emergency stop? This will halt all trading immediately.')) {
            this.sendUserAction('emergency_stop');
            this.showNotification('Emergency Stop', 'All trading has been halted', 'warning');
        }
    }
    
    // Utility methods
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.remove('hidden');
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }
    
    showLogin() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.classList.remove('hidden');
    }
    
    hideLogin() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.classList.add('hidden');
    }
    
    showDashboard() {
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.classList.remove('hidden');
    }
    
    hideDashboard() {
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.classList.add('hidden');
    }
    
    showLoginError(message) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    showNotification(title, message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;
        
        const titleEl = toast.querySelector('.toast-title');
        const textEl = toast.querySelector('.toast-text');
        const iconEl = toast.querySelector('.toast-icon i');
        
        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = message;
        
        // Set icon based on type
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        
        if (iconEl) iconEl.className = icons[type] || icons.info;
        
        // Show toast
        toast.classList.add('show');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
        
        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.onclick = () => toast.classList.remove('show');
        }
    }
    
    showError(message) {
        this.showNotification('Error', message, 'error');
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    loadInitialData() {
        // Request initial data from server
        this.sendWebSocketMessage({ type: 'get_status' });
        this.sendWebSocketMessage({ type: 'get_dashboard_data' });
    }
    
    cleanup() {
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        this.charts = {};
        this.isConnected = false;
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [Dashboard] [${level.toUpperCase()}] ${message}`);
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.bayneXDashboard = new BayneXDashboard();
});
