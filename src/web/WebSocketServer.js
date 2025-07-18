// src/web/WebSocketServer.js
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const jwt = require('jsonwebtoken');
const url = require('url');

class BayneXWebSocketServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.port = options.port || 8080;
        this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'baynex-secret-key';
        this.clients = new Map();
        this.rooms = new Map();
        this.server = null;
        
        this.messageTypes = {
            TRADE_UPDATE: 'trade_update',
            BALANCE_UPDATE: 'balance_update',
            STRATEGY_UPDATE: 'strategy_update',
            VOICE_MESSAGE: 'voice_message',
            RISK_ALERT: 'risk_alert',
            GOAL_UPDATE: 'goal_update',
            SYSTEM_STATUS: 'system_status',
            PLATFORM_STATUS: 'platform_status',
            PERFORMANCE_DATA: 'performance_data',
            USER_ACTION: 'user_action'
        };
        
        this.userPermissions = {
            ADMIN: ['all'],
            MANAGER: ['trade_update', 'balance_update', 'strategy_update', 'system_status'],
            TRADER: ['trade_update', 'balance_update', 'performance_data'],
            VIEWER: ['balance_update', 'performance_data', 'system_status']
        };
    }
    
    async initialize() {
        try {
            this.server = new WebSocket.Server({
                port: this.port,
                verifyClient: this.verifyClient.bind(this)
            });
            
            this.server.on('connection', this.handleConnection.bind(this));
            this.server.on('error', this.handleServerError.bind(this));
            
            this.log(`WebSocket server started on port ${this.port}`);
            this.emit('server_started', { port: this.port });
            
            // Setup heartbeat
            this.startHeartbeat();
            
            return true;
        } catch (error) {
            this.log(`Failed to start WebSocket server: ${error.message}`, 'error');
            return false;
        }
    }
    
    verifyClient(info) {
        try {
            const query = url.parse(info.req.url, true).query;
            const token = query.token;
            
            if (!token) {
                this.log('WebSocket connection rejected: No token provided', 'warn');
                return false;
            }
            
            // Verify JWT token
            const decoded = jwt.verify(token, this.jwtSecret);
            info.req.user = decoded;
            
            return true;
        } catch (error) {
            this.log(`WebSocket auth failed: ${error.message}`, 'warn');
            return false;
        }
    }
    
    handleConnection(ws, req) {
        const user = req.user;
        const clientId = this.generateClientId();
        
        // Store client info
        const clientInfo = {
            id: clientId,
            ws: ws,
            user: user,
            rooms: new Set(),
            lastHeartbeat: Date.now(),
            connectedAt: Date.now()
        };
        
        this.clients.set(clientId, clientInfo);
        
        // Setup client event handlers
        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('close', () => this.handleDisconnection(clientId));
        ws.on('error', (error) => this.handleClientError(clientId, error));
        ws.on('pong', () => this.handlePong(clientId));
        
        // Join user to their default room
        this.joinRoom(clientId, `user_${user.uid}`);
        this.joinRoom(clientId, `role_${user.role || 'viewer'}`);
        
        // Send welcome message
        this.sendToClient(clientId, {
            type: 'connection_established',
            data: {
                clientId,
                serverTime: Date.now(),
                permissions: this.getUserPermissions(user.role)
            }
        });
        
        this.log(`Client connected: ${user.email} (${user.role}) - ID: ${clientId}`);
        this.emit('client_connected', { clientId, user });
    }
    
    handleMessage(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client) return;
            
            const message = JSON.parse(data);
            client.lastHeartbeat = Date.now();
            
            switch (message.type) {
                case 'heartbeat':
                    this.sendToClient(clientId, { type: 'heartbeat_ack', timestamp: Date.now() });
                    break;
                    
                case 'join_room':
                    this.joinRoom(clientId, message.room);
                    break;
                    
                case 'leave_room':
                    this.leaveRoom(clientId, message.room);
                    break;
                    
                case 'subscribe':
                    this.handleSubscription(clientId, message.data);
                    break;
                    
                case 'user_action':
                    this.handleUserAction(clientId, message.data);
                    break;
                    
                case 'get_status':
                    this.sendSystemStatus(clientId);
                    break;
                    
                default:
                    this.log(`Unknown message type from client ${clientId}: ${message.type}`, 'warn');
            }
            
        } catch (error) {
            this.log(`Error handling message from client ${clientId}: ${error.message}`, 'error');
        }
    }
    
    handleUserAction(clientId, actionData) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        // Check permissions
        if (!this.hasPermission(client.user.role, 'user_action')) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { message: 'Insufficient permissions for this action' }
            });
            return;
        }
        
        // Emit user action for the main system to handle
        this.emit('user_action', {
            action: actionData.action,
            params: actionData.params,
            user: client.user,
            clientId
        });
        
        this.log(`User action: ${actionData.action} by ${client.user.email}`);
    }
    
    handleSubscription(clientId, subscriptionData) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        const { channels } = subscriptionData;
        
        // Subscribe to allowed channels based on user role
        channels.forEach(channel => {
            if (this.hasPermission(client.user.role, channel)) {
                this.joinRoom(clientId, `channel_${channel}`);
            }
        });
    }
    
    handleDisconnection(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            // Remove from all rooms
            client.rooms.forEach(room => {
                this.leaveRoom(clientId, room);
            });
            
            this.clients.delete(clientId);
            this.log(`Client disconnected: ${client.user.email} - ID: ${clientId}`);
            this.emit('client_disconnected', { clientId, user: client.user });
        }
    }
    
    handleClientError(clientId, error) {
        this.log(`Client error ${clientId}: ${error.message}`, 'error');
    }
    
    handleServerError(error) {
        this.log(`WebSocket server error: ${error.message}`, 'error');
        this.emit('server_error', error);
    }
    
    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastHeartbeat = Date.now();
        }
    }
    
    // Room management
    joinRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        
        this.rooms.get(roomName).add(clientId);
        client.rooms.add(roomName);
        
        this.sendToClient(clientId, {
            type: 'room_joined',
            data: { room: roomName }
        });
    }
    
    leaveRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName).delete(clientId);
            if (this.rooms.get(roomName).size === 0) {
                this.rooms.delete(roomName);
            }
        }
        
        client.rooms.delete(roomName);
        
        this.sendToClient(clientId, {
            type: 'room_left',
            data: { room: roomName }
        });
    }
    
    // Broadcasting methods
    broadcast(message, roomName = null) {
        if (roomName) {
            this.broadcastToRoom(roomName, message);
        } else {
            this.broadcastToAll(message);
        }
    }
    
    broadcastToAll(message) {
        this.clients.forEach((client, clientId) => {
            if (this.hasPermission(client.user.role, message.type)) {
                this.sendToClient(clientId, message);
            }
        });
    }
    
    broadcastToRoom(roomName, message) {
        const room = this.rooms.get(roomName);
        if (!room) return;
        
        room.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client && this.hasPermission(client.user.role, message.type)) {
                this.sendToClient(clientId, message);
            }
        });
    }
    
    broadcastToRole(role, message) {
        this.broadcastToRoom(`role_${role}`, message);
    }
    
    sendToUser(userId, message) {
        this.broadcastToRoom(`user_${userId}`, message);
    }
    
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            client.ws.send(JSON.stringify({
                ...message,
                timestamp: Date.now()
            }));
            return true;
        } catch (error) {
            this.log(`Failed to send message to client ${clientId}: ${error.message}`, 'error');
            return false;
        }
    }
    
    // Trading event handlers
    onTradeUpdate(tradeData) {
        this.broadcast({
            type: this.messageTypes.TRADE_UPDATE,
            data: tradeData
        });
    }
    
    onBalanceUpdate(balanceData) {
        this.broadcast({
            type: this.messageTypes.BALANCE_UPDATE,
            data: balanceData
        });
    }
    
    onStrategyUpdate(strategyData) {
        this.broadcast({
            type: this.messageTypes.STRATEGY_UPDATE,
            data: strategyData
        });
    }
    
    onVoiceMessage(voiceData) {
        this.broadcast({
            type: this.messageTypes.VOICE_MESSAGE,
            data: voiceData
        });
    }
    
    onRiskAlert(riskData) {
        this.broadcast({
            type: this.messageTypes.RISK_ALERT,
            data: riskData
        }, 'channel_risk_alerts');
    }
    
    onGoalUpdate(goalData) {
        this.broadcast({
            type: this.messageTypes.GOAL_UPDATE,
            data: goalData
        });
    }
    
    onPerformanceUpdate(performanceData) {
        this.broadcast({
            type: this.messageTypes.PERFORMANCE_DATA,
            data: performanceData
        });
    }
    
    // System status
    sendSystemStatus(clientId = null) {
        const status = {
            timestamp: Date.now(),
            connectedClients: this.clients.size,
            activeRooms: this.rooms.size,
            uptime: Date.now() - this.startTime
        };
        
        const message = {
            type: this.messageTypes.SYSTEM_STATUS,
            data: status
        };
        
        if (clientId) {
            this.sendToClient(clientId, message);
        } else {
            this.broadcast(message);
        }
    }
    
    // Heartbeat mechanism
    startHeartbeat() {
        this.startTime = Date.now();
        
        setInterval(() => {
            const now = Date.now();
            const deadClients = [];
            
            this.clients.forEach((client, clientId) => {
                // Check if client is still alive (30 seconds timeout)
                if (now - client.lastHeartbeat > 30000) {
                    deadClients.push(clientId);
                } else {
                    // Send ping
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.ping();
                    }
                }
            });
            
            // Remove dead clients
            deadClients.forEach(clientId => {
                this.handleDisconnection(clientId);
            });
            
        }, 10000); // Check every 10 seconds
    }
    
    // Permission management
    hasPermission(userRole, messageType) {
        const permissions = this.userPermissions[userRole] || this.userPermissions.VIEWER;
        return permissions.includes('all') || permissions.includes(messageType);
    }
    
    getUserPermissions(userRole) {
        return this.userPermissions[userRole] || this.userPermissions.VIEWER;
    }
    
    // Utility methods
    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    getStats() {
        return {
            connectedClients: this.clients.size,
            activeRooms: this.rooms.size,
            uptime: Date.now() - (this.startTime || Date.now()),
            messagesSent: this.messagesSent || 0,
            port: this.port
        };
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [WebSocketServer] [${level.toUpperCase()}] ${message}`);
        
        this.emit('log', { timestamp, level, message, component: 'WebSocketServer' });
    }
    
    // Graceful shutdown
    async shutdown() {
        this.log('Shutting down WebSocket server...');
        
        // Notify all clients
        this.broadcastToAll({
            type: 'server_shutdown',
            data: { message: 'Server is shutting down' }
        });
        
        // Close all client connections
        this.clients.forEach((client, clientId) => {
            client.ws.close(1000, 'Server shutdown');
        });
        
        // Close server
        if (this.server) {
            this.server.close();
        }
        
        this.log('WebSocket server shutdown complete');
    }
}

module.exports = BayneXWebSocketServer;
