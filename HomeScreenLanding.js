import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from './theme';
import { useGamification } from './Gamification';
import { useAuth } from './food-scanner-app/AuthContext';
import { navigationRef } from './navigationRef';

const { width, height } = Dimensions.get('window');



// Streak Detail Modal
const StreakModal = ({ visible, onClose, theme, isDefaultTheme }) => {
  const { streaks } = useGamification();
  const dailyLoginStreak = streaks?.dailyLogin || 0;
  const modalSlideAnim = new Animated.Value(0);
  const overlayOpacityAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(modalSlideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalSlideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getStreakData = () => {
    const streak = dailyLoginStreak;
    
    if (streak === 0) return {
      color: isDefaultTheme ? '#9CA3AF' : theme.primary,
      bgColor: isDefaultTheme ? '#F3F4F6' : theme.primary + '20',
      level: 'Ready to Start',
      message: 'Begin your journey today!',
      icon: 'rocket-launch-outline',
      nextMilestone: 1,
      tips: ['Open the app daily', 'Scan your first item', 'Track your food inventory'],
    };
    if (streak < 7) return {
      color: isDefaultTheme ? '#F59E0B' : theme.primary,
      bgColor: isDefaultTheme ? '#FEF3C7' : theme.primary + '20',
      level: 'Building Momentum',
      message: 'You\'re on the right track!',
      icon: 'fire',
      nextMilestone: 7,
      tips: ['Keep the momentum going', 'Try scanning new items', 'Explore meal planning'],
    };
    if (streak < 30) return {
      color: isDefaultTheme ? '#EF4444' : theme.primary,
      bgColor: isDefaultTheme ? '#FEE2E2' : theme.primary + '20',
      level: 'On Fire',
      message: 'You\'re absolutely crushing it!',
      icon: 'fire',
      nextMilestone: 30,
      tips: ['Share your progress', 'Try advanced features', 'Help others get started'],
    };
    if (streak < 100) return {
      color: isDefaultTheme ? '#8B5CF6' : theme.primary,
      bgColor: isDefaultTheme ? '#EDE9FE' : theme.primary + '20',
      level: 'Legendary Status',
      message: 'You\'re an inspiration to others!',
      icon: 'crown',
      nextMilestone: 100,
      tips: ['Become a power user', 'Share your best practices', 'Mentor new users'],
    };
    return {
      color: isDefaultTheme ? '#DC2626' : theme.primary,
      bgColor: isDefaultTheme ? '#FEE2E2' : theme.primary + '20',
      level: 'Hall of Fame',
      message: 'Welcome to the elite! 🏆',
      icon: 'trophy',
      nextMilestone: null,
      tips: ['You\'ve mastered the app', 'Consider sharing your story', 'Keep inspiring others'],
    };
  };

  const streakData = getStreakData();
  const progressWidth = streakData.nextMilestone 
    ? Math.min((dailyLoginStreak / streakData.nextMilestone) * 100, 100)
    : 100;

  const getMilestones = () => [
    { days: 7, label: 'Week Warrior', achieved: dailyLoginStreak >= 7 },
    { days: 30, label: 'Monthly Master', achieved: dailyLoginStreak >= 30 },
    { days: 100, label: 'Century Club', achieved: dailyLoginStreak >= 100 },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.modalOverlay, 
          { opacity: overlayOpacityAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.modalOverlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.surface },
            {
              transform: [{
                translateY: modalSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              }],
            },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalIconContainer, { backgroundColor: streakData.bgColor }]}>
                <MaterialCommunityIcons 
                  name={streakData.icon} 
                  size={32} 
                  color={streakData.color} 
                />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {dailyLoginStreak} Day Streak
                </Text>
                <Text style={[styles.modalSubtitle, { color: streakData.color }]}>
                  {streakData.level}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.overlay }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Progress Section */}
          {streakData.nextMilestone && (
            <View style={styles.modalProgressSection}>
              <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
                {streakData.message}
              </Text>
              
              <View style={styles.modalProgressContainer}>
                                 <View style={[styles.modalProgressBar, { backgroundColor: theme.border }]}>
                   <View
                     style={[
                       styles.modalProgressFill,
                       { 
                         backgroundColor: isDefaultTheme ? streakData.color : theme.primary,
                         width: `${progressWidth}%`,
                       },
                     ]}
                   />
                 </View>
                <Text style={[styles.modalProgressText, { color: theme.textSecondary }]}>
                  {streakData.nextMilestone - dailyLoginStreak} days to {streakData.nextMilestone === 7 ? 'Week Warrior' : streakData.nextMilestone === 30 ? 'Monthly Master' : 'Century Club'}
                </Text>
              </View>
            </View>
          )}

          {/* Milestones */}
          <View style={styles.modalMilestonesSection}>
            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Milestones</Text>
            <View style={styles.modalMilestones}>
              {getMilestones().map((milestone, index) => (
                                 <View 
                   key={milestone.days}
                   style={[
                     styles.modalMilestone,
                     { 
                       backgroundColor: milestone.achieved ? 
                         (isDefaultTheme ? streakData.color + '20' : theme.primary + '20') : 
                         theme.overlay,
                       borderColor: milestone.achieved ? 
                         (isDefaultTheme ? streakData.color : theme.primary) : 
                         theme.border,
                     }
                   ]}
                 >
                   <MaterialCommunityIcons 
                     name={milestone.achieved ? "check-circle" : "circle-outline"} 
                     size={20} 
                     color={milestone.achieved ? 
                       (isDefaultTheme ? streakData.color : theme.primary) : 
                       theme.textSecondary} 
                   />
                   <View style={styles.modalMilestoneText}>
                     <Text style={[
                       styles.modalMilestoneLabel, 
                       { color: milestone.achieved ? theme.text : theme.textSecondary }
                     ]}>
                       {milestone.label}
                     </Text>
                     <Text style={[
                       styles.modalMilestoneDays, 
                       { color: milestone.achieved ? 
                         (isDefaultTheme ? streakData.color : theme.primary) : 
                         theme.textSecondary }
                     ]}>
                       {milestone.days} days
                     </Text>
                   </View>
                 </View>
              ))}
            </View>
          </View>

          {/* Tips Section */}
          <View style={styles.modalTipsSection}>
            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Keep it going!</Text>
            <View style={styles.modalTips}>
              {streakData.tips.map((tip, index) => (
                <View key={index} style={styles.modalTip}>
                  <MaterialCommunityIcons 
                    name="lightbulb-outline" 
                    size={16} 
                    color={theme.accent} 
                  />
                  <Text style={[styles.modalTipText, { color: theme.textSecondary }]}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
          </Modal>
    );
  };

// Compact Streak Header Integration
const StreakHeaderIntegration = ({ theme, user, navigation, headerOpacity, onStreakPress }) => {
  const { streaks } = useGamification();
  const dailyLoginStreak = streaks?.dailyLogin || 0;
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (dailyLoginStreak > 0) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    }
  }, [dailyLoginStreak]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };



  return (
    <Animated.View
      style={[
        styles.enhancedHeader,
        { backgroundColor: theme.surface, opacity: headerOpacity },
      ]}
    >
      <LinearGradient
        colors={[theme.primary + '10', 'transparent']}
        style={styles.headerGradient}
      />
             <View style={styles.headerTop}>
         <TouchableOpacity
           style={[styles.menuButton, { backgroundColor: theme.overlay }]}
           onPress={() => navigation.openDrawer()}
           activeOpacity={0.7}
         >
           <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
         </TouchableOpacity>
         
         <TouchableOpacity
           style={[styles.profileButton, { backgroundColor: theme.overlay }]}
           onPress={() => navigation.navigate('Profile')}
           activeOpacity={0.7}
         >
           <MaterialCommunityIcons name="account-circle" size={32} color={theme.primary} />
         </TouchableOpacity>
       </View>
      
      <View style={styles.headerContent}>
        <Text style={[styles.greeting, { color: theme.textSecondary }]}>
          {getGreeting()}
        </Text>
        <Text style={[styles.userName, { color: theme.text }]}>
          {user?.displayName || 'Welcome back!'}
        </Text>
      </View>
    </Animated.View>
  );
};

