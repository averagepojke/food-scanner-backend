import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CircularProgress,
  QuickActionButton,
  MealCard,
  FoodSuggestionItem,
} from '../CalorieComponents';
import { getCalorieStatus } from '../../../utils/dateUtils';
import AsyncStorage from '../../../AsyncStorageWrapper';
import { getUserData } from '../../../utils';
import { useAuth } from '../../../food-scanner-app/AuthContext';

const FOOD_SUGGESTIONS = [
  { 
    id: 1, 
    name: 'Greek Yogurt', 
    calories: 100, 
    protein: 17, 
    carbs: 6, 
    fat: 0, 
    serving: '1 cup' 
  },
  { 
    id: 2, 
    name: 'Chicken Breast', 
    calories: 165, 
    protein: 31, 
    carbs: 0, 
    fat: 3.6, 
    serving: '100g' 
  },
  { 
    id: 3, 
    name: 'Apple', 
    calories: 95, 
    protein: 0.5, 
    carbs: 25, 
    fat: 0.3, 
    serving: '1 medium' 
  },
  { 
    id: 4, 
    name: 'Almonds', 
    calories: 164, 
    protein: 6, 
    carbs: 6, 
    fat: 14, 
    serving: '1 oz' 
  },
  { 
    id: 5, 
    name: 'Banana', 
    calories: 105, 
    protein: 1.3, 
    carbs: 27, 
    fat: 0.4, 
    serving: '1 medium' 
  },
  { 
    id: 6, 
    name: 'Oatmeal', 
    calories: 150, 
    protein: 5, 
    carbs: 27, 
    fat: 3, 
    serving: '1/2 cup dry' 
  }
];

