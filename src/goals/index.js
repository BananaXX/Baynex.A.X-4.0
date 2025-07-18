// src/goals/index.js
const BayneXGoalTracker = require('./GoalTracker');

module.exports = {
    BayneXGoalTracker,
    
    // Factory function
    createGoalTracker: (config = {}) => {
        return new BayneXGoalTracker(config);
    },
    
    // Goal type constants
    GOAL_TYPES: {
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
    },
    
    // Priority levels
    PRIORITIES: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    },
    
    // Goal status
    STATUS: {
        ACTIVE: 'active',
        COMPLETED: 'completed',
        EXPIRED: 'expired',
        PAUSED: 'paused',
        CANCELLED: 'cancelled'
    },
    
    // Utility functions
    utils: {
        // Validate goal data
        validateGoalData: (goalData) => {
            const requiredFields = ['title', 'type', 'targetValue'];
            const missing = requiredFields.filter(field => !goalData[field]);
            
            if (missing.length > 0) {
                throw new Error(`Missing required fields: ${missing.join(', ')}`);
            }
            
            if (goalData.targetValue <= 0) {
                throw new Error('Target value must be positive');
            }
            
            if (goalData.deadline && new Date(goalData.deadline) <= new Date()) {
                throw new Error('Deadline must be in the future');
            }
            
            return true;
        },
        
        // Format goal progress
        formatProgress: (progress) => {
            return `${Math.round(progress)}%`;
        },
        
        // Calculate time remaining
        getTimeRemaining: (deadline) => {
            if (!deadline) return null;
            
            const now = new Date();
            const end = new Date(deadline);
            const diff = end - now;
            
            if (diff <= 0) return 'Expired';
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (days > 0) return `${days}d ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        },
        
        // Get goal type display name
        getGoalTypeDisplayName: (type) => {
            const displayNames = {
                daily_profit: 'Daily Profit',
                weekly_profit: 'Weekly Profit',
                monthly_profit: 'Monthly Profit',
                win_rate: 'Win Rate',
                trade_count: 'Trade Count',
                balance_target: 'Balance Target',
                strategy_performance: 'Strategy Performance',
                platform_profit: 'Platform Profit',
                risk_management: 'Risk Management',
                custom: 'Custom Goal'
            };
            
            return displayNames[type] || type;
        },
        
        // Format goal value based on type
        formatGoalValue: (value, type) => {
            if (type.includes('profit') || type === 'balance_target') {
                return `$${value.toFixed(2)}`;
            } else if (type === 'win_rate') {
                return `${value.toFixed(1)}%`;
            } else {
                return Math.round(value).toString();
            }
        },
        
        // Get goal priority color
        getPriorityColor: (priority) => {
            const colors = {
                low: '#888888',
                medium: '#FFAA00',
                high: '#FF6B35',
                critical: '#FF4444'
            };
            
            return colors[priority] || colors.medium;
        },
        
        // Check if goal is overdue
        isOverdue: (goal) => {
            if (!goal.deadline || goal.status !== 'active') return false;
            return new Date() > new Date(goal.deadline);
        },
        
        // Check if goal is at risk
        isAtRisk: (goal) => {
            if (!goal.deadline || goal.status !== 'active') return false;
            
            const now = new Date();
            const deadline = new Date(goal.deadline);
            const created = new Date(goal.createdAt);
            
            const totalTime = deadline - created;
            const elapsed = now - created;
            const timeProgress = (elapsed / totalTime) * 100;
            
            // At risk if time progress is 20% ahead of goal progress
            return timeProgress > goal.progress + 20;
        },
        
        // Generate goal summary text
        generateSummaryText: (goal) => {
            const typeDisplay = module.exports.utils.getGoalTypeDisplayName(goal.type);
            const valueFormatted = module.exports.utils.formatGoalValue(goal.targetValue, goal.type);
            const progress = module.exports.utils.formatProgress(goal.progress);
            const timeRemaining = goal.deadline ? 
                module.exports.utils.getTimeRemaining(goal.deadline) : 'No deadline';
            
            return `${typeDisplay}: ${valueFormatted} (${progress} complete, ${timeRemaining})`;
        }
    },
    
    // Pre-defined goal templates
// src/goals/index.js
const BayneXGoalTracker = require('./GoalTracker');

module.exports = {
    BayneXGoalTracker,
    
    // Factory function
    createGoalTracker: (config = {}) => {
        return new BayneXGoalTracker(config);
    },
    
    // Goal type constants
    GOAL_TYPES: {
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
    },
    
    // Priority levels
    PRIORITIES: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    },
    
    // Goal status
    STATUS: {
        ACTIVE: 'active',
        COMPLETED: 'completed',
        EXPIRED: 'expired',
        PAUSED: 'paused',
        CANCELLED: 'cancelled'
    },
    
    // Utility functions
    utils: {
        // Validate goal data
        validateGoalData: (goalData) => {
            const requiredFields = ['title', 'type', 'targetValue'];
            const missing = requiredFields.filter(field => !goalData[field]);
            
            if (missing.length > 0) {
                throw new Error(`Missing required fields: ${missing.join(', ')}`);
            }
            
            if (goalData.targetValue <= 0) {
                throw new Error('Target value must be positive');
            }
            
            if (goalData.deadline && new Date(goalData.deadline) <= new Date()) {
                throw new Error('Deadline must be in the future');
            }
            
            return true;
        },
        
        // Format goal progress
        formatProgress: (progress) => {
            return `${Math.round(progress)}%`;
        },
        
        // Calculate time remaining
        getTimeRemaining: (deadline) => {
            if (!deadline) return null;
            
            const now = new Date();
            const end = new Date(deadline);
            const diff = end - now;
            
            if (diff <= 0) return 'Expired';
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (days > 0) return `${days}d ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        },
        
        // Get goal type display name
        getGoalTypeDisplayName: (type) => {
            const displayNames = {
                daily_profit: 'Daily Profit',
                weekly_profit: 'Weekly Profit',
                monthly_profit: 'Monthly Profit',
                win_rate: 'Win Rate',
                trade_count: 'Trade Count',
                balance_target: 'Balance Target',
                strategy_performance: 'Strategy Performance',
                platform_profit: 'Platform Profit',
                risk_management: 'Risk Management',
                custom: 'Custom Goal'
            };
            
            return displayNames[type] || type;
        },
        
        // Format goal value based on type
        formatGoalValue: (value, type) => {
            if (type.includes('profit') || type === 'balance_target') {
                return `$${value.toFixed(2)}`;
            } else if (type === 'win_rate') {
                return `${value.toFixed(1)}%`;
            } else {
                return Math.round(value).toString();
            }
        },
        
        // Get goal priority color
        getPriorityColor: (priority) => {
            const colors = {
                low: '#888888',
                medium: '#FFAA00',
                high: '#FF6B35',
                critical: '#FF4444'
            };
            
            return colors[priority] || colors.medium;
        },
        
        // Check if goal is overdue
        isOverdue: (goal) => {
            if (!goal.deadline || goal.status !== 'active') return false;
            return new Date() > new Date(goal.deadline);
        },
        
        // Check if goal is at risk
        isAtRisk: (goal) => {
            if (!goal.deadline || goal.status !== 'active') return false;
            
            const now = new Date();
            const deadline = new Date(goal.deadline);
            const created = new Date(goal.createdAt);
            
            const totalTime = deadline - created;
            const elapsed = now - created;
            const timeProgress = (elapsed / totalTime) * 100;
            
            // At risk if time progress is 20% ahead of goal progress
            return timeProgress > goal.progress + 20;
        },
        
        // Generate goal summary text
        generateSummaryText: (goal) => {
            const typeDisplay = module.exports.utils.getGoalTypeDisplayName(goal.type);
            const valueFormatted = module.exports.utils.formatGoalValue(goal.targetValue, goal.type);
            const progress = module.exports.utils.formatProgress(goal.progress);
            const timeRemaining = goal.deadline ? 
                module.exports.utils.getTimeRemaining(goal.deadline) : 'No deadline';
            
            return `${typeDisplay}: ${valueFormatted} (${progress} complete, ${timeRemaining})`;
        }
    },
    
    // Pre-defined goal templates
    templates: {
        // Daily goals
        dailyProfit: (amount) => ({
            title: `Daily Profit: $${amount}`,
            type: 'daily_profit',
            targetValue: amount,
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // End of today
            description: `Achieve $${amount} profit today`,
            priority: 'high'
        }),
        
        dailyWinRate: (percentage) => ({
            title: `Daily Win Rate: ${percentage}%`,
            type: 'win_rate',
            targetValue: percentage,
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            description: `Achieve ${percentage}% win rate today`,
            priority: 'medium',
            metadata: { timeframe: 'daily', totalTrades: 0, wins: 0 }
        }),
        
        dailyTrades: (count) => ({
            title: `Daily Trades: ${count}`,
            type: 'trade_count',
            targetValue: count,
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            description: `Execute ${count} trades today`,
            priority: 'medium'
        }),
        
        // Weekly goals
        weeklyProfit: (amount) => ({
            title: `Weekly Profit: $${amount}`,
            type: 'weekly_profit',
            targetValue: amount,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            description: `Achieve $${amount} profit this week`,
            priority: 'high'
        }),
        
        // Monthly goals
        monthlyProfit: (amount) => ({
            title: `Monthly Profit: $${amount}`,
            type: 'monthly_profit',
            targetValue: amount,
            deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
            description: `Achieve $${amount} profit this month`,
            priority: 'high'
        }),
        
        balanceTarget: (amount, days = 30) => ({
            title: `Balance Target: $${amount}`,
            type: 'balance_target',
            targetValue: amount,
            deadline: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
            description: `Reach account balance of $${amount} within ${days} days`,
            priority: 'high'
        }),
        
        // Platform-specific goals
        platformProfit: (platform, amount, days = 7) => ({
            title: `${platform} Profit: $${amount}`,
            type: 'platform_profit',
            targetValue: amount,
            deadline: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
            description: `Achieve $${amount} profit on ${platform} within ${days} days`,
            priority: 'medium',
            metadata: { platform }
        }),
        
        // Strategy goals
        strategyPerformance: (strategy, target, days = 14) => ({
            title: `${strategy} Performance: $${target}`,
            type: 'strategy_performance',
            targetValue: target,
            deadline: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
            description: `Achieve $${target} profit with ${strategy} strategy`,
            priority: 'medium',
            metadata: { strategy }
        })
    }
};
