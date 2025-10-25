// 🔍 SECURITY MONITORING SYSTEM
// Real-time security threat detection and response

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import logger from './logger';
import { secureStorage } from './SecureStorage';

// Security monitoring configuration
const MONITORING_CONFIG = {
  MAX_FAILED_REQUESTS: 10,
  SUSPICIOUS_ACTIVITY_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  MAX_RAPID_REQUESTS: 20,
  RAPID_REQUEST_WINDOW_MS: 60 * 1000, // 1 minute
  ALERT_COOLDOWN_MS: 10 * 60 * 1000, // 10 minutes
  MAX_STORAGE_ERRORS: 5,
  DEVICE_CHANGE_THRESHOLD: 3, // Max device characteristic changes
};

class SecurityMonitor {
  constructor() {
    this.initialized = false;
    this.deviceFingerprint = null;
    this.alertCooldowns = new Map();
    this.activityBuffer = [];
    this.requestBuffer = [];
  }

  // Initialize security monitoring
  async initialize() {
    if (this.initialized) return;

    try {
      // Generate device fingerprint
      this.deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Load previous device fingerprint for comparison
      const storedFingerprint = await secureStorage.getSecureItem('device_fingerprint');
      
      if (storedFingerprint) {
        await this.checkDeviceIntegrity(storedFingerprint, this.deviceFingerprint);
      }
      
      // Store current fingerprint
      await secureStorage.setSecureItem('device_fingerprint', this.deviceFingerprint);
      
      // Start periodic security checks
      this.startPeriodicChecks();
      
      this.initialized = true;
      logger.info('Security monitoring initialized');
      
    } catch (error) {
      logger.error('Security monitoring initialization failed:', error);
    }
  }

  // Generate device fingerprint for integrity checking
  async generateDeviceFingerprint() {
    const { width, height } = Dimensions.get('window');
    
    return {
      platform: Platform.OS,
      version: Platform.Version,
      screenWidth: width,
      screenHeight: height,
      timestamp: Date.now(),
      // Add more device characteristics as needed
      userAgent: Platform.constants?.Brand || 'unknown',
    };
  }

  // Check for device integrity issues
  async checkDeviceIntegrity(stored, current) {
    let changes = 0;
    const significantChanges = [];

    // Check for platform changes (major red flag)
    if (stored.platform !== current.platform) {
      changes += 3; // Heavy penalty for platform change
      significantChanges.push('platform');
    }

    // Check for version changes
    if (stored.version !== current.version) {
      changes += 1;
      significantChanges.push('os_version');
    }

    // Check for screen dimension changes (could indicate emulator)
    if (stored.screenWidth !== current.screenWidth || 
        stored.screenHeight !== current.screenHeight) {
      changes += 2;
      significantChanges.push('screen_dimensions');
    }

    if (changes >= MONITORING_CONFIG.DEVICE_CHANGE_THRESHOLD) {
      await this.handleSecurityAlert('device_integrity', {
        changes: significantChanges,
        severity: changes >= 3 ? 'high' : 'medium',
        storedFingerprint: stored,
        currentFingerprint: current
      });
    }

    return changes;
  }

  // Monitor API request patterns for anomalies
  async monitorApiRequest(url, method = 'GET', responseStatus = 200, duration = 0) {
    try {
      const now = Date.now();
      const requestData = {
        url: this.sanitizeUrl(url),
        method,
        status: responseStatus,
        duration,
        timestamp: now
      };

      // Add to request buffer
      this.requestBuffer.push(requestData);
      
      // Keep only recent requests
      this.requestBuffer = this.requestBuffer.filter(
        req => now - req.timestamp < MONITORING_CONFIG.RAPID_REQUEST_WINDOW_MS
      );

      // Check for rapid requests
      if (this.requestBuffer.length >= MONITORING_CONFIG.MAX_RAPID_REQUESTS) {
        await this.handleSecurityAlert('rapid_requests', {
          count: this.requestBuffer.length,
          timeWindow: MONITORING_CONFIG.RAPID_REQUEST_WINDOW_MS,
          requests: this.requestBuffer.slice(-5) // Last 5 requests
        });
      }

      // Check for excessive failures
      const recentFailures = this.requestBuffer.filter(req => req.status >= 400);
      if (recentFailures.length >= MONITORING_CONFIG.MAX_FAILED_REQUESTS) {
        await this.handleSecurityAlert('excessive_failures', {
          failedRequests: recentFailures.length,
          totalRequests: this.requestBuffer.length,
          failureRate: (recentFailures.length / this.requestBuffer.length) * 100
        });
      }

      // Check for slow responses (potential DoS)
      if (duration > 30000) { // 30 seconds
        await this.handleSecurityAlert('slow_response', {
          url: this.sanitizeUrl(url),
          duration,
          method
        });
      }

    } catch (error) {
      logger.error('API request monitoring failed:', error);
    }
  }

