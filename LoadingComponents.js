import React from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Skeleton Loading Components
export const SkeletonItem = ({ theme, width = '100%', height = 20, style = {} }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.border,
          borderRadius: 4,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard = ({ theme, style = {} }) => (
  <View style={[styles.skeletonCard, { backgroundColor: theme.surface }, style]}>
    <SkeletonItem theme={theme} width="60%" height={16} style={{ marginBottom: 8 }} />
    <SkeletonItem theme={theme} width="40%" height={12} style={{ marginBottom: 12 }} />
    <SkeletonItem theme={theme} width="80%" height={12} />
  </View>
);

export const SkeletonList = ({ theme, count = 3, style = {} }) => (
  <View style={style}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} theme={theme} style={{ marginBottom: 12 }} />
    ))}
  </View>
);

// Enhanced Loading Overlay
export const LoadingOverlay = ({ 
  visible, 
  theme, 
  message = "Loading...", 
  subMessage = "", 
  showSpinner = true,
  style = {} 
}) => {
  const [opacityAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.loadingOverlay, { backgroundColor: theme.overlay, opacity: opacityAnim }]}>
      <View style={[styles.loadingCard, { backgroundColor: theme.surface }]}>
        {showSpinner && (
          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {message}
        </Text>
        {subMessage && (
          <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
            {subMessage}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// Error State Component
export const ErrorState = ({ 
  theme, 
  message = "Something went wrong", 
  subMessage = "Please try again", 
  onRetry, 
  style = {} 
}) => (
  <View style={[styles.errorContainer, style]}>
    <MaterialCommunityIcons 
      name="alert-circle-outline" 
      size={48} 
      color={theme.error || '#EF4444'} 
      style={styles.errorIcon}
    />
    <Text style={[styles.errorTitle, { color: theme.text }]}>
      {message}
    </Text>
    <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
      {subMessage}
    </Text>
    {onRetry && (
      <View style={[styles.retryButton, { backgroundColor: theme.accent }]}>
        <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </View>
    )}
  </View>
);

// Empty State Component
export const EmptyState = ({ 
  theme, 
  icon = "package-variant", 
  title = "No items found", 
  subtitle = "Add some items to get started", 
  actionText, 
  onAction, 
  style = {} 
}) => (
  <View style={[styles.emptyContainer, style]}>
    <MaterialCommunityIcons 
      name={icon} 
      size={64} 
      color={theme.textSecondary} 
      style={styles.emptyIcon}
    />
    <Text style={[styles.emptyTitle, { color: theme.text }]}>
      {title}
    </Text>
    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
      {subtitle}
    </Text>
    {actionText && onAction && (
      <View style={[styles.actionButton, { backgroundColor: theme.accent }]}>
        <Text style={styles.actionButtonText}>{actionText}</Text>
      </View>
    )}
  </View>
);

// Network Status Component
export const NetworkStatus = ({ isOnline, theme }) => {
  const [showBanner, setShowBanner] = React.useState(!isOnline);

  React.useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      setTimeout(() => setShowBanner(false), 2000);
    }
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <Animated.View style={[styles.networkBanner, { backgroundColor: isOnline ? theme.success : theme.error }]}>
      <MaterialCommunityIcons 
        name={isOnline ? "wifi" : "wifi-off"} 
        size={16} 
        color="#fff" 
      />
      <Text style={styles.networkText}>
        {isOnline ? "Back online" : "No internet connection"}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  skeletonCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  spinnerContainer: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  networkBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1001,
  },
  networkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
}); 