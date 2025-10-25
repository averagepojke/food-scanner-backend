import React, { useState, useCallback, useMemo, useContext, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  StatusBar,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Image,
  Animated
} from 'react-native';
import { SafeAreaView} from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CompactMealButtons from './CompactMealButtons';
import * as Haptics from 'expo-haptics';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';
import BarcodeScannerModal from './BarcodeScannerModal';
import { API_BASE_URL } from './config';
import seedRecipes from './recipes/seedRecipes.json';
import { useSubscription } from './ImprovedSubscriptionManager';
// Helper functions (copied from HomeScreen.js)
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const getDaysUntilExpiry = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const { width, height } = Dimensions.get('window');



// Meal categories and their typical ingredients
const MEAL_CATEGORIES = {
  breakfast: {
    name: 'Breakfast',
    icon: 'food-croissant',
    ingredients: ['eggs', 'milk', 'bread', 'cheese', 'butter', 'yogurt', 'fruits', 'cereal', 'oatmeal', 'bacon', 'sausage'],
    color: '#FFB74D'
  },
  lunch: {
    name: 'Lunch',
    icon: 'food-fork-drink',
    ingredients: ['bread', 'cheese', 'meat', 'vegetables', 'tomatoes', 'lettuce', 'mayonnaise', 'mustard', 'soup', 'salad'],
    color: '#81C784'
  },
  dinner: {
    name: 'Dinner',
    icon: 'food-steak',
    ingredients: ['meat', 'fish', 'chicken', 'rice', 'pasta', 'vegetables', 'potatoes', 'onions', 'garlic', 'sauce', 'oil'],
    color: '#F06292'
  },
  snack: {
    name: 'Snack',
    icon: 'food-apple',
    ingredients: ['fruits', 'nuts', 'chips', 'crackers', 'yogurt', 'cheese', 'juice', 'smoothie'],
    color: '#64B5F6'
  }
};

// Subcategories for each main type
const SUBCATEGORIES = {
  breakfast: ['sweet', 'savory', 'high-protein', 'overnight', '5-ingredients'],
  lunch: ['sandwich', 'salad', 'soup', 'meal-prep', 'vegetarian'],
  dinner: ['one-pot', 'vegetarian', 'chicken', 'pasta', 'quick'],
  snack: ['chocolatey', 'healthy', 'savory', 'quick', 'no-bake'],
};

// Heuristic tag inference to support subcategories like "high-protein"
const PROTEIN_INGREDIENTS = [
  'egg','eggs','chicken','beef','pork','turkey','tuna','salmon','shrimp','fish',
  'tofu','tempeh','seitan','lentil','lentils','beans','bean','chickpea','chickpeas',
  'greek yogurt','yogurt','cottage cheese','cheese','edamame','quinoa','peanut butter',
  'protein powder','milk'
];

const CHOCOLATEY_INGREDIENTS = [
  'chocolate', 'cocoa', 'cacao',
];

function inferTags(recipe) {
  const tags = new Set();
  const name = String(recipe?.name || '').toLowerCase();
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map(i => String(i || '').toLowerCase()) : [];
  // High-protein: name mentions protein OR at least 2 protein-source ingredient hits
  let proteinHits = 0;
  for (const ing of ingredients) {
    if (PROTEIN_INGREDIENTS.some(p => ing.includes(p))) proteinHits += 1;
  }
  if (proteinHits >= 2 || name.includes('protein')) tags.add('high-protein');

  // Chocolatey: name or ingredients contain chocolatey keywords
  const hasChocolate = ingredients.some(ing => CHOCOLATEY_INGREDIENTS.some(c => ing.includes(c)));
  if (hasChocolate || name.includes('chocolate')) tags.add('chocolatey');
  
  return tags;
}

function recipeMatchesSubcategory(recipe, subcategory) {
  if (!subcategory) return true;
  const lc = String(subcategory).toLowerCase();
  const declared = (recipe?.subcategories || []).map(s => String(s).toLowerCase());
  if (declared.includes(lc)) return true;
  const inferred = inferTags(recipe);
  if (inferred.has(lc)) return true;
  // Fallback: keyword match in name or ingredients
  const name = String(recipe?.name || '').toLowerCase();
  if (name.includes(lc)) return true;
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map(i => String(i || '').toLowerCase()) : [];
  return ingredients.some(i => i.includes(lc));
}

// Generate free recipe website links for a given category/subcategory
function generateRecipeLinks(categoryKey, subcategory) {
  const q = encodeURIComponent(`${subcategory ? subcategory + ' ' : ''}${MEAL_CATEGORIES[categoryKey]?.name || ''}`.trim());
  return [
    { title: 'Allrecipes', url: `https://www.allrecipes.com/search?q=${q}`, source: 'allrecipes.com' },
    { title: 'BBC Good Food', url: `https://www.bbcgoodfood.com/search/recipes?q=${q}`, source: 'bbcgoodfood.com' },
    { title: 'EatingWell', url: `https://www.eatingwell.com/search?q=${q}`, source: 'eatingwell.com' },
    { title: 'Minimalist Baker', url: `https://minimalistbaker.com/?s=${q}`, source: 'minimalistbaker.com' },
    { title: 'Serious Eats', url: `https://www.seriouseats.com/search?q=${q}`, source: 'seriouseats.com' },
  ];
}

// Built-in fallback recipes and local seed recipes merged
const RECIPE_DATABASE = {
  'scrambled-eggs': {
    name: 'Scrambled Eggs',
    category: 'breakfast',
    ingredients: ['eggs', 'milk', 'butter', 'salt', 'pepper'],
    instructions: '1. Crack eggs into bowl\n2. Add milk and whisk\n3. Heat butter in pan\n4. Pour eggs and stir until cooked',
    prepTime: '5 min',
    cookTime: '5 min',
    difficulty: 'Easy'
  },
  'grilled-cheese': {
    name: 'Grilled Cheese Sandwich',
    category: 'lunch',
    ingredients: ['bread', 'cheese', 'butter'],
    instructions: '1. Butter bread slices\n2. Add cheese between slices\n3. Grill until golden brown',
    prepTime: '3 min',
    cookTime: '5 min',
    difficulty: 'Easy'
  },
  'chicken-stir-fry': {
    name: 'Chicken Stir Fry',
    category: 'dinner',
    ingredients: ['chicken', 'vegetables', 'rice', 'oil', 'soy sauce', 'garlic'],
    instructions: '1. Cook rice\n2. Stir fry chicken\n3. Add vegetables\n4. Season with soy sauce',
    prepTime: '10 min',
    cookTime: '15 min',
    difficulty: 'Medium'
  },
  'fruit-salad': {
    name: 'Fruit Salad',
    category: 'snack',
    ingredients: ['fruits', 'yogurt', 'honey'],
    instructions: '1. Cut fruits into pieces\n2. Mix with yogurt\n3. Drizzle with honey',
    prepTime: '10 min',
    cookTime: '0 min',
    difficulty: 'Easy'
  },
  'pasta-carbonara': {
    name: 'Pasta Carbonara',
    category: 'dinner',
    ingredients: ['pasta', 'eggs', 'cheese', 'bacon', 'garlic', 'black pepper'],
    instructions: '1. Cook pasta\n2. Cook bacon until crispy\n3. Mix eggs and cheese\n4. Combine all ingredients',
    prepTime: '5 min',
    cookTime: '15 min',
    difficulty: 'Medium'
  },
  'smoothie-bowl': {
    name: 'Smoothie Bowl',
    category: 'breakfast',
    ingredients: ['fruits', 'yogurt', 'milk', 'granola', 'honey'],
    instructions: '1. Blend fruits with yogurt and milk\n2. Pour into bowl\n3. Top with granola and honey',
    prepTime: '10 min',
    cookTime: '0 min',
    difficulty: 'Easy'
  },
  'chocolate-mug-cake': {
    name: 'Chocolate Mug Cake',
    category: 'snack',
    subcategories: ['chocolatey', 'quick', 'no-bake'],
    ingredients: ['flour', 'cocoa powder', 'sugar', 'milk', 'oil', 'vanilla'],
    instructions: '1. Mix dry ingredients in mug\n2. Add wet ingredients and stir\n3. Microwave for 90 seconds\n4. Let cool and enjoy',
    prepTime: '3 min',
    cookTime: '2 min',
    difficulty: 'Easy'
  },
  'chocolate-banana-smoothie': {
    name: 'Chocolate Banana Smoothie',
    category: 'snack',
    subcategories: ['chocolatey', 'healthy', 'quick'],
    ingredients: ['banana', 'cocoa powder', 'milk', 'honey', 'ice'],
    instructions: '1. Add all ingredients to blender\n2. Blend until smooth\n3. Pour into glass and serve',
    prepTime: '5 min',
    cookTime: '0 min',
    difficulty: 'Easy'
  },
  'chocolate-chip-cookies': {
    name: 'Quick Chocolate Chip Cookies',
    category: 'snack',
    subcategories: ['chocolatey', 'sweet'],
    ingredients: ['flour', 'butter', 'sugar', 'chocolate chips', 'egg', 'vanilla'],
    instructions: '1. Mix butter and sugar\n2. Add egg and vanilla\n3. Mix in flour and chocolate chips\n4. Bake at 180°C for 12 minutes',
    prepTime: '10 min',
    cookTime: '12 min',
    difficulty: 'Easy'
  },
  'chicken-caesar-salad': {
    name: 'Chicken Caesar Salad',
    category: 'lunch',
    subcategories: ['salad', 'high-protein'],
    ingredients: ['chicken breast', 'romaine lettuce', 'parmesan cheese', 'caesar dressing', 'croutons'],
    instructions: '1. Grill chicken breast and slice\n2. Chop romaine lettuce\n3. Toss with caesar dressing\n4. Top with chicken, parmesan, and croutons',
    prepTime: '10 min',
    cookTime: '15 min',
    difficulty: 'Easy'
  },
  'turkey-club-sandwich': {
    name: 'Turkey Club Sandwich',
    category: 'lunch',
    subcategories: ['sandwich', 'quick'],
    ingredients: ['bread', 'turkey', 'bacon', 'lettuce', 'tomato', 'mayonnaise'],
    instructions: '1. Toast bread slices\n2. Cook bacon until crispy\n3. Layer turkey, bacon, lettuce, tomato\n4. Add mayo and assemble sandwich',
    prepTime: '8 min',
    cookTime: '5 min',
    difficulty: 'Easy'
  },
  'tomato-basil-soup': {
    name: 'Tomato Basil Soup',
    category: 'lunch',
    subcategories: ['soup', 'vegetarian'],
    ingredients: ['tomatoes', 'basil', 'onion', 'garlic', 'vegetable broth', 'cream'],
    instructions: '1. Sauté onion and garlic\n2. Add tomatoes and broth\n3. Simmer 20 minutes\n4. Blend smooth, add basil and cream',
    prepTime: '10 min',
    cookTime: '25 min',
    difficulty: 'Easy'
  },
  'quinoa-power-bowl': {
    name: 'Quinoa Power Bowl',
    category: 'lunch',
    subcategories: ['meal-prep', 'healthy', 'vegetarian'],
    ingredients: ['quinoa', 'chickpeas', 'avocado', 'spinach', 'cherry tomatoes', 'tahini'],
    instructions: '1. Cook quinoa according to package\n2. Roast chickpeas with spices\n3. Arrange quinoa, chickpeas, avocado, spinach, tomatoes in bowl\n4. Drizzle with tahini dressing',
    prepTime: '15 min',
    cookTime: '20 min',
    difficulty: 'Easy'
  }
};

// Merge seed recipes into local DB map for unified handling
const SEEDED_RECIPES = Array.isArray(seedRecipes) ? seedRecipes.reduce((acc, r) => {
  acc[r.id] = {
    name: r.name,
    category: r.category,
    subcategories: r.subcategories || [],
    ingredients: r.ingredients || [],
    instructions: r.instructions || '',
    prepTime: r.prepTime || '10 min',
    cookTime: r.cookTime || '20 min',
    difficulty: r.difficulty || 'Easy',
  };
  return acc;
}, {}) : {};

