import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import AsyncStorage from './AsyncStorageWrapper';
import Svg, { Circle } from 'react-native-svg';
import { format } from 'date-fns';

import { getTheme } from './theme';
import { useGamification } from './Gamification';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';
import { PieChart, LineChart } from 'react-native-chart-kit';
import BarcodeScannerModal from './BarcodeScannerModal';
import { calorieStyles } from './CalorieStyles';
import OverviewTab from './components/calorie/tabs/OverviewTab';
import { TabBar } from './components/calorie/CalorieComponents';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Meal timing categories with emojis and better styling
const MEAL_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'coffee', color: '#7C9DF2', emoji: '🌅', time: '7:30 AM' },
  { id: 'lunch', name: 'Lunch', icon: 'food', color: '#24A19C', emoji: '☀️', time: '12:00 PM' },
  { id: 'dinner', name: 'Dinner', icon: 'silverware-fork-knife', color: '#7F5AF0', emoji: '🌙', time: '6:00 PM' },
  { id: 'snacks', name: 'Snacks', icon: 'cookie', color: '#FF8A34', emoji: '🍿', time: '8:30 PM' }
];

// Goal presets for different fitness objectives
const GOAL_PRESETS = [
  {
    id: 'maintain',
    name: 'Maintain Weight',
    description: 'Keep your current weight',
    icon: 'scale-balance',
    color: '#10B981',
    emoji: '⚖️',
    calories: 2000,
    activityLevel: 'moderate'
  },
  {
    id: 'lose',
    name: 'Lose Weight',
    description: 'Create a calorie deficit',
    icon: 'trending-down',
    color: '#EF4444',
    emoji: '📉',
    calories: 1500,
    activityLevel: 'moderate'
  },
  {
    id: 'gain',
    name: 'Gain Weight',
    description: 'Increase calorie intake',
    icon: 'trending-up',
    color: '#F59E0B',
    emoji: '📈',
    calories: 2500,
    activityLevel: 'moderate'
  },
  {
    id: 'muscle',
    name: 'Build Muscle',
    description: 'High protein, moderate surplus',
    icon: 'dumbbell',
    color: '#8B5CF6',
    emoji: '💪',
    calories: 2200,
    activityLevel: 'high'
  }
];

// Enhanced food database with more variety and better nutritional data
const FOOD_DATABASE = [
  // Fruits
  { id: 1, name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, vitaminC: 8.4, potassium: 195, serving: '1 medium (182g)', category: 'Fruits', emoji: '🍎' },
  { id: 2, name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, vitaminC: 10.3, potassium: 422, serving: '1 medium (118g)', category: 'Fruits', emoji: '🍌' },
  { id: 3, name: 'Orange', calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, fiber: 3.1, vitaminC: 70, potassium: 237, serving: '1 medium (154g)', category: 'Fruits', emoji: '🍊' },
  { id: 4, name: 'Strawberries', calories: 49, protein: 1, carbs: 12, fat: 0.5, fiber: 3, vitaminC: 89.4, potassium: 233, serving: '1 cup (152g)', category: 'Fruits', emoji: '🍓' },

  // Proteins
  { id: 5, name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, iron: 0.9, zinc: 0.9, serving: '100g', category: 'Proteins', emoji: '🍗' },
  { id: 6, name: 'Salmon', calories: 206, protein: 22, carbs: 0, fat: 12, fiber: 0, omega3: 1.8, vitaminD: 11, serving: '100g', category: 'Proteins', emoji: '🐟' },
  { id: 7, name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0, calcium: 200, probiotics: 1, serving: '1 cup (170g)', category: 'Proteins', emoji: '🥛' },
  { id: 8, name: 'Eggs', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, choline: 147, vitaminB12: 0.9, serving: '2 large eggs (100g)', category: 'Proteins', emoji: '🥚' },
  { id: 9, name: 'Tuna', calories: 132, protein: 28, carbs: 0, fat: 1.3, fiber: 0, omega3: 0.3, selenium: 90, serving: '100g', category: 'Proteins', emoji: '🐟' },

  // Grains & Carbs
  { id: 10, name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 4, magnesium: 84, manganese: 1.8, serving: '1 cup cooked (195g)', category: 'Grains', emoji: '🍚' },
  { id: 11, name: 'Oatmeal', calories: 154, protein: 5.3, carbs: 28, fat: 3.2, fiber: 4, betaGlucan: 3, iron: 2.1, serving: '1 cup cooked (234g)', category: 'Grains', emoji: '🥣' },
  { id: 12, name: 'Quinoa', calories: 222, protein: 8, carbs: 39, fat: 3.6, fiber: 5, iron: 2.8, magnesium: 118, serving: '1 cup cooked (185g)', category: 'Grains', emoji: '🌾' },
  { id: 13, name: 'Whole Wheat Bread', calories: 81, protein: 4, carbs: 14, fat: 1.1, fiber: 2, folate: 14, iron: 0.9, serving: '1 slice (28g)', category: 'Grains', emoji: '🍞' },

  // Vegetables
  { id: 14, name: 'Broccoli', calories: 25, protein: 3, carbs: 5, fat: 0.3, fiber: 2, vitaminC: 89.2, vitaminK: 101.6, serving: '1 cup (91g)', category: 'Vegetables', emoji: '🥦' },
  { id: 15, name: 'Spinach', calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, iron: 0.8, folate: 58, serving: '1 cup (30g)', category: 'Vegetables', emoji: '🥬' },
  { id: 16, name: 'Sweet Potato', calories: 112, protein: 2, carbs: 26, fat: 0.1, fiber: 3.9, vitaminA: 1096, potassium: 542, serving: '1 medium (128g)', category: 'Vegetables', emoji: '🍠' },
  { id: 17, name: 'Carrots', calories: 25, protein: 0.5, carbs: 6, fat: 0.1, fiber: 1.7, vitaminA: 509, betaCarotene: 5054, serving: '1 medium (61g)', category: 'Vegetables', emoji: '🥕' },

  // Healthy Fats
  { id: 18, name: 'Avocado', calories: 234, protein: 2.9, carbs: 12, fat: 21, fiber: 10, potassium: 690, folate: 81, serving: '1 medium (150g)', category: 'Healthy Fats', emoji: '🥑' },
  { id: 19, name: 'Almonds', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 3.5, vitaminE: 7.3, magnesium: 76, serving: '1 oz (28g)', category: 'Healthy Fats', emoji: '🥜' },
  { id: 20, name: 'Olive Oil', calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, vitaminE: 1.9, vitaminK: 8.1, serving: '1 tbsp (13.5g)', category: 'Healthy Fats', emoji: '🫒' },
];

// Helper: format Date to local YYYY-MM-DD
const toLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Helper to get today's date string (YYYY-MM-DD) in local time
const getTodayKey = () => {
  const now = new Date();
  return toLocalDateKey(now);
};

// Build an array of date keys for the past N days (oldest -> newest)
const getPastDateKeys = (n) => {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(toLocalDateKey(d));
  }
  return keys;
};

// Compute a simple rolling average for an array of values
const computeRollingAverage = (values, window = 3) => {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - (window - 1));
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(Math.round(avg));
  }
  return out;
};