// Redesigned Stats Card with integrated mini streak
const ModernStatCard = ({ icon, value, label, color, theme, delay = 0, trend }) => {
  const slideAnim = new Animated.Value(30);
  const opacityAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay + 100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, [theme]);

  return (
    <Animated.View
      style={[
        styles.modernStatCard,
        { backgroundColor: theme.surface, shadowColor: theme.cardShadow },
        { 
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }], 
          opacity: opacityAnim 
        },
      ]}
    >
      <View style={[styles.statIconWrapper, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.modernStatValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.modernStatLabel, { color: theme.textSecondary }]}>{label}</Text>
      {trend && (
        <View style={styles.trendIndicator}>
          <MaterialCommunityIcons 
            name={trend > 0 ? "trending-up" : "trending-down"} 
            size={12} 
            color={trend > 0 ? theme.secondary : theme.error} 
          />
        </View>
      )}
    </Animated.View>
  );
};

// Subtle Streak Indicator in Stats Row
const StreakStatCard = ({ theme, delay = 0, onPress, isDefaultTheme }) => {
  const { streaks } = useGamification();
  const dailyLoginStreak = streaks?.dailyLogin || 0;
  const slideAnim = new Animated.Value(30);
  const opacityAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay + 100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();

    if (dailyLoginStreak > 0) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    }
  }, [theme, dailyLoginStreak]);

  const getStreakData = () => {
    const streak = dailyLoginStreak;
    
    if (streak === 0) return { 
      color: isDefaultTheme ? '#9CA3AF' : theme.primary, 
      icon: 'calendar-outline' 
    };
    if (streak < 7) return { 
      color: isDefaultTheme ? '#F59E0B' : theme.primary, 
      icon: 'fire' 
    };
    if (streak < 30) return { 
      color: isDefaultTheme ? '#EF4444' : theme.primary, 
      icon: 'fire' 
    };
    if (streak < 100) return { 
      color: isDefaultTheme ? '#8B5CF6' : theme.primary, 
      icon: 'crown' 
    };
    return { 
      color: isDefaultTheme ? '#DC2626' : theme.primary, 
      icon: 'trophy' 
    };
  };

  const streakData = getStreakData();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.modernStatCard,
          { backgroundColor: theme.surface, shadowColor: theme.cardShadow },
          { 
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }], 
            opacity: opacityAnim 
          },
        ]}
      >
        <Animated.View 
          style={[
            styles.statIconWrapper, 
            { 
              backgroundColor: streakData.color + '15',
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <MaterialCommunityIcons name={streakData.icon} size={28} color={streakData.color} />
        </Animated.View>
        <Text style={[styles.modernStatValue, { color: theme.text }]}>{dailyLoginStreak}</Text>
        <Text style={[styles.modernStatLabel, { color: theme.textSecondary }]}>Day Streak</Text>
        
                 {/* Mini progress indicator */}
         {dailyLoginStreak > 0 && (
           <View style={styles.miniProgressContainer}>
             <View style={[styles.miniProgressDot, { 
               backgroundColor: isDefaultTheme ? streakData.color : theme.primary 
             }]} />
             <View style={[styles.miniProgressDot, { 
               backgroundColor: dailyLoginStreak > 6 ? 
                 (isDefaultTheme ? streakData.color : theme.primary) : 
                 theme.border 
             }]} />
             <View style={[styles.miniProgressDot, { 
               backgroundColor: dailyLoginStreak > 29 ? 
                 (isDefaultTheme ? streakData.color : theme.primary) : 
                 theme.border 
             }]} />
           </View>
         )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Enhanced Quick Action Card (unchanged)
const EnhancedQuickActionCard = ({ icon, title, subtitle, onPress, color, theme, delay = 0 }) => {
  const scaleAnim = new Animated.Value(0.8);
  const opacityAnim = new Animated.Value(0);
  const translateAnim = new Animated.Value(30);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [theme]);

  return (
    <Animated.View
      style={[
        { 
          transform: [{ scale: scaleAnim }, { translateY: translateAnim }], 
          opacity: opacityAnim 
        },
        styles.enhancedActionCard,
        { backgroundColor: theme.surface, shadowColor: theme.cardShadow },
      ]}
    >
      <TouchableOpacity
        style={styles.enhancedActionContent}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[color + '20', color + '10']}
          style={styles.actionGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        <View style={[styles.enhancedIconContainer, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={icon} size={28} color={color} />
        </View>
        
        <View style={styles.enhancedActionText}>
          <Text style={[{ color: '#000000', fontSize: 17, fontWeight: '700', marginBottom: 4 }]}>{title}</Text>
          <Text style={[styles.enhancedActionSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        
        <View style={[styles.actionArrow, { backgroundColor: theme.overlay }]}>
          <MaterialCommunityIcons
            name="arrow-right"
            size={18}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const FRUIT_EMOJIS = [
  '🍎', '🍒', '🍇', '🍍', '🍉', '🍊', '🍋', '🍌', '🍑', '🍓', '🥝', '🥭', '🍈', '🍏', '🍐', '🥥',
];

export default function HomeScreenLanding() {
  const navigation = useNavigation();
  const { darkMode, shoppingList, foodInventory, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const isDefaultTheme = !accentKey || accentKey === 'default';
  const [headerOpacity] = useState(new Animated.Value(0));
  const { getUserLevel, points } = useGamification();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [fruitEmoji, setFruitEmoji] = useState(FRUIT_EMOJIS[0]);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  const handleRefresh = async () => {
    const randomFruit = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
    setFruitEmoji(randomFruit);
    setRefreshing(true);

    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
      isInteraction: false,
    }).start();

    await new Promise(resolve => setTimeout(resolve, 1200));
    setRefreshing(false);
    spinAnim.setValue(0);
  };

  useEffect(() => {
    StatusBar.setBarStyle(theme.statusBar, true);
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [darkMode, theme]);

  // Load onboarding selection
  useEffect(() => {
    const loadOnboardingSelection = async () => {
      try {
        const selection = await AsyncStorage.getItem('onboardingSelection');
        if (selection) {
          setSelectedFeatures(JSON.parse(selection));
        } else {
          setSelectedFeatures([]);
        }
      } catch (e) {
        setSelectedFeatures([]);
      }
    };
    loadOnboardingSelection();
  }, []);

  // Check for refresh trigger from onboarding completion
  useEffect(() => {
    if (global.refreshMainAppSelection) {
      const loadOnboardingSelection = async () => {
        try {
          const selection = await AsyncStorage.getItem('onboardingSelection');
          if (selection) {
            setSelectedFeatures(JSON.parse(selection));
          } else {
            setSelectedFeatures([]);
          }
        } catch (e) {
          setSelectedFeatures([]);
        }
      };
      loadOnboardingSelection();
    }
  });

  // Determine which features to show based on selection
  const showAll = selectedFeatures.includes('all');
  const showInventory = showAll || selectedFeatures.includes('inventory');
  const showMeal = showAll || selectedFeatures.includes('meal');
  const showShopping = showAll || selectedFeatures.includes('shopping');

  const quickActions = [
    {
      icon: 'barcode-scan',
      title: 'Scan Food',
      subtitle: 'Quick barcode scanning',
      onPress: () => navigation.navigate('Scanner'),
      color: isDefaultTheme ? '#3B82F6' : theme.primary,
      show: true, // Always show scanner
    },
    {
      icon: 'food-apple',
      title: 'My Inventory',
      subtitle: 'Manage your food items',
      onPress: () => navigation.navigate('Food Inventory'),
      color: isDefaultTheme ? '#10B981' : theme.primary,
      show: showInventory,
    },
    {
      icon: 'chef-hat',
      title: 'Meal Maker',
      subtitle: 'Create delicious meals',
      onPress: () => navigation.navigate('Meal Maker'),
      color: isDefaultTheme ? '#F59E0B' : theme.primary,
      show: showMeal,
    },
    {
      icon: 'calendar-check',
      title: 'Meal Planning',
      subtitle: 'Plan your week ahead',
      onPress: () => navigation.navigate('Meal Planner'),
      color: isDefaultTheme ? '#8B5CF6' : theme.primary,
      show: showMeal,
    },
    {
      icon: 'cart-outline',
      title: 'Shopping List',
      subtitle: 'Never forget an item',
      onPress: () => navigation.navigate('Shopping List'),
      color: isDefaultTheme ? '#F59E0B' : theme.primary,
      show: showShopping,
    },
  ];

  const expiringCount = foodInventory?.filter(item => {
    const today = new Date();
    const expiry = new Date(item.expiry);
    const diffTime = expiry - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysLeft <= 3;
  }).length || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background} />
      
      <StreakHeaderIntegration 
        theme={theme} 
        user={user} 
        navigation={navigation} 
        headerOpacity={headerOpacity}
        onStreakPress={() => setStreakModalVisible(true)}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            tintColor="transparent"
          />
        }
      >
        {refreshing && (
          <View style={styles.refreshFruit} pointerEvents="none">
            <Animated.Text
              style={[
                styles.fruitEmoji,
                {
                  transform: [{
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }],
                }
              ]}
            >
              {fruitEmoji}
            </Animated.Text>
          </View>
        )}

        {/* Enhanced Stats Grid with Integrated Streak */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Overview</Text>
          <View style={styles.modernStatsGrid}>
                         <ModernStatCard
               icon="food-variant"
               value={foodInventory?.length || 0}
               label="Food Items"
               color={isDefaultTheme ? '#3B82F6' : theme.primary}
               theme={theme}
               delay={100}
             />
             <StreakStatCard
               theme={theme}
               delay={200}
               onPress={() => setStreakModalVisible(true)}
               isDefaultTheme={isDefaultTheme}
             />
             <ModernStatCard
               icon="cart"
               value={shoppingList?.length || 0}
               label="Shopping List"
               color={isDefaultTheme ? '#10B981' : theme.primary}
               theme={theme}
               delay={300}
             />
             <ModernStatCard
               icon="alert-circle"
               value={expiringCount}
               label="Expiring Soon"
               color={isDefaultTheme ? '#EF4444' : theme.primary}
               theme={theme}
               delay={400}
             />
          </View>
        </View>

        {/* Enhanced Quick Actions - Now the main focus */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.enhancedActionsGrid}>
            {quickActions
              .filter(action => action.show)
              .map((action, index) => (
                <EnhancedQuickActionCard
                  key={`action-${index}`}
                  {...action}
                  theme={theme}
                  delay={index * 100 + 500}
                />
              ))}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Enhanced FAB */}
      <TouchableOpacity
        style={[styles.enhancedFab, { backgroundColor: theme.primary }]}
        onPress={() => navigationRef.navigate('Scanner')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[theme.primary, theme.primary + 'DD']}
          style={styles.fabGradient}
        />
        <MaterialCommunityIcons name="barcode-scan" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Streak Detail Modal */}
      <StreakModal
        visible={streakModalVisible}
        onClose={() => setStreakModalVisible(false)}
        theme={theme}
        isDefaultTheme={isDefaultTheme}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  enhancedHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerContent: {
    paddingLeft: 4,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  refreshFruit: {
    alignItems: 'center',
    marginTop: -32,
    marginBottom: 16,
  },
  fruitEmoji: {
    fontSize: 32,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  modernStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  modernStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernStatValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  modernStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Mini progress indicator for streak card
  miniProgressContainer: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 3,
  },
  miniProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  trendIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  enhancedActionsGrid: {
    gap: 12,
  },
  enhancedActionCard: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  actionGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  enhancedActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  enhancedIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  enhancedActionText: {
    flex: 1,
  },
  enhancedActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  enhancedActionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  actionArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
  enhancedFab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  fabGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouch: {
    flex: 1,
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalProgressSection: {
    marginBottom: 32,
  },
  modalMessage: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalProgressContainer: {
    alignItems: 'center',
  },
  modalProgressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalProgressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalMilestonesSection: {
    marginBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalMilestones: {
    gap: 12,
  },
  modalMilestone: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalMilestoneText: {
    marginLeft: 12,
    flex: 1,
  },
  modalMilestoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modalMilestoneDays: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalTipsSection: {
    marginBottom: 16,
  },
  modalTips: {
    gap: 12,
  },
  modalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  modalTipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});