const OverviewTab = memo(({
  theme,
  dailyTotals,
  dailyGoal,
  remainingCalories,
  progressPercentage,
  mealTotals,
  quickActions,
  onAddFood,
  onMealPress,
  loading
}) => {
  const calorieStatus = getCalorieStatus(remainingCalories);
  const [healthScorePeriod, setHealthScorePeriod] = useState('today');
  const [healthScoreData, setHealthScoreData] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchHealthScoreData = async () => {
      try {
        const userData = await getUserData(user?.uid);
        const today = new Date();
        let scores = [];
        let days = 1;

        switch (healthScorePeriod) {
          case 'week':
            days = 7;
            break;
          case 'month':
            days = 30;
            break;
          case 'year':
            days = 365;
            break;
          default:
            days = 1;
        }

        for (let i = 0; i < days; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateKey = date.toISOString().split('T')[0];
          let dayData;

          if (i === 0) {
            // For today, use current dailyTotals
            dayData = dailyTotals;
          } else {
            dayData = userData?.dailyLogs?.[dateKey];
          }

          if (dayData && (dayData.protein > 0 || dayData.carbs > 0 || dayData.fat > 0)) {
            // Calculate score for this day based on logged data, penalizing excess
            const proteinScore = dayData.protein <= 150 ? (dayData.protein / 150) * 100 : Math.max(0, 100 - ((dayData.protein - 150) / 150) * 100);
            const carbsScore = dayData.carbs <= 300 ? (dayData.carbs / 300) * 100 : Math.max(0, 100 - ((dayData.carbs - 300) / 300) * 100);
            const fatScore = dayData.fat <= 70 ? (dayData.fat / 70) * 100 : Math.max(0, 100 - ((dayData.fat - 70) / 70) * 100);
            const dayScore = (proteinScore + carbsScore + fatScore) / 3;
            scores.push(dayScore);
          }
        }

        // Average the scores from days with logged data
        const avgScore = scores.length > 0 ? Math.min((scores.reduce((sum, s) => sum + s, 0) / scores.length), 100).toFixed(1) : '0.0';

        // Determine color and label based on score
        let color = theme.primary; // default
        let label = 'Balanced nutrition';
        const scoreNum = parseFloat(avgScore);
        if (scoreNum < 33) {
          color = theme.error; // red
          label = 'Poor nutrition';
        } else if (scoreNum < 66) {
          color = theme.warning; // yellow
          label = 'Fair nutrition';
        } else {
          color = theme.success; // green
          label = 'Good nutrition';
        }

        setHealthScoreData({ score: avgScore, color, label });
      } catch (error) {
        console.error('Error fetching health score data:', error);
        setHealthScoreData(null);
      }
    };

    fetchHealthScoreData();
  }, [healthScorePeriod, user?.uid, dailyTotals]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading your data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Calorie Progress Card */}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.calorieProgressContainer}>
          <CircularProgress 
            percentage={progressPercentage} 
            theme={theme}
            consumed={Math.round(dailyTotals.calories)}
            goal={dailyGoal}
          />
          <View style={styles.remainingCalories}>
            <Text 
              style={[styles.remainingValue, { color: theme.text }]}
              accessibilityLabel={`${remainingCalories} calories remaining`}
            >
              {remainingCalories > 0 ? remainingCalories : 0}
            </Text>
            <Text style={[styles.remainingLabel, { color: theme.textSecondary }]}>
              calories remaining
            </Text>
            <View style={[
              styles.calorieStatus, 
              { backgroundColor: calorieStatus.backgroundColor }
            ]}>
              <Text style={[
                styles.calorieStatusText,
                { color: calorieStatus.color }
              ]}>
                {calorieStatus.text}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionHeader, { color: theme.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action, index) => (
          <QuickActionButton
            key={index}
            icon={action.icon}
            label={action.label}
            color={action.color}
            onPress={action.action}
            theme={theme}
            disabled={!!action.disabled}
          />
        ))}
      </View>

      {/* Today's Meals Summary */}
      <Text style={[styles.sectionHeader, { color: theme.text }]}>Today's Meals</Text>
      <View style={styles.mealsGrid}>
        {mealTotals.map((meal, index) => (
          <MealCard 
            key={meal.id || index} 
            meal={meal} 
            theme={theme} 
            onPress={() => onMealPress(meal)}
          />
        ))}
      </View>

      {/* Nutrition Summary */}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Nutrition Summary
        </Text>
        <View style={styles.nutritionSummary}>
          <View style={styles.nutritionItem}>
            <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
              Protein
            </Text>
            <Text style={[styles.nutritionValue, { color: theme.text }]}>
              {Math.round(dailyTotals.protein)}g
            </Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
              Carbs
            </Text>
            <Text style={[styles.nutritionValue, { color: theme.text }]}>
              {Math.round(dailyTotals.carbs)}g
            </Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
              Fat
            </Text>
            <Text style={[styles.nutritionValue, { color: theme.text }]}>
              {Math.round(dailyTotals.fat)}g
            </Text>
          </View>
        </View>
        {/* Health Score */}
        <View style={styles.healthScoreContainer}>
          <View style={styles.healthScoreHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={20} color={theme.primary} />
            <Text style={[styles.healthScoreTitle, { color: theme.text }]}>
              Health Score
            </Text>
          </View>
          <View style={styles.healthScorePeriodSelector}>
            <TouchableOpacity
              style={[styles.periodButton, healthScorePeriod === 'today' && styles.periodButtonActive]}
              onPress={() => setHealthScorePeriod('today')}
            >
              <Text style={[styles.periodButtonText, healthScorePeriod === 'today' && styles.periodButtonTextActive, { color: theme.text }]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodButton, healthScorePeriod === 'week' && styles.periodButtonActive]}
              onPress={() => setHealthScorePeriod('week')}
            >
              <Text style={[styles.periodButtonText, healthScorePeriod === 'week' && styles.periodButtonTextActive, { color: theme.text }]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodButton, healthScorePeriod === 'month' && styles.periodButtonActive]}
              onPress={() => setHealthScorePeriod('month')}
            >
              <Text style={[styles.periodButtonText, healthScorePeriod === 'month' && styles.periodButtonTextActive, { color: theme.text }]}>
                Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodButton, healthScorePeriod === 'year' && styles.periodButtonActive]}
              onPress={() => setHealthScorePeriod('year')}
            >
              <Text style={[styles.periodButtonText, healthScorePeriod === 'year' && styles.periodButtonTextActive, { color: theme.text }]}>
                Year
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.healthScoreValue}>
            <Text style={[styles.healthScoreNumber, { color: healthScoreData ? healthScoreData.color : theme.primary }]}>
              {healthScoreData ? healthScoreData.score : (((dailyTotals.protein / 150) * 100 + (dailyTotals.carbs / 300) * 100 + (dailyTotals.fat / 70) * 100) / 3).toFixed(1)}%
            </Text>
            <Text style={[styles.healthScoreLabel, { color: theme.textSecondary }]}>
              {healthScoreData ? healthScoreData.label : 'Balanced nutrition'}
            </Text>
          </View>
        </View>
      </View>

      {/* Food Suggestions */}
      <Text style={[styles.sectionHeader, { color: theme.text }]}>
        Quick Add Suggestions
      </Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.suggestionsContainer}
        contentContainerStyle={styles.suggestionsContent}
      >
        {FOOD_SUGGESTIONS.map((food) => (
          <FoodSuggestionItem 
            key={food.id} 
            food={food} 
            onAdd={onAddFood}
            theme={theme}
          />
        ))}
      </ScrollView>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for floating button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  calorieProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remainingCalories: {
    alignItems: 'center',
  },
  remainingValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  remainingLabel: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  calorieStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  calorieStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  mealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsContent: {
    paddingRight: 16,
  },
  healthScoreContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  healthScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthScoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  healthScoreValue: {
    alignItems: 'center',
  },
  healthScoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  healthScoreLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  healthScorePeriodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 3,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  periodButtonTextActive: {
    color: '#007AFF',
  },
});

export default OverviewTab;