export default function CalorieCounterScreen() {
  const navigation = useNavigation();
  const { darkMode, setDarkMode, foodInventory, setFoodInventory, markItemAsConsumed, accentKey } = useContext(ShoppingListContext);
  const { userId } = useAuth();
  const theme = getTheme(accentKey, darkMode);
  const { updateStats, checkAchievements, unlockAchievement } = useGamification();
  
  const isDefault = !accentKey || accentKey === 'default';
  
  // Animation refs
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // Collapsible state
  const [isCalorieRingCollapsed, setIsCalorieRingCollapsed] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);
  const calorieRingHeight = useRef(new Animated.Value(1)).current;
  const timelineHeight = useRef(new Animated.Value(1)).current;
  const timelineExpandHeight = useRef(new Animated.Value(1)).current;
  
  // State management
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [consumedFoods, setConsumedFoods] = useState([]);
  
  // Debug consumedFoods state changes
  useEffect(() => {
    console.log('=== CONSUMED FOODS STATE CHANGE ===');
    console.log('consumedFoods length:', consumedFoods.length);
    console.log('consumedFoods:', consumedFoods);
    console.log('=== END CONSUMED FOODS STATE CHANGE ===');
  }, [consumedFoods]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedGoalPreset, setSelectedGoalPreset] = useState(null);
  const [customGoal, setCustomGoal] = useState('');
  const [goalType, setGoalType] = useState('maintain'); // maintain, lose, gain, muscle
  const [newGoal, setNewGoal] = useState('2000');

  // Portion selection for scanned/API items
  const [portionMode, setPortionMode] = useState('servings'); // 'servings' | 'grams' | 'percent'
  const [servingsInput, setServingsInput] = useState('1');
  const [gramsInput, setGramsInput] = useState('');
  const [percentInput, setPercentInput] = useState('0');
  const [logDate, setLogDate] = useState(getTodayKey());
  const [isToday, setIsToday] = useState(true);
  const [selectedMealCategory, setSelectedMealCategory] = useState('breakfast');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [savedMeals, setSavedMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calorieDataLoaded, setCalorieDataLoaded] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showWeekView, setShowWeekView] = useState(false);
  const [weeklyData, setWeeklyData] = useState({});
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [progressViewIndex, setProgressViewIndex] = useState(0);
  const [showMacroPresets, setShowMacroPresets] = useState(false);
  const [showNutritionGoals, setShowNutritionGoals] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState({
    protein: 150,
    carbs: 200,
    fat: 65,
    fiber: 25
  });
  const [apiSearchResults, setApiSearchResults] = useState([]);
  const [apiSearchLoading, setApiSearchLoading] = useState(false);
  const [apiSearchError, setApiSearchError] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [manualFoodName, setManualFoodName] = useState('');
  const [manualFoodCalories, setManualFoodCalories] = useState('');
  const [manualFoodProtein, setManualFoodProtein] = useState('');
  const [manualFoodCarbs, setManualFoodCarbs] = useState('');
  const [manualFoodFat, setManualFoodFat] = useState('');
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [selectedMealForAdd, setSelectedMealForAdd] = useState('breakfast');
  const [savedMealsFromMaker, setSavedMealsFromMaker] = useState([]);
  const [loadingSavedMeals, setLoadingSavedMeals] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dataDateRef = useRef(logDate);
  const [currentDataDate, setCurrentDataDate] = useState(getTodayKey());

  // Analytics: timeframe and weekly series state
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState(7); // 7 | 14 | 30
  const [weeklySeries, setWeeklySeries] = useState({ labels: [], totals: [], rolling: [], stats: null });
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Load consumed foods whenever the selected date (logDate) changes
  useEffect(() => {
    let isMounted = true;

    const loadConsumedFoodsForDate = async (dateKey) => {
      try {
        setIsLoadingData(true);
        setCalorieDataLoaded(false);

        let stored = [];
        if (userId) {
          // Ensure any existing non-user data is migrated for this date key
          const oldKey = `consumedFoods-${dateKey}`;
          const userKey = `user_${userId}_consumedFoods-${dateKey}`;
          console.log('[Calorie] Migrating if needed from', oldKey, 'to', userKey);
          await migrateToUserStorage(userId, oldKey, `consumedFoods-${dateKey}`);
          console.log('[Calorie] Loading user data from', userKey);
          stored = await getUserData(userId, `consumedFoods-${dateKey}`, []);
        } else {
          const key = `consumedFoods-${dateKey}`;
          console.log('[Calorie] Loading anon data from', key);
          const raw = await AsyncStorage.getItem(key);
          stored = raw ? JSON.parse(raw) : [];
        }

        if (isMounted && dateKey === logDate) {
          // Sanity filter: only keep items that belong to this date by timestamp
          let filtered = Array.isArray(stored) ? stored.filter(item => {
            const ts = item?.updatedAt || item?.addedAt;
            if (!ts) {
              // If no timestamp, only accept items for today to avoid cross-day bleed
              return dateKey === getTodayKey();
            }
            const itemDateKey = toLocalDateKey(new Date(ts));
            return itemDateKey === dateKey;
          }) : [];

          console.log('[Calorie] Applying loaded foods for', dateKey, 'stored:', Array.isArray(stored) ? stored.length : 0, 'filtered:', filtered.length);
          console.log('[Calorie] Loaded foods:', filtered);
          // Ensure ref points to the actual date of this data
          dataDateRef.current = dateKey;
          // Set a fresh array instance to guarantee state change
          setConsumedFoods([...filtered]);
          setCalorieDataLoaded(true);
        } else {
          console.log('[Calorie] Skipped applying load for', dateKey, 'because current is', logDate);
        }
      } catch (err) {
        console.warn('Failed to load consumed foods for', dateKey, err);
        if (isMounted && dateKey === logDate) {
          setConsumedFoods([]);
          setCalorieDataLoaded(true);
        }
      } finally {
        if (isMounted && dateKey === logDate) {
          setIsLoadingData(false);
        }
      }
    };

    dataDateRef.current = logDate; // remember which date this load is for
    setCurrentDataDate(logDate);
    // Clear existing list immediately to avoid stale UI during async load
    setConsumedFoods([]);
    loadConsumedFoodsForDate(logDate);
    return () => { isMounted = false; };
  }, [logDate, userId]);

  // Load daily goal once on mount
  useEffect(() => {
    (async () => {
      try {
        const goal = await AsyncStorage.getItem('dailyCalorieGoal');
        if (goal) setDailyGoal(parseInt(goal));
      } catch (e) {
        console.warn('Failed to load dailyCalorieGoal');
      }
    })();
  }, []);

  // Persist consumed foods for the active date, but only after initial load completes
  useEffect(() => {
    if (!calorieDataLoaded || isLoadingData) return;

    const targetDate = dataDateRef.current; // save to the date that the data belongs to
    const storageKey = `consumedFoods-${targetDate}`;

    const timeoutId = setTimeout(async () => {
      try {
        console.log('=== STORAGE DEBUG ===');
        console.log('About to save consumedFoods, length:', consumedFoods.length);
        console.log('consumedFoods array:', consumedFoods);
        console.log('storageKey:', storageKey);
        console.log('userId:', userId);
        console.log('=== END STORAGE DEBUG ===');
        
        if (userId) {
          await setUserData(userId, storageKey, consumedFoods);
          console.log('[Calorie] Saved to user storage:', storageKey, 'count:', consumedFoods.length);
        } else {
          await AsyncStorage.setItem(storageKey, JSON.stringify(consumedFoods));
          console.log('[Calorie] Saved to anon storage:', storageKey, 'count:', consumedFoods.length);
        }
      } catch (err) {
        console.warn('Failed to save consumed foods for', targetDate, err);
      }
    }, 400); // debounce like old screen to avoid rapid saves

    return () => clearTimeout(timeoutId);
  }, [consumedFoods, userId, calorieDataLoaded, isLoadingData]);

  // Load weekly series when Analytics tab is active or timeframe changes
  useEffect(() => {
    if (activeTab !== 'analytics') return;

    const loadWeekly = async () => {
      try {
        setWeeklyLoading(true);
        const keys = getPastDateKeys(analyticsTimeframe);

        const totals = [];
        for (const key of keys) {
          let items = [];
          if (userId) {
            items = await getUserData(userId, `consumedFoods-${key}`, []);
          } else {
            const raw = await AsyncStorage.getItem(`consumedFoods-${key}`);
            items = raw ? JSON.parse(raw) : [];
          }
          const dayTotal = Array.isArray(items)
            ? items.reduce((sum, f) => {
                const cal = typeof f.portionCalories === 'number'
                  ? f.portionCalories
                  : ((f.calories || 0) * (f.quantity || 1));
                return sum + cal;
              }, 0)
            : 0;
          totals.push(Math.round(dayTotal));
        }

        const rolling = computeRollingAverage(totals, 3);
        const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
        const best = totals.length ? Math.max(...totals) : 0;
        const worst = totals.length ? Math.min(...totals) : 0;
        const adherence = totals.filter(t => Math.abs(t - dailyGoal) <= (dailyGoal * 0.1)).length;

        setWeeklySeries({
          labels: keys.map(k => format(new Date(k + 'T12:00:00'), analyticsTimeframe > 7 ? 'MM/dd' : 'EEE')),
          totals,
          rolling,
          stats: { avg, best, worst, adherence, days: totals.length }
        });
      } catch (e) {
        console.warn('Failed to load weekly analytics', e);
        setWeeklySeries({ labels: [], totals: [], rolling: [], stats: null });
      } finally {
        setWeeklyLoading(false);
      }
    };

    loadWeekly();
  }, [activeTab, analyticsTimeframe, userId, dailyGoal]);

  // Calculate daily totals
  console.log('=== DAILY TOTALS CALCULATION START ===');
  console.log('consumedFoods array length:', consumedFoods.length);
  console.log('consumedFoods array:', consumedFoods);
  console.log('=== DAILY TOTALS CALCULATION START ===');
  
  const dailyTotals = consumedFoods.reduce((totals, food) => {
    console.log('=== DAILY TOTALS DEBUG ===');
    console.log('Processing food:', food.name);
    console.log('portionCalories:', food.portionCalories);
    console.log('portionCalories type:', typeof food.portionCalories);
    console.log('isApiResult:', food.isApiResult);
    console.log('serving_size_g:', food.serving_size_g);
    console.log('calories:', food.calories);
    console.log('quantity:', food.quantity);
    console.log('Full food object:', food);
    
    if (typeof food.portionCalories === 'number') {
      // For API results with portion calories, use the portion calories directly
      // and scale macros based on the serving size ratio
      if (food.isApiResult && food.serving_size_g) {
        // Calculate the ratio of actual serving to 100g serving
        const servingRatio = food.serving_size_g / 100;
        console.log('Using API result path, servingRatio:', servingRatio);
        console.log('Adding portionCalories:', food.portionCalories);
        const result = {
          calories: totals.calories + food.portionCalories,
          protein: totals.protein + ((food.protein || 0) * servingRatio),
          carbs: totals.carbs + ((food.carbs || 0) * servingRatio),
          fat: totals.fat + ((food.fat || 0) * servingRatio),
          fiber: totals.fiber + ((food.fiber || 0) * servingRatio),
        };
        console.log('Result calories:', result.calories);
        console.log('=== END DAILY TOTALS DEBUG ===');
        return result;
      } else {
        // For other foods with portion calories, use the portion calories directly
        console.log('Using other portion calories path');
        console.log('Adding portionCalories:', food.portionCalories);
        const result = {
          calories: totals.calories + food.portionCalories,
          protein: totals.protein + (food.protein || 0),
          carbs: totals.carbs + (food.carbs || 0),
          fat: totals.fat + (food.fat || 0),
          fiber: totals.fiber + (food.fiber || 0),
        };
        console.log('Result calories:', result.calories);
        console.log('=== END DAILY TOTALS DEBUG ===');
        return result;
      }
    }
    const multiplier = food.quantity || 1;
    console.log('Using fallback path, multiplier:', multiplier);
    console.log('Adding calories:', (food.calories || 0) * multiplier);
    const result = {
      calories: totals.calories + ((food.calories || 0) * multiplier),
      protein: totals.protein + ((food.protein || 0) * multiplier),
      carbs: totals.carbs + ((food.carbs || 0) * multiplier),
      fat: totals.fat + ((food.fat || 0) * multiplier),
      fiber: totals.fiber + ((food.fiber || 0) * multiplier)
    };
    console.log('Result calories:', result.calories);
    console.log('=== END DAILY TOTALS DEBUG ===');
    return result;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  console.log('=== FINAL DAILY TOTALS RESULT ===');
  console.log('dailyTotals:', dailyTotals);
  console.log('dailyTotals.calories:', dailyTotals.calories);
  console.log('=== END FINAL DAILY TOTALS RESULT ===');

  const remainingCalories = dailyGoal - dailyTotals.calories;

  // Meal totals (for Overview cards)
  const mealTotals = useMemo(() => {
    const grouped = consumedFoods.reduce((acc, food) => {
      const key = food.mealCategory || 'snacks';
      if (!acc[key]) acc[key] = 0;
      const cal = typeof food.portionCalories === 'number'
        ? food.portionCalories
        : (food.calories || 0) * (food.quantity || 1);
      acc[key] += cal;
      return acc;
    }, {});
    return [
      { id: 'breakfast', name: 'Breakfast', color: '#7C9DF2', emoji: '🌅', calories: Math.round(grouped.breakfast || 0) },
      { id: 'lunch', name: 'Lunch', color: '#24A19C', emoji: '☀️', calories: Math.round(grouped.lunch || 0) },
      { id: 'dinner', name: 'Dinner', color: '#7F5AF0', emoji: '🌙', calories: Math.round(grouped.dinner || 0) },
      { id: 'snacks', name: 'Snacks', color: '#FF8A34', emoji: '🍿', calories: Math.round(grouped.snacks || 0) },
    ];
  }, [consumedFoods]);

  // Tabs state
  const [activeTab, setActiveTab] = useState('log');
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'view-dashboard' },
    { id: 'log', label: 'Log', icon: 'book-open' },
    { id: 'analytics', label: 'Analytics', icon: 'chart-line' },
  ];

  const progressPercentage = dailyGoal > 0 ? Math.min((dailyTotals.calories / dailyGoal) * 100, 100) : 0;

  // Format portion text for display in meal list
  const formatPortionText = (food) => {
    if (food.portionMode === 'servings') return `${food.servingsInput || 1} serving${(parseFloat(food.servingsInput) || 1) !== 1 ? 's' : ''}`;
    if (food.portionMode === 'grams') return `${food.gramsInput || 0}g`;
    if (food.portionMode === 'percent') return `${food.percentInput || 0}% of pack`;
    return `${food.quantity || 1} serving${(food.quantity || 1) !== 1 ? 's' : ''}`;
  };

  // Helper function for nutrition grade colors
  const getNutritionGradeColor = (grade) => {
    switch (grade.toLowerCase()) {
      case 'a': return '#10B981'; // Green
      case 'b': return '#84CC16'; // Light green
      case 'c': return '#F59E0B'; // Yellow
      case 'd': return '#F97316'; // Orange
      case 'e': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // Add food to consumed list
  const addFoodToMeal = (food, mealCategory = selectedMealCategory) => {
    // Allow adding items for any date being viewed

    // Compute portion-aware calories if this is a scanned/API item with per-100g data
    const hasPer100 = typeof food.calories === 'number' && food.calories > 0 && (selectedFood?.isApiResult || food.isApiResult);
    const c100 = hasPer100 ? Number(food.calories) || 0 : 0; // per 100g kcal
    let portionCalories = null;
    
    console.log('=== CALORIE CALCULATION DEBUG ===');
    console.log('hasPer100:', hasPer100);
    console.log('food.calories:', food.calories);
    console.log('selectedFood?.isApiResult:', selectedFood?.isApiResult);
    console.log('food.isApiResult:', food.isApiResult);
    console.log('c100:', c100);
    console.log('portionMode:', portionMode);
    console.log('selectedFood?.serving_size_g:', selectedFood?.serving_size_g);
    console.log('food.serving_size_g:', food.serving_size_g);
    
    if (hasPer100) {
      if (portionMode === 'servings') {
        const s = parseFloat(servingsInput) || 0;
        const gramsPerServing = selectedFood?.serving_size_g || food.serving_size_g || 30; // prefer real serving size if available
        portionCalories = s * (c100 * gramsPerServing / 100);
        console.log('Servings calculation:', { 
          servingsInput, 
          s, 
          c100, 
          gramsPerServing, 
          calculation: `${s} * (${c100} * ${gramsPerServing} / 100)`,
          portionCalories 
        });
      } else if (portionMode === 'grams') {
        const g = parseFloat(gramsInput) || 0;
        portionCalories = c100 * g / 100;
        console.log('Grams calculation:', { 
          gramsInput, 
          g, 
          c100, 
          calculation: `${c100} * ${g} / 100`,
          portionCalories 
        });
      } else if (portionMode === 'percent') {
        const pct = Math.max(0, Math.min(100, parseFloat(percentInput) || 0));
        const packageGrams = selectedFood?.package_size_g || 100; // if we add package size later
        const g = packageGrams * (pct / 100);
        portionCalories = c100 * g / 100;
        console.log('Percent calculation:', { 
          percentInput, 
          pct, 
          packageGrams, 
          g, 
          c100, 
          calculation: `${c100} * ${g} / 100`,
          portionCalories 
        });
      }
    }
    
    console.log('Final portionCalories:', portionCalories);
    console.log('=== END DEBUG ===');
    
    // Debug the food object being saved
    console.log('=== FOOD OBJECT DEBUG ===');
    console.log('Food being saved:', {
      name: food.name,
      calories: food.calories,
      portionCalories: portionCalories,
      isApiResult: selectedFood?.isApiResult,
      serving_size_g: selectedFood?.serving_size_g,
      hasPer100: hasPer100
    });
    console.log('=== END FOOD DEBUG ===');

    // Check if we're editing an existing food item (only if it's already in consumedFoods)
    const existingFood = consumedFoods.find(f => f.id === selectedFood?.id);
    console.log('=== BRANCH DEBUG ===');
    console.log('selectedFood?.id:', selectedFood?.id);
    console.log('existingFood:', existingFood);
    console.log('Will take editing branch:', !!(selectedFood && selectedFood.id && existingFood));
    console.log('Will take adding branch:', !(selectedFood && selectedFood.id && existingFood));
    console.log('=== END BRANCH DEBUG ===');
    
    if (selectedFood && selectedFood.id && existingFood) {
      setConsumedFoods(prev => prev.map(f => 
        f.id === selectedFood.id 
          ? {
              ...f,
              ...food,
              quantity: hasPer100 ? 1 : (parseFloat(quantity) || 1),
              mealCategory: mealCategory,
              updatedAt: new Date().toISOString(),
              portionMode: hasPer100 ? portionMode : undefined,
              servingsInput: hasPer100 ? (parseFloat(servingsInput) || 0) : undefined,
              gramsInput: hasPer100 ? (parseFloat(gramsInput) || 0) : undefined,
              percentInput: hasPer100 ? (parseFloat(percentInput) || 0) : undefined,
              portionCalories: hasPer100 && portionCalories !== null && !isNaN(portionCalories) ? Math.round(portionCalories) : undefined,
            }
          : f
      ));
    } else {
      // Adding new food item
      const newFood = {
        ...food,
        id: Date.now().toString(),
        mealCategory: mealCategory,
        quantity: hasPer100 ? 1 : (parseFloat(quantity) || 1),
        addedAt: new Date().toISOString(),
        portionMode: hasPer100 ? portionMode : undefined,
        servingsInput: hasPer100 ? (parseFloat(servingsInput) || 0) : undefined,
        gramsInput: hasPer100 ? (parseFloat(gramsInput) || 0) : undefined,
        percentInput: hasPer100 ? (parseFloat(percentInput) || 0) : undefined,
        portionCalories: hasPer100 && portionCalories !== null && !isNaN(portionCalories) ? Math.round(portionCalories) : undefined,
      };
      setConsumedFoods(prev => {
        const newArray = [...prev, newFood];
        console.log('=== STATE UPDATE DEBUG ===');
        console.log('Previous array length:', prev.length);
        console.log('New array length:', newArray.length);
        console.log('New food added:', newFood.name);
        console.log('=== END STATE UPDATE DEBUG ===');
        
        // Immediately save the updated array to storage
        const targetDate = logDate;
        const storageKey = `consumedFoods-${targetDate}`;
        
        setTimeout(async () => {
          try {
            console.log('=== IMMEDIATE STORAGE DEBUG ===');
            console.log('Saving new array immediately, length:', newArray.length);
            console.log('New array:', newArray);
            console.log('=== END IMMEDIATE STORAGE DEBUG ===');
            
            if (userId) {
              await setUserData(userId, storageKey, newArray);
              console.log('[Calorie] Saved to user storage immediately:', storageKey, 'count:', newArray.length);
            } else {
              await AsyncStorage.setItem(storageKey, JSON.stringify(newArray));
              console.log('[Calorie] Saved to anon storage immediately:', storageKey, 'count:', newArray.length);
            }
          } catch (err) {
            console.warn('Failed to save consumed foods immediately for', targetDate, err);
          }
        }, 100); // Small delay to ensure state is updated
        
        return newArray;
      });
      
      // Debug the saved food
      console.log('=== SAVED FOOD DEBUG ===');
      console.log('Saved food object:', newFood);
      console.log('portionCalories:', newFood.portionCalories);
      console.log('hasPer100:', hasPer100);
      console.log('=== END SAVED FOOD DEBUG ===');
    }
    
    setQuantity('1');
    setServingsInput('1');
    setGramsInput('');
    setPercentInput('0');
    setModalVisible(false);
    setSelectedFood(null);
    
    // Clear search results after adding food
    setSearchQuery('');
    setApiSearchResults([]);
    setShowSearchResults(false);
  };

  // Search food using Open Food Facts API directly
  const searchFood = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setApiSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setApiSearchLoading(true);
      setApiSearchError(null);

      // Use Open Food Facts search API
      const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,categories,nutrition_grades,nutriments,image_url,code,serving_size,serving_quantity`;

      console.log('🔍 Searching Open Food Facts:', searchUrl);

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const products = data.products || [];

      const foods = products
        .filter(product => product.product_name && product.nutriments)
        .map(product => {
          // Simple serving size parsing - just extract the first number found
          const parseServingSize = () => {
            // First try serving_quantity field
            if (product.serving_quantity && !isNaN(parseFloat(product.serving_quantity))) {
              const val = parseFloat(product.serving_quantity);
              console.log('Found serving_quantity:', val);
              return Math.round(val);
            }
            
            // Then try serving_size field - just find any number
            const servingSizeText = product.serving_size || '';
            console.log('Parsing serving_size:', servingSizeText);
            
            // Find any number in the text (including decimals)
            const numberMatch = servingSizeText.match(/(\d+(?:\.\d+)?)/);
            if (numberMatch) {
              const val = parseFloat(numberMatch[1]);
              console.log('Found number in serving_size:', val);
              return Math.round(val);
            }
            
            console.log('No serving size found');
            return null;
          };

          return {
            id: `api-${product.code || Date.now()}-${Math.random()}`,
            name: product.product_name,
            brand: product.brands || '',
            category: product.categories ? product.categories.split(',')[0] : 'Food',
            calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy-kcal'] || 0, // per 100g
            protein: product.nutriments?.proteins_100g || product.nutriments?.proteins || 0,
            carbs: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0,
            fat: product.nutriments?.fat_100g || product.nutriments?.fat || 0,
            fiber: product.nutriments?.fiber_100g || product.nutriments?.fiber || 0,
            calories_per_serving: product.nutriments?.['energy-kcal_serving'] || null,
            serving_size_text: product.serving_size || '',
            serving_size_g: parseServingSize(),
            serving: '100g',
            nutrition_grade: product.nutrition_grades || '',
            image_url: product.image_url || null,
            barcode: product.code || '',
            source: 'api',
            isApiResult: true
          };
        })
        .filter(food => food.calories > 0); // Only include foods with calorie data

      console.log(`✅ Found ${foods.length} foods for query: ${query}`);
      setApiSearchResults(foods);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching food:', error);
      setApiSearchError(error.message);
      setApiSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setApiSearchLoading(false);
    }
  }, []);

  // Debounced search function with better performance
  const debouncedSearchFood = useCallback((query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchFood(query);
    }, 800); // 800ms delay to reduce API calls

    setSearchTimeout(timeout);
  }, [searchFood, searchTimeout]);

  // Handle barcode input
  const handleBarcodeInput = () => {
    if (barcodeInput.trim()) {
      // Simulate finding a product by barcode
      const mockProduct = {
        name: `Product ${barcodeInput}`,
        calories: 150,
        protein: 5,
        carbs: 20,
        fat: 3,
        fiber: 2,
        serving: '1 serving',
        isApiResult: true
      };
      setSelectedFood(mockProduct);
      setModalVisible(true);
      setBarcodeInput('');
      setShowBarcodeInput(false);
    }
  };

  // Handle manual food entry
  const handleManualFoodEntry = () => {
    if (manualFoodName.trim() && manualFoodCalories.trim()) {
      const newFood = {
        name: manualFoodName.trim(),
        calories: parseFloat(manualFoodCalories) || 0,
        protein: parseFloat(manualFoodProtein) || 0,
        carbs: parseFloat(manualFoodCarbs) || 0,
        fat: parseFloat(manualFoodFat) || 0,
        fiber: 0,
        serving: '1 serving'
      };
      addFoodToMeal(newFood);
      
      // Reset form
      setManualFoodName('');
      setManualFoodCalories('');
      setManualFoodProtein('');
      setManualFoodCarbs('');
      setManualFoodFat('');
      setShowManualInput(false);
    }
  };

  // Load saved meals from meal maker
  const loadSavedMeals = useCallback(async () => {
    try {
      setLoadingSavedMeals(true);
      let meals = [];
      
      if (userId) {
        meals = await getUserData(userId, 'userMeals', []);
      } else {
        const data = await AsyncStorage.getItem('userMeals');
        if (data) meals = JSON.parse(data);
      }
      
      setSavedMealsFromMaker(meals);
    } catch (error) {
      console.error('Failed to load saved meals:', error);
      setSavedMealsFromMaker([]);
    } finally {
      setLoadingSavedMeals(false);
    }
  }, [userId]);

  // Goal setting functions
  const saveGoal = useCallback(async (goalType, calories) => {
    try {
      const goalData = {
        type: goalType,
        calories: parseInt(calories),
        preset: GOAL_PRESETS.find(p => p.id === goalType),
        setDate: new Date().toISOString()
      };
      
      if (userId) {
        await setUserData(userId, 'dailyCalorieGoal', goalData.calories);
        await setUserData(userId, 'goalSettings', goalData);
      } else {
        await AsyncStorage.setItem('dailyCalorieGoal', goalData.calories.toString());
        await AsyncStorage.setItem('goalSettings', JSON.stringify(goalData));
      }
      
      setDailyGoal(goalData.calories);
      setGoalType(goalType);
      setShowGoalModal(false);
      
      // Show success message
      Alert.alert('Goal Set!', `Your daily calorie goal is now ${goalData.calories} calories.`);
    } catch (error) {
      console.error('Failed to save goal:', error);
      Alert.alert('Error', 'Failed to save your goal. Please try again.');
    }
  }, [userId]);

  const loadGoalSettings = useCallback(async () => {
    try {
      let goalSettings = null;
      
      if (userId) {
        goalSettings = await getUserData(userId, 'goalSettings', null);
      } else {
        const data = await AsyncStorage.getItem('goalSettings');
        if (data) goalSettings = JSON.parse(data);
      }
      
      if (goalSettings) {
        setGoalType(goalSettings.type);
        setDailyGoal(goalSettings.calories);
      }
    } catch (error) {
      console.error('Failed to load goal settings:', error);
    }
  }, [userId]);

  // Add saved meal to calorie counter
  const addSavedMealToCalorie = (meal) => {
    // Convert meal ingredients to food items
    const foodItems = meal.ingredients.map((ingredient, index) => ({
      id: `${meal.id}-${index}`,
      name: ingredient,
      calories: 100, // Default calories - could be improved with a food database lookup
      protein: 5,
      carbs: 15,
      fat: 3,
      fiber: 2,
      serving: '1 serving',
      mealCategory: selectedMealCategory,
      quantity: 1,
      addedAt: new Date().toISOString()
    }));

    // Add all food items to consumed foods
    setConsumedFoods(prev => [...prev, ...foodItems]);
    setShowSavedMeals(false);
  };

  // Date navigation functions
  const goToPreviousDay = () => {
    const currentDate = new Date(logDate);
    currentDate.setDate(currentDate.getDate() - 1);
    const newDateKey = toLocalDateKey(currentDate);
    console.log(`Navigating from ${logDate} to ${newDateKey}`);
    setLogDate(newDateKey);
    setIsToday(newDateKey === getTodayKey());
  };

  const goToNextDay = () => {
    const currentDate = new Date(logDate);
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateKey = toLocalDateKey(currentDate);
    setLogDate(newDateKey);
    setIsToday(newDateKey === getTodayKey());
  };

  const goToToday = () => {
    const todayKey = getTodayKey();
    console.log(`Navigating to today: ${todayKey}`);
    setLogDate(todayKey);
    setIsToday(true);
  };

  // Test function to add sample data for previous days
  const addSampleDataForDate = async (dateKey) => {
    const sampleFoods = [
      {
        id: `sample-${dateKey}-1`,
        name: 'Sample Breakfast',
        calories: 300,
        protein: 15,
        carbs: 30,
        fat: 10,
        fiber: 5,
        mealCategory: 'breakfast',
        quantity: 1,
        addedAt: new Date().toISOString()
      },
      {
        id: `sample-${dateKey}-2`,
        name: 'Sample Lunch',
        calories: 500,
        protein: 25,
        carbs: 50,
        fat: 15,
        fiber: 8,
        mealCategory: 'lunch',
        quantity: 1,
        addedAt: new Date().toISOString()
      }
    ];

    const storageKey = `consumedFoods-${dateKey}`;
    if (userId) {
      await setUserData(userId, storageKey, sampleFoods);
    } else {
      await AsyncStorage.setItem(storageKey, JSON.stringify(sampleFoods));
    }
    console.log(`Added sample data for ${dateKey}`);
  };

  const formatDisplayDate = (dateKey) => {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateKey === getTodayKey()) {
      return 'Today';
    } else if (dateKey === toLocalDateKey(yesterday)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM dd, yyyy');
    }
  };

  // Toggle calorie ring collapse
  const toggleCalorieRing = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCalorieRingCollapsed(!isCalorieRingCollapsed);
    
    Animated.timing(calorieRingHeight, {
      toValue: isCalorieRingCollapsed ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Toggle timeline visibility
  const toggleTimeline = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowTimeline(!showTimeline);
    
    Animated.timing(timelineHeight, {
      toValue: showTimeline ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Toggle timeline expansion
  const toggleTimelineExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsTimelineExpanded(!isTimelineExpanded);
    
    Animated.timing(timelineExpandHeight, {
      toValue: isTimelineExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Enhanced Progress Ring Component (inspired by LogTimelineScreen)
  const ProgressRing = ({ value, goal, size = 156, stroke = 12, color = "#20B486" }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / goal, 1);
    const dashOffset = circumference * (1 - progress);

    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E9EEF6"
            strokeWidth={stroke}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringBig}>{Math.round(value).toLocaleString()}</Text>
          <Text style={styles.ringSmall}>/ {goal.toLocaleString()} cal</Text>
          {goalType && (
            <View style={[styles.goalTypeBadge, { backgroundColor: GOAL_PRESETS.find(p => p.id === goalType)?.color + '22', marginTop: 8 }]}>
              <Text style={[styles.goalTypeText, { color: GOAL_PRESETS.find(p => p.id === goalType)?.color }]}>
                {GOAL_PRESETS.find(p => p.id === goalType)?.emoji} {GOAL_PRESETS.find(p => p.id === goalType)?.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Collapsible Calorie Ring Component
  const CollapsibleCalorieRing = () => {
    console.log('=== COLLAPSIBLE CALORIE RING DEBUG ===');
    console.log('dailyTotals.calories:', dailyTotals.calories);
    console.log('dailyGoal:', dailyGoal);
    console.log('consumedFoods length:', consumedFoods.length);
    console.log('consumedFoods:', consumedFoods);
    console.log('=== END COLLAPSIBLE CALORIE RING DEBUG ===');
    
    return (
      <Animated.View 
        style={[
          styles.calorieRingContainer,
          {
            height: calorieRingHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 200],
            }),
            opacity: calorieRingHeight,
          }
        ]}
      >
        <ProgressRing 
          value={dailyTotals.calories} 
          goal={dailyGoal} 
          color={isDefault ? '#20B486' : theme.primary}
        />
      </Animated.View>
    );
  };

  // Compact Progress Bar Component
  const CompactProgressBar = () => {
    const progress = Math.min(dailyTotals.calories / dailyGoal, 1);
    
    return (
      <View style={styles.compactProgressContainer}>
        <View style={styles.compactProgressHeader}>
          <View style={styles.compactProgressInfo}>
            <View style={styles.compactProgressHeaderRow}>
              <Text style={[styles.compactProgressCalories, { color: theme.text }]}>
                {Math.round(dailyTotals.calories)} / {dailyGoal} cal
              </Text>
              {goalType && (
                <View style={[styles.goalTypeBadge, { backgroundColor: GOAL_PRESETS.find(p => p.id === goalType)?.color + '22' }]}>
                  <Text style={[styles.goalTypeText, { color: GOAL_PRESETS.find(p => p.id === goalType)?.color }]}>
                    {GOAL_PRESETS.find(p => p.id === goalType)?.emoji} {GOAL_PRESETS.find(p => p.id === goalType)?.name}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.compactProgressRemaining, { color: theme.textSecondary }]}>
              {remainingCalories > 0 ? `${remainingCalories} remaining` : 'Goal reached!'}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleCalorieRing} style={styles.expandButton}>
            <MaterialCommunityIcons 
              name="chevron-up" 
              size={20} 
              color={theme.primary} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={[styles.compactProgressTrack, { backgroundColor: theme.border }]}>
          <Animated.View
            style={[
              styles.compactProgressFill,
              { 
                backgroundColor: isDefault ? '#10B981' : theme.primary,
                width: `${Math.min(progress * 100, 100)}%` 
              }
            ]}
          />
        </View>
      </View>
    );
  };

  // Food Intake list (simple rows with + Log buttons)
  const FoodIntakeSection = () => {
    // Edit food item in-place
    const editFoodItem = (food) => {
      setSelectedFood(food);
      setQuantity(food.quantity?.toString() || '1');
      setSelectedMealCategory(food.mealCategory || 'snacks');
      setModalVisible(true);
    };

    // Delete food item with confirmation
    const deleteFoodItem = (food) => {
      Alert.alert(
        'Remove Food',
        `Remove "${food.name}" from your log?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => setConsumedFoods(prev => prev.filter(f => f.id !== food.id)) }
        ]
      );
    };

    const normalizeMealCategory = (val) => {
      if (val === undefined || val === null) return 'snacks';
      const s = String(val).trim().toLowerCase();
      if (['breakfast','lunch','dinner','snacks'].includes(s)) return s;
      if (s.startsWith('breakfast')) return 'breakfast';
      if (s.startsWith('lunch')) return 'lunch';
      if (s.startsWith('dinner')) return 'dinner';
      if (s.startsWith('snack')) return 'snacks';
      return 'snacks';
    };

    return (
      <View style={styles.intakeSection}>
        <Text style={[styles.intakeTitle, { color: theme.text }]}>Logger</Text>
        {MEAL_CATEGORIES.map((category) => {
          const mealFoods = consumedFoods.filter(f => {
            const raw = (f.mealCategory ?? f.meal ?? f.meal_type ?? f.mealType);
            const normalized = normalizeMealCategory(raw);
            return normalized === category.id;
          });
          const mealCalories = mealFoods.reduce((total, f) => {
            const cal = typeof f.portionCalories === 'number' && !isNaN(f.portionCalories)
              ? f.portionCalories
              : ((f.calories || 0) * (f.quantity || 1));
            return total + cal;
          }, 0);
          const hasFood = mealFoods.length > 0;
          return (
            <View
              key={category.id}
              style={[
                styles.intakeItem,
                {
                  backgroundColor: theme.surface,
                  borderColor: hasFood ? category.color : theme.border,
                  borderLeftWidth: hasFood ? 3 : 1,
                  flexDirection: 'column', // Change to column layout
                  alignItems: 'stretch', // Stretch children to full width
                },
              ]}
            >
              <View style={styles.intakeHeaderRow}>
                <View style={styles.intakeLeft}>
                  <View style={[styles.intakeIconWrap, { backgroundColor: (hasFood ? category.color : (isDefault ? '#10B981' : theme.primary)) + '22' }]}>
                    <MaterialCommunityIcons name={category.icon} size={18} color={hasFood ? category.color : (isDefault ? '#10B981' : theme.primary)} />
                  </View>
                  <View>
                    <Text style={[styles.intakeName, { color: theme.text }]}>{category.name}</Text>
                    <Text style={[styles.intakeSubLabel, { color: theme.textSecondary }]}>{mealFoods.length} items</Text>
                    {hasFood && (
                      <Text style={[styles.intakeFoodMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                        
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.intakeRight}>
                  <View style={[styles.intakeCalBadge, { borderColor: hasFood ? category.color : theme.border, backgroundColor: theme.background }]}>
                    <Text style={[styles.intakeCalText, { color: hasFood ? category.color : theme.textSecondary }]}>{Math.round(mealCalories)} cal</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.intakeLogButton, { backgroundColor: hasFood ? category.color : (isDefault ? '#16A34A' : theme.primary) }]}
                    onPress={() => {
                      setSelectedMealForAdd(category.id);
                      setShowAddFoodModal(true);
                    }}
                  >
                    <Text style={styles.intakeLogText}>+ Log</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {hasFood && (
                <View style={[styles.intakeItemsList, { borderTopColor: theme.border, backgroundColor: theme.background, width: '100%' }]}>
                  {mealFoods.map((food) => (
                    <View key={food.id} style={[styles.intakeFoodRow, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface, borderRadius: 8, marginVertical: 2 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.intakeFoodName, { color: theme.text }]} numberOfLines={1}>{food.name}</Text>
                        <Text style={[styles.intakeFoodMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                          {(() => {
                            const fallback = (food.calories || 0) * (food.quantity || 1);
                            const value = (food.portionCalories !== null && food.portionCalories !== undefined && !isNaN(food.portionCalories))
                              ? food.portionCalories
                              : fallback;
                            return `${formatPortionText(food)} • ${Math.round(value)} cal`;
                          })()}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity onPress={() => editFoodItem(food)} style={[styles.enhancedFoodActionButton, { backgroundColor: theme.primary }]}>
                          <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteFoodItem(food)} style={[styles.enhancedFoodActionButton, { backgroundColor: '#EF4444' }]}>
                          <MaterialCommunityIcons name="delete" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Enhanced Timeline Component with dots and lines (inspired by meal planner)
  const TimelineView = () => {
    const groupedByMeal = consumedFoods.reduce((acc, food) => {
      const meal = food.mealCategory || 'snacks';
      if (!acc[meal]) acc[meal] = [];
      acc[meal].push(food);
      return acc;
    }, {});

    // Use the updated meal categories with emojis and better colors
    const timelineMealCategories = MEAL_CATEGORIES;

      // Edit food item function
  const editFoodItem = (food) => {
    setSelectedFood(food);
    setQuantity(food.quantity?.toString() || '1');
    setSelectedMealCategory(food.mealCategory || 'snacks');
    setModalVisible(true);
  };

    // Delete food item with confirmation
    const deleteFoodItem = (food) => {
      Alert.alert(
        'Remove Food',
        `Remove "${food.name}" from your log?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove', 
            style: 'destructive', 
            onPress: () => setConsumedFoods(prev => prev.filter(f => f.id !== food.id))
          }
        ]
      );
    };

    return (
      <View style={[styles.timelineContainer, { backgroundColor: theme.surface }]}>
        <View style={[styles.timelineHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.timelineHeaderLeft}>
            <MaterialCommunityIcons name="timeline-clock" size={20} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.timelineTitle, { color: theme.text }]}>Today's Meals</Text>
          </View>
          <View style={{ width: 0, height: 0 }} />
        </View>
        
        {/* Food Intake Rows under Today's Meals */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          {MEAL_CATEGORIES.map((category) => {
            const mealFoods = groupedByMeal[category.id] || [];
            const mealCalories = mealFoods.reduce((total, f) => {
              const cal = typeof f.portionCalories === 'number' ? f.portionCalories : ((f.calories || 0) * (f.quantity || 1));
              return total + cal;
            }, 0);
            const hasFood = mealFoods.length > 0;
            return (
              <View
                key={`inline-${category.id}`}
                style={[
                  styles.intakeItem,
                  {
                    backgroundColor: theme.surface,
                    borderColor: hasFood ? category.color : theme.border,
                    borderLeftWidth: hasFood ? 3 : 1,
                  },
                ]}
              >
                <View style={styles.intakeHeaderRow}>
                  <View style={styles.intakeLeft}>
                    <View style={[styles.intakeIconWrap, { backgroundColor: (hasFood ? category.color : (isDefault ? '#10B981' : theme.primary)) + '22' }]}>
                      <MaterialCommunityIcons name={category.icon} size={20} color={hasFood ? category.color : (isDefault ? '#10B981' : theme.primary)} />
                    </View>
                    <View>
                      <Text style={[styles.intakeName, { color: theme.text }]}>{category.name}</Text>
                      <Text style={[styles.intakeSubLabel, { color: theme.textSecondary }]}>{mealFoods.length} items</Text>
                    </View>
                  </View>
                  <View style={styles.intakeRight}>
                    <View style={[styles.intakeCalBadge, { borderColor: hasFood ? category.color : theme.border, backgroundColor: theme.background }]}>
                      <Text style={[styles.intakeCalText, { color: hasFood ? category.color : theme.textSecondary }]}>{Math.round(mealCalories)} cal</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.intakeLogButton, { backgroundColor: hasFood ? category.color : (isDefault ? '#16A34A' : theme.primary) }]}
                      onPress={() => {
                        setSelectedMealForAdd(category.id);
                        setShowAddFoodModal(true);
                      }}
                    >
                      <Text style={styles.intakeLogText}>+ Log</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {hasFood && (
                  <View style={[styles.intakeItemsList, { borderTopColor: theme.border }]}> 
                    {mealFoods.slice(0, 3).map((food) => (
                      <View key={food.id} style={styles.intakeFoodRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.intakeFoodName, { color: theme.text }]} numberOfLines={1}>{food.name}</Text>
                          <Text style={[styles.intakeFoodMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                            {formatPortionText(food)} • {(() => {
                              const fallback = (food.calories || 0) * (food.quantity || 1);
                              const value = (food.portionCalories !== null && food.portionCalories !== undefined && !isNaN(food.portionCalories))
                                ? food.portionCalories
                                : fallback;
                              return `${Math.round(value)} cal`;
                            })()}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={() => editFoodItem(food)} style={[styles.enhancedFoodActionButton, { backgroundColor: theme.primary }]}>
                            <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteFoodItem(food)} style={[styles.enhancedFoodActionButton, { backgroundColor: '#EF4444' }]}>
                            <MaterialCommunityIcons name="delete" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {mealFoods.length > 3 && (
                      <Text style={[styles.intakeMoreText, { color: theme.textSecondary }]}>+{mealFoods.length - 3} more</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Enhanced Timeline View with dots and lines - Fixed Layout */}
        <View style={{ display: 'none' }}>
          <Animated.View 
            style={[
              styles.timelineContent,
              {
                height: timelineExpandHeight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1200], // Increased height to fit all meals
                }),
                opacity: timelineExpandHeight,
              }
            ]}
          >
            <View style={styles.timelineFixedContainer}>
            {timelineMealCategories.map((category, index) => {
              const mealFoods = groupedByMeal[category.id] || [];
              const mealCalories = mealFoods.reduce((total, food) => 
                total + (food.calories * (food.quantity || 1)), 0
              );
              const hasFood = mealFoods.length > 0;
              const isLast = index === timelineMealCategories.length - 1;
              
              return (
                <View key={`${category.id}-${index}`} style={styles.timelineItemContainer}>
                  {/* Enhanced Timeline line and dot (inspired by meal planner) */}
                  <View style={styles.timelineLineContainer}>
                    <View style={[
                      styles.timelineDot, 
                      { 
                        backgroundColor: hasFood ? category.color : theme.surface,
                        borderColor: category.color,
                        borderWidth: hasFood ? 0 : 2,
                        shadowColor: category.color,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: hasFood ? 0.3 : 0.1,
                        shadowRadius: 4,
                        elevation: hasFood ? 4 : 2,
                      }
                    ]}>
                      <MaterialCommunityIcons 
                        name={category.icon} 
                        size={14} 
                        color={hasFood ? "#fff" : category.color} 
                      />
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.timelineLine, 
                        { 
                          backgroundColor: theme.border,
                          width: 3,
                          borderRadius: 1.5,
                        }
                      ]} />
                    )}
                  </View>

                  {/* Enhanced Meal Card (inspired by meal planner) */}
                  <View style={[
                    styles.enhancedMealCard,
                    { 
                      backgroundColor: theme.surface,
                      borderColor: hasFood ? category.color : theme.border,
                      borderLeftWidth: hasFood ? 4 : 2,
                      borderLeftColor: hasFood ? category.color : theme.border,
                      shadowColor: hasFood ? category.color : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: hasFood ? 0.1 : 0.05,
                      shadowRadius: 6,
                      elevation: hasFood ? 4 : 2,
                    }
                  ]}>
                    <View style={styles.enhancedMealCardHeader}>
                      <View style={styles.enhancedMealCardInfo}>
                        <View style={styles.enhancedMealCardText}>
                          <View style={styles.enhancedMealCardTitleRow}>
                            <Text style={styles.enhancedMealCardEmoji}>{category.emoji}</Text>
                            <Text style={[styles.enhancedMealCardName, { color: theme.text }]}>
                              {category.name}
                            </Text>
                          </View>
                          <Text style={[styles.enhancedMealCardTime, { color: theme.textSecondary }]}>
                            {category.time}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.enhancedMealCardStats}>
                        <Text style={[styles.enhancedMealCardCalories, { color: hasFood ? category.color : theme.textSecondary }]}>
                          {Math.round(mealCalories)} cal
                        </Text>
                        <Text style={[styles.enhancedMealCardCount, { color: theme.textSecondary }]}>
                          {mealFoods.length} items
                        </Text>
                      </View>
                    </View>
                    
                    {hasFood ? (
                      <View style={styles.enhancedMealCardContent}>
                        <View style={styles.enhancedFoodList}>
                          {mealFoods.map((food, foodIndex) => (
                            <View key={food.id} style={[styles.enhancedFoodItem, { backgroundColor: theme.background }]}>
                              <View style={styles.enhancedFoodInfo}>
                                <View style={styles.enhancedFoodNameRow}>
                                  <Text style={styles.enhancedFoodEmoji}>{food.emoji || '🍽️'}</Text>
                                  <Text style={[styles.enhancedFoodName, { color: theme.text }]}>
                                    {food.name}
                                  </Text>
                                </View>
                                <Text style={[styles.enhancedFoodDetails, { color: theme.textSecondary }]}>
                                  {(() => {
                                    console.log('=== TIMELINE DISPLAY DEBUG ===');
                                    console.log('Food:', food.name);
                                    console.log('portionCalories:', food.portionCalories);
                                    console.log('portionCalories type:', typeof food.portionCalories);
                                    console.log('portionCalories !== null:', food.portionCalories !== null);
                                    console.log('portionCalories !== undefined:', food.portionCalories !== undefined);
                                    console.log('!isNaN(portionCalories):', !isNaN(food.portionCalories));
                                    console.log('calories:', food.calories);
                                    console.log('quantity:', food.quantity);
                                    console.log('portionMode:', food.portionMode);
                                    console.log('servingsInput:', food.servingsInput);
                                    console.log('formatPortionText result:', formatPortionText(food));
                                    console.log('=== END TIMELINE DISPLAY DEBUG ===');
                                    
                                    if (food.portionCalories !== null && food.portionCalories !== undefined && !isNaN(food.portionCalories)) {
                                      return `${formatPortionText(food)} • ${Math.round(food.portionCalories)} cal`;
                                    } else {
                                      return `${food.quantity || 1} serving • ${Math.round(food.calories * (food.quantity || 1))} cal`;
                                    }
                                  })()}
                                </Text>
                                {food.brand && (
                                  <Text style={[styles.enhancedFoodBrand, { color: theme.textSecondary }]}>
                                    {food.brand}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.enhancedFoodActions}>
                                <TouchableOpacity
                                  style={[styles.enhancedFoodActionButton, { backgroundColor: theme.primary }]}
                                  onPress={() => editFoodItem(food)}
                                >
                                  <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.enhancedFoodActionButton, { backgroundColor: '#EF4444' }]}
                                  onPress={() => deleteFoodItem(food)}
                                >
                                  <MaterialCommunityIcons name="delete" size={16} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.enhancedMealCardContent}>
                        <View style={styles.enhancedMealCardEmptyState}>
                          <Text style={styles.enhancedMealCardEmptyEmoji}>{category.emoji}</Text>
                          <Text style={[styles.enhancedMealCardEmpty, { color: theme.textSecondary }]}>
                            No {category.name.toLowerCase()} logged yet
                          </Text>
                          <Text style={[styles.enhancedMealCardEmptySubtext, { color: theme.textSecondary }]}>
                            Add your {category.name.toLowerCase()} to track your nutrition
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    <View style={styles.enhancedMealCardActions}>
                      <TouchableOpacity 
                        style={[
                          styles.enhancedAddFoodButton,
                          { backgroundColor: category.color }
                        ]}
                        onPress={() => {
                          setSelectedMealForAdd(category.id);
                          setShowAddFoodModal(true);
                        }}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                        <Text style={styles.enhancedAddFoodButtonText}>Add Food</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.enhancedScanButton,
                          { borderColor: category.color }
                        ]}
                        onPress={() => {
                          setSelectedMealCategory(category.id);
                          setShowBarcodeScanner(true);
                        }}
                      >
                        <MaterialCommunityIcons name="barcode-scan" size={18} color={category.color} />
                        <Text style={[styles.enhancedScanButtonText, { color: category.color }]}>Scan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
            </View>
          </Animated.View>
        </View>

        {/* Collapsed view - 4 compact squares */}
        <Animated.View 
          style={[
            { display: 'none' },
            {
              height: timelineExpandHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 200], // Increased height for collapsed view to fit all squares
              }),
              opacity: timelineExpandHeight,
            }
          ]}
        >
          <View style={[styles.mealSquaresContainer, { gap: 12 }]}>
            {timelineMealCategories.map((category) => {
              const mealFoods = groupedByMeal[category.id] || [];
              const mealCalories = mealFoods.reduce((total, food) => 
                total + (food.calories * (food.quantity || 1)), 0
              );
              const hasFood = mealFoods.length > 0;
              
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.mealSquare,
                    { 
                      backgroundColor: theme.surface,
                      borderColor: hasFood ? category.color : theme.border
                    }
                  ]}
                  onPress={() => {
                    setSelectedMealCategory(category.id);
                    setShowSearchResults(true);
                  }}
                >
                  <View style={[styles.mealSquareIcon, { backgroundColor: category.color }]}>
                    <Text style={styles.mealSquareEmoji}>{category.emoji}</Text>
                  </View>
                  <Text style={[styles.mealSquareName, { color: theme.text }]} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <Text style={[styles.mealSquareCalories, { color: hasFood ? category.color : theme.textSecondary }]} numberOfLines={1}>
                    {Math.round(mealCalories)} cal
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    );
  };





  // Animation on mount
  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Load saved meals when modal is opened
  useEffect(() => {
    if (showSavedMeals) {
      loadSavedMeals();
    }
  }, [showSavedMeals, loadSavedMeals]);

  // Load goal settings on component mount
  useEffect(() => {
    loadGoalSettings();
  }, [loadGoalSettings]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.headerBar, 
          { 
            backgroundColor: theme.surface,
            opacity: headerOpacity 
          }
        ]}
      > 
        <TouchableOpacity 
          style={[styles.menuButtonCircle, { backgroundColor: 'rgba(0,0,0,0.1)' }]} 
          onPress={() => navigation.openDrawer()}
        >
          <MaterialCommunityIcons name="menu" size={28} color={theme.text} />
        </TouchableOpacity>
        
        <View style={[styles.headerTitleWrap, { flexShrink: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons 
              name="fire" 
              size={22} 
              color={isDefault ? theme.text : theme.accent} 
              style={{ marginRight: 8 }} 
            />
            <Text 
              style={[styles.headerTitle, { color: isDefault ? theme.text : theme.accent }]} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              Calorie Counter
            </Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Track your daily nutrition
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          {!isToday && (
            <TouchableOpacity 
              style={[styles.headerActionButton, { backgroundColor: theme.primary }]} 
              onPress={goToToday}
            >
              <MaterialCommunityIcons name="home" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerActionButton, { backgroundColor: theme.surface }]} 
            onPress={() => setShowGoalModal(true)}
          >
            <MaterialCommunityIcons name="target" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerActionButton, { backgroundColor: theme.surface }]} 
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialCommunityIcons name="account" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Date Navigation */}
      <View style={[styles.dateNavigationContainer, { backgroundColor: theme.surface }]}>
        <TouchableOpacity 
          style={[styles.dateNavButton, { backgroundColor: theme.background }]} 
          onPress={goToPreviousDay}
          disabled={isLoadingData}
        >
          {isLoadingData ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.dateDisplay, { backgroundColor: theme.background }]} 
          onPress={() => setShowDatePicker(true)} // Will open full calendar below
        >
          <Text style={[styles.dateDisplayText, { color: theme.text }]}>
            {formatDisplayDate(logDate)}
          </Text>
          <MaterialCommunityIcons name="calendar" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.dateNavButton, { backgroundColor: theme.background }]} 
          onPress={goToNextDay}
          disabled={isToday || isLoadingData}
        >
          {isLoadingData ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <MaterialCommunityIcons 
              name="chevron-right" 
              size={20} 
              color={isToday ? theme.textSecondary : theme.primary} 
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Compact Progress Bar - Fixed at Top */}
      {isCalorieRingCollapsed && (
        <Animated.View 
          style={[
            styles.topProgressBar,
            { 
              backgroundColor: theme.surface,
              opacity: contentOpacity 
            }
          ]}
        >
          <CompactProgressBar />
        </Animated.View>
      )}

      {/* Main Content */}
      <Animated.View 
        style={[
          { flex: 1 },
          { opacity: contentOpacity }
        ]}
      >
        {/* Tabs */}
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab
            theme={theme}
            dailyTotals={dailyTotals}
            dailyGoal={dailyGoal}
            remainingCalories={remainingCalories}
            progressPercentage={progressPercentage}
            mealTotals={mealTotals}
            quickActions={[
              { icon: 'barcode-scan', label: 'Scan', color: isDefault ? '#10B981' : theme.primary, action: () => setShowBarcodeScanner(true) },
              { icon: 'keyboard', label: 'Barcode', color: isDefault ? '#F59E0B' : theme.accent, action: () => setShowBarcodeInput(true) },
              { icon: 'pencil', label: 'Manual', color: '#8B5CF6', action: () => setShowManualInput(true) },
              { icon: 'bookmark', label: 'Meals', color: '#FF6B6B', action: () => setShowSavedMeals(true) },
            ]}
            onAddFood={(food) => { setSelectedFood(food); setModalVisible(true); }}
            onMealPress={() => { setShowTimeline(true); }}
            loading={isLoadingData}
          />
        )}

        {activeTab === 'analytics' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Daily Progress Card */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.analyticsTitle, { color: theme.text }]}>Today's Progress</Text>
              <View style={styles.progressStats}>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressStatValue, { color: theme.text }]}>
                    {Math.round(dailyTotals.calories)}
                  </Text>
                  <Text style={[styles.progressStatLabel, { color: theme.textSecondary }]}>Calories</Text>
                </View>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressStatValue, { color: theme.text }]}>
                    {Math.round(progressPercentage)}%
                  </Text>
                  <Text style={[styles.progressStatLabel, { color: theme.textSecondary }]}>Goal</Text>
                </View>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressStatValue, { color: theme.text }]}>
                    {Math.round(dailyTotals.protein)}g
                  </Text>
                  <Text style={[styles.progressStatLabel, { color: theme.textSecondary }]}>Protein</Text>
                </View>
              </View>
            </View>

            {/* Meal Distribution */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.analyticsTitle, { color: theme.text }]}>Meal Distribution</Text>
              <View style={styles.mealDistribution}>
                {mealTotals.map((meal) => {
                  const percentage = dailyTotals.calories > 0 ? (meal.calories / dailyTotals.calories) * 100 : 0;
                  return (
                    <View key={meal.id} style={styles.mealDistributionItem}>
                      <View style={styles.mealDistributionHeader}>
                        <View style={styles.mealDistributionInfo}>
                          <Text style={styles.mealDistributionEmoji}>{meal.emoji}</Text>
                          <Text style={[styles.mealDistributionName, { color: theme.text }]}>
                            {meal.name}
                          </Text>
                        </View>
                        <Text style={[styles.mealDistributionCalories, { color: theme.text }]}>
                          {meal.calories} cal
                        </Text>
                      </View>
                      <View style={[styles.mealDistributionBar, { backgroundColor: theme.border }]}>
                        <View 
                          style={[
                            styles.mealDistributionFill, 
                            { 
                              backgroundColor: meal.color,
                              width: `${percentage}%` 
                            }
                          ]} 
                        />
                      </View>
                      <Text style={[styles.mealDistributionPercentage, { color: theme.textSecondary }]}>
                        {Math.round(percentage)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Macro Breakdown */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.analyticsTitle, { color: theme.text }]}>Macro Breakdown</Text>
              <View style={styles.macroBreakdown}>
                <View style={styles.macroItem}>
                  <View style={styles.macroHeader}>
                    <View style={[styles.macroColor, { backgroundColor: '#FF6B6B' }]} />
                    <Text style={[styles.macroName, { color: theme.text }]}>Protein</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round(dailyTotals.protein)}g
                    </Text>
                  </View>
                  <View style={[styles.macroBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.macroBarFill, 
                        { 
                          backgroundColor: '#FF6B6B',
                          width: `${Math.min((dailyTotals.protein / 150) * 100, 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
                
                <View style={styles.macroItem}>
                  <View style={styles.macroHeader}>
                    <View style={[styles.macroColor, { backgroundColor: '#4ECDC4' }]} />
                    <Text style={[styles.macroName, { color: theme.text }]}>Carbs</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round(dailyTotals.carbs)}g
                    </Text>
                  </View>
                  <View style={[styles.macroBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.macroBarFill, 
                        { 
                          backgroundColor: '#4ECDC4',
                          width: `${Math.min((dailyTotals.carbs / 200) * 100, 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
                
                <View style={styles.macroItem}>
                  <View style={styles.macroHeader}>
                    <View style={[styles.macroColor, { backgroundColor: '#45B7D1' }]} />
                    <Text style={[styles.macroName, { color: theme.text }]}>Fat</Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round(dailyTotals.fat)}g
                    </Text>
                  </View>
                  <View style={[styles.macroBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.macroBarFill, 
                        { 
                          backgroundColor: '#45B7D1',
                          width: `${Math.min((dailyTotals.fat / 65) * 100, 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Macro Energy Distribution */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.analyticsTitle, { color: theme.text }]}>Macro Energy Distribution</Text>
              {dailyTotals.calories > 0 ? (
                <PieChart
                  data={[
                    { name: 'Protein', population: Math.max(0, dailyTotals.protein * 4), color: '#FF6B6B', legendFontColor: theme.text, legendFontSize: 12 },
                    { name: 'Carbs', population: Math.max(0, dailyTotals.carbs * 4), color: '#4ECDC4', legendFontColor: theme.text, legendFontSize: 12 },
                    { name: 'Fat', population: Math.max(0, dailyTotals.fat * 9), color: '#45B7D1', legendFontColor: theme.text, legendFontSize: 12 },
                  ]}
                  width={width - 32}
                  height={200}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  chartConfig={{
                    color: () => theme.textSecondary,
                    labelColor: () => theme.textSecondary
                  }}
                  hasLegend={true}
                  center={[0, 0]}
                  absolute={false}
                />
              ) : (
                <Text style={{ color: theme.textSecondary }}>No intake yet today</Text>
              )}
            </View>

            {/* Food Items Summary */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.analyticsTitle, { color: theme.text }]}>Food Items Today</Text>
              <View style={styles.foodItemsSummary}>
                <View style={styles.foodItemsStat}>
                  <Text style={[styles.foodItemsValue, { color: theme.text }]}>
                    {consumedFoods.length}
                  </Text>
                  <Text style={[styles.foodItemsLabel, { color: theme.textSecondary }]}>Total Items</Text>
                </View>
                <View style={styles.foodItemsStat}>
                  <Text style={[styles.foodItemsValue, { color: theme.text }]}>
                    {Math.round(consumedFoods.reduce((sum, food) => sum + (food.quantity || 1), 0))}
                  </Text>
                  <Text style={[styles.foodItemsLabel, { color: theme.textSecondary }]}>Servings</Text>
                </View>
                <View style={styles.foodItemsStat}>
                  <Text style={[styles.foodItemsValue, { color: theme.text }]}>
                    {Math.round(dailyTotals.fiber)}g
                  </Text>
                  <Text style={[styles.foodItemsLabel, { color: theme.textSecondary }]}>Fiber</Text>
                </View>
              </View>
            </View>

            {/* Weekly Trend */}
            <View style={[styles.analyticsCard, { backgroundColor: theme.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.analyticsTitle, { color: theme.text }]}>Weekly Trend</Text>
                <View style={{ flexDirection: 'row' }}>
                  {[7, 14, 30].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setAnalyticsTimeframe(n)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
                        backgroundColor: analyticsTimeframe === n ? theme.primary : theme.surface,
                        borderWidth: 1, borderColor: theme.border, marginLeft: 8
                      }}
                    >
                      <Text style={{ color: analyticsTimeframe === n ? '#FFFFFF' : theme.textSecondary, fontWeight: '600' }}>{n}d</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {weeklyLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : weeklySeries.labels.length ? (
                <>
                  <LineChart
                    data={{
                      labels: weeklySeries.labels,
                      datasets: [
                        { data: weeklySeries.totals, color: () => theme.primary, strokeWidth: 2 },
                        { data: weeklySeries.rolling, color: () => theme.accent, strokeWidth: 2 },
                      ],
                      legend: ['Daily', '3-day avg']
                    }}
                    width={width - 32}
                    height={220}
                    withInnerLines={false}
                    yAxisSuffix=" cal"
                    chartConfig={{
                      backgroundGradientFrom: theme.surface,
                      backgroundGradientTo: theme.surface,
                      color: () => theme.textSecondary,
                      labelColor: () => theme.textSecondary,
                      propsForDots: { r: '3', strokeWidth: '1', stroke: theme.surface },
                      decimalPlaces: 0,
                    }}
                    style={{ borderRadius: 16 }}
                  />
                  {weeklySeries.stats && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                      <Text style={{ color: theme.textSecondary }}>Avg: {weeklySeries.stats.avg} cal/day</Text>
                      <Text style={{ color: theme.textSecondary }}>Best: {weeklySeries.stats.best}</Text>
                      <Text style={{ color: theme.textSecondary }}>Adherence: {weeklySeries.stats.adherence}/{weeklySeries.stats.days}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.weeklyTrendPlaceholder}>
                  <MaterialCommunityIcons name="chart-line" size={48} color={theme.textSecondary} />
                  <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>Not enough data yet</Text>
                  <Text style={[styles.placeholderSubtext, { color: theme.textSecondary }]}>Add entries to see your trend</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {activeTab === 'log' && (
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: 40 }} 
            showsVerticalScrollIndicator={false}
          >
          {/* Calorie Progress Section - Only show when expanded */}
          {!isCalorieRingCollapsed && (
            <View style={[styles.progressCard, { backgroundColor: theme.surface }]}>
              <View style={styles.progressHeaderRow}>
                <Text style={[styles.progressTitle, { color: theme.text }]}>
                  {isToday ? "Today's Progress" : `${format(new Date(logDate), 'MMM dd')} Progress`}
                </Text>
                <TouchableOpacity onPress={toggleCalorieRing} style={styles.collapseButton}>
                  <MaterialCommunityIcons 
                    name="chevron-down" 
                    size={20} 
                    color={theme.primary} 
                  />
                </TouchableOpacity>
              </View>
              <CollapsibleCalorieRing />
              <Text style={[styles.remainingLabel, { color: theme.textSecondary }]}>
                Remaining Calories
              </Text>
              <Text style={[styles.remainingValue, { color: isDefault ? theme.text : theme.success }]}>
                {remainingCalories > 0 ? remainingCalories : 0}
              </Text>
            </View>
          )}

          {/* Enhanced Quick Add Section */}
          <View style={styles.quickAddSection}>
            <View style={styles.quickAddHeader}>
              <MaterialCommunityIcons name="plus-circle" size={20} color={theme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Add Food
              </Text>
            </View>
            
            {/* Primary Action - Scan */}
            <TouchableOpacity
              style={[
                styles.primaryAddButton,
                { backgroundColor: (isDefault ? '#10B981' : theme.primary) }
              ]}
              onPress={() => { setShowBarcodeScanner(true); }}
            >
              <View style={styles.primaryAddButtonContent}>
                <View style={styles.primaryAddButtonIcon}>
                  <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
                </View>
                <View style={styles.primaryAddButtonText}>
                  <Text style={styles.primaryAddButtonTitle}>Scan Barcode</Text>
                  <Text style={styles.primaryAddButtonSubtitle}>Quick & accurate</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Secondary Actions */}
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryAddButton,
                  { backgroundColor: theme.surface, borderColor: theme.border }
                ]}
                onPress={() => { setShowBarcodeInput(true); }}
              >
                <MaterialCommunityIcons name="keyboard" size={18} color={theme.primary} />
                <Text style={[styles.secondaryAddButtonText, { color: theme.text }]}>Enter Barcode</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.secondaryAddButton,
                  { backgroundColor: theme.surface, borderColor: theme.border }
                ]}
                onPress={() => { setShowManualInput(true); }}
              >
                <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
                <Text style={[styles.secondaryAddButtonText, { color: theme.text }]}>Manual Entry</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.secondaryAddButton,
                  { backgroundColor: theme.surface, borderColor: theme.border }
                ]}
                onPress={() => { setShowSavedMeals(true); }}
              >
                <MaterialCommunityIcons name="bookmark" size={18} color={theme.primary} />
                <Text style={[styles.secondaryAddButtonText, { color: theme.text }]}>Saved Meals</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Section - Integrated with Quick Add */}
          <View style={styles.searchSection}>
            <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search for food..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  debouncedSearchFood(text);
                }}
              />
            </View>
            
            {/* Search Results */}
            {searchQuery.trim().length >= 2 && (
              <View style={[styles.searchResults, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ScrollView 
                  style={styles.searchResultsScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {apiSearchLoading ? (
                    <View style={styles.searchLoadingContainer}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.searchLoadingText, { color: theme.textSecondary }]}>
                        Searching...
                      </Text>
                    </View>
                  ) : apiSearchError ? (
                    <View style={styles.searchErrorContainer}>
                      <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
                      <Text style={[styles.searchErrorText, { color: '#EF4444' }]}>
                        {apiSearchError}
                      </Text>
                    </View>
                  ) : apiSearchResults.length > 0 ? (
                    apiSearchResults.map((food) => (
                      <TouchableOpacity
                        key={food.id}
                        style={styles.searchResultItem}
                        onPress={() => {
                          console.log('=== SELECTING FOOD ===');
                          console.log('Food object:', food);
                          console.log('isApiResult:', food.isApiResult);
                          console.log('calories:', food.calories);
                          console.log('serving_size_g:', food.serving_size_g);
                          setSelectedFood(food);
                          setModalVisible(true);
                        }}
                      >
                        <View style={styles.searchResultInfo}>
                          <Text style={[styles.searchResultName, { color: theme.text }]}>
                            {food.name}
                          </Text>
                          <Text style={[styles.searchResultDetails, { color: theme.textSecondary }]}>
                            {Math.round(food.calories)} cal • {food.serving}
                            {food.brand && ` • ${food.brand}`}
                          </Text>
                          {food.nutrition_grade && (
                            <View style={[styles.nutritionGrade, { backgroundColor: getNutritionGradeColor(food.nutrition_grade) }]}>
                              <Text style={styles.nutritionGradeText}>{food.nutrition_grade.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.searchNoResultsContainer}>
                      <MaterialCommunityIcons name="magnify" size={24} color={theme.textSecondary} />
                      <Text style={[styles.searchNoResultsText, { color: theme.textSecondary }]}>
                        No results found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Food Intake Section (inspired style) */}
          <FoodIntakeSection />

          
          {/* Consumed Foods List removed; all items are shown in meal timeline */}
          {/* Removed section start */}
          {/* <View style={styles.consumedFoodsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Consumed Foods ({consumedFoods.length})
            </Text>
            {consumedFoods.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="food" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                  No foods logged yet
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>
                  Start by scanning a barcode or adding food manually
                </Text>
              </View>
            ) : (
              <FlatList
                data={consumedFoods}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={[styles.consumedItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.consumedInfo}>
                      <Text style={[styles.consumedName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.consumedDetails, { color: theme.textSecondary }]}>
                        {Math.round(item.calories * (item.quantity || 1))} cal • {item.quantity || 1} serving
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => {
                        Alert.alert('Remove Food', `Remove "${item.name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Remove', 
                            style: 'destructive', 
                            onPress: () => setConsumedFoods(prev => prev.filter(f => f.id !== item.id))
                          }
                        ]);
                      }}
                    >
                      <MaterialCommunityIcons name="close" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                scrollEnabled={false}
              />
            )}
          </View> */}
        </ScrollView>
        )}
      </Animated.View>

      {/* Add Food Options Modal */}
      <Modal visible={showAddFoodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Food to {MEAL_CATEGORIES.find(c => c.id === selectedMealForAdd)?.name}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowAddFoodModal(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.addFoodOptionsContainer}>
              <TouchableOpacity
                style={[styles.addFoodOption, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => {
                  setSelectedMealCategory(selectedMealForAdd);
                  setShowBarcodeScanner(true);
                  setShowAddFoodModal(false);
                }}
              >
                <View style={[styles.addFoodOptionIcon, { backgroundColor: '#10B981' }]}>
                  <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
                </View>
                <View style={styles.addFoodOptionContent}>
                  <Text style={[styles.addFoodOptionTitle, { color: theme.text }]}>Scan Barcode</Text>
                  <Text style={[styles.addFoodOptionSubtitle, { color: theme.textSecondary }]}>Quick & accurate</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addFoodOption, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => {
                  setSelectedMealCategory(selectedMealForAdd);
                  setShowManualInput(true);
                  setShowAddFoodModal(false);
                }}
              >
                <View style={[styles.addFoodOptionIcon, { backgroundColor: '#8B5CF6' }]}>
                  <MaterialCommunityIcons name="pencil" size={24} color="#fff" />
                </View>
                <View style={styles.addFoodOptionContent}>
                  <Text style={[styles.addFoodOptionTitle, { color: theme.text }]}>Manual Entry</Text>
                  <Text style={[styles.addFoodOptionSubtitle, { color: theme.textSecondary }]}>Enter details manually</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addFoodOption, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => {
                  setSelectedMealCategory(selectedMealForAdd);
                  setShowSavedMeals(true);
                  setShowAddFoodModal(false);
                }}
              >
                <View style={[styles.addFoodOptionIcon, { backgroundColor: '#FF6B6B' }]}>
                  <MaterialCommunityIcons name="bookmark" size={24} color="#fff" />
                </View>
                <View style={styles.addFoodOptionContent}>
                  <Text style={[styles.addFoodOptionTitle, { color: theme.text }]}>Saved Meals</Text>
                  <Text style={[styles.addFoodOptionSubtitle, { color: theme.textSecondary }]}>From meal maker</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginTop: 20, padding: 12, borderRadius: 8, alignItems: 'center' }}
            onPress={() => setShowAddFoodModal(false)}
            >
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Saved Meals Modal */}
      <Modal visible={showSavedMeals} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Saved Meals</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Choose a meal from your meal maker
            </Text>
            
            {loadingSavedMeals ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Loading saved meals...
                </Text>
              </View>
            ) : savedMealsFromMaker.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bookmark-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                  No saved meals yet
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>
                  Create meals in the Meal Maker to see them here
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.savedMealsList} showsVerticalScrollIndicator={false}>
                {savedMealsFromMaker.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={[styles.savedMealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => addSavedMealToCalorie(meal)}
                  >
                    <View style={styles.savedMealInfo}>
                      <Text style={[styles.savedMealName, { color: theme.text }]}>
                        {meal.name}
                      </Text>
                      <Text style={[styles.savedMealCategory, { color: theme.textSecondary }]}>
                        {meal.category} • {meal.ingredients.length} ingredients
                      </Text>
                      <View style={styles.savedMealIngredients}>
                        {meal.ingredients.slice(0, 3).map((ingredient, index) => (
                          <Text key={index} style={[styles.ingredientTag, { backgroundColor: theme.border, color: theme.text }]}>
                            {ingredient}
                          </Text>
                        ))}
                        {meal.ingredients.length > 3 && (
                          <Text style={[styles.moreIngredients, { color: theme.textSecondary }]}>
                            +{meal.ingredients.length - 3} more
                          </Text>
                        )}
                      </View>
                    </View>
                    <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, alignItems: 'center' }}
              onPress={() => setShowSavedMeals(false)}
            >
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal - Full Calendar */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a date</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDatePicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Simple inline calendar without external deps */}
            <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
              {/* Month navigator */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.dateNavButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    const d = new Date(currentWeekStart);
                    d.setMonth(d.getMonth() - 1);
                    setCurrentWeekStart(d);
                  }}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={theme.primary} />
                </TouchableOpacity>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{format(currentWeekStart, 'MMMM yyyy')}</Text>
                <TouchableOpacity
                  style={[styles.dateNavButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    const d = new Date(currentWeekStart);
                    d.setMonth(d.getMonth() + 1);
                    setCurrentWeekStart(d);
                  }}
                >
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {/* Weekday headers */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                  <Text key={d} style={{ width: 36, textAlign: 'center', color: theme.textSecondary, fontSize: 12 }}>{d}</Text>
                ))}
              </View>

              {/* Calendar grid */}
              {(() => {
                const firstDay = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1);
                const lastDay = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth() + 1, 0);
                const startOffset = (firstDay.getDay() + 6) % 7; // Monday=0
                const totalDays = lastDay.getDate();
                const weeks = [];
                let day = 1 - startOffset;
                while (day <= totalDays) {
                  const row = [];
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), day);
                    const key = toLocalDateKey(date);
                    const isCurrentMonth = date.getMonth() === currentWeekStart.getMonth();
                    const isSelected = key === logDate;
                    const isTodayCell = key === getTodayKey();
                    row.push(
                      <TouchableOpacity
                        key={key}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginVertical: 4,
                          backgroundColor: isSelected ? theme.primary : 'transparent',
                          opacity: isCurrentMonth ? 1 : 0.35,
                        }}
                        onPress={() => {
                          setLogDate(key);
                          setIsToday(key === getTodayKey());
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : (isTodayCell ? theme.primary : theme.text) }}>
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                    day++;
                  }
                  weeks.push(
                    <View key={`week-${day}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      {row}
                    </View>
                  );
                }
                return <View>{weeks}</View>;
              })()}
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB', flex: undefined }]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.modalButtonText, { color: '#374151', fontWeight: '600' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onProductScanned={(product) => {
          setSelectedFood(product);
          setModalVisible(true);
          setShowBarcodeScanner(false);
        }}
        accentKey={accentKey}
        darkMode={darkMode}
      />

      {/* Barcode Input Modal */}
      <Modal visible={showBarcodeInput} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Barcode</Text>
            
            {/* Meal Category Selection */}
            <Text style={[styles.modalLabel, { color: theme.text }]}>Meal Category</Text>
            <View style={styles.mealCategoryGrid}>
              {MEAL_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.mealCategoryOption,
                    {
                      backgroundColor: selectedMealCategory === category.id ? category.color : theme.background,
                      borderColor: category.color,
                    }
                  ]}
                  onPress={() => setSelectedMealCategory(category.id)}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={20}
                    color={selectedMealCategory === category.id ? '#fff' : category.color}
                  />
                  <Text style={[
                    styles.mealCategoryOptionText,
                    { color: selectedMealCategory === category.id ? '#fff' : theme.text }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter barcode number..."
              placeholderTextColor={theme.textSecondary}
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 }}
                onPress={() => setShowBarcodeInput(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleBarcodeInput}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Food Entry Modal */}
      <Modal visible={showManualInput} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Food Manually</Text>
            
            {/* Meal Category Selection */}
            <Text style={[styles.modalLabel, { color: theme.text }]}>Meal Category</Text>
            <View style={styles.mealCategoryGrid}>
              {MEAL_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.mealCategoryOption,
                    {
                      backgroundColor: selectedMealCategory === category.id ? category.color : theme.background,
                      borderColor: category.color,
                    }
                  ]}
                  onPress={() => setSelectedMealCategory(category.id)}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={20}
                    color={selectedMealCategory === category.id ? '#fff' : category.color}
                  />
                  <Text style={[
                    styles.mealCategoryOptionText,
                    { color: selectedMealCategory === category.id ? '#fff' : theme.text }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Food name..."
              placeholderTextColor={theme.textSecondary}
              value={manualFoodName}
              onChangeText={setManualFoodName}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Calories..."
              placeholderTextColor={theme.textSecondary}
              value={manualFoodCalories}
              onChangeText={setManualFoodCalories}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Protein (g)..."
              placeholderTextColor={theme.textSecondary}
              value={manualFoodProtein}
              onChangeText={setManualFoodProtein}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Carbs (g)..."
              placeholderTextColor={theme.textSecondary}
              value={manualFoodCarbs}
              onChangeText={setManualFoodCarbs}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Fat (g)..."
              placeholderTextColor={theme.textSecondary}
              value={manualFoodFat}
              onChangeText={setManualFoodFat}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 }}
                onPress={() => setShowManualInput(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleManualFoodEntry}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Food Selection Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedFood && selectedFood.id ? 'Edit' : 'Add'} {selectedFood?.name}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {selectedFood?.isApiResult
                ? `${Math.round(selectedFood?.calories || 0)} cal per 100g${selectedFood?.serving_size_g ? ` • ${selectedFood.serving_size_g}g serving${selectedFood?.calories_per_serving ? ` = ${Math.round(selectedFood.calories_per_serving)} cal` : ''}` : ''}`
                : `${selectedFood?.calories} cal per serving`}
            </Text>

            {/* Portion Selection for scanned/API items */}
            {selectedFood?.isApiResult && (
              <View style={{ marginTop: 8 }}>
                {/* Mode switch */}
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {[
                    { key: 'servings', label: 'Servings' },
                    { key: 'grams', label: 'Grams' },
                    { key: 'percent', label: '% of pack' },
                  ].map(m => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setPortionMode(m.key)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginRight: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: portionMode === m.key ? theme.primary : theme.border,
                        backgroundColor: portionMode === m.key ? theme.primary + '22' : 'transparent',
                      }}
                    >
                      <Text style={{ color: theme.text }}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {portionMode === 'servings' && (
                  <View>
                    <Text style={[styles.modalLabel, { color: theme.text }]}>Servings</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="1"
                      placeholderTextColor={theme.textSecondary}
                      value={servingsInput}
                      onChangeText={setServingsInput}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                      {selectedFood?.serving_size_g ? `${selectedFood.serving_size_g}g per serving` : 'Default: 30g per serving'}
                    </Text>
                  </View>
                )}

                {portionMode === 'grams' && (
                  <View>
                    <Text style={[styles.modalLabel, { color: theme.text }]}>Grams</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="e.g., 30"
                      placeholderTextColor={theme.textSecondary}
                      value={gramsInput}
                      onChangeText={setGramsInput}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{`${Math.round(selectedFood.calories)} cal per 100g`}</Text>
                  </View>
                )}

                {/* Live calories preview */}
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: '700', color: theme.text }}>
                    Total: {(() => {
                      const c100 = Number(selectedFood?.calories) || 0;
                      if (portionMode === 'servings') {
                        const s = parseFloat(servingsInput) || 0;
                        const g = selectedFood?.serving_size_g || food.serving_size_g || 30;
                        return Math.round(s * (c100 * g / 100));
                      }
                      if (portionMode === 'grams') {
                        const g = parseFloat(gramsInput) || 0;
                        return Math.round(c100 * g / 100);
                      }
                      if (portionMode === 'percent') {
                        const pct = Math.max(0, Math.min(100, parseFloat(percentInput) || 0));
                        const pkg = selectedFood?.package_size_g || 100;
                        const g = pkg * (pct / 100);
                        return Math.round(c100 * g / 100);
                      }
                      return 0;
                    })()} cal
                  </Text>
                </View>

                {portionMode === 'percent' && (
                  <View>
                    <Text style={[styles.modalLabel, { color: theme.text }]}>% of package</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      placeholder="e.g., 10"
                      placeholderTextColor={theme.textSecondary}
                      value={percentInput}
                      onChangeText={setPercentInput}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Assuming 100g package if unknown</Text>
                  </View>
                )}
              </View>
            )}

            {/* Meal Category Selection */}
            <Text style={[styles.modalLabel, { color: theme.text }]}>Meal Category</Text>
            <View style={styles.mealCategoryGrid}>
              {MEAL_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.mealCategoryOption,
                    {
                      backgroundColor: selectedMealCategory === category.id ? category.color : theme.background,
                      borderColor: category.color,
                    }
                  ]}
                  onPress={() => setSelectedMealCategory(category.id)}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={20}
                    color={selectedMealCategory === category.id ? '#fff' : category.color}
                  />
                  <Text style={[
                    styles.mealCategoryOptionText,
                    { color: selectedMealCategory === category.id ? '#fff' : theme.text }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Quantity..."
              placeholderTextColor={theme.textSecondary}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 }}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => addFoodToMeal(selectedFood)}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {selectedFood && selectedFood.id ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Setting Modal */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.goalModalOverlay}>
          <View style={styles.goalModalContainer}>
            <ScrollView 
              contentContainerStyle={styles.goalModalScrollContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.goalModalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Set Your Daily Goal</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowGoalModal(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary, marginBottom: 16 }]}>
                Choose a preset goal or set a custom calorie target
              </Text>

              {/* Goal Presets */}
              <View style={styles.goalPresetsContainer}>
                <Text style={[styles.modalLabel, { color: theme.text, marginBottom: 8 }]}>Goal Presets</Text>
                {GOAL_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.goalPresetOption,
                      {
                        backgroundColor: selectedGoalPreset === preset.id ? preset.color + '22' : theme.background,
                        borderColor: selectedGoalPreset === preset.id ? preset.color : theme.border,
                      }
                    ]}
                    onPress={() => {
                      setSelectedGoalPreset(preset.id);
                      setGoalType(preset.id);
                      setCustomGoal(preset.calories.toString());
                    }}
                  >
                    <View style={[styles.goalPresetIcon, { backgroundColor: preset.color }]}>
                      <MaterialCommunityIcons name={preset.icon} size={20} color="#fff" />
                    </View>
                    <View style={styles.goalPresetContent}>
                      <View style={styles.goalPresetHeader}>
                        <Text style={[styles.goalPresetName, { color: theme.text }]}>{preset.name}</Text>
                        <Text style={[styles.goalPresetEmoji]}>{preset.emoji}</Text>
                      </View>
                      <Text style={[styles.goalPresetDescription, { color: theme.textSecondary }]}>
                        {preset.description}
                      </Text>
                      <Text style={[styles.goalPresetCalories, { color: preset.color }]}>
                        {preset.calories} calories/day
                      </Text>
                    </View>
                    {selectedGoalPreset === preset.id && (
                      <MaterialCommunityIcons name="check-circle" size={20} color={preset.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Goal Input */}
              <View style={styles.customGoalContainer}>
                <Text style={[styles.modalLabel, { color: theme.text, marginBottom: 8 }]}>Custom Goal</Text>
                <View style={styles.customGoalInputContainer}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    placeholder="Enter calories..."
                    placeholderTextColor={theme.textSecondary}
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.customGoalLabel, { color: theme.textSecondary }]}>calories/day</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.goalModalButtons}>
                <TouchableOpacity
                  style={[styles.goalModalButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => setShowGoalModal(false)}
                >
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalModalButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    if (customGoal && !isNaN(parseInt(customGoal)) && parseInt(customGoal) > 0) {
                      // Use custom goal if entered
                      saveGoal(goalType || 'maintain', customGoal);
                    } else if (selectedGoalPreset) {
                      // Use selected preset
                      const preset = GOAL_PRESETS.find(p => p.id === selectedGoalPreset);
                      saveGoal(selectedGoalPreset, preset.calories);
                    } else {
                      Alert.alert('Select Goal', 'Please select a preset goal or enter a custom amount.');
                    }
                  }}
                >
                  <Text style={[styles.goalModalButtonText, { color: '#fff' }]}>Set Goal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  menuButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  dateNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    gap: 16,
  },
  dateNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  dateDisplayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProgressBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  collapseButton: {
    padding: 8,
  },
  calorieRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringCenter: { 
    position: "absolute", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  ringBig: { 
    fontSize: 24, 
    fontWeight: "800", 
    color: "#0F172A" 
  },
  ringSmall: { 
    marginTop: 2, 
    fontSize: 12, 
    color: "#6B7280" 
  },
  remainingLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  remainingValue: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  compactProgressContainer: {
    paddingVertical: 8,
  },
  compactProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactProgressInfo: {
    flex: 1,
  },
  compactProgressCalories: {
    fontSize: 16,
    fontWeight: '700',
  },
  compactProgressRemaining: {
    fontSize: 12,
    marginTop: 2,
  },
  expandButton: {
    padding: 8,
  },
  compactProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timelineContainer: {
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  timelineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineToggle: {
    padding: 8,
    marginLeft: 8,
  },
  timelineContent: {
    overflow: 'hidden',
  },
  timelineFixedContainer: {
    paddingHorizontal: 1,
    paddingVertical: 16,
  },
  timelineItemContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  timelineLineContainer: {
    width: 22,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E8EEF7',
    marginTop: 4,
    borderRadius: 2,
  },
  enhancedMealCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2FB',
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    minHeight: 120,
    maxHeight: 400,
  
  },
  enhancedMealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enhancedMealCardInfo: {
    flex: 1,
  },
  enhancedMealCardText: {
    flex: 1,
  },
  enhancedMealCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  enhancedMealCardEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  enhancedMealCardName: {
    fontSize: 18,
    fontWeight: '700',
  },
  enhancedMealCardTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  enhancedMealCardStats: {
    alignItems: 'flex-end',
  },
  enhancedMealCardCalories: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  enhancedMealCardCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  enhancedMealCardContent: {
    marginBottom: 8,
  },
  enhancedMealCardEmptyState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  enhancedMealCardEmptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  enhancedMealCardEmpty: {
    fontSize: 16,
    fontWeight: '700',
    color: '#364152',
    textAlign: 'center',
  },
  enhancedMealCardEmptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#7B8794',
    textAlign: 'center',
  },
  enhancedFoodList: {
    marginTop: 8,
  },
  enhancedFoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBFF',
    borderWidth: 1,
    borderColor: '#ECF2FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  enhancedFoodInfo: {
    flex: 1,
  },
  enhancedFoodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  enhancedFoodEmoji: {
    width: 26,
    textAlign: 'center',
    fontSize: 16,
  },
  enhancedFoodName: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  enhancedFoodDetails: {
    fontSize: 14,
    color: '#374151',
  },
  enhancedFoodBrand: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  enhancedFoodActions: {
    flexDirection: 'row',
    gap: 6,
  },
  enhancedFoodActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  enhancedMealCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  enhancedAddFoodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  enhancedAddFoodButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  enhancedScanButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  enhancedScanButtonText: {
    fontWeight: '800',
    fontSize: 15,
  },
  mealCardContainer: {
    marginBottom: 16,
  },
  mealCard: {
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mealCardText: {
    flex: 1,
  },
  mealCardName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  mealCardDescription: {
    fontSize: 13,
  },
  mealCardCalories: {
    fontSize: 16,
    fontWeight: '700',
  },
  mealCardContent: {
    marginBottom: 12,
  },
  mealCardEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  foodList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  foodItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodCalories: {
    fontSize: 13,
  },
  mealCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addFoodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addFoodButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'transparent',
    gap: 6,
  },
  scanButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mealSquaresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    minHeight: 180,
  },
  mealSquare: {
    width: '48%',
    height: 70,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: 12,
  },
  mealSquareIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  mealSquareEmoji: {
    fontSize: 14,
  },
  mealSquareName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  mealSquareCalories: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickAddSection: {
    margin: 16,
  },
  quickAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  primaryAddButton: {
    borderRadius: 16,
    marginBottom: 12,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  primaryAddButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  primaryAddButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  primaryAddButtonText: {
    flex: 1,
  },
  primaryAddButtonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  primaryAddButtonSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 6,
  },
  secondaryAddButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchSection: {
    margin: 16,
    position: 'relative',
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  consumedFoodsSection: {
    margin: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  consumedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  consumedInfo: {
    flex: 1,
  },
  consumedName: {
    fontSize: 16,
    fontWeight: '600',
  },
  consumedDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  searchResults: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 300,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  searchResultsScroll: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchLoadingText: {
    fontSize: 14,
  },
  searchErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchErrorText: {
    fontSize: 14,
  },
  searchNoResultsContainer: {
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  searchNoResultsText: {
    fontSize: 14,
  },
  nutritionGrade: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  nutritionGradeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  removeFoodButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mealCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mealCategoryOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    gap: 6,
  },
  mealCategoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addFoodOptionsContainer: {
    marginVertical: 20,
  },
  addFoodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  addFoodOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addFoodOptionContent: {
    flex: 1,
  },
  addFoodOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  addFoodOptionSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  savedMealsList: {
    maxHeight: 400,
    marginVertical: 20,
  },
  savedMealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  savedMealInfo: {
    flex: 1,
  },
  savedMealName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  savedMealCategory: {
    fontSize: 14,
    marginBottom: 8,
  },
  savedMealIngredients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
  },
  moreIngredients: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Food Intake list styles
  intakeSection: {
    margin: 16,
  },
  intakeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  intakeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  intakeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intakeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  intakeName: {
    fontSize: 15,
    fontWeight: '600',
  },
  intakeLogButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  intakeLogText: {
    color: '#fff',
    fontWeight: '700',
  },
  intakeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intakeItemsList: {
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 8,
  },
  intakeFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intakeFoodName: {
    fontSize: 14,
    fontWeight: '600',
  },
  intakeFoodMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  intakeMoreText: {
    fontSize: 12,
    fontStyle: 'italic',
    alignSelf: 'flex-start',
  },
  intakeSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  intakeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intakeCalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  intakeCalText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Analytics Styles
  analyticsCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  progressStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  mealDistribution: {
    gap: 16,
  },
  mealDistributionItem: {
    gap: 8,
  },
  mealDistributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealDistributionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealDistributionEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  mealDistributionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  mealDistributionCalories: {
    fontSize: 14,
    fontWeight: '600',
  },
  mealDistributionBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mealDistributionFill: {
    height: '100%',
    borderRadius: 4,
  },
  mealDistributionPercentage: {
    fontSize: 12,
    textAlign: 'right',
  },
  macroBreakdown: {
    gap: 16,
  },
  macroItem: {
    gap: 8,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  macroName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  foodItemsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  foodItemsStat: {
    alignItems: 'center',
  },
  foodItemsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  foodItemsLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  weeklyTrendPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  // Date Picker Styles
  datePickerContainer: {
    marginVertical: 20,
    gap: 12,
  },
  datePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  datePickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Goal Modal Styles
  goalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalModalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    marginHorizontal: 'auto',
  },
  goalModalScrollContainer: {
    flexGrow: 1,
  },
  goalModalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  goalPresetsContainer: {
    marginBottom: 16,
  },
  goalPresetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  goalPresetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPresetContent: {
    flex: 1,
  },
  goalPresetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  goalPresetName: {
    fontSize: 14,
    fontWeight: '700',
  },
  goalPresetEmoji: {
    fontSize: 16,
  },
  goalPresetDescription: {
    fontSize: 12,
    marginBottom: 2,
  },
  goalPresetCalories: {
    fontSize: 12,
    fontWeight: '600',
  },
  customGoalContainer: {
    marginBottom: 16,
  },
  customGoalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  customGoalLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  goalModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  goalModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  goalModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactProgressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  goalTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  goalTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ringGoalType: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});