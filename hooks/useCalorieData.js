import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { getUserData, setUserData } from '../utils';

// Helper functions
const toLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTodayKey = () => {
  const now = new Date();
  return toLocalDateKey(now);
};

// Default nutrition goals
const DEFAULT_NUTRITION_GOALS = {
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 25,
  vitaminC: 90,
  iron: 18,
  calcium: 1000,
  potassium: 3500
};

// Meal categories
const MEAL_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'food-croissant', color: '#FF9F1C' },
  { id: 'lunch', name: 'Lunch', icon: 'food', color: '#2EC4B6' },
  { id: 'dinner', name: 'Dinner', icon: 'silverware-fork-knife', color: '#E71D36' },
  { id: 'snacks', name: 'Snacks', icon: 'cookie', color: '#9B5DE5' }
];

export const useCalorieData = (userId) => {
  // State
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [consumedFoods, setConsumedFoods] = useState([]);
  const [logDate, setLogDate] = useState(getTodayKey());
  const [nutritionGoals, setNutritionGoals] = useState(DEFAULT_NUTRITION_GOALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Computed values
  const isToday = useMemo(() => logDate === getTodayKey(), [logDate]);

  // Calculate daily totals with memoization
  const dailyTotals = useMemo(() => {
    return consumedFoods.reduce((totals, food) => {
      const multiplier = food.quantity || 1;
      return {
        calories: totals.calories + (food.calories * multiplier),
        protein: totals.protein + ((food.protein || 0) * multiplier),
        carbs: totals.carbs + ((food.carbs || 0) * multiplier),
        fat: totals.fat + ((food.fat || 0) * multiplier),
        fiber: totals.fiber + ((food.fiber || 0) * multiplier),
        vitaminC: totals.vitaminC + ((food.vitaminC || 0) * multiplier),
        iron: totals.iron + ((food.iron || 0) * multiplier),
        calcium: totals.calcium + ((food.calcium || 0) * multiplier),
        potassium: totals.potassium + ((food.potassium || 0) * multiplier),
      };
    }, {
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      vitaminC: 0, iron: 0, calcium: 0, potassium: 0
    });
  }, [consumedFoods]);

  // Calculate remaining calories
  const remainingCalories = useMemo(() => 
    Math.max(dailyGoal - dailyTotals.calories, 0), 
    [dailyGoal, dailyTotals.calories]
  );

  // Calculate progress percentage
  const progressPercentage = useMemo(() => 
    Math.min((dailyTotals.calories / dailyGoal) * 100, 100), 
    [dailyTotals.calories, dailyGoal]
  );

  // Calculate meal totals
  const mealTotals = useMemo(() => {
    return MEAL_CATEGORIES.map(category => {
      const categoryFoods = consumedFoods.filter(food => food.mealCategory === category.id);
      const categoryTotal = categoryFoods.reduce((total, food) => {
        const multiplier = food.quantity || 1;
        return total + (food.calories * multiplier);
      }, 0);
      
      return {
        id: category.id,
        name: category.name,
        calories: Math.round(categoryTotal),
        color: category.color,
        icon: category.icon,
        foods: categoryFoods
      };
    });
  }, [consumedFoods]);

  // Macro data
  const macroData = useMemo(() => [
    { 
      name: 'Protein', 
      value: Math.round(dailyTotals.protein), 
      goal: nutritionGoals.protein, 
      color: '#FF6B6B',
      unit: 'g'
    },
    { 
      name: 'Carbs', 
      value: Math.round(dailyTotals.carbs), 
      goal: nutritionGoals.carbs, 
      color: '#4ECDC4',
      unit: 'g'
    },
    { 
      name: 'Fat', 
      value: Math.round(dailyTotals.fat), 
      goal: nutritionGoals.fat, 
      color: '#45B7D1',
      unit: 'g'
    }
  ], [dailyTotals, nutritionGoals]);

  // Micronutrient data
  const microData = useMemo(() => [
    { 
      name: 'Vitamin C', 
      value: Math.round(dailyTotals.vitaminC), 
      goal: nutritionGoals.vitaminC, 
      unit: 'mg', 
      icon: 'fruit-citrus' 
    },
    { 
      name: 'Iron', 
      value: Math.round(dailyTotals.iron), 
      goal: nutritionGoals.iron, 
      unit: 'mg', 
      icon: 'magnet' 
    },
    { 
      name: 'Calcium', 
      value: Math.round(dailyTotals.calcium), 
      goal: nutritionGoals.calcium, 
      unit: 'mg', 
      icon: 'bone' 
    },
    { 
      name: 'Potassium', 
      value: Math.round(dailyTotals.potassium), 
      goal: nutritionGoals.potassium, 
      unit: 'mg', 
      icon: 'lightning-bolt' 
    }
  ], [dailyTotals, nutritionGoals]);

  // Load data for specific date
  const loadDataForDate = useCallback(async (dateKey) => {
    try {
      setLoading(true);
      setError(null);

      const storageKey = `calorieData_${dateKey}`;
      
      if (userId) {
        const data = await getUserData(userId, storageKey, {
          foods: [],
          goal: 2000
        });
        setConsumedFoods(data.foods || []);
        setDailyGoal(data.goal || 2000);
      } else {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          setConsumedFoods(data.foods || []);
          setDailyGoal(data.goal || 2000);
        } else {
          setConsumedFoods([]);
          setDailyGoal(2000);
        }
      }
    } catch (err) {
      console.error('Failed to load calorie data:', err);
      setError('Failed to load data');
      setConsumedFoods([]);
      setDailyGoal(2000);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Save data for current date
  const saveDataForDate = useCallback(async (dateKey, foods, goal) => {
    try {
      const storageKey = `calorieData_${dateKey}`;
      const data = { foods, goal };

      if (userId) {
        await setUserData(userId, storageKey, data);
      } else {
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to save calorie data:', err);
      setError('Failed to save data');
    }
  }, [userId]);

  // Load nutrition goals
  const loadNutritionGoals = useCallback(async () => {
    try {
      if (userId) {
        const goals = await getUserData(userId, 'nutritionGoals', DEFAULT_NUTRITION_GOALS);
        setNutritionGoals(goals);
      } else {
        const stored = await AsyncStorage.getItem('nutritionGoals');
        if (stored) {
          setNutritionGoals(JSON.parse(stored));
        }
      }
    } catch (err) {
      console.warn('Failed to load nutrition goals:', err);
      setNutritionGoals(DEFAULT_NUTRITION_GOALS);
    }
  }, [userId]);

  // Save nutrition goals
  const saveNutritionGoals = useCallback(async (goals) => {
    try {
      setNutritionGoals(goals);
      
      if (userId) {
        await setUserData(userId, 'nutritionGoals', goals);
      } else {
        await AsyncStorage.setItem('nutritionGoals', JSON.stringify(goals));
      }
    } catch (err) {
      console.error('Failed to save nutrition goals:', err);
      setError('Failed to save nutrition goals');
    }
  }, [userId]);

  // Add food to meal
  const addFood = useCallback(async (food, mealCategory = 'snacks') => {
    try {
      const newFood = {
        ...food,
        id: Date.now().toString(),
        mealCategory,
        timestamp: new Date().toISOString(),
        quantity: food.quantity || 1
      };

      const updatedFoods = [...consumedFoods, newFood];
      setConsumedFoods(updatedFoods);
      
      // Save to storage
      await saveDataForDate(logDate, updatedFoods, dailyGoal);
      
      return newFood;
    } catch (err) {
      console.error('Failed to add food:', err);
      setError('Failed to add food');
      throw err;
    }
  }, [consumedFoods, logDate, dailyGoal, saveDataForDate]);

  // Remove food
  const removeFood = useCallback(async (foodId) => {
    try {
      const updatedFoods = consumedFoods.filter(food => food.id !== foodId);
      setConsumedFoods(updatedFoods);
      
      // Save to storage
      await saveDataForDate(logDate, updatedFoods, dailyGoal);
    } catch (err) {
      console.error('Failed to remove food:', err);
      setError('Failed to remove food');
    }
  }, [consumedFoods, logDate, dailyGoal, saveDataForDate]);

  // Update food quantity
  const updateFoodQuantity = useCallback(async (foodId, quantity) => {
    try {
      const updatedFoods = consumedFoods.map(food => 
        food.id === foodId ? { ...food, quantity } : food
      );
      setConsumedFoods(updatedFoods);
      
      // Save to storage
      await saveDataForDate(logDate, updatedFoods, dailyGoal);
    } catch (err) {
      console.error('Failed to update food quantity:', err);
      setError('Failed to update food quantity');
    }
  }, [consumedFoods, logDate, dailyGoal, saveDataForDate]);

  // Update daily goal
  const updateDailyGoal = useCallback(async (newGoal) => {
    try {
      const goal = parseInt(newGoal);
      if (goal && goal > 0) {
        setDailyGoal(goal);
        
        // Save to storage
        await saveDataForDate(logDate, consumedFoods, goal);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update daily goal:', err);
      setError('Failed to update daily goal');
      return false;
    }
  }, [logDate, consumedFoods, saveDataForDate]);

  // Change date
  const changeDate = useCallback((direction) => {
    const currentDate = new Date(logDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + direction);

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const newDateString = `${year}-${month}-${day}`;

    const todayString = getTodayKey();
    if (direction > 0 && newDateString > todayString) {
      Alert.alert('Cannot Go Forward', 'You can only view past and current day data.');
      return false;
    }

    setLogDate(newDateString);
    return true;
  }, [logDate]);

  // Go to today
  const goToToday = useCallback(() => {
    const todayKey = getTodayKey();
    setLogDate(todayKey);
  }, []);

  // Initialize data
  useEffect(() => {
    const initialize = async () => {
      await loadNutritionGoals();
      await loadDataForDate(logDate);
    };
    
    initialize();
  }, [loadNutritionGoals, loadDataForDate, logDate]);

  // Clear error after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    // State
    dailyGoal,
    consumedFoods,
    logDate,
    nutritionGoals,
    loading,
    error,
    isToday,
    
    // Computed values
    dailyTotals,
    remainingCalories,
    progressPercentage,
    mealTotals,
    macroData,
    microData,
    
    // Actions
    addFood,
    removeFood,
    updateFoodQuantity,
    updateDailyGoal,
    saveNutritionGoals,
    changeDate,
    goToToday,
    
    // Constants
    MEAL_CATEGORIES
  };
};