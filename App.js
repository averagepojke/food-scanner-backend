import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import FoodInventoryScreen from './HomeScreen';
import HomeScreenLanding from './HomeScreenLanding';
import ShoppingListScreen from './ShoppingListScreen';
import Calorie from './Calorie';
import ProfileScreen from './Profile';
import FinanceScreen from './Finance';
import MealMaker from './MealMaker';
import MealPlannerScreen from './MealPlanner';
import GamificationScreen from './GamificationScreen';
import { NavigationContainer, useNavigation, DefaultTheme, DarkTheme, useTheme } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import LoginScreen from './food-scanner-app/LoginScreen';
import RegisterScreen from './food-scanner-app/RegisterScreen';
import { createStackNavigator } from '@react-navigation/stack';
import { getTheme } from './theme';
import SplashScreen from './SplashScreen';
import { LoadingOverlay, NetworkStatus } from './LoadingComponents';
import offlineManager from './OfflineManager';
import errorHandler from './ErrorHandler';
import { GamificationProvider, useGamification, GamificationDashboard } from './Gamification';
import { AchievementNotification } from './AchievementNotification';
import ScannerScreen from './ScannerScreen';
import { navigationRef } from './navigationRef';
import logger from './logger'; // 🔐 SECURE LOGGING
import CriticalErrorBoundary from './CriticalErrorBoundary'; // 🛡️ ERROR PROTECTION

import TermsScreen from './TermsScreen';
import PrivacyScreen from './PrivacyScreen';
import FAQScreen from './FAQScreen';
import StatisticsScreen from './StatisticsScreen';
import OnboardingScreen from './OnboardingScreen';
import SupportChatScreen from './SupportChatScreen';
import ReminderSettings from './ReminderSettings';
import DataDebugScreen from './DataDebugScreen';
import DebugDataPersistence from './DebugDataPersistence';
import ReferralScreen from './ReferralScreen';
import { SubscriptionProvider, useSubscription, ProtectedScreen } from './ImprovedSubscriptionManager';
import PaywallTestScreen from './PaywallTestScreen';

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

// Global state for onboarding completion
global.onboardingCompletionCallback = null;

