import React, { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Dimensions, Modal, FlatList, Alert, Animated } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';
import { SafeAreaView} from 'react-native-safe-area-context';

const { width, height: windowHeight } = Dimensions.get('window');

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const mealTypeToColor = {
  Breakfast: '#F59E0B', // amber
  Lunch: '#22C55E',     // green
  Dinner: '#6366F1',    // indigo
  Snack: '#F43F5E',     // rose
};
const NUM_WEEKS = 2; // Show a couple of weeks: this + next

const recipes = [
  {
    id: 1,
    name: 'Chicken Stir Fry',
    category: 'Dinner',
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    inventoryMatch: 85,
    ingredients: ['chicken breast', 'bell peppers', 'soy sauce', 'garlic', 'rice'],
    instructions: ['Heat oil in wok', 'Cook chicken until done', 'Add vegetables', 'Stir in sauce'],
    nutrition: { calories: 320, protein: 28, carbs: 25, fat: 12 },
    tags: ['quick', 'healthy', 'protein'],
    difficulty: 'Easy'
  },
  {
    id: 2,
    name: 'Avocado Toast',
    category: 'Breakfast',
    prepTime: 5,
    cookTime: 5,
    servings: 1,
    inventoryMatch: 70,
    ingredients: ['bread', 'avocado', 'salt', 'pepper', 'lemon'],
    instructions: ['Toast bread', 'Mash avocado', 'Season and spread', 'Add lemon juice'],
    nutrition: { calories: 290, protein: 8, carbs: 30, fat: 18 },
    tags: ['quick', 'vegetarian', 'healthy'],
    difficulty: 'Easy'
  },
  {
    id: 3,
    name: 'Greek Salad',
    category: 'Lunch',
    prepTime: 10,
    cookTime: 0,
    servings: 2,
    inventoryMatch: 60,
    ingredients: ['cucumber', 'tomatoes', 'feta cheese', 'olives', 'olive oil'],
    instructions: ['Chop vegetables', 'Mix with cheese', 'Add olives', 'Drizzle with oil'],
    nutrition: { calories: 240, protein: 12, carbs: 15, fat: 18 },
    tags: ['vegetarian', 'healthy', 'mediterranean'],
    difficulty: 'Easy'
  },
  {
    id: 4,
    name: 'Protein Smoothie',
    category: 'Snack',
    prepTime: 3,
    cookTime: 0,
    servings: 1,
    inventoryMatch: 90,
    ingredients: ['banana', 'protein powder', 'almond milk', 'spinach'],
    instructions: ['Add all ingredients to blender', 'Blend until smooth', 'Serve immediately'],
    nutrition: { calories: 180, protein: 25, carbs: 20, fat: 3 },
    tags: ['quick', 'protein', 'healthy'],
    difficulty: 'Easy'
  },
  {
    id: 5,
    name: 'Pasta Carbonara',
    category: 'Dinner',
    prepTime: 10,
    cookTime: 15,
    servings: 3,
    inventoryMatch: 75,
    ingredients: ['pasta', 'eggs', 'bacon', 'parmesan', 'black pepper'],
    instructions: ['Cook pasta', 'Fry bacon', 'Mix eggs with cheese', 'Combine all ingredients'],
    nutrition: { calories: 420, protein: 18, carbs: 45, fat: 16 },
    tags: ['comfort', 'italian'],
    difficulty: 'Medium'
  },
  {
    id: 6,
    name: 'Overnight Oats',
    category: 'Breakfast',
    prepTime: 5,
    cookTime: 0,
    servings: 1,
    inventoryMatch: 80,
    ingredients: ['oats', 'milk', 'honey', 'berries', 'chia seeds'],
    instructions: ['Mix dry ingredients', 'Add milk and honey', 'Refrigerate overnight', 'Top with berries'],
    nutrition: { calories: 250, protein: 10, carbs: 40, fat: 6 },
    tags: ['make-ahead', 'healthy', 'fiber'],
    difficulty: 'Easy'
  },
  {
    id: 7,
    name: 'Quinoa Buddha Bowl',
    category: 'Lunch',
    prepTime: 15,
    cookTime: 20,
    servings: 2,
    inventoryMatch: 65,
    ingredients: ['quinoa', 'chickpeas', 'sweet potato', 'spinach', 'tahini'],
    instructions: ['Cook quinoa', 'Roast sweet potato', 'Prepare chickpeas', 'Assemble with dressing'],
    nutrition: { calories: 380, protein: 14, carbs: 52, fat: 12 },
    tags: ['vegan', 'healthy', 'fiber'],
    difficulty: 'Medium'
  },
  {
    id: 8,
    name: 'Energy Balls',
    category: 'Snack',
    prepTime: 10,
    cookTime: 0,
    servings: 12,
    inventoryMatch: 85,
    ingredients: ['dates', 'almonds', 'coconut', 'cocoa powder', 'vanilla'],
    instructions: ['Process dates', 'Add nuts and coconut', 'Mix in cocoa', 'Roll into balls'],
    nutrition: { calories: 95, protein: 3, carbs: 12, fat: 5 },
    tags: ['no-bake', 'healthy', 'sweet'],
    difficulty: 'Easy'
  }
];

