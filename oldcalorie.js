import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,

  PanResponder
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, Defs, Stop, RadialGradient, G, Text as SvgText } from 'react-native-svg';
import { format } from 'date-fns';
import { SwipeListView } from 'react-native-swipe-list-view';
import { getTheme } from './theme';
import { useGamification } from './Gamification';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';

import { PieChart, LineChart } from 'react-native-chart-kit';
import BarcodeScannerModal from './BarcodeScannerModal';

const { width } = Dimensions.get('window');



// Meal timing categories
const MEAL_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'coffee', color: '#F59E0B' },
  { id: 'lunch', name: 'Lunch', icon: 'food', color: '#10B981' },
  { id: 'dinner', name: 'Dinner', icon: 'silverware-fork-knife', color: '#8B5CF6' },
  { id: 'snacks', name: 'Snacks', icon: 'cookie', color: '#F97316' }
];

// Macro ratio presets
const MACRO_PRESETS = {
  balanced: { name: 'Balanced', protein: 25, carbs: 45, fat: 30 },
  highProtein: { name: 'High Protein', protein: 40, carbs: 30, fat: 30 },
  lowCarb: { name: 'Low Carb', protein: 35, carbs: 15, fat: 50 },
  mediterranean: { name: 'Mediterranean', protein: 20, carbs: 40, fat: 40 },
  athletic: { name: 'Athletic', protein: 30, carbs: 45, fat: 25 }
};

// Enhanced food database with more variety and better nutritional data
const FOOD_DATABASE = [
  // Fruits
  { id: 1, name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, vitaminC: 8.4, potassium: 195, serving: '1 medium (182g)', category: 'Fruits' },
  { id: 2, name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, vitaminC: 10.3, potassium: 422, serving: '1 medium (118g)', category: 'Fruits' },
  { id: 3, name: 'Orange', calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, fiber: 3.1, vitaminC: 70, potassium: 237, serving: '1 medium (154g)', category: 'Fruits' },
  { id: 4, name: 'Strawberries', calories: 49, protein: 1, carbs: 12, fat: 0.5, fiber: 3, vitaminC: 89.4, potassium: 233, serving: '1 cup (152g)', category: 'Fruits' },

  // Proteins
  { id: 5, name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, iron: 0.9, zinc: 0.9, serving: '100g', category: 'Proteins' },
  { id: 6, name: 'Salmon', calories: 206, protein: 22, carbs: 0, fat: 12, fiber: 0, omega3: 1.8, vitaminD: 11, serving: '100g', category: 'Proteins' },
  { id: 7, name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0, calcium: 200, probiotics: 1, serving: '1 cup (170g)', category: 'Proteins' },
  { id: 8, name: 'Eggs', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, choline: 147, vitaminB12: 0.9, serving: '2 large eggs (100g)', category: 'Proteins' },
  { id: 9, name: 'Tuna', calories: 132, protein: 28, carbs: 0, fat: 1.3, fiber: 0, omega3: 0.3, selenium: 90, serving: '100g', category: 'Proteins' },

  // Grains & Carbs
  { id: 10, name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 4, magnesium: 84, manganese: 1.8, serving: '1 cup cooked (195g)', category: 'Grains' },
  { id: 11, name: 'Oatmeal', calories: 154, protein: 5.3, carbs: 28, fat: 3.2, fiber: 4, betaGlucan: 3, iron: 2.1, serving: '1 cup cooked (234g)', category: 'Grains' },
  { id: 12, name: 'Quinoa', calories: 222, protein: 8, carbs: 39, fat: 3.6, fiber: 5, iron: 2.8, magnesium: 118, serving: '1 cup cooked (185g)', category: 'Grains' },
  { id: 13, name: 'Whole Wheat Bread', calories: 81, protein: 4, carbs: 14, fat: 1.1, fiber: 2, folate: 14, iron: 0.9, serving: '1 slice (28g)', category: 'Grains' },

  // Vegetables
  { id: 14, name: 'Broccoli', calories: 25, protein: 3, carbs: 5, fat: 0.3, fiber: 2, vitaminC: 89.2, vitaminK: 101.6, serving: '1 cup (91g)', category: 'Vegetables' },
  { id: 15, name: 'Spinach', calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, iron: 0.8, folate: 58, serving: '1 cup (30g)', category: 'Vegetables' },
  { id: 16, name: 'Sweet Potato', calories: 112, protein: 2, carbs: 26, fat: 0.1, fiber: 3.9, vitaminA: 1096, potassium: 542, serving: '1 medium (128g)', category: 'Vegetables' },
  { id: 17, name: 'Carrots', calories: 25, protein: 0.5, carbs: 6, fat: 0.1, fiber: 1.7, vitaminA: 509, betaCarotene: 5054, serving: '1 medium (61g)', category: 'Vegetables' },

  // Healthy Fats
  { id: 18, name: 'Avocado', calories: 234, protein: 2.9, carbs: 12, fat: 21, fiber: 10, potassium: 690, folate: 81, serving: '1 medium (150g)', category: 'Healthy Fats' },
  { id: 19, name: 'Almonds', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 3.5, vitaminE: 7.3, magnesium: 76, serving: '1 oz (28g)', category: 'Healthy Fats' },
  { id: 20, name: 'Olive Oil', calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, vitaminE: 1.9, vitaminK: 8.1, serving: '1 tbsp (13.5g)', category: 'Healthy Fats' },
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

// Helper to format date consistently in local time
const formatDateKey = (date) => {
  return toLocalDateKey(date);
};

// Helper functions for meal categories
const getMealCategoryColor = (category) => {
  const colors = {
    'Breakfast': '#FF6B6B',
    'Lunch': '#4ECDC4',
    'Dinner': '#45B7D1',
    'Snack': '#96CEB4',
    'Dessert': '#FFEAA7',
    'Beverage': '#DDA0DD',
    'Other': '#95A5A6'
  };
  return colors[category] || colors['Other'];
};

const getMealCategoryIcon = (category) => {
  const icons = {
    'Breakfast': 'coffee',
    'Lunch': 'food',
    'Dinner': 'silverware-fork-knife',
    'Snack': 'cookie',
    'Dessert': 'cake',
    'Beverage': 'cup',
    'Other': 'food-variant'
  };
  return icons[category] || icons['Other'];
};

// Helper to format date for display
const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
  return format(d, 'EEE, MMM d, yyyy');
};