// Compute ingredient match stats against current inventory
function computeIngredientMatch(recipeIngredients, inventoryItems) {
  const inventoryWords = new Set();
  (inventoryItems || []).forEach(item => {
    const name = String(item.name || '').toLowerCase();
    name.split(/\s+/).forEach(w => w && inventoryWords.add(w));
    if (item.category) inventoryWords.add(String(item.category).toLowerCase());
  });
  const ingredients = Array.isArray(recipeIngredients) ? recipeIngredients : [];
  const matchingIngredients = ingredients.filter(ing => {
    const ingLower = String(ing || '').toLowerCase();
    for (const w of inventoryWords) {
      if (ingLower.includes(w) || w.includes(ingLower)) return true;
    }
    return false;
  });
  const missingIngredients = ingredients.filter(ing => !matchingIngredients.includes(ing));
  const matchPercentage = ingredients.length > 0 ? (matchingIngredients.length / ingredients.length) * 100 : 0;
  return { matchingIngredients, missingIngredients, matchPercentage };
}

// Collapsible Section Component
const CollapsibleSection = ({ title, icon, isCollapsed, onToggle, children, theme, count = null, badge = null }) => {
  return (
    <View style={[styles.collapsibleSection, { 
      backgroundColor: theme.surface, 
      borderColor: theme.border,
      shadowColor: theme.cardShadow 
    }]}>
      <TouchableOpacity 
        style={[styles.collapsibleHeader, { 
          backgroundColor: isCollapsed ? theme.surface : theme.background + '40'
        }]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.collapsibleHeaderContent}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
            <MaterialCommunityIcons name={icon} size={18} color={theme.primary} />
          </View>
          <Text style={[styles.collapsibleTitle, { color: theme.text }]}>{title}</Text>
          {count !== null && (
            <View style={[styles.countBadge, { 
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
              elevation: 2
            }]}>
              <Text style={[styles.countBadgeText, { color: '#fff' }]}>{count}</Text>
            </View>
          )}
          {badge && (
            <View style={[styles.statusBadge, { 
              backgroundColor: badge.color,
              shadowColor: badge.color,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
              elevation: 2
            }]}>
              <Text style={[styles.statusBadgeText, { color: '#fff' }]}>{badge.text}</Text>
            </View>
          )}
        </View>
        <View style={[styles.chevronContainer, { 
          backgroundColor: theme.textSecondary + '10',
          transform: [{ rotate: isCollapsed ? '0deg' : '180deg' }]
        }]}>
          <MaterialCommunityIcons 
            name="chevron-down" 
            size={20} 
            color={theme.textSecondary} 
          />
        </View>
      </TouchableOpacity>
      {!isCollapsed && (
        <View style={[styles.collapsibleContent, { backgroundColor: theme.background + '20' }]}>
          {children}
        </View>
      )}
    </View>
  );
};

