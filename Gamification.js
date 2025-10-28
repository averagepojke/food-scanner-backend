import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from './theme';
import { ShoppingListContext } from './App';
import { getUserData, setUserData, migrateToUserStorage } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';

const { width, height } = Dimensions.get('window');

// Tiered Achievement definitions
const TIERED_ACHIEVEMENTS = {
  // Scanning Achievements
  SCANNER: {
    id: 'SCANNER',
    title: 'Barcode Scanner',
    description: 'Scan barcodes to unlock items',
    icon: 'barcode-scan',
    category: 'scanning',
    tiers: {
      bronze: { requirement: 10, points: 50, title: 'Bronze Scanner' },
      silver: { requirement: 30, points: 150, title: 'Silver Scanner' },
      gold: { requirement: 100, points: 500, title: 'Gold Scanner' },
      platinum: { requirement: 300, points: 1000, title: 'Platinum Scanner' }
    }
  },

  // Inventory Management
  INVENTORY_MASTER: {
    id: 'INVENTORY_MASTER',
    title: 'Inventory Master',
    description: 'Add items to your inventory',
    icon: 'archive',
    category: 'inventory',
    tiers: {
      bronze: { requirement: 20, points: 75, title: 'Bronze Organizer' },
      silver: { requirement: 50, points: 200, title: 'Silver Organizer' },
      gold: { requirement: 150, points: 600, title: 'Gold Organizer' },
      platinum: { requirement: 500, points: 1500, title: 'Platinum Organizer' }
    }
  },

  // Meal Logging
  NUTRITION_EXPERT: {
    id: 'NUTRITION_EXPERT',
    title: 'Nutrition Expert',
    description: 'Log your meals and track nutrition',
    icon: 'food-variant',
    category: 'nutrition',
    tiers: {
      bronze: { requirement: 15, points: 60, title: 'Bronze Tracker' },
      silver: { requirement: 50, points: 180, title: 'Silver Tracker' },
      gold: { requirement: 150, points: 550, title: 'Gold Tracker' },
      platinum: { requirement: 500, points: 1200, title: 'Platinum Tracker' }
    }
  },

  // Waste Prevention
  WASTE_WARRIOR: {
    id: 'WASTE_WARRIOR',
    title: 'Waste Warrior',
    description: 'Use items before they expire',
    icon: 'recycle',
    category: 'waste',
    tiers: {
      bronze: { requirement: 25, points: 80, title: 'Bronze Warrior' },
      silver: { requirement: 75, points: 250, title: 'Silver Warrior' },
      gold: { requirement: 200, points: 700, title: 'Gold Warrior' },
      platinum: { requirement: 600, points: 1800, title: 'Platinum Warrior' }
    }
  },

  // Shopping Lists
  SHOPPING_MASTER: {
    id: 'SHOPPING_MASTER',
    title: 'Shopping Master',
    description: 'Complete shopping lists',
    icon: 'cart',
    category: 'shopping',
    tiers: {
      bronze: { requirement: 10, points: 40, title: 'Bronze Shopper' },
      silver: { requirement: 30, points: 120, title: 'Silver Shopper' },
      gold: { requirement: 100, points: 400, title: 'Gold Shopper' },
      platinum: { requirement: 300, points: 1000, title: 'Platinum Shopper' }
    }
  },

  // Streaks
  STREAK_MASTER: {
    id: 'STREAK_MASTER',
    title: 'Streak Master',
    description: 'Maintain daily app usage streaks',
    icon: 'calendar-check',
    category: 'streaks',
    tiers: {
      bronze: { requirement: 7, points: 100, title: 'Bronze Streaker' },
      silver: { requirement: 30, points: 300, title: 'Silver Streaker' },
      gold: { requirement: 100, points: 800, title: 'Gold Streaker' },
      platinum: { requirement: 365, points: 2000, title: 'Platinum Streaker' }
    }
  },

  // Categories
  CATEGORY_EXPLORER: {
    id: 'CATEGORY_EXPLORER',
    title: 'Category Explorer',
    description: 'Add items from different categories',
    icon: 'folder-multiple',
    category: 'categories',
    tiers: {
      bronze: { requirement: 5, points: 60, title: 'Bronze Explorer' },
      silver: { requirement: 10, points: 150, title: 'Silver Explorer' },
      gold: { requirement: 15, points: 400, title: 'Gold Explorer' },
      platinum: { requirement: 20, points: 800, title: 'Platinum Explorer' }
    }
  }
};

