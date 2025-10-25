import React, { useContext, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, StatusBar, Modal, TextInput, RefreshControl, FlatList } from 'react-native';
import { ShoppingListContext } from './App';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getTheme } from './theme';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function FinanceScreen() {
  const { foodInventory, spendingHistory, darkMode, accentKey, monthlyBudget, setMonthlyBudget, addSampleFinanceData, clearSampleFinanceData } = useContext(ShoppingListContext);
  const navigation = useNavigation();
  const theme = getTheme(accentKey, darkMode);
  const isDefault = !accentKey || accentKey === 'default';
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [refreshing, setRefreshing] = useState(false);

  // Budget planning state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState('month'); // 'week', 'month', 'year'
  const [categoryBudgets, setCategoryBudgets] = useState({}); // { category: amount }
  const [showCategoryBudgetModal, setShowCategoryBudgetModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryBudgetAmount, setCategoryBudgetAmount] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Enhanced calculations
  // Helper to get start/end date for period
  function getPeriodRange(period) {
    const now = new Date();
    let start, end;
    if (period === 'week') {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0,0,0,0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
    }
    return { start, end };
  }

  // Load saved budgets on mount
  useEffect(() => {
    const loadBudgets = async () => {
      try {
        const savedCategoryBudgets = await AsyncStorage.getItem('categoryBudgets');
        const savedBudgetPeriod = await AsyncStorage.getItem('budgetPeriod');
        if (savedCategoryBudgets) {
          setCategoryBudgets(JSON.parse(savedCategoryBudgets));
        }
        if (savedBudgetPeriod) {
          setBudgetPeriod(savedBudgetPeriod);
        }
      } catch (error) {
        console.error('Error loading budgets:', error);
      }
    };
    loadBudgets();
  }, []);

  // Save budgets when they change
  useEffect(() => {
    const saveBudgets = async () => {
      try {
        await AsyncStorage.setItem('categoryBudgets', JSON.stringify(categoryBudgets));
        await AsyncStorage.setItem('budgetPeriod', budgetPeriod);
      } catch (error) {
        console.error('Error saving budgets:', error);
      }
    };
    saveBudgets();
  }, [categoryBudgets, budgetPeriod]);

  // Budget alerts and predictions
  useEffect(() => {
    const checkBudgetAlerts = async () => {
      if (!financialStats || !financialStats.periodSpent) return;

      if (selectedPeriod === budgetPeriod) {
        const budget = budgetPeriod === 'month' ? monthlyBudget : categoryBudgets[selectedPeriod] || 0;
        if (budget > 0) {
          const percentage = (financialStats.periodSpent / budget) * 100;
          if (percentage >= 90 && percentage < 100) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Budget Alert',
                body: `You've used ${percentage.toFixed(0)}% of your ${budgetPeriod} budget`,
                sound: 'default',
              },
              trigger: null,
            });
          } else if (percentage >= 100) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Budget Exceeded',
                body: `You've exceeded your ${budgetPeriod} budget by £${(financialStats.periodSpent - budget).toFixed(2)}`,
                sound: 'default',
              },
              trigger: null,
            });
          }
        }
      }
    };

    if (financialStats && financialStats.periodSpent > 0) {
      checkBudgetAlerts();
    }
  }, [financialStats, selectedPeriod, budgetPeriod, monthlyBudget, categoryBudgets]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh - in real app this would fetch from server
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Filter spendingHistory by selected period
  const { start: periodStart, end: periodEnd } = getPeriodRange(selectedPeriod);
  function inPeriod(dateStr) {
    const d = new Date(dateStr);
    return d >= periodStart && d < periodEnd;
  }
  const periodSpending = spendingHistory.filter(record => inPeriod(record.dateSpent));

  const financialStats = useMemo(() => {
    // Calculate total value of current inventory
    const currentInventoryValue = foodInventory.reduce((sum, item) => {
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 1;
      return sum + (itemPrice * itemQuantity);
    }, 0);
    // Calculate total money spent (all time)
    const totalSpent = spendingHistory.reduce((sum, record) => sum + (record.price * record.quantity), 0);
    // Calculate value of consumed items (all time)
    const consumedValue = spendingHistory.filter(r => r.isConsumed).reduce((sum, r) => sum + (r.price * r.quantity), 0);
    // Calculate period spending
    const periodSpent = periodSpending.reduce((sum, r) => sum + (r.price * r.quantity), 0);

    // Enhanced budget calculations for flexible periods
    const currentBudget = budgetPeriod === 'month' ? monthlyBudget : categoryBudgets[budgetPeriod] || 0;
    const budgetProgress = {
      spent: selectedPeriod === budgetPeriod ? periodSpent : 0,
      budget: currentBudget,
      percentage: currentBudget && currentBudget > 0 && selectedPeriod === budgetPeriod ? (periodSpent / currentBudget) * 100 : 0,
      remaining: currentBudget - (selectedPeriod === budgetPeriod ? periodSpent : 0),
      isOverBudget: currentBudget && selectedPeriod === budgetPeriod ? periodSpent > currentBudget : false
    };

    // Category breakdown for period with budget tracking
    const categoryTotals = {};
    const categoryBudgetProgress = {};
    periodSpending.forEach(r => {
      const cat = r.category || 'Uncategorized';
      if (!categoryTotals[cat]) categoryTotals[cat] = 0;
      categoryTotals[cat] += (r.price * r.quantity);
    });

    // Calculate category budget progress
    Object.keys(categoryTotals).forEach(cat => {
      const catBudget = categoryBudgets[cat] || 0;
      categoryBudgetProgress[cat] = {
        spent: categoryTotals[cat],
        budget: catBudget,
        percentage: catBudget > 0 ? (categoryTotals[cat] / catBudget) * 100 : 0,
        remaining: catBudget - categoryTotals[cat],
        isOverBudget: catBudget > 0 ? categoryTotals[cat] > catBudget : false
      };
    });

    // Spending predictions using simple linear regression
    const spendingPredictions = calculateSpendingPredictions(spendingHistory, selectedPeriod);

    return {
      currentInventoryValue,
      totalSpent,
      consumedValue,
      periodSpent,
      budgetProgress,
      categoryTotals,
      categoryBudgetProgress,
      spendingPredictions,
    };
  }, [foodInventory, spendingHistory, monthlyBudget, selectedPeriod, periodSpending, budgetPeriod, categoryBudgets]);

  // Helper function for spending predictions
  function calculateSpendingPredictions(history, period) {
    if (history.length < 3) return null;

    const now = new Date();
    const daysInPeriod = period === 'week' ? 7 : period === 'month' ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 365;
    const daysElapsed = period === 'week' ? now.getDay() + 1 : now.getDate();
    const progressRatio = daysElapsed / daysInPeriod;

    if (progressRatio >= 1) return null; // Period is complete

    // Simple prediction based on current spending rate
    const predictedTotal = financialStats.periodSpent / progressRatio;
    const remainingPredicted = predictedTotal - financialStats.periodSpent;

    return {
      predictedTotal: predictedTotal,
      remainingPredicted: remainingPredicted,
      daysRemaining: daysInPeriod - daysElapsed,
      onTrack: predictedTotal <= (budgetPeriod === 'month' ? monthlyBudget : categoryBudgets[budgetPeriod] || Infinity)
    };
  }

  // Detect presence of sample finance data (added via the "Try Sample Data" button)
  const hasSampleData = useMemo(() => spendingHistory.some(r => r?.id && String(r.id).startsWith('sample-')), [spendingHistory]);

  const StatCard = ({ title, value, subtitle, icon, color, onPress, useAccent }) => (
    <TouchableOpacity 
      style={[styles.statCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.statHeader}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
        <Text style={[styles.statTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color: useAccent ? theme.accent : color }]}>{value}</Text>
      <Text style={[styles.statSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </TouchableOpacity>
  );

  const PeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['week', 'month', 'year'].map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            { 
              backgroundColor: selectedPeriod === period ? theme.primary : 'transparent',
              borderColor: theme.border 
            }
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[
            styles.periodButtonText,
            { 
              color: selectedPeriod === period ? '#FFFFFF' : theme.text 
            }
          ]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const showItemDetails = (title, description) => {
    Alert.alert(title, description, [{ text: 'OK' }]);
  };

  const handleSetBudget = () => {
    if (!newBudgetAmount.trim()) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    const amount = parseFloat(newBudgetAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid positive number');
      return;
    }

    if (budgetPeriod === 'month') {
      setMonthlyBudget(amount);
    } else {
      setCategoryBudgets(prev => ({ ...prev, [budgetPeriod]: amount }));
    }
    setShowBudgetModal(false);
    setNewBudgetAmount('');
  };

  const handleSetCategoryBudget = () => {
    if (!categoryBudgetAmount.trim() || !selectedCategory) {
      Alert.alert('Error', 'Please enter a valid budget amount and select a category');
      return;
    }

    const amount = parseFloat(categoryBudgetAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid positive number');
      return;
    }

    setCategoryBudgets(prev => ({ ...prev, [selectedCategory]: amount }));
    setShowCategoryBudgetModal(false);
    setSelectedCategory('');
    setCategoryBudgetAmount('');
  };

  const startTutorial = () => {
    setShowTutorial(true);
    setTutorialStep(0);
  };

  const nextTutorialStep = () => {
    if (tutorialStep < 3) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
      setTutorialStep(0);
    }
  };

  // Empty state component with tutorial
  const EmptyStateCard = () => (
    <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
      <MaterialCommunityIcons name="chart-line-variant" size={48} color={theme.textSecondary} />
      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>Start Tracking Your Spending</Text>
      <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
        Add items to your inventory with prices to see your spending analytics here
      </Text>
      <View style={styles.emptyStateButtons}>
        <TouchableOpacity
          style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('Scanner')}
        >
          <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
          <Text style={styles.emptyStateButtonText}>Scan Your First Item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.emptyStateButton, styles.emptyStateButtonSecondary, { borderColor: theme.accent }]}
          onPress={startTutorial}
        >
          <MaterialCommunityIcons name="school" size={20} color={theme.accent} />
          <Text style={[styles.emptyStateButtonText, { color: theme.accent }]}>Take Tutorial</Text>
        </TouchableOpacity>
        {!hasSampleData ? (
          <TouchableOpacity
            style={[styles.emptyStateButton, styles.emptyStateButtonSecondary, { borderColor: theme.primary }]}
            onPress={() => {
              addSampleFinanceData();
              Alert.alert('Sample Data Added', 'Some sample spending data has been added to get you started!');
            }}
          >
            <MaterialCommunityIcons name="database-plus" size={20} color={theme.primary} />
            <Text style={[styles.emptyStateButtonText, { color: theme.primary }]}>Try Sample Data</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.emptyStateButton, styles.emptyStateButtonSecondary, { borderColor: theme.error }]}
            onPress={() => {
              Alert.alert(
                'Remove Sample Data',
                'This will remove the sample finance records added for demo. Your real records will be kept.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => clearSampleFinanceData() }
                ]
              );
            }}
          >
            <MaterialCommunityIcons name="delete" size={20} color={theme.error} />
            <Text style={[styles.emptyStateButtonText, { color: theme.error }]}>Remove Sample Data</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={[styles.menuButtonCircle, { backgroundColor: 'rgba(0,0,0,0.1)' }]} 
            onPress={() => { navigation.openDrawer(); }} 
          > 
            <MaterialCommunityIcons name="menu" size={24} color={theme.text} /> 
          </TouchableOpacity>
          <View style={[styles.titleContainer, { flexShrink: 1 }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons
                name="cash-multiple"
                size={22}
                color={theme.text}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">Finance & Budget</Text>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="tail">Track spending, inventory value, and budget</Text>
          </View>
          <TouchableOpacity style={[styles.menuButtonCircle, { backgroundColor: 'rgba(0,0,0,0.1)' }]} onPress={() => navigation.navigate('Profile')}>
            <MaterialCommunityIcons name="account" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {spendingHistory.length === 0 ? (
          <EmptyStateCard />
        ) : (
          <>
            <PeriodSelector />

            {hasSampleData && (
              <View style={[styles.sampleBanner, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                <View style={styles.sampleBannerLeft}>
                  <MaterialCommunityIcons name="database" size={18} color={theme.textSecondary} />
                  <Text style={[styles.sampleBannerText, { color: theme.textSecondary }]}>Sample finance data is visible</Text>
                </View>
                <TouchableOpacity
                  style={[styles.sampleBannerButton, { backgroundColor: theme.error }]}
                  onPress={() => {
                    Alert.alert(
                      'Remove Sample Data',
                      'This will remove the sample finance records added for demo. Your real records will be kept.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => clearSampleFinanceData() }
                      ]
                    );
                  }}
                >
                  <Text style={styles.sampleBannerButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Main Value Card */}
            <View style={[styles.mainCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}> 
              <View style={styles.mainCardHeader}> 
                <MaterialCommunityIcons name="treasure-chest" size={28} color={theme.primary} /> 
                <Text style={[styles.mainCardTitle, { color: theme.text }]}>Total Spent This {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}</Text> 
              </View> 
              <Text style={[styles.mainValue, { color: theme.primary }]}> 
                £{financialStats.periodSpent.toFixed(2)}
              </Text> 
              <View style={styles.mainCardFooter}> 
                <Text style={[styles.mainCardSubtitle, { color: theme.textSecondary }]}> 
                  Current Inventory: £{financialStats.currentInventoryValue.toFixed(2)} • Consumed: £{financialStats.consumedValue.toFixed(2)}
                </Text> 
              </View> 
            </View>

            {/* Enhanced Budget Card - Flexible periods */}
            {(selectedPeriod === budgetPeriod && (budgetPeriod === 'month' ? monthlyBudget : categoryBudgets[budgetPeriod])) || selectedPeriod !== budgetPeriod ? (
              (selectedPeriod === budgetPeriod && (budgetPeriod === 'month' ? monthlyBudget : categoryBudgets[budgetPeriod])) ? (
                <View style={[styles.budgetCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
                  <View style={styles.budgetCardHeader}>
                    <View style={[styles.budgetIcon, { backgroundColor: theme.accent + '20' }]}>
                      <MaterialCommunityIcons name="target" size={24} color={theme.accent} />
                    </View>
                    <View style={styles.budgetCardInfo}>
                      <Text style={[styles.budgetTitle, { color: theme.text }]}>{budgetPeriod.charAt(0).toUpperCase() + budgetPeriod.slice(1)} Food Budget</Text>
                      <Text style={[styles.budgetAmount, { color: theme.textSecondary }]}>
                        £{financialStats.budgetProgress.spent.toFixed(2)} / £{financialStats.budgetProgress.budget.toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.budgetEditButton, { backgroundColor: theme.accent + '20' }]}
                      onPress={() => {
                        setNewBudgetAmount(financialStats.budgetProgress.budget.toString());
                        setShowBudgetModal(true);
                      }}
                    >
                      <MaterialCommunityIcons name="pencil" size={16} color={theme.accent} />
                    </TouchableOpacity>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: financialStats.budgetProgress.isOverBudget ? theme.error : theme.accent,
                          width: `${Math.min(financialStats.budgetProgress.percentage, 100)}%`
                        }
                      ]}
                    />
                  </View>

                  <View style={styles.budgetFooter}>
                    <Text style={[styles.budgetPercentage, {
                      color: financialStats.budgetProgress.isOverBudget ? theme.error : theme.accent
                    }]}>
                      {financialStats.budgetProgress.percentage.toFixed(0)}%
                    </Text>
                    <Text style={[styles.budgetRemaining, { color: theme.textSecondary }]}>
                      {financialStats.budgetProgress.remaining >= 0
                        ? `£${financialStats.budgetProgress.remaining.toFixed(2)} remaining`
                        : `£${Math.abs(financialStats.budgetProgress.remaining).toFixed(2)} over budget`
                      }
                    </Text>
                  </View>

                  {/* Enhanced Budget Insights with Predictions */}
                  <View style={[styles.budgetInsights, { backgroundColor: theme.background + '50' }]}>
                    {financialStats.budgetProgress.isOverBudget && (
                      <View style={styles.insightItem}>
                        <MaterialCommunityIcons name="alert-triangle" size={14} color={theme.error} />
                        <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                          You're over your {budgetPeriod} budget by £{Math.abs(financialStats.budgetProgress.remaining).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {financialStats.spendingPredictions && (
                      <View style={styles.insightItem}>
                        <MaterialCommunityIcons
                          name={financialStats.spendingPredictions.onTrack ? "trending-down" : "trending-up"}
                          size={14}
                          color={financialStats.spendingPredictions.onTrack ? theme.success : theme.warning}
                        />
                        <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                          Predicted end-of-{budgetPeriod}: £{financialStats.spendingPredictions.predictedTotal.toFixed(2)}
                          ({financialStats.spendingPredictions.daysRemaining} days left)
                        </Text>
                      </View>
                    )}

                    <View style={styles.insightItem}>
                      <MaterialCommunityIcons name="trending-up" size={14} color={theme.primary} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                        Average daily spending: £{(financialStats.periodSpent / (budgetPeriod === 'week' ? (new Date().getDay() + 1) : new Date().getDate())).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.insightItem}>
                      <MaterialCommunityIcons name="calendar" size={14} color={theme.success} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                        {budgetPeriod === 'week' ? (7 - new Date().getDay() - 1) : (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate())} days left this {budgetPeriod}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.budgetCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
                  <View style={styles.budgetCardHeader}>
                    <View style={[styles.budgetIcon, { backgroundColor: theme.accent + '20' }]}>
                      <MaterialCommunityIcons name="target" size={24} color={theme.accent} />
                    </View>
                    <View style={styles.budgetCardInfo}>
                      <Text style={[styles.budgetTitle, { color: theme.text }]}>Set Your {budgetPeriod.charAt(0).toUpperCase() + budgetPeriod.slice(1)} Budget</Text>
                      <Text style={[styles.budgetAmount, { color: theme.textSecondary }]}>
                        Track your food spending with a {budgetPeriod} budget
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.budgetEditButton, { backgroundColor: theme.accent }]}
                      onPress={() => {
                        setNewBudgetAmount('');
                        setShowBudgetModal(true);
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.budgetFooter}>
                    <Text style={[styles.budgetRemaining, { color: theme.textSecondary }]}>
                      Tap the + button to set your {budgetPeriod} food budget
                    </Text>
                  </View>
                </View>
              )
            ) : null}

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Current Inventory"
                value={`£${financialStats.currentInventoryValue.toFixed(2)}`}
                subtitle="Value of items in stock"
                icon="package-variant"
                color={theme.success}
                onPress={() => showItemDetails('Current Inventory', 'This shows the total value of items currently in your inventory.')}
                useAccent
              />
              
              <StatCard
                title="Total Spent"
                value={`£${financialStats.totalSpent.toFixed(2)}`}
                subtitle="All-time spending"
                icon="credit-card"
                color={theme.primary}
                onPress={() => showItemDetails('Total Spent', 'This shows the total amount you have spent on food items.')}
                useAccent
              />
            </View>

            {/* Enhanced Category Breakdown with Budgets */}
            {Object.keys(financialStats.categoryTotals).length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <MaterialCommunityIcons name="chart-pie" size={24} color={theme.primary} />
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Category Breakdown</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addCategoryBudgetButton, { backgroundColor: theme.accent + '20' }]}
                    onPress={() => setShowCategoryBudgetModal(true)}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={theme.accent} />
                  </TouchableOpacity>
                </View>
                <View style={styles.categoryList}>
                  {Object.entries(financialStats.categoryTotals)
                    .sort(([,a], [,b]) => b - a)
                    .map(([cat, amt]) => {
                      const catBudget = financialStats.categoryBudgetProgress[cat];
                      return (
                        <View key={cat} style={[styles.categoryItem, { backgroundColor: theme.background + '30' }]}>
                          <View style={styles.categoryLeft}>
                            <MaterialCommunityIcons name="circle" size={12} color={theme.accent} />
                            <View style={styles.categoryTextContainer}>
                              <Text style={[styles.categoryName, { color: theme.text }]}>{cat}</Text>
                              {catBudget && (
                                <Text style={[styles.categoryBudget, { color: theme.textSecondary }]}>
                                  Budget: £{catBudget.budget.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.categoryRight}>
                            <Text style={[styles.categoryAmount, { color: theme.primary }]}>£{amt.toFixed(2)}</Text>
                            {catBudget && (
                              <View style={styles.categoryProgressContainer}>
                                <View style={[styles.categoryProgressBar, { backgroundColor: theme.border }]}>
                                  <View
                                    style={[
                                      styles.categoryProgressFill,
                                      {
                                        backgroundColor: catBudget.isOverBudget ? theme.error : theme.success,
                                        width: `${Math.min(catBudget.percentage, 100)}%`
                                      }
                                    ]}
                                  />
                                </View>
                                <Text style={[styles.categoryProgressText, {
                                  color: catBudget.isOverBudget ? theme.error : theme.success
                                }]}>
                                  {catBudget.percentage.toFixed(0)}%
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                </View>
              </View>
            )}

            {/* Recent Transactions */}
            <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}> 
              <View style={styles.cardHeader}> 
                <MaterialCommunityIcons name="history" size={24} color={theme.primary} /> 
                <Text style={[styles.cardTitle, { color: theme.text }]}>Recent Transactions</Text> 
              </View> 
              <View style={styles.insightsList}> 
                {periodSpending.length === 0 ? (
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>No purchases in this period.</Text>
                ) : (
                  periodSpending.slice(0, 10).map((r, idx) => (
                    <View key={r.id || idx} style={styles.transactionRow}>
                      <View style={styles.transactionInfo}>
                        <MaterialCommunityIcons name="basket" size={16} color={theme.primary} style={{marginTop: 2}} />
                        <View style={styles.transactionDetails}>
                          <Text style={[styles.transactionName, { color: theme.text }]}>{r.name}</Text>
                          <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
                            {new Date(r.dateSpent).toLocaleDateString()} • {r.quantity}x
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.transactionAmount, { color: theme.primary }]}>
                        £{(r.price * r.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Budget Setting Modal */}
      <Modal
        visible={showBudgetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {budgetPeriod === 'month' && monthlyBudget ? 'Update Monthly Food Budget' :
               categoryBudgets[budgetPeriod] ? `Update ${budgetPeriod.charAt(0).toUpperCase() + budgetPeriod.slice(1)} Food Budget` :
               `Set ${budgetPeriod.charAt(0).toUpperCase() + budgetPeriod.slice(1)} Food Budget`}
            </Text>

            {/* Budget Period Selector */}
            <View style={styles.periodSelectorModal}>
              {['week', 'month', 'year'].map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButtonModal,
                    {
                      backgroundColor: budgetPeriod === period ? theme.primary : 'transparent',
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setBudgetPeriod(period)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    {
                      color: budgetPeriod === period ? '#FFFFFF' : theme.text
                    }
                  ]}>
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.budgetInput, {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text
              }]}
              value={newBudgetAmount}
              onChangeText={setNewBudgetAmount}
              placeholder="Enter budget amount"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setShowBudgetModal(false);
                  setNewBudgetAmount('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.accent }]}
                onPress={handleSetBudget}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {(budgetPeriod === 'month' && monthlyBudget) || categoryBudgets[budgetPeriod] ? 'Update Budget' : 'Set Budget'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Budget Modal */}
      <Modal
        visible={showCategoryBudgetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryBudgetModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Set Category Budget</Text>

            <View style={styles.categoryPicker}>
              {Object.keys(financialStats.categoryTotals).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor: selectedCategory === cat ? theme.primary + '20' : theme.background,
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, { color: theme.text }]}>
                    {cat} (£{financialStats.categoryTotals[cat].toFixed(2)})
                  </Text>
                  {categoryBudgets[cat] && (
                    <Text style={[styles.categoryBudgetText, { color: theme.textSecondary }]}>
                      Current: £{categoryBudgets[cat].toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.budgetInput, {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text
              }]}
              value={categoryBudgetAmount}
              onChangeText={setCategoryBudgetAmount}
              placeholder="Enter budget amount"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setShowCategoryBudgetModal(false);
                  setSelectedCategory('');
                  setCategoryBudgetAmount('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.accent }]}
                onPress={handleSetCategoryBudget}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {categoryBudgets[selectedCategory] ? 'Update Budget' : 'Set Budget'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tutorial Modal */}
      <Modal
        visible={showTutorial}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTutorial(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.tutorialContent, { backgroundColor: theme.surface }]}>
            <View style={styles.tutorialHeader}>
              <MaterialCommunityIcons name="school" size={28} color={theme.accent} />
              <Text style={[styles.tutorialTitle, { color: theme.text }]}>Finance Tutorial</Text>
              <TouchableOpacity onPress={() => setShowTutorial(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.tutorialBody}>
              {tutorialStep === 0 && (
                <View style={styles.tutorialStep}>
                  <Text style={[styles.tutorialStepTitle, { color: theme.text }]}>Step 1: Set Your Budget</Text>
                  <Text style={[styles.tutorialStepText, { color: theme.textSecondary }]}>
                    Start by setting a weekly, monthly, or yearly budget for your food spending. This helps you stay on track with your finances.
                  </Text>
                  <TouchableOpacity
                    style={[styles.tutorialButton, { backgroundColor: theme.accent }]}
                    onPress={() => setShowBudgetModal(true)}
                  >
                    <Text style={styles.tutorialButtonText}>Set Budget Now</Text>
                  </TouchableOpacity>
                </View>
              )}

              {tutorialStep === 1 && (
                <View style={styles.tutorialStep}>
                  <Text style={[styles.tutorialStepTitle, { color: theme.text }]}>Step 2: Category Budgets</Text>
                  <Text style={[styles.tutorialStepText, { color: theme.textSecondary }]}>
                    Set specific budgets for different food categories like Dairy, Meat, or Bakery to better control your spending.
                  </Text>
                  <TouchableOpacity
                    style={[styles.tutorialButton, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      setShowCategoryBudgetModal(true);
                      setShowTutorial(false);
                    }}
                  >
                    <Text style={styles.tutorialButtonText}>Set Category Budgets</Text>
                  </TouchableOpacity>
                </View>
              )}

              {tutorialStep === 2 && (
                <View style={styles.tutorialStep}>
                  <Text style={[styles.tutorialStepTitle, { color: theme.text }]}>Step 3: Track Your Spending</Text>
                  <Text style={[styles.tutorialStepText, { color: theme.textSecondary }]}>
                    Add items to your inventory with prices to automatically track spending. Use the scanner or manual entry.
                  </Text>
                  <TouchableOpacity
                    style={[styles.tutorialButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      navigation.navigate('Scanner');
                      setShowTutorial(false);
                    }}
                  >
                    <Text style={styles.tutorialButtonText}>Start Scanning</Text>
                  </TouchableOpacity>
                </View>
              )}

              {tutorialStep === 3 && (
                <View style={styles.tutorialStep}>
                  <Text style={[styles.tutorialStepTitle, { color: theme.text }]}>Step 4: Monitor & Adjust</Text>
                  <Text style={[styles.tutorialStepText, { color: theme.textSecondary }]}>
                    Check your spending predictions and budget alerts regularly. Adjust budgets as needed to stay on track.
                  </Text>
                  <TouchableOpacity
                    style={[styles.tutorialButton, { backgroundColor: theme.success }]}
                    onPress={() => setShowTutorial(false)}
                  >
                    <Text style={styles.tutorialButtonText}>Got it!</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.tutorialFooter}>
              <View style={styles.tutorialProgress}>
                {[0, 1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.tutorialDot,
                      { backgroundColor: i <= tutorialStep ? theme.accent : theme.border }
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.tutorialNextButton, { backgroundColor: theme.accent }]}
                onPress={nextTutorialStep}
              >
                <Text style={styles.tutorialNextText}>
                  {tutorialStep < 3 ? 'Next' : 'Finish'}
                </Text>
              </TouchableOpacity>
            </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  emptyStateCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyStateButtons: {
    gap: 12,
    width: '100%',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mainCard: {
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  mainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  mainValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mainCardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  budgetCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  budgetCardInfo: {
    flex: 1,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetAmount: {
    fontSize: 14,
  },
  budgetEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  budgetRemaining: {
    fontSize: 12,
    fontWeight: '500',
  },
  budgetInsights: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sampleBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sampleBannerText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  sampleBannerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sampleBannerButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryBudget: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  categoryProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
  },
  categoryProgressBar: {
    height: 6,
    borderRadius: 3,
    flex: 1,
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryProgressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionDetails: {
    marginLeft: 8,
    flex: 1,
  },
  transactionName: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  budgetInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  periodSelectorModal: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButtonModal: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  categoryPicker: {
    marginBottom: 20,
    maxHeight: 200,
  },
  categoryOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryBudgetText: {
    fontSize: 14,
    marginTop: 4,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryBudget: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryAmountContainer: {
    alignItems: 'flex-end',
  },
  categoryProgressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    width: 60,
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  addCategoryBudgetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 18,
    padding: 0,
    maxHeight: '80%',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginLeft: 12,
  },
  tutorialBody: {
    padding: 20,
    flex: 1,
  },
  tutorialStep: {
    alignItems: 'center',
  },
  tutorialStepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  tutorialStepText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  tutorialButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tutorialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  tutorialProgress: {
    flexDirection: 'row',
    gap: 8,
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tutorialNextButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tutorialNextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
