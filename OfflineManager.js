import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineManager {
  constructor() {
    this.isOnline = true;
    this.pendingActions = [];
    this.listeners = [];
    this.init();
  }

  async init() {
    // Load pending actions from storage
    await this.loadPendingActions();
    
    // Set up network listener
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      if (!wasOnline && this.isOnline) {
        this.syncPendingActions();
      }
      
      this.notifyListeners();
    });
  }

  // Network status
  getNetworkStatus() {
    return this.isOnline;
  }

  // Add network status listener
  addNetworkListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  // Offline storage
  async saveData(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      return false;
    }
  }

  async loadData(key) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  }

  async removeData(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing data:', error);
      return false;
    }
  }

  // Pending actions for offline mode
  async addPendingAction(action) {
    this.pendingActions.push({
      ...action,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    });
    await this.savePendingActions();
  }

  async loadPendingActions() {
    const actions = await this.loadData('pendingActions');
    this.pendingActions = actions || [];
  }

  async savePendingActions() {
    await this.saveData('pendingActions', this.pendingActions);
  }

  async syncPendingActions() {
    if (!this.isOnline || this.pendingActions.length === 0) return;

    const actionsToProcess = [...this.pendingActions];
    this.pendingActions = [];

    for (const action of actionsToProcess) {
      try {
        await this.processAction(action);
      } catch (error) {
        console.error('Error processing pending action:', error);
        // Re-add failed actions
        this.pendingActions.push(action);
      }
    }

    await this.savePendingActions();
  }

  async processAction(action) {
    // This would be implemented based on your backend API
    // For now, we'll just simulate the action
    console.log('Processing action:', action);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }

  // Data synchronization
  async syncData(key, data, action = 'update') {
    if (this.isOnline) {
      // Online: save to backend and local storage
      try {
        await this.saveData(key, data);
        // Here you would also save to your backend
        return true;
      } catch (error) {
        console.error('Error syncing data:', error);
        return false;
      }
    } else {
      // Offline: save locally and queue for sync
      await this.saveData(key, data);
      await this.addPendingAction({
        type: action,
        key,
        data,
        timestamp: Date.now()
      });
      return true;
    }
  }

  // Cache management
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  async getCacheSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      let totalSize = 0;
      
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += new Blob([data]).size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  // Export/Import functionality
  async exportData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data = {};
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          data[key] = JSON.parse(value);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  async importData(data) {
    try {
      const entries = Object.entries(data);
      const keyValuePairs = entries.map(([key, value]) => [key, JSON.stringify(value)]);
      await AsyncStorage.multiSet(keyValuePairs);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

// Create singleton instance
const offlineManager = new OfflineManager();
export default offlineManager; 