// Simple achievements (non-tiered)
const SIMPLE_ACHIEVEMENTS = {
  FIRST_ITEM: {
    id: 'FIRST_ITEM',
    title: 'First Steps',
    description: 'Add your first food item to inventory',
    icon: 'food-apple',
    points: 25,
    category: 'special'
  },
  GOAL_ACHIEVER: {
    id: 'GOAL_ACHIEVER',
    title: 'Goal Achiever',
    description: 'Meet your daily calorie goal',
    icon: 'target',
    points: 50,
    category: 'nutrition'
  },
  BARCODE_SCANNER: {
    id: 'BARCODE_SCANNER',
    title: 'Barcode Scanner',
    description: 'Scan your first barcode',
    icon: 'barcode-scan',
    points: 30,
    category: 'special'
  }
};

// Challenge definitions
const CHALLENGES = {
  DAILY_LOGIN: {
    id: 'DAILY_LOGIN',
    title: 'Daily Login',
    description: 'Open the app every day this week',
    icon: 'calendar-check',
    points: 50,
    duration: 7,
    type: 'daily'
  },
  HEALTHY_EATING: {
    id: 'HEALTHY_EATING',
    title: 'Healthy Eating Week',
    description: 'Log meals with balanced nutrition for 7 days',
    icon: 'food-apple',
    points: 200,
    duration: 7,
    type: 'nutrition'
  },
  WASTE_FREE: {
    id: 'WASTE_FREE',
    title: 'Waste-Free Week',
    description: 'Use all items before they expire this week',
    icon: 'recycle',
    points: 150,
    duration: 7,
    type: 'waste'
  },
  BUDGET_CHALLENGE: {
    id: 'BUDGET_CHALLENGE',
    title: 'Budget Challenge',
    description: 'Stay under your weekly grocery budget',
    icon: 'wallet',
    points: 100,
    duration: 7,
    type: 'finance'
  }
};

// Gamification Context
const GamificationContext = createContext();

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};

