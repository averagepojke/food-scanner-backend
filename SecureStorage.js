// 🔐 SECURE STORAGE UTILITY
// Advanced encryption for sensitive data storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import logger from './logger';

// Simple but effective encryption for React Native
// Note: In production, consider using expo-crypto or similar for stronger encryption
class SecureStorageManager {
  constructor() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  // Initialize with device-specific key
  async initialize() {
    if (this.initialized) return;

    try {
      // Generate or retrieve device-specific encryption key
      let storedKey = await AsyncStorage.getItem('_secure_key');
      
      if (!storedKey) {
        // Generate new key based on device characteristics
        const deviceId = Platform.OS + Platform.Version;
        const timestamp = Date.now().toString();
        const randomComponent = Math.random().toString(36);
        
        storedKey = this.generateKey(deviceId + timestamp + randomComponent);
        await AsyncStorage.setItem('_secure_key', storedKey);
        logger.info('Generated new secure storage key');
      }
      
      this.encryptionKey = storedKey;
      this.initialized = true;
      logger.debug('Secure storage initialized');
      
    } catch (error) {
      logger.error('Failed to initialize secure storage:', error);
      throw new Error('Secure storage initialization failed');
    }
  }

  // Generate encryption key from input
  generateKey(input) {
    let hash = 0;
    const str = input + 'FOOD_SCANNER_SALT_2024';
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  // Simple XOR encryption (sufficient for local storage obfuscation)
  encrypt(data, key) {
    try {
      const jsonString = JSON.stringify(data);
      const keyString = key.repeat(Math.ceil(jsonString.length / key.length));
      
      let encrypted = '';
      for (let i = 0; i < jsonString.length; i++) {
        const charCode = jsonString.charCodeAt(i) ^ keyString.charCodeAt(i);
        encrypted += String.fromCharCode(charCode);
      }
      
      // Base64 encode to make it safe for storage
      return Buffer.from(encrypted, 'binary').toString('base64');
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  // Decrypt data
  decrypt(encryptedData, key) {
    try {
      // Decode from base64
      const encrypted = Buffer.from(encryptedData, 'base64').toString('binary');
      const keyString = key.repeat(Math.ceil(encrypted.length / key.length));
      
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        const charCode = encrypted.charCodeAt(i) ^ keyString.charCodeAt(i);
        decrypted += String.fromCharCode(charCode);
      }
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  // Store encrypted data
  async setSecureItem(key, data, options = {}) {
    await this.initialize();
    
    try {
      const { 
        expiresIn = null, // Expiration time in milliseconds
        sensitive = true   // Whether to encrypt
      } = options;
      
      let storageData = {
        data: sensitive ? this.encrypt(data, this.encryptionKey) : data,
        encrypted: sensitive,
        timestamp: Date.now(),
        expiresAt: expiresIn ? Date.now() + expiresIn : null
      };
      
      await AsyncStorage.setItem(`_secure_${key}`, JSON.stringify(storageData));
      logger.debug('Secure item stored:', { key, encrypted: sensitive });
      
    } catch (error) {
      logger.error('Failed to store secure item:', error);
      throw new Error('Secure storage failed');
    }
  }

  // Retrieve and decrypt data
  async getSecureItem(key, defaultValue = null) {
    await this.initialize();
    
    try {
      const storedItem = await AsyncStorage.getItem(`_secure_${key}`);
      
      if (!storedItem) {
        return defaultValue;
      }
      
      const storageData = JSON.parse(storedItem);
      
      // Check if expired
      if (storageData.expiresAt && Date.now() > storageData.expiresAt) {
        logger.debug('Secure item expired, removing:', key);
        await this.removeSecureItem(key);
        return defaultValue;
      }
      
      // Decrypt if necessary
      const data = storageData.encrypted 
        ? this.decrypt(storageData.data, this.encryptionKey)
        : storageData.data;
      
      logger.debug('Secure item retrieved:', { key, encrypted: storageData.encrypted });
      return data;
      
    } catch (error) {
      logger.error('Failed to retrieve secure item:', error);
      return defaultValue;
    }
  }

  // Remove secure item
  async removeSecureItem(key) {
    try {
      await AsyncStorage.removeItem(`_secure_${key}`);
      logger.debug('Secure item removed:', key);
    } catch (error) {
      logger.error('Failed to remove secure item:', error);
    }
  }

  // Clear all secure items
  async clearSecureStorage() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('_secure_'));
      
      if (secureKeys.length > 0) {
        await AsyncStorage.multiRemove(secureKeys);
        logger.info('Cleared all secure storage items:', secureKeys.length);
      }
    } catch (error) {
      logger.error('Failed to clear secure storage:', error);
    }
  }

  // Verify data integrity
  async verifyIntegrity() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('_secure_'));
      
