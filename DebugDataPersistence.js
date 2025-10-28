import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData, getUserStorageKey } from './utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from './theme';

export default function DebugDataPersistence({ navigation }) {
  const { userId, user } = useAuth();
  const [testResults, setTestResults] = useState([]);
  const [allKeys, setAllKeys] = useState([]);
  const theme = getTheme('default', false);

  const addResult = (test, success, message) => {
    setTestResults(prev => [...prev, { test, success, message, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runComprehensiveTest = async () => {
    setTestResults([]);
    
    try {
      // Test 1: Check if user is logged in
      addResult('User Authentication', !!userId, userId ? `Logged in as: ${user?.email} (${userId})` : 'Not logged in');
      
      if (!userId) {
        addResult('Test Aborted', false, 'Cannot test data persistence without being logged in');
        return;
      }

      // Test 2: Test basic storage key generation
      const testKey = getUserStorageKey(userId, 'testData');
      const expectedKey = `user_${userId}_testData`;
      addResult('Storage Key Generation', testKey === expectedKey, `Generated: ${testKey}`);

      // Test 3: Write test data
      const testData = { 
        message: 'Test data for persistence', 
        timestamp: new Date().toISOString(),
        randomValue: Math.random()
      };
      
      await setUserData(userId, 'persistenceTest', testData);
      addResult('Write Test Data', true, 'Successfully wrote test data');

      // Test 4: Read test data immediately
      const readData = await getUserData(userId, 'persistenceTest', null);
      const readSuccess = readData && readData.message === testData.message;
      addResult('Read Test Data', readSuccess, readSuccess ? 'Data read successfully' : 'Failed to read data');

      // Test 5: Check if data exists in AsyncStorage directly
      const directRead = await AsyncStorage.getItem(testKey);
      const directSuccess = !!directRead;
      addResult('Direct AsyncStorage Check', directSuccess, directSuccess ? 'Data exists in AsyncStorage' : 'Data not found in AsyncStorage');

      // Test 6: Test inventory data specifically
      const currentInventory = await getUserData(userId, 'foodInventory', []);
      addResult('Current Inventory Data', true, `Found ${currentInventory.length} items in storage`);

      // Test 7: Add a test inventory item
      const testItem = {
        id: `test_${Date.now()}`,
        name: `Test Item ${new Date().toLocaleTimeString()}`,
        quantity: 1,
        price: 1.99,
        dateAdded: new Date().toISOString().split('T')[0],
      };

      const updatedInventory = [...currentInventory, testItem];
      await setUserData(userId, 'foodInventory', updatedInventory);
      addResult('Add Test Inventory Item', true, `Added test item: ${testItem.name}`);

      // Test 8: Verify the item was saved
      const verifyInventory = await getUserData(userId, 'foodInventory', []);
      const itemExists = verifyInventory.some(item => item.id === testItem.id);
      addResult('Verify Inventory Save', itemExists, itemExists ? 'Test item found in saved inventory' : 'Test item not found');

      // Test 9: Get all storage keys
      const keys = await AsyncStorage.getAllKeys();
      setAllKeys(keys);
      const userKeys = keys.filter(key => key.startsWith(`user_${userId}_`));
      addResult('Storage Keys Analysis', true, `Total keys: ${keys.length}, User keys: ${userKeys.length}`);

      // Test 10: Check for any old non-user-specific data
      const oldKeys = ['foodInventory', 'shoppingList', 'spendingHistory', 'darkMode'];
      const foundOldKeys = keys.filter(key => oldKeys.includes(key));
      addResult('Old Data Check', foundOldKeys.length === 0, foundOldKeys.length > 0 ? `Found old keys: ${foundOldKeys.join(', ')}` : 'No old non-user-specific data found');

    } catch (error) {
      addResult('Test Error', false, `Error during testing: ${error.message}`);
    }
  };

  const clearTestData = async () => {
    try {
      if (userId) {
        await setUserData(userId, 'persistenceTest', null);
        // Remove the test inventory item
        const currentInventory = await getUserData(userId, 'foodInventory', []);
        const cleanedInventory = currentInventory.filter(item => !item.id.startsWith('test_'));
        await setUserData(userId, 'foodInventory', cleanedInventory);
        Alert.alert('Success', 'Test data cleared');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to clear test data: ${error.message}`);
    }
  };

  const showStorageKeys = () => {
    const userKeys = allKeys.filter(key => userId && key.startsWith(`user_${userId}_`));
    const otherKeys = allKeys.filter(key => !key.startsWith('user_'));
    
    Alert.alert(
      'Storage Keys',
      `User Keys (${userKeys.length}):\n${userKeys.join('\n')}\n\nOther Keys (${otherKeys.length}):\n${otherKeys.slice(0, 10).join('\n')}${otherKeys.length > 10 ? '\n...' : ''}`,
      [{ text: 'OK' }]
    );
  };

  useEffect(() => {
    if (userId) {
      runComprehensiveTest();
    }
  }, [userId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Data Persistence Debug</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Test Results</Text>
          
          {testResults.map((result, index) => (
            <View key={index} style={[styles.testResult, { borderLeftColor: result.success ? '#4CAF50' : '#F44336' }]}>
              <View style={styles.testHeader}>
                <Text style={[styles.testName, { color: theme.text }]}>{result.test}</Text>
                <Text style={[styles.testStatus, { color: result.success ? '#4CAF50' : '#F44336' }]}>
                  {result.success ? '✓' : '✗'}
                </Text>
              </View>
              <Text style={[styles.testMessage, { color: theme.textSecondary }]}>{result.message}</Text>
              <Text style={[styles.testTime, { color: theme.textSecondary }]}>{result.timestamp}</Text>
            </View>
          ))}

          {testResults.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {userId ? 'Running tests...' : 'Please log in to run tests'}
            </Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]} 
            onPress={runComprehensiveTest}
            disabled={!userId}
          >
            <Text style={[styles.buttonText, { color: theme.surface }]}>Run Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.accent }]} 
            onPress={showStorageKeys}
          >
            <Text style={[styles.buttonText, { color: theme.surface }]}>Show Storage Keys</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.error }]} 
            onPress={clearTestData}
            disabled={!userId}
          >
            <Text style={[styles.buttonText, { color: theme.surface }]}>Clear Test Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  testResult: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
  },
  testStatus: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  testMessage: {
    fontSize: 14,
    marginTop: 4,
  },
  testTime: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