// Compact action buttons for meal cards
const MealCardActions = ({ meal, theme, showMissing, onAddMissing, onPlan }) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
      {showMissing && onAddMissing && meal.missingIngredients && meal.missingIngredients.length > 0 && (
        <TouchableOpacity style={[styles.addMissingButton, { backgroundColor: theme.accent }]} onPress={onAddMissing} activeOpacity={0.8}>
          <MaterialCommunityIcons name="playlist-plus" size={12} color="#fff" />
          <Text style={styles.addMissingText} numberOfLines={1} ellipsizeMode="tail">+{meal.missingIngredients.length}</Text>
        </TouchableOpacity>
      )}
      {onPlan && (
        <TouchableOpacity 
          style={[styles.planButton, { backgroundColor: theme.primary }]} 
          onPress={onPlan} 
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="calendar-plus" size={12} color="#fff" />
          <Text style={[styles.planButtonText, { color: "#fff" }]}>Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Enhanced Meal Suggestion Card with better meal planner integration
const EnhancedMealSuggestionCard = React.memo(({ meal, onPress, theme, showMissing, onAddMissing, onPlan, compact = false }) => {
  const category = MEAL_CATEGORIES[meal.category];
  
  return (
    <TouchableOpacity
      style={[
        styles.mealCard,
        compact && styles.mealCardCompact,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: category.color, borderLeftWidth: 4 }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.mealCardHeader}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={styles.mealThumb} />
        ) : (
          <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
            <MaterialCommunityIcons name={category.icon} size={24} color="#fff" />
          </View>
        )}
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>{meal.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.mealCategory, { color: theme.textSecondary }]}>{category.name}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
      </View>
      
      <View style={styles.mealIngredients}>
        <Text style={[styles.ingredientsLabel, { color: theme.textSecondary }]}>Ingredients:</Text>
        <Text style={[styles.ingredientsList, { color: theme.text }]}>
          {meal.ingredients.slice(0, 3).join(', ')}
          {meal.ingredients.length > 3 && '...'}
        </Text>
        {showMissing && (
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: theme.success + '30' }]}>
              <MaterialCommunityIcons name="check-circle" size={12} color={theme.success} />
              <Text style={[styles.badgeText, { color: theme.text }]}>Have {meal.matchingIngredients?.length || 0}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.warning + '30' }]}>
              <MaterialCommunityIcons name="alert-circle" size={12} color={theme.warning} />
              <Text style={[styles.badgeText, { color: theme.text }]}>Need {meal.missingIngredients?.length || 0}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.mealStats}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textSecondary }]}>
            {meal.prepTime} + {meal.cookTime}
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="star-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textSecondary }]}>{meal.difficulty}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minWidth: 140 }}>
          {showMissing && onAddMissing && meal.missingIngredients && meal.missingIngredients.length > 0 && (
            <TouchableOpacity style={[styles.addMissingButton, { backgroundColor: theme.accent }]} onPress={onAddMissing} activeOpacity={0.8}>
              <MaterialCommunityIcons name="playlist-plus" size={12} color="#fff" />
              <Text style={styles.addMissingText} numberOfLines={1} ellipsizeMode="tail">+{meal.missingIngredients.length}</Text>
            </TouchableOpacity>
          )}
          {onPlan && (
            <TouchableOpacity 
              style={[styles.planButton, { backgroundColor: theme.primary }]} 
              onPress={onPlan} 
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="calendar-plus" size={12} color="#fff" />
              <Text style={[styles.planButtonText, { color: "#fff" }]}>Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Recipe Detail Modal Component
const RecipeDetailModal = ({ visible, recipe, onClose, onUseIngredients, onPlan, theme }) => {
  if (!recipe) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.recipeModal, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.recipeTitle, { color: theme.text }]}>{recipe.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.recipeContent} showsVerticalScrollIndicator={false}>
            <View style={styles.recipeInfo}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Prep: {recipe.prepTime} | Cook: {recipe.cookTime}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="star-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Difficulty: {recipe.difficulty}
                </Text>
              </View>
            </View>

            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
              {recipe.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <MaterialCommunityIcons name="circle-small" size={20} color={theme.primary} />
                  <Text style={[styles.ingredientText, { color: theme.text }]}>
                    {ingredient}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
              <Text style={[styles.instructionsText, { color: theme.text }]}>
                {recipe.instructions}
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}> 
            <TouchableOpacity
              style={[styles.useIngredientsButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                onUseIngredients(recipe.ingredients);
                onClose();
              }}
            >
              <MaterialCommunityIcons name="check" size={20} color="white" />
              <Text style={styles.useIngredientsText}>Use These Ingredients</Text>
            </TouchableOpacity>
            {onPlan && (
              <TouchableOpacity
                style={[styles.planMealButton, { backgroundColor: theme.success, marginLeft: 12 }]}
                onPress={() => {
                  onPlan();
                  onClose();
                }}
              >
                <MaterialCommunityIcons name="calendar-plus" size={20} color="white" />
                <Text style={styles.planMealText}>Plan This Meal</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Meal Suggestion Card Component
const MealSuggestionCard = ({ meal, onPress, theme, showMissing, onAddMissing, onPlan, compact = false }) => {
  const category = MEAL_CATEGORIES[meal.category];
  
  return (
    <TouchableOpacity
      style={[
        styles.mealCard,
        compact && styles.mealCardCompact,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: category.color, borderLeftWidth: 4 }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.mealCardHeader}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={styles.mealThumb} />
        ) : (
          <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
            <MaterialCommunityIcons name={category.icon} size={24} color="#fff" />
          </View>
        )}
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>{meal.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.mealCategory, { color: theme.textSecondary }]}>{category.name}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
      </View>
      
      <View style={styles.mealIngredients}>
        <Text style={[styles.ingredientsLabel, { color: theme.textSecondary }]}>Ingredients:</Text>
        <Text style={[styles.ingredientsList, { color: theme.text }]}>
          {meal.ingredients.slice(0, 3).join(', ')}
          {meal.ingredients.length > 3 && '...'}
        </Text>
        {showMissing && (
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: theme.success + '30' }]}>
              <MaterialCommunityIcons name="check-circle" size={12} color={theme.success} />
              <Text style={[styles.badgeText, { color: theme.text }]}>Have {meal.matchingIngredients?.length || 0}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.warning + '30' }]}>
              <MaterialCommunityIcons name="alert-circle" size={12} color={theme.warning} />
              <Text style={[styles.badgeText, { color: theme.text }]}>Need {meal.missingIngredients?.length || 0}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.mealStats}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textSecondary }]}>
            {meal.prepTime} + {meal.cookTime}
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="star-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textSecondary }]}>{meal.difficulty}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minWidth: 140 }}>
          {showMissing && onAddMissing && meal.missingIngredients && meal.missingIngredients.length > 0 && (
            <TouchableOpacity style={[styles.addMissingButton, { backgroundColor: theme.accent }]} onPress={onAddMissing} activeOpacity={0.8}>
              <MaterialCommunityIcons name="playlist-plus" size={12} color="#fff" />
              <Text style={styles.addMissingText} numberOfLines={1} ellipsizeMode="tail">+{meal.missingIngredients.length}</Text>
            </TouchableOpacity>
          )}
          {onPlan && (
            <TouchableOpacity 
              style={[styles.planButton, { backgroundColor: theme.primary }]} 
              onPress={onPlan} 
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="calendar-plus" size={12} color="#fff" />
              <Text style={[styles.planButtonText, { color: "#fff" }]}>Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Expiring Item Card Component
const ExpiringItemCard = ({ item, onPress, theme }) => {
  const daysLeft = getDaysUntilExpiry(item.expiry);
  const isExpired = daysLeft < 0;
  const isExpiringSoon = daysLeft <= 3;

  return (
    <TouchableOpacity
      style={[
        styles.expiringItemCard,
        { 
          backgroundColor: theme.surface,
          borderColor: isExpired ? theme.error : isExpiringSoon ? theme.warning : theme.success
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.expiringItemHeader}>
        <Text style={[styles.expiringItemName, { color: theme.text }]}>{item.name}</Text>
        <View style={[
          styles.expiryBadge,
          { 
            backgroundColor: isExpired ? theme.error : isExpiringSoon ? theme.warning : theme.success
          }
        ]}>
          <Text style={styles.expiryBadgeText}>
            {isExpired ? 'Expired' : `${daysLeft} days`}
          </Text>
        </View>
      </View>
      <Text style={[styles.expiringItemCategory, { color: theme.textSecondary }]}>
        {item.category} • Qty: {item.quantity}
      </Text>
    </TouchableOpacity>
  );
};

export default function MealMaker() {
  const navigation = useNavigation();
  const { foodInventory, setFoodInventory, darkMode, accentKey, addToShoppingList, shoppingList } = useContext(ShoppingListContext);
  const { userId } = useAuth();
  const { isSubscribed, triggerPaywall } = useSubscription(); // Add subscription context
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [onlineRecipes, setOnlineRecipes] = useState([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState(null);

  // Food API search states
  const [apiIngredients, setApiIngredients] = useState([]);
  const [ingredientSearchLoading, setIngredientSearchLoading] = useState(false);
  const [ingredientSearchError, setIngredientSearchError] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Barcode scanner states
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Inventory management states
  const [inventorySearch, setInventorySearch] = useState('');
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [inventoryCategory, setInventoryCategory] = useState('all');
  // User meal creation state
  const [userMeals, setUserMeals] = useState([]);
  const [mealDataLoaded, setMealDataLoaded] = useState(false);
  const [mode, setMode] = useState('suggest'); // 'suggest' | 'create'
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState({
    expiring: false,
    suggestions: false,
    inventory: false,
    userMeals: false
  });
  
  // Performance optimization refs
  const flatListRef = useRef(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  // Combine built-in and seeded recipes into a single list
  const allStaticRecipes = useMemo(() => {
    const mergedMap = { ...RECIPE_DATABASE, ...SEEDED_RECIPES };
    return Object.entries(mergedMap).map(([id, r]) => ({ id, ...r }));
  }, []);

  // Memoized available words computation for better performance
  const availableWords = useMemo(() => {
    const words = new Set();
    foodInventory.forEach(item => {
      const name = String(item.name || '').toLowerCase();
      name.split(/\s+/).forEach(w => w && words.add(w));
      if (item.category) words.add(String(item.category).toLowerCase());
    });
    return words;
  }, [foodInventory]);

  // Memoized explore ideas computation
  const exploreIdeas = useMemo(() => {
    return allStaticRecipes
      .map((recipe) => {
        const matchingIngredients = recipe.ingredients.filter(ingredient =>
          Array.from(availableWords).some(word =>
            ingredient.toLowerCase().includes(word) || word.includes(ingredient.toLowerCase())
          )
        );
        const missingIngredients = recipe.ingredients.filter(ingredient => !matchingIngredients.includes(ingredient));
        const matchPercentage = (matchingIngredients.length / recipe.ingredients.length) * 100;
        return {
          id: `explore-${recipe.id}`,
          ...recipe,
          matchingIngredients,
          missingIngredients,
          matchPercentage,
          ingredients: recipe.ingredients
        };
      })
      // Filter by selected main category
      .filter(meal => selectedCategory === 'all' || meal.category === selectedCategory)
      // Filter by selected subcategory if present (supports inferred tags and keywords)
      .filter(meal => recipeMatchesSubcategory(meal, selectedSubcategory))
      // Keep ideas that require a few extras
      .filter(meal => meal.missingIngredients.length > 0 && meal.missingIngredients.length <= 4)
      .sort((a, b) => a.missingIngredients.length - b.missingIngredients.length || b.matchPercentage - a.matchPercentage)
      .slice(0, 5);
  }, [availableWords, allStaticRecipes, selectedCategory, selectedSubcategory]);
  
  // Memoized filtered inventory for better performance
  const filteredInventory = useMemo(() => {
    if (!foodInventory || foodInventory.length === 0) return [];
    
    let filtered = foodInventory.filter(item => {
      // Search filter
      if (inventorySearch.trim()) {
        const query = inventorySearch.toLowerCase();
        if (!item.name.toLowerCase().includes(query) && 
            !(item.category && item.category.toLowerCase().includes(query))) {
          return false;
        }
      }
      // Category filter
      if (inventoryCategory !== 'all') {
        if (!item.category || !item.category.toLowerCase().includes(inventoryCategory.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    // Sort by recently added (newest first) and then alphabetically
    filtered.sort((a, b) => {
      const dateA = new Date(a.dateAdded || 0);
      const dateB = new Date(b.dateAdded || 0);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [foodInventory, inventorySearch, inventoryCategory]);

  // Memoized displayed inventory with show all toggle
  const displayedInventory = useMemo(() => {
    return showAllInventory ? filteredInventory : filteredInventory.slice(0, 10);
  }, [filteredInventory, showAllInventory]);
  const [newMeal, setNewMeal] = useState({
    name: '',
    category: 'breakfast',
    ingredients: [],
    customIngredient: '',
    instructions: '',
    prepTime: '',
    cookTime: '',
    difficulty: 'Easy',
  });
  // Load user meals from AsyncStorage
  useEffect(() => {
    const loadUserMeals = async () => {
      try {
        console.log('Loading user meals - userId:', userId);

        if (userId) {
          // Migrate existing data to user-specific storage
          await migrateToUserStorage(userId, 'userMeals', 'userMeals');
          const stored = await getUserData(userId, 'userMeals', []);
          console.log('Loaded user meals from user storage:', stored.length, 'meals');
          setUserMeals(stored);
        } else {
          const data = await AsyncStorage.getItem('userMeals');
          if (data) {
            const parsed = JSON.parse(data);
            console.log('Loaded user meals from fallback storage:', parsed.length, 'meals');
            setUserMeals(parsed);
          } else {
            console.log('No user meals found in storage');
            setUserMeals([]);
          }
        }
      } catch (error) {
        console.warn('Failed to load user meals:', error);
      } finally {
        setMealDataLoaded(true);
        console.log('✅ Meal data loading completed');
      }
    };
    loadUserMeals();
  }, [userId]);
  
  // Save user meals to AsyncStorage
  useEffect(() => {
    // Don't save during initial loading to prevent overwriting with empty array
    if (!mealDataLoaded) {
      console.log('Skipping meal save - data not yet loaded');
      return;
    }

    console.log('Meal save triggered - userId:', userId, 'userMeals count:', userMeals.length);

    if (userId) {
      setUserData(userId, 'userMeals', userMeals).then(() => {
        console.log('✅ Successfully saved user meals, count:', userMeals.length);
      }).catch(e => {
        console.warn('❌ Failed to save user meals to storage', e);
      });
    } else {
      AsyncStorage.setItem('userMeals', JSON.stringify(userMeals)).then(() => {
        console.log('✅ Successfully saved user meals to fallback storage, count:', userMeals.length);
      }).catch(e => {
        console.warn('❌ Failed to save user meals to storage', e);
      });
    }
  }, [userMeals, userId, mealDataLoaded]);
  // Add new meal
  const handleSaveMeal = () => {
    if (!newMeal.name.trim() || !newMeal.category || newMeal.ingredients.length === 0) {
      Alert.alert('Error', 'Please enter a name, select a category, and add at least one ingredient.');
      return;
    }

    const mealToSave = {
      id: Date.now().toString(),
      ...newMeal,
      ingredients: newMeal.ingredients,
    };

    console.log('Saving new meal:', mealToSave.name, 'with', mealToSave.ingredients.length, 'ingredients');

    setUserMeals(prev => {
      const updatedMeals = [...prev, mealToSave];
      console.log('Updated user meals count:', updatedMeals.length);
      return updatedMeals;
    });
    // Saved inline; no modal
    setNewMeal({
      name: '',
      category: 'breakfast',
      ingredients: [],
      customIngredient: '',
      instructions: '',
      prepTime: '',
      cookTime: '',
      difficulty: 'Easy',
    });
  };
  // Add ingredient from inventory
  const addIngredient = (ingredient) => {
    if (!newMeal.ingredients.includes(ingredient)) {
      setNewMeal(prev => ({ ...prev, ingredients: [...prev.ingredients, ingredient] }));
    }
  };
  // Add custom ingredient
  const addCustomIngredient = () => {
    if (newMeal.customIngredient.trim() && !newMeal.ingredients.includes(newMeal.customIngredient.trim())) {
      setNewMeal(prev => ({ ...prev, ingredients: [...prev.ingredients, prev.customIngredient.trim()], customIngredient: '' }));
    }
  };
  // Helper function to get nutrition grade color
  const getNutritionGradeColor = (grade) => {
    switch (grade?.toLowerCase()) {
      case 'a': return '#00C851';
      case 'b': return '#7CB342';
      case 'c': return '#FFB300';
      case 'd': return '#FF8F00';
      case 'e': return '#FF3547';
      default: return '#9E9E9E';
    }
  };

  // Enhanced filtering with sorting and better performance
  // (Moved to top of component with other memoized values)

  // Get unique categories from inventory
  const inventoryCategories = useMemo(() => {
    const categories = ['all'];
    const categorySet = new Set();

    foodInventory.forEach(item => {
      if (item.category) {
        categorySet.add(item.category.toLowerCase());
      }
    });

    return [...categories, ...Array.from(categorySet).sort()];
  }, [foodInventory]);

  // Remove ingredient
  const removeIngredient = (ingredient) => {
    setNewMeal(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => i !== ingredient) }));
  };

  const theme = getTheme ? getTheme(accentKey, darkMode) : {
    // Fallback theme in case getTheme is not available
    background: darkMode ? '#0F172A' : '#F8FAFC',
    surface: darkMode ? '#1E293B' : '#FFFFFF',
    text: darkMode ? '#F8FAFC' : '#1E293B',
    textSecondary: darkMode ? '#94A3B8' : '#64748B',
    border: darkMode ? '#334155' : '#E2E8F0',
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    overlay: darkMode ? 'rgba(248, 250, 252, 0.05)' : 'rgba(15, 23, 42, 0.05)',
    statusBar: darkMode ? 'light-content' : 'dark-content',
    cardShadow: darkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(15, 23, 42, 0.08)',
  };
  const isDefault = !accentKey || accentKey === 'default';

  // Get items expiring soon (within 3 days or expired)
  const expiringItems = useMemo(() => {
    return foodInventory
      .filter(item => {
        const daysLeft = getDaysUntilExpiry(item.expiry);
        return daysLeft <= 3;
      })
      .sort((a, b) => getDaysUntilExpiry(a.expiry) - getDaysUntilExpiry(b.expiry));
  }, [foodInventory]);

  // Generate meal suggestions based on available ingredients
  const mealSuggestions = useMemo(() => {
    // Build a set of all words in inventory item names and categories
    const availableWords = new Set();
    foodInventory.forEach(item => {
      item.name.toLowerCase().split(/\s+/).forEach(word => availableWords.add(word));
      if (item.category) availableWords.add(item.category.toLowerCase());
    });
    return allStaticRecipes
      .map((recipe) => {
        const { matchingIngredients, missingIngredients, matchPercentage } = computeIngredientMatch(recipe.ingredients, foodInventory);
        return {
          id: recipe.id,
          ...recipe,
          matchingIngredients,
          missingIngredients,
          matchPercentage,
          ingredients: recipe.ingredients
        };
      })
      // Filter by selected main category
      .filter(meal => selectedCategory === 'all' || meal.category === selectedCategory)
      // Filter by selected subcategory if present (supports inferred tags)
      .filter(meal => recipeMatchesSubcategory(meal, selectedSubcategory))
      .filter(meal => {
        if (availableOnly) {
          return meal.missingIngredients.length === 0;
        }
        return true;
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [foodInventory, availableOnly, allStaticRecipes, selectedCategory, selectedSubcategory]);

  // Suggested for You: best matches (>=60%)
  const suggestedMeals = useMemo(() => mealSuggestions.slice(0, 5), [mealSuggestions]);

  // Built-in recipes with missing ingredients calculated
  const builtInRecipes = useMemo(() => {
    const filtered = mealSuggestions.filter(meal => 
      Object.keys(RECIPE_DATABASE).includes(meal.id) || 
      Object.keys(SEEDED_RECIPES).includes(meal.id)
    );
    
    // Debug: Log first recipe to verify missing ingredients are calculated
    if (filtered.length > 0 && filtered[0].missingIngredients) {
      console.log(`Built-in recipe "${filtered[0].name}" has ${filtered[0].missingIngredients.length} missing ingredients:`, filtered[0].missingIngredients);
    }
    
    return filtered;
  }, [mealSuggestions]);

  // Merge user meals with built-in suggestions (web is separate)
  const allMeals = useMemo(() => {
    const userMealObjects = userMeals.map(meal => ({ ...meal, matchingIngredients: [], matchPercentage: 100 }));
    // Do NOT include online recipes here to avoid duplicates below; web items are shown in their own section
    let merged = [...userMealObjects, ...mealSuggestions];
    if (selectedSubcategory) {
      merged = merged.filter(m => recipeMatchesSubcategory(m, selectedSubcategory));
    }
    return merged;
  }, [userMeals, mealSuggestions, onlineRecipes, selectedSubcategory, foodInventory]);

  // Filter meals by category
  const filteredMeals = useMemo(() => {
    let meals = allMeals;
    
    if (selectedCategory !== 'all') {
      meals = meals.filter(meal => meal.category === selectedCategory);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      meals = meals.filter(meal => 
        meal.name.toLowerCase().includes(q) ||
        (Array.isArray(meal.subcategories) && meal.subcategories.some(s => s.toLowerCase().includes(q))) ||
        meal.ingredients.some(ingredient => ingredient.toLowerCase().includes(q))
      );
    }
    // Exclude items already shown in "Suggested for You" (top slice)
    const topIds = new Set(suggestedMeals.map(m => m.id));
    meals = meals.filter(m => !topIds.has(m.id));
    return meals;
  }, [allMeals, selectedCategory, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleUseIngredients = useCallback((ingredients) => {
    Alert.alert(
      'Use Ingredients',
      'Would you like to mark these ingredients as used? This will reduce their quantity in your inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Ingredients',
          onPress: () => {
            setFoodInventory(prev => prev.map(item => {
              const itemName = item.name.toLowerCase();
              const isUsed = ingredients.some(ingredient => 
                itemName.includes(ingredient.toLowerCase()) || 
                ingredient.toLowerCase().includes(itemName.split(' ')[0])
              );
              
              if (isUsed && item.quantity > 1) {
                return { ...item, quantity: item.quantity - 1 };
              } else if (isUsed && item.quantity === 1) {
                return null; // Remove item if quantity becomes 0
              }
              return item;
            }).filter(Boolean)); // Remove null items
            
            Alert.alert('Success', 'Ingredients have been marked as used!');
          }
        }
      ]
    );
  }, [setFoodInventory]);

  // Assistant suggestions (optional if backend available)
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      setAiAvailable(res.ok);
    } catch (_) {
      setAiAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  // Fetch external recipes via backend proxy (no API keys needed) with client-side fallback
  const fetchOnlineRecipes = useCallback(async () => {
    // Check if user is subscribed before allowing access to online recipes
    if (!isSubscribed) {
      triggerPaywall();
      return;
    }
    
    const timeoutMs = 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Helper: map TheMealDB meal to our recipe shape
    const mapMealDbToRecipe = (meal) => {
      const ingredients = [];
      for (let i = 1; i <= 20; i++) {
        const ing = meal[`strIngredient${i}`];
        if (ing && ing.trim()) ingredients.push(ing.trim());
      }
      const category = (meal.strCategory || '').toLowerCase();
      
      // Create a subset of ingredients to use as "missing" for the shopping list functionality
      // This ensures the "Add missing" button always appears
      const missingIngredients = ingredients.length > 0 ? 
        ingredients.slice(0, Math.min(3, ingredients.length)) : 
        ['ingredient 1', 'ingredient 2', 'ingredient 3'];
      
      return {
        id: `mealdb-${meal.idMeal}`,
        name: meal.strMeal || 'Recipe',
        category: category === 'breakfast' ? 'breakfast' : (['lunch', 'side'].includes(category) ? 'lunch' : (category === 'dessert' ? 'snack' : 'dinner')),
        subcategories: [],
        ingredients,
        missingIngredients, // Add missing ingredients
        matchingIngredients: [], // Empty array for matching ingredients
        matchPercentage: 0, // Default match percentage
        instructions: meal.strInstructions || '',
        prepTime: '15 min',
        cookTime: '20 min',
        difficulty: 'Easy',
        imageUrl: meal.strMealThumb || null,
        source: 'themealdb.com',
        url: meal.strSource || null,
      };
    };

    // Enhanced subcategory search logic with broader terms for problematic categories
    const getSearchTermsForSubcategory = (subcategory, category) => {
      if (!subcategory) return [];
      
      // Use more generic search terms for problematic categories
      const searchMap = {
        // Breakfast subcategories - broadened terms
        'sweet': ['pancake', 'waffle', 'french toast', 'muffin', 'sweet', 'syrup', 'honey', 'pastry', 'breakfast cake', 'cinnamon roll', 'donut'],
        'savory': ['egg', 'bacon', 'sausage', 'toast', 'omelet', 'cheese', 'avocado', 'breakfast burrito', 'breakfast sandwich', 'hash'],
        'high-protein': ['egg', 'protein', 'greek yogurt', 'quinoa', 'cottage cheese', 'protein breakfast', 'omelette', 'frittata'],
        'overnight': ['overnight', 'chia', 'pudding', 'oats', 'breakfast jar', 'make ahead breakfast'],
        '5-ingredients': ['simple', 'easy', 'quick', 'minimal', 'basic', '5 ingredient', 'easy breakfast'],
        
        // Lunch subcategories - broadened terms
        'sandwich': ['sandwich', 'wrap', 'panini', 'sub', 'club', 'grilled cheese', 'burger', 'toast'],
        'salad': ['salad', 'caesar', 'greek', 'cobb', 'spinach', 'lettuce', 'bowl', 'vegetable salad'],
        'soup': ['soup', 'broth', 'bisque', 'chowder', 'stew', 'tomato soup', 'chicken soup'],
        'meal-prep': ['meal prep', 'bowl', 'prep', 'batch', 'make ahead', 'lunch box', 'bento'],
        'vegetarian': ['vegetarian', 'veggie', 'plant', 'beans', 'lentils', 'tofu', 'meatless', 'vegan'],
        
        // Dinner subcategories - broadened terms
        'one-pot': ['one pot', 'skillet', 'casserole', 'stew', 'dutch oven', 'one pan', 'sheet pan', 'easy dinner'],
        'chicken': ['chicken', 'poultry', 'breast', 'thigh', 'wings', 'roast chicken', 'grilled chicken'],
        'pasta': ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'noodles', 'macaroni'],
        'quick': ['quick', 'fast', '30 minute', 'easy', '15 minute', 'speedy', 'weeknight', 'simple dinner'],
        
        // Snack subcategories - broadened terms
        'chocolatey': ['chocolate', 'brownie', 'cocoa', 'fudge', 'chocolate chip', 'truffle', 'chocolate bar'],
        'healthy': ['healthy', 'fruit', 'nuts', 'yogurt', 'smoothie', 'granola', 'berries', 'protein snack'],
        'savory': ['savory', 'cheese', 'crackers', 'nuts', 'chips', 'popcorn', 'hummus', 'dip', 'pretzels'],
        'no-bake': ['no bake', 'refrigerator', 'chilled', 'frozen', 'parfait', 'energy balls', 'no cook'],
      };
      
      // Get category-specific terms
      let terms = searchMap[subcategory.toLowerCase()] || [];
      
      // Add the subcategory itself
      terms.push(subcategory.toLowerCase());
      
      // Add more generic terms for problematic categories
      if (category && category !== 'all') {
        // Add category context
        terms.push(`${subcategory.toLowerCase()} ${category}`);
        
        // Add more generic search terms based on category
        switch(category) {
          case 'breakfast':
            terms.push('breakfast', 'morning meal', 'brunch');
            break;
          case 'lunch':
            terms.push('lunch', 'midday meal', 'light meal');
            break;
          case 'dinner':
            terms.push('dinner', 'main course', 'main dish', 'entree');
            break;
          case 'snack':
            terms.push('snack', 'appetizer', 'treat', 'finger food');
            break;
        }
      }
      
      // For problematic categories, add even more generic terms
      if (['sweet', 'savory', 'overnight', '5-ingredients', 'meal-prep', 'one-pot', 'quick', 'healthy', 'no-bake'].includes(subcategory.toLowerCase())) {
        terms.push('recipe', 'food', 'cooking', 'homemade', 'easy recipe');
      }
      
      // Remove duplicates
      return [...new Set(terms)];
    };

    const getCategoryForSubcategory = (subcategory, category) => {
      if (!subcategory) return null;
      
      // TheMealDB categories: Beef, Breakfast, Chicken, Dessert, Goat, Lamb, Miscellaneous, 
      // Pasta, Pork, Seafood, Side, Starter, Vegan, Vegetarian
      
      // For problematic subcategories, we'll return null to force the search to use terms instead of category filtering
      const problematicSubcategories = [
        'sweet', 'savory', 'overnight', '5-ingredients', 
        'meal-prep', 'one-pot', 'quick', 'healthy', 'no-bake'
      ];
      
      if (problematicSubcategories.includes(subcategory.toLowerCase())) {
        return null; // Skip category filtering for problematic subcategories
      }
      
      const categoryMap = {
        // Map subcategories to TheMealDB categories
        // Breakfast subcategories
        'sweet': category === 'breakfast' ? 'Breakfast' : 'Dessert',
        'savory': category === 'breakfast' ? 'Breakfast' : 'Miscellaneous',
        'high-protein': category === 'breakfast' ? 'Breakfast' : 'Chicken',
        'overnight': 'Breakfast',
        '5-ingredients': category === 'breakfast' ? 'Breakfast' : 'Miscellaneous',
        
        // Lunch subcategories
        'sandwich': 'Miscellaneous',
        'salad': 'Side',
        'soup': 'Side',
        'meal-prep': 'Miscellaneous',
        'vegetarian': 'Vegetarian',
        
        // Dinner subcategories
        'one-pot': category === 'dinner' ? 'Beef' : 'Miscellaneous',
        'chicken': 'Chicken',
        'pasta': 'Pasta',
        'quick': category === 'dinner' ? 'Chicken' : 'Miscellaneous',
        
        // Snack subcategories
        'chocolatey': 'Dessert',
        'healthy': category === 'snack' ? 'Dessert' : 'Vegetarian',
        'savory': category === 'snack' ? 'Side' : 'Miscellaneous',
        'no-bake': 'Dessert',
      };
      
      // Get the mapped category or use a default based on the main category
      const defaultCategoryMap = {
        'breakfast': 'Breakfast',
        'lunch': 'Miscellaneous',
        'dinner': 'Beef',
        'snack': 'Dessert',
      };
      
      return categoryMap[subcategory.toLowerCase()] || defaultCategoryMap[category] || 'Miscellaneous';
    };

    const matchesSubcategoryContent = (recipe, subcategory) => {
      if (!subcategory) return true;
      
      const name = recipe.name ? recipe.name.toLowerCase() : '';
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.map(i => String(i || '').toLowerCase()) : [];
      
      switch (subcategory.toLowerCase()) {
        case 'sweet':
          return ingredients.some(ing => ['sugar', 'honey', 'syrup', 'chocolate', 'fruit', 'berries', 'maple'].some(s => ing.includes(s))) ||
                 ['sweet', 'dessert', 'cake', 'cookie', 'pancake', 'waffle'].some(s => name.includes(s));
        
        case 'savory':
          if (recipe.category === 'snack') {
            return ingredients.some(ing => ['cheese', 'salt', 'pepper', 'garlic', 'onion', 'nuts', 'crackers'].some(s => ing.includes(s))) ||
                   ['cheese', 'crackers', 'chips', 'nuts', 'popcorn'].some(s => name.includes(s));
          } else {
            return ingredients.some(ing => ['salt', 'pepper', 'garlic', 'onion', 'cheese', 'egg', 'bacon'].some(s => ing.includes(s))) &&
                   !ingredients.some(ing => ['sugar', 'honey', 'syrup'].some(sw => ing.includes(sw)));
          }
        
        case 'overnight':
          return ['overnight', 'chia', 'pudding', 'bread pudding'].some(o => name.includes(o)) ||
                 ingredients.some(ing => ['oats', 'chia', 'pudding'].some(o => ing.includes(o)));
        
        case '5-ingredients':
          return ingredients.length <= 5 ||
                 ['simple', 'easy', 'quick', 'minimal', 'basic'].some(fi => name.includes(fi));
        
        case 'sandwich':
          return ['sandwich', 'wrap', 'panini', 'sub', 'club', 'grilled'].some(s => name.includes(s)) ||
                 ingredients.some(ing => ['bread', 'wrap', 'bun', 'roll', 'tortilla'].some(s => ing.includes(s)));
        
        case 'salad':
          return ['salad', 'caesar', 'greek', 'cobb', 'spinach'].some(s => name.includes(s)) ||
                 ingredients.some(ing => ['lettuce', 'spinach', 'arugula', 'greens', 'tomato'].some(s => ing.includes(s)));
        
        case 'vegetarian':
          return !ingredients.some(ing => ['chicken', 'beef', 'pork', 'fish', 'meat', 'bacon', 'sausage', 'ham'].some(m => ing.includes(m))) ||
                 ['vegetarian', 'veggie', 'bean', 'lentil'].some(v => name.includes(v));
        
        case 'meal-prep':
          return ['bowl', 'prep', 'container', 'batch', 'make ahead'].some(mp => name.includes(mp)) ||
                 ingredients.some(ing => ['rice', 'quinoa', 'beans', 'chicken'].some(mp => ing.includes(mp)));
        
        case 'one-pot':
          return ['one pot', 'skillet', 'casserole', 'stew', 'dutch oven', 'one pan'].some(op => name.includes(op)) ||
                 ingredients.some(ing => ['broth', 'stock'].some(op => ing.includes(op)));
        
        case 'quick':
          return ['quick', 'fast', 'easy', '15 min', '20 min', '30 min', 'speedy', 'rapid'].some(q => name.includes(q)) ||
                 ingredients.length <= 6; // Assume fewer ingredients = quicker
        
        case 'healthy':
          return ingredients.some(ing => ['fruit', 'vegetable', 'yogurt', 'oat', 'quinoa', 'avocado', 'berries', 'nuts', 'apple', 'banana'].some(h => ing.includes(h))) ||
                 ['healthy', 'fresh', 'natural', 'wholesome', 'apple', 'fruit'].some(h => name.includes(h));
        
        case 'no-bake':
          return ['no bake', 'refrigerator', 'chilled', 'frozen', 'parfait', 'energy balls'].some(nb => name.includes(nb)) ||
                 ingredients.some(ing => ['pudding', 'yogurt', 'cream', 'peanut butter'].some(nb => ing.includes(nb)));
        
        case 'chocolatey':
          return ingredients.some(ing => ['chocolate', 'cocoa', 'cacao'].some(c => ing.includes(c))) ||
                 ['chocolate', 'cocoa', 'brownie', 'fudge'].some(c => name.includes(c));
        
        case 'high-protein':
          return ingredients.some(ing => ['egg', 'chicken', 'protein', 'greek yogurt', 'quinoa', 'beans', 'cottage cheese', 'tofu'].some(p => ing.includes(p))) ||
                 ['protein', 'high protein'].some(p => name.includes(p));
        
        case 'soup':
          return ['soup', 'broth', 'bisque', 'chowder', 'stew'].some(s => name.includes(s)) ||
                 ingredients.some(ing => ['broth', 'stock'].some(s => ing.includes(s)));
        
        case 'chicken':
          return ingredients.some(ing => ['chicken', 'poultry', 'breast', 'thigh', 'wings'].some(c => ing.includes(c))) ||
                 ['chicken', 'poultry', 'breast', 'thigh', 'wings'].some(c => name.includes(c));
        
        case 'pasta':
          return ingredients.some(ing => ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'noodles'].some(p => ing.includes(p))) ||
                 ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'noodles'].some(p => name.includes(p));
        
        default:
          // For any other subcategory, check if the name or ingredients contain the subcategory term
          return name.includes(subcategory.toLowerCase()) || 
                 ingredients.some(ing => ing.includes(subcategory.toLowerCase()));
      }
    };

    try {
      setOnlineLoading(true);
      setOnlineError(null);
      const params = new URLSearchParams();
      // Provide a sensible default when category is 'all' and no search
      const effectiveCategory = selectedCategory !== 'all' ? selectedCategory : (searchQuery ? '' : 'dinner');
      if (effectiveCategory) params.set('category', effectiveCategory);
      if (selectedSubcategory) params.set('subcategory', selectedSubcategory);
      if (searchQuery) params.set('q', searchQuery);
      const ingredientNames = Array.from(new Set((foodInventory || []).map(i => String(i.name || '').toLowerCase()))).slice(0, 10);
      if (ingredientNames.length > 0) params.set('ingredients', ingredientNames.join(','));
      params.set('limit', '12');
      
      // 1) Try backend
      const url = `${API_BASE_URL}/api/recipes/search?${params.toString()}`;
      console.log('Fetching online recipes from:', url);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const errorMessage = `Backend recipe search failed with status ${res.status}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
        const data = await res.json();
        const rows = Array.isArray(data.recipes) ? data.recipes : [];
        const enriched = rows.map(r => {
          const { matchingIngredients, missingIngredients, matchPercentage } = computeIngredientMatch(r.ingredients || [], foodInventory);
          return { ...r, matchingIngredients, missingIngredients, matchPercentage, ingredients: r.ingredients || [] };
        });
        // Apply client-side filters so UI reflects current selections
        let filtered = enriched;
        if (selectedCategory !== 'all') {
          filtered = filtered.filter(m => m.category === selectedCategory);
        }
        if (selectedSubcategory) {
          filtered = filtered.filter(m => recipeMatchesSubcategory(m, selectedSubcategory));
        }
        setOnlineRecipes(filtered);
        return; // success
      } catch (backendErr) {
        console.warn('Backend unavailable or error, falling back to TheMealDB:', backendErr.message);
        // 2) Fallback to TheMealDB directly
        let results = [];
        
        // Enhanced search logic for all subcategories
        if (selectedSubcategory) {
          const searchTerms = getSearchTermsForSubcategory(selectedSubcategory, selectedCategory);
          const categoryFilter = getCategoryForSubcategory(selectedSubcategory, selectedCategory);
          const isProblematicSubcategory = ['sweet', 'savory', 'overnight', '5-ingredients', 'meal-prep', 'one-pot', 'quick', 'healthy', 'no-bake'].includes(selectedSubcategory.toLowerCase());
          
          // For problematic subcategories, try a more aggressive approach
          if (isProblematicSubcategory) {
            // First try to get recipes by category
            const categoryToUse = selectedCategory === 'breakfast' ? 'Breakfast' : 
                                 selectedCategory === 'lunch' ? 'Miscellaneous' : 
                                 selectedCategory === 'dinner' ? 'Beef' : 'Dessert';
            
            try {
              const lr = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(categoryToUse)}`, { signal: controller.signal });
              const lj = await lr.json();
              if (lj.meals) {
                // Get a good number of recipes from this category
                const categoryIds = lj.meals.slice(0, 20).map(m => m.idMeal);
                for (const id of categoryIds) {
                  if (results.length >= 12) break;
                  try {
                    const dr = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`, { signal: controller.signal });
                    const dj = await dr.json();
                    const meal = dj.meals && dj.meals[0];
                    if (meal) {
                      const recipe = mapMealDbToRecipe(meal);
                      
                      // Force the category to match the selected category
                      if (selectedCategory !== 'all') {
                        recipe.category = selectedCategory;
                      }
                      
                      // Add the subcategory to the recipe
                      recipe.subcategories = recipe.subcategories || [];
                      if (!recipe.subcategories.includes(selectedSubcategory)) {
                        recipe.subcategories.push(selectedSubcategory);
                      }
                      
                      // Add missing ingredients for shopping list functionality
                      if (!recipe.missingIngredients) {
                        recipe.missingIngredients = recipe.ingredients.slice(0, 3);
                      }
                      
                      // Only add if not a duplicate
                      if (!results.some(existing => existing.name.toLowerCase() === recipe.name.toLowerCase())) {
                        results.push(recipe);
                      }
                    }
                  } catch {}
                }
              }
            } catch (catErr) {
              console.warn(`TheMealDB category fetch failed:`, catErr.message);
            }
          }
          
          // Try searching by terms if we still need more results
          if (results.length < 12) {
            for (const term of searchTerms) {
              if (results.length >= 12) break;
              try {
                const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`, { signal: controller.signal });
                const j = await r.json();
                if (j.meals) {
                  j.meals.forEach(meal => {
                    const recipe = mapMealDbToRecipe(meal);
                    // For problematic subcategories, be more lenient with matching
                    const matchesContent = isProblematicSubcategory ? true : matchesSubcategoryContent(recipe, selectedSubcategory);
                    
                    // Avoid duplicates and check content relevance
                    if (!results.some(existing => existing.name.toLowerCase() === recipe.name.toLowerCase()) && matchesContent) {
                      // For problematic subcategories, force the category to match the selected category
                      if (isProblematicSubcategory && selectedCategory !== 'all') {
                        recipe.category = selectedCategory;
                      }
                      
                      // Add the subcategory to the recipe
                      recipe.subcategories = recipe.subcategories || [];
                      if (!recipe.subcategories.includes(selectedSubcategory)) {
                        recipe.subcategories.push(selectedSubcategory);
                      }
                      
                      // Add missing ingredients for shopping list functionality
                      if (!recipe.missingIngredients) {
                        recipe.missingIngredients = recipe.ingredients.slice(0, 3);
                      }
                      
                      results.push(recipe);
                    }
                  });
                }
              } catch (termErr) {
                console.warn(`TheMealDB search for ${term} failed:`, termErr.message);
              }
            }
          }
          
          // If still need more results, try random recipes
          if (results.length < 6) {
            try {
              // Try to get some random recipes as fallback
              for (let i = 0; i < 8; i++) {
                if (results.length >= 12) break;
                try {
                  const rr = await fetch('https://www.themealdb.com/api/json/v1/1/random.php', { signal: controller.signal });
                  const rj = await rr.json();
                  if (rj.meals && rj.meals[0]) {
                    const recipe = mapMealDbToRecipe(rj.meals[0]);
                    // For problematic subcategories, be more lenient
                    if (!results.some(existing => existing.name.toLowerCase() === recipe.name.toLowerCase())) {
                      // Force the category to match the selected category
                      if (selectedCategory !== 'all') {
                        recipe.category = selectedCategory;
                      }
                      
                      // Add the subcategory to the recipe
                      recipe.subcategories = recipe.subcategories || [];
                      if (!recipe.subcategories.includes(selectedSubcategory)) {
                        recipe.subcategories.push(selectedSubcategory);
                      }
                      
                      // Add missing ingredients for shopping list functionality
                      if (!recipe.missingIngredients) {
                        recipe.missingIngredients = recipe.ingredients.slice(0, 3);
                      }
                      
                      results.push(recipe);
                    }
                  }
                } catch {}
              }
            } catch (randomErr) {
              console.warn('Random recipe fetch failed:', randomErr.message);
            }
          }
          
          // If still need more results, try category filter
          if (results.length < 6 && categoryFilter) {
            try {
              const lr = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(categoryFilter)}`, { signal: controller.signal });
              const lj = await lr.json();
              if (lj.meals) {
                const categoryIds = lj.meals.slice(0, 10).map(m => m.idMeal);
                for (const id of categoryIds) {
                  if (results.length >= 12) break;
                  try {
                    const dr = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`, { signal: controller.signal });
                    const dj = await dr.json();
                    const meal = dj.meals && dj.meals[0];
                    if (meal) {
                      const recipe = mapMealDbToRecipe(meal);
                      // For problematic subcategories, be more lenient with matching
                      const matchesContent = isProblematicSubcategory ? true : matchesSubcategoryContent(recipe, selectedSubcategory);
                      
                      // Only include if it matches subcategory content and isn't duplicate
                      if (matchesContent && !results.some(existing => existing.name.toLowerCase() === recipe.name.toLowerCase())) {
                        // For problematic subcategories, force the category to match the selected category
                        if (isProblematicSubcategory && selectedCategory !== 'all') {
                          recipe.category = selectedCategory;
                        }
                        
                        // Add the subcategory to the recipe
                        recipe.subcategories = recipe.subcategories || [];
                        if (!recipe.subcategories.includes(selectedSubcategory)) {
                          recipe.subcategories.push(selectedSubcategory);
                        }
                        
                        // Add missing ingredients for shopping list functionality
                        if (!recipe.missingIngredients) {
                          recipe.missingIngredients = recipe.ingredients.slice(0, 3);
                        }
                        
                        results.push(recipe);
                      }
                    }
                  } catch {}
                }
              }
            } catch (catErr) {
              console.warn(`TheMealDB ${categoryFilter} category fetch failed:`, catErr.message);
            }
          }
        } else {
          // Original logic for non-subcategory searches
          const term = (params.get('q') || params.get('category') || '').trim();
          if (term) {
            try {
              const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`, { signal: controller.signal });
              const j = await r.json();
              if (j.meals) results = j.meals.slice(0, 12).map(mapMealDbToRecipe);
            } catch (mealDbErr) {
              console.warn('TheMealDB search failed:', mealDbErr.message);
            }
          }
          if (results.length === 0 && params.get('category')) {
            const catMap = { breakfast: 'Breakfast', snack: 'Dessert', lunch: 'Pasta', dinner: 'Beef' };
            const mapped = catMap[String(params.get('category')).toLowerCase()] || 'Beef';
            try {
              const lr = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(mapped)}`, { signal: controller.signal });
              const lj = await lr.json();
              if (lj.meals) {
                const detailIds = lj.meals.slice(0, 12).map(m => m.idMeal);
                for (const id of detailIds) {
                  if (results.length >= 12) break;
                  try {
                    const dr = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`, { signal: controller.signal });
                    const dj = await dr.json();
                    const meal = dj.meals && dj.meals[0];
                    if (meal) results.push(mapMealDbToRecipe(meal));
                  } catch {}
                }
              }
            } catch (catErr) {
              console.warn('TheMealDB category fetch failed:', catErr.message);
            }
          }
        }
        
        if (results.length > 0) {
          const enriched = results.map(r => {
            const { matchingIngredients, missingIngredients, matchPercentage } = computeIngredientMatch(r.ingredients || [], foodInventory);
            return { ...r, matchingIngredients, missingIngredients, matchPercentage, ingredients: r.ingredients || [] };
          });
          // Apply client-side filters so UI reflects current selections
          let filtered = enriched;
          if (selectedCategory !== 'all') {
            filtered = filtered.filter(m => m.category === selectedCategory);
          }
          if (selectedSubcategory) {
            filtered = filtered.filter(m => recipeMatchesSubcategory(m, selectedSubcategory));
          }
          setOnlineRecipes(filtered);
          // Hide fallback note from users; log to console only
          console.warn('Using client-side recipe fallback due to backend issue:', backendErr?.message || 'unknown');
          return;
        }
        throw backendErr; // rethrow if fallback empty
      }
    } catch (e) {
      console.error('Failed to load online recipes:', e);
      let errorMessage = 'Failed to load online recipes';
      if (e.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (e.message && e.message.includes('Network request failed')) {
        errorMessage = 'Unable to connect to recipe service. Check connection or backend.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      setOnlineError(errorMessage);
      setOnlineRecipes([]);
    } finally {
      clearTimeout(timer);
      setOnlineLoading(false);
    }
  }, [API_BASE_URL, selectedCategory, selectedSubcategory, searchQuery, foodInventory]);

  const fetchAiSuggestions = useCallback(async () => {
    // Check if user is subscribed before allowing access to AI suggestions
    if (!isSubscribed) {
      triggerPaywall();
      return;
    }
    
    try {
      if (!aiAvailable) return;
      setAiLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/meal-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', inventory: foodInventory })
      });
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (e) {
      // Ignore if unavailable
    } finally {
      setAiLoading(false);
    }
  }, [foodInventory, aiAvailable]);

  // Search for ingredients using Open Food Facts API
  const searchIngredients = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setApiIngredients([]);
      return;
    }

    try {
      setIngredientSearchLoading(true);
      setIngredientSearchError(null);

      // Use Open Food Facts search API
      const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,categories,nutrition_grades,nutriments,image_url,code`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.products && Array.isArray(data.products)) {
        // Transform API results to our ingredient format
        const ingredients = data.products
          .filter(product => product.product_name && product.product_name.trim())
          .slice(0, 10) // Limit to 10 results
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
            source: 'api',
            isApiResult: true
          }));

        setApiIngredients(ingredients);
      } else {
        setApiIngredients([]);
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
      setIngredientSearchError(error.message);
      setApiIngredients([]);
    } finally {
      setIngredientSearchLoading(false);
    }
  }, []);

  // Debounced search function with better performance
  const debouncedSearchIngredients = useCallback((query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchIngredients(query);
    }, 800); // Increased to 800ms to reduce API calls

    setSearchTimeout(timeout);
  }, [searchIngredients, searchTimeout]);
  
  // Collapsible section toggle function
  const toggleSection = useCallback((section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
    Haptics.selectionAsync();
  }, []);
  
  // Enhanced meal planner integration
  const handlePlanMeal = useCallback((meal) => {
    // Make sure the recipe is in the format expected by MealPlanner
    const recipe = {
      ...meal,
      id: meal.id || Date.now().toString(),
      name: meal.name || 'Recipe',
      category: meal.category || 'dinner',
      prepTime: typeof meal.prepTime === 'number' ? meal.prepTime : parseInt(String(meal.prepTime).replace(/\D/g, '') || '10', 10),
      cookTime: typeof meal.cookTime === 'number' ? meal.cookTime : parseInt(String(meal.cookTime).replace(/\D/g, '') || '20', 10),
      servings: meal.servings || 2,
      inventoryMatch: meal.matchPercentage || 0
    };
    
    // Navigate to meal planner with the selected recipe
    navigation.navigate('Meal Planner', { 
      recipe: recipe,
      autoSelectMode: true 
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [navigation]);
  
  // Smart meal planning with date suggestions
  const handleSmartPlanMeal = useCallback((meal) => {
    // Check if user is subscribed before allowing smart meal planning
    if (!isSubscribed) {
      triggerPaywall();
      return;
    }
    
    // Normalize the recipe for meal planner
    const normalizedRecipe = {
      id: meal.id || Date.now().toString(),
      name: meal.name || 'Recipe',
      category: meal.category || 'dinner',
      prepTime: meal.prepTime || '10 min',
      cookTime: meal.cookTime || '20 min',
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      instructions: meal.instructions || '',
      difficulty: meal.difficulty || 'Easy',
      subcategories: meal.subcategories || [],
      servings: 2,
      matchPercentage: meal.matchPercentage || 0
    };
    
    // Show planning options modal
    Alert.alert(
      'Plan This Meal',
      'When would you like to have this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Today', onPress: () => handlePlanMealForDate(normalizedRecipe, new Date()) },
        { text: 'Tomorrow', onPress: () => handlePlanMealForDate(normalizedRecipe, new Date(Date.now() + 24 * 60 * 60 * 1000)) },
        { text: 'Choose Date', onPress: () => handlePlanMeal(normalizedRecipe) }
      ]
    );
  }, [handlePlanMealForDate, handlePlanMeal, isSubscribed, triggerPaywall]);
  
  const handlePlanMealForDate = useCallback((meal, date) => {
    // Make sure the recipe is in the format expected by MealPlanner
    const recipe = {
      ...meal,
      id: meal.id || Date.now().toString(),
      name: meal.name || 'Recipe',
      category: meal.category || 'dinner',
      prepTime: typeof meal.prepTime === 'number' ? meal.prepTime : parseInt(String(meal.prepTime).replace(/\D/g, '') || '10', 10),
      cookTime: typeof meal.cookTime === 'number' ? meal.cookTime : parseInt(String(meal.cookTime).replace(/\D/g, '') || '20', 10),
      servings: meal.servings || 2,
      inventoryMatch: meal.matchPercentage || 0
    };
    
    // Navigate with specific date
    navigation.navigate('Meal Planner', { 
      recipe: recipe,
      selectedDate: date,
      autoSelectMode: true 
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [navigation]);

  // Barcode scanning functions
  const fetchProductInfoFromBarcode = async (barcode) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      if (data.status === 1 && data.product) {
        return {
          id: `barcode-${barcode}-${Date.now()}`,
          name: data.product.product_name || 'Unknown Product',
          brand: data.product.brands || '',
          category: data.product.categories ? data.product.categories.split(',')[0] : 'Food',
          calories: data.product.nutriments?.['energy-kcal_100g'] || data.product.nutriments?.['energy-kcal'] || 0,
          protein: data.product.nutriments?.proteins_100g || data.product.nutriments?.proteins || 0,
          carbs: data.product.nutriments?.carbohydrates_100g || data.product.nutriments?.carbohydrates || 0,
          fat: data.product.nutriments?.fat_100g || data.product.nutriments?.fat || 0,
          fiber: data.product.nutriments?.fiber_100g || data.product.nutriments?.fiber || 0,
          serving: '100g',
          nutrition_grade: data.product.nutrition_grades || '',
          image_url: data.product.image_url || null,
          barcode: barcode,
          source: 'barcode',
          isApiResult: true
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching product from barcode:', error);
      return null;
    }
  };

  const handleBarcodeScanned = useCallback((product) => {
    // Check if user is subscribed before allowing barcode scanning
    if (!isSubscribed) {
      triggerPaywall();
      return;
    }
    
    try {
      setScannerLoading(true);

      if (product && product.name) {
        const ingredientName = `${product.name}${product.brand ? ` (${product.brand})` : ''}`;
        addIngredient(ingredientName);
        Alert.alert('Product Scanned!', `Added "${ingredientName}" to your meal ingredients.`, [{ text: 'OK' }]);
      } else if (product && product.barcode) {
        // Fallback: if only barcode is provided, fetch details
        (async () => {
          const fetched = await fetchProductInfoFromBarcode(product.barcode);
          if (fetched) {
            const ingredientName = `${fetched.name}${fetched.brand ? ` (${fetched.brand})` : ''}`;
            addIngredient(ingredientName);
            Alert.alert('Product Scanned!', `Added "${ingredientName}" to your meal ingredients.`, [{ text: 'OK' }]);
          } else {
            Alert.alert('Product Not Found', 'Could not find product information for this barcode. You can add it manually.', [{ text: 'OK' }]);
          }
        })();
      } else {
        Alert.alert('Scan Failed', 'Could not read the scanned product. Try again.');
      }
    } catch (error) {
      console.error('Error handling barcode scan:', error);
      Alert.alert('Error', 'Failed to process barcode. Please try again.');
    } finally {
      setScannerLoading(false);
    }
    // Note: Don't close the scanner here - let the modal handle its own closing
  }, [addIngredient, isSubscribed, triggerPaywall]);

  // Auto-fetch AI suggestions on load and when inventory changes
  useEffect(() => {
    const t = setTimeout(() => { fetchAiSuggestions(); }, 250);
    return () => clearTimeout(t);
  }, [fetchAiSuggestions]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Reset subcategory when main changes
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [selectedCategory]);

  // Refresh online recipes when filters change
  useEffect(() => {
    fetchOnlineRecipes();
  }, [fetchOnlineRecipes]);

  const renderCategoryFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.categoryFilter}
      contentContainerStyle={styles.categoryFilterContent}
    >
      <TouchableOpacity
        style={[
          styles.categoryButton,
          selectedCategory === 'all' && { backgroundColor: theme.primary }
        ]}
        onPress={() => setSelectedCategory('all')}
      >
        <Text style={[
          styles.categoryButtonText,
          { color: selectedCategory === 'all' ? 'white' : theme.text }
        ]}>
          All
        </Text>
      </TouchableOpacity>
      
      {Object.entries(MEAL_CATEGORIES).map(([key, category]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.categoryButton,
            selectedCategory === key && { backgroundColor: theme.primary }
          ]}
          onPress={() => setSelectedCategory(key)}
        >
          <MaterialCommunityIcons 
            name={category.icon} 
            size={16} 
            color={selectedCategory === key ? 'white' : theme.textSecondary} 
          />
          <Text style={[
            styles.categoryButtonText,
            { color: selectedCategory === key ? 'white' : theme.text }
          ]}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Available only toggle */}
      <TouchableOpacity
        style={[styles.categoryButton, availableOnly && { backgroundColor: theme.success, borderColor: theme.success }]}
        onPress={() => setAvailableOnly(v => !v)}
      >
        <MaterialCommunityIcons name={availableOnly ? 'checkbox-marked-circle-outline' : 'checkbox-blank-circle-outline'} size={16} color={availableOnly ? 'white' : theme.textSecondary} />
        <Text style={[styles.categoryButtonText, { color: availableOnly ? 'white' : theme.text }]}>Available only</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderExpiringItems = () => (
    <CollapsibleSection
      title="Items Expiring Soon"
      icon="alert-circle"
      isCollapsed={collapsedSections.expiring}
      onToggle={() => toggleSection('expiring')}
      theme={theme}
      count={expiringItems.length}
      badge={expiringItems.length > 0 ? { color: theme.warning, text: 'Urgent' } : null}
    >
      {expiringItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {expiringItems.map(item => (
            <ExpiringItemCard
              key={item.id}
              item={item}
              onPress={() => {
                // Could show item details or suggest recipes
                Alert.alert('Item Details', `${item.name}\nExpires: ${formatDate(item.expiry)}\nQuantity: ${item.quantity}`);
              }}
              theme={theme}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-circle" size={48} color={theme.success} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            No items expiring soon!
          </Text>
        </View>
      )}
    </CollapsibleSection>
  );

  // Secondary subcategory filter and online browse section
  const renderSubcategoryFilter = () => {
    if (selectedCategory === 'all') return null;
    const subs = SUBCATEGORIES[selectedCategory] || [];
    if (subs.length === 0) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <TouchableOpacity
          style={[styles.categoryButton, !selectedSubcategory && { backgroundColor: theme.primary }]}
          onPress={() => setSelectedSubcategory(null)}
        >
          <Text style={[styles.categoryButtonText, { color: !selectedSubcategory ? '#fff' : theme.text }]}>All styles</Text>
        </TouchableOpacity>
        {subs.map(sub => (
          <TouchableOpacity
            key={sub}
            style={[styles.categoryButton, selectedSubcategory === sub && { backgroundColor: theme.primary }]}
            onPress={() => setSelectedSubcategory(sub)}
          >
            <Text style={[styles.categoryButtonText, { color: selectedSubcategory === sub ? '#fff' : theme.text }]}>
              {sub.replace(/\b(\w)/g, c => c.toUpperCase())}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const OnlineLinkCard = ({ link }) => (
    <TouchableOpacity
      onPress={async () => {
        try { await Linking.openURL(link.url); } catch { Alert.alert('Unable to open link'); }
      }}
      style={[styles.mealCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      activeOpacity={0.8}
    >
      <View style={styles.mealCardHeader}>
        <View style={[styles.categoryIcon, { backgroundColor: theme.primary }]}>
          <MaterialCommunityIcons name="link-variant" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mealName, { color: theme.text }]}>
            {link.title}
          </Text>
          <Text style={[styles.mealCategory, { color: theme.textSecondary }]}>
            {link.source}
          </Text>
        </View>
        {/* hide external icon per requirements */}
      </View>
      <Text style={[styles.ingredientsList, { color: theme.textSecondary }]}>Browse {selectedCategory !== 'all' ? MEAL_CATEGORIES[selectedCategory]?.name.toLowerCase() : 'recipes'}{selectedSubcategory ? ` • ${selectedSubcategory}` : ''}</Text>
    </TouchableOpacity>
  );

  // We keep online browse available but not shown automatically since you want in-app recipes

  const handleAddMissingToList = useCallback((meal) => {
    // Check if user is subscribed before allowing access to add missing ingredients
    if (!isSubscribed) {
      triggerPaywall();
      return;
    }
    
    // Ensure we have missing ingredients
    let missing = (meal.missingIngredients || []);
    
    // Convert to strings if needed and clean up
    missing = missing.map(n => typeof n === 'string' ? n.trim() : String(n).trim()).filter(Boolean);
    
    // If no missing ingredients, use some from the recipe's ingredients
    if (missing.length === 0 && Array.isArray(meal.ingredients) && meal.ingredients.length > 0) {
      missing = meal.ingredients.slice(0, Math.min(3, meal.ingredients.length))
        .map(n => typeof n === 'string' ? n.trim() : String(n).trim())
        .filter(Boolean);
    }
    
    // Final fallback - if still no ingredients, show a message
    if (missing.length === 0) {
      Alert.alert('All set', 'No missing ingredients for this recipe.');
      return;
    }
    
    // Check against existing shopping list items
    const existingNames = new Set((shoppingList || []).map(i => (i.name || '').toLowerCase().trim()));
    let added = 0;
    
    missing.forEach(name => {
      const key = name.toLowerCase();
      if (!existingNames.has(key)) {
        addToShoppingList({ 
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, 
          name, 
          quantity: 1, 
          isDone: false,
          source: meal.name || 'Recipe'
        });
        existingNames.add(key);
        added += 1;
      }
    });
    
    Alert.alert('Shopping list updated', added > 0 ? 
      `Added ${added} item${added === 1 ? '' : 's'} to your shopping list.` : 
      'All missing ingredients are already on your list.');
    
    if (added > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [addToShoppingList, shoppingList]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background} />
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}> 
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={[styles.menuButtonCircle, { backgroundColor: theme.overlay }]}>
          <MaterialCommunityIcons name="menu" size={28} color={theme.accent} /> 
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={22}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">Meal Maker</Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary, marginTop: 2 }]}>Suggestions and custom recipes</Text>
        </View>
        {/* Suggest/Create toggle moved into content below */}
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.menuButtonCircle, { backgroundColor: theme.overlay, marginLeft: 8 }]}>
          <MaterialCommunityIcons name="account" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Mode toggle */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, marginBottom: 10 }}>
          <View style={[styles.modeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.modeLabel, { color: theme.textSecondary }]}>Mode</Text>
            <View style={[styles.modePillFull, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'suggest' }}
                onPress={() => { if (mode !== 'suggest') { Haptics.selectionAsync(); setMode('suggest'); } }}
                style={[styles.modeOptionFull, { marginRight: 6 }, mode === 'suggest' && { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={mode === 'suggest' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.modeOptionText, { color: mode === 'suggest' ? '#fff' : theme.text }]}>Suggest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'create' }}
                onPress={() => { if (mode !== 'create') { Haptics.selectionAsync(); setMode('create'); } }}
                style={[styles.modeOptionFull, mode === 'create' && { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="pencil-outline" size={16} color={mode === 'create' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.modeOptionText, { color: mode === 'create' ? '#fff' : theme.text }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {mode === 'suggest' ? (
          <>
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search meals or ingredients..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialCommunityIcons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter */}
            {renderCategoryFilter()}
            {renderSubcategoryFilter()}

            {/* Expiring Items */}
            {renderExpiringItems()}

            {/* Meal Suggestions - Inlined content */}
            <CollapsibleSection
              title="Meal Suggestions"
              icon="food-variant"
              isCollapsed={collapsedSections.suggestions}
              onToggle={() => toggleSection('suggestions')}
              theme={theme}
              count={Math.max(onlineRecipes.length, allStaticRecipes.length)}
            >
              {/* Web recipes section */}
              <View style={{ marginBottom: 4 }}>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Suggested from the web</Text>
                {onlineLoading && (
                  <View style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>Loading recipes…</Text>
                  </View>
                )}
                {!!onlineError && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: theme.error }}>{onlineError}</Text>
                    <TouchableOpacity onPress={fetchOnlineRecipes} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.surface, borderColor: theme.border }}>
                      <MaterialCommunityIcons name="refresh" size={16} color={theme.textSecondary} />
                      <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!onlineLoading && !onlineError && onlineRecipes.length === 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: theme.textSecondary }}>No web recipes found</Text>
                    <TouchableOpacity onPress={fetchOnlineRecipes} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.surface, borderColor: theme.border }}>
                      <MaterialCommunityIcons name="refresh" size={16} color={theme.textSecondary} />
                      <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {(!onlineLoading && onlineRecipes.length > 0) && onlineRecipes.slice(0, 5).map(meal => (
                  <EnhancedMealSuggestionCard
                    key={meal.id}
                    meal={meal}
                    onPress={() => setSelectedRecipe(meal)}
                    theme={theme}
                    showMissing
                    onAddMissing={() => handleAddMissingToList(meal)}
                    onPlan={() => handleSmartPlanMeal(meal)}
                  />
                ))}
              </View>

              {/* Local recipes section - always show these */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionSubtitle, { color: theme.primary, fontWeight: 'bold', fontSize: 16 }]}>Built-in Recipes</Text>
                {builtInRecipes.length > 0 ? (
                  builtInRecipes.slice(0, 8).map(meal => (
                    <EnhancedMealSuggestionCard
                      key={meal.id}
                      meal={meal}
                      onPress={() => setSelectedRecipe(meal)}
                      theme={theme}
                      showMissing
                      onAddMissing={() => handleAddMissingToList(meal)}
                      onPlan={() => handleSmartPlanMeal(meal)}
                    />
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="food-off" size={32} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary, fontSize: 14 }]}>No recipes match your filters</Text>
                    <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary, fontSize: 12 }]}>Try selecting a different category or subcategory</Text>
                  </View>
                )}
              </View>

              {/* Suggested for You section */}
              {suggestedMeals.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionSubtitle, { color: theme.success, fontWeight: 'bold', fontSize: 16 }]}>Suggested for You</Text>
                  {suggestedMeals.map(meal => (
                    <EnhancedMealSuggestionCard
                      key={meal.id}
                      meal={meal}
                      onPress={() => setSelectedRecipe(meal)}
                      theme={theme}
                      showMissing
                      onAddMissing={() => handleAddMissingToList(meal)}
                      onPlan={() => handleSmartPlanMeal(meal)}
                    />
                  ))}
                </View>
              )}

              {/* Explore ideas (need a few extras) */}
              {exploreIdeas.length > 0 && (
                <View style={{ marginTop: 8, marginBottom: 12 }}>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Ideas requiring a few extras</Text>
                  {exploreIdeas.map(meal => (
                    <EnhancedMealSuggestionCard
                      key={meal.id}
                      meal={meal}
                      onPress={() => setSelectedRecipe(meal)}
                      theme={theme}
                      showMissing
                      onAddMissing={() => handleAddMissingToList(meal)}
                      onPlan={() => handleSmartPlanMeal(meal)}
                    />
                  ))}
                </View>
              )}

              {/* Additional filtered meals */}
              {filteredMeals.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>More Options</Text>
                  <FlatList
                    data={filteredMeals.slice(0, 10)}
                    renderItem={({ item: meal }) => (
                      <EnhancedMealSuggestionCard
                        key={meal.id}
                        meal={meal}
                        onPress={() => setSelectedRecipe(meal)}
                        theme={theme}
                        showMissing
                        onAddMissing={() => handleAddMissingToList(meal)}
                        onPlan={() => handleSmartPlanMeal(meal)}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
            </CollapsibleSection>
          </>
        ) : (
          <>
            {/* Create Meal Inline */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Create Your Own Meal</Text>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {/* Name */}
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Meal name</Text>
                <View style={[styles.inputRow, { borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInputBox, { color: theme.text }]}
                    placeholder="e.g. Chicken pasta bake"
                    placeholderTextColor={theme.textSecondary}
                    value={newMeal.name}
                    onChangeText={text => setNewMeal(prev => ({ ...prev, name: text }))}
                  />
                </View>

                {/* Category */}
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {Object.entries(MEAL_CATEGORIES).map(([key, cat]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.chip,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                        newMeal.category === key && { backgroundColor: theme.primary }
                      ]}
                      onPress={() => setNewMeal(prev => ({ ...prev, category: key }))}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name={cat.icon} size={14} color={newMeal.category === key ? '#fff' : theme.textSecondary} />
                      <Text style={{ color: newMeal.category === key ? '#fff' : theme.text, fontWeight: '600' }}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Enhanced inventory section */}
                <CollapsibleSection
                  title="From your inventory"
                  icon="package-variant"
                  isCollapsed={collapsedSections.inventory}
                  onToggle={() => toggleSection('inventory')}
                  theme={theme}
                  count={filteredInventory.length}
                >
                  {filteredInventory.length > 10 && (
                    <View style={styles.inventorySectionHeader}>
                      <TouchableOpacity
                        onPress={() => setShowAllInventory(!showAllInventory)}
                        style={[styles.toggleButton, { backgroundColor: theme.primary + '20' }]}
                      >
                        <Text style={[styles.toggleButtonText, { color: theme.primary }]}>
                          {showAllInventory ? 'Show Less' : `Show All (${filteredInventory.length})`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Inventory search and filters */}
                  {foodInventory.length > 5 && (
                    <View style={styles.inventoryControls}>
                      <View style={[styles.inventorySearchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <MaterialCommunityIcons name="magnify" size={16} color={theme.textSecondary} />
                        <TextInput
                          style={[styles.inventorySearchInput, { color: theme.text }]}
                          placeholder="Search inventory..."
                          placeholderTextColor={theme.textSecondary}
                          value={inventorySearch}
                          onChangeText={setInventorySearch}
                        />
                        {inventorySearch.length > 0 && (
                          <TouchableOpacity onPress={() => setInventorySearch('')}>
                            <MaterialCommunityIcons name="close-circle" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Category filter */}
                      {inventoryCategories.length > 2 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
                          {inventoryCategories.map(category => (
                            <TouchableOpacity
                              key={category}
                              style={[
                                styles.categoryFilterChip,
                                {
                                  backgroundColor: inventoryCategory === category ? theme.primary : theme.surface,
                                  borderColor: theme.border
                                }
                              ]}
                              onPress={() => setInventoryCategory(category)}
                            >
                              <Text style={[
                                styles.categoryFilterText,
                                { color: inventoryCategory === category ? '#fff' : theme.text }
                              ]}>
                                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}

                  {/* Virtualized Inventory items for better performance */}
                  {displayedInventory.length > 0 ? (
                    <FlatList
                      data={displayedInventory}
                      renderItem={({ item }) => {
                        const selected = newMeal.ingredients.includes(item.name);
                        return (
                          <TouchableOpacity
                            style={[
                              styles.inventoryChip,
                              {
                                borderColor: theme.border,
                                backgroundColor: selected ? theme.primary : theme.surface
                              }
                            ]}
                            onPress={() => addIngredient(item.name)}
                            activeOpacity={0.85}
                          >
                            <Text style={[
                              styles.inventoryChipText,
                              { color: selected ? '#fff' : theme.text }
                            ]}>
                              {item.name}
                            </Text>
                            {item.category && (
                              <Text style={[
                                styles.inventoryChipCategory,
                                { color: selected ? '#fff' : theme.textSecondary }
                              ]}>
                                {item.category}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      }}
                      keyExtractor={(item) => item.id}
                      numColumns={2}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                      getItemLayout={(data, index) => ({
                        length: 50,
                        offset: 50 * index,
                        index,
                      })}
                      initialNumToRender={10}
                      maxToRenderPerBatch={10}
                      windowSize={10}
                    />
                  ) : (
                    <View style={styles.emptyInventoryState}>
                      <MaterialCommunityIcons name="package-variant" size={32} color={theme.textSecondary} />
                      <Text style={[styles.emptyInventoryText, { color: theme.textSecondary }]}>
                        {inventorySearch.trim() || inventoryCategory !== 'all'
                          ? 'No items match your search'
                          : 'No items in inventory'}
                      </Text>
                      {(inventorySearch.trim() || inventoryCategory !== 'all') && (
                        <TouchableOpacity
                          onPress={() => {
                            setInventorySearch('');
                            setInventoryCategory('all');
                          }}
                          style={[styles.clearFiltersButton, { backgroundColor: theme.primary }]}
                        >
                          <Text style={styles.clearFiltersText}>Clear Filters</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </CollapsibleSection>

                {/* Enhanced ingredient search with barcode scanner */}
                <View style={styles.ingredientSearchContainer}>
                  <View style={[styles.inputRow, { borderColor: theme.border, marginBottom: 0, flex: 1 }]}>
                    <MaterialCommunityIcons name="magnify" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInputBox, { color: theme.text }]}
                      placeholder="Search ingredients (e.g., chicken, rice, tomatoes...)"
                      placeholderTextColor={theme.textSecondary}
                      value={newMeal.customIngredient}
                      onChangeText={text => {
                        setNewMeal(prev => ({ ...prev, customIngredient: text }));
                        debouncedSearchIngredients(text);
                      }}
                      onSubmitEditing={addCustomIngredient}
                    />
                    {ingredientSearchLoading && (
                      <ActivityIndicator size="small" color={theme.primary} />
                    )}
                    {newMeal.customIngredient.length > 0 && !ingredientSearchLoading && (
                      <TouchableOpacity onPress={() => {
                        setNewMeal(prev => ({ ...prev, customIngredient: '' }));
                        setApiIngredients([]);
                      }}>
                        <MaterialCommunityIcons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Barcode scan button */}
                  <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowBarcodeScanner(true)}
                    disabled={scannerLoading}
                  >
                    {scannerLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* API Search Results */}
                {apiIngredients.length > 0 && (
                  <View style={[styles.apiResultsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.apiResultsHeader}>
                      <MaterialCommunityIcons name="web" size={16} color={theme.primary} />
                      <Text style={[styles.apiResultsTitle, { color: theme.primary }]}>
                        Found {apiIngredients.length} products
                      </Text>
                    </View>
                    <ScrollView style={styles.apiResultsList} showsVerticalScrollIndicator={false}>
                      {apiIngredients.map((ingredient) => (
                        <TouchableOpacity
                          key={ingredient.id}
                          style={[styles.apiResultItem, { borderBottomColor: theme.border }]}
                          onPress={() => {
                            addIngredient(`${ingredient.name}${ingredient.brand ? ` (${ingredient.brand})` : ''}`);
                            setNewMeal(prev => ({ ...prev, customIngredient: '' }));
                            setApiIngredients([]);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.apiResultContent}>
                            <View style={styles.apiResultMain}>
                              <Text style={[styles.apiResultName, { color: theme.text }]} numberOfLines={1}>
                                {ingredient.name}
                              </Text>
                              {ingredient.brand && (
                                <Text style={[styles.apiResultBrand, { color: theme.textSecondary }]} numberOfLines={1}>
                                  {ingredient.brand}
                                </Text>
                              )}
                              <View style={styles.apiResultMeta}>
                                <Text style={[styles.apiResultCategory, { color: theme.textSecondary }]}>
                                  {ingredient.category}
                                </Text>
                                {ingredient.nutrition_grade && (
                                  <View style={[styles.nutritionGrade, { backgroundColor: getNutritionGradeColor(ingredient.nutrition_grade) }]}>
                                    <Text style={styles.nutritionGradeText}>
                                      {ingredient.nutrition_grade.toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={styles.apiResultNutrition}>
                              <Text style={[styles.apiResultCalories, { color: theme.primary }]}>
                                {Math.round(ingredient.calories)} cal
                              </Text>
                              <Text style={[styles.apiResultMacros, { color: theme.textSecondary }]}>
                                P: {Math.round(ingredient.protein)}g
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {ingredientSearchError && (
                  <View style={[styles.errorContainer, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      {ingredientSearchError}
                    </Text>
                  </View>
                )}

                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                  Search for real products from stores like Aldi, Tesco, Morrisons, etc. Tap the barcode icon to scan products directly, or tap inventory items and search results to add.
                </Text>

                {/* Selected ingredients */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                  {newMeal.ingredients.map(ingredient => (
                    <TouchableOpacity key={ingredient} style={[styles.selectedChip, { backgroundColor: theme.error }]} onPress={() => removeIngredient(ingredient)} activeOpacity={0.85}>
                      <MaterialCommunityIcons name="close-circle" size={14} color="#fff" />
                      <Text style={styles.selectedChipText}>{ingredient}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Instructions */}
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Instructions</Text>
                <View style={[styles.inputRow, { borderColor: theme.border, alignItems: 'flex-start' }]}>
                  <MaterialCommunityIcons name="text-long" size={18} color={theme.textSecondary} style={[styles.inputIcon, { marginTop: 10 }]} />
                  <TextInput
                    style={[styles.textInputBox, { color: theme.text, minHeight: 80 }]}
                    placeholder="Optional: brief steps to prepare"
                    placeholderTextColor={theme.textSecondary}
                    value={newMeal.instructions}
                    onChangeText={text => setNewMeal(prev => ({ ...prev, instructions: text }))}
                    multiline
                  />
                </View>

                {/* Times */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Prep time</Text>
                    <View style={[styles.inputRow, { borderColor: theme.border }]}>
                      <MaterialCommunityIcons name="timer-sand" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.textInputBox, { color: theme.text }]}
                        placeholder="10 min"
                        placeholderTextColor={theme.textSecondary}
                        value={newMeal.prepTime}
                        onChangeText={text => setNewMeal(prev => ({ ...prev, prepTime: text }))}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Cook time</Text>
                    <View style={[styles.inputRow, { borderColor: theme.border }]}>
                      <MaterialCommunityIcons name="fire" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.textInputBox, { color: theme.text }]}
                        placeholder="20 min"
                        placeholderTextColor={theme.textSecondary}
                        value={newMeal.cookTime}
                        onChangeText={text => setNewMeal(prev => ({ ...prev, cookTime: text }))}
                      />
                    </View>
                  </View>
                </View>

                {/* Difficulty */}
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Difficulty</Text>
                <View style={[styles.modePill, { backgroundColor: theme.surface, borderColor: theme.border, alignSelf: 'flex-start' }]}> 
                  {['Easy', 'Medium', 'Hard'].map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.modeOption, newMeal.difficulty === level && { backgroundColor: theme.primary }]}
                      onPress={() => setNewMeal(prev => ({ ...prev, difficulty: level }))}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.modeOptionText, { color: newMeal.difficulty === level ? '#fff' : theme.text }]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Actions */}
                <View style={[styles.actionRow, { borderTopColor: theme.border }]}> 
                  <TouchableOpacity
                    style={[styles.useIngredientsButton, { backgroundColor: theme.primary, opacity: newMeal.name.trim() && newMeal.ingredients.length > 0 ? 1 : 0.5 }]}
                    onPress={() => { if (newMeal.name.trim() && newMeal.ingredients.length > 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleSaveMeal(); } }}
                    disabled={!(newMeal.name.trim() && newMeal.ingredients.length > 0)}
                  >
                    <MaterialCommunityIcons name="content-save" size={20} color="white" />
                    <Text style={styles.useIngredientsText}>Save Meal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryOutlineButton, { borderColor: theme.border }]} onPress={() => setNewMeal({ name: '', category: 'breakfast', ingredients: [], customIngredient: '', instructions: '', prepTime: '', cookTime: '', difficulty: 'Easy' })}>
                    <MaterialCommunityIcons name="backup-restore" size={18} color={theme.textSecondary} />
                    <Text style={[styles.secondaryOutlineText, { color: theme.textSecondary }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {userMeals.length > 0 && (
                <CollapsibleSection
                  title="Your Saved Meals"
                  icon="bookmark-multiple"
                  isCollapsed={collapsedSections.userMeals}
                  onToggle={() => toggleSection('userMeals')}
                  theme={theme}
                  count={userMeals.length}
                >
                  <FlatList
                    data={userMeals}
                    renderItem={({ item: meal }) => (
                      <View style={[styles.mealCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                        <View style={styles.mealCardHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: MEAL_CATEGORIES[meal.category]?.color || theme.primary }]}>
                            <MaterialCommunityIcons name={MEAL_CATEGORIES[meal.category]?.icon || 'silverware-fork-knife'} size={22} color="#fff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                            <Text style={[styles.mealCategory, { color: theme.textSecondary }]}>
                              {MEAL_CATEGORIES[meal.category]?.name || meal.category}
                            </Text>
                          </View>
                          <TouchableOpacity 
                            style={[styles.planButton, { backgroundColor: theme.success, marginRight: 8 }]}
                            onPress={() => handleSmartPlanMeal(meal)}
                          >
                            <MaterialCommunityIcons name="calendar-plus" size={12} color="#fff" />
                            <Text style={styles.planButtonText}>Plan</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => Alert.alert('Delete meal?', `Remove "${meal.name}" from saved meals?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => setUserMeals(prev => prev.filter(m => m.id !== meal.id)) }
                          ])}>
                            <MaterialCommunityIcons name="delete-outline" size={22} color={theme.error} />
                          </TouchableOpacity>
                        </View>
                        {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
                          <Text style={[styles.ingredientsList, { color: theme.textSecondary }]}>
                            {meal.ingredients.slice(0, 5).join(', ')}{meal.ingredients.length > 5 ? '…' : ''}
                          </Text>
                        )}
                        {!!meal.instructions && (
                          <Text numberOfLines={3} style={{ color: theme.textSecondary, marginTop: 8 }}>
                            {meal.instructions}
                          </Text>
                        )}
                      </View>
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </CollapsibleSection>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        visible={selectedRecipe !== null}
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onUseIngredients={handleUseIngredients}
        onPlan={() => selectedRecipe && handleSmartPlanMeal(selectedRecipe)}
        theme={theme}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onProductScanned={handleBarcodeScanned}
        accentKey={accentKey}
        darkMode={darkMode}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4E9F2',
  },
  categoryButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  sectionSubtitle: {
    marginBottom: 12,
    marginTop: 12,
  },
  expiringItemCard: {
    padding: 16,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 150,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  expiringItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expiringItemName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  expiryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiryBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  expiringItemCategory: {
    fontSize: 12,
  },
  mealCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mealCardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  mealCategory: {
    fontSize: 14,
  },
  mealIngredients: {
    marginBottom: 12,
  },
  ingredientsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  ingredientsList: {
    fontSize: 14,
  },
  missingIngredients: {
    marginTop: 4,
  },
  mealStats: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statText: {
    fontSize: 12,
    marginLeft: 4,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  sourceChipText: {
    fontSize: 11,
    marginLeft: 4,
  },
  addMissingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    width: 70,
    flex: 0,
  },
  addMissingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0,
    width: 70,
    flex: 0,
  },
  planButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  recipeModal: {
    height: height * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modeContainer: {
    marginLeft: 12,
  },
  modePill: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 4,
  },
  modePillFull: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    justifyContent: 'space-between',
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  modeOptionFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E9F2',
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  recipeContent: {
    flex: 1,
    padding: 20,
  },
  recipeInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 14,
    marginLeft: 4,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  useIngredientsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  useIngredientsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  inputIcon: {
    marginRight: 8,
  },
  textInputBox: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  selectedChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 6,
  },
  secondaryOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // API search results styles
  apiResultsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    maxHeight: 300,
  },
  apiResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  apiResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  apiResultsList: {
    maxHeight: 250,
  },
  apiResultItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  apiResultContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  apiResultMain: {
    flex: 1,
    marginRight: 12,
  },
  apiResultName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  apiResultBrand: {
    fontSize: 13,
    marginBottom: 4,
  },
  apiResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apiResultCategory: {
    fontSize: 12,
  },
  nutritionGrade: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  nutritionGradeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  apiResultNutrition: {
    alignItems: 'flex-end',
  },
  apiResultCalories: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  apiResultMacros: {
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  // Ingredient search container styles
  ingredientSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Enhanced inventory section styles
  inventorySection: {
    marginBottom: 16,
  },
  inventorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inventoryControls: {
    marginBottom: 12,
  },
  inventorySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  inventorySearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  categoryFilter: {
    marginBottom: 4,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inventoryChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    minWidth: 80,
    maxWidth: '45%',
  },
  inventoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  inventoryChipCategory: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  emptyInventoryState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyInventoryText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  clearFiltersButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Collapsible sections styles
  collapsibleSection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  collapsibleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collapsibleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  collapsibleContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Enhanced meal planning buttons
  planButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    minWidth: 60,
    justifyContent: 'center',
  },
  planButtonTextLarge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  planMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  planMealText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Badge row for meal cards
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Section dividers
  sectionDivider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  thickDivider: {
    height: 8,
    marginVertical: 16,
  },
  // Enhanced styles for tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Performance indicator styles
  performanceIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  performanceText: {
    fontSize: 10,
    opacity: 0.7,
  },
});