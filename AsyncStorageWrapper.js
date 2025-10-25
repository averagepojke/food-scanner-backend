// 📱 AsyncStorage Wrapper - Fixes bundling issues
// This wrapper ensures consistent AsyncStorage resolution across the app

import logger from './logger';

let AsyncStorage;

try {
  // Try to import AsyncStorage
  AsyncStorage = require('@react-native-async-storage/async-storage');
  
  // Handle both default and named exports
  if (AsyncStorage && typeof AsyncStorage.default === 'object') {
    AsyncStorage = AsyncStorage.default;
  }
  
  // Verify we have the methods we need
  if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
    throw new Error('AsyncStorage methods not available');
  }
  
  logger.info('AsyncStorage loaded successfully');
  
} catch (error) {
  logger.warn('AsyncStorage not available, using fallback:', error.message);
  
  // Fallback implementation for web or testing
  AsyncStorage = {
    async getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    
    async setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // Silent fail
      }
    },
    
    async removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Silent fail
      }
    },
    
    async clear() {
      try {
        localStorage.clear();
      } catch (e) {
        // Silent fail
      }
    },
    
    async getAllKeys() {
      try {
        return Object.keys(localStorage);
      } catch (e) {
        return [];
      }
    },
    
    async multiGet(keys) {
      try {
        return keys.map(key => [key, localStorage.getItem(key)]);
      } catch (e) {
        return keys.map(key => [key, null]);
      }
    },
    
    async multiSet(keyValuePairs) {
      try {
        keyValuePairs.forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (e) {
        // Silent fail
      }
    },
    
    async multiRemove(keys) {
      try {
        keys.forEach(key => {
          localStorage.removeItem(key);
        });
      } catch (e) {
        // Silent fail
      }
    }
  };
}

export default AsyncStorage;