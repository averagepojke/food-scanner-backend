import React, { useEffect, useRef, useContext } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getTheme } from './theme';
import { ShoppingListContext } from './App';

const { width } = Dimensions.get('window');

export const AchievementNotification = ({ visible, achievement, onHide }) => {
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  // Get tier color if it's a tiered achievement
  const getTierColor = () => {
    if (achievement && achievement.tier) {
      const tierColors = {
        bronze: '#CD7F32',
        silver: '#C0C0C0', 
        gold: '#FFD700',
        platinum: '#E5E4E2'
      };
      return tierColors[achievement.tier] || '#3B82F6';
    }
    return '#3B82F6';
  };

  useEffect(() => {
    if (visible && achievement) {
      // Slide in from top
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after 3 seconds
      const timer = setTimeout(() => {
        hideNotification();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, achievement]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible || !achievement) return null;

  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: slideAnim },
            { scale: scaleAnim }
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[styles.notification, { backgroundColor: theme.surface }]}>
        <View style={[styles.iconContainer, { backgroundColor: getTierColor() }]}>
          <MaterialCommunityIcons 
            name={achievement.icon} 
            size={24} 
            color={theme.surface} 
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            🎉 Achievement Unlocked!
          </Text>
          <Text style={[styles.achievementName, { color: theme.text }]}>
            {achievement.title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {achievement.description}
          </Text>
        </View>
        <View style={[styles.pointsBadge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.pointsText, { color: theme.surface }]}>
            +{achievement.points}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 