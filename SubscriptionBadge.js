import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions,
  AccessibilityInfo,
  Haptics
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from './ImprovedSubscriptionManager';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_TOUCH_SIZE = 44;

// Configuration constants
const BADGE_CONFIG = {
  expiring: {
    gradient: ['#FCD34D', '#F59E0B', '#D97706'],
    glowColor: 'rgba(252, 211, 77, 0.4)',
    icon: 'alert-circle-outline',
    textColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#D97706',
  },
  trial: {
    gradient: ['#8B5CF6', '#667EEA', '#4F46E5'],
    glowColor: 'rgba(139, 92, 246, 0.4)',
    icon: 'clock-time-four-outline',
    textColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#4F46E5',
  },
  premium: {
    gradient: ['#34D399', '#10B981', '#059669'],
    glowColor: 'rgba(52, 211, 153, 0.4)',
    icon: 'crown-outline',
    textColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#059669',
  },
};

const ANIMATION_CONFIG = {
  pulse: {
    duration: 1500,
    scale: { min: 1, max: 1.08 },
  },
  glow: {
    duration: 3000,
    opacity: { min: 0, max: 0.4 },
  },
  shimmer: {
    duration: 2500,
  },
};

// Custom hooks
const useAnimations = (isExpiringSoon, daysRemaining) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const animationRefs = useRef([]);

  useEffect(() => {
    // Clear existing animations
    animationRefs.current.forEach(anim => anim?.stop());
    animationRefs.current = [];

    // Pulse animation for urgent expiring subscriptions
    if (isExpiringSoon && daysRemaining <= 3) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: ANIMATION_CONFIG.pulse.scale.max,
            duration: ANIMATION_CONFIG.pulse.duration,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: ANIMATION_CONFIG.pulse.scale.min,
            duration: ANIMATION_CONFIG.pulse.duration,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      animationRefs.current.push(pulse);
    }

    // Glow animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: ANIMATION_CONFIG.glow.duration,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: ANIMATION_CONFIG.glow.duration,
          useNativeDriver: true,
        }),
      ])
    );
    glow.start();
    animationRefs.current.push(glow);

    // Shimmer animation for premium badges
    if (!isExpiringSoon) {
      const shimmer = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: ANIMATION_CONFIG.shimmer.duration,
          useNativeDriver: true,
        })
      );
      shimmer.start();
      animationRefs.current.push(shimmer);
    }

    // Cleanup function
    return () => {
      animationRefs.current.forEach(anim => anim?.stop());
    };
  }, [isExpiringSoon, daysRemaining]);

  return { pulseAnim, glowAnim, shimmerAnim };
};

const useBadgeConfig = (subscriptionStatus) => {
  return useMemo(() => {
    if (!subscriptionStatus) return null;

    const { isExpiringSoon, type, daysRemaining = 0 } = subscriptionStatus;
    
    // Determine badge type
    let badgeType = 'premium';
    if (isExpiringSoon) badgeType = 'expiring';
    else if (type === 'trial') badgeType = 'trial';

    // Get configuration
    const config = BADGE_CONFIG[badgeType];

    // Generate badge text
    let badgeText = 'Premium';
    if (daysRemaining <= 0) badgeText = 'Expires Today';
    else if (daysRemaining === 1) badgeText = '1 Day';
    else if (daysRemaining < 10) badgeText = `${daysRemaining} Days`;
    else if (daysRemaining < 100) badgeText = `${daysRemaining}d`;

    // Determine icon size based on text length
    const iconSize = badgeText.length > 6 ? 14 : 16;

    // Generate accessibility label
    const accessibilityLabel = `Subscription status: ${badgeText}${
      type === 'trial' ? ' trial' : ''
    }${isExpiringSoon ? ', expiring soon' : ''}`;

    return {
      ...config,
      badgeText,
      iconSize,
      badgeType,
      accessibilityLabel,
      isUrgent: isExpiringSoon && daysRemaining <= 3,
    };
  }, [subscriptionStatus]);
};

// Main component
const SubscriptionBadge = React.memo(({ theme }) => {
  const navigation = useNavigation();
  const { isSubscribed, getSubscriptionStatus } = useSubscription();
  
  const subscriptionStatus = useMemo(() => {
    return isSubscribed ? getSubscriptionStatus() : null;
  }, [isSubscribed, getSubscriptionStatus]);

  const badgeConfig = useBadgeConfig(subscriptionStatus);
  const { pulseAnim, glowAnim, shimmerAnim } = useAnimations(
    badgeConfig?.badgeType === 'expiring',
    subscriptionStatus?.daysRemaining || 0
  );

  const handlePress = useCallback(async () => {
    // Provide haptic feedback
    try {
      if (badgeConfig?.isUrgent) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      // Haptics not available, continue silently
    }

    // Navigate to premium screen
    navigation.navigate('Premium');
  }, [navigation, badgeConfig?.isUrgent]);

  // Early return if not subscribed or no config
  if (!isSubscribed || !badgeConfig) return null;

  const dynamicStyles = useMemo(() => ({
    badge: {
      ...styles.badge,
      shadowColor: badgeConfig.shadowColor,
      minWidth: Math.max(60, badgeConfig.badgeText.length * 8 + 32),
    },
    touchable: {
      ...styles.touchable,
      minWidth: MIN_TOUCH_SIZE,
      minHeight: MIN_TOUCH_SIZE,
    },
  }), [badgeConfig]);

  return (
    <Animated.View 
      style={[
        styles.badgeContainer, 
        { transform: [{ scale: pulseAnim }] }
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={dynamicStyles.touchable}
        accessible={true}
        accessibilityLabel={badgeConfig.accessibilityLabel}
        accessibilityRole="button"
        accessibilityHint="Double tap to view subscription details"
      >
        <LinearGradient
          colors={badgeConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.badge}
        >
          {/* Main badge content */}
          <View style={styles.badgeContent}>
            <MaterialCommunityIcons 
              name={badgeConfig.icon} 
              size={badgeConfig.iconSize} 
              color={badgeConfig.textColor}
              style={styles.icon}
            />
            <Text style={[styles.text, { color: badgeConfig.textColor }]}>
              {badgeConfig.badgeText}
            </Text>
          </View>
          
          {/* Animated glow effect */}
          <Animated.View 
            style={[
              styles.glowOverlay,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [ANIMATION_CONFIG.glow.opacity.min, ANIMATION_CONFIG.glow.opacity.max],
                }),
                backgroundColor: badgeConfig.glowColor,
              },
            ]}
          />

          {/* Shimmer effect for non-expiring badges */}
          {badgeConfig.badgeType !== 'expiring' && (
            <Animated.View
              style={[
                styles.shimmerOverlay,
                {
                  transform: [{
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, 100],
                    }),
                  }],
                },
              ]}
            />
          )}
        </LinearGradient>

        {/* Glass effect overlay */}
        <View style={styles.glassOverlay} />
        
        {/* Subtle border highlight */}
        <View style={[styles.borderHighlight, { borderColor: badgeConfig.gradient[0] }]} />
      </TouchableOpacity>
    </Animated.View>
  );
});

SubscriptionBadge.displayName = 'SubscriptionBadge';

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1000,
  },
  touchable: {
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  icon: {
    marginRight: 5,
    opacity: 0.95,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -50,
    right: -50,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ skewX: '-20deg' }],
    width: 30,
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  borderHighlight: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default SubscriptionBadge;