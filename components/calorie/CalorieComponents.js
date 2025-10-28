import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

// Memoized Tab Bar Component
export const TabBar = memo(({ tabs, activeTab, onTabChange, theme }) => {
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabItem,
            activeTab === tab.id && [styles.activeTab, { backgroundColor: theme.primary + '15' }]
          ]}
          onPress={() => onTabChange(tab.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.id }}
          accessibilityLabel={`${tab.label} tab`}
        >
          <MaterialCommunityIcons
            name={tab.icon}
            size={22}
            color={activeTab === tab.id ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === tab.id ? theme.primary : theme.textSecondary }
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// Memoized Circular Progress Component
export const CircularProgress = memo(({ 
  percentage, 
  size = 140, 
  strokeWidth = 10, 
  theme, 
  consumed, 
  goal 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.circularProgressContainer}>
      <Svg width={size} height={size} style={styles.circularProgressSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="transparent"
          opacity={0.3}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={percentage >= 100 ? '#FF6B6B' : theme.primary}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.circularProgressText}>
        <Text 
          style={[styles.circularProgressValue, { color: theme.text }]}
          accessibilityLabel={`${consumed} calories consumed`}
        >
          {consumed}
        </Text>
        <Text style={[styles.circularProgressLabel, { color: theme.textSecondary }]}>
          of {goal}
        </Text>
        <Text style={[styles.circularProgressPercentage, { color: theme.textSecondary }]}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
});

// Memoized Quick Action Button Component
export const QuickActionButton = memo(({ icon, label, color, onPress, theme, disabled = false }) => (
  <TouchableOpacity
    style={[
      styles.quickActionButton, 
      { backgroundColor: color },
      disabled && styles.disabledButton
    ]}
    onPress={onPress}
    activeOpacity={0.8}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${label} action`}
    accessibilityHint={`Tap to ${label.toLowerCase()}`}
  >
    <View style={[styles.quickActionIcon, { backgroundColor: theme.surface }]}>
      <MaterialCommunityIcons 
        name={icon} 
        size={20} 
        color={disabled ? theme.textSecondary : theme.text} 
      />
    </View>
    <Text style={[
      styles.quickActionLabel, 
      { color: disabled ? theme.textSecondary : theme.text }
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
));

// Memoized Meal Card Component
export const MealCard = memo(({ meal, theme, onPress }) => (
  <TouchableOpacity 
    style={[styles.mealCard, { backgroundColor: theme.surface }]}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={`${meal.name}: ${meal.calories} calories`}
    accessibilityHint="Tap to view meal details"
  >
    <View style={styles.mealCardContent}>
      <View style={styles.mealCardHeader}>
        <View style={[styles.mealColorIndicator, { backgroundColor: meal.color }]} />
        <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
      </View>
      <View style={styles.mealCalories}>
        <Text style={[styles.mealCaloriesValue, { color: theme.text }]}>{meal.calories}</Text>
        <Text style={[styles.mealCaloriesLabel, { color: theme.textSecondary }]}>cal</Text>
      </View>
    </View>
    {meal.calories > 0 && (
      <View style={[styles.mealProgress, { backgroundColor: theme.border }]}>
        <View 
          style={[
            styles.mealProgressFill, 
            { 
              backgroundColor: meal.color,
              width: `${Math.min((meal.calories / 800) * 100, 100)}%`
            }
          ]} 
        />
      </View>
    )}
  </TouchableOpacity>
));

// Memoized Macro Bar Component
export const MacroBar = memo(({ macro, theme }) => {
  const percentage = Math.min((macro.value / macro.goal) * 100, 100);
  
  return (
    <View style={styles.macroBarContainer}>
      <View style={styles.macroBarHeader}>
        <Text style={[styles.macroName, { color: theme.text }]}>{macro.name}</Text>
        <Text style={[styles.macroValue, { color: theme.textSecondary }]}>
          {macro.value}g / {macro.goal}g
        </Text>
      </View>
      <View style={[styles.macroBarTrack, { backgroundColor: theme.border }]}>
        <View 
          style={[
            styles.macroBarFill, 
            { 
              backgroundColor: macro.color,
              width: `${percentage}%`
            }
          ]} 
        />
      </View>
      <Text 
        style={[styles.macroPercentage, { color: theme.textSecondary }]}
        accessibilityLabel={`${macro.name}: ${Math.round(percentage)}% of goal`}
      >
        {Math.round(percentage)}%
      </Text>
    </View>
  );
});

// Memoized Food Suggestion Item Component
export const FoodSuggestionItem = memo(({ food, onAdd, theme }) => (
  <TouchableOpacity 
    style={[styles.foodSuggestion, { backgroundColor: theme.surface }]}
    onPress={() => onAdd(food)}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={`Add ${food.name}, ${food.calories} calories`}
    accessibilityHint="Tap to add this food to your meal"
  >
    <View style={styles.foodSuggestionContent}>
      <View style={styles.foodSuggestionInfo}>
        <Text style={[styles.foodSuggestionName, { color: theme.text }]}>{food.name}</Text>
        <Text style={[styles.foodSuggestionDetails, { color: theme.textSecondary }]}>
          {food.calories} cal • {food.serving}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.addSuggestionButton, { backgroundColor: theme.primary }]}
        onPress={() => onAdd(food)}
        accessibilityRole="button"
        accessibilityLabel="Add food"
      >
        <MaterialCommunityIcons name="plus" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
));

// Empty State Component
export const EmptyState = memo(({ 
  icon, 
  title, 
  subtitle, 
  primaryAction, 
  secondaryAction, 
  theme 
}) => (
  <View style={styles.emptyState}>
    <MaterialCommunityIcons name={icon} size={64} color={theme.textSecondary} />
    <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
      {subtitle}
    </Text>
    <View style={styles.emptyActions}>
      {primaryAction && (
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={primaryAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
        >
          <MaterialCommunityIcons name={primaryAction.icon} size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
        </TouchableOpacity>
      )}
      {secondaryAction && (
        <TouchableOpacity 
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={secondaryAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={secondaryAction.label}
        >
          <MaterialCommunityIcons name={secondaryAction.icon} size={20} color={theme.text} />
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            {secondaryAction.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
));

const styles = StyleSheet.create({
  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // Circular Progress Styles
  circularProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circularProgressSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  circularProgressText: {
    position: 'absolute',
    alignItems: 'center',
  },
  circularProgressValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  circularProgressLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  circularProgressPercentage: {
    fontSize: 12,
    marginTop: 4,
  },

  // Quick Actions Styles
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Meal Card Styles
  mealCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mealCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
  },
  mealCalories: {
    alignItems: 'flex-end',
  },
  mealCaloriesValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mealCaloriesLabel: {
    fontSize: 12,
  },
  mealProgress: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  mealProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Macro Bar Styles
  macroBarContainer: {
    gap: 8,
  },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroName: {
    fontSize: 16,
    fontWeight: '600',
  },
  macroValue: {
    fontSize: 14,
  },
  macroBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroPercentage: {
    fontSize: 12,
    textAlign: 'right',
  },

  // Food Suggestion Styles
  foodSuggestion: {
    width: 200,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  foodSuggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodSuggestionInfo: {
    flex: 1,
  },
  foodSuggestionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  foodSuggestionDetails: {
    fontSize: 12,
  },
  addSuggestionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyActions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});