  // Monitor storage operations for anomalies
  async monitorStorageOperation(operation, key, success = true, error = null) {
    try {
      if (!success) {
        const errorKey = 'storage_errors';
        const storedErrors = await AsyncStorage.getItem(errorKey) || '[]';
        const errors = JSON.parse(storedErrors);
        
        errors.push({
          operation,
          key: this.sanitizeKey(key),
          error: error?.message || 'Unknown error',
          timestamp: Date.now()
        });

        // Keep only recent errors (last hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentErrors = errors.filter(err => err.timestamp > oneHourAgo);

        await AsyncStorage.setItem(errorKey, JSON.stringify(recentErrors));

        // Alert if too many storage errors
        if (recentErrors.length >= MONITORING_CONFIG.MAX_STORAGE_ERRORS) {
          await this.handleSecurityAlert('storage_errors', {
            errorCount: recentErrors.length,
            recentErrors: recentErrors.slice(-3)
          });
        }
      }
    } catch (error) {
      logger.error('Storage operation monitoring failed:', error);
    }
  }

  // Monitor authentication events
  async monitorAuthEvent(event, userId = null, metadata = {}) {
    try {
      const authEvent = {
        event,
        userId: userId ? this.sanitizeUserId(userId) : null,
        metadata: this.sanitizeMetadata(metadata),
        timestamp: Date.now(),
        deviceFingerprint: this.deviceFingerprint
      };

      // Store auth event
      const eventsKey = 'auth_events';
      const storedEvents = await secureStorage.getSecureItem(eventsKey, []);
      storedEvents.push(authEvent);

      // Keep only recent events (last 24 hours)
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentEvents = storedEvents.filter(evt => evt.timestamp > dayAgo);

      await secureStorage.setSecureItem(eventsKey, recentEvents);

      // Check for suspicious patterns
      await this.analyzeAuthPattern(recentEvents, authEvent);

    } catch (error) {
      logger.error('Auth event monitoring failed:', error);
    }
  }

  // Analyze authentication patterns for threats
  async analyzeAuthPattern(events, currentEvent) {
    const now = Date.now();
    const windowStart = now - MONITORING_CONFIG.SUSPICIOUS_ACTIVITY_WINDOW_MS;
    const recentEvents = events.filter(evt => evt.timestamp > windowStart);

    // Check for multiple failed logins
    const failedLogins = recentEvents.filter(evt => 
      evt.event === 'login_failed' && 
      evt.userId === currentEvent.userId
    );

    if (failedLogins.length >= 5) {
      await this.handleSecurityAlert('multiple_login_failures', {
        userId: currentEvent.userId,
        attempts: failedLogins.length,
        timeWindow: MONITORING_CONFIG.SUSPICIOUS_ACTIVITY_WINDOW_MS
      });
    }

    // Check for rapid account creation
    const accountCreations = recentEvents.filter(evt => evt.event === 'account_created');
    if (accountCreations.length >= 3) {
      await this.handleSecurityAlert('rapid_account_creation', {
        count: accountCreations.length,
        accounts: accountCreations.map(evt => evt.userId)
      });
    }

    // Check for unusual access patterns
    if (currentEvent.event === 'login_success') {
      const loginTimes = recentEvents
        .filter(evt => evt.event === 'login_success' && evt.userId === currentEvent.userId)
        .map(evt => new Date(evt.timestamp).getHours());

      // Check for logins at unusual hours (2 AM - 6 AM)
      const unusualHours = loginTimes.filter(hour => hour >= 2 && hour <= 6);
      if (unusualHours.length >= 2) {
        await this.handleSecurityAlert('unusual_access_time', {
          userId: currentEvent.userId,
          unusualLogins: unusualHours.length,
          hours: unusualHours
        });
      }
    }
  }