const MealPlanner = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(0);
  // Month-based planner state
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [planPickerVisible, setPlanPickerVisible] = useState(false);
  const [planPickerRecipe, setPlanPickerRecipe] = useState(null);
  const [pickerDayIndex, setPickerDayIndex] = useState(0);
  const [pickerMealType, setPickerMealType] = useState('Dinner');
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecipeDetail, setShowRecipeDetail] = useState(null);
  const [mealPlan, setMealPlan] = useState({});
  const [shoppingList, setShoppingList] = useState([]);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [currentDay, setCurrentDay] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, etc.
    // Convert to Monday=0, Tuesday=1, ..., Sunday=6 for Monday-first calendar
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  });
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [checkedItems, setCheckedItems] = useState({});
  const scrollRef = useRef(null);
  const [userMeals, setUserMeals] = useState([]);
  
  // Load meal plan data from storage
  useEffect(() => {
    const loadMealPlan = async () => {
      try {
        
        if (userId) {
          // Migrate existing data to user-specific storage
          await migrateToUserStorage(userId, 'mealPlan', 'mealPlan');
          const stored = await getUserData(userId, 'mealPlan', {});
          setMealPlan(stored);
        } else {
          const data = await AsyncStorage.getItem('mealPlan');
          if (data) {
            const parsed = JSON.parse(data);
            setMealPlan(parsed);
          } else {
            setMealPlan({});
          }
        }
      } catch (error) {
        setMealPlan({});
      }
    };
    loadMealPlan();
  }, [userId]);
  
  // Save meal plan data to storage
  useEffect(() => {
    const saveMealPlan = async () => {
      try {
        
        if (userId) {
          await setUserData(userId, 'mealPlan', mealPlan);
        } else {
          await AsyncStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        }
      } catch (error) {
      }
    };
    
    // Only save if we have data (avoid saving empty object on initial load)
    if (Object.keys(mealPlan).length > 0) {
      saveMealPlan();
    }
  }, [mealPlan, userId]);

  const { foodInventory, darkMode, accentKey } = useContext(ShoppingListContext);
  const [weekTab, setWeekTab] = useState(0); // 0: this week, +/- for navigation
  const theme = getTheme ? getTheme(accentKey, darkMode) : {};
  const isDefault = !accentKey || accentKey === 'default';

  // Drag-to-dismiss modal state
  const modalTranslateY = useRef(new Animated.Value(0)).current;
  const dragThreshold = 80;

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: modalTranslateY } }],
    { useNativeDriver: true }
  );

  const handleGestureStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationY > dragThreshold) {
        // Animate down, then close
        Animated.timing(modalTranslateY, {
          toValue: windowHeight,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (typeof setSelectedMeal === 'function') setSelectedMeal(null);
          if (typeof setShowRecipeDetail === 'function') setShowRecipeDetail(null);
          if (typeof setShowShoppingList === 'function') setShowShoppingList(false);
          modalTranslateY.setValue(0); // reset for next open
        });
      } else {
        // Snap back smoothly
        Animated.timing(modalTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Get today's day index for highlighting
  const todayIndex = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, etc.

    // Convert to Monday=0, Tuesday=1, ..., Sunday=6 for Monday-first calendar
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, []);

  // Date helpers
  const toYMD = useCallback((d) => {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, []);

  const getMonthGrid = useCallback((monthDate) => {
    // First day of the month at local midnight
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    first.setHours(0, 0, 0, 0);

    // Get day of week for first day (0=Sunday, 1=Monday, ..., 6=Saturday)
    const firstDayOfWeek = first.getDay();
    
    // Calculate how many days back to go to get to Monday for Monday-first calendar
    // Sunday (0) -> go back 6 days to get to previous Monday
    // Monday (1) -> go back 0 days 
    // Tuesday (2) -> go back 1 day
    // etc.
    const daysBackToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Calculate start date (the Monday of the week containing the 1st)
    const startTime = first.getTime() - (daysBackToMonday * 24 * 60 * 60 * 1000);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      // Create each date by adding days to start date using time arithmetic
      const cellTime = startTime + (i * 24 * 60 * 60 * 1000);
      const baseDate = new Date(cellTime);
      baseDate.setHours(0, 0, 0, 0);
      
      cells.push({
        date: baseDate,
        inMonth: baseDate.getMonth() === monthDate.getMonth(),
        isToday: toYMD(baseDate) === toYMD(new Date()),
        isSelected: toYMD(baseDate) === toYMD(selectedDate),
      });
    }
    return cells;
  }, [selectedDate, toYMD]);

  // Week helpers + navigation
  const getWeekStart = useCallback((baseDate) => {
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    
    const dayOfWeek = base.getDay(); // 0=Sunday, 1=Monday, etc.
    // Calculate days back to Monday for Monday-first calendar
    // Sunday (0) -> go back 6 days to get to previous Monday
    // Monday (1) -> go back 0 days 
    // Tuesday (2) -> go back 1 day, etc.
    const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Use time arithmetic to avoid date rollover issues
    const mondayTime = base.getTime() - (daysBackToMonday * 24 * 60 * 60 * 1000);
    const monday = new Date(mondayTime);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
  }, []);

  const getWeekDates = useCallback((weekOffset) => {
    const today = new Date();
    const thisMonday = getWeekStart(today);
    const startOfWeek = new Date(thisMonday);
    // Use more reliable date arithmetic by adding milliseconds instead of setDate
    startOfWeek.setTime(thisMonday.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));
    return days.map((day, index) => {
      const date = new Date(startOfWeek);
      // Add days using reliable millisecond arithmetic
      date.setTime(startOfWeek.getTime() + (index * 24 * 60 * 60 * 1000));
      return {
        day,
        date: date.getDate(),
        month: date.getMonth() + 1,
        isToday: toYMD(date) === toYMD(new Date()),
        fullDate: date,
        isSelected: toYMD(date) === toYMD(selectedDate),
      };
    });
  }, [getWeekStart, selectedDate, toYMD]);

  const weekDates = useMemo(() => getWeekDates(weekTab), [getWeekDates, weekTab]);

  // weekTab is now the single source of truth for week navigation

  // Keep weekTab aligned with selectedDate (from month selections)
  useEffect(() => {
    const today = new Date();
    const thisMonday = getWeekStart(today);
    const selectedMonday = getWeekStart(selectedDate);
    const diffDays = Math.round((selectedMonday - thisMonday) / (1000 * 60 * 60 * 24));
    const offset = Math.round(diffDays / 7);
    if (!Number.isNaN(offset) && offset !== weekTab) {
      setWeekTab(offset);
    }
  }, [selectedDate, getWeekStart]);

  const changeWeek = useCallback((delta) => {
    setWeekTab((prev) => {
      const next = prev + delta;
      const nextWeek = getWeekDates(next);
      const safeIndex = Math.max(0, Math.min(6, currentDay));
      setSelectedDate(nextWeek[safeIndex].fullDate);
      return next;
    });
  }, [currentDay, getWeekDates]);

  const formatWeekRange = useCallback((dates) => {
    if (!dates || dates.length < 7) return '';
    const start = dates[0].fullDate;
    const end = dates[6].fullDate;
    const fmt = (d) => `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    return `${fmt(start)} — ${fmt(end)}`;
  }, []);

  // Note: Week navigation helpers removed to avoid duplicate currentWeekDates.

  // Month helpers: count planned meals for a given date (based on week offset keys)
  const getWeekOffsetForDate = useCallback((dateObj) => {
    const today = new Date();
    const thisMonday = getWeekStart(today);
    const dateMonday = getWeekStart(dateObj);
    const diffDays = Math.round((dateMonday - thisMonday) / (1000 * 60 * 60 * 24));
    return Math.round(diffDays / 7);
  }, [getWeekStart]);

  const getPlannedTypesForDate = useCallback((dateObj) => {
    const offset = getWeekOffsetForDate(dateObj);
    const dayOfWeek = new Date(dateObj).getDay(); // 0=Sunday, 1=Monday, etc.
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0, Tuesday=1, ..., Sunday=6
    const types = [];
    for (const type of mealTypes) {
      const key = `${offset}-${dayIdx}-${type}`;
      if (mealPlan[key]) types.push(type);
    }
    return types;
  }, [getWeekOffsetForDate, mealPlan]);

  const allRecipes = useMemo(() => {
    const userRecipeObjects = userMeals.map((meal, idx) => ({
      ...meal,
      id: `user-${meal.id || idx}`,
      servings: meal.servings || 1,
      prepTime: meal.prepTime || 0,
      cookTime: meal.cookTime || 0,
      inventoryMatch: 100,
      tags: meal.tags || [],
      nutrition: meal.nutrition || {},
      difficulty: meal.difficulty || 'Easy',
      instructions: Array.isArray(meal.instructions) ? meal.instructions : (meal.instructions ? meal.instructions.split('\n') : []),
    }));
    return [...userRecipeObjects, ...recipes];
  }, [userMeals]);

  function normalizeRecipeForPlanner(r) {
    if (!r) return null;
    const parseMinutes = (txt) => {
      if (typeof txt === 'number') return txt;
      const m = String(txt || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const toArray = (inst) => Array.isArray(inst) ? inst : (inst ? String(inst).split(/\n+/).map(s => s.trim()).filter(Boolean) : []);
    return {
      id: r.id || Date.now().toString(),
      name: r.name || 'Recipe',
      category: r.category ? (r.category.charAt(0).toUpperCase() + r.category.slice(1)) : 'Dinner',
      prepTime: parseMinutes(r.prepTime),
      cookTime: parseMinutes(r.cookTime),
      servings: r.servings || 1,
      inventoryMatch: r.matchPercentage ? Math.round(r.matchPercentage) : 0,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      instructions: toArray(r.instructions),
      nutrition: r.nutrition || { calories: 0 },
      tags: r.subcategories || [],
      difficulty: r.difficulty || 'Easy',
    };
  }

  // Filter recipes based on search term and category
  const filteredRecipes = useMemo(() => {
    return allRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           recipe.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (recipe.tags && recipe.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesFilter = selectedFilter === 'all' || recipe.category === selectedFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [allRecipes, searchTerm, selectedFilter]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(allRecipes.map(r => r.category))];
    return cats;
  }, [allRecipes]);

  // Scroll reference currently unused; keep for future horizontal week pager

  useEffect(() => {
    const loadUserMeals = async () => {
      try {
        if (userId) {
          // Migrate existing data to user-specific storage
          await migrateToUserStorage(userId, 'userMeals', 'userMeals');
          const stored = await getUserData(userId, 'userMeals', []);
          setUserMeals(stored);
        } else {
          const data = await AsyncStorage.getItem('userMeals');
          if (data) setUserMeals(JSON.parse(data));
        }
      } catch (error) {
      }
    };
    loadUserMeals();
  }, [userId]);

  const addMealToPlan = useCallback((dayIndex, mealType, recipe) => {
    const key = `${weekTab}-${dayIndex}-${mealType}`;
    setMealPlan(prev => ({
      ...prev,
      [key]: recipe
    }));
    setSelectedMeal(null);
  }, [weekTab]);

  const confirmPlanPicker = useCallback(() => {
    if (!planPickerRecipe) return;
    addMealToPlan(pickerDayIndex, pickerMealType, planPickerRecipe);
    setPlanPickerVisible(false);
    setPlanPickerRecipe(null);
  }, [planPickerRecipe, pickerDayIndex, pickerMealType, addMealToPlan]);

  const removeMealFromPlan = useCallback((dayIndex, mealType) => {
    Alert.alert(
      "Remove Meal",
      "Are you sure you want to remove this meal from your plan?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const key = `${weekTab}-${dayIndex}-${mealType}`;
            setMealPlan(prev => {
              const newPlan = { ...prev };
              delete newPlan[key];
              return newPlan;
            });
          }
        }
      ]
    );
  }, [weekTab]);

  const generateShoppingList = useCallback(() => {
    const ingredientCount = {};
    Object.values(mealPlan).forEach(recipe => {
              recipe.ingredients.forEach(ingredient => {
        ingredientCount[ingredient] = (ingredientCount[ingredient] || 0) + 1;
              });
          });

    const listWithCounts = Object.entries(ingredientCount).map(([ingredient, count]) => ({
          name: ingredient,
      count: count > 1 ? count : null
    }));
    
    setShoppingList(listWithCounts);
    setShowShoppingList(true);
  }, [mealPlan]);

  const toggleShoppingItem = useCallback((index) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }, []);

  const clearMealPlan = useCallback(() => {
    Alert.alert(
      "Clear Meal Plan",
      "Are you sure you want to clear your entire meal plan?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: () => setMealPlan({})
        }
      ]
    );
  }, []);

  const duplicateWeek = useCallback(() => {
    const currentWeekMeals = {};
    Object.keys(mealPlan).forEach(key => {
      if (key.startsWith(`${weekTab}-`)) {
        const newKey = key.replace(`${weekTab}-`, `${weekTab + 1}-`);
        currentWeekMeals[newKey] = mealPlan[key];
      }
    });

    if (Object.keys(currentWeekMeals).length > 0) {
      setMealPlan(prev => ({ ...prev, ...currentWeekMeals }));
      setWeekTab(prev => prev + 1);
    }
  }, [mealPlan, weekTab]);

  const renderRecipeCard = useCallback(({ item: recipe }) => (
    <View style={styles.recipeSelectCard}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recipeSelectName, { color: theme.text }]}>{recipe.name}</Text>
        <View style={styles.recipeTagsContainer}>
          {recipe.tags.slice(0, 2).map((tag, idx) => (
            <View key={idx} style={styles.recipeTag}>
              <Text style={styles.recipeTagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.recipeSelectInfoRow}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
          <Text style={[styles.recipeSelectInfo, { color: theme.textSecondary }]}>{recipe.prepTime + recipe.cookTime} min</Text>
          <MaterialCommunityIcons name="account-group" size={16} color="#64748B" style={{ marginLeft: 12 }} />
          <Text style={[styles.recipeSelectInfo, { color: theme.textSecondary }]}>{recipe.servings} servings</Text>
          <MaterialCommunityIcons name="star" size={16} color="#F59E0B" style={{ marginLeft: 12 }} />
          <Text style={[styles.recipeSelectInfo, { color: theme.textSecondary }]}>{recipe.inventoryMatch}%</Text>
        </View>
      </View>
      <View style={{ justifyContent: 'center' }}>
        <TouchableOpacity
          style={styles.addToPlanButton}
          onPress={() => addMealToPlan(selectedMeal.dayIndex, selectedMeal.mealType, recipe)}
        >
          <Text style={styles.addToPlanButtonText}>Add</Text>
      </TouchableOpacity>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => setShowRecipeDetail(recipe)}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [addMealToPlan, selectedMeal, theme.textSecondary]);

  useEffect(() => {
    if (selectedMeal) {
      modalTranslateY.setValue(0);
    }
  }, [selectedMeal]);

  // Handle deep-link from Meal Maker: open plan picker for the passed recipe
  useEffect(() => {
    if (route && route.params && route.params.recipe) {
      const incoming = route.params.recipe;
      
      const normalized = normalizeRecipeForPlanner(incoming);
      setPlanPickerRecipe(normalized);
      
      // If a specific date was passed, use it
      if (route.params.selectedDate) {
        const passedDate = new Date(route.params.selectedDate);
        setSelectedDate(passedDate);
        
        // Calculate the day index based on the passed date
        const dayOfWeek = passedDate.getDay(); // 0=Sunday, 1=Monday, etc.
        const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0, Tuesday=1, ..., Sunday=6
        setPickerDayIndex(dayIdx);
        setCurrentDay(dayIdx);
        
        // Update weekTab to match the selected date's week
        const today = new Date();
        const thisMonday = getWeekStart(today);
        const selectedMonday = getWeekStart(passedDate);
        const diffDays = Math.round((selectedMonday - thisMonday) / (1000 * 60 * 60 * 24));
        const offset = Math.round(diffDays / 7);
        if (!Number.isNaN(offset)) {
          setWeekTab(offset);
        }
      } else {
        setPickerDayIndex(currentDay);
      }
      
      // Set meal type based on recipe category or default to Dinner
      const mealType = normalized.category ? 
        (normalized.category.charAt(0).toUpperCase() + normalized.category.slice(1)) : 'Dinner';
      setPickerMealType(mealTypes.includes(mealType) ? mealType : 'Dinner');
      
      // Show the plan picker
      setPlanPickerVisible(true);
      
      // If autoSelectMode is true, automatically add the meal to the plan
      if (route.params.autoSelectMode) {
        setTimeout(() => {
          confirmPlanPicker();
        }, 500);
      }
      
      // Clear the param to avoid re-trigger on re-render
      try { navigation.setParams({ recipe: undefined, selectedDate: undefined, autoSelectMode: undefined }); } catch {}
    }
  }, [route, currentDay, getWeekStart, confirmPlanPicker]);

  useEffect(() => {
    if (showRecipeDetail) {
      modalTranslateY.setValue(0);
    }
  }, [showRecipeDetail]);

  useEffect(() => {
    if (showShoppingList) {
      modalTranslateY.setValue(0);
    }
  }, [showShoppingList]);

          return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.primary, shadowColor: theme.primary }]}>
            <TouchableOpacity
          style={[{ marginRight: 12 }, styles.menuButtonCircle, { backgroundColor: 'rgba(0,0,0,0.1)' }]}
          onPress={() => navigation.openDrawer()}
        >
          <MaterialCommunityIcons name="menu" size={28} color={theme.accent} />
        </TouchableOpacity>
        <View style={[styles.headerLeft, { flexShrink: 1 }]}>
          <MaterialCommunityIcons name="chef-hat" size={22} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">Meal Planner</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.headerButton, styles.headerButtonOutlined, { borderColor: theme.primary }]} onPress={generateShoppingList}>
            <MaterialCommunityIcons name="cart" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, styles.headerButtonFilled, { backgroundColor: theme.error, marginLeft: 8 }]} onPress={clearMealPlan}>
            <MaterialCommunityIcons name="delete" size={20} color={theme.surface} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={[styles.segmentedRow, { backgroundColor: theme.surface, marginHorizontal: 20, marginTop: 8 }]}>
        <TouchableOpacity
          style={[styles.segmentedOption, viewMode === 'week' && styles.segmentedOptionActive]}
          onPress={() => setViewMode('week')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentedText, viewMode === 'week' && styles.segmentedTextActive, viewMode === 'week' && !isDefault && { color: theme.accent }]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentedOption, viewMode === 'month' && styles.segmentedOptionActive]}
          onPress={() => setViewMode('month')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentedText, viewMode === 'month' && styles.segmentedTextActive, viewMode === 'month' && !isDefault && { color: theme.accent }]}>Month</Text>
        </TouchableOpacity>
      </View>

      {/* Week Navigation + Day Selector */}
      {viewMode === 'week' && (
        <>
          <View style={[styles.weekNavScrollable, { backgroundColor: theme.surface }]}>
            <TouchableOpacity style={styles.navButton} onPress={() => changeWeek(-1)}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={isDefault ? '#6366F1' : theme.accent} />
            </TouchableOpacity>
            <View style={styles.weekNavCenter}>
              <MaterialCommunityIcons name="calendar-week" size={18} color={isDefault ? '#6366F1' : theme.accent} />
              <Text style={[styles.weekNavText, { color: theme.text }]}>{formatWeekRange(weekDates)}</Text>
            </View>
            <TouchableOpacity style={styles.navButton} onPress={() => changeWeek(1)}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={isDefault ? '#6366F1' : theme.accent} />
            </TouchableOpacity>
          </View>
          <View style={[styles.daySelectorContainer, { backgroundColor: theme.surface }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.daySelectorRow, { justifyContent: 'flex-start' }]}
            >
              {weekDates.map((d, idx) => {
                const isActive = idx === currentDay && toYMD(d.fullDate) === toYMD(selectedDate);
                const isToday = d.isToday;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayButton,
                      (isActive || isToday) && styles.dayButtonOutlined,
                      isToday && styles.dayButtonTodayOutline,
                      isActive && styles.dayButtonSelectedOutline,
                      isActive && !isDefault && { borderColor: theme.accent },
                    ]}
                    onPress={() => { setCurrentDay(idx); setSelectedDate(d.fullDate); }}
                  >
                    <Text style={[styles.dayButtonText]}>{d.day}</Text>
                    <Text style={[styles.dayButtonDate]}>{d.date}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* Month Navigation + Grid */}
      {viewMode === 'month' && (
        <>
          <View style={[styles.monthHeader, { backgroundColor: theme.surface }]}> 
            <TouchableOpacity style={styles.navButton} onPress={() => { const d = new Date(currentMonthDate); d.setMonth(d.getMonth() - 1); setCurrentMonthDate(d); }}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={isDefault ? '#6366F1' : theme.accent} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: theme.text }]}>{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={[styles.navButton, { marginRight: 8 }]} onPress={() => setShowShoppingList(true)}>
                <MaterialCommunityIcons name="cart" size={20} color={isDefault ? '#6366F1' : theme.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={() => { const d = new Date(currentMonthDate); d.setMonth(d.getMonth() + 1); setCurrentMonthDate(d); }}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={isDefault ? '#6366F1' : theme.accent} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ backgroundColor: theme.surface }}>
            {/* Day headers */}
            <View style={styles.monthDowRow}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label) => (
                <Text key={label} style={[styles.monthDow, { color: theme.textSecondary }]}>{label}</Text>
              ))}
            </View>
            {/* Calendar grid */}
            <View style={styles.monthGrid}>
              {/* Generate calendar grid in rows to ensure proper alignment */}
              {Array(6).fill(null).map((_, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.monthWeekRow}>
                  {getMonthGrid(currentMonthDate)
                    .slice(weekIndex * 7, weekIndex * 7 + 7)
                    .map((cell, dayIndex) => {
                      const idx = weekIndex * 7 + dayIndex;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.monthCell,
                            !cell.inMonth && styles.monthCellOut,
                            cell.isToday && styles.monthCellToday,
                            cell.isSelected && styles.monthCellSelected,
                            cell.isSelected && !isDefault && { borderColor: theme.accent },
                          ]}
                          onPress={() => {
                            setSelectedDate(cell.date);
                            const dayOfWeek = cell.date.getDay(); // 0=Sunday, 1=Monday, etc.
                            setCurrentDay(dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Convert to Monday=0, Tuesday=1, ..., Sunday=6
                            
                            // Update weekTab to match the selected date's week
                            const today = new Date();
                            const thisMonday = getWeekStart(today);
                            const selectedMonday = getWeekStart(cell.date);
                            const diffDays = Math.round((selectedMonday - thisMonday) / (1000 * 60 * 60 * 24));
                            const offset = Math.round(diffDays / 7);
                            if (!Number.isNaN(offset)) {
                              setWeekTab(offset);
                            }
                          }}
                        >
                          <View style={styles.monthCellInner}>
                            <Text style={[styles.monthCellText, { color: cell.inMonth ? theme.text : theme.textSecondary }]}>
                              {cell.date.getDate()}
                            </Text>
                            {(() => {
                              const types = getPlannedTypesForDate(cell.date);
                              if (types.length === 0) return null;
                              return (
                                <View style={[styles.dotRow]}>
                                  {types.slice(0,3).map((type, i) => (
                                    <View key={i} style={[styles.planDot, { backgroundColor: mealTypeToColor[type] || '#6366F1' }]} />
                                  ))}
                                  {types.length > 3 && (
                                    <Text style={[styles.dotMore, { color: theme.textSecondary }]}>+{types.length - 3}</Text>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              ))}
            </View>
          </View>
          {/* Month legend */}
          <View style={styles.legendRow}>
            {mealTypes.map((t) => (
              <View key={t} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: mealTypeToColor[t] }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{t}</Text>
              </View>
            ))}
          </View>
        </>
      )}
        
      {/* Current Day Meals */}
      <ScrollView style={styles.mealsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.dayHeader}>
          <Text style={[styles.currentDayTitle, { color: theme.text }]}>{daysFull[currentDay]}</Text>
          <Text style={[styles.currentDayDate, { color: theme.textSecondary }]}>
            {weekDates[currentDay]?.date}/{weekDates[currentDay]?.month}
          </Text>
          {Object.keys(mealPlan).filter(key => key.startsWith(`${weekTab}-${currentDay}-`)).length > 0 && (
            <TouchableOpacity style={styles.duplicateButton} onPress={duplicateWeek}>
              <MaterialCommunityIcons name="content-copy" size={16} color={isDefault ? '#6366F1' : theme.accent} />
              <Text style={[styles.duplicateButtonText, { color: isDefault ? '#6366F1' : theme.accent }]}>Duplicate Week</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {mealTypes.map((mealType) => {
          const key = `${weekTab}-${currentDay}-${mealType}`;
          const plannedMeal = mealPlan[key];
          return (
            <View key={mealType} style={[styles.mealCard, { backgroundColor: theme.surface }]}>
              <View style={styles.mealCardHeader}>
                <Text style={[styles.mealCardTitle, { color: theme.text }]}>{mealType}</Text>
                {plannedMeal && (
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeMealFromPlan(currentDay, mealType)}>
                    <MaterialCommunityIcons name="close" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
          </View>
              {plannedMeal ? (
                <TouchableOpacity 
                  style={[styles.plannedMealBox, { backgroundColor: theme.surface, borderLeftColor: isDefault ? '#6366F1' : theme.accent }]}
                  onPress={() => setShowRecipeDetail(plannedMeal)}
                >
                  <Text style={[styles.plannedMealName, { color: theme.text }]}>{plannedMeal.name}</Text>
                  <View style={styles.plannedMealInfoRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
                    <Text style={[styles.plannedMealInfo, { color: theme.textSecondary }]}>{plannedMeal.prepTime + plannedMeal.cookTime} min</Text>
                    <MaterialCommunityIcons name="account-group" size={16} color="#64748B" style={{ marginLeft: 12 }} />
                    <Text style={[styles.plannedMealInfo, { color: theme.textSecondary }]}>{plannedMeal.servings}</Text>
                    <MaterialCommunityIcons name="fire" size={16} color="#F59E0B" style={{ marginLeft: 12 }} />
                    <Text style={[styles.plannedMealInfo, { color: theme.textSecondary }]}>{plannedMeal.nutrition.calories} cal</Text>
        </View>
      </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.addMealButton, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]} 
                  onPress={() => setSelectedMeal({ dayIndex: currentDay, mealType: mealType })}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.primary} />
                  <Text style={[styles.addMealButtonText, { color: isDefault ? '#6366F1' : theme.accent }]}>Add {mealType}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Recipe Selection Modal */}
      <Modal
        visible={!!selectedMeal}
        transparent
        onRequestClose={() => setSelectedMeal(null)}
        onShow={() => modalTranslateY.setValue(0)}
      >
        <View style={styles.modalOverlay}>
          <PanGestureHandler
            onGestureEvent={handleGestureEvent}
            onHandlerStateChange={handleGestureStateChange}
          >
            <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface, transform: [{ translateY: modalTranslateY }] }]}> 
              <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Choose {selectedMeal?.mealType}</Text>
                <TouchableOpacity onPress={() => setSelectedMeal(null)}>
                  <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
              <View style={[styles.searchBox, { backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search recipes..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.filterContainer}
                contentContainerStyle={{ flexDirection: 'row', alignItems: 'flex-start', height: 28 }}
              >
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.filterButton, selectedFilter === category && styles.filterButtonActive, { backgroundColor: theme.surface }]}
                    onPress={() => setSelectedFilter(category)}
                  >
                    <Text style={[styles.filterButtonText, selectedFilter === category && styles.filterButtonTextActive, { color: theme.textSecondary }]}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <FlatList
              data={filteredRecipes}
              renderItem={renderRecipeCard}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              style={{ marginTop: 20 }}
              ListHeaderComponent={null}
              ListEmptyComponent={<View style={{ height: 0 }} />}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingTop: 0, marginTop: 0, marginBottom: 0, paddingBottom: 20 }}
            />
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>

      {/* Quick Plan Picker (from Meal Maker) */}
      <Modal visible={planPickerVisible} transparent onRequestClose={() => setPlanPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <PanGestureHandler onGestureEvent={handleGestureEvent} onHandlerStateChange={handleGestureStateChange}>
            <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface, transform: [{ translateY: modalTranslateY }] }]}> 
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Plan “{planPickerRecipe?.name}”</Text>
                <TouchableOpacity onPress={() => setPlanPickerVisible(false)}>
                  <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              {/* Recipe preview */}
              {!!planPickerRecipe && (
                <View style={[styles.pickerPreview, { backgroundColor: theme.surface, borderColor: '#E5E7EB' }]}>
                  <Text style={[styles.pickerPreviewName, { color: theme.text }]} numberOfLines={1}>{planPickerRecipe.name}</Text>
                  <View style={styles.pickerPreviewRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
                    <Text style={[styles.pickerPreviewText, { color: theme.textSecondary }]}>{(planPickerRecipe.prepTime + planPickerRecipe.cookTime) || 0} min</Text>
                    <MaterialCommunityIcons name="account-group" size={16} color="#64748B" style={{ marginLeft: 12 }} />
                    <Text style={[styles.pickerPreviewText, { color: theme.textSecondary }]}>{planPickerRecipe.servings} servings</Text>
                  </View>
                </View>
              )}
              {/* Month in picker */}
              <View style={styles.monthHeader}> 
                <TouchableOpacity onPress={() => { const d = new Date(currentMonthDate); d.setMonth(d.getMonth() - 1); setCurrentMonthDate(d); }}>
                  <MaterialCommunityIcons name="chevron-left" size={22} color={isDefault ? '#6366F1' : theme.accent} />
                </TouchableOpacity>
                <Text style={[styles.monthTitle, { color: theme.text }]}>{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                <TouchableOpacity onPress={() => { const d = new Date(currentMonthDate); d.setMonth(d.getMonth() + 1); setCurrentMonthDate(d); }}>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={isDefault ? '#6366F1' : theme.accent} />
                </TouchableOpacity>
              </View>
              <View>
                {/* Day headers */}
                <View style={styles.monthDowRow}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label) => (
                    <Text key={label} style={[styles.monthDow, { color: theme.textSecondary }]}>{label}</Text>
                  ))}
                </View>
                {/* Calendar grid */}
                <View style={styles.monthGrid}>
                  {/* Generate calendar grid in rows to ensure proper alignment */}
                  {Array(6).fill(null).map((_, weekIndex) => (
                    <View key={`week-${weekIndex}`} style={styles.monthWeekRow}>
                      {getMonthGrid(currentMonthDate)
                        .slice(weekIndex * 7, weekIndex * 7 + 7)
                        .map((cell, dayIndex) => {
                          const idx = weekIndex * 7 + dayIndex;
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.monthCell,
                                !cell.inMonth && styles.monthCellOut,
                                cell.isToday && styles.monthCellToday,
                                cell.isSelected && styles.monthCellSelected,
                                cell.isSelected && !isDefault && { borderColor: theme.accent },
                              ]}
                              onPress={() => {
                                setSelectedDate(cell.date);
                                const dayOfWeek = cell.date.getDay(); // 0=Sunday, 1=Monday, etc.
                                setPickerDayIndex(dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Convert to Monday=0, Tuesday=1, ..., Sunday=6
                              }}
                            >
                              <View style={styles.monthCellInner}>
                                <Text style={[styles.monthCellText, { color: cell.inMonth ? theme.text : theme.textSecondary }]}>
                                  {cell.date.getDate()}
                                </Text>
                                {(() => {
                                  const types = getPlannedTypesForDate(cell.date);
                                  if (types.length === 0) return null;
                                  return (
                                    <View style={[styles.dotRow]}>
                                      {types.slice(0,3).map((type, i) => (
                                        <View key={i} style={[styles.planDot, { backgroundColor: mealTypeToColor[type] || '#6366F1' }]} />
                                      ))}
                                      {types.length > 3 && (
                                        <Text style={[styles.dotMore, { color: theme.textSecondary }]}>+{types.length - 3}</Text>
                                      )}
                                    </View>
                                  );
                                })()}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  ))}
                </View>
              </View>
              <Text style={styles.sectionTitle}>Meal type</Text>
              <View style={styles.segmentedRow}>
                {mealTypes.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.segmentedOption, pickerMealType === type && styles.segmentedOptionActive]}
                    onPress={() => setPickerMealType(type)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.segmentedText, pickerMealType === type && styles.segmentedTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.actionRow, { borderTopColor: theme.textSecondary + '22', marginTop: 16 }]}> 
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={confirmPlanPicker}>
                  <MaterialCommunityIcons name="calendar-check" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Add to plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.outlineButton, { borderColor: '#CBD5E1' }]} onPress={() => setPlanPickerVisible(false)}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.textSecondary} />
                  <Text style={[styles.outlineButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal
        visible={!!showRecipeDetail}
        transparent
        onRequestClose={() => setShowRecipeDetail(null)}
        onShow={() => modalTranslateY.setValue(0)}
      >
        <View style={styles.modalOverlay}>
          <PanGestureHandler
            onGestureEvent={handleGestureEvent}
            onHandlerStateChange={handleGestureStateChange}
          >
            <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface, transform: [{ translateY: modalTranslateY }] }]}> 
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{showRecipeDetail?.name}</Text>
                <TouchableOpacity onPress={() => setShowRecipeDetail(null)}>
                  <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.recipeOverview}>
                  <View style={styles.recipeStats}>
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="clock-outline" size={20} color="#6366F1" />
                      <Text style={styles.statText}>{showRecipeDetail?.prepTime + showRecipeDetail?.cookTime} min</Text>
                    </View>
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="account-group" size={20} color="#6366F1" />
                      <Text style={styles.statText}>{showRecipeDetail?.servings} servings</Text>
                    </View>
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="signal" size={20} color="#6366F1" />
                      <Text style={styles.statText}>{showRecipeDetail?.difficulty}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.recipeTagsContainer}>
                    {showRecipeDetail?.tags.map((tag, idx) => (
                      <View key={idx} style={styles.recipeTag}>
                        <Text style={styles.recipeTagText}>{tag}</Text>
                      </View>
                  ))}
                </View>
                </View>
                
                <Text style={styles.sectionTitle}>Ingredients</Text>
                {showRecipeDetail?.ingredients.map((ingredient, idx) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <MaterialCommunityIcons name="circle" size={10} color="#6366F1" style={{ marginRight: 8 }} />
                    <Text style={[styles.ingredientText, { color: theme.text }]}>{ingredient}</Text>
                  </View>
                ))}
                
                <Text style={styles.sectionTitle}>Instructions</Text>
                {showRecipeDetail?.instructions.map((step, idx) => (
                  <View key={idx} style={styles.instructionRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                    <Text style={[styles.instructionText, { color: theme.text }]}>{step}</Text>
                  </View>
                ))}
                
                <Text style={styles.sectionTitle}>Nutrition</Text>
                <View style={styles.nutritionGrid}>
                  {showRecipeDetail && Object.entries(showRecipeDetail.nutrition).map(([key, value]) => (
                    <View key={key} style={[styles.nutritionItem, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.nutritionValue, { color: theme.text }]}>{value}{key === 'calories' ? '' : 'g'}</Text>
                      <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>

      {/* Shopping List Modal */}
      <Modal
        visible={showShoppingList}
        transparent
        onRequestClose={() => setShowShoppingList(false)}
        onShow={() => modalTranslateY.setValue(0)}
      >
        <View style={styles.modalOverlay}>
          <PanGestureHandler
            onGestureEvent={handleGestureEvent}
            onHandlerStateChange={handleGestureStateChange}
          >
            <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface, transform: [{ translateY: modalTranslateY }] }]}> 
            <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Shopping List ({shoppingList.length} items)</Text>
                <TouchableOpacity onPress={() => setShowShoppingList(false)}>
                  <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
              <ScrollView showsVerticalScrollIndicator={false}>
                {shoppingList.length > 0 ? (
                  shoppingList.map((item, idx) => (
                <TouchableOpacity
                      key={idx} 
                      style={[styles.shoppingListItem, checkedItems[idx] && styles.shoppingListItemChecked]}
                      onPress={() => toggleShoppingItem(idx)}
                    >
                      <MaterialCommunityIcons 
                        name={checkedItems[idx] ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                        size={24} 
                        color={checkedItems[idx] ? "#10B981" : "#6366F1"} 
                        style={{ marginRight: 12 }} 
                      />
                      <Text style={[styles.shoppingListText, checkedItems[idx] && styles.shoppingListTextChecked, { color: theme.text }]}>
                        {item.name}
                        {item.count && <Text style={styles.itemCount}> (x{item.count})</Text>}
                      </Text>
                </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyShoppingList}>
                    <MaterialCommunityIcons name="cart" size={48} color="#CBD5E1" />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No meals planned yet</Text>
                    <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Add some recipes to generate your shopping list!</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor moved to inline style
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24, // increased for larger header
    paddingBottom: 24, // increased for larger header
    // backgroundColor moved to inline style
    borderBottomWidth: 2,
    borderBottomColor: '#6366F1', // fallback, now dynamic
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
    // color: theme.primary, // now dynamic
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 0,
  },
  headerButtonOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  headerButtonFilled: {
    borderWidth: 0,
  },
  headerButtonText: {
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 14,
  },
  weekNavScrollable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor moved to inline style
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  weekNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  weekNavText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 6,
  },
  daySelectorContainer: {
    // backgroundColor moved to inline style
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  daySelectorRow: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthDowRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  monthGrid: {
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthDow: {
    width: `${100/7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  monthCell: {
    width: `${100/7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  monthCellOut: {
    opacity: 0.4,
  },
  monthCellToday: {
    backgroundColor: 'transparent',
    borderColor: '#10B981',
  },
  monthCellSelected: {
    backgroundColor: 'transparent',
    borderColor: '#6366F1',
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthCellInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 4,
  },
  planDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6366F1',
  },
  dotMore: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    marginRight: 8,
    borderRadius: 12,
  },
  dayButtonOutlined: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dayButtonTodayOutline: {
    borderColor: '#10B981',
  },
  dayButtonSelectedOutline: {
    borderColor: '#6366F1',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dayButtonDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  mealsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  currentDayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  currentDayDate: {
    fontSize: 16,
    color: '#64748B',
  },
  duplicateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
  },
  duplicateButtonText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginLeft: 4,
  },
  mealCard: {
    // backgroundColor moved to inline style
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mealCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  removeButton: {
    padding: 4,
  },
  plannedMealBox: {
    // backgroundColor moved to inline style
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  plannedMealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  plannedMealInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plannedMealInfo: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    // backgroundColor moved to inline style
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  addMealButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    // backgroundColor moved to inline style
    borderRadius: 20,
    height: windowHeight * 0.92,
    width: '100%',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    justifyContent: 'flex-start',
    marginTop: 64,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor moved to inline style
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  filterContainer: {
    paddingVertical: 0,
    marginTop: 8,
    height: 28,
  },
  filterButton: {
    height: 20,
    minHeight: 0,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 10,
    // backgroundColor moved to inline style
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  recipeSelectCard: {
    // backgroundColor moved to inline style
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  recipeTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  recipeTag: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  recipeTagText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
  },
  recipeSelectInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeSelectInfo: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  addToPlanButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  addToPlanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailsButtonText: {
    color: '#6366F1',
    fontWeight: '600',
    fontSize: 14,
  },
  // Shared action row and buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Picker-specific styles
  pickerPreview: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  pickerPreviewName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  pickerPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerPreviewText: {
    fontSize: 14,
    marginLeft: 4,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  dayChipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  segmentedOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentedOptionActive: {
    backgroundColor: '#EEF2FF',
  },
  segmentedText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  segmentedTextActive: {
    color: '#4F46E5',
  },
  recipeOverview: {
    marginBottom: 20,
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    marginTop: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 16,
    color: '#374151',
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  instructionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    width: '48%',
    // backgroundColor moved to inline style
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  shoppingListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shoppingListItemChecked: {
    opacity: 0.5,
  },
  shoppingListText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  shoppingListTextChecked: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemCount: {
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyShoppingList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  menuButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 

export default MealPlanner;