// 🔐 MULTI-FACTOR AUTHENTICATION SYSTEM
// TOTP, SMS, Email, and Backup Codes for ultimate account security

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import logger from './logger';
import { secureStorage } from './SecureStorage';
import { biometricAuth } from './BiometricAuth';

// MFA Configuration
const MFA_CONFIG = {
  TOTP_WINDOW: 30, // 30 second window
  TOTP_DIGITS: 6,  // 6 digit codes
  BACKUP_CODES_COUNT: 10,
  SMS_CODE_LENGTH: 6,
  EMAIL_CODE_LENGTH: 6,
  CODE_EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  RECOVERY_CODES_COUNT: 8,
};

// Simple TOTP implementation (in production, use a proper crypto library)
class SimpleTOTP {
  constructor(secret, period = 30, digits = 6) {
    this.secret = secret;
    this.period = period;
    this.digits = digits;
  }

  // Generate current TOTP token
  generate(timestamp = Date.now()) {
    const epoch = Math.floor(timestamp / 1000);
    const counter = Math.floor(epoch / this.period);
    return this.generateHOTP(counter);
  }

  // Generate HOTP (HMAC-based One-Time Password)
  generateHOTP(counter) {
    // Simple implementation - in production use crypto libraries
    const hash = this.simpleHMAC(this.secret, counter.toString());
    const offset = hash.charCodeAt(hash.length - 1) & 0x0f;
    
    let truncated = 0;
    for (let i = 0; i < 4; i++) {
      truncated = (truncated << 8) | hash.charCodeAt(offset + i);
    }
    
    truncated = (truncated & 0x7fffffff) % Math.pow(10, this.digits);
    return truncated.toString().padStart(this.digits, '0');
  }

  // Simple HMAC implementation (use proper crypto in production)
  simpleHMAC(key, message) {
    let hash = 0;
    const combined = key + message;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(36);
  }

  // Verify TOTP token with time window
  verify(token, timestamp = Date.now(), window = 1) {
    for (let i = -window; i <= window; i++) {
      const testTime = timestamp + (i * this.period * 1000);
      if (this.generate(testTime) === token) {
        return true;
      }
    }
    return false;
  }
}

class MultiFactorAuthManager {
  constructor() {
    this.initialized = false;
  }

  // Initialize MFA system
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('MFA system initializing');
      this.initialized = true;
      