export const GamificationProvider = ({ children }) => {
  const { userId } = useAuth();
  const [achievements, setAchievements] = useState({});
  const [tieredAchievements, setTieredAchievements] = useState({});
  const [points, setPoints] = useState(0);
  const [streaks, setStreaks] = useState({
    dailyLogin: 0,
    mealLogging: 0,
    wasteFree: 0
  });
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [stats, setStats] = useState({
    itemsAdded: 0,
    itemsUsed: 0,
    shoppingListsCompleted: 0,
    mealsLogged: 0,
    daysActive: 0,
    categoriesUsed: new Set(),
    expiredItems: 0,
    totalSpent: 0,
    barcodesScanned: 0
  });

  // Load gamification data from storage
  useEffect(() => {
    const loadGamificationData = async () => {
      try {
        if (userId) {
          // Migrate existing data to user-specific storage
          await Promise.all([
            migrateToUserStorage(userId, 'achievements', 'achievements'),
            migrateToUserStorage(userId, 'tieredAchievements', 'tieredAchievements'),
            migrateToUserStorage(userId, 'points', 'points'),
            migrateToUserStorage(userId, 'streaks', 'streaks'),
            migrateToUserStorage(userId, 'activeChallenges', 'activeChallenges'),
            migrateToUserStorage(userId, 'completedChallenges', 'completedChallenges'),
            migrateToUserStorage(userId, 'gamificationStats', 'gamificationStats'),
            migrateToUserStorage(userId, 'lastLoginDate', 'lastLoginDate'),
          ]);
          
          // Load user-specific data
          const [
            storedAchievements,
            storedTieredAchievements,
            storedPoints,
            storedStreaks,
            storedActiveChallenges,
            storedCompletedChallenges,
            storedStats
          ] = await Promise.all([
            getUserData(userId, 'achievements', {}),
            getUserData(userId, 'tieredAchievements', {}),
            getUserData(userId, 'points', 0),
            getUserData(userId, 'streaks', { dailyLogin: 0, mealLogging: 0, wasteFree: 0 }),
            getUserData(userId, 'activeChallenges', []),
            getUserData(userId, 'completedChallenges', []),
            getUserData(userId, 'gamificationStats', {
              itemsAdded: 0,
              itemsUsed: 0,
              shoppingListsCompleted: 0,
              mealsLogged: 0,
              daysActive: 0,
              categoriesUsed: [],
              expiredItems: 0,
              totalSpent: 0,
              barcodesScanned: 0
            })
          ]);

          setAchievements(storedAchievements);
          setTieredAchievements(storedTieredAchievements);
          setPoints(storedPoints);
          setStreaks(storedStreaks);
          setActiveChallenges(storedActiveChallenges);
          setCompletedChallenges(storedCompletedChallenges);
          if (storedStats) {
            storedStats.categoriesUsed = new Set(storedStats.categoriesUsed);
            setStats(storedStats);
          }
        } else {
          // Fallback to non-user-specific storage for non-authenticated users
          const [
            storedAchievements,
            storedTieredAchievements,
            storedPoints,
            storedStreaks,
            storedActiveChallenges,
            storedCompletedChallenges,
            storedStats
          ] = await Promise.all([
            AsyncStorage.getItem('achievements'),
            AsyncStorage.getItem('tieredAchievements'),
            AsyncStorage.getItem('points'),
            AsyncStorage.getItem('streaks'),
            AsyncStorage.getItem('activeChallenges'),
            AsyncStorage.getItem('completedChallenges'),
            AsyncStorage.getItem('gamificationStats')
          ]);

          if (storedAchievements) setAchievements(JSON.parse(storedAchievements));
          if (storedTieredAchievements) setTieredAchievements(JSON.parse(storedTieredAchievements));
          if (storedPoints) setPoints(JSON.parse(storedPoints));
          if (storedStreaks) setStreaks(JSON.parse(storedStreaks));
          if (storedActiveChallenges) setActiveChallenges(JSON.parse(storedActiveChallenges));
          if (storedCompletedChallenges) setCompletedChallenges(JSON.parse(storedCompletedChallenges));
          if (storedStats) {
            const parsedStats = JSON.parse(storedStats);
            parsedStats.categoriesUsed = new Set(parsedStats.categoriesUsed);
            setStats(parsedStats);
          }
        }
      } catch (error) {
      }
    };

    loadGamificationData();
  }, [userId]);

  // Track daily login
  useEffect(() => {
    const trackDailyLogin = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        let lastLogin;
        
        if (userId) {
          lastLogin = await getUserData(userId, 'lastLoginDate', null);
          if (lastLogin !== today) {
            await setUserData(userId, 'lastLoginDate', today);
            updateStreak('dailyLogin');
            updateStats('daysActive');
            checkAchievements();
          }
        } else {
          lastLogin = await AsyncStorage.getItem('lastLoginDate');
          if (lastLogin !== today) {
            await AsyncStorage.setItem('lastLoginDate', today);
            updateStreak('dailyLogin');
            updateStats('daysActive');
            checkAchievements();
          }
        }
      } catch (error) {
      }
    };

    trackDailyLogin();
  }, [userId]);

  // Save gamification data to storage
  useEffect(() => {
    const saveGamificationData = async () => {
      try {
        const statsToSave = { ...stats, categoriesUsed: Array.from(stats.categoriesUsed) };
        
        if (userId) {
          await Promise.all([
            setUserData(userId, 'achievements', achievements),
            setUserData(userId, 'tieredAchievements', tieredAchievements),
            setUserData(userId, 'points', points),
            setUserData(userId, 'streaks', streaks),
            setUserData(userId, 'activeChallenges', activeChallenges),
            setUserData(userId, 'completedChallenges', completedChallenges),
            setUserData(userId, 'gamificationStats', statsToSave)
          ]);
        } else {
          await Promise.all([
            AsyncStorage.setItem('achievements', JSON.stringify(achievements)),
            AsyncStorage.setItem('tieredAchievements', JSON.stringify(tieredAchievements)),
            AsyncStorage.setItem('points', JSON.stringify(points)),
            AsyncStorage.setItem('streaks', JSON.stringify(streaks)),
            AsyncStorage.setItem('activeChallenges', JSON.stringify(activeChallenges)),
            AsyncStorage.setItem('completedChallenges', JSON.stringify(completedChallenges)),
            AsyncStorage.setItem('gamificationStats', JSON.stringify(statsToSave))
          ]);
        }
      } catch (error) {
      }
    };

    saveGamificationData();
  }, [achievements, tieredAchievements, points, streaks, activeChallenges, completedChallenges, stats, userId]);

  // Award points
  const awardPoints = (amount, reason = '') => {
    setPoints(prev => prev + amount);
  };

  // Unlock simple achievement
  const unlockAchievement = (achievementId) => {
    if (!achievements[achievementId]) {
      const achievement = SIMPLE_ACHIEVEMENTS[achievementId];
      if (achievement) {
        setAchievements(prev => ({
          ...prev,
          [achievementId]: {
            ...achievement,
            unlockedAt: new Date().toISOString()
          }
        }));
        awardPoints(achievement.points, `Achievement: ${achievement.title}`);
        return true;
      }
    }
    return false;
  };

  // Check and unlock tiered achievements
  const checkTieredAchievement = (achievementId, currentValue) => {
    const achievement = TIERED_ACHIEVEMENTS[achievementId];
    if (!achievement) return;

    const currentTiered = tieredAchievements[achievementId] || {};
    const tiers = achievement.tiers;
    
    // Check each tier in order
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    
    for (const tier of tierOrder) {
      const tierData = tiers[tier];
      if (currentValue >= tierData.requirement && !currentTiered[tier]) {
        // Unlock this tier
        setTieredAchievements(prev => ({
          ...prev,
          [achievementId]: {
            ...prev[achievementId],
            [tier]: {
              ...tierData,
              unlockedAt: new Date().toISOString()
            }
          }
        }));
        awardPoints(tierData.points, `Tiered Achievement: ${tierData.title}`);
        return tier;
      }
    }
    return null;
  };

  // Update stats
  const updateStats = (statType, value = 1) => {
    setStats(prev => {
      const newStats = { ...prev };
      
      switch (statType) {
        case 'itemsAdded':
          newStats.itemsAdded += value;
          checkTieredAchievement('INVENTORY_MASTER', newStats.itemsAdded);
          break;
        case 'itemsUsed':
          newStats.itemsUsed += value;
          checkTieredAchievement('WASTE_WARRIOR', newStats.itemsUsed);
          break;
        case 'shoppingListsCompleted':
          newStats.shoppingListsCompleted += value;
          checkTieredAchievement('SHOPPING_MASTER', newStats.shoppingListsCompleted);
          break;
        case 'mealsLogged':
          newStats.mealsLogged += value;
          checkTieredAchievement('NUTRITION_EXPERT', newStats.mealsLogged);
          break;
        case 'daysActive':
          newStats.daysActive += value;
          checkTieredAchievement('STREAK_MASTER', newStats.daysActive);
          break;
        case 'categoryUsed':
          newStats.categoriesUsed.add(value);
          checkTieredAchievement('CATEGORY_EXPLORER', newStats.categoriesUsed.size);
          break;
        case 'expiredItems':
          newStats.expiredItems += value;
          break;
        case 'totalSpent':
          newStats.totalSpent += value;
          break;
        case 'barcodesScanned':
          newStats.barcodesScanned += value;
          checkTieredAchievement('SCANNER', newStats.barcodesScanned);
          break;
      }
      
      return newStats;
    });
  };

  // Check and update streaks
  const updateStreak = (streakType, increment = true) => {
    setStreaks(prev => ({
      ...prev,
      [streakType]: increment ? prev[streakType] + 1 : 0
    }));
  };

  // Check achievements based on current stats
  const checkAchievements = () => {
    // Simple achievements
    if (stats.itemsAdded >= 1) {
      unlockAchievement('FIRST_ITEM');
    }
    if (stats.barcodesScanned >= 1) {
      unlockAchievement('BARCODE_SCANNER');
    }
  };

  // Get user level based on points
  const getUserLevel = () => {
    const level = Math.floor(points / 100) + 1;
    const progress = (points % 100) / 100;
    return { level, progress };
  };

  // Get recent achievements
  const getRecentAchievements = (count = 5) => {
    const allAchievements = [
      ...Object.values(achievements),
      ...Object.values(tieredAchievements).flatMap(achievement => 
        Object.values(achievement).filter(tier => tier.unlockedAt)
      )
    ];
    
    return allAchievements
      .filter(achievement => achievement.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
      .slice(0, count);
  };

  // Get achievement progress
  const getAchievementProgress = (achievementId) => {
    const achievement = TIERED_ACHIEVEMENTS[achievementId];
    if (!achievement) return null;

    let currentValue = 0;
    switch (achievementId) {
      case 'INVENTORY_MASTER':
        currentValue = stats.itemsAdded;
        break;
      case 'CATEGORY_EXPLORER':
        currentValue = stats.categoriesUsed.size;
        break;
      case 'SHOPPING_MASTER':
        currentValue = stats.shoppingListsCompleted;
        break;
      case 'NUTRITION_EXPERT':
        currentValue = stats.mealsLogged;
        break;
      case 'WASTE_WARRIOR':
        currentValue = stats.itemsUsed;
        break;
      case 'STREAK_MASTER':
        currentValue = stats.daysActive;
        break;
      case 'SCANNER':
        currentValue = stats.barcodesScanned;
        break;
    }

    const tiers = achievement.tiers;
    const currentTiered = tieredAchievements[achievementId] || {};
    
    // Find the next tier to unlock
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    let nextTier = null;
    let nextRequirement = 0;
    
    for (const tier of tierOrder) {
      if (!currentTiered[tier]) {
        nextTier = tier;
        nextRequirement = tiers[tier].requirement;
        break;
      }
    }

    if (!nextTier) {
      // All tiers unlocked
      return {
        current: currentValue,
        required: tiers.platinum.requirement,
        progress: 1,
        nextTier: 'platinum',
        completed: true
      };
    }

    return {
      current: currentValue,
      required: nextRequirement,
      progress: Math.min(currentValue / nextRequirement, 1),
      nextTier: nextTier,
      completed: false
    };
  };

  // Get tiered achievements for display
  const getTieredAchievements = () => {
    return Object.entries(TIERED_ACHIEVEMENTS).map(([id, achievement]) => {
      const progress = getAchievementProgress(id);
      const currentTiered = tieredAchievements[id] || {};
      
      return {
        ...achievement,
        progress,
        unlockedTiers: currentTiered
      };
    });
  };

  const value = {
    achievements,
    tieredAchievements,
    points,
    streaks,
    activeChallenges,
    completedChallenges,
    stats,
    TIERED_ACHIEVEMENTS,
    SIMPLE_ACHIEVEMENTS,
    CHALLENGES,
    awardPoints,
    unlockAchievement,
    checkTieredAchievement,
    updateStreak,
    updateStats,
    checkAchievements,
    getUserLevel,
    getRecentAchievements,
    getAchievementProgress,
    getTieredAchievements
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};

// Achievement Modal Component
export const AchievementModal = ({ visible, achievement, onClose }) => {
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!achievement || !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View 
          style={[
            styles.detailModal, 
            { 
              backgroundColor: theme.surface,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.modalHandle} />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
          </TouchableOpacity>
          <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>{achievement.title}</Text>
            </View>

            <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.detailDescription, { color: theme.textSecondary }]}>
                {achievement.description}
              </Text>
            </View>

            <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Points Awarded</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>+{achievement.points}</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Gamification Dashboard Component
export const GamificationDashboard = ({ visible, onClose }) => {
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const {
    points,
    achievements,
    tieredAchievements,
    streaks,
    activeChallenges,
    getUserLevel,
    getRecentAchievements,
    getTieredAchievements,
    TIERED_ACHIEVEMENTS
  } = useGamification();

  const userLevel = getUserLevel();
  const recentAchievements = getRecentAchievements();
  const tieredAchievementsList = getTieredAchievements();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.dashboardContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.dashboardHeader, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
            <MaterialCommunityIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.dashboardTitle, { color: theme.text }]}>
            Your Progress
          </Text>
        </View>

        <ScrollView style={styles.dashboardContent} showsVerticalScrollIndicator={false}>
          {/* Level and Points */}
          <View style={[styles.levelCard, { backgroundColor: theme.surface }]}>
            <View style={styles.levelInfo}>
              <Text style={[styles.levelTitle, { color: theme.text }]}>Level {userLevel.level}</Text>
              <Text style={[styles.pointsText, { color: theme.textSecondary }]}>
                {points} Points
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: theme.primary,
                    width: `${userLevel.progress * 100}%`
                  }
                ]} 
              />
            </View>
          </View>

          {/* Tiered Achievements */}
          <View style={[styles.achievementsCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Achievements</Text>
            {tieredAchievementsList.map((achievement, index) => (
              <View key={achievement.id} style={styles.achievementItem}>
                <MaterialCommunityIcons 
                  name={achievement.icon} 
                  size={24} 
                  color={theme.primary} 
                />
                <View style={styles.achievementInfo}>
                  <Text style={[styles.achievementTitle, { color: theme.text }]}>
                    {achievement.title}
                  </Text>
                  <Text style={[styles.achievementDesc, { color: theme.textSecondary }]}>
                    {achievement.description}
                  </Text>
                  {achievement.progress && (
                    <View style={[styles.progressBar, { backgroundColor: theme.border, marginTop: 8 }]}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            backgroundColor: theme.success,
                            width: `${achievement.progress.progress * 100}%`
                          }
                        ]} 
                      />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Recent Achievements */}
          <View style={[styles.recentCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Unlocks</Text>
            {recentAchievements.length > 0 ? (
              recentAchievements.map((achievement, index) => (
                <View key={`${achievement.id}-${index}`} style={styles.achievementItem}>
                  <MaterialCommunityIcons 
                    name={achievement.icon} 
                    size={24} 
                    color={theme.accent} 
                  />
                  <View style={styles.achievementInfo}>
                    <Text style={[styles.achievementTitle, { color: theme.text }]}>
                      {achievement.title}
                    </Text>
                    <Text style={[styles.achievementDesc, { color: theme.textSecondary }]}>
                      {achievement.description}
                    </Text>
                  </View>
                  <Text style={[styles.achievementPoints, { color: theme.accent }]}>
                    +{achievement.points}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No achievements unlocked yet. Keep using the app!
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModal: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  detailContent: {
    padding: 20,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dashboardContainer: {
    flex: 1,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeIcon: {
    padding: 8,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  dashboardContent: {
    flex: 1,
    padding: 16,
  },
  levelCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  levelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  achievementsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  recentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  achievementDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  achievementPoints: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
});