function RootNavigator() {
  const { user } = useAuth();
  const { canAccessApp, isLoading: subscriptionLoading } = useSubscription();
  const [onboardingComplete, setOnboardingComplete] = React.useState(null);
  const [forceUpdate, setForceUpdate] = React.useState(0);

  React.useEffect(() => {
    const checkOnboarding = async () => {
      try {
        if (user) {
          const selection = await AsyncStorage.getItem('onboardingSelection');
          const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
          // Show onboarding if user exists but hasn't completed onboarding
          const isComplete = !!(selection && onboardingCompleted);
          logger.debug('Onboarding check completed:', { 
            hasUser: !!user.email, 
            hasSelection: !!selection, 
            onboardingCompleted: !!onboardingCompleted, 
            isComplete 
          });
          setOnboardingComplete(isComplete);
        } else {
          logger.debug('No user authenticated, skipping onboarding');
          setOnboardingComplete(true); // Don't show onboarding if not logged in
        }
      } catch (e) {
        logger.error('Error checking onboarding status:', e);
        setOnboardingComplete(true);
      }
    };
    
    // Set up the callback for onboarding completion
    global.onboardingCompletionCallback = () => {
      logger.debug('Onboarding completion callback triggered');
      setForceUpdate(prev => prev + 1);
      // Also trigger MainApp to refresh its selection
      global.refreshMainAppSelection = true;
    };
    
    checkOnboarding();
    
    return () => {
      global.onboardingCompletionCallback = null;
    };
  }, [user, forceUpdate]);

  // Show loading while checking subscription status
  if (subscriptionLoading || onboardingComplete === null) {
    return null; // or a loading spinner
  }

  logger.debug('RootNavigator render:', { 
    authenticated: !!user, 
    onboardingComplete, 
    canAccessApp: canAccessApp(),
    showing: !user ? 'Auth' : !onboardingComplete ? 'Onboarding' : !canAccessApp() ? 'Paywall' : 'Main'
  });

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        // User is not authenticated - show auth screens
        <RootStack.Screen name="Auth" component={AuthStack} />
      ) : !onboardingComplete ? (
        // User is authenticated but hasn't completed onboarding
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        // User is authenticated and has completed onboarding
        // ProtectedScreen will handle subscription blocking
        <>
          <RootStack.Screen name="Main">
            {() => (
              <ProtectedScreen fallback={null}>
                <MainApp />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
          <RootStack.Screen name="Scanner">
            {() => (
              <ProtectedScreen fallback={null}>
                <ScannerScreen />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
          <RootStack.Screen name="Statistics">
            {() => (
              <ProtectedScreen fallback={null}>
                <StatisticsScreen />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
          <RootStack.Screen name="SupportChat">
            {() => (
              <ProtectedScreen fallback={null}>
                <SupportChatScreen />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
          <RootStack.Screen name="FAQ" component={FAQScreen} />
          <RootStack.Screen name="Reminders">
            {() => (
              <ProtectedScreen fallback={null}>
                <ReminderSettings />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
          <RootStack.Screen name="DataDebug">
            {() => (
              <ProtectedScreen fallback={null}>
                <DataDebugScreen />
              </ProtectedScreen>
            )}
          </RootStack.Screen>
        </>
      )}
      {/* Terms and Privacy available to both authed and unauth flows */}
      <RootStack.Screen name="Terms" component={TermsScreen} />
      <RootStack.Screen name="Privacy" component={PrivacyScreen} />
    </RootStack.Navigator>
  );
}

// Shopping List Context
export const ShoppingListContext = createContext();

function ShoppingListProvider({ children }) {
  const { userId } = useAuth();
  const [shoppingList, setShoppingList] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [accentKey, setAccentKey] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [foodInventory, setFoodInventory] = useState([]);
  const [spendingHistory, setSpendingHistory] = useState([]);
  const [monthlyBudget, setMonthlyBudget] = useState(null);

  // Load data from AsyncStorage on component mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        setIsLoading(true);
        logger.debug('Loading user data:', { hasUserId: !!userId });
        
        if (userId) {
          // Migrate existing data to user-specific storage
          await Promise.all([
            migrateToUserStorage(userId, 'foodInventory', 'foodInventory'),
            migrateToUserStorage(userId, 'shoppingList', 'shoppingList'),
            migrateToUserStorage(userId, 'spendingHistory', 'spendingHistory'),
          ]);
          
          // Load user-specific data
          const [storedInventory, storedShoppingList, storedDarkMode, storedSpendingHistory, storedAccentKey, storedMonthlyBudget] = await Promise.all([
            getUserData(userId, 'foodInventory', []),
            getUserData(userId, 'shoppingList', []),
            getUserData(userId, 'darkMode', false),
            getUserData(userId, 'spendingHistory', []),
            getUserData(userId, 'accentKey', 'default'),
            getUserData(userId, 'monthlyBudget', null),
          ]);

          logger.debug('User data loaded successfully:', { 
            inventoryItems: storedInventory.length,
            shoppingItems: storedShoppingList.length,
            spendingRecords: storedSpendingHistory.length
          });
          setFoodInventory(storedInventory);
          setShoppingList(storedShoppingList);
          setDarkMode(storedDarkMode);
          setSpendingHistory(storedSpendingHistory);
          setAccentKey(storedAccentKey);
          setMonthlyBudget(storedMonthlyBudget);
        } else {
          logger.debug('Using fallback storage (no user authentication)');
          // Fallback to non-user-specific storage for non-authenticated users
          const [storedInventory, storedShoppingList, storedDarkMode, storedSpendingHistory, storedAccentKey, storedMonthlyBudget] = await Promise.all([
            AsyncStorage.getItem('foodInventory'),
            AsyncStorage.getItem('shoppingList'),
            AsyncStorage.getItem('darkMode'),
            AsyncStorage.getItem('spendingHistory'),
            AsyncStorage.getItem('accentKey'),
            AsyncStorage.getItem('monthlyBudget'),
          ]);

          if (storedInventory) {
            setFoodInventory(JSON.parse(storedInventory));
          }
          
          if (storedShoppingList) {
            setShoppingList(JSON.parse(storedShoppingList));
          }

          if (storedDarkMode) {
            setDarkMode(JSON.parse(storedDarkMode));
          }

          if (storedSpendingHistory) {
            setSpendingHistory(JSON.parse(storedSpendingHistory));
          }
          if (storedAccentKey) {
            setAccentKey(storedAccentKey);
          } else {
            setAccentKey('default');
          }
          if (storedMonthlyBudget) {
            try { setMonthlyBudget(JSON.parse(storedMonthlyBudget)); } catch {}
          }
        }
        
      } catch (error) {
        logger.error('Failed to load data from storage:', error);
      } finally {
        setIsLoading(false);
        setDataLoaded(true);
        logger.info('Data loading completed, saves now enabled');
      }
    };

    loadStoredData();
  }, [userId]);

  // Save inventory to AsyncStorage whenever it changes
  useEffect(() => {
    // Don't save during initial loading to prevent overwriting with empty array
    if (!dataLoaded) {
      logger.debug('Skipping inventory save - data not yet loaded');
      return;
    }

    logger.debug('Inventory save triggered:', { 
      hasUserId: !!userId, 
      items: foodInventory.length, 
      dataLoaded 
    });

    if (userId) {
      setUserData(userId, 'foodInventory', foodInventory).then(() => {
        logger.debug('Successfully saved inventory to user storage');
      }).catch(e => {
        logger.error('Failed to save inventory to user storage:', e);
      });
    } else {
      logger.debug('Saving inventory to fallback storage, Items:', foodInventory.length);
      AsyncStorage.setItem('foodInventory', JSON.stringify(foodInventory)).then(() => {
        logger.debug('Successfully saved inventory to fallback storage');
      }).catch(e => {
        logger.error('Failed to save inventory to fallback storage:', e);
      });
    }
  }, [foodInventory, dataLoaded, userId]);

  // Save shoppingList to AsyncStorage whenever it changes
  useEffect(() => {
    // Don't save during initial loading to prevent overwriting with empty array
    if (!dataLoaded) return;

    logger.debug('Shopping list save triggered - Items:', shoppingList.length);

    if (userId) {
      setUserData(userId, 'shoppingList', shoppingList).then(() => {
        logger.debug('Successfully saved shopping list to user storage');
      }).catch(e => {
        logger.error('Failed to save shopping list to storage:', e);
      });
    } else {
      AsyncStorage.setItem('shoppingList', JSON.stringify(shoppingList)).then(() => {
        logger.debug('Successfully saved shopping list to fallback storage');
      }).catch(e => {
        logger.error('Failed to save shopping list to storage:', e);
      });
    }
  }, [shoppingList, dataLoaded, userId]);

  // Save darkMode to AsyncStorage whenever it changes
  useEffect(() => {
    // Don't save during initial loading to prevent overwriting with default values
    if (!dataLoaded) return;

    logger.debug('Dark mode preference save triggered:', darkMode);

    if (userId) {
      setUserData(userId, 'darkMode', darkMode).then(() => {
        logger.debug('Successfully saved dark mode to user storage');
      }).catch(e => {
        logger.error('Failed to save dark mode to storage:', e);
      });
    } else {
      AsyncStorage.setItem('darkMode', JSON.stringify(darkMode)).then(() => {
        logger.debug('Successfully saved dark mode to fallback storage');
      }).catch(e => {
        logger.error('Failed to save dark mode to storage:', e);
      });
    }
  }, [darkMode, dataLoaded, userId]);

  // Save spendingHistory to AsyncStorage whenever it changes
  useEffect(() => {
    // Don't save during initial loading to prevent overwriting with empty array
    if (!dataLoaded) return;

    logger.debug('Spending history save triggered - Records:', spendingHistory.length);

    if (userId) {
      setUserData(userId, 'spendingHistory', spendingHistory).then(() => {
        logger.debug('Successfully saved spending history to user storage');
      }).catch(e => {
        logger.error('Failed to save spending history to storage:', e);
      });
    } else {
      AsyncStorage.setItem('spendingHistory', JSON.stringify(spendingHistory)).then(() => {
        logger.debug('Successfully saved spending history to fallback storage');
      }).catch(e => {
        logger.error('Failed to save spending history to storage:', e);
      });
    }
  }, [spendingHistory, dataLoaded, userId]);

  // Save monthlyBudget when it changes
  useEffect(() => {
    if (isLoading) return;
    if (userId) {
      setUserData(userId, 'monthlyBudget', monthlyBudget).catch(() => {});
    } else {
      AsyncStorage.setItem('monthlyBudget', JSON.stringify(monthlyBudget)).catch(() => {});
    }
  }, [monthlyBudget, isLoading, userId]);

  // Save accentKey to storage when it changes
  useEffect(() => {
    if (userId) {
      setUserData(userId, 'accentKey', accentKey).catch(() => {});
    } else {
      AsyncStorage.setItem('accentKey', accentKey).catch(() => {});
    }
  }, [accentKey, userId]);

  const addToShoppingList = useCallback((item) => {
    setShoppingList((prev) => {
      if (prev.find((i) => i.barcode && item.barcode && i.barcode === item.barcode)) {
        // Use Alert from react-native instead of window.alert
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const removeFromShoppingList = useCallback((itemId) => {
    setShoppingList((prev) => prev.filter((item) => String(item.id) !== String(itemId)));
  }, []);

  const markShoppingItemAsDone = useCallback((itemId) => {
    setShoppingList((prev) => prev.map((item) => 
      item.id === itemId 
        ? { ...item, isDone: true, completedAt: new Date().toISOString() }
        : item
    ));
  }, []);

  const unmarkShoppingItemAsDone = useCallback((itemId) => {
    setShoppingList((prev) => prev.map((item) => 
      item.id === itemId 
        ? { ...item, isDone: false, completedAt: null }
        : item
    ));
  }, []);

  const clearCompletedItems = useCallback(() => {
    setShoppingList((prev) => prev.filter((item) => !item.isDone));
  }, []);

  const updateShoppingItem = useCallback((itemId, updates) => {
    setShoppingList(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
  }, []);

  // Add spending record when item is added to inventory
  const addSpendingRecord = useCallback((item) => {
    setSpendingHistory(prev => [...prev, {
      id: Date.now().toString(),
      name: item.name,
      price: item.price || 0,
      quantity: item.quantity || 1,
      category: item.category || 'Uncategorized',
      dateSpent: new Date().toLocaleDateString('en-CA'),
      isConsumed: false
    }]);
  }, []);

  // Mark item as consumed in spending history
  const markItemAsConsumed = useCallback((itemName, barcode = null) => {
    setSpendingHistory(prev => prev.map(record => {
      // Match by name or barcode
      const isMatch = (barcode && record.barcode === barcode) || 
                     (record.name.toLowerCase() === itemName.toLowerCase());
      
      if (isMatch && !record.isConsumed) {
        return { ...record, isConsumed: true };
      }
      return record;
    }));
  }, []);

  // Helper function to add sample spending data for testing
  const addSampleFinanceData = useCallback(() => {
    const sampleItems = [
      { name: 'Bread', price: 1.50, quantity: 1, category: 'Bakery' },
      { name: 'Milk', price: 1.20, quantity: 2, category: 'Dairy' },
      { name: 'Chicken Breast', price: 4.99, quantity: 1, category: 'Meat' },
      { name: 'Bananas', price: 1.10, quantity: 3, category: 'Fruit' },
      { name: 'Pasta', price: 0.89, quantity: 2, category: 'Pantry' },
    ];
    
    sampleItems.forEach((item, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index * 2); // Spread over recent days
      
      setSpendingHistory(prev => [...prev, {
        id: `sample-${Date.now()}-${index}`,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
        dateSpent: date.toISOString().split('T')[0],
        isConsumed: Math.random() > 0.5
      }]);
    });
  }, []);

  // Remove only sample finance entries (those inserted by the sample button)
  const clearSampleFinanceData = useCallback(() => {
    setSpendingHistory(prev => prev.filter(r => !(r.id && String(r.id).startsWith('sample-'))));
  }, []);

  return (
    <ShoppingListContext.Provider value={{ 
      shoppingList, 
      addToShoppingList, 
      removeFromShoppingList, 
      markShoppingItemAsDone,
      unmarkShoppingItemAsDone,
      clearCompletedItems,
      darkMode, 
      setDarkMode, 
      accentKey,
      setAccentKey,
      foodInventory, 
      setFoodInventory,
      spendingHistory,
      addSpendingRecord,
      markItemAsConsumed,
      updateShoppingItem,
      monthlyBudget,
      setMonthlyBudget,
      addSampleFinanceData,
      clearSampleFinanceData,
      isLoading 
    }}>
      {children}
    </ShoppingListContext.Provider>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainApp() {
  const { user } = useAuth();
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const isDefault = !accentKey || accentKey === 'default';
  const [selectedFeatures, setSelectedFeatures] = React.useState(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    const getSelection = async () => {
      try {
        const selection = await AsyncStorage.getItem('onboardingSelection');
        if (selection) {
          setSelectedFeatures(JSON.parse(selection));
          logger.debug('MainApp: Loaded selection');
        } else {
          setSelectedFeatures([]);
          logger.debug('MainApp: No selection found');
        }
      } catch (e) {
        setSelectedFeatures([]);
        logger.warn('MainApp: Error loading selection');
      }
    };
    getSelection();
  }, [refreshTrigger]); // Re-run when onboarding is completed

  // Check for refresh trigger
  React.useEffect(() => {
    if (global.refreshMainAppSelection) {
      global.refreshMainAppSelection = false;
      setRefreshTrigger(prev => prev + 1);
    }
  });

  if (selectedFeatures === null) {
    return null; // or a loading spinner
  }

  // If 'all' is selected, show all features
  const showAll = selectedFeatures.includes('all');
  const showCalorie = showAll || selectedFeatures.includes('calorie');
  const showMeal = showAll || selectedFeatures.includes('meal');
  const showInventory = showAll || selectedFeatures.includes('inventory');
  const showShopping = showAll || selectedFeatures.includes('shopping');
  const showFinance = showAll || selectedFeatures.includes('finance');

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: isDefault ? theme.text : theme.accent,
        drawerInactiveTintColor: isDefault ? theme.text : theme.accent,
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreenLanding}
        options={{
          drawerLabel: 'Home',
          title: 'Home',
          headerShown: false,
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      {showInventory && (
        <Drawer.Screen
          name="Food Inventory"
          component={FoodInventoryScreen}
          options={{
            headerShown: false,
            drawerLabel: 'Food Inventory',
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="food-apple-outline" color={color} size={size} />
            ),
          }}
        />
      )}
      {showShopping && (
        <Drawer.Screen
          name="Shopping List"
          component={ShoppingListScreen}
          options={{
            headerShown: false,
            drawerLabel: 'Shopping List',
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cart-outline" color={color} size={size} />
            ),
          }}
        />
      )}
      {showCalorie && (
        <Drawer.Screen
          name="Calorie Counter"
          component={Calorie}
          options={{
            headerShown: false,
            drawerLabel: 'Calorie Counter',
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="fire" color={color} size={size} />
            ),
          }}
        />
      )}
      {showFinance && (
        <Drawer.Screen
          name="Finance"
          component={FinanceScreen}
          options={{
            headerShown: false,
            drawerLabel: 'Finance',
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cash-multiple" color={color} size={size} />
            ),
          }}
        />
      )}
      {showMeal && (
        <>
          <Drawer.Screen
            name="Meal Maker"
            component={MealMaker}
            options={{
              headerShown: false,
              drawerLabel: 'Meal Maker',
              drawerIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="food-variant" color={color} size={size} />
              ),
            }}
          />
          <Drawer.Screen
            name="Meal Planner"
            component={MealPlannerScreen}
            options={{
              headerShown: false,
              drawerLabel: 'Meal Planner',
              drawerIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="calendar-week" color={color} size={size} />
              ),
            }}
          />
        </>
      )}
    
      
      {/* Referral System */}
      <Drawer.Screen
        name="ReferralScreen"
        component={ReferralScreen}
        options={{
          headerShown: false,
          drawerLabel: 'Invite Friends',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-multiple-plus" color="#10B981" size={size} />
          ),
        }}
      />
      
      {/* Hidden screens for navigation only */}
      <Drawer.Screen
        name="Progress"
        component={GamificationScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { height: 0, opacity: 0, display: 'none' },
          drawerLabel: 'Progress',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="trophy" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { height: 0, opacity: 0, display: 'none' },
          drawerLabel: 'Profile',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
      
    </Drawer.Navigator>
  );
}

// Navigation themes matching app themes
const NavigationLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    border: '#E2E8F0',
    primary: '#3B82F6',
  },
};

const NavigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F172A',
    card: '#1E293B',
    text: '#F8FAFC',
    border: '#334155',
    primary: '#60A5FA',
  },
};