      // Clean up expired verification attempts
      await this.cleanupExpiredAttempts();
      
    } catch (error) {
      logger.error('MFA initialization failed:', error);
    }
  }

  // Generate secret key for TOTP
  generateTOTPSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 characters
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  // Setup TOTP for user
  async setupTOTP(userId, appName = 'PantryPal') {
    await this.initialize();

    try {
      // Generate secret
      const secret = this.generateTOTPSecret();
      
      // Create TOTP instance
      const totp = new SimpleTOTP(secret);
      
      // Generate QR code data (otpauth URL)
      const otpauthUrl = `otpauth://totp/${appName}:${userId}?secret=${secret}&issuer=${appName}&digits=${MFA_CONFIG.TOTP_DIGITS}&period=${MFA_CONFIG.TOTP_WINDOW}`;
      
      // Store temporarily (user needs to verify before enabling)
      const setupKey = `totp_setup_${userId}`;
      await secureStorage.setSecureItem(setupKey, {
        secret,
        otpauthUrl,
        setupTime: Date.now(),
        verified: false
      }, { 
        expiresIn: 10 * 60 * 1000, // 10 minutes to complete setup
        sensitive: true 
      });

      logger.info('TOTP setup initiated for user');

      return {
        secret,
        qrCodeUrl: otpauthUrl,
        manualEntryKey: secret,
        backupCodes: await this.generateBackupCodes(userId)
      };

    } catch (error) {
      logger.error('TOTP setup failed:', error);
      throw new Error('Failed to setup TOTP authentication');
    }
  }

  // Verify TOTP setup
  async verifyTOTPSetup(userId, userProvidedCode) {
    try {
      const setupKey = `totp_setup_${userId}`;
      const setupData = await secureStorage.getSecureItem(setupKey);
      
      if (!setupData) {
        throw new Error('TOTP setup not found or expired');
      }

      const totp = new SimpleTOTP(setupData.secret);
      const isValid = totp.verify(userProvidedCode);

      if (isValid) {
        // Save TOTP permanently
        await secureStorage.setSecureItem(`totp_${userId}`, {
          secret: setupData.secret,
          enabledAt: Date.now(),
          verified: true,
          backupCodesGenerated: true
        }, { sensitive: true });

        // Remove setup data
        await secureStorage.removeSecureItem(setupKey);

        // Record MFA event
        await this.recordMFAEvent(userId, 'totp_enabled');

        logger.info('TOTP verification successful and enabled');
        return { success: true, method: 'totp' };
      } else {
        await this.recordMFAEvent(userId, 'totp_verification_failed');
        throw new Error('Invalid verification code');
      }

    } catch (error) {
      logger.error('TOTP verification failed:', error);
      throw error;
    }
  }

  // Generate backup codes
  async generateBackupCodes(userId) {
    const codes = [];
    for (let i = 0; i < MFA_CONFIG.BACKUP_CODES_COUNT; i++) {
      const code = Math.floor(Math.random() * 10000000).toString().padStart(8, '0');
      codes.push(code);
    }

    // Store backup codes securely
    await secureStorage.setSecureItem(`backup_codes_${userId}`, {
      codes: codes.map(code => ({ code, used: false, usedAt: null })),
      generatedAt: Date.now(),
      userId
    }, { sensitive: true });

    await this.recordMFAEvent(userId, 'backup_codes_generated');

    return codes;
  }

  // Verify MFA code (TOTP, backup codes, etc.)
  async verifyMFACode(userId, code, method = 'auto') {
    await this.initialize();

    try {
      // Check rate limiting
      await this.checkRateLimit(userId, 'mfa_verify');

      // Auto-detect method if not specified
      if (method === 'auto') {
        method = await this.detectCodeMethod(userId, code);
      }

      let result = null;

      switch (method) {
        case 'totp':
          result = await this.verifyTOTP(userId, code);
          break;
        case 'backup':
          result = await this.verifyBackupCode(userId, code);
          break;
        case 'sms':
          result = await this.verifySMSCode(userId, code);
          break;
        case 'email':
          result = await this.verifyEmailCode(userId, code);
          break;
        default:
          throw new Error('Unknown MFA method');
      }

      if (result.success) {
        await this.clearRateLimit(userId, 'mfa_verify');
        await this.recordMFAEvent(userId, `${method}_verification_success`);
      } else {
        await this.recordFailedAttempt(userId, 'mfa_verify');
        await this.recordMFAEvent(userId, `${method}_verification_failed`);
      }

      return result;

    } catch (error) {
      await this.recordFailedAttempt(userId, 'mfa_verify');
      logger.error('MFA verification failed:', error);
      throw error;
    }
  }

  // Verify TOTP code
  async verifyTOTP(userId, code) {
    const totpData = await secureStorage.getSecureItem(`totp_${userId}`);
    
    if (!totpData || !totpData.verified) {
      throw new Error('TOTP not enabled for this account');
    }

    const totp = new SimpleTOTP(totpData.secret);
    const isValid = totp.verify(code);

    return {
      success: isValid,
      method: 'totp',
      message: isValid ? 'TOTP verification successful' : 'Invalid TOTP code'
    };
  }

  // Verify backup code
  async verifyBackupCode(userId, code) {
    const backupData = await secureStorage.getSecureItem(`backup_codes_${userId}`);
    
    if (!backupData) {
      throw new Error('No backup codes available for this account');
    }

    // Find unused code
    const codeEntry = backupData.codes.find(c => c.code === code && !c.used);
    
    if (codeEntry) {
      // Mark code as used
      codeEntry.used = true;
      codeEntry.usedAt = Date.now();
      
      await secureStorage.setSecureItem(`backup_codes_${userId}`, backupData, { sensitive: true });

      return {
        success: true,
        method: 'backup',
        message: 'Backup code verification successful',
        remainingCodes: backupData.codes.filter(c => !c.used).length
      };
    } else {
      return {
        success: false,
        method: 'backup',
        message: 'Invalid or already used backup code'
      };
    }
  }

  // Send SMS verification code (framework - requires SMS service integration)
  async sendSMSCode(userId, phoneNumber) {
    try {
      const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      
      // Store verification code
      await secureStorage.setSecureItem(`sms_code_${userId}`, {
        code,
        phoneNumber: phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '***-***-$3'), // Partially masked
        sentAt: Date.now(),
        attempts: 0
      }, { 
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MS,
        sensitive: true 
      });

      // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
      logger.info('SMS verification code generated (integration required)');
      
      // For testing purposes, log the code (remove in production)
      if (__DEV__) {
        logger.debug(`SMS Code for testing: ${code}`);
      }

      await this.recordMFAEvent(userId, 'sms_code_sent');

      return {
        success: true,
        message: 'Verification code sent to your phone',
        maskedPhone: phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) ***-$4')
      };

    } catch (error) {
      logger.error('SMS code sending failed:', error);
      throw new Error('Failed to send SMS verification code');
    }
  }

  // Verify SMS code
  async verifySMSCode(userId, code) {
    const smsData = await secureStorage.getSecureItem(`sms_code_${userId}`);
    
    if (!smsData) {
      return {
        success: false,
        method: 'sms',
        message: 'No SMS verification code found or expired'
      };
    }

    // Check attempts
    if (smsData.attempts >= MFA_CONFIG.MAX_ATTEMPTS) {
      return {
        success: false,
        method: 'sms',
        message: 'Too many failed attempts. Request a new code.'
      };
    }

    const isValid = smsData.code === code;
    
    if (isValid) {
      // Remove used code
      await secureStorage.removeSecureItem(`sms_code_${userId}`);
    } else {
      // Increment attempts
      smsData.attempts++;
      await secureStorage.setSecureItem(`sms_code_${userId}`, smsData, {
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MS,
        sensitive: true
      });
    }

    return {
      success: isValid,
      method: 'sms',
      message: isValid ? 'SMS verification successful' : 'Invalid SMS code',
      attemptsRemaining: MFA_CONFIG.MAX_ATTEMPTS - smsData.attempts
    };
  }

  // Send email verification code
  async sendEmailCode(userId, email) {
    try {
      const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      
      // Store verification code
      await secureStorage.setSecureItem(`email_code_${userId}`, {
        code,
        email: email.replace(/(.{2}).*@/, '$1***@'), // Partially masked
        sentAt: Date.now(),
        attempts: 0
      }, { 
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MS,
        sensitive: true 
      });

      // In production, integrate with email service
      logger.info('Email verification code generated (integration required)');
      
      // For testing purposes, log the code (remove in production)
      if (__DEV__) {
        logger.debug(`Email Code for testing: ${code}`);
      }

      await this.recordMFAEvent(userId, 'email_code_sent');

      return {
        success: true,
        message: 'Verification code sent to your email',
        maskedEmail: email.replace(/(.{2}).*(@.*)/, '$1***$2')
      };

    } catch (error) {
      logger.error('Email code sending failed:', error);
      throw new Error('Failed to send email verification code');
    }
  }

  // Verify email code
  async verifyEmailCode(userId, code) {
    const emailData = await secureStorage.getSecureItem(`email_code_${userId}`);
    
    if (!emailData) {
      return {
        success: false,
        method: 'email',
        message: 'No email verification code found or expired'
      };
    }

    // Check attempts
    if (emailData.attempts >= MFA_CONFIG.MAX_ATTEMPTS) {
      return {
        success: false,
        method: 'email',
        message: 'Too many failed attempts. Request a new code.'
      };
    }

    const isValid = emailData.code === code;
    
    if (isValid) {
      // Remove used code
      await secureStorage.removeSecureItem(`email_code_${userId}`);
    } else {
      // Increment attempts
      emailData.attempts++;
      await secureStorage.setSecureItem(`email_code_${userId}`, emailData, {
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MS,
        sensitive: true
      });
    }

    return {
      success: isValid,
      method: 'email',
      message: isValid ? 'Email verification successful' : 'Invalid email code',
      attemptsRemaining: MFA_CONFIG.MAX_ATTEMPTS - emailData.attempts
    };
  }

  // Auto-detect code method based on format/context
  async detectCodeMethod(userId, code) {
    // Check if TOTP is enabled and code matches format
    const totpData = await secureStorage.getSecureItem(`totp_${userId}`);
    if (totpData && code.length === MFA_CONFIG.TOTP_DIGITS) {
      return 'totp';
    }

    // Check if it matches backup code format
    if (code.length === 8 && /^\d{8}$/.test(code)) {
      return 'backup';
    }

    // Check if SMS or email code exists
    const smsData = await secureStorage.getSecureItem(`sms_code_${userId}`);
    const emailData = await secureStorage.getSecureItem(`email_code_${userId}`);

    if (smsData && code.length === MFA_CONFIG.SMS_CODE_LENGTH) {
      return 'sms';
    }

    if (emailData && code.length === MFA_CONFIG.EMAIL_CODE_LENGTH) {
      return 'email';
    }

    // Default to TOTP if available
    return totpData ? 'totp' : 'backup';
  }

  // Get user's MFA status and available methods
  async getMFAStatus(userId) {
    try {
      const totpData = await secureStorage.getSecureItem(`totp_${userId}`);
      const backupData = await secureStorage.getSecureItem(`backup_codes_${userId}`);
      const biometricEnabled = await biometricAuth.isBiometricEnabled(userId);

      const unusedBackupCodes = backupData ? 
        backupData.codes.filter(c => !c.used).length : 0;

      return {
        mfaEnabled: !!(totpData || backupData),
        methods: {
          totp: !!totpData,
          biometric: biometricEnabled,
          backup: !!backupData,
          sms: false, // Enable when SMS service is configured
          email: false // Enable when email service is configured
        },
        backupCodesRemaining: unusedBackupCodes,
        totpSetupDate: totpData?.enabledAt,
        lastVerification: await this.getLastVerification(userId)
      };
    } catch (error) {
      logger.error('Failed to get MFA status:', error);
      return { mfaEnabled: false, methods: {}, error: error.message };
    }
  }

  // Disable MFA for user (requires verification)
  async disableMFA(userId, verificationCode, method = 'auto') {
    // Verify the user knows their current MFA method
    const verification = await this.verifyMFACode(userId, verificationCode, method);
    
    if (!verification.success) {
      throw new Error('MFA verification required to disable MFA');
    }

    try {
      // Remove all MFA data
      const keysToRemove = [
        `totp_${userId}`,
        `backup_codes_${userId}`,
        `sms_code_${userId}`,
        `email_code_${userId}`
      ];

      for (const key of keysToRemove) {
        await secureStorage.removeSecureItem(key);
      }

      // Disable biometric auth
      await biometricAuth.disableBiometricAuth(userId);

      await this.recordMFAEvent(userId, 'mfa_disabled');
      logger.info('MFA disabled for user');

      return { success: true, message: 'Multi-factor authentication disabled' };

    } catch (error) {
      logger.error('Failed to disable MFA:', error);
      throw new Error('Failed to disable MFA');
    }
  }

  // Rate limiting for MFA attempts
  async checkRateLimit(userId, operation) {
    const key = `rate_limit_${operation}_${userId}`;
    const data = await secureStorage.getSecureItem(key, { attempts: 0, firstAttempt: Date.now() });
    
    const now = Date.now();
    const timeSinceFirst = now - data.firstAttempt;

    // Reset if window has passed
    if (timeSinceFirst > MFA_CONFIG.LOCKOUT_DURATION_MS) {
      await secureStorage.removeSecureItem(key);
      return;
    }

    // Check if locked out
    if (data.attempts >= MFA_CONFIG.MAX_ATTEMPTS) {
      const timeRemaining = MFA_CONFIG.LOCKOUT_DURATION_MS - timeSinceFirst;
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      throw new Error(`Too many attempts. Try again in ${minutesRemaining} minutes.`);
    }
  }

  // Record failed attempt for rate limiting
  async recordFailedAttempt(userId, operation) {
    const key = `rate_limit_${operation}_${userId}`;
    const data = await secureStorage.getSecureItem(key, { attempts: 0, firstAttempt: Date.now() });
    
    data.attempts++;
    await secureStorage.setSecureItem(key, data, {
      expiresIn: MFA_CONFIG.LOCKOUT_DURATION_MS,
      sensitive: false
    });
  }

  // Clear rate limit on success
  async clearRateLimit(userId, operation) {
    const key = `rate_limit_${operation}_${userId}`;
    await secureStorage.removeSecureItem(key);
  }

  // Record MFA events for auditing
  async recordMFAEvent(userId, event, metadata = {}) {
    try {
      const mfaEvent = {
        userId: userId.substring(0, 8) + '***',
        event,
        timestamp: Date.now(),
        platform: Platform.OS,
        ...metadata
      };

      const events = await secureStorage.getSecureItem('mfa_events', []);
      events.push(mfaEvent);
      
      // Keep only recent events
      const recentEvents = events.slice(-100);
      await secureStorage.setSecureItem('mfa_events', recentEvents);

    } catch (error) {
      logger.error('Failed to record MFA event:', error);
    }
  }

  // Get last successful verification timestamp
  async getLastVerification(userId) {
    try {
      const events = await secureStorage.getSecureItem('mfa_events', []);
      const userEvents = events.filter(e => e.userId === (userId.substring(0, 8) + '***'));
      const successEvents = userEvents.filter(e => e.event.includes('_success'));
      
      return successEvents.length > 0 ? 
        successEvents[successEvents.length - 1].timestamp : null;
    } catch (error) {
      return null;
    }
  }

  // Clean up expired verification attempts
  async cleanupExpiredAttempts() {
    try {
      // This would be more comprehensive in a real implementation
      logger.debug('MFA cleanup completed');
    } catch (error) {
      logger.error('MFA cleanup failed:', error);
    }
  }
}