// Helper to get week dates for quick navigation (Monday-Sunday)
const getWeekDates = (currentDate) => {
  const dates = [];
  const current = new Date(currentDate + 'T12:00:00'); // Use noon to avoid timezone issues
  const startOfWeek = new Date(current);

  // Calculate days to subtract to get to Monday
  // getDay() returns 0=Sunday, 1=Monday, 2=Tuesday, etc.
  // We want: Sunday=6 days back, Monday=0 days back, Tuesday=1 day back, etc.
  const dayOfWeek = current.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days, otherwise go back (dayOfWeek - 1) days

  startOfWeek.setDate(current.getDate() - daysToSubtract); // Start from Monday

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const key = toLocalDateKey(date);
    dates.push({
      date: key,
      day: format(date, 'EEE'),
      dayNum: format(date, 'd'),
      isToday: key === getTodayKey()
    });
  }
  return dates;
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
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const dateNavScaleAnim = useRef(new Animated.Value(1)).current;
  const swipeDirection = useRef(0); // -1 for left, 1 for right
  
  // State management
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [consumedFoods, setConsumedFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState('2000');

  // Portion selection states for scanned items (caloriesPer100g products)
  const [portionMode, setPortionMode] = useState('servings'); // 'servings' | 'grams' | 'percent'
  const [servingsInput, setServingsInput] = useState('1');
  const [gramsInput, setGramsInput] = useState('');
  const [percentInput, setPercentInput] = useState('0');

  // When a food is selected (e.g., from barcode), preset sensible defaults
  useEffect(() => {
    if (selectedFood?.caloriesPer100g) {
      const defaultGrams = selectedFood.gramsPerServing || 100;
      setPortionMode(selectedFood.caloriesPerServing ? 'servings' : 'grams');
      setServingsInput('1');
      setGramsInput(String(defaultGrams));
      setPercentInput('0');
    }
  }, [selectedFood]);

  // Compute calories for the chosen portion of a scanned product
  const getPortionCalories = () => {
    if (!selectedFood?.caloriesPer100g) {
      // Fallback to quantity x per-item calories
      return (parseFloat(quantity) || 1) * (selectedFood?.calories || 0);
    }
    const c100 = Number(selectedFood.caloriesPer100g) || 0;
    if (portionMode === 'servings') {
      const s = parseFloat(servingsInput) || 0;
      if (selectedFood.caloriesPerServing != null) {
        return s * Number(selectedFood.caloriesPerServing);
      }
      const g = selectedFood.gramsPerServing || 100;
      return s * (c100 * g / 100);
    }
    if (portionMode === 'grams') {
      const g = parseFloat(gramsInput) || 0;
      return c100 * g / 100;
    }
    if (portionMode === 'percent') {
      const pct = Math.max(0, Math.min(100, parseFloat(percentInput) || 0));
      const pkg = Number(selectedFood.packageSizeGrams) || 0;
      const g = pkg * (pct / 100);
      return c100 * g / 100;
    }
    return 0;
  };

  const getPortionLabel = () => {
    if (!selectedFood?.caloriesPer100g) return `${quantity}x serving`;
    if (portionMode === 'servings') return `${servingsInput}x serving`;
    if (portionMode === 'grams') return `${gramsInput}g`;
    if (portionMode === 'percent') return `${percentInput}% of pack`;
    return '1x serving';
  };
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showWeekView, setShowWeekView] = useState(false);
  const [weeklyData, setWeeklyData] = useState({});
  const [showNutritionGoals, setShowNutritionGoals] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState({
    protein: 150, // grams
    carbs: 250,   // grams
    fat: 65,      // grams
    fiber: 25,    // grams
    vitaminC: 90, // mg
    iron: 18,     // mg
    calcium: 1000, // mg
    potassium: 3500 // mg
  });

  // Enhanced meal timing states
  const [selectedMealCategory, setSelectedMealCategory] = useState('breakfast');
  const [showMealCategoryModal, setShowMealCategoryModal] = useState(false);
  const [showMacroPresets, setShowMacroPresets] = useState(false);
  const [selectedMacroPreset, setSelectedMacroPreset] = useState('balanced');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState(7); // days
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [calorieDataLoaded, setCalorieDataLoaded] = useState(false);

  // Progress view swipe state
  const [progressViewIndex, setProgressViewIndex] = useState(0); // 0 = calorie ring, 1 = macro chart
  const progressSwipeAnim = useRef(new Animated.Value(0)).current;
  
  // New states for barcode scanning and manual input
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Saved meals state
  const [savedMeals, setSavedMeals] = useState([]);
  const [showSavedMeals, setShowSavedMeals] = useState(false);

  // API food search states
  const [apiSearchResults, setApiSearchResults] = useState([]);
  const [apiSearchLoading, setApiSearchLoading] = useState(false);
  const [apiSearchError, setApiSearchError] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    serving: '100g'
  });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [logDate, setLogDate] = useState(getTodayKey());
  const [isToday, setIsToday] = useState(true);
  const dataDateRef = useRef(getTodayKey());

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('1');
  const [editMealCategory, setEditMealCategory] = useState('breakfast');

  // Calculate daily totals including micronutrients
  const dailyTotals = consumedFoods.reduce((totals, food) => {
    // If portionCalories is present (from scanned/portion-based entry), use it and scale macros proportionally
    if (typeof food.portionCalories === 'number' && food.caloriesPer100g) {
      const ratio = food.portionCalories / (food.calories || 1 || 1); // fall back to 1 to avoid NaN
      return {
        calories: totals.calories + food.portionCalories,
        protein: totals.protein + ((food.protein || 0) * ratio),
        carbs: totals.carbs + ((food.carbs || 0) * ratio),
        fat: totals.fat + ((food.fat || 0) * ratio),
        fiber: totals.fiber + ((food.fiber || 0) * ratio),
        vitaminC: totals.vitaminC + ((food.vitaminC || 0) * ratio),
        iron: totals.iron + ((food.iron || 0) * ratio),
        calcium: totals.calcium + ((food.calcium || 0) * ratio),
        potassium: totals.potassium + ((food.potassium || 0) * ratio),
      };
    }
    // Legacy quantity-based calculation
    const multiplier = food.quantity || 1;
    return {
      calories: totals.calories + (food.calories * multiplier),
      protein: totals.protein + (food.protein * multiplier),
      carbs: totals.carbs + (food.carbs * multiplier),
      fat: totals.fat + (food.fat * multiplier),
      fiber: totals.fiber + (food.fiber * multiplier),
      vitaminC: totals.vitaminC + ((food.vitaminC || 0) * multiplier),
      iron: totals.iron + ((food.iron || 0) * multiplier),
      calcium: totals.calcium + ((food.calcium || 0) * multiplier),
      potassium: totals.potassium + ((food.potassium || 0) * multiplier),
    };
  }, {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    vitaminC: 0, iron: 0, calcium: 0, potassium: 0
  });

  // Calculate totals by meal category
  const mealTotals = MEAL_CATEGORIES.reduce((acc, category) => {
    const categoryFoods = consumedFoods.filter(food => food.mealCategory === category.id);
    const categoryTotal = categoryFoods.reduce((total, food) => {
      if (typeof food.portionCalories === 'number' && food.caloriesPer100g) {
        return total + food.portionCalories;
      }
      const multiplier = food.quantity || 1;
      return total + (food.calories * multiplier);
    }, 0);
    acc[category.id] = categoryTotal;
    return acc;
  }, {});

  const remainingCalories = dailyGoal - dailyTotals.calories;
  const progressPercentage = Math.min((dailyTotals.calories / Math.max(1, dailyGoal)) * 100, 100);

  // Format portion text for logged items
  const getPortionText = (food) => {
    if (food.portionMode === 'servings') return `${food.servingsInput || 1}x serving`;
    if (food.portionMode === 'grams') return `${food.gramsInput || 0}g`;
    if (food.portionMode === 'percent') return `${food.percentInput || 0}% of pack`;
    return `${food.quantity || 1}x serving`;
  };

  // Get unique categories for filtering
  const categories = ['All', ...new Set(FOOD_DATABASE.map(food => food.category))];

  // Filter foods based on search and category
  const filteredFoods = FOOD_DATABASE.filter(food => {
    const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || food.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Initialize date to today on mount and force update to current date
  useEffect(() => {
    const todayKey = getTodayKey();
    console.log('🚀 Initializing calorie counter with today:', todayKey);
    setLogDate(todayKey);
    setIsToday(true);
    loadNutritionGoals();
    loadSavedMeals();
  }, []);

  // Force update to today's date when component mounts or becomes active
  useEffect(() => {
    const checkAndUpdateToToday = () => {
      const todayKey = getTodayKey();
      if (logDate !== todayKey) {
        console.log('📅 Updating to current date:', todayKey, 'from:', logDate);
        setLogDate(todayKey);
        setIsToday(true);
      }
    };

    // Check immediately
    checkAndUpdateToToday();

    // Set up interval to check periodically
    const interval = setInterval(checkAndUpdateToToday, 30 * 1000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []); // Only run once on mount

  // Trigger API search when user types in search box
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      debouncedApiSearch(searchQuery);
    } else {
      setApiSearchResults([]);
      setApiSearchError(null);
    }
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchQuery]);

  // Load saved meals from Meal Maker
  const loadSavedMeals = async () => {
    try {
      if (userId) {
        const stored = await getUserData(userId, 'userMeals', []);
        setSavedMeals(stored);
      } else {
        const data = await AsyncStorage.getItem('userMeals');
        if (data) setSavedMeals(JSON.parse(data));
      }
    } catch (error) {
      console.warn('Failed to load saved meals:', error);
    }
  };



  // Load nutrition goals from storage
  const loadNutritionGoals = async () => {
    try {
      if (userId) {
        const goals = await getUserData(userId, 'nutritionGoals', nutritionGoals);
        setNutritionGoals(goals);
      } else {
        const stored = await AsyncStorage.getItem('nutritionGoals');
        if (stored) {
          setNutritionGoals(JSON.parse(stored));
        }
      }
    } catch (e) {
      console.warn('Failed to load nutrition goals', e);
    }
  };

  // Save nutrition goals to storage
  const saveNutritionGoals = async (goals) => {
    try {
      if (userId) {
        await setUserData(userId, 'nutritionGoals', goals);
      } else {
        await AsyncStorage.setItem('nutritionGoals', JSON.stringify(goals));
      }
      setNutritionGoals(goals);
    } catch (e) {
      console.warn('Failed to save nutrition goals', e);
    }
  };

  // Load weekly data for analytics with loading state
  const loadWeeklyData = async () => {
    setIsLoadingData(true);
    try {
      const weekDates = getWeekDates(logDate);
      const data = {};

      for (const dateInfo of weekDates) {
        try {
          if (userId) {
            const dayData = await getUserData(userId, 'consumedFoods-' + dateInfo.date, []);
            data[dateInfo.date] = dayData;
          } else {
            const stored = await AsyncStorage.getItem('consumedFoods-' + dateInfo.date);
            data[dateInfo.date] = stored ? JSON.parse(stored) : [];
          }
        } catch (e) {
          data[dateInfo.date] = [];
        }
      }

      setWeeklyData(data);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load consumedFoods from AsyncStorage when date changes with loading state
  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounts

    const loadConsumedFoodsForDate = async (dateKey) => {
      console.log('🔄 Loading consumed foods for date:', dateKey, 'userId:', userId);

      try {
        if (isMounted) {
          setIsLoadingData(true);
          setCalorieDataLoaded(false);
        }

        let stored = [];

        if (userId) {
          // Migrate existing data to user-specific storage
          await migrateToUserStorage(userId, `consumedFoods-${dateKey}`, `consumedFoods-${dateKey}`);
          stored = await getUserData(userId, `consumedFoods-${dateKey}`, []);
          console.log('📱 Loaded from user storage:', stored.length, 'items for', dateKey);
        } else {
          const data = await AsyncStorage.getItem(`consumedFoods-${dateKey}`);
          if (data) {
            stored = JSON.parse(data);
            console.log('💾 Loaded from fallback storage:', stored.length, 'items for', dateKey);
          } else {
            console.log('📭 No data found for date:', dateKey);
          }
        }

        // Only update state if component is still mounted and this is for the current logDate
        if (isMounted && dateKey === logDate) {
          // Ensure we're setting a fresh array, not a reference
          dataDateRef.current = dateKey;
          setConsumedFoods([...stored]);
          setCalorieDataLoaded(true);
          console.log('✅ Successfully loaded', stored.length, 'consumed foods for', dateKey);
        }
      } catch (error) {
        console.warn('❌ Failed to load consumed foods for', dateKey, error);
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

    // Clear current data immediately when date changes to prevent showing wrong data
    setConsumedFoods([]);
    setCalorieDataLoaded(false);

    // Determine slide direction based on swipe direction
    const slideDistance = width * 0.8; // Use 80% of screen width
    const slideOutValue = swipeDirection.current * slideDistance;
    const slideInValue = -swipeDirection.current * slideDistance;

    // Animate out current content in swipe direction
    Animated.timing(contentSlideAnim, {
      toValue: slideOutValue,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Load new data
      loadConsumedFoodsForDate(logDate);

      // Reset slide position to opposite side
      contentSlideAnim.setValue(slideInValue);

      // Animate in new content from opposite direction
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      isMounted = false;
    };
  }, [logDate, userId]);

  // Save consumedFoods to AsyncStorage whenever it changes
  useEffect(() => {
    const saveConsumedFoods = async () => {
      // Don't save during initial loading or if data hasn't been loaded yet
      if (!calorieDataLoaded || isLoadingData) {
        console.log('⏳ Skipping save - data not ready for date:', logDate);
        return;
      }

      const targetDate = dataDateRef.current;
      const storageKey = `consumedFoods-${targetDate}`;
      console.log('💾 Saving consumed foods for date:', targetDate, 'count:', consumedFoods.length);

      try {
        if (userId) {
          await setUserData(userId, storageKey, consumedFoods);
          console.log('✅ Saved to user storage:', storageKey, 'count:', consumedFoods.length);
        } else {
          await AsyncStorage.setItem(storageKey, JSON.stringify(consumedFoods));
          console.log('✅ Saved to fallback storage:', storageKey, 'count:', consumedFoods.length);
        }
      } catch (error) {
        console.warn('❌ Failed to save consumed foods for', logDate, error);
      }
    };

    // Debounce the save operation to prevent rapid saves during barcode scanning
    const timeoutId = setTimeout(() => {
      saveConsumedFoods();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [consumedFoods, logDate, userId, calorieDataLoaded, isLoadingData]);

  // Detect date change while app is open (only if currently viewing today)
  useEffect(() => {
    const interval = setInterval(() => {
      const todayKey = getTodayKey();
      // Only auto-update if we're currently viewing today and the date has changed
      if (isToday && todayKey !== logDate) {
        console.log('📅 Date changed from', logDate, 'to', todayKey, '- auto-updating');
        setLogDate(todayKey);
        setIsToday(true);
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [logDate, isToday]);

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

  // Fetch product data from Open Food Facts API by barcode and optionally auto-add to meals
  const fetchProductData = async (barcode, options = {}) => {
    const { autoAdd = false } = options;
    try {
      setLoading(true);
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`);
      const data = await response.json();

      let foodData = null;
      if (data && data.status === 1 && data.product) {
        const p = data.product;
        const nutriments = p.nutriments || {};
        const parseNumber = (s) => {
          const m = String(s || '').match(/([\d.,]+)/);
          return m ? parseFloat(m[1].replace(',', '.')) : null;
        };
        const caloriesPer100g = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0);
        const caloriesPerServing = nutriments['energy-kcal_serving'] != null ? Number(nutriments['energy-kcal_serving']) : null;
        const gramsPerServing = parseNumber(p.serving_size);
        const packageSizeGrams = parseNumber(p.quantity);
        foodData = {
          id: Date.now(),
          name: p.product_name || p.generic_name || 'Scanned Product',
          // Legacy fields (per 100g) kept for backward compatibility
          calories: Math.round(caloriesPer100g),
          protein: Number(nutriments['proteins_100g'] ?? nutriments['proteins'] ?? 0),
          carbs: Number(nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates'] ?? 0),
          fat: Number(nutriments['fat_100g'] ?? nutriments['fat'] ?? 0),
          fiber: Number(nutriments['fiber_100g'] ?? nutriments['fiber'] ?? 0),
          serving: p.serving_size || '100g',
          barcode: String(barcode),
          category: (p.categories && p.categories.split(',')[0]) || 'Scanned',
          // New fields for portion computation
          caloriesPer100g,
          caloriesPerServing,
          gramsPerServing,
          packageSizeGrams,
        };
      } else {
        // Fallback when product not found
        foodData = {
          id: Date.now(),
          name: 'Unknown Product',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          serving: '100g',
          barcode: String(barcode),
          category: 'Scanned'
        };
      }

      if (autoAdd) {
        // Prefer showing portion selection for scanned items to avoid logging full package by mistake
        setSelectedFood(foodData);
        setModalVisible(true);
      } else {
        setSelectedFood(foodData);
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching product data:', error);
      Alert.alert('Error', 'Failed to fetch product data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle product scanned from shared scanner modal -> fetch nutrition and add to meals
  const handleProductScannedToMeals = (product) => {
    // First close the scanner to avoid UI conflicts
    setShowBarcodeScanner(false);
    
    // Using requestAnimationFrame to ensure the modal is fully closed
    // before we attempt to process the product data
    requestAnimationFrame(() => {
      // Adding a timeout to ensure animation completes before processing
      setTimeout(() => {
        try {
          if (product?.barcode) {
            // Process in the next frame to avoid UI freezing
            requestAnimationFrame(() => {
              fetchProductData(product.barcode, { autoAdd: true })
                .catch(error => {
                  console.error('Error fetching product data:', error);
                  Alert.alert('Error', 'Failed to process scanned product. Please try again.');
                });
            });
          } else if (product?.name) {
            // Product data already available, add directly
            requestAnimationFrame(() => {
              addFoodDirect(product);
            });
          } else {
            Alert.alert('Scan Failed', 'Could not read barcode. Please try again.');
          }
        } catch (error) {
          console.error('Error handling scanned product:', error);
          Alert.alert('Error', 'Failed to process scanned product. Please try again.');
        }
      }, 500); // Wait 500ms to ensure modal close animation is complete
    });
  };

  // Handle manual barcode input
  const handleManualBarcodeInput = () => {
  if (barcodeInput.trim()) {
  fetchProductData(barcodeInput.trim());
  setBarcodeInput('');
  setShowBarcodeInput(false);
  }
  };
  
  // Open edit modal for an existing consumed item
  const openEditModal = (item) => {
  if (!item) return;
  setEditItem(item);
  setEditQuantity(String(item.quantity || 1));
  setEditMealCategory(item.mealCategory || 'breakfast');
  setShowEditModal(true);
  };
  
  // Save changes from the edit modal
  const saveEditItem = () => {
  const q = parseFloat(editQuantity);
  if (!editItem || !q || q <= 0) {
  Alert.alert('Invalid quantity', 'Please enter a valid quantity greater than 0.');
  return;
  }
  setConsumedFoods(prev => prev.map(f => (
  f.id === editItem.id ? { ...f, quantity: q, mealCategory: editMealCategory } : f
  )));
  setShowEditModal(false);
  setEditItem(null);
  };

  const addFoodDirect = (foodData, qty = 1) => {
    if (!foodData) return;

    const todayKey = getTodayKey();
    if (logDate !== todayKey) {
      Alert.alert(
        'Cannot Add Food',
        'You can only add food to today\'s date. Please navigate to today to add food.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Go to Today', 
            onPress: () => {
              setLogDate(todayKey);
              setIsToday(true);
            }
          }
        ]
      );
      return;
    }

    // Create a new food object - we need to create this BEFORE updating state to avoid stale references
    const newFood = {
      ...foodData,
      id: Date.now(),
      quantity: parseFloat(qty) || 1,
      timestamp: new Date().toISOString(),
      mealCategory: selectedMealCategory,
      loggedDate: logDate,
    };

    // Store the date reference right away to avoid race conditions
    dataDateRef.current = todayKey;
    
    // Use requestAnimationFrame to ensure we're updating in a new frame
    requestAnimationFrame(() => {
      // First update consumedFoods - this is the critical state update
      setConsumedFoods(prev => [...prev, newFood]);
      
      // After updating consumed foods, try to update inventory - less critical
      setTimeout(() => {
        try {
          handleLogFoodItem({ name: foodData.name, barcode: foodData.barcode });
        } catch (error) {
          console.warn('Error removing item from inventory:', error);
        }
      }, 0);
      
      // Defer gamification updates to happen in a separate frame
      setTimeout(() => {
        try {
          updateStats('mealsLogged');
          unlockAchievement('CALORIE_TRACKER');
          checkAchievements();
        } catch (error) {
          console.warn('Error updating gamification stats:', error);
        }
        
        // Show success message after state updates and gamification
        setTimeout(() => {
          Alert.alert(
            'Added to Meals',
            `"${foodData.name}" added to ${MEAL_CATEGORIES.find(c => c.id === selectedMealCategory)?.name || 'meal'}.`
          );
        }, 100);
      }, 0);
    });
  };

  // Add food to consumed list with meal category - FIXED to ensure proper date isolation
  const addFood = () => {
    if (selectedFood && quantity) {
      // Only allow adding food to today's date
      const todayKey = getTodayKey();
      if (logDate !== todayKey) {
        Alert.alert(
          'Cannot Add Food',
          'You can only add food to today\'s date. Please navigate to today to add food.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Today', 
              onPress: () => {
                setLogDate(todayKey);
                setIsToday(true);
              }
            }
          ]
        );
        return;
      }

      // Remove from inventory if present (with error handling)
      try {
        handleLogFoodItem({ name: selectedFood.name, barcode: selectedFood.barcode });
      } catch (error) {
        console.warn('Error removing item from inventory:', error);
      }
      
      const portionCalories = Math.round(getPortionCalories());
      const s = parseFloat(servingsInput) || 0;
      const g = parseFloat(gramsInput) || 0;
      const pct = parseFloat(percentInput) || 0;

      const newFood = {
        ...selectedFood,
        id: Date.now(),
        // Keep quantity for legacy UI display, but primary energy comes from portion calculation
        quantity: selectedFood?.caloriesPer100g ? 1 : (parseFloat(quantity) || 1),
        timestamp: new Date().toISOString(),
        mealCategory: selectedMealCategory,
        loggedDate: logDate, // Explicitly track which date this was logged for
        // Portion details for scanned items
        portionMode: selectedFood?.caloriesPer100g ? portionMode : undefined,
        servingsInput: selectedFood?.caloriesPer100g ? s : undefined,
        gramsInput: selectedFood?.caloriesPer100g ? g : undefined,
        percentInput: selectedFood?.caloriesPer100g ? pct : undefined,
        portionCalories: selectedFood?.caloriesPer100g ? portionCalories : undefined,
      };

      console.log('✅ Adding food to consumed foods:', newFood.name, 'for date:', logDate, 'isToday:', isToday);

      // Only update if we're still on the same date (prevent race conditions)
      if (logDate === todayKey) {
        dataDateRef.current = todayKey;
        
        // Use setTimeout to make these operations non-blocking
        setTimeout(() => {
          setConsumedFoods(prev => {
            const updated = [...prev, newFood];
            console.log('✅ Updated consumed foods count:', updated.length, 'for date:', logDate);
            return updated;
          });

          // Defer gamification triggers to prevent blocking
          setTimeout(() => {
            try {
              updateStats('mealsLogged');
              unlockAchievement('CALORIE_TRACKER');
              checkAchievements();
            } catch (error) {
              console.warn('Error updating gamification stats:', error);
            }
          }, 100);
        }, 50);
      } else {
        console.warn('⚠️ Date changed during food addition, skipping update');
      }

      setModalVisible(false);
      setSelectedFood(null);
      setQuantity('1');
    }
  };

  // Add manual food - FIXED to ensure proper date isolation
  const addManualFood = () => {
    if (manualFood.name && manualFood.calories) {
      // Only allow adding food to today's date
      const todayKey = getTodayKey();
      if (logDate !== todayKey) {
        Alert.alert(
          'Cannot Add Food',
          'You can only add food to today\'s date. Please navigate to today to add food.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Today', 
              onPress: () => {
                setLogDate(todayKey);
                setIsToday(true);
              }
            }
          ]
        );
        return;
      }

      // Remove from inventory if present (with error handling)
      try {
        handleLogFoodItem({ name: manualFood.name });
      } catch (error) {
        console.warn('Error removing item from inventory:', error);
      }
      
      const newFood = {
        id: Date.now(),
        name: manualFood.name,
        calories: parseFloat(manualFood.calories) || 0,
        protein: parseFloat(manualFood.protein) || 0,
        carbs: parseFloat(manualFood.carbs) || 0,
        fat: parseFloat(manualFood.fat) || 0,
        fiber: parseFloat(manualFood.fiber) || 0,
        serving: manualFood.serving,
        quantity: 1,
        timestamp: new Date().toISOString(),
        isManual: true,
        category: 'Manual',
        loggedDate: logDate, // Explicitly track which date this was logged for
      };

      console.log('✅ Adding manual food:', newFood.name, 'for date:', logDate);

      // Only update if we're still on today's date
      if (logDate === todayKey) {
        dataDateRef.current = todayKey;
        
        // Use setTimeout to make these operations non-blocking
        setTimeout(() => {
          setConsumedFoods([...consumedFoods, newFood]);

          // Defer gamification triggers to prevent blocking
          setTimeout(() => {
            try {
              updateStats('mealsLogged');
              unlockAchievement('CALORIE_TRACKER');
              checkAchievements();
            } catch (error) {
              console.warn('Error updating gamification stats:', error);
            }
          }, 100);
        }, 50);
      } else {
        console.warn('⚠️ Date changed during manual food addition, skipping update');
      }

      setShowManualInput(false);
      setManualFood({
        name: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        serving: '100g'
      });
    }
  };

  // Add saved meal to consumed foods - FIXED to ensure proper date isolation
  const addSavedMeal = (meal) => {
    if (!meal || !meal.ingredients || meal.ingredients.length === 0) {
      Alert.alert('Error', 'This meal has no ingredients.');
      return;
    }

    // Only allow adding food to today's date
    const todayKey = getTodayKey();
    if (logDate !== todayKey) {
      Alert.alert(
        'Cannot Add Meal',
        'You can only add meals to today\'s date. Please navigate to today to add meals.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Go to Today', 
            onPress: () => {
              setLogDate(todayKey);
              setIsToday(true);
            }
          }
        ]
      );
      return;
    }

    // Calculate total nutrition for the meal by looking up each ingredient
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    // Find matching foods in database for each ingredient
    const mealIngredients = [];
    meal.ingredients.forEach(ingredientName => {
      const foundFood = FOOD_DATABASE.find(food =>
        food.name.toLowerCase().includes(ingredientName.toLowerCase()) ||
        ingredientName.toLowerCase().includes(food.name.toLowerCase())
      );

      if (foundFood) {
        // Use a standard serving size for meal ingredients
        const servingMultiplier = 0.5; // Assume half serving per ingredient in a meal
        totalCalories += foundFood.calories * servingMultiplier;
        totalProtein += foundFood.protein * servingMultiplier;
        totalCarbs += foundFood.carbs * servingMultiplier;
        totalFat += foundFood.fat * servingMultiplier;
        totalFiber += (foundFood.fiber || 0) * servingMultiplier;
        mealIngredients.push(`${foundFood.name} (${Math.round(servingMultiplier * 100)}%)`);
      } else {
        // If ingredient not found in database, add with estimated values
        totalCalories += 50; // Estimate 50 calories per unknown ingredient
        totalProtein += 2;
        totalCarbs += 8;
        totalFat += 1;
        mealIngredients.push(ingredientName);
      }
    });

    const newMealEntry = {
      id: Date.now(),
      name: meal.name,
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
      serving: `1 meal (${meal.ingredients.length} ingredients)`,
      quantity: 1,
      timestamp: new Date().toISOString(),
      mealCategory: selectedMealCategory,
      isSavedMeal: true,
      originalMeal: meal,
      ingredients: mealIngredients,
      category: 'Saved Meal',
      loggedDate: logDate, // Explicitly track which date this was logged for
    };

    console.log('✅ Adding saved meal:', newMealEntry.name, 'for date:', logDate);

    // Only update if we're still on today's date
    if (logDate === todayKey) {
      dataDateRef.current = todayKey;
      setConsumedFoods([...consumedFoods, newMealEntry]);

      // Gamification triggers
      updateStats('mealsLogged');
      unlockAchievement('CALORIE_TRACKER');
      checkAchievements();

      setShowSavedMeals(false);

      Alert.alert(
        'Meal Added!',
        `"${meal.name}" has been added to your ${selectedMealCategory} with ${Math.round(totalCalories)} calories.`,
        [{ text: 'OK', style: 'default' }]
      );
    } else {
      console.warn('⚠️ Date changed during saved meal addition, skipping update');
      setShowSavedMeals(false);
    }
  };



  const removeFood = (foodId) => {
    setConsumedFoods(consumedFoods.filter(food => food.id !== foodId));
  };

  const updateGoal = () => {
    const goal = parseInt(newGoal);
    if (goal && goal > 0) {
      setDailyGoal(goal);
      setShowGoalModal(false);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeeklyData();
    setRefreshing(false);
  };

  // Search for foods using Open Food Facts API
  const searchApiFood = async (query) => {
    if (!query || query.trim().length < 2) {
      setApiSearchResults([]);
      return;
    }

    try {
      setApiSearchLoading(true);
      setApiSearchError(null);

      const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,categories,nutrition_grades,nutriments,image_url,code`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.products && Array.isArray(data.products)) {
        const foods = data.products
          .filter(product => product.product_name && product.product_name.trim())
          .slice(0, 15)
          .map(product => ({
            id: `api-${product.code || Date.now()}-${Math.random()}`,
            name: product.product_name,
            brand: product.brands || '',
            category: product.categories ? product.categories.split(',')[0] : 'Food',
            calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy-kcal'] || 0,
            protein: product.nutriments?.proteins_100g || product.nutriments?.proteins || 0,
            carbs: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0,
            fat: product.nutriments?.fat_100g || product.nutriments?.fat || 0,
            fiber: product.nutriments?.fiber_100g || product.nutriments?.fiber || 0,
            serving: '100g',
            nutrition_grade: product.nutrition_grades || '',
            image_url: product.image_url || null,
            barcode: product.code || '',
          }));

        setApiSearchResults(foods);
      } else {
        setApiSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching API foods:', error);
      setApiSearchError(error.message);
      setApiSearchResults([]);
    } finally {
      setApiSearchLoading(false);
    }
  };

  // Debounced search function
  const debouncedApiSearch = (query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      searchApiFood(query);
    }, 500);
    setSearchTimeout(timeout);
  };

  const getNutritionGradeColor = (grade) => {
    switch ((grade || '').toLowerCase()) {
      case 'a': return '#00C851';
      case 'b': return '#7CB342';
      case 'c': return '#FFB300';
      case 'd': return '#FF8F00';
      case 'e': return '#FF3547';
      default: return '#9E9E9E';
    }
  };

  // Call this function when a food item is logged/entered
  const handleLogFoodItem = (loggedItem) => {
    // loggedItem: { name, barcode, ... }
    setFoodInventory(prevInventory => {
      // Try to match by barcode first if available, else by name (case-insensitive)
      const matchIndex = prevInventory.findIndex(item =>
        (loggedItem.barcode && item.barcode && item.barcode === loggedItem.barcode) ||
        (item.name && loggedItem.name && item.name.trim().toLowerCase() === loggedItem.name.trim().toLowerCase())
      );
      if (matchIndex === -1) return prevInventory; // Not found, do nothing
      const item = prevInventory[matchIndex];
      if ((item.quantity || 1) > 1) {
        // Decrease quantity by 1
        const updated = [...prevInventory];
        updated[matchIndex] = { ...item, quantity: (item.quantity || 1) - 1 };
        return updated;
      } else {
        // Remove item
        return prevInventory.filter((_, idx) => idx !== matchIndex);
      }
    });
    
    // Mark item as consumed in spending history
    markItemAsConsumed(loggedItem.name, loggedItem.barcode);
  };

  // Enhanced progress ring with animations
  const CalorieProgressRing = () => {
    const size = 160;
    const strokeWidth = 14;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(dailyTotals.calories / dailyGoal, 1);
    const strokeDashoffset = circumference * (1 - progress);

    // Animated progress value
    const animatedProgress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }, [progress]);

    return (
      <View style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}>
        <View style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            stroke={theme.border}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle with gradient */}
          <Circle
            stroke={progress >= 1 ? theme.success : progress > 0.8 ? theme.warning : theme.primary}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[styles.progressTextSvg, { position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.caloriesNumber, { color: isDefault ? theme.text : theme.accent }]}>
            {Math.round(dailyTotals.calories)}
          </Text>
          <Text style={[styles.caloriesLabel, { color: theme.textSecondary }]}>
            of {dailyGoal}
          </Text>
          <Text style={[styles.progressPercentage, { color: theme.textSecondary, fontSize: 12, marginTop: 2 }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        </View>
      </View>
    );
  };

  // Custom SVG Pie Chart Component
  const CustomPieChart = ({ data, size = 120 }) => {
    const center = size / 2;
    const radius = size / 2 - 10;

    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) return null;

    let currentAngle = -90; // Start from top

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
        <Svg width={size} height={size}>
          {data.map((item, index) => {
          const percentage = item.value / total;
          const angle = percentage * 360;

          // Calculate path for pie slice
          const startAngle = (currentAngle * Math.PI) / 180;
          const endAngle = ((currentAngle + angle) * Math.PI) / 180;

          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);

          const largeArcFlag = angle > 180 ? 1 : 0;

          const pathData = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');

          currentAngle += angle;

          return (
            <Path
              key={index}
              d={pathData}
              fill={item.color}
              stroke="#fff"
              strokeWidth="2"
            />
          );
        })}
      </Svg>
      </View>
    );
  };

  // Enhanced Macro distribution pie chart
  const MacroDistributionChart = () => {
    const totalMacros = dailyTotals.protein + dailyTotals.carbs + dailyTotals.fat;

    if (totalMacros === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <MaterialCommunityIcons name="chart-pie" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
            No macro data available
          </Text>
          <Text style={[styles.emptyChartSubtext, { color: theme.textSecondary }]}>
            Add some foods to see macro distribution
          </Text>
        </View>
      );
    }

    // Calculate percentages for better display
    const totalCalories = dailyTotals.protein * 4 + dailyTotals.carbs * 4 + dailyTotals.fat * 9;
    const proteinPercent = totalCalories > 0 ? Math.round((dailyTotals.protein * 4 / totalCalories) * 100) : 0;
    const carbsPercent = totalCalories > 0 ? Math.round((dailyTotals.carbs * 4 / totalCalories) * 100) : 0;
    const fatPercent = totalCalories > 0 ? Math.round((dailyTotals.fat * 9 / totalCalories) * 100) : 0;

    const proteinKcal = Math.round(dailyTotals.protein * 4);
    const carbsKcal = Math.round(dailyTotals.carbs * 4);
    const fatKcal = Math.round(dailyTotals.fat * 9);

    // Compute goal (target) macro ratio from current goals
    const goalTotalCalories = (nutritionGoals.protein || 0) * 4 + (nutritionGoals.carbs || 0) * 4 + (nutritionGoals.fat || 0) * 9;
    const goalProteinPercent = goalTotalCalories > 0 ? Math.round(((nutritionGoals.protein || 0) * 4 / goalTotalCalories) * 100) : 0;
    const goalCarbsPercent = goalTotalCalories > 0 ? Math.round(((nutritionGoals.carbs || 0) * 4 / goalTotalCalories) * 100) : 0;
    const goalFatPercent = goalTotalCalories > 0 ? Math.round(((nutritionGoals.fat || 0) * 9 / goalTotalCalories) * 100) : 0;

    // Prepare data for custom pie chart
    const pieData = [];

    if (dailyTotals.protein > 0) {
      pieData.push({
        name: 'Protein',
        value: dailyTotals.protein * 4,
        color: '#F87171',
      });
    }

    if (dailyTotals.carbs > 0) {
      pieData.push({
        name: 'Carbs',
        value: dailyTotals.carbs * 4,
        color: '#FBBF24',
      });
    }

    if (dailyTotals.fat > 0) {
      pieData.push({
        name: 'Fat',
        value: dailyTotals.fat * 9,
        color: '#60A5FA',
      });
    }

    return (
      <View style={styles.macroChartContainer}>
        <Text style={[styles.macroChartTitle, { color: theme.text }]}>Macro Distribution</Text>

        {/* Custom SVG Pie Chart */}
        <View style={styles.pieChartWrapper}>
          <CustomPieChart data={pieData} size={140} />
        </View>

        {/* Legend key for the pie */}
        <View style={styles.macroLegendRow}>
          {dailyTotals.protein > 0 && (
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendSwatch, { backgroundColor: '#F87171' }]} />
              <Text style={[styles.macroLegendText, { color: theme.text }]}>Protein (P) {proteinPercent}%</Text>
            </View>
          )}
          {dailyTotals.carbs > 0 && (
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendSwatch, { backgroundColor: '#FBBF24' }]} />
              <Text style={[styles.macroLegendText, { color: theme.text }]}>Carbs (C) {carbsPercent}%</Text>
            </View>
          )}
          {dailyTotals.fat > 0 && (
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendSwatch, { backgroundColor: '#60A5FA' }]} />
              <Text style={[styles.macroLegendText, { color: theme.text }]}>Fat (F) {fatPercent}%</Text>
            </View>
          )}
        </View>

        {/* Goal vs Actual macro ratios */}
        {goalTotalCalories > 0 && (
          <Text style={[styles.macroGoalActual, { color: theme.textSecondary }]}>
            Goal: P{goalProteinPercent}% C{goalCarbsPercent}% F{goalFatPercent}% • Actual: P{proteinPercent}% C{carbsPercent}% F{fatPercent}%
          </Text>
        )}
        {(nutritionGoals.protein || nutritionGoals.carbs || nutritionGoals.fat) ? (
          <Text style={[styles.macroGoalGrams, { color: theme.textSecondary }]}> 
            Grams: P {Math.round(dailyTotals.protein)}/{nutritionGoals.protein || 0}g • C {Math.round(dailyTotals.carbs)}/{nutritionGoals.carbs || 0}g • F {Math.round(dailyTotals.fat)}/{nutritionGoals.fat || 0}g
          </Text>
        ) : null}

        {/* Enhanced Macro summary with percentages */}
        <View style={styles.macroSummary}>
          {dailyTotals.protein > 0 && (
            <View style={styles.macroSummaryItem}>
              <Text style={[styles.macroSummaryText, { color: theme.text, fontSize: 13 }]}>
                Protein: {Math.round(dailyTotals.protein)}g • {proteinKcal} kcal • {proteinPercent}%
              </Text>
            </View>
          )}
          {dailyTotals.carbs > 0 && (
            <View style={styles.macroSummaryItem}>
              <Text style={[styles.macroSummaryText, { color: theme.text, fontSize: 13 }]}>
                Carbs: {Math.round(dailyTotals.carbs)}g • {carbsKcal} kcal • {carbsPercent}%
              </Text>
            </View>
          )}
          {dailyTotals.fat > 0 && (
            <View style={styles.macroSummaryItem}>
              <Text style={[styles.macroSummaryText, { color: theme.text, fontSize: 13 }]}>
                Fat: {Math.round(dailyTotals.fat)}g • {fatKcal} kcal • {fatPercent}%
              </Text>
            </View>
          )}
        </View>

        {/* Total calories from macros */}
        <Text style={[styles.totalMacroCalories, { color: theme.textSecondary, marginTop: -10 }]}>
          Total: {Math.round(totalCalories)} calories from macros
        </Text>
      </View>
    );
  };

  // Simplified Swipeable Progress View Component
  const SwipeableProgressView = () => {
    const handleSwipe = () => {
      // Simple toggle approach - any swipe toggles between views
      const newIndex = progressViewIndex === 0 ? 1 : 0;

      setProgressViewIndex(newIndex);
      // Direct setValue - no animation
      progressSwipeAnim.setValue(newIndex);
    };

    // Improved pan responder with lower thresholds
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Lower threshold for better responsiveness
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderMove: (_, __) => {
          // Optional: Add real-time swipe feedback here
        },
        onPanResponderRelease: (_, gestureState) => {
          // Lower threshold for swipe detection (30px instead of 50px)
          if (Math.abs(gestureState.dx) > 30) {
            // Any swipe toggles between views
            handleSwipe();
          }
        },
      })
    ).current;



    return (
      <View style={styles.swipeableProgressContainer}>
        {/* Progress Indicators */}
        <View style={styles.progressIndicators}>
          <TouchableOpacity
            style={[
              styles.progressIndicator,
              { backgroundColor: progressViewIndex === 0 ? theme.primary : theme.border }
            ]}
            onPress={() => {
              setProgressViewIndex(0);
              progressSwipeAnim.setValue(0);
            }}
          />
          <TouchableOpacity
            style={[
              styles.progressIndicator,
              { backgroundColor: progressViewIndex === 1 ? theme.primary : theme.border }
            ]}
            onPress={() => {
              setProgressViewIndex(1);
              progressSwipeAnim.setValue(1);
            }}
          />
        </View>
        


        {/* Current View Indicator */}
        <Text style={[styles.currentViewText, { color: theme.textSecondary }]}>
          {progressViewIndex === 0 ? '' : ''}
        </Text>


        {/* Simple Centered Content - Only show current view */}
        <View style={styles.centeredViewContainer} {...panResponder.panHandlers}>
          {progressViewIndex === 0 ? (
            <View style={[styles.centeredContent, styles.calorieViewUp]}>
              <Text style={[styles.macroChartTitle, styles.calorieTitle, { color: theme.text, marginTop: -50 }]}>Calorie Counter</Text>
              <CalorieProgressRing />
            </View>
          ) : (
            <View style={styles.centeredContent}>
              <MacroDistributionChart />
            </View>
          )}
        </View>

        {/* View Labels */}
        <View style={[styles.progressViewLabels, { marginTop: progressViewIndex === 1 ? 30 : -30 }]}>
          <TouchableOpacity
            onPress={() => {
              setProgressViewIndex(0);
              progressSwipeAnim.setValue(0);
            }}
            style={styles.progressViewLabelButton}
          >
            <Text style={[
              styles.progressViewLabel,
              {
                color: progressViewIndex === 0 ? theme.primary : theme.textSecondary,
                fontWeight: progressViewIndex === 0 ? '600' : '400'
              }
            ]}>
              Calories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setProgressViewIndex(1);
              progressSwipeAnim.setValue(1);
            }}
            style={styles.progressViewLabelButton}
          >
            <Text style={[
              styles.progressViewLabel,
              {
                color: progressViewIndex === 1 ? theme.primary : theme.textSecondary,
                fontWeight: progressViewIndex === 1 ? '600' : '400'
              }
            ]}>
              Macros
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const NutritionProgressBar = ({ label, current, goal, color, unit = 'g' }) => {
    const progress = Math.min(current / goal, 1);
    const percentage = Math.round(progress * 100);

    return (
      <View style={styles.nutritionProgressContainer}>
        <View style={styles.nutritionProgressHeader}>
          <Text style={[styles.nutritionProgressLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.nutritionProgressValue, { color: color }]}>
            {Math.round(current)}/{goal}{unit} ({percentage}%)
          </Text>
        </View>
        <View style={[styles.nutritionProgressTrack, { backgroundColor: theme.border }]}>
          <Animated.View
            style={[
              styles.nutritionProgressFill,
              { backgroundColor: color, width: `${percentage}%` }
            ]}
          />
        </View>
      </View>
    );
  };

  // Meal category selector
  const MealCategorySelector = () => (
    <View style={styles.mealCategoryRow}>
      {MEAL_CATEGORIES.map((category) => {
        const categoryTotal = mealTotals[category.id] || 0;
        const isSelected = selectedMealCategory === category.id;

        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.mealCategoryButton,
              {
                backgroundColor: isSelected ? category.color : theme.surface,
                borderColor: category.color
              }
            ]}
            onPress={() => setSelectedMealCategory(category.id)}
          >
            <MaterialCommunityIcons
              name={category.icon}
              size={18}
              color={isSelected ? '#fff' : category.color}
            />
            <Text style={[
              styles.mealCategoryText,
              { color: isSelected ? '#fff' : theme.text }
            ]}>
              {category.name}
            </Text>
            <Text style={[
              styles.mealCategoryCalories,
              { color: isSelected ? '#fff' : theme.textSecondary }
            ]}>
              {Math.round(categoryTotal)} cal
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Enhanced micronutrient section
  const MicronutrientSection = () => (
    <View style={styles.micronutrientSection}>
      <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 16 }]}>
        Micronutrients
      </Text>
      <View style={styles.micronutrientGrid}>
        <View style={styles.micronutrientRow}>
          <NutritionProgressBar
            label="Vitamin C"
            current={dailyTotals.vitaminC}
            goal={nutritionGoals.vitaminC}
            color="#FF6B6B"
            unit="mg"
          />
          <NutritionProgressBar
            label="Iron"
            current={dailyTotals.iron}
            goal={nutritionGoals.iron}
            color="#4ECDC4"
            unit="mg"
          />
        </View>
        <View style={styles.micronutrientRow}>
          <NutritionProgressBar
            label="Calcium"
            current={dailyTotals.calcium}
            goal={nutritionGoals.calcium}
            color="#45B7D1"
            unit="mg"
          />
          <NutritionProgressBar
            label="Potassium"
            current={dailyTotals.potassium}
            goal={nutritionGoals.potassium}
            color="#96CEB4"
            unit="mg"
          />
        </View>
      </View>
    </View>
  );

  // Skeleton loading component
  const SkeletonLoader = ({ width = '100%', height = 20, style = {} }) => (
    <View style={[
      {
        width,
        height,
        backgroundColor: theme.border,
        borderRadius: 4,
        opacity: 0.6,
      },
      style
    ]} />
  );

  const WeeklyCalendarView = () => {
    const weekDates = getWeekDates(logDate);

    return (
      <View style={styles.weeklyCalendar}>
        <View style={styles.weeklyCalendarHeader}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => changeWeek(-1)}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.primary} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0, paddingLeft: 55 }]}>
            Weekly Overview
          </Text>

          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => changeWeek(1)}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekDaysContainer}>
          {weekDates.map((dateInfo) => {
            const dayData = weeklyData[dateInfo.date] || [];
            const dayCalories = dayData.reduce((total, food) => {
              if (typeof food.portionCalories === 'number' && food.caloriesPer100g) {
                return total + food.portionCalories;
              }
              return total + (food.calories * (food.quantity || 1));
            }, 0);
            const progress = Math.min(dayCalories / dailyGoal, 1);

            return (
              <TouchableOpacity
                key={dateInfo.date}
                style={[
                  styles.weekDayCard,
                  {
                    backgroundColor: dateInfo.isToday ? theme.primary : theme.surface,
                    borderColor: theme.border
                  }
                ]}
                onPress={() => {
                  setLogDate(dateInfo.date);
                  setIsToday(dateInfo.isToday);
                  setShowWeekView(false);
                }}
              >
                <Text style={[
                  styles.weekDayLabel,
                  { color: dateInfo.isToday ? '#fff' : theme.textSecondary }
                ]}>
                  {dateInfo.day}
                </Text>
                <Text style={[
                  styles.weekDayNumber,
                  { color: dateInfo.isToday ? '#fff' : theme.text }
                ]}>
                  {dateInfo.dayNum}
                </Text>
                <View style={[
                  styles.weekDayProgress,
                  { backgroundColor: dateInfo.isToday ? 'rgba(255,255,255,0.3)' : theme.border }
                ]}>
                  <Animated.View
                    style={[
                      styles.weekDayProgressFill,
                      {
                        backgroundColor: dateInfo.isToday ? '#fff' : theme.success,
                        width: `${Math.min(progress * 100, 100)}%`
                      }
                    ]}
                  />
                </View>
                <Text style={[
                  styles.weekDayCalories,
                  { color: dateInfo.isToday ? '#fff' : theme.textSecondary }
                ]}>
                  {Math.round(dayCalories)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const CategoryFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryButton,
            {
              backgroundColor: selectedCategory === category ? theme.primary : theme.surface,
              borderColor: theme.border
            }
          ]}
          onPress={() => setSelectedCategory(category)}
        >
          <Text style={[
            styles.categoryButtonText,
            { color: selectedCategory === category ? '#fff' : theme.text }
          ]}>
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const FoodItem = ({ food, onPress }) => (
    <TouchableOpacity
      style={[styles.foodItem, { backgroundColor: theme.surface, borderColor: theme.border, paddingVertical: 8, paddingHorizontal: 10 }]}
      onPress={() => onPress(food)}
      activeOpacity={0.7}
    >
      <View style={styles.foodInfo}>
        <Text style={[styles.foodName, { color: theme.text, fontSize: 14 }]}>{food.name}</Text>
        <Text style={[styles.foodServing, { color: theme.textSecondary, fontSize: 12 }]}>{food.serving}</Text>
        <Text style={[styles.foodCategory, { color: theme.accent, fontSize: 11 }]}>{food.category}</Text>
      </View>
      <View style={styles.foodCalories}>
        <Text style={[styles.calorieNumber, { color: theme.primary, fontSize: 14 }]}>{food.calories}</Text>
        <Text style={[styles.calorieLabel, { color: theme.textSecondary, fontSize: 10 }]}>cal</Text>
      </View>
    </TouchableOpacity>
  );

  const ConsumedFoodItem = ({ food }) => {
    const mealCategory = MEAL_CATEGORIES.find(cat => cat.id === food.mealCategory);

    return (
      <TouchableOpacity
        style={[styles.consumedItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => openEditModal(food)}
        onLongPress={() => {
          Alert.alert('Remove Food', `Remove "${food.name}" from this day?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeFood(food.id) }
          ]);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.consumedInfo}>
          <View style={styles.consumedHeader}>
            <Text style={[styles.consumedName, { color: theme.text }]}>{food.name}</Text>
            {mealCategory && (
              <View style={[styles.mealCategoryTag, { backgroundColor: mealCategory.color + '20' }]}>
                <MaterialCommunityIcons name={mealCategory.icon} size={12} color={mealCategory.color} />
                <Text style={[styles.mealCategoryTagText, { color: mealCategory.color }]}>
                  {mealCategory.name}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.consumedDetails, { color: theme.textSecondary }]}>
            {food.portionCalories != null ? (
              `${getPortionText(food)} • ${Math.round(food.portionCalories)} cal`
            ) : (
              `${food.quantity}x serving • ${Math.round(food.calories * (food.quantity || 1))} cal`
            )}
            {food.isManual && <Text style={{ color: theme.accent }}> • Manual</Text>}
            {food.barcode && <Text style={{ color: theme.success }}> • Scanned</Text>}
          </Text>
          {/* Enhanced nutrition info */}
          <Text style={[styles.consumedNutrition, { color: theme.textSecondary }]}>
            P: {Math.round(food.protein * food.quantity)}g •
            C: {Math.round(food.carbs * food.quantity)}g •
            F: {Math.round(food.fat * food.quantity)}g
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: theme.error + '15' }]}
          onPress={() => removeFood(food.id)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={16} color={theme.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };



  // Helper to check if we can navigate forward
  const canGoForward = () => {
    // Use the same logic as changeDay
    const currentDate = new Date(logDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + 1);

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const tomorrowString = `${year}-${month}-${day}`;

    const todayString = getTodayKey();
    return tomorrowString <= todayString;
  };

  // Helper to change day - Prevent going forward beyond today
  const changeDay = (direction) => {
    try {
      // Use a simpler approach - work directly with the date string
      const currentDate = new Date(logDate + 'T12:00:00'); // Use noon to avoid timezone issues

      // Add/subtract days
      currentDate.setDate(currentDate.getDate() + direction);

      // Format as YYYY-MM-DD
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const newDateString = `${year}-${month}-${day}`;

      const todayString = getTodayKey();

      // Prevent going forward beyond today with user feedback
      if (direction > 0 && newDateString > todayString) {
        Alert.alert(
          'Cannot Go Forward',
          'You can only view past and current day data, not future dates.',
          [{ text: 'OK', style: 'default' }]
        );
        return; // Don't allow going forward beyond today
      }

      // Set swipe direction for animation
      swipeDirection.current = direction;

      // Animate the date navigation button
      Animated.sequence([
        Animated.timing(dateNavScaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(dateNavScaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Update the date
      setLogDate(newDateString);
      setIsToday(newDateString === todayString);
    } catch (error) {
      console.error('Error changing day:', error);
      Alert.alert('Error', 'Failed to change date. Please try again.');
    }
  };

  // Helper to change week - Fixed implementation
  const changeWeek = (direction) => {
  try {
  const current = new Date(logDate + 'T12:00:00'); // Use noon to avoid timezone issues
  current.setDate(current.getDate() + (direction * 7));
  const newDate = toLocalDateKey(current);
  setLogDate(newDate);
  setIsToday(newDate === getTodayKey());
  loadWeeklyData();
  } catch (error) {
  console.error('Error changing week:', error);
  Alert.alert('Error', 'Failed to change week. Please try again.');
  }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.headerBar, { backgroundColor: theme.surface }]}> 
        <TouchableOpacity style={[styles.menuButtonCircle, { backgroundColor: 'rgba(0,0,0,0.1)' }]} onPress={() => navigation.openDrawer()}>
          <MaterialCommunityIcons name="menu" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.headerTitleWrap, { flexShrink: 1 }] }>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="fire" size={22} color={isDefault ? theme.text : theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, { color: isDefault ? theme.text : theme.accent }]} numberOfLines={1} ellipsizeMode="tail">Calorie Counter</Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Track your daily nutrition</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.headerActionButton, { backgroundColor: theme.surface }]} 
            onPress={() => {
              setShowWeekView(!showWeekView);
              if (!showWeekView) loadWeeklyData();
            }}
          >
            <MaterialCommunityIcons name="calendar-week" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: theme.surface }]} onPress={() => navigation.navigate('Profile')}>
            <MaterialCommunityIcons name="account" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* DATE NAVIGATION BAR */}
      <Animated.View 
        style={[
          styles.dateNavBar, 
          { 
            backgroundColor: theme.surface, 
            borderBottomColor: theme.border,
            transform: [{ scale: dateNavScaleAnim }]
          }
        ]}
      >
        {/* Previous Day Button */}
        <TouchableOpacity
          onPress={() => changeDay(-1)}
          style={styles.dateNavArrow}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={isDefault ? '#1E293B' : theme.accent}
          />
        </TouchableOpacity>

        {/* Current Date Display */}
        <View style={styles.dateNavTextContainer}>
          <Text style={[styles.dateNavText, { color: isDefault ? '#1E293B' : theme.accent }]}>
            {formatDisplayDate(logDate)}
          </Text>
          {!isToday && (
            <TouchableOpacity
              onPress={() => {
                const todayKey = getTodayKey();
                setLogDate(todayKey);
                setIsToday(true);
              }}
              style={[styles.todayButton, { backgroundColor: theme.primary + '1A', borderColor: theme.primary + '33' }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.todayButtonText, { color: theme.primary }]}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Next Day Button */}
        <TouchableOpacity
          onPress={() => changeDay(1)}
          style={[styles.dateNavArrow, !canGoForward() && { opacity: 0.3 }]}
          disabled={!canGoForward()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={!canGoForward() ? theme.textSecondary : (isDefault ? '#1E293B' : theme.accent)}
          />
        </TouchableOpacity>
      </Animated.View>

      
      {/* Weekly Calendar View */}
      {showWeekView && <WeeklyCalendarView />}

      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onProductScanned={handleProductScannedToMeals}
        accentKey={accentKey}
        darkMode={darkMode}
      />

      {/* --- REST OF CONTENT --- */}
      <Animated.View 
        style={[
          { flex: 1 },
          {
            transform: [{ translateX: contentSlideAnim }]
          }
        ]}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 40 }} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >

          {/* Progress Card - Moved up */}
          <View style={[styles.progressCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
            <View style={styles.progressHeaderRow}>
              <Text style={[styles.progressTitle, { color: theme.text }]}>
                {isToday ? "Today's Progress" : `${formatDisplayDate(logDate)} Progress`}
              </Text>
              <TouchableOpacity style={styles.goalButton} onPress={() => setShowGoalModal(true)}>
                <MaterialCommunityIcons name="target" size={18} color={theme.primary} />
                <Text style={styles.goalButtonText}>Goal</Text>
              </TouchableOpacity>
            </View>

            {/* Swipeable Progress Views */}
            <SwipeableProgressView />

            {/* Only show remaining calories when viewing the calorie counter (index 0) */}
            {progressViewIndex === 0 && (
              <>
                <Text style={[styles.remainingLabel, { color: theme.textSecondary, marginTop: 1 }]} numberOfLines={1} ellipsizeMode="tail">Remaining Calories</Text>
                <Text style={[styles.remainingValue, { color: isDefault ? theme.text : theme.success, marginTop: 1 }]}>{remainingCalories > 0 ? remainingCalories : 0}</Text>
              </>
            )}
          </View>

          {/* Meal Category Selector */}
          <View style={styles.mealCategorySection}>
            <Text style={[styles.sectionTitle, { color: isDefault ? theme.text : theme.accent }]}>Meal Categories</Text>
            <MealCategorySelector />
          </View>

          {/* Enhanced Nutrition Breakdown */}
          <View style={styles.nutritionSection}>
            <View style={styles.nutritionHeader}>
              <Text style={[styles.sectionTitle, { color: isDefault ? theme.text : theme.accent }]}>Nutrition Breakdown</Text>
              <View style={styles.nutritionHeaderActions}>
                <TouchableOpacity
                  style={styles.nutritionGoalsButton}
                  onPress={() => setShowMacroPresets(true)}
                >
                  <MaterialCommunityIcons name="tune" size={16} color={theme.primary} />
                  <Text style={[styles.nutritionGoalsButtonText, { color: theme.primary }]}>Presets</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nutritionGoalsButton}
                  onPress={() => setShowNutritionGoals(true)}
                >
                  <MaterialCommunityIcons name="cog" size={16} color={theme.primary} />
                  <Text style={[styles.nutritionGoalsButtonText, { color: theme.primary }]}>Goals</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.nutritionProgressBars}>
              <NutritionProgressBar
                label="Protein"
                current={dailyTotals.protein}
                goal={nutritionGoals.protein}
                color="#F87171"
              />
              <NutritionProgressBar
                label="Carbs"
                current={dailyTotals.carbs}
                goal={nutritionGoals.carbs}
                color="#FBBF24"
              />
              <NutritionProgressBar
                label="Fat"
                current={dailyTotals.fat}
                goal={nutritionGoals.fat}
                color="#60A5FA"
              />
              <NutritionProgressBar
                label="Fiber"
                current={dailyTotals.fiber}
                goal={nutritionGoals.fiber}
                color="#10B981"
              />
            </View>
          </View>

          {/* Micronutrient Section */}
          <MicronutrientSection />

          <Text style={[styles.sectionTitle, { color: isDefault ? theme.text : theme.accent, marginBottom: 16 }]}> 
          {isToday ? "Add Food" : "Add Food (Viewing Past Date)"}
          </Text>



          <TouchableOpacity
            style={[
              styles.addFoodButton,
              {
                backgroundColor: isToday ? (isDefault ? '#10B981' : theme.primary) : theme.textSecondary,
                opacity: isToday ? 1 : 0.5
              }
            ]}
            onPress={() => isToday && setShowBarcodeScanner(true)}
            disabled={!isToday}
          >
            <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
            <Text style={[styles.addFoodButtonText, { color: '#fff' }]}>Scan Barcode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addFoodButton,
              {
                backgroundColor: isToday ? (isDefault ? '#F59E0B' : theme.accent) : theme.textSecondary,
                opacity: isToday ? 1 : 0.5
              }
            ]}
            onPress={() => isToday && setShowBarcodeInput(true)}
            disabled={!isToday}
          >
            <MaterialCommunityIcons name="keyboard" size={20} color="#fff" />
            <Text style={[styles.addFoodButtonText, { color: '#fff' }]}>Enter Barcode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addFoodButton,
              {
                backgroundColor: isToday ? (isDefault ? '#8B5CF6' : theme.accent) : theme.textSecondary,
                opacity: isToday ? 1 : 0.5
              }
            ]}
            onPress={() => isToday && setShowManualInput(true)}
            disabled={!isToday}
          >
            <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
            <Text style={[styles.addFoodButtonText, { color: '#fff' }]}>Manual Entry</Text>
          </TouchableOpacity>

          
          {/* Saved Meals Button */}
          <TouchableOpacity
            style={[
              styles.addFoodButton,
              {
                backgroundColor: isToday ? '#FF6B6B' : theme.textSecondary,
                opacity: isToday ? 1 : 0.5
              }
            ]}
            onPress={() => {
              if (isToday) {
                loadSavedMeals(); // Refresh saved meals
                setShowSavedMeals(true);
              }
            }}
            disabled={!isToday}
          >
            <MaterialCommunityIcons name="bookmark" size={20} color="#fff" />
            <Text style={[styles.addFoodButtonText, { color: '#fff' }]}>Saved Meals</Text>
          </TouchableOpacity>

          {/* Search Food (Compact, above meals) */}
          <View style={[styles.searchSection, { marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 }]}>Search Food</Text>
            <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border, paddingVertical: 6 }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text, fontSize: 14 }]}
                placeholder="Search for food..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {searchQuery.trim().length >= 2 && (
              <View style={{ marginTop: 8 }}>
                {apiSearchLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={{ color: theme.textSecondary, marginLeft: 8, fontSize: 12 }}>Searching products…</Text>
                  </View>
                )}
                {!!apiSearchError && (
                  <Text style={{ color: theme.error, marginBottom: 6, fontSize: 12 }}>{apiSearchError}</Text>
                )}
                {!apiSearchLoading && apiSearchResults.length > 0 && (
                  <FlatList
                    data={apiSearchResults}
                    keyExtractor={(item) => (item.id && item.id.toString ? item.id.toString() : String(item.id))}
                    renderItem={({ item }) => (
                      <FoodItem
                        food={{
                          id: item.id,
                          name: `${item.name}${item.brand ? ` (${item.brand})` : ''}`,
                          calories: Math.round(item.calories || 0),
                          protein: item.protein || 0,
                          carbs: item.carbs || 0,
                          fat: item.fat || 0,
                          fiber: item.fiber || 0,
                          serving: item.serving || '100g',
                          barcode: item.barcode || '',
                          category: item.category || 'Food'
                        }}
                        onPress={(food) => {
                          setSelectedFood(food);
                          setModalVisible(true);
                        }}
                      />
                    )}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                  />
                )}
              </View>
            )}

            {!!searchQuery.trim() && (
              <FlatList
                style={{ marginTop: 6 }}
                data={filteredFoods}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <FoodItem
                    food={item}
                    onPress={(food) => {
                      setSelectedFood(food);
                      setModalVisible(true);
                    }}
                  />
                )}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>

          {/* Meals for selected date */}
          {isLoadingData ? (
            <View style={styles.mealsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {isToday ? "Today's Meals" : `${formatDisplayDate(logDate)} Meals`}
              </Text>
              <View style={styles.skeletonContainer}>
                {[1, 2, 3].map((index) => (
                  <View key={index} style={styles.skeletonRow}>
                    <SkeletonLoader width={60} height={60} style={styles.skeletonCircle} />
                    <View style={{ flex: 1 }}>
                      <SkeletonLoader width="80%" height={16} style={{ marginBottom: 8 }} />
                      <SkeletonLoader width="60%" height={12} style={{ marginBottom: 4 }} />
                      <SkeletonLoader width="40%" height={12} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : consumedFoods.length > 0 ? (
            <View style={styles.mealsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {isToday ? "Today's Meals" : `${formatDisplayDate(logDate)} Meals`}
              </Text>
              <FlatList
                data={consumedFoods}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <ConsumedFoodItem food={item} />}
                scrollEnabled={false}
              />
            </View>
          ) : (
            <View style={styles.emptyMealsContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyMealsText, { color: theme.textSecondary }]}>
                No meals logged yet
              </Text>
              <Text style={[styles.emptyMealsSubtext, { color: theme.textSecondary }]}>
                Add your first meal to start tracking
              </Text>
            </View>
          )}

          {/* Search Food Database */}
          <View style={[styles.searchSection, { display: 'none' }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Search Food Database</Text>
            
            {/* Category Filter */}
            <CategoryFilter />
            
            <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search for food..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {searchQuery.trim() || selectedCategory !== 'All' ? (
              <FlatList
                data={filteredFoods}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <FoodItem
                    food={item}
                    onPress={(food) => {
                      setSelectedFood(food);
                      setModalVisible(true);
                    }}
                  />
                )}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            ) : (
              <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 16 }}>
                Select a category or type to search for foods...
              </Text>
            )}

            {/* API Search Results */}
            {searchQuery.trim().length >= 2 && (
              <View style={{ marginTop: 12 }}>
                {apiSearchLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>Searching products…</Text>
                  </View>
                )}
                {!!apiSearchError && (
                  <Text style={{ color: theme.error, marginBottom: 8 }}>{apiSearchError}</Text>
                )}
                {!apiSearchLoading && apiSearchResults.length > 0 && (
                  <>
                    <Text style={{ color: theme.textSecondary, fontWeight: '600', marginBottom: 6 }}>
                      Results from Open Food Facts
                    </Text>
                    <FlatList
                      data={apiSearchResults}
                      keyExtractor={(item) => (item.id && item.id.toString ? item.id.toString() : String(item.id))}
                      renderItem={({ item }) => (
                        <FoodItem
                          food={{
                            id: item.id,
                            name: `${item.name}${item.brand ? ` (${item.brand})` : ''}`,
                            calories: Math.round(item.calories || 0),
                            protein: item.protein || 0,
                            carbs: item.carbs || 0,
                            fat: item.fat || 0,
                            fiber: item.fiber || 0,
                            serving: item.serving || '100g',
                            barcode: item.barcode || '',
                            category: item.category || 'Food'
                          }}
                          onPress={(food) => {
                            setSelectedFood(food);
                            setModalVisible(true);
                          }}
                        />
                      )}
                      scrollEnabled={false}
                      ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Nutrition Goals Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNutritionGoals}
        onRequestClose={() => setShowNutritionGoals(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Nutrition Goals
            </Text>
            
            <ScrollView style={styles.nutritionGoalsContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Protein Goal (g)</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={nutritionGoals.protein.toString()}
                  onChangeText={(text) => setNutritionGoals({...nutritionGoals, protein: parseInt(text) || 0})}
                  placeholder="150"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Carbs Goal (g)</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={nutritionGoals.carbs.toString()}
                  onChangeText={(text) => setNutritionGoals({...nutritionGoals, carbs: parseInt(text) || 0})}
                  placeholder="250"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Fat Goal (g)</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={nutritionGoals.fat.toString()}
                  onChangeText={(text) => setNutritionGoals({...nutritionGoals, fat: parseInt(text) || 0})}
                  placeholder="65"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Fiber Goal (g)</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={nutritionGoals.fiber.toString()}
                  onChangeText={(text) => setNutritionGoals({...nutritionGoals, fiber: parseInt(text) || 0})}
                  placeholder="25"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowNutritionGoals(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  saveNutritionGoals(nutritionGoals);
                  setShowNutritionGoals(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save Goals</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Barcode Input Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBarcodeInput}
        onRequestClose={() => setShowBarcodeInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Enter Barcode
            </Text>
            
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Barcode Number</Text>
              <TextInput
                style={[styles.quantityInput, { 
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                placeholder="Enter barcode number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowBarcodeInput(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={handleManualBarcodeInput}
                activeOpacity={0.7}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Search</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Food Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showManualInput}
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add Food Manually
            </Text>
            
            <ScrollView style={styles.manualInputContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Food Name *</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={manualFood.name}
                  onChangeText={(text) => setManualFood({...manualFood, name: text})}
                  placeholder="e.g., Grilled Chicken"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Calories *</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={manualFood.calories}
                  onChangeText={(text) => setManualFood({...manualFood, calories: text})}
                  placeholder="e.g., 165"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Protein (g)</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    }]}
                    value={manualFood.protein}
                    onChangeText={(text) => setManualFood({...manualFood, protein: text})}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Carbs (g)</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    }]}
                    value={manualFood.carbs}
                    onChangeText={(text) => setManualFood({...manualFood, carbs: text})}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Fat (g)</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    }]}
                    value={manualFood.fat}
                    onChangeText={(text) => setManualFood({...manualFood, fat: text})}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Fiber (g)</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    }]}
                    value={manualFood.fiber}
                    onChangeText={(text) => setManualFood({...manualFood, fiber: text})}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Serving Size</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={manualFood.serving}
                  onChangeText={(text) => setManualFood({...manualFood, serving: text})}
                  placeholder="e.g., 100g, 1 cup"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowManualInput(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.accent }]}
                onPress={addManualFood}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Add Food</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enhanced Food Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add {selectedFood?.name}
            </Text>

            {selectedFood && (
              <View style={styles.foodDetails}>
                <Text style={[styles.foodDetailText, { color: theme.textSecondary }]}>
                  {selectedFood.serving} • {selectedFood.calories} calories
                </Text>

                <View style={styles.nutritionInfo}>
                  <Text style={[styles.nutritionText, { color: theme.textSecondary }]}>
                    Protein: {selectedFood.protein}g • Carbs: {selectedFood.carbs}g • Fat: {selectedFood.fat}g
                  </Text>
                </View>

                {selectedFood.barcode && (
                  <Text style={[styles.barcodeText, { color: theme.success }]}>
                    Scanned: {selectedFood.barcode}
                  </Text>
                )}
              </View>
            )}

            {/* Meal Category Selection */}
            <View style={styles.mealCategorySelection}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Meal Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalMealCategories}>
                {MEAL_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.modalMealCategoryButton,
                      {
                        backgroundColor: selectedMealCategory === category.id ? category.color : theme.surface,
                        borderColor: category.color
                      }
                    ]}
                    onPress={() => setSelectedMealCategory(category.id)}
                  >
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={16}
                      color={selectedMealCategory === category.id ? '#fff' : category.color}
                    />
                    <Text style={[
                      styles.modalMealCategoryText,
                      { color: selectedMealCategory === category.id ? '#fff' : theme.text }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>



            {/* Portion Selection */}
            {selectedFood?.caloriesPer100g ? (
              <View>
                {/* Quick servings */}
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  {[
                    { key: '0.5', label: '0.5x' },
                    { key: '1', label: '1x' },
                    { key: '2', label: '2x' },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => { setPortionMode('servings'); setServingsInput(m.key); setGramsInput(''); setPercentInput('0'); }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginRight: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: theme.border,
                        backgroundColor: theme.surface,
                      }}
                    >
                      <Text style={{ color: theme.text }}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Servings input */}
                <View style={styles.quantityContainer}>
                  <Text style={[styles.quantityLabel, { color: theme.text }]}>Servings</Text>
                  <TextInput
                    style={[styles.quantityInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    value={servingsInput}
                    onChangeText={(txt) => { setServingsInput(txt); setGramsInput(''); setPercentInput('0'); setPortionMode('servings'); }}
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  {!!selectedFood.caloriesPerServing && (
                    <Text style={[styles.foodDetailText, { color: theme.textSecondary, marginTop: 6 }]}>
                      {`1 serving = ${selectedFood.caloriesPerServing} cal${selectedFood.gramsPerServing ? ` • ${selectedFood.gramsPerServing}g` : ''}`}
                    </Text>
                  )}
                </View>

                {/* Grams input */}
                <View style={styles.quantityContainer}>
                  <Text style={[styles.quantityLabel, { color: theme.text }]}>Grams</Text>
                  <TextInput
                    style={[styles.quantityInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    value={gramsInput}
                    onChangeText={(txt) => { setGramsInput(txt); setServingsInput(''); setPercentInput('0'); setPortionMode('grams'); }}
                    placeholder={String(selectedFood.gramsPerServing || 100)}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.foodDetailText, { color: theme.textSecondary, marginTop: 6 }]}>
                    {`Per 100g = ${selectedFood.caloriesPer100g} cal`}
                  </Text>
                </View>

                {/* % of package */}
                <View style={styles.quantityContainer}>
                  <Text style={[styles.quantityLabel, { color: theme.text }]}>% of package</Text>
                  <TextInput
                    style={[styles.quantityInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    value={percentInput}
                    onChangeText={(txt) => { setPercentInput(txt); setServingsInput(''); setGramsInput(''); setPortionMode('percent'); }}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.foodDetailText, { color: theme.textSecondary, marginTop: 6 }]}>
                    {`Package size${selectedFood.packageSizeGrams ? `: ${selectedFood.packageSizeGrams}g` : ' (unknown)'}`}
                  </Text>
                </View>
              </View>
            ) : (
              // Legacy quantity for preset foods
              <View style={styles.quantityContainer}>
                <Text style={[styles.quantityLabel, { color: theme.text }]}>Quantity</Text>
                <TextInput
                  style={[styles.quantityInput, {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="1"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.totalCalories}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Total Calories:
              </Text>
              <Text style={[styles.totalValue, { color: theme.primary }]}>
                {Math.round(getPortionCalories())}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={addFood}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Add Food</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Logged Food Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Entry</Text>
            {!!editItem && (
              <View style={styles.foodDetails}>
                <Text style={[styles.foodDetailText, { color: theme.textSecondary }]}>
                  {editItem.name}
                </Text>
              </View>
            )}

            {/* Meal Category Selection */}
            <View style={styles.mealCategorySelection}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Meal Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalMealCategories}>
                {MEAL_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.modalMealCategoryButton,
                      {
                        backgroundColor: editMealCategory === category.id ? category.color : theme.surface,
                        borderColor: category.color
                      }
                    ]}
                    onPress={() => setEditMealCategory(category.id)}
                  >
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={16}
                      color={editMealCategory === category.id ? '#fff' : category.color}
                    />
                    <Text style={[
                      styles.modalMealCategoryText,
                      { color: editMealCategory === category.id ? '#fff' : theme.text }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Quantity */}
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Quantity</Text>
              <TextInput
                style={[styles.quantityInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                value={editQuantity}
                onChangeText={setEditQuantity}
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border } ]}
                onPress={() => setShowEditModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={saveEditItem}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showGoalModal}
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Daily Goal
            </Text>
            
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Daily Calorie Goal</Text>
              <TextInput
                style={[styles.quantityInput, { 
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                value={newGoal}
                onChangeText={setNewGoal}
                placeholder="2000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowGoalModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={updateGoal}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Update Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>



      {/* Macro Presets Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMacroPresets}
        onRequestClose={() => setShowMacroPresets(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Macro Ratio Presets
            </Text>

            <ScrollView style={styles.presetsList}>
              {Object.entries(MACRO_PRESETS).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.presetItem,
                    {
                      backgroundColor: selectedMacroPreset === key ? theme.primary + '20' : 'transparent',
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setSelectedMacroPreset(key)}
                >
                  <View style={styles.presetInfo}>
                    <Text style={[styles.presetName, { color: theme.text }]}>{preset.name}</Text>
                    <Text style={[styles.presetRatios, { color: theme.textSecondary }]}>
                      Protein: {preset.protein}% • Carbs: {preset.carbs}% • Fat: {preset.fat}%
                    </Text>
                  </View>
                  {selectedMacroPreset === key && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowMacroPresets(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  const preset = MACRO_PRESETS[selectedMacroPreset];
                  if (!preset) {
                    setShowMacroPresets(false);
                    return;
                  }
                  // Convert preset percentages to gram goals based on daily calorie goal
                  const newGoals = {
                    ...nutritionGoals,
                    protein: Math.max(0, Math.round((preset.protein / 100) * dailyGoal / 4)),
                    carbs: Math.max(0, Math.round((preset.carbs / 100) * dailyGoal / 4)),
                    fat: Math.max(0, Math.round((preset.fat / 100) * dailyGoal / 9)),
                  };
                  saveNutritionGoals(newGoals);
                  setShowMacroPresets(false);
                  Alert.alert('Preset Applied', `${preset.name} macros applied to goals.`);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Apply Preset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Saved Meals Modal */}
      <Modal
        visible={showSavedMeals}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSavedMeals(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={() => setShowSavedMeals(false)}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Saved Meals</Text>
            <TouchableOpacity
              onPress={() => {
                setShowSavedMeals(false);
                navigation.navigate('Meal Maker');
              }}
              style={styles.createMealButton}
            >
              <MaterialCommunityIcons name="chef-hat" size={20} color={theme.primary} />
              <Text style={[styles.createMealText, { color: theme.primary }]}>Create Meal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {savedMeals.length === 0 ? (
              <View style={styles.emptyMealsContainer}>
                <MaterialCommunityIcons name="bookmark-outline" size={64} color={theme.textSecondary} />
                <Text style={[styles.emptyMealsTitle, { color: theme.text }]}>No Saved Meals</Text>
                <Text style={[styles.emptyMealsText, { color: theme.textSecondary }]}>
                  Create meals in the Meal Maker to quickly add them to your daily calories.
                </Text>
                <View style={styles.emptyStateButtons}>
                  <TouchableOpacity
                    style={[styles.createHereButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      setShowSavedMeals(false);
                      navigation.navigate('Meal Maker');
                    }}
                  >
                    <MaterialCommunityIcons name="chef-hat" size={20} color="#fff" />
                    <Text style={styles.createHereText}>Create New Meal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.goToMealMakerButton, { backgroundColor: theme.textSecondary, opacity: 0.6 }]}
                    onPress={() => {
                      setShowSavedMeals(false);
                      navigation.navigate('Meal Maker');
                    }}
                  >
                    <MaterialCommunityIcons name="information" size={20} color="#fff" />
                    <Text style={styles.goToMealMakerText}>Learn More About Meal Maker</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.savedMealsSubtitle, { color: theme.textSecondary }]}>
                  Select a meal to add to your {selectedMealCategory}
                </Text>
                {savedMeals.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={[styles.savedMealItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => addSavedMeal(meal)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.savedMealHeader}>
                      <View style={[styles.mealCategoryIcon, { backgroundColor: getMealCategoryColor(meal.category) }]}>
                        <MaterialCommunityIcons
                          name={getMealCategoryIcon(meal.category)}
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.savedMealInfo}>
                        <Text style={[styles.savedMealName, { color: theme.text }]}>{meal.name}</Text>
                        <Text style={[styles.savedMealCategory, { color: theme.textSecondary }]}>
                          {meal.category} • {meal.ingredients?.length || 0} ingredients
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="plus-circle" size={24} color={theme.primary} />
                    </View>
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <Text style={[styles.savedMealIngredients, { color: theme.textSecondary }]}>
                        {meal.ingredients.slice(0, 4).join(', ')}{meal.ingredients.length > 4 ? '...' : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>



      {/* Loading Modal */}
      {loading && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={loading}
        >
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                Fetching product data...
              </Text>
            </View>
          </View>
        </Modal>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 10,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'flex-start',
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',