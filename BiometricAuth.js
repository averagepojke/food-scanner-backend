// 🔐 BIOMETRIC AUTHENTICATION SYSTEM
// Touch ID / Face ID / Fingerprint authentication for ultimate security

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import logger from './logger';
import { secureStorage } from './SecureStorage';

// Biometric authentication configuration
const BIOMETRIC_CONFIG = {
  promptMessage: 'Authenticate to access your food data',
  fallbackLabel: 'Use PIN',
  disableDeviceFallback: false,
  cancelLabel: 'Cancel',
  requireConfirmation: true,
  authenticatePrompt: {
    ios: {
      fallbackLabel: 'Enter Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    },
    android: {
      title: 'Biometric Authentication',
      subtitle: 'Use your fingerprint or face to authenticate',
      description: 'Your biometric data is stored securely on your device',
      cancelLabel: 'Cancel',
      negativeLabel: 'Use PIN',
    }
  }
};

class BiometricAuthManager {
  constructor() {
    this.isSupported = false;
    this.availableTypes = [];
    this.isEnrolled = false;
    this.initialized = false;
  }

  // Initialize biometric authentication
  async initialize() {
    if (this.initialized) return this.getCapabilities();

    try {
      // Check if biometric authentication is supported
      this.isSupported = await LocalAuthentication.hasHardwareAsync();
      
      if (this.isSupported) {
        // Get available biometric types
        this.availableTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        
        // Check if user has biometrics enrolled
        this.isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        logger.info('Biometric authentication initialized:', {
          supported: this.isSupported,
          enrolled: this.isEnrolled,
          types: this.availableTypes.map(type => this.getAuthTypeName(type))
        });
      }

      this.initialized = true;
      return this.getCapabilities();
      
    } catch (error) {
      logger.error('Biometric authentication initialization failed:', error);
      this.isSupported = false;
      this.initialized = true;
      return this.getCapabilities();
    }
  }

  // Get biometric capabilities
  getCapabilities() {
    return {
      isSupported: this.isSupported,
      isEnrolled: this.isEnrolled,
      availableTypes: this.availableTypes.map(type => this.getAuthTypeName(type)),
      hasFingerprint: this.availableTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      hasFaceID: this.availableTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      hasIris: this.availableTypes.includes(LocalAuthentication.AuthenticationType.IRIS),
    };
  }

  // Convert auth type to readable name
  getAuthTypeName(type) {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'Fingerprint';
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case LocalAuthentication.AuthenticationType.IRIS:
        return 'Iris';
      default:
        return 'Unknown';
    }
  }

  // Get primary authentication method name for UI
  getPrimaryAuthName() {
    const capabilities = this.getCapabilities();
    
    if (capabilities.hasFaceID) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    } else if (capabilities.hasFingerprint) {
      return 'Fingerprint';
    } else if (capabilities.hasIris) {
      return 'Iris';
    }
    
    return 'Biometric';
  }

  // Authenticate user with biometrics
  async authenticate(options = {}) {
    await this.initialize();

    if (!this.isSupported) {
      throw new Error('Biometric authentication is not supported on this device');
    }

    if (!this.isEnrolled) {
      throw new Error('No biometric data is enrolled on this device');
    }

    try {
      const authOptions = {
        promptMessage: options.promptMessage || BIOMETRIC_CONFIG.promptMessage,
        fallbackLabel: options.fallbackLabel || BIOMETRIC_CONFIG.fallbackLabel,
        disableDeviceFallback: options.disableDeviceFallback || BIOMETRIC_CONFIG.disableDeviceFallback,
        cancelLabel: options.cancelLabel || BIOMETRIC_CONFIG.cancelLabel,
        requireConfirmation: options.requireConfirmation !== undefined ? 
          options.requireConfirmation : BIOMETRIC_CONFIG.requireConfirmation,
        ...BIOMETRIC_CONFIG.authenticatePrompt[Platform.OS]
      };

      const result = await LocalAuthentication.authenticateAsync(authOptions);

      if (result.success) {
        logger.info('Biometric authentication successful');
        
        // Record successful biometric auth
        await this.recordAuthEvent('biometric_success');
        
        return {
          success: true,
          authType: this.getPrimaryAuthName(),
          timestamp: Date.now()
        };
      } else {
        logger.warn('Biometric authentication failed:', result.error);
        
        // Record failed biometric auth
        await this.recordAuthEvent('biometric_failed', { error: result.error });
        
        return {
          success: false,
          error: result.error,
          userCancel: result.error === 'UserCancel',
          systemCancel: result.error === 'SystemCancel',
          lockout: result.error === 'AuthenticationFailed' && result.warning === 'lockout'
        };
      }

    } catch (error) {
      logger.error('Biometric authentication error:', error);
      await this.recordAuthEvent('biometric_error', { error: error.message });
      
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Enable biometric authentication for user account
  async enableBiometricAuth(userId, userSecret) {
    await this.initialize();

    if (!this.isSupported || !this.isEnrolled) {
      throw new Error('Biometric authentication is not available');
    }

    try {
      // First authenticate with biometrics to ensure they work
      const authResult = await this.authenticate({
        promptMessage: 'Authenticate to enable biometric login'
      });

      if (!authResult.success) {
        throw new Error('Biometric authentication verification failed');
      }

      // Store encrypted user credentials for biometric login
      const biometricKey = `biometric_${userId}`;
      const encryptedSecret = await this.encryptForBiometric(userSecret);
      
      await SecureStore.setItemAsync(biometricKey, JSON.stringify({
        encryptedSecret,
        enabledAt: Date.now(),
        userId,
        authType: this.getPrimaryAuthName()
      }));

      // Store biometric preference in user settings
      await secureStorage.setSecureItem(`biometric_enabled_${userId}`, {
        enabled: true,
        enabledAt: Date.now(),
        authType: this.getPrimaryAuthName()
      });

      logger.info('Biometric authentication enabled for user');
      await this.recordAuthEvent('biometric_enabled', { userId });

      return true;

    } catch (error) {
      logger.error('Failed to enable biometric authentication:', error);
      throw error;
    }
  }

  // Disable biometric authentication
  async disableBiometricAuth(userId) {
    try {
      // Remove stored biometric data
      const biometricKey = `biometric_${userId}`;
      await SecureStore.deleteItemAsync(biometricKey);
      
      // Update user settings
      await secureStorage.setSecureItem(`biometric_enabled_${userId}`, {
        enabled: false,
        disabledAt: Date.now()
      });

      logger.info('Biometric authentication disabled for user');
      await this.recordAuthEvent('biometric_disabled', { userId });

      return true;

    } catch (error) {
      logger.error('Failed to disable biometric authentication:', error);
      throw error;
    }
  }

  // Check if biometric auth is enabled for user
  async isBiometricEnabled(userId) {
    try {
      const settings = await secureStorage.getSecureItem(`biometric_enabled_${userId}`, { enabled: false });
      const biometricKey = `biometric_${userId}`;
      const storedData = await SecureStore.getItemAsync(biometricKey);
      
      return settings.enabled && !!storedData;
    } catch (error) {
      logger.error('Failed to check biometric status:', error);
      return false;
    }
  }

  // Login with biometric authentication
  async loginWithBiometric(userId) {
    if (!await this.isBiometricEnabled(userId)) {
      throw new Error('Biometric authentication is not enabled for this account');
    }

    try {
      // Authenticate with biometrics
      const authResult = await this.authenticate({
        promptMessage: 'Use biometric authentication to sign in'
      });

      if (!authResult.success) {
        throw new Error('Biometric authentication failed');
      }

      // Retrieve and decrypt stored credentials
      const biometricKey = `biometric_${userId}`;
      const storedData = await SecureStore.getItemAsync(biometricKey);
      
      if (!storedData) {
        throw new Error('Biometric data not found. Please re-enable biometric login.');
      }

      const { encryptedSecret } = JSON.parse(storedData);
      const decryptedSecret = await this.decryptFromBiometric(encryptedSecret);

      logger.info('Biometric login successful');
      await this.recordAuthEvent('biometric_login_success', { userId });

      return {
        success: true,
        userSecret: decryptedSecret,
        authMethod: 'biometric',
        authType: authResult.authType
      };

    } catch (error) {
      logger.error('Biometric login failed:', error);
      await this.recordAuthEvent('biometric_login_failed', { userId, error: error.message });
      throw error;
    }
  }

  // Simple encryption for biometric storage (device-specific)
  async encryptForBiometric(data) {
    // In production, use proper encryption with device keychain
    // This is a simplified version
    const deviceKey = await this.getDeviceKey();
    const jsonString = JSON.stringify(data);
    const encoded = Buffer.from(jsonString + deviceKey).toString('base64');
    return encoded;
  }

  // Decrypt biometric stored data
  async decryptFromBiometric(encryptedData) {
    try {
      const deviceKey = await this.getDeviceKey();
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
      const jsonString = decoded.replace(deviceKey, '');
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Failed to decrypt biometric data');
    }
  }

  // Get device-specific encryption key
  async getDeviceKey() {
    let deviceKey = await SecureStore.getItemAsync('device_biometric_key');
    
    if (!deviceKey) {
      // Generate device-specific key
      deviceKey = Platform.OS + Date.now().toString() + Math.random().toString(36);
      await SecureStore.setItemAsync('device_biometric_key', deviceKey);
    }
    
    return deviceKey;
  }

  // Record biometric authentication events
  async recordAuthEvent(event, metadata = {}) {
    try {
      const authEvent = {
        event,
        timestamp: Date.now(),
        platform: Platform.OS,
        deviceSupported: this.isSupported,
        deviceEnrolled: this.isEnrolled,
        availableTypes: this.availableTypes.map(type => this.getAuthTypeName(type)),
        ...metadata
      };

      // Store in secure storage
      const events = await secureStorage.getSecureItem('biometric_events', []);
      events.push(authEvent);
      
      // Keep only last 50 events
      const recentEvents = events.slice(-50);
      await secureStorage.setSecureItem('biometric_events', recentEvents);

    } catch (error) {
      logger.error('Failed to record biometric auth event:', error);
    }
  }

  // Get biometric authentication statistics
  async getBiometricStats() {
    try {
      const events = await secureStorage.getSecureItem('biometric_events', []);
      const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
      const recentEvents = events.filter(e => e.timestamp > last24Hours);

      const stats = {
        totalEvents: events.length,
        recentEvents: recentEvents.length,
        successRate: this.calculateSuccessRate(recentEvents),
        lastSuccess: events.reverse().find(e => e.event === 'biometric_success')?.timestamp,
        authTypes: [...new Set(events.map(e => e.availableTypes).flat())],
        platform: Platform.OS,
        capabilities: this.getCapabilities()
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get biometric stats:', error);
      return null;
    }
  }

  // Calculate success rate from events
  calculateSuccessRate(events) {
    if (events.length === 0) return 0;
    
    const attempts = events.filter(e => 
      e.event === 'biometric_success' || e.event === 'biometric_failed'
    );
    
    if (attempts.length === 0) return 0;
    
    const successes = attempts.filter(e => e.event === 'biometric_success').length;
    return Math.round((successes / attempts.length) * 100);
  }

  // Show setup instructions for users
  showSetupInstructions() {
    const capabilities = this.getCapabilities();
    let title = 'Biometric Setup Required';
    let message = 'To use biometric authentication, please set up ';
    
    if (capabilities.hasFingerprint && capabilities.hasFaceID) {
      message += 'Touch ID, Face ID, or fingerprint authentication in your device settings.';
    } else if (capabilities.hasFaceID) {
      message += Platform.OS === 'ios' ? 'Face ID in Settings > Face ID & Passcode.' : 'face authentication in your device settings.';
    } else if (capabilities.hasFingerprint) {
      message += 'fingerprint authentication in your device settings.';
    } else {
      message += 'biometric authentication in your device settings.';
    }

    Alert.alert(title, message, [
      { text: 'Later', style: 'cancel' },
      { text: 'Open Settings', onPress: () => {
        // In a real app, you might want to open device settings
        logger.info('User requested to open device settings for biometric setup');
      }}
    ]);
  }
}

// Singleton instance
export const biometricAuth = new BiometricAuthManager();

// Convenience functions
export const biometricUtils = {
  // Quick check if biometrics are available
  async isAvailable() {
    const capabilities = await biometricAuth.initialize();
    return capabilities.isSupported && capabilities.isEnrolled;
  },

  // Quick biometric authentication
  async authenticate(promptMessage) {
    return await biometricAuth.authenticate({ promptMessage });
  },

  // Enable biometric login for current user
  async enableForUser(userId, userSecret) {
    return await biometricAuth.enableBiometricAuth(userId, userSecret);
  },

  // Login with biometric
  async loginUser(userId) {
    return await biometricAuth.loginWithBiometric(userId);
  },

  // Check if enabled for user
  async isEnabledForUser(userId) {
    return await biometricAuth.isBiometricEnabled(userId);
  },

  // Get friendly name for UI
  getAuthTypeName() {
    return biometricAuth.getPrimaryAuthName();
  },

  // Show setup help
  showSetupHelp() {
    biometricAuth.showSetupInstructions();
  }
};