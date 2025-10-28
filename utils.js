import AsyncStorage from './AsyncStorageWrapper';

// Helper function to get user-specific storage key
export const getUserStorageKey = (userId, key) => {
  if (!userId) {
    console.warn('No user ID provided for storage key:', key);
    return key; // Fallback to non-user-specific key
  }
  return `user_${userId}_${key}`;
};

// Helper function to get user-specific data
export const getUserData = async (userId, key, defaultValue = null) => {
  try {
    const storageKey = getUserStorageKey(userId, key);
    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.warn(`Failed to get user data for key ${key}:`, error);
    return defaultValue;
  }
};

// Helper function to set user-specific data
export const setUserData = async (userId, key, data) => {
  try {
    const storageKey = getUserStorageKey(userId, key);
    await AsyncStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to set user data for key ${key}:`, error);
  }
};

// Helper function to remove user-specific data
export const removeUserData = async (userId, key) => {
  try {
    const storageKey = getUserStorageKey(userId, key);
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.warn(`Failed to remove user data for key ${key}:`, error);
  }
};

// Helper function to clear all user data (for logout)
export const clearUserData = async (userId) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const userKeys = keys.filter(key => key.startsWith(`user_${userId}_`));
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (error) {
    console.warn('Failed to clear user data:', error);
  }
};

// Helper function to migrate existing data to user-specific storage
export const migrateToUserStorage = async (userId, oldKey, newKey) => {
  try {
    // Check if old data exists
    const oldData = await AsyncStorage.getItem(oldKey);
    if (oldData) {
      // Check if user-specific data already exists
      const userData = await getUserData(userId, newKey);
      if (!userData) {
        // Migrate old data to user-specific storage
        await setUserData(userId, newKey, JSON.parse(oldData));
        console.log(`Migrated data from ${oldKey} to user-specific storage`);
      }
      // Remove old data
      await AsyncStorage.removeItem(oldKey);
    }
  } catch (error) {
    console.warn(`Failed to migrate data from ${oldKey}:`, error);
  }
}; 