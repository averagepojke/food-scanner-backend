// 🔐 ENHANCED AUTHENTICATION SECURITY
// Advanced authentication features for production security

import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth } from './food-scanner-app/firebase';
import logger from './logger';

// Security configuration
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  SUSPICIOUS_ACTIVITY_THRESHOLD: 3,
};

class AuthSecurityManager {
  constructor() {
    this.sessionCheckInterval = null;
    this.lastActivityTime = Date.now();
  }

  // Initialize security features
  initialize() {
    this.startSessionMonitoring();
    this.setupInactivityDetection();
    logger.info('Authentication security manager initialized');
  }

  // Session timeout monitoring
  startSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    this.sessionCheckInterval = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        await this.checkSessionValidity();
      }
    }, 60 * 1000); // Check every minute
  }

  async checkSessionValidity() {
    try {
      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      const sessionStart = await AsyncStorage.getItem('sessionStartTime');
      
      if (!lastActivity || !sessionStart) {
        await this.updateActivityTime();
        return;
      }

      const now = Date.now();
      const timeSinceActivity = now - parseInt(lastActivity);
      const sessionDuration = now - parseInt(sessionStart);

      // Force logout if session expired or inactive too long
      if (sessionDuration > SECURITY_CONFIG.SESSION_TIMEOUT_MS) {
        logger.warn('Session expired - forcing logout');
        await this.forceLogout('Session expired');
      } else if (timeSinceActivity > (30 * 60 * 1000)) { // 30 minutes of inactivity
        logger.info('User inactive - logging out');
        await this.forceLogout('Inactivity timeout');
      }
    } catch (error) {
      logger.error('Session validity check failed:', error);
    }
  }

  // Track user activity to prevent inactivity timeout
  async updateActivityTime() {
    this.lastActivityTime = Date.now();
    try {
      await AsyncStorage.setItem('lastActivityTime', this.lastActivityTime.toString());
    } catch (error) {
      logger.error('Failed to update activity time:', error);
    }
  }

  // Start new session
  async startSession(userId) {
    const now = Date.now();
    try {
      await Promise.all([
        AsyncStorage.setItem('sessionStartTime', now.toString()),
        AsyncStorage.setItem('lastActivityTime', now.toString()),
        AsyncStorage.removeItem(`loginAttempts_${userId}`),
        AsyncStorage.removeItem(`lockoutTime_${userId}`)
      ]);
      logger.info('New secure session started');
    } catch (error) {
      logger.error('Failed to start session:', error);
    }
  }

  // Failed login attempt tracking
  async recordFailedLogin(identifier) {
    try {
      const key = `loginAttempts_${identifier}`;
      const lockoutKey = `lockoutTime_${identifier}`;
      
      // Check if currently locked out
      const lockoutTime = await AsyncStorage.getItem(lockoutKey);
      if (lockoutTime) {
        const timeRemaining = parseInt(lockoutTime) - Date.now();
        if (timeRemaining > 0) {
          const minutesRemaining = Math.ceil(timeRemaining / 60000);
          throw new Error(`Account temporarily locked. Try again in ${minutesRemaining} minutes.`);
        } else {
          // Lockout expired, clear it
          await AsyncStorage.removeItem(lockoutKey);
          await AsyncStorage.removeItem(key);
        }
      }

      // Increment failed attempts
      const attemptsStr = await AsyncStorage.getItem(key) || '0';
      const attempts = parseInt(attemptsStr) + 1;
      await AsyncStorage.setItem(key, attempts.toString());

      logger.warn(`Failed login attempt ${attempts} for identifier: ${identifier.substring(0, 3)}***`);

      // Lock account if too many attempts
      if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS;
        await AsyncStorage.setItem(lockoutKey, lockoutUntil.toString());
        
        logger.error(`Account locked due to too many failed attempts: ${identifier.substring(0, 3)}***`);
        throw new Error(`Too many failed login attempts. Account locked for ${SECURITY_CONFIG.LOCKOUT_DURATION_MS / 60000} minutes.`);
      }

      return {
        attemptsRemaining: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts,
        message: `Invalid credentials. ${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts} attempts remaining.`
      };

    } catch (error) {
      if (error.message.includes('locked') || error.message.includes('attempts')) {
        throw error;
      }
      logger.error('Failed to record login attempt:', error);
      throw new Error('Authentication service temporarily unavailable');
    }
  }

  // Check if account is locked
  async isAccountLocked(identifier) {
    try {
      const lockoutKey = `lockoutTime_${identifier}`;
      const lockoutTime = await AsyncStorage.getItem(lockoutKey);
      
      if (!lockoutTime) return false;
      
      const timeRemaining = parseInt(lockoutTime) - Date.now();
      if (timeRemaining > 0) {
        return {
          locked: true,
          minutesRemaining: Math.ceil(timeRemaining / 60000)
        };
      } else {
        // Lockout expired
        await AsyncStorage.removeItem(lockoutKey);
        await AsyncStorage.removeItem(`loginAttempts_${identifier}`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to check account lock status:', error);
      return false;
    }
  }

  // Clear failed attempts on successful login
  async clearFailedAttempts(identifier) {
    try {
      await Promise.all([
        AsyncStorage.removeItem(`loginAttempts_${identifier}`),
        AsyncStorage.removeItem(`lockoutTime_${identifier}`)
      ]);
    } catch (error) {
      logger.error('Failed to clear failed attempts:', error);
    }
  }

  // Password reset rate limiting
  async checkPasswordResetCooldown(email) {
    try {
      const key = `passwordReset_${email}`;
      const lastResetTime = await AsyncStorage.getItem(key);
      
      if (lastResetTime) {
        const timeSinceReset = Date.now() - parseInt(lastResetTime);
        if (timeSinceReset < SECURITY_CONFIG.PASSWORD_RESET_COOLDOWN_MS) {
          const minutesRemaining = Math.ceil((SECURITY_CONFIG.PASSWORD_RESET_COOLDOWN_MS - timeSinceReset) / 60000);
          throw new Error(`Please wait ${minutesRemaining} minutes before requesting another password reset.`);
        }
      }

      // Record this reset attempt
      await AsyncStorage.setItem(key, Date.now().toString());
      return true;
    } catch (error) {
      if (error.message.includes('wait')) {
        throw error;
      }
      logger.error('Password reset cooldown check failed:', error);
      return true; // Allow reset on error to not block legitimate users
    }
  }

  // Force logout with reason
  async forceLogout(reason = 'Security logout') {
    try {
      logger.info('Forcing logout:', reason);
      
      // Clear session data
      await Promise.all([
        AsyncStorage.removeItem('sessionStartTime'),
        AsyncStorage.removeItem('lastActivityTime'),
        signOut(auth)
      ]);

      // Clear intervals
      if (this.sessionCheckInterval) {
        clearInterval(this.sessionCheckInterval);
        this.sessionCheckInterval = null;
      }

      // Navigate to login screen (you'll need to implement this based on your navigation setup)
      // navigationRef.navigate('Login');

    } catch (error) {
      logger.error('Force logout failed:', error);
    }
  }

  // Detect suspicious activity patterns
  async detectSuspiciousActivity(userId, activityType, metadata = {}) {
    try {
      const key = `suspicious_${userId}_${activityType}`;
      const countKey = `suspicious_count_${userId}`;
      
      // Record this activity
      const activities = await AsyncStorage.getItem(key) || '[]';
      const parsedActivities = JSON.parse(activities);
      
      const newActivity = {
        timestamp: Date.now(),
        type: activityType,
        metadata: {
          userAgent: metadata.userAgent || 'unknown',
          ip: metadata.ip || 'unknown'
        }
      };
      
      parsedActivities.push(newActivity);
      
      // Keep only recent activities (last hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentActivities = parsedActivities.filter(activity => activity.timestamp > oneHourAgo);
      
      await AsyncStorage.setItem(key, JSON.stringify(recentActivities));
      
      // Check if this is suspicious
      if (recentActivities.length >= SECURITY_CONFIG.SUSPICIOUS_ACTIVITY_THRESHOLD) {
        logger.warn(`Suspicious activity detected for user: ${activityType}`, {
          userId: userId.substring(0, 8) + '***',
          count: recentActivities.length,
          type: activityType
        });
        
        // Increment suspicious activity counter
        const suspiciousCount = parseInt(await AsyncStorage.getItem(countKey) || '0') + 1;
        await AsyncStorage.setItem(countKey, suspiciousCount.toString());
        
        // Force logout after multiple suspicious activities
        if (suspiciousCount >= 3) {
          await this.forceLogout('Suspicious activity detected');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Suspicious activity detection failed:', error);
      return false;
    }
  }

  // Setup inactivity detection
  setupInactivityDetection() {
    // This would typically be integrated with your app's touch/gesture handlers
    // For now, we'll just update activity time when the app becomes active
    // You can extend this to track actual user interactions
    const updateActivity = () => this.updateActivityTime();
    
    // React Native AppState can be used to detect when app becomes active
    // AppState.addEventListener('change', (nextAppState) => {
    //   if (nextAppState === 'active') {
    //     updateActivity();
    //   }
    // });
  }

  // Cleanup on logout
  cleanup() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
}

// Singleton instance
export const authSecurity = new AuthSecurityManager();

// Enhanced authentication wrapper
export const secureAuth = {
  async signIn(email, password, signInFunction) {
    // Check if account is locked
    const lockStatus = await authSecurity.isAccountLocked(email);
    if (lockStatus && lockStatus.locked) {
      throw new Error(`Account locked. Try again in ${lockStatus.minutesRemaining} minutes.`);
    }

    try {
      // Attempt sign in
      const result = await signInFunction(email, password);
      
      // Success - clear failed attempts and start session
      await authSecurity.clearFailedAttempts(email);
      await authSecurity.startSession(result.user.uid);
      
      logger.info('Secure sign in successful');
      return result;
      
    } catch (error) {
      // Record failed attempt
      const attemptResult = await authSecurity.recordFailedLogin(email);
      
      // Throw enhanced error with attempt info
      if (attemptResult && !error.message.includes('locked')) {
        error.message = attemptResult.message;
      }
      
      throw error;
    }
  },

  async signOut() {
    try {
      const user = auth.currentUser;
      if (user) {
        await authSecurity.forceLogout('User logout');
      }
    } catch (error) {
      logger.error('Secure sign out failed:', error);
      throw error;
    }
  }
};

// Initialize on import
if (!__DEV__) {
  // Only enable in production to avoid development issues
  authSecurity.initialize();
}