// src/web/dashboard/js/firebase-config.js

// Firebase Configuration for BAYNEX.A.X
const firebaseConfig = {
    // Replace with your actual Firebase config
    apiKey: "your-api-key",
    authDomain: "baynex-ax.firebaseapp.com",
    projectId: "baynex-ax",
    storageBucket: "baynex-ax.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdefghijklmnop"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Auth instance
const auth = firebase.auth();

class BayneXFirebaseAuth {
    constructor() {
        this.auth = auth;
        this.currentUser = null;
        this.onAuthStateChanged = this.onAuthStateChanged.bind(this);
        
        // Setup auth state listener
        this.auth.onAuthStateChanged(this.onAuthStateChanged);
    }
    
    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            this.currentUser = userCredential.user;
            
            // Get user token for WebSocket authentication
            const token = await this.currentUser.getIdToken();
            
            return {
                success: true,
                user: this.currentUser,
                token: token
            };
        } catch (error) {
            console.error('Sign in error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }
    
    // Sign out
    async signOut() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return {
                success: false,
                error: 'Failed to sign out'
            };
        }
    }
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Get user token
    async getUserToken() {
        if (this.currentUser) {
            try {
                return await this.currentUser.getIdToken();
            } catch (error) {
                console.error('Token error:', error);
                return null;
            }
        }
        return null;
    }
    
    // Get user info
    getUserInfo() {
        if (this.currentUser) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || this.currentUser.email,
                emailVerified: this.currentUser.emailVerified,
                role: this.getUserRole() // This would come from custom claims or Firestore
            };
        }
        return null;
    }
    
    // Get user role (placeholder - implement based on your role system)
    getUserRole() {
        // This should be implemented based on your role management system
        // Could come from custom claims, Firestore, or your backend
        
        // For demo purposes, assign roles based on email patterns
        if (this.currentUser) {
            const email = this.currentUser.email.toLowerCase();
            
            if (email.includes('admin')) {
                return 'ADMIN';
            } else if (email.includes('manager')) {
                return 'MANAGER';
            } else if (email.includes('trader')) {
                return 'TRADER';
            } else {
                return 'VIEWER';
            }
        }
        
        return 'VIEWER';
    }
    
    // Auth state change handler
    onAuthStateChanged(user) {
        this.currentUser = user;
        
        if (user) {
            console.log('User signed in:', user.email);
            // Emit custom event for the dashboard
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: user, signedIn: true }
            }));
        } else {
            console.log('User signed out');
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: null, signedIn: false }
            }));
        }
    }
    
    // Error message helper
    getErrorMessage(errorCode) {
// src/web/dashboard/js/firebase-config.js

// Firebase Configuration for BAYNEX.A.X
const firebaseConfig = {
    // Replace with your actual Firebase config
    apiKey: "your-api-key",
    authDomain: "baynex-ax.firebaseapp.com",
    projectId: "baynex-ax",
    storageBucket: "baynex-ax.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdefghijklmnop"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Auth instance
const auth = firebase.auth();

class BayneXFirebaseAuth {
    constructor() {
        this.auth = auth;
        this.currentUser = null;
        this.onAuthStateChanged = this.onAuthStateChanged.bind(this);
        
        // Setup auth state listener
        this.auth.onAuthStateChanged(this.onAuthStateChanged);
    }
    
    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            this.currentUser = userCredential.user;
            
            // Get user token for WebSocket authentication
            const token = await this.currentUser.getIdToken();
            
            return {
                success: true,
                user: this.currentUser,
                token: token
            };
        } catch (error) {
            console.error('Sign in error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }
    
    // Sign out
    async signOut() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return {
                success: false,
                error: 'Failed to sign out'
            };
        }
    }
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Get user token
    async getUserToken() {
        if (this.currentUser) {
            try {
                return await this.currentUser.getIdToken();
            } catch (error) {
                console.error('Token error:', error);
                return null;
            }
        }
        return null;
    }
    
    // Get user info
    getUserInfo() {
        if (this.currentUser) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || this.currentUser.email,
                emailVerified: this.currentUser.emailVerified,
                role: this.getUserRole() // This would come from custom claims or Firestore
            };
        }
        return null;
    }
    
    // Get user role (placeholder - implement based on your role system)
    getUserRole() {
        // This should be implemented based on your role management system
        // Could come from custom claims, Firestore, or your backend
        
        // For demo purposes, assign roles based on email patterns
        if (this.currentUser) {
            const email = this.currentUser.email.toLowerCase();
            
            if (email.includes('admin')) {
                return 'ADMIN';
            } else if (email.includes('manager')) {
                return 'MANAGER';
            } else if (email.includes('trader')) {
                return 'TRADER';
            } else {
                return 'VIEWER';
            }
        }
        
        return 'VIEWER';
    }
    
    // Auth state change handler
    onAuthStateChanged(user) {
        this.currentUser = user;
        
        if (user) {
            console.log('User signed in:', user.email);
            // Emit custom event for the dashboard
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: user, signedIn: true }
            }));
        } else {
            console.log('User signed out');
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: null, signedIn: false }
            }));
        }
    }
    
    // Error message helper
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email address.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-email': 'Invalid email address format.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/requires-recent-login': 'Please sign in again to complete this action.'
        };
        
        return errorMessages[errorCode] || 'An error occurred during authentication.';
    }
    
    // Password reset
    async sendPasswordResetEmail(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }
    
    // Update profile
    async updateProfile(displayName) {
        if (this.currentUser) {
            try {
                await this.currentUser.updateProfile({ displayName });
                return { success: true };
            } catch (error) {
                console.error('Profile update error:', error);
                return {
                    success: false,
                    error: 'Failed to update profile'
                };
            }
        }
        return { success: false, error: 'No user signed in' };
    }
    
    // Check if user has specific permission
    hasPermission(permission) {
        const userRole = this.getUserRole();
        const rolePermissions = {
            ADMIN: ['all'],
            MANAGER: ['trade_control', 'view_performance', 'manage_strategies'],
            TRADER: ['trade_control', 'view_performance'],
            VIEWER: ['view_performance']
        };
        
        const permissions = rolePermissions[userRole] || [];
        return permissions.includes('all') || permissions.includes(permission);
    }
    
    // Refresh token
    async refreshToken() {
        if (this.currentUser) {
            try {
                await this.currentUser.getIdToken(true); // Force refresh
                return { success: true };
            } catch (error) {
                console.error('Token refresh error:', error);
                return { success: false };
            }
        }
        return { success: false };
    }
}

// Create global auth instance
window.bayneXAuth = new BayneXFirebaseAuth();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BayneXFirebaseAuth;
}
