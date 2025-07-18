// src/goals/GoalTracker.js
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BayneXGoalTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            dataPath: config.dataPath || path.join(__dirname, '../data/goals.json'),
            autoSave: config.autoSave !== false,
            saveInterval: config.saveInterval || 30000, // 30 seconds
            maxGoals: config.maxGoals || 100,
            ...config
        };
        
        this.goals = new Map();
        this.completedGoals = new Map();
        this.statistics = {
            totalGoalsCreated: 0,
            totalGoalsCompleted: 0,
            totalRevenueGenerated: 0,
            averageGoalDuration: 0,
            successRate: 0
        };
        
        this.goalTypes = {
            DAILY_PROFIT: 'daily_profit',
            WEEKLY_PROFIT: 'weekly_profit',
            MONTHLY_PROFIT: 'monthly_profit',
            WIN_RATE: 'win_rate',
            TRADE_COUNT: 'trade_count',
            BALANCE_TARGET: 'balance_target',
            STRATEGY_PERFORMANCE: 'strategy_performance',
            PLATFORM_PROFIT: 'platform_profit',
            RISK_MANAGEMENT: 'risk_management',
            CUSTOM: 'custom'
        };
        
        this.isInitialized = false;
        this.saveTimer = null;
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing Goal Tracker...');
            
            // Load existing goals
            await this.loadGoals();
            
            // Setup auto-save
            if (this.config.autoSave) {
                this.setupAutoSave();
            }
            
            // Setup periodic progress checks
            this.setupProgressChecks();
            
            this.isInitialized = true;
            this.log('Goal Tracker initialized successfully');
            
            this.emit('initialized');
        } catch (error) {
            this.log(`Goal Tracker initialization error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Goal Creation and Management
    createGoal(goalData) {
        try {
            const goal = this.validateAndCreateGoal(goalData);
            
            // Check if we're at max goals limit
            if (this.goals.size >= this.config.maxGoals) {
                throw new Error(`Maximum number of goals (${this.config.maxGoals}) reached`);
            }
            
            this.goals.set(goal.id, goal);
            this.statistics.totalGoalsCreated++;
            
            this.log(`Goal created: ${goal.title} (${goal.type})`);
            
            // Emit events
            this.emit('goal_created', goal);
            this.emit('goals_updated', this.getGoalsSummary());
            
            return goal;
        } catch (error) {
            this.log(`Goal creation error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    validateAndCreateGoal(goalData) {
        const {
            title,
            type,
            targetValue,
            currentValue = 0,
            deadline,
            description = '',
            priority = 'medium',
            metadata = {}
        } = goalData;
        
        // Validation
        if (!title || title.trim().length === 0) {
            throw new Error('Goal title is required');
        }
        
        if (!type || !Object.values(this.goalTypes).includes(type)) {
            throw new Error('Valid goal type is required');
        }
        
        if (targetValue === undefined || targetValue === null || targetValue <= 0) {
            throw new Error('Target value must be positive');
        }
        
        if (deadline && new Date(deadline) <= new Date()) {
            throw new Error('Deadline must be in the future');
        }
        
        // Create goal object
        const goal = {
            id: this.generateGoalId(),
            title: title.trim(),
            type,
            targetValue: Number(targetValue),
            currentValue: Number(currentValue),
            deadline: deadline ? new Date(deadline) : null,
            description: description.trim(),
            priority,
            metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            progress: this.calculateProgress(currentValue, targetValue),
            milestones: this.generateMilestones(targetValue, type),
            notifications: {
                percentages: [25, 50, 75, 90],
                sent: []
            }
        };
        
        return goal;
    }
    
    updateGoal(goalId, updates) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        const oldProgress = goal.progress;
        
        // Update allowed fields
        const allowedUpdates = ['currentValue', 'targetValue', 'deadline', 'description', 'priority', 'metadata'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                goal[field] = updates[field];
            }
        });
        
        // Recalculate progress
        goal.progress = this.calculateProgress(goal.currentValue, goal.targetValue);
        goal.updatedAt = new Date();
        
        // Check for completion
        if (goal.progress >= 100 && goal.status === 'active') {
            this.completeGoal(goalId);
        }
        
        // Check for milestone notifications
        this.checkMilestoneNotifications(goal, oldProgress);
        
        this.log(`Goal updated: ${goal.title} (${goal.progress}%)`);
        
        this.emit('goal_updated', goal);
        this.emit('goals_updated', this.getGoalsSummary());
        
        return goal;
    }
    
    deleteGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        this.goals.delete(goalId);
        
        this.log(`Goal deleted: ${goal.title}`);
        
        this.emit('goal_deleted', { goalId, goal });
        this.emit('goals_updated', this.getGoalsSummary());
        
        return goal;
    }
    
    completeGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        // Mark as completed
        goal.status = 'completed';
        goal.completedAt = new Date();
        goal.progress = 100;
        
        // Move to completed goals
        this.completedGoals.set(goalId, goal);
        this.goals.delete(goalId);
        
        // Update statistics
        this.statistics.totalGoalsCompleted++;
        this.updateStatistics();
        
        this.log(`Goal completed: ${goal.title}`);
        
        // Emit completion events
        this.emit('goal_completed', goal);
        this.emit('goal_achievement', {
            goalType: goal.type,
            targetValue: goal.targetValue,
            actualValue: goal.currentValue,
            completionTime: goal.completedAt - goal.createdAt
        });
        
        return goal;
    }
    
    // Progress Tracking
    updateProgress(goalId, newValue, metadata = {}) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        const oldValue = goal.currentValue;
        const oldProgress = goal.progress;
        
        goal.currentValue = Number(newValue);
        goal.progress = this.calculateProgress(goal.currentValue, goal.targetValue);
        goal.updatedAt = new Date();
        
        // Add metadata if provided
        if (Object.keys(metadata).length > 0) {
            goal.metadata = { ...goal.metadata, ...metadata };
        }
        
        // Check for completion
        if (goal.progress >= 100 && goal.status === 'active') {
            this.completeGoal(goalId);
            return goal;
        }
        
        // Check for milestone notifications
        this.checkMilestoneNotifications(goal, oldProgress);
        
        // Check deadline warnings
        this.checkDeadlineWarnings(goal);
        
        this.log(`Goal progress updated: ${goal.title} (${oldProgress}% → ${goal.progress}%)`);
        
        this.emit('goal_progress', {
            goal,
            oldValue,
            newValue,
            oldProgress,
            newProgress: goal.progress
        });
        
        return goal;
    }
    
    calculateProgress(currentValue, targetValue) {
        if (targetValue <= 0) return 0;
        return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
    }
    
    checkMilestoneNotifications(goal, oldProgress) {
        const notificationPercentages = goal.notifications.percentages;
        const sentNotifications = goal.notifications.sent;
        
        notificationPercentages.forEach(percentage => {
            if (goal.progress >= percentage && oldProgress < percentage && !sentNotifications.includes(percentage)) {
                sentNotifications.push(percentage);
                
                this.emit('milestone_reached', {
                    goal,
                    milestone: percentage,
                    message: `${percentage}% progress reached for goal: ${goal.title}`
                });
            }
        });
    }
    
    checkDeadlineWarnings(goal) {
        if (!goal.deadline) return;
        
        const now = new Date();
        const timeRemaining = goal.deadline - now;
        const totalTime = goal.deadline - goal.createdAt;
        const timeElapsed = now - goal.createdAt;
        const timeProgress = (timeElapsed / totalTime) * 100;
        
        // Warning if time progress significantly exceeds goal progress
        if (timeProgress > goal.progress + 20 && timeRemaining > 0) {
            this.emit('deadline_warning', {
                goal,
                timeRemaining,
                timeProgress,
                goalProgress: goal.progress,
                message: `Goal "${goal.title}" is behind schedule`
            });
        }
        
        // Final warning 24 hours before deadline
        if (timeRemaining > 0 && timeRemaining <= 24 * 60 * 60 * 1000) {
            this.emit('deadline_urgent', {
                goal,
                timeRemaining,
                message: `Less than 24 hours remaining for goal: ${goal.title}`
            });
        }
    }
    
    generateMilestones(targetValue, type) {
        const milestones = [];
        const percentages = [25, 50, 75, 90];
        
        percentages.forEach(percentage => {
            const value = (targetValue * percentage) / 100;
            milestones.push({
                percentage,
                value,
                description: this.getMilestoneDescription(type, percentage, value),
                achieved: false
            });
        });
        
        return milestones;
    }
    
    getMilestoneDescription(type, percentage, value) {
        const formatValue = (val) => {
            if (type.includes('profit') || type === 'balance_target') {
                return `$${val.toFixed(2)}`;
            } else if (type === 'win_rate') {
                return `${val.toFixed(1)}%`;
            } else {
                return Math.round(val).toString();
            }
        };
        
        return `${percentage}% milestone: ${formatValue(value)}`;
    }
    
    // Trading Integration
    onTradeExecuted(tradeData) {
        const { result, amount, pnl, platform, symbol, timestamp } = tradeData;
        
        // Update relevant goals
        this.goals.forEach((goal, goalId) => {
            try {
                this.updateGoalFromTrade(goal, tradeData);
            } catch (error) {
                this.log(`Error updating goal ${goalId} from trade: ${error.message}`, 'error');
            }
        });
    }
    
    updateGoalFromTrade(goal, tradeData) {
        const { result, amount, pnl = 0, platform, timestamp } = tradeData;
        const tradeDate = new Date(timestamp);
        
        switch (goal.type) {
            case this.goalTypes.DAILY_PROFIT:
                if (this.isToday(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.WEEKLY_PROFIT:
                if (this.isThisWeek(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.MONTHLY_PROFIT:
                if (this.isThisMonth(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.TRADE_COUNT:
                if (this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + 1);
                }
                break;
                
            case this.goalTypes.WIN_RATE:
                if (this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateWinRateGoal(goal, result === 'win');
                }
                break;
                
            case this.goalTypes.PLATFORM_PROFIT:
                if (goal.metadata.platform === platform && this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
        }
    }
    
    updateWinRateGoal(goal, isWin) {
        const metadata = goal.metadata;
        metadata.totalTrades = (metadata.totalTrades || 0) + 1;
        metadata.wins = (metadata.wins || 0) + (isWin ? 1 : 0);
        
        const winRate = (metadata.wins / metadata.totalTrades) * 100;
        
        this.updateProgress(goal.id, winRate, metadata);
    }
    
    onBalanceUpdate(balanceData) {
        const { totalBalance, platforms } = balanceData;
        
        // Update balance target goals
        this.goals.forEach((goal, goalId) => {
            if (goal.type === this.goalTypes.BALANCE_TARGET) {
                this.updateProgress(goalId, totalBalance);
            }
        });
    }
    
    onStrategyPerformance(strategyData) {
        const { strategyName, performance } = strategyData;
        
        // Update strategy performance goals
        this.goals.forEach((goal, goalId) => {
            if (goal.type === this.goalTypes.STRATEGY_PERFORMANCE && 
                goal.metadata.strategy === strategyName) {
                this.updateProgress(goalId, performance.profit || 0);
            }
        });
    }
    
    // Goal Templates
    createDailyProfitGoal(targetProfit, deadline = null) {
        return this.createGoal({
            title: `Daily Profit: $${targetProfit}`,
            type: this.goalTypes.DAILY_PROFIT,
            targetValue: targetProfit,
            deadline: deadline || this.getEndOfDay(),
            description: `Achieve $${targetProfit} profit today`,
            priority: 'high'
        });
    }
    
    createWeeklyProfitGoal(targetProfit) {
        return this.createGoal({
            title: `Weekly Profit: $${targetProfit}`,
            type: this.goalTypes.WEEKLY_PROFIT,
            targetValue: targetProfit,
            deadline: this.getEndOfWeek(),
            description: `Achieve $${targetProfit} profit this week`,
            priority: 'medium'
        });
    }
    
    createMonthlyProfitGoal(targetProfit) {
        return this.createGoal({
            title: `Monthly Profit: $${targetProfit}`,
            type: this.goalTypes.MONTHLY_PROFIT,
            targetValue: targetProfit,
            deadline: this.getEndOfMonth(),
            description: `Achieve $${targetProfit} profit this month`,
            priority: 'high'
        });
    }
    
    createWinRateGoal(targetWinRate, timeframe = 'daily') {
        const deadline = timeframe === 'daily' ? this.getEndOfDay() :
                        timeframe === 'weekly' ? this.getEndOfWeek() :
                        this.getEndOfMonth();
        
        return this.createGoal({
            title: `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Win Rate: ${targetWinRate}%`,
            type: this.goalTypes.WIN_RATE,
            targetValue: targetWinRate,
            deadline,
            description: `Achieve ${targetWinRate}% win rate for ${timeframe}`,
            priority: 'medium',
            metadata: { timeframe, totalTrades: 0, wins: 0 }
        });
    }
    
    createBalanceTargetGoal(targetBalance, deadline) {
        return this.createGoal({
            title: `Balance Target: $${targetBalance}`,
            type: this.goalTypes.BALANCE_TARGET,
            targetValue: targetBalance,
            deadline: deadline ? new Date(deadline) : null,
            description: `Reach account balance of $${targetBalance}`,
            priority: 'high'
        });
    }
    
    // Statistics and Reporting
    updateStatistics() {
        const allGoals = [...this.goals.values(), ...this.completedGoals.values()];
        const completedGoals = [...this.completedGoals.values()];
        
        this.statistics.successRate = allGoals.length > 0 ? 
            (completedGoals.length / allGoals.length) * 100 : 0;
        
        if (completedGoals.length > 0) {
            const totalDuration = completedGoals.reduce((sum, goal) => {
                return sum + (goal.completedAt - goal.createdAt);
            }, 0);
            
            this.statistics.averageGoalDuration = totalDuration / completedGoals.length;
            
            this.statistics.totalRevenueGenerated = completedGoals
                .filter(goal => goal.type.includes('profit'))
                .reduce((sum, goal) => sum + goal.currentValue, 0);
        }
    }
    
    getGoalsSummary() {
        return {
            active: Array.from(this.goals.values()).map(goal => this.getGoalSummary(goal)),
            completed: Array.from(this.completedGoals.values()).map(goal => this.getGoalSummary(goal)),
            statistics: this.statistics,
            totalActive: this.goals.size,
            totalCompleted: this.completedGoals.size
        };
    }
    
    getGoalSummary(goal) {
        return {
            id: goal.id,
            title: goal.title,
            type: goal.type,
            progress: goal.progress,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            deadline: goal.deadline,
            status: goal.status,
            priority: goal.priority,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt,
            completedAt: goal.completedAt
        };
    }
    
    getGoalsByType(type) {
        return Array.from(this.goals.values()).filter(goal => goal.type === type);
    }
    
    getGoalsByPriority(priority) {
        return Array.from(this.goals.values()).filter(goal => goal.priority === priority);
    }
    
    getExpiredGoals() {
        const now = new Date();
        return Array.from(this.goals.values()).filter(goal => 
            goal.deadline && goal.deadline < now
        );
    }
    
    // Data Persistence
    async loadGoals() {
        try {
            const data = await fs.readFile(this.config.dataPath, 'utf8');
            const parsed = JSON.parse(data);
            
            // Convert dates back from strings
            if (parsed.goals) {
                parsed.goals.forEach(goalData => {
                    goalData.createdAt = new Date(goalData.createdAt);
                    goalData.updatedAt = new Date(goalData.updatedAt);
                    if (goalData.deadline) goalData.deadline = new Date(goalData.deadline);
                    if (goalData.completedAt) goalData.completedAt = new Date(goalData.completedAt);
                    
                    if (goalData.status === 'completed') {
                        this.completedGoals.set(goalData.id, goalData);
                    } else {
                        this.goals.set(goalData.id, goalData);
                    }
                });
            }
            
            if (parsed.statistics) {
                this.statistics = { ...this.statistics, ...parsed.statistics };
            }
            
            this.log(`Loaded ${this.goals.size} active goals and ${this.completedGoals.size} completed goals`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.log(`Failed to load goals: ${error.message}`, 'error');
            }
        }
    }
    
    async saveGoals() {
        try {
            const data = {
                goals: [...this.goals.values(), ...this.completedGoals.values()],
                statistics: this.statistics,
                lastSaved: new Date().toISOString()
            };
            
            // Ensure directory exists
            const dir = path.dirname(this.config.dataPath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(this.config.dataPath, JSON.stringify(data, null, 2));
            
            this.log('Goals saved successfully');
        } catch (error) {
            this.log(`Failed to save goals: ${error.message}`, 'error');
            throw error;
        }
    }
    
    setupAutoSave() {
        this.saveTimer = setInterval(async () => {
            try {
                await this.saveGoals();
            } catch (error) {
                this.log(`Auto-save failed: ${error.message}`, 'error');
            }
        }, this.config.saveInterval);
    }
    
    setupProgressChecks() {
        // Check progress every minute
        setInterval(() => {
            this.checkExpiredGoals();
            this.checkDeadlineWarnings();
        }, 60000);
    }
    
    checkExpiredGoals() {
        const expiredGoals = this.getExpiredGoals();
        
// src/goals/GoalTracker.js
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BayneXGoalTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            dataPath: config.dataPath || path.join(__dirname, '../data/goals.json'),
            autoSave: config.autoSave !== false,
            saveInterval: config.saveInterval || 30000, // 30 seconds
            maxGoals: config.maxGoals || 100,
            ...config
        };
        
        this.goals = new Map();
        this.completedGoals = new Map();
        this.statistics = {
            totalGoalsCreated: 0,
            totalGoalsCompleted: 0,
            totalRevenueGenerated: 0,
            averageGoalDuration: 0,
            successRate: 0
        };
        
        this.goalTypes = {
            DAILY_PROFIT: 'daily_profit',
            WEEKLY_PROFIT: 'weekly_profit',
            MONTHLY_PROFIT: 'monthly_profit',
            WIN_RATE: 'win_rate',
            TRADE_COUNT: 'trade_count',
            BALANCE_TARGET: 'balance_target',
            STRATEGY_PERFORMANCE: 'strategy_performance',
            PLATFORM_PROFIT: 'platform_profit',
            RISK_MANAGEMENT: 'risk_management',
            CUSTOM: 'custom'
        };
        
        this.isInitialized = false;
        this.saveTimer = null;
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing Goal Tracker...');
            
            // Load existing goals
            await this.loadGoals();
            
            // Setup auto-save
            if (this.config.autoSave) {
                this.setupAutoSave();
            }
            
            // Setup periodic progress checks
            this.setupProgressChecks();
            
            this.isInitialized = true;
            this.log('Goal Tracker initialized successfully');
            
            this.emit('initialized');
        } catch (error) {
            this.log(`Goal Tracker initialization error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Goal Creation and Management
    createGoal(goalData) {
        try {
            const goal = this.validateAndCreateGoal(goalData);
            
            // Check if we're at max goals limit
            if (this.goals.size >= this.config.maxGoals) {
                throw new Error(`Maximum number of goals (${this.config.maxGoals}) reached`);
            }
            
            this.goals.set(goal.id, goal);
            this.statistics.totalGoalsCreated++;
            
            this.log(`Goal created: ${goal.title} (${goal.type})`);
            
            // Emit events
            this.emit('goal_created', goal);
            this.emit('goals_updated', this.getGoalsSummary());
            
            return goal;
        } catch (error) {
            this.log(`Goal creation error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    validateAndCreateGoal(goalData) {
        const {
            title,
            type,
            targetValue,
            currentValue = 0,
            deadline,
            description = '',
            priority = 'medium',
            metadata = {}
        } = goalData;
        
        // Validation
        if (!title || title.trim().length === 0) {
            throw new Error('Goal title is required');
        }
        
        if (!type || !Object.values(this.goalTypes).includes(type)) {
            throw new Error('Valid goal type is required');
        }
        
        if (targetValue === undefined || targetValue === null || targetValue <= 0) {
            throw new Error('Target value must be positive');
        }
        
        if (deadline && new Date(deadline) <= new Date()) {
            throw new Error('Deadline must be in the future');
        }
        
        // Create goal object
        const goal = {
            id: this.generateGoalId(),
            title: title.trim(),
            type,
            targetValue: Number(targetValue),
            currentValue: Number(currentValue),
            deadline: deadline ? new Date(deadline) : null,
            description: description.trim(),
            priority,
            metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            progress: this.calculateProgress(currentValue, targetValue),
            milestones: this.generateMilestones(targetValue, type),
            notifications: {
                percentages: [25, 50, 75, 90],
                sent: []
            }
        };
        
        return goal;
    }
    
    updateGoal(goalId, updates) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        const oldProgress = goal.progress;
        
        // Update allowed fields
        const allowedUpdates = ['currentValue', 'targetValue', 'deadline', 'description', 'priority', 'metadata'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                goal[field] = updates[field];
            }
        });
        
        // Recalculate progress
        goal.progress = this.calculateProgress(goal.currentValue, goal.targetValue);
        goal.updatedAt = new Date();
        
        // Check for completion
        if (goal.progress >= 100 && goal.status === 'active') {
            this.completeGoal(goalId);
        }
        
        // Check for milestone notifications
        this.checkMilestoneNotifications(goal, oldProgress);
        
        this.log(`Goal updated: ${goal.title} (${goal.progress}%)`);
        
        this.emit('goal_updated', goal);
        this.emit('goals_updated', this.getGoalsSummary());
        
        return goal;
    }
    
    deleteGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        this.goals.delete(goalId);
        
        this.log(`Goal deleted: ${goal.title}`);
        
        this.emit('goal_deleted', { goalId, goal });
        this.emit('goals_updated', this.getGoalsSummary());
        
        return goal;
    }
    
    completeGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        // Mark as completed
        goal.status = 'completed';
        goal.completedAt = new Date();
        goal.progress = 100;
        
        // Move to completed goals
        this.completedGoals.set(goalId, goal);
        this.goals.delete(goalId);
        
        // Update statistics
        this.statistics.totalGoalsCompleted++;
        this.updateStatistics();
        
        this.log(`Goal completed: ${goal.title}`);
        
        // Emit completion events
        this.emit('goal_completed', goal);
        this.emit('goal_achievement', {
            goalType: goal.type,
            targetValue: goal.targetValue,
            actualValue: goal.currentValue,
            completionTime: goal.completedAt - goal.createdAt
        });
        
        return goal;
    }
    
    // Progress Tracking
    updateProgress(goalId, newValue, metadata = {}) {
        const goal = this.goals.get(goalId);
        if (!goal) {
            throw new Error(`Goal with ID ${goalId} not found`);
        }
        
        const oldValue = goal.currentValue;
        const oldProgress = goal.progress;
        
        goal.currentValue = Number(newValue);
        goal.progress = this.calculateProgress(goal.currentValue, goal.targetValue);
        goal.updatedAt = new Date();
        
        // Add metadata if provided
        if (Object.keys(metadata).length > 0) {
            goal.metadata = { ...goal.metadata, ...metadata };
        }
        
        // Check for completion
        if (goal.progress >= 100 && goal.status === 'active') {
            this.completeGoal(goalId);
            return goal;
        }
        
        // Check for milestone notifications
        this.checkMilestoneNotifications(goal, oldProgress);
        
        // Check deadline warnings
        this.checkDeadlineWarnings(goal);
        
        this.log(`Goal progress updated: ${goal.title} (${oldProgress}% → ${goal.progress}%)`);
        
        this.emit('goal_progress', {
            goal,
            oldValue,
            newValue,
            oldProgress,
            newProgress: goal.progress
        });
        
        return goal;
    }
    
    calculateProgress(currentValue, targetValue) {
        if (targetValue <= 0) return 0;
        return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
    }
    
    checkMilestoneNotifications(goal, oldProgress) {
        const notificationPercentages = goal.notifications.percentages;
        const sentNotifications = goal.notifications.sent;
        
        notificationPercentages.forEach(percentage => {
            if (goal.progress >= percentage && oldProgress < percentage && !sentNotifications.includes(percentage)) {
                sentNotifications.push(percentage);
                
                this.emit('milestone_reached', {
                    goal,
                    milestone: percentage,
                    message: `${percentage}% progress reached for goal: ${goal.title}`
                });
            }
        });
    }
    
    checkDeadlineWarnings(goal) {
        if (!goal.deadline) return;
        
        const now = new Date();
        const timeRemaining = goal.deadline - now;
        const totalTime = goal.deadline - goal.createdAt;
        const timeElapsed = now - goal.createdAt;
        const timeProgress = (timeElapsed / totalTime) * 100;
        
        // Warning if time progress significantly exceeds goal progress
        if (timeProgress > goal.progress + 20 && timeRemaining > 0) {
            this.emit('deadline_warning', {
                goal,
                timeRemaining,
                timeProgress,
                goalProgress: goal.progress,
                message: `Goal "${goal.title}" is behind schedule`
            });
        }
        
        // Final warning 24 hours before deadline
        if (timeRemaining > 0 && timeRemaining <= 24 * 60 * 60 * 1000) {
            this.emit('deadline_urgent', {
                goal,
                timeRemaining,
                message: `Less than 24 hours remaining for goal: ${goal.title}`
            });
        }
    }
    
    generateMilestones(targetValue, type) {
        const milestones = [];
        const percentages = [25, 50, 75, 90];
        
        percentages.forEach(percentage => {
            const value = (targetValue * percentage) / 100;
            milestones.push({
                percentage,
                value,
                description: this.getMilestoneDescription(type, percentage, value),
                achieved: false
            });
        });
        
        return milestones;
    }
    
    getMilestoneDescription(type, percentage, value) {
        const formatValue = (val) => {
            if (type.includes('profit') || type === 'balance_target') {
                return `$${val.toFixed(2)}`;
            } else if (type === 'win_rate') {
                return `${val.toFixed(1)}%`;
            } else {
                return Math.round(val).toString();
            }
        };
        
        return `${percentage}% milestone: ${formatValue(value)}`;
    }
    
    // Trading Integration
    onTradeExecuted(tradeData) {
        const { result, amount, pnl, platform, symbol, timestamp } = tradeData;
        
        // Update relevant goals
        this.goals.forEach((goal, goalId) => {
            try {
                this.updateGoalFromTrade(goal, tradeData);
            } catch (error) {
                this.log(`Error updating goal ${goalId} from trade: ${error.message}`, 'error');
            }
        });
    }
    
    updateGoalFromTrade(goal, tradeData) {
        const { result, amount, pnl = 0, platform, timestamp } = tradeData;
        const tradeDate = new Date(timestamp);
        
        switch (goal.type) {
            case this.goalTypes.DAILY_PROFIT:
                if (this.isToday(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.WEEKLY_PROFIT:
                if (this.isThisWeek(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.MONTHLY_PROFIT:
                if (this.isThisMonth(tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
                
            case this.goalTypes.TRADE_COUNT:
                if (this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + 1);
                }
                break;
                
            case this.goalTypes.WIN_RATE:
                if (this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateWinRateGoal(goal, result === 'win');
                }
                break;
                
            case this.goalTypes.PLATFORM_PROFIT:
                if (goal.metadata.platform === platform && this.isInGoalTimeframe(goal, tradeDate)) {
                    this.updateProgress(goal.id, goal.currentValue + pnl);
                }
                break;
        }
    }
    
    updateWinRateGoal(goal, isWin) {
        const metadata = goal.metadata;
        metadata.totalTrades = (metadata.totalTrades || 0) + 1;
        metadata.wins = (metadata.wins || 0) + (isWin ? 1 : 0);
        
        const winRate = (metadata.wins / metadata.totalTrades) * 100;
        
        this.updateProgress(goal.id, winRate, metadata);
    }
    
    onBalanceUpdate(balanceData) {
        const { totalBalance, platforms } = balanceData;
        
        // Update balance target goals
        this.goals.forEach((goal, goalId) => {
            if (goal.type === this.goalTypes.BALANCE_TARGET) {
                this.updateProgress(goalId, totalBalance);
            }
        });
    }
    
    onStrategyPerformance(strategyData) {
        const { strategyName, performance } = strategyData;
        
        // Update strategy performance goals
        this.goals.forEach((goal, goalId) => {
            if (goal.type === this.goalTypes.STRATEGY_PERFORMANCE && 
                goal.metadata.strategy === strategyName) {
                this.updateProgress(goalId, performance.profit || 0);
            }
        });
    }
    
    // Goal Templates
    createDailyProfitGoal(targetProfit, deadline = null) {
        return this.createGoal({
            title: `Daily Profit: $${targetProfit}`,
            type: this.goalTypes.DAILY_PROFIT,
            targetValue: targetProfit,
            deadline: deadline || this.getEndOfDay(),
            description: `Achieve $${targetProfit} profit today`,
            priority: 'high'
        });
    }
    
    createWeeklyProfitGoal(targetProfit) {
        return this.createGoal({
            title: `Weekly Profit: $${targetProfit}`,
            type: this.goalTypes.WEEKLY_PROFIT,
            targetValue: targetProfit,
            deadline: this.getEndOfWeek(),
            description: `Achieve $${targetProfit} profit this week`,
            priority: 'medium'
        });
    }
    
    createMonthlyProfitGoal(targetProfit) {
        return this.createGoal({
            title: `Monthly Profit: $${targetProfit}`,
            type: this.goalTypes.MONTHLY_PROFIT,
            targetValue: targetProfit,
            deadline: this.getEndOfMonth(),
            description: `Achieve $${targetProfit} profit this month`,
            priority: 'high'
        });
    }
    
    createWinRateGoal(targetWinRate, timeframe = 'daily') {
        const deadline = timeframe === 'daily' ? this.getEndOfDay() :
                        timeframe === 'weekly' ? this.getEndOfWeek() :
                        this.getEndOfMonth();
        
        return this.createGoal({
            title: `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Win Rate: ${targetWinRate}%`,
            type: this.goalTypes.WIN_RATE,
            targetValue: targetWinRate,
            deadline,
            description: `Achieve ${targetWinRate}% win rate for ${timeframe}`,
            priority: 'medium',
            metadata: { timeframe, totalTrades: 0, wins: 0 }
        });
    }
    
    createBalanceTargetGoal(targetBalance, deadline) {
        return this.createGoal({
            title: `Balance Target: $${targetBalance}`,
            type: this.goalTypes.BALANCE_TARGET,
            targetValue: targetBalance,
            deadline: deadline ? new Date(deadline) : null,
            description: `Reach account balance of $${targetBalance}`,
            priority: 'high'
        });
    }
    
    // Statistics and Reporting
    updateStatistics() {
        const allGoals = [...this.goals.values(), ...this.completedGoals.values()];
        const completedGoals = [...this.completedGoals.values()];
        
        this.statistics.successRate = allGoals.length > 0 ? 
            (completedGoals.length / allGoals.length) * 100 : 0;
        
        if (completedGoals.length > 0) {
            const totalDuration = completedGoals.reduce((sum, goal) => {
                return sum + (goal.completedAt - goal.createdAt);
            }, 0);
            
            this.statistics.averageGoalDuration = totalDuration / completedGoals.length;
            
            this.statistics.totalRevenueGenerated = completedGoals
                .filter(goal => goal.type.includes('profit'))
                .reduce((sum, goal) => sum + goal.currentValue, 0);
        }
    }
    
    getGoalsSummary() {
        return {
            active: Array.from(this.goals.values()).map(goal => this.getGoalSummary(goal)),
            completed: Array.from(this.completedGoals.values()).map(goal => this.getGoalSummary(goal)),
            statistics: this.statistics,
            totalActive: this.goals.size,
            totalCompleted: this.completedGoals.size
        };
    }
    
    getGoalSummary(goal) {
        return {
            id: goal.id,
            title: goal.title,
            type: goal.type,
            progress: goal.progress,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            deadline: goal.deadline,
            status: goal.status,
            priority: goal.priority,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt,
            completedAt: goal.completedAt
        };
    }
    
    getGoalsByType(type) {
        return Array.from(this.goals.values()).filter(goal => goal.type === type);
    }
    
    getGoalsByPriority(priority) {
        return Array.from(this.goals.values()).filter(goal => goal.priority === priority);
    }
    
    getExpiredGoals() {
        const now = new Date();
        return Array.from(this.goals.values()).filter(goal => 
            goal.deadline && goal.deadline < now
        );
    }
    
    // Data Persistence
    async loadGoals() {
        try {
            const data = await fs.readFile(this.config.dataPath, 'utf8');
            const parsed = JSON.parse(data);
            
            // Convert dates back from strings
            if (parsed.goals) {
                parsed.goals.forEach(goalData => {
                    goalData.createdAt = new Date(goalData.createdAt);
                    goalData.updatedAt = new Date(goalData.updatedAt);
                    if (goalData.deadline) goalData.deadline = new Date(goalData.deadline);
                    if (goalData.completedAt) goalData.completedAt = new Date(goalData.completedAt);
                    
                    if (goalData.status === 'completed') {
                        this.completedGoals.set(goalData.id, goalData);
                    } else {
                        this.goals.set(goalData.id, goalData);
                    }
                });
            }
            
            if (parsed.statistics) {
                this.statistics = { ...this.statistics, ...parsed.statistics };
            }
            
            this.log(`Loaded ${this.goals.size} active goals and ${this.completedGoals.size} completed goals`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.log(`Failed to load goals: ${error.message}`, 'error');
            }
        }
    }
    
    async saveGoals() {
        try {
            const data = {
                goals: [...this.goals.values(), ...this.completedGoals.values()],
                statistics: this.statistics,
                lastSaved: new Date().toISOString()
            };
            
            // Ensure directory exists
            const dir = path.dirname(this.config.dataPath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(this.config.dataPath, JSON.stringify(data, null, 2));
            
            this.log('Goals saved successfully');
        } catch (error) {
            this.log(`Failed to save goals: ${error.message}`, 'error');
            throw error;
        }
    }
    
    setupAutoSave() {
        this.saveTimer = setInterval(async () => {
            try {
                await this.saveGoals();
            } catch (error) {
                this.log(`Auto-save failed: ${error.message}`, 'error');
            }
        }, this.config.saveInterval);
    }
    
    setupProgressChecks() {
        // Check progress every minute
        setInterval(() => {
            this.checkExpiredGoals();
            this.checkDeadlineWarnings();
        }, 60000);
    }
    
    checkExpiredGoals() {
        const expiredGoals = this.getExpiredGoals();
        
        expiredGoals.forEach(goal => {
            if (goal.status === 'active') {
                goal.status = 'expired';
                this.emit('goal_expired', goal);
            }
        });
    }
    
    // Utility Methods
    generateGoalId() {
        return 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    isThisWeek(date) {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        return date >= weekStart && date < weekEnd;
    }
    
    isThisMonth(date) {
        const today = new Date();
        return date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    isInGoalTimeframe(goal, date) {
        if (!goal.deadline) return true;
        return date >= goal.createdAt && date <= goal.deadline;
    }
    
    getEndOfDay() {
        const date = new Date();
        date.setHours(23, 59, 59, 999);
        return date;
    }
    
    getEndOfWeek() {
        const date = new Date();
        const daysUntilSunday = 7 - date.getDay();
        date.setDate(date.getDate() + daysUntilSunday);
        date.setHours(23, 59, 59, 999);
        return date;
    }
    
    getEndOfMonth() {
        const date = new Date();
        date.setMonth(date.getMonth() + 1, 0);
        date.setHours(23, 59, 59, 999);
        return date;
    }
    
    async cleanup() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
        
        await this.saveGoals();
        this.log('Goal Tracker cleanup complete');
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [GoalTracker] [${level.toUpperCase()}] ${message}`);
        
        this.emit('log', { timestamp, level, message, component: 'GoalTracker' });
    }
}

module.exports = BayneXGoalTracker;