function CustomDrawerContent(props) {
  const { darkMode, setDarkMode } = useContext(ShoppingListContext);
  const { colors } = useTheme();
  const navigation = props.navigation;
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1, paddingBottom: 0, backgroundColor: colors.background }}>
      <DrawerItemList {...props} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', padding: 20, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={[styles.iconButton, { marginRight: 10 }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="account" size={28} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDarkMode(!darkMode)}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={darkMode ? 'weather-sunny' : 'weather-night'}
            size={24}
            color={darkMode ? colors.primary : colors.text}
          />
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

function HomeHeaderLeft() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={{ marginLeft: 16 }}
    >
      <MaterialCommunityIcons name="menu" size={28} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set up network status listener
    const unsubscribe = offlineManager.addNetworkListener((online) => {
      setIsOnline(online);
    });

    // Hide splash screen after a delay
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Track daily login for gamification
  useEffect(() => {
    const trackDailyLogin = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastLogin = await AsyncStorage.getItem('lastLoginDate');
        
        if (lastLogin !== today) {
          await AsyncStorage.setItem('lastLoginDate', today);
          // This will be handled by the gamification system
        }
      } catch (error) {
        logger.error('Failed to track daily login:', error);
      }
    };

    if (!showSplash) {
      trackDailyLogin();
    }
  }, [showSplash]);

  return (
    <CriticalErrorBoundary userMessage="PantryPal encountered a critical error. Please restart the app.">
      <AuthProvider>
        <SubscriptionProvider>
          <GamificationProvider>
            <ShoppingListProvider>
            <ShoppingListContext.Consumer>
            {({ darkMode, isLoading, accentKey }) => {
              if (isLoading || showSplash) {
                const theme = getTheme(accentKey, darkMode);
                return (
                  <SplashScreen 
                    onFinish={() => setShowSplash(false)} 
                    theme={theme}
                  />
                );
              }
              
              const theme = getTheme(accentKey, darkMode);
              const isDefault = !accentKey || accentKey === 'default';
              const dynamicTheme = darkMode
                ? (isDefault
                    ? NavigationDarkTheme
                    : { ...NavigationDarkTheme, colors: { ...NavigationDarkTheme.colors, text: theme.accent, primary: theme.accent } })
                : (isDefault
                    ? NavigationLightTheme
                    : { ...NavigationLightTheme, colors: { ...NavigationLightTheme.colors, text: theme.accent, primary: theme.accent } });
              
              return (
                <NavigationContainer ref={navigationRef} theme={dynamicTheme}>
                  <NetworkStatus isOnline={isOnline} theme={theme} />
                  <RootNavigator />
                  <AchievementNotification 
                    visible={false}
                    achievement={null}
                    onHide={() => {}}
                  />
                </NavigationContainer>
              );
            }}
          </ShoppingListContext.Consumer>
            </ShoppingListProvider>
          </GamificationProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </CriticalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  drawerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    padding: 20,
    borderTopWidth: 1,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
  },
});