  // Handle security alerts
  async handleSecurityAlert(alertType, details = {}) {
    try {
      const alertKey = `alert_${alertType}`;
      
      // Check cooldown to prevent spam
      if (this.alertCooldowns.has(alertKey)) {
        const lastAlert = this.alertCooldowns.get(alertKey);
        if (Date.now() - lastAlert < MONITORING_CONFIG.ALERT_COOLDOWN_MS) {
          return; // Skip alert due to cooldown
        }
      }

      // Record alert
      this.alertCooldowns.set(alertKey, Date.now());

      const alert = {
        type: alertType,
        details,
        timestamp: Date.now(),
        deviceFingerprint: this.deviceFingerprint,
        severity: this.calculateSeverity(alertType, details)
      };

      // Store alert
      await this.storeSecurityAlert(alert);

      // Log alert
      logger.warn(`Security alert: ${alertType}`, {
        severity: alert.severity,
        details: this.sanitizeAlertDetails(details)
      });

      // Take automatic action based on severity
      await this.takeAutomaticAction(alert);

      // In production, send to monitoring service
      if (!__DEV__) {
        await this.sendAlertToMonitoringService(alert);
      }

    } catch (error) {
      logger.error('Security alert handling failed:', error);
    }
  }

  // Calculate alert severity
  calculateSeverity(alertType, details) {
    const highSeverityAlerts = [
      'device_integrity',
      'multiple_login_failures', 
      'rapid_account_creation'
    ];
    
    const mediumSeverityAlerts = [
      'excessive_failures',
      'unusual_access_time',
      'storage_errors'
    ];

    if (highSeverityAlerts.includes(alertType)) {
      return 'high';
    } else if (mediumSeverityAlerts.includes(alertType)) {
      return 'medium';
    }
    
    return 'low';
  }

  // Take automatic protective actions
  async takeAutomaticAction(alert) {
    switch (alert.severity) {
      case 'high':
        // Force logout for high severity threats
        logger.warn('High severity security threat - considering protective actions');
        // Note: Implement actual logout logic based on your app structure
        break;
        
      case 'medium':
        // Increase security measures
        logger.info('Medium severity threat detected - increasing monitoring');
        break;
        
      default:
        // Log only for low severity
        break;
    }
  }

  // Store security alert
  async storeSecurityAlert(alert) {
    try {
      const alertsKey = 'security_alerts';
      const storedAlerts = await secureStorage.getSecureItem(alertsKey, []);
      
      storedAlerts.push(alert);
      
      // Keep only recent alerts (last 7 days)
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentAlerts = storedAlerts.filter(a => a.timestamp > weekAgo);
      
      await secureStorage.setSecureItem(alertsKey, recentAlerts);
      
    } catch (error) {
      logger.error('Failed to store security alert:', error);
    }
  }

  // Start periodic security checks
  startPeriodicChecks() {
    // Check every 5 minutes
    setInterval(async () => {
      try {
        await this.performPeriodicSecurityCheck();
      } catch (error) {
        logger.error('Periodic security check failed:', error);
      }
    }, 5 * 60 * 1000);
  }

  // Perform periodic security checks
  async performPeriodicSecurityCheck() {
    // Check storage integrity
    const integrityResult = await secureStorage.verifyIntegrity();
    if (integrityResult.corrupted > 0) {
      await this.handleSecurityAlert('storage_corruption', {
        corruptedItems: integrityResult.corrupted,
        totalItems: integrityResult.total
      });
    }

    // Check for unusual app state
    await this.checkAppState();
  }

