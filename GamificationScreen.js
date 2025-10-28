import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,  
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import { useGamification, GamificationDashboard } from './Gamification';
import { getTheme } from './theme';

const { width } = Dimensions.get('window');

export default function GamificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const { points, getUserLevel, getRecentAchievements, getTieredAchievements } = useGamification();
  const [showDashboard, setShowDashboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('progress');
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const userLevel = getUserLevel();
  const recentAchievements = getRecentAchievements(5);
  const tieredAchievements = getTieredAchievements();

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    setTimeout(() => {
      Animated.timing(progressAnim, {
        toValue: userLevel.progress,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }, 500);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const TabButton = ({ id, title, icon, isActive, onPress }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        { 
          backgroundColor: isActive ? theme.accent : 'transparent',
          borderColor: theme.accent 
        }
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons 
        name={icon} 
        size={20} 
        color={isActive ? theme.surface : theme.accent} 
      />
      <Text style={[
        styles.tabText,
        { color: isActive ? theme.surface : theme.accent }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const LevelCard = () => (
    <Animated.View 
      style={[
        styles.levelCard, 
        { 
          backgroundColor: theme.surface,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.levelHeader}>
        <View style={[styles.levelIconContainer, { backgroundColor: `${theme.accent}20` }]}>
          <MaterialCommunityIcons name="crown" size={32} color={theme.accent} />
        </View>
        <View style={styles.levelInfo}>
          <Text style={[styles.levelTitle, { color: theme.text }]}>
            Level {userLevel.level}
          </Text>
          <Text style={[styles.levelSubtitle, { color: theme.textSecondary }]}>
            {points.toLocaleString()} Total Points
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.infoButton, { backgroundColor: `${theme.accent}15` }]}
          onPress={() => setShowDashboard(true)}
        >
          <MaterialCommunityIcons name="information" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
            Progress to Level {userLevel.level + 1}
          </Text>
          <Text style={[styles.progressPercent, { color: theme.accent }]}>
            {Math.round(userLevel.progress * 100)}%
          </Text>
        </View>
        
        <View style={[styles.progressBarContainer, { backgroundColor: `${theme.accent}15` }]}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { 
                backgroundColor: theme.accent,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]} 
          />
          <View style={[styles.progressGlow, { backgroundColor: theme.accent }]} />
        </View>
        
        <Text style={[styles.pointsToNext, { color: theme.textSecondary }]}>
          {userLevel.pointsToNext} points to next level
        </Text>
      </View>
    </Animated.View>
  );

  const EnhancedAchievementItem = ({ achievement, index, showProgress = true }) => {
    const currentTierColor = achievement.currentTier ? 
      achievement.tiers[achievement.currentTier].color : 
      achievement.tiers?.bronze?.color || theme.accent;

    return (
      <Animated.View 
        style={[
          styles.achievementItem,
          {
            opacity: fadeAnim,
            transform: [{ 
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 50 + (index * 10)]
              })
            }]
          }
        ]}
      >
        <View style={styles.achievementLeft}>
          <View style={[styles.achievementIcon, { backgroundColor: currentTierColor }]}>
            <MaterialCommunityIcons 
              name={achievement.icon} 
              size={24} 
              color="white" 
            />
          </View>
          {achievement.isNew && (
            <View style={[styles.newBadge, { backgroundColor: theme.success }]}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}
        </View>
        
        <View style={styles.achievementInfo}>
          <View style={styles.achievementHeader}>
            <Text style={[styles.achievementTitle, { color: theme.text }]}>
              {achievement.title}
            </Text>
            {achievement.currentTier && (
              <View style={[styles.tierBadge, { backgroundColor: currentTierColor }]}>
                <MaterialCommunityIcons 
                  name="star" 
                  size={10} 
                  color="white" 
                  style={styles.tierIcon}
                />
                <Text style={styles.tierText}>
                  {achievement.currentTier.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.achievementDesc, { color: theme.textSecondary }]}>
            {achievement.description}
          </Text>
          
          {showProgress && achievement.progress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressMeta}>
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                  {achievement.progress.current}/{achievement.progress.required}
                </Text>
                {achievement.nextTier && (
                  <Text style={[styles.nextTierText, { color: currentTierColor }]}>
                    Next: {achievement.nextTier.toUpperCase()}
                  </Text>
                )}
              </View>
              
              <View style={[styles.miniProgressBar, { backgroundColor: `${currentTierColor}20` }]}>
                <View 
                  style={[
                    styles.miniProgressFill, 
                    { 
                      backgroundColor: currentTierColor,
                      width: `${achievement.progress.progress * 100}%`
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>
        
        {achievement.points && (
          <View style={styles.achievementRight}>
            <Text style={[styles.achievementPoints, { color: theme.accent }]}>
              +{achievement.points}
            </Text>
            <MaterialCommunityIcons name="plus" size={12} color={theme.accent} />
          </View>
        )}
      </Animated.View>
    );
  };

  const StatsGrid = () => {
    const stats = [
      { icon: 'calendar-check', value: '7', label: 'Days Active', color: theme.success },
      { icon: 'food-variant', value: '12', label: 'Meals Logged', color: theme.primary },
      { icon: 'recycle', value: '5', label: 'Waste-Free', color: theme.warning },
      { icon: 'trophy', value: recentAchievements.length, label: 'Achievements', color: theme.accent }
    ];

    return (
      <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Your Impact
        </Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Animated.View 
              key={stat.label}
              style={[
                styles.statItem,
                {
                  opacity: fadeAnim,
                  transform: [{ 
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1]
                    })
                  }]
                }
              ]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                <MaterialCommunityIcons name={stat.icon} size={24} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    );
  };

  const EmptyState = ({ title, subtitle, icon }) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: `${theme.textSecondary}10` }]}>
        <MaterialCommunityIcons name={icon} size={48} color={theme.textSecondary} />
      </View>
      <Text style={[styles.emptyText, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'progress':
        return (
          <>
            <LevelCard />
            <StatsGrid />
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Achievement Progress
              </Text>
              {tieredAchievements.length > 0 ? (
                tieredAchievements.map((achievement, index) => (
                  <EnhancedAchievementItem 
                    key={achievement.id} 
                    achievement={achievement} 
                    index={index}
                  />
                ))
              ) : (
                <EmptyState 
                  title="No Progress Yet"
                  subtitle="Start using the app to begin your journey!"
                  icon="chart-line"
                />
              )}
            </View>
          </>
        );
      case 'achievements':
        return (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Recent Achievements
            </Text>
            {recentAchievements.length > 0 ? (
              recentAchievements.map((achievement, index) => (
                <EnhancedAchievementItem 
                  key={`${achievement.id}-${index}`} 
                  achievement={achievement} 
                  index={index}
                  showProgress={false}
                />
              ))
            ) : (
              <EmptyState 
                title="No Achievements Yet"
                subtitle="Keep using the app to unlock your first achievement!"
                icon="trophy-outline"
              />
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: `${theme.accent}15` }]}
          onPress={() => {
            const returnTo = route?.params?.returnTo;
            if (returnTo) {
              navigation.navigate(returnTo);
            } else {
              navigation.goBack();
            }
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.accent} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Your Progress</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Level {userLevel.level} • {points.toLocaleString()} pts
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.menuButton, { backgroundColor: `${theme.accent}15` }]}
          onPress={() => setShowDashboard(true)}
        >
          <MaterialCommunityIcons name="cog" size={24} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          <TabButton
            id="progress"
            title="Progress"
            icon="chart-line"
            isActive={selectedTab === 'progress'}
            onPress={() => setSelectedTab('progress')}
          />
          <TabButton
            id="achievements"
            title="Achievements"
            icon="trophy"
            isActive={selectedTab === 'achievements'}
            onPress={() => setSelectedTab('achievements')}
          />
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
      >
        {renderContent()}
      </ScrollView>

      <GamificationDashboard 
        visible={showDashboard} 
        onClose={() => setShowDashboard(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tabScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  levelCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelInfo: {
    marginLeft: 16,
    flex: 1,
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  levelSubtitle: {
    fontSize: 16,
    marginTop: 2,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: '100%',
    borderRadius: 4,
    opacity: 0.3,
  },
  pointsToNext: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  achievementLeft: {
    position: 'relative',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  tierIcon: {
    marginRight: 2,
  },
  tierText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  achievementDesc: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
  },
  nextTierText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniProgressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  achievementRight: {
    alignItems: 'center',
    marginLeft: 12,
  },
  achievementPoints: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});