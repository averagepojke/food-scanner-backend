import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from './ImprovedSubscriptionManager';
import { useAuth } from './food-scanner-app/AuthContext';
import logger from './logger';

export default function PaywallDebugger() {
  const { user } = useAuth();
  const { 
    isSubscribed, 
    subscriptionData, 
    isFirstTime, 
    isLoading, 
    showPaywall, 
    canAccessApp,
    triggerPaywall,
    getSubscriptionStatus 
  } = useSubscription();
  
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    loadDebugInfo();
  }, [user]);

  const getUserStorageKey = (key) => {
    return user ? `${user.uid}_${key}` : key;
  };

  const loadDebugInfo = async () => {
    if (!user) {
      setDebugInfo({ noUser: true });
      return;
    }

    try {
      // Use user-specific keys
      const userHasLaunchedKey = getUserStorageKey('hasLaunched');
      const userSubscriptionKey = getUserStorageKey('subscriptionData');
      
      const hasLaunched = await AsyncStorage.getItem(userHasLaunchedKey);
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      const onboardingSelection = await AsyncStorage.getItem('onboardingSelection');
      const storedSubscription = await AsyncStorage.getItem(userSubscriptionKey);
      const hasSeenPaywall = await AsyncStorage.getItem('hasSeenPaywall');

      // Also check old device-level keys for comparison
      const oldHasLaunched = await AsyncStorage.getItem('hasLaunched');
      const oldSubscription = await AsyncStorage.getItem('subscriptionData');

      setDebugInfo({
        userId: user.uid,
        userEmail: user.email,
        // User-specific data
        hasLaunched: !!hasLaunched,
        onboardingCompleted: !!onboardingCompleted,
        onboardingSelection: onboardingSelection ? JSON.parse(onboardingSelection) : null,
        storedSubscription: storedSubscription ? JSON.parse(storedSubscription) : null,
        hasSeenPaywall: !!hasSeenPaywall,
        // Old device-level data for comparison
        oldHasLaunched: !!oldHasLaunched,
        oldSubscription: oldSubscription ? JSON.parse(oldSubscription) : null,
        // Storage keys being used
        userHasLaunchedKey,
        userSubscriptionKey,
      });
    } catch (error) {
      logger.error('Debug info load error:', error);
    }
  };

  const forceShowPaywall = () => {
    // Hidden debug action in production
    triggerPaywall();
  };

  const resetUserToFirstTime = async () => {
    if (!user) {
      Alert.alert('Error', 'No user logged in');
      return;
    }

    try {
      const userHasLaunchedKey = getUserStorageKey('hasLaunched');
      const userSubscriptionKey = getUserStorageKey('subscriptionData');
      
      await AsyncStorage.multiRemove([
        userHasLaunchedKey,
        userSubscriptionKey,
        'onboardingSelection',
        'onboardingCompleted',
        'hasSeenPaywall',
      ]);
      Alert.alert('Reset Complete', `User ${user.uid} reset to first-time state. Please restart the app.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to reset user state');
    }
  };

  const clearOldDeviceData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'hasLaunched',
        'subscriptionData',
      ]);
      Alert.alert('Cleared', 'Old device-level data cleared');
      loadDebugInfo();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear old data');
    }
  };

  const subscriptionStatus = getSubscriptionStatus();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🐛 No User Logged In</Text>
        <Text style={styles.debugText}>Please log in to see subscription debug info</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐛 Paywall Debug Info</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Info:</Text>
        <Text style={styles.debugText}>• User ID: {debugInfo.userId}</Text>
        <Text style={styles.debugText}>• Email: {debugInfo.userEmail}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription Context State:</Text>
        <Text style={styles.debugText}>• isSubscribed: {isSubscribed ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• isFirstTime: {isFirstTime ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• isLoading: {isLoading ? '⏳' : '✅'}</Text>
        <Text style={styles.debugText}>• showPaywall: {showPaywall ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• canAccessApp: {canAccessApp() ? '✅' : '❌'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User-Specific Storage:</Text>
        <Text style={styles.debugText}>• User hasLaunched: {debugInfo.hasLaunched ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• User subscription: {debugInfo.storedSubscription ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• Storage key: {debugInfo.userHasLaunchedKey}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Global App State:</Text>
        <Text style={styles.debugText}>• onboardingCompleted: {debugInfo.onboardingCompleted ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• hasSeenPaywall: {debugInfo.hasSeenPaywall ? '✅' : '❌'}</Text>
        <Text style={styles.debugText}>• onboardingSelection: {debugInfo.onboardingSelection ? JSON.stringify(debugInfo.onboardingSelection) : 'null'}</Text>
      </View>

      {(debugInfo.oldHasLaunched || debugInfo.oldSubscription) && (
        <View style={[styles.section, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.sectionTitle}>⚠️ Old Device Data Found:</Text>
          <Text style={styles.debugText}>• Old hasLaunched: {debugInfo.oldHasLaunched ? '✅' : '❌'}</Text>
          <Text style={styles.debugText}>• Old subscription: {debugInfo.oldSubscription ? '✅' : '❌'}</Text>
          <Text style={[styles.debugText, { color: '#92400E' }]}>This might be causing conflicts!</Text>
        </View>
      )}

      {subscriptionStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Details:</Text>
          <Text style={styles.debugText}>• Type: {subscriptionStatus.type}</Text>
          <Text style={styles.debugText}>• Status: {subscriptionStatus.status}</Text>
          <Text style={styles.debugText}>• Days Remaining: {subscriptionStatus.daysRemaining}</Text>
          <Text style={styles.debugText}>• Is Expired: {subscriptionStatus.isExpired ? '❌' : '✅'}</Text>
          <Text style={styles.debugText}>• User ID: {subscriptionStatus.userId}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expected Behavior:</Text>
        <Text style={styles.debugText}>
          {!debugInfo.hasLaunched 
            ? "🆕 First-time user → Should show onboarding → then paywall"
            : !debugInfo.onboardingCompleted
            ? "📚 Should show onboarding → then paywall"
            : !isSubscribed
            ? "💰 Should show paywall immediately"
            : "✅ Should access app normally"
          }
        </Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={forceShowPaywall}>
          <Text style={styles.buttonText}>🚨 Force Show Paywall</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetUserToFirstTime}>
          <Text style={styles.buttonText}>🔄 Reset User to First Time</Text>
        </TouchableOpacity>

        {(debugInfo.oldHasLaunched || debugInfo.oldSubscription) && (
          <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearOldDeviceData}>
            <Text style={styles.buttonText}>🧹 Clear Old Device Data</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.button} onPress={loadDebugInfo}>
          <Text style={styles.buttonText}>🔄 Refresh Debug Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  buttons: {
    gap: 8,
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#EF4444',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});