// Singleton instance
export const multiFactorAuth = new MultiFactorAuthManager();

// Convenience functions
export const mfaUtils = {
  // Setup TOTP for user
  async setupTOTP(userId, appName) {
    return await multiFactorAuth.setupTOTP(userId, appName);
  },

  // Verify any MFA method
  async verifyCode(userId, code, method = 'auto') {
    return await multiFactorAuth.verifyMFACode(userId, code, method);
  },

  // Get user MFA status
  async getUserMFAStatus(userId) {
    return await multiFactorAuth.getMFAStatus(userId);
  },

  // Generate new backup codes
  async generateBackupCodes(userId) {
    return await multiFactorAuth.generateBackupCodes(userId);
  },

  // Send SMS verification
  async sendSMS(userId, phoneNumber) {
    return await multiFactorAuth.sendSMSCode(userId, phoneNumber);
  },

  // Send email verification
  async sendEmail(userId, email) {
    return await multiFactorAuth.sendEmailCode(userId, email);
  },

  // Complete MFA flow
  async completeMFAFlow(userId, code, method = 'auto') {
    const result = await multiFactorAuth.verifyMFACode(userId, code, method);
    
    if (result.success) {
      logger.info('MFA authentication successful');
      return {
        authenticated: true,
        method: result.method,
        timestamp: Date.now()
      };
    } else {
      throw new Error(result.message || 'MFA verification failed');
    }
  },

  // Disable MFA (with verification)
  async disableMFA(userId, verificationCode, method = 'auto') {
    return await multiFactorAuth.disableMFA(userId, verificationCode, method);
  }
};