import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ShoppingListContext } from './App';
import { useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData } from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DebugData() {
  const { user, userId } = useAuth();
  const { foodInventory, setFoodInventory } = useContext(ShoppingListContext);
  const [debugInfo, setDebugInfo] = useState({});

  const loadDebugInfo = async () => {
    try {
      const info = {
        userId: userId,
        userEmail: user?.email,
        inventoryCount: foodInventory.length,
        inventoryItems: foodInventory.map(item => ({ id: item.id, name: item.name })),
      };

      if (userId) {
        // Check user-specific storage
        const userInventory = await getUserData(userId, 'foodInventory', null);
        info.userSpecificInventory = userInventory ? userInventory.length : 0;
        info.userSpecificItems = userInventory ? userInventory.map(item => ({ id: item.id, name: item.name })) : [];
      }

      // Check fallback storage
      const fallbackInventory = await AsyncStorage.getItem('foodInventory');
      info.fallbackInventory = fallbackInventory ? JSON.parse(fallbackInventory).length : 0;
      info.fallbackItems = fallbackInventory ? JSON.parse(fallbackInventory).map(item => ({ id: item.id, name: item.name })) : [];

      setDebugInfo(info);
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  };

  const addTestItem = async () => {
    const testItem = {
      id: Date.now().toString(),
      name: `Test Item ${Date.now()}`,
      brand: 'Test Brand',
      expiry: '2025-12-31',
      barcode: '1234567890123',
      category: 'test',
      quantity: 1,
      dateAdded: new Date().toISOString(),
      ingredients: 'Test ingredients',
      nutrition: { calories: 100, protein: 5, fat: 2, carbs: 15 },
      price: 1.99
    };

    setFoodInventory(prev => [testItem, ...prev]);
  };

  const clearAllData = async () => {
    try {
      if (userId) {
        await setUserData(userId, 'foodInventory', []);
      }
      await AsyncStorage.removeItem('foodInventory');
      setFoodInventory([]);
      loadDebugInfo();
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  useEffect(() => {
    loadDebugInfo();
  }, [userId, foodInventory]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug Data</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication</Text>
        <Text style={styles.info}>User ID: {debugInfo.userId || 'Not logged in'}</Text>
        <Text style={styles.info}>Email: {debugInfo.userEmail || 'Not logged in'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current State</Text>
        <Text style={styles.info}>Inventory Count: {debugInfo.inventoryCount}</Text>
        <Text style={styles.info}>Items: {JSON.stringify(debugInfo.inventoryItems, null, 2)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User-Specific Storage</Text>
        <Text style={styles.info}>Count: {debugInfo.userSpecificInventory}</Text>
        <Text style={styles.info}>Items: {JSON.stringify(debugInfo.userSpecificItems, null, 2)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fallback Storage</Text>
        <Text style={styles.info}>Count: {debugInfo.fallbackInventory}</Text>
        <Text style={styles.info}>Items: {JSON.stringify(debugInfo.fallbackItems, null, 2)}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={loadDebugInfo}>
          <Text style={styles.buttonText}>Refresh Debug Info</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={addTestItem}>
          <Text style={styles.buttonText}>Add Test Item</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearAllData}>
          <Text style={styles.buttonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  info: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 