import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData, clearUserData } from './utils';

export default function UserDataTest() {
  const { user, userId, logout } = useAuth();
  const [testData, setTestData] = useState(null);
  const [otherUserData, setOtherUserData] = useState(null);

  useEffect(() => {
    loadTestData();
  }, [userId]);

  const loadTestData = async () => {
    if (userId) {
      const data = await getUserData(userId, 'testData', null);
      setTestData(data);
    }
  };

  const saveTestData = async () => {
    if (userId) {
      const newData = {
        timestamp: new Date().toISOString(),
        user: user?.email,
        randomValue: Math.random()
      };
      await setUserData(userId, 'testData', newData);
      setTestData(newData);
      Alert.alert('Success', 'Test data saved for current user');
    }
  };

  const loadOtherUserData = async () => {
    // Try to load data from a different user ID
    const otherUserId = 'test-other-user';
    const data = await getUserData(otherUserId, 'testData', null);
    setOtherUserData(data);
  };

  const clearData = async () => {
    if (userId) {
      await clearUserData(userId);
      setTestData(null);
      Alert.alert('Success', 'User data cleared (for testing only)');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Data Storage Test</Text>
      
      <Text style={styles.info}>User ID: {userId || 'Not logged in'}</Text>
      <Text style={styles.info}>Email: {user?.email || 'Not logged in'}</Text>
      
      <TouchableOpacity style={styles.button} onPress={saveTestData}>
        <Text style={styles.buttonText}>Save Test Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={loadTestData}>
        <Text style={styles.buttonText}>Load Test Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={loadOtherUserData}>
        <Text style={styles.buttonText}>Load Other User Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, { backgroundColor: '#FF3B30' }]} onPress={clearData}>
        <Text style={styles.buttonText}>Clear User Data (Testing Only)</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
      
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>Current User Data:</Text>
        <Text style={styles.dataText}>
          {testData ? JSON.stringify(testData, null, 2) : 'No data'}
        </Text>
      </View>
      
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>Other User Data:</Text>
        <Text style={styles.dataText}>
          {otherUserData ? JSON.stringify(otherUserData, null, 2) : 'No data'}
        </Text>
      </View>
    </View>
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
  info: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  dataContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dataText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
}); 