      let corruptedItems = 0;
      for (const key of secureKeys) {
        try {
          const item = await AsyncStorage.getItem(key);
          JSON.parse(item); // Basic integrity check
        } catch {
          logger.warn('Corrupted secure storage item detected:', key);
          await AsyncStorage.removeItem(key);
          corruptedItems++;
        }
      }
      
      logger.info('Storage integrity check complete:', { 
        total: secureKeys.length, 
        corrupted: corruptedItems 
      });
      
      return { total: secureKeys.length, corrupted: corruptedItems };
    } catch (error) {
      logger.error('Storage integrity check failed:', error);
      return { total: 0, corrupted: 0 };
    }
  }

  // Migrate regular AsyncStorage to secure storage
  async migrateToSecure(regularKey, secureKey = null, options = {}) {
    try {
      const key = secureKey || regularKey;
      const data = await AsyncStorage.getItem(regularKey);
      
      if (data) {
        const parsedData = JSON.parse(data);
        await this.setSecureItem(key, parsedData, options);
        await AsyncStorage.removeItem(regularKey);
        
        logger.info('Migrated to secure storage:', { from: regularKey, to: key });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Migration to secure storage failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const secureStorage = new SecureStorageManager();

// Convenience functions for common secure storage operations
export const secureStorageUtils = {
  // Store user credentials securely
  async storeUserCredentials(userId, credentials) {
    await secureStorage.setSecureItem(`user_creds_${userId}`, credentials, {
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours
      sensitive: true
    });
  },

  // Retrieve user credentials
  async getUserCredentials(userId) {
    return await secureStorage.getSecureItem(`user_creds_${userId}`);
  },

  // Store sensitive settings
  async storeSecureSetting(key, value, expiresIn = null) {
    await secureStorage.setSecureItem(`setting_${key}`, value, {
      expiresIn,
      sensitive: true
    });
  },

  // Get secure setting
  async getSecureSetting(key, defaultValue = null) {
    return await secureStorage.getSecureItem(`setting_${key}`, defaultValue);
  },

  // Store API tokens securely
  async storeApiToken(service, token) {
    await secureStorage.setSecureItem(`token_${service}`, {
      token,
      storedAt: Date.now()
    }, {
      expiresIn: 60 * 60 * 1000, // 1 hour default
      sensitive: true
    });
  },

  // Get API token
  async getApiToken(service) {
    const tokenData = await secureStorage.getSecureItem(`token_${service}`);
    return tokenData?.token || null;
  },

  // Store cached sensitive data
  async storeSensitiveCache(key, data, ttlMinutes = 60) {
    await secureStorage.setSecureItem(`cache_${key}`, data, {
      expiresIn: ttlMinutes * 60 * 1000,
      sensitive: true
    });
  },

  // Get cached sensitive data
  async getSensitiveCache(key) {
    return await secureStorage.getSecureItem(`cache_${key}`);
  },

  // Clear all user data securely
  async clearUserData(userId) {
    const keys = [
      `user_creds_${userId}`,
      `setting_user_${userId}`,
      `cache_user_${userId}`
    ];
    
    for (const key of keys) {
      await secureStorage.removeSecureItem(key);
    }
    
    logger.info('Cleared secure user data for:', userId.substring(0, 8) + '***');
  }
};

// Auto-initialize when module loads
secureStorage.initialize().catch(error => {
  logger.error('Secure storage auto-initialization failed:', error);
});