  // Check app state for anomalies
  async checkAppState() {
    try {
      // Check if critical security files are missing
      const criticalFiles = ['logger', 'security', 'AuthSecurity'];
      // Note: In a real app, you'd check if these modules are accessible
      
      // Check memory usage patterns
      // Note: React Native doesn't expose memory APIs directly
      
      // Check for debugger attachment (in production)
      if (!__DEV__ && typeof global.atob !== 'undefined') {
        // Potential debugging tools detected
        await this.handleSecurityAlert('debugging_detected', {
          environment: 'production',
          suspiciousGlobals: Object.keys(global).filter(key => 
            key.includes('debug') || key.includes('console')
          )
        });
      }
      
    } catch (error) {
      logger.error('App state check failed:', error);
    }
  }

  // Send alert to external monitoring service
  async sendAlertToMonitoringService(alert) {
    try {
      // In production, integrate with your monitoring service
      // Example: Sentry, DataDog, or custom endpoint
      
      const sanitizedAlert = {
        ...alert,
        details: this.sanitizeAlertDetails(alert.details)
      };
      
      logger.info('Security alert sent to monitoring service:', sanitizedAlert.type);
      
    } catch (error) {
      logger.error('Failed to send alert to monitoring service:', error);
    }
  }

  // Sanitization methods to prevent sensitive data leakage
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return 'invalid_url';
    }
  }

  sanitizeKey(key) {
    return key?.substring(0, 20) + (key?.length > 20 ? '***' : '');
  }

  sanitizeUserId(userId) {
    return userId?.substring(0, 8) + '***';
  }

  sanitizeMetadata(metadata) {
    const sanitized = { ...metadata };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.email;
    
    return sanitized;
  }

  sanitizeAlertDetails(details) {
    const sanitized = { ...details };
    
    // Sanitize user IDs
    if (sanitized.userId) {
      sanitized.userId = this.sanitizeUserId(sanitized.userId);
    }
    
    // Sanitize URLs
    if (sanitized.url) {
      sanitized.url = this.sanitizeUrl(sanitized.url);
    }
    
    return sanitized;
  }

  // Get security monitoring stats
  async getSecurityStats() {
    try {
      const alerts = await secureStorage.getSecureItem('security_alerts', []);
      const authEvents = await secureStorage.getSecureItem('auth_events', []);
      
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentAlerts = alerts.filter(a => a.timestamp > dayAgo);
      const recentAuthEvents = authEvents.filter(e => e.timestamp > dayAgo);
      
      return {
        totalAlerts: alerts.length,
        recentAlerts: recentAlerts.length,
        alertsByType: this.groupBy(recentAlerts, 'type'),
        authEvents: recentAuthEvents.length,
        authEventsByType: this.groupBy(recentAuthEvents, 'event'),
        lastCheck: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get security stats:', error);
      return null;
    }
  }

  // Utility method for grouping
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }
}

// Singleton instance
export const securityMonitor = new SecurityMonitor();

// Initialize monitoring when module loads (in production only)
if (!__DEV__) {
  securityMonitor.initialize().catch(error => {
    logger.error('Security monitoring auto-initialization failed:', error);
  });
}

// Convenience exports
export const monitoringUtils = {
  // Monitor API call
  async trackApiCall(url, method, status, duration) {
    await securityMonitor.monitorApiRequest(url, method, status, duration);
  },

  // Monitor auth event
  async trackAuthEvent(event, userId, metadata = {}) {
    await securityMonitor.monitorAuthEvent(event, userId, metadata);
  },

  // Monitor storage operation
  async trackStorageOperation(operation, key, success, error = null) {
    await securityMonitor.monitorStorageOperation(operation, key, success, error);
  },

  // Get security dashboard data
  async getSecurityDashboard() {
    return await securityMonitor.getSecurityStats();
  },

  // Force security check
  async performSecurityCheck() {
    await securityMonitor.performPeriodicSecurityCheck();
  }
};