import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import { useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData } from './utils';

export default function DataDebugScreen() {
  const navigation = useNavigation();
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const { userId } = useAuth();
  const theme = getTheme(accentKey, darkMode);
  const [storageData, setStorageData] = useState({});
  const [selectedKey, setSelectedKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStorageData = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data = {};
      
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            try {
              data[key] = JSON.parse(value);
            } catch {
              data[key] = value; // Keep as string if not JSON
            }
          }
        } catch (error) {
          data[key] = `Error loading: ${error.message}`;
        }
      }
      
      setStorageData(data);
    } catch (error) {
      Alert.alert('Error', `Failed to load storage data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL stored data. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              setStorageData({});
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', `Failed to clear data: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const deleteKey = (key) => {
    Alert.alert(
      'Delete Key',
      `Delete "${key}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(key);
              const newData = { ...storageData };
              delete newData[key];
              setStorageData(newData);
              Alert.alert('Success', 'Key deleted');
            } catch (error) {
              Alert.alert('Error', `Failed to delete key: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const fixCalorieData = async () => {
    Alert.alert(
      'Fix Calorie Data',
      'This will attempt to fix calorie data persistence issues by clearing potentially corrupted date-specific entries.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fix',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const calorieKeys = keys.filter(key => key.startsWith('consumedFoods-'));
              
              for (const key of calorieKeys) {
                await AsyncStorage.removeItem(key);
              }
              
              await loadStorageData();
              Alert.alert('Success', `Cleared ${calorieKeys.length} calorie data entries`);
            } catch (error) {
              Alert.alert('Error', `Failed to fix calorie data: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const fixMealPlanData = async () => {
    Alert.alert(
      'Fix Meal Plan Data',
      'This will clear the meal plan data to fix persistence issues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fix',
          onPress: async () => {
            try {
              if (userId) {
                await setUserData(userId, 'mealPlan', {});
              } else {
                await AsyncStorage.removeItem('mealPlan');
              }
              
              await loadStorageData();
              Alert.alert('Success', 'Meal plan data cleared');
            } catch (error) {
              Alert.alert('Error', `Failed to fix meal plan data: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const filteredKeys = Object.keys(storageData).filter(key =>
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getValuePreview = (value) => {
    const str = formatValue(value);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Data Debug</Text>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: theme.primary }]}
          onPress={loadStorageData}
          disabled={loading}
        >
          <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search storage keys..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={fixCalorieData}
          >
            <MaterialCommunityIcons name="fire" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Fix Calorie Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.accent }]}
            onPress={fixMealPlanData}
          >
            <MaterialCommunityIcons name="calendar" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Fix Meal Plan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.error }]}
            onPress={clearAllData}
          >
            <MaterialCommunityIcons name="delete" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Storage Keys ({filteredKeys.length})
        </Text>

        <ScrollView style={styles.keysList} showsVerticalScrollIndicator={false}>
          {filteredKeys.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.keyItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setSelectedKey(selectedKey === key ? '' : key)}
            >
              <View style={styles.keyHeader}>
                <Text style={[styles.keyName, { color: theme.text }]} numberOfLines={1}>
                  {key}
                </Text>
                <View style={styles.keyActions}>
                  <TouchableOpacity
                    style={[styles.deleteKeyButton, { backgroundColor: theme.error }]}
                    onPress={() => deleteKey(key)}
                  >
                    <MaterialCommunityIcons name="delete" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={[styles.keyPreview, { color: theme.textSecondary }]} numberOfLines={2}>
                {getValuePreview(storageData[key])}
              </Text>

              {selectedKey === key && (
                <View style={[styles.keyDetails, { backgroundColor: theme.background }]}>
                  <ScrollView style={styles.valueContainer} nestedScrollEnabled>
                    <Text style={[styles.valueText, { color: theme.text }]}>
                      {formatValue(storageData[key])}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {userId && (
          <View style={[styles.userInfo, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.userInfoText, { color: theme.text }]}>
              User ID: {userId}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  keysList: {
    flex: 1,
  },
  keyItem: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  keyName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  keyActions: {
    flexDirection: 'row',
    gap: 4,
  },
  deleteKeyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPreview: {
    fontSize: 12,
    lineHeight: 16,
  },
  keyDetails: {
    marginTop: 8,
    borderRadius: 4,
    padding: 8,
  },
  valueContainer: {
    maxHeight: 200,
  },
  valueText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  userInfo: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  userInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },
});