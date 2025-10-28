import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  Image, 
  StatusBar,
  Pressable,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Simplified and improved animation timings
const TIMING = {
  logoEntry: 1200,
  textEntry: 800,
  progressBar: 2000,
  exit: 500,
  stagger: 200
};

// Custom hook for managing all animations
const useAnimationSequence = (onComplete, totalDuration) => {
  const animations = useRef({
    logoScale: new Animated.Value(0),
    logoOpacity: new Animated.Value(0),
    textOpacity: new Animated.Value(0),
    textSlide: new Animated.Value(30),
    progressWidth: new Animated.Value(0),
    progressOpacity: new Animated.Value(0),
    containerOpacity: new Animated.Value(1),
    backgroundScale: new Animated.Value(1.2),
    glow: new Animated.Value(0)
  }).current;

  const timeoutRef = useRef(null);

  const startSequence = useCallback(() => {
    // Background entrance
    Animated.timing(animations.backgroundScale, {
      toValue: 1,
      duration: TIMING.logoEntry,
      useNativeDriver: true,
    }).start();

    // Logo entrance with bounce
    Animated.parallel([
      Animated.timing(animations.logoOpacity, {
        toValue: 1,
        duration: TIMING.logoEntry * 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(animations.logoScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay: 100,
        useNativeDriver: true,
      })
    ]).start();

    // Glow effect
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animations.glow, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animations.glow, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          })
        ])
      ).start();
    }, TIMING.logoEntry);

    // Text entrance
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(animations.textOpacity, {
          toValue: 1,
          duration: TIMING.textEntry,
          useNativeDriver: true,
        }),
        Animated.spring(animations.textSlide, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    }, TIMING.stagger);

    // Progress bar
    setTimeout(() => {
      Animated.timing(animations.progressOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.timing(animations.progressWidth, {
        toValue: 1,
        duration: TIMING.progressBar,
        useNativeDriver: false,
      }).start();
    }, TIMING.stagger * 2);

    // Exit animation
    timeoutRef.current = setTimeout(() => {
      Animated.timing(animations.containerOpacity, {
        toValue: 0,
        duration: TIMING.exit,
        useNativeDriver: true,
      }).start(() => {
        onComplete?.();
      });
    }, totalDuration);
  }, [animations, onComplete, totalDuration]);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    Object.values(animations).forEach(anim => {
      anim.stopAnimation();
    });
  }, [animations]);

  return { animations, startSequence, cleanup };
};

// Loading spinner component
const LoadingSpinner = () => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.spinner, { transform: [{ rotate: rotation }] }]}>
      <View style={styles.spinnerRing} />
    </Animated.View>
  );
};

// Error screen component
const ErrorScreen = ({ onRetry, error }) => (
  <View style={styles.errorContainer}>
    <StatusBar barStyle="light-content" backgroundColor="#000" />
    
    <View style={styles.errorIcon}>
      <Text style={styles.errorEmoji}>⚠️</Text>
    </View>
    
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>
      {error?.message || 'Unable to load the app. Please try again.'}
    </Text>
    
    <Pressable style={styles.retryButton} onPress={onRetry}>
      <Text style={styles.retryText}>RETRY</Text>
    </Pressable>
  </View>
);

const SplashScreen = ({ 
  onFinish, 
  duration = 4000,
  logoSource = require('./assets/Pantrify-Logo.png'),
  appName = "Pantrify",
  tagline = "Smart Nutrition Analysis",
}) => {
  const [state, setState] = useState({
    visible: true,
    imageLoaded: false,
    error: null,
    retryCount: 0
  });

  const { animations, startSequence, cleanup } = useAnimationSequence(
    () => {
      setState(prev => ({ ...prev, visible: false }));
      onFinish?.();
    },
    duration
  );

  const handleImageLoad = useCallback(() => {
    setState(prev => ({ ...prev, imageLoaded: true, error: null }));
  }, []);

  const handleImageError = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: { message: 'Failed to load logo' },
      imageLoaded: false 
    }));
  }, []);

  const handleRetry = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null, 
      imageLoaded: false,
      retryCount: prev.retryCount + 1 
    }));
  }, []);

  // Start animations when image loads
  useEffect(() => {
    if (state.imageLoaded && !state.error) {
      const timer = setTimeout(startSequence, 100);
      return () => clearTimeout(timer);
    }
  }, [state.imageLoaded, state.error, startSequence]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  if (!state.visible) return null;

  if (state.error) {
    return <ErrorScreen onRetry={handleRetry} error={state.error} />;
  }

  const logoSize = Math.min(width * 0.28, 120);
  const isTablet = width > 768;
  const accent = '#10B981';
  const backgroundColor = '#000';
  const surface = '#111';
  const textColor = '#fff';
  const textSecondary = '#dddddd';
  const gradientColors = ['#0EA5E9', '#10B981'];

  return (
    <>
      <StatusBar barStyle='light-content' backgroundColor={backgroundColor} />
      
      <Animated.View 
        style={[
          styles.container,
          { opacity: animations.containerOpacity }
        ]}
      >
        {/* Gradient background layer */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Animated overlay background bubble for subtle motion */}
        <Animated.View 
          style={[
            styles.background,
            {
              backgroundColor: backgroundColor,
              opacity: 0.25,
              transform: [{ scale: animations.backgroundScale }]
            }
          ]}
        />

        {/* Floating particles */}
        <View style={styles.particles}>
          <View style={[styles.particle, styles.particle1, { backgroundColor: accent, opacity: 0.12 }]} />
          <View style={[styles.particle, styles.particle2, { backgroundColor: accent, opacity: 0.08 }]} />
          <View style={[styles.particle, styles.particle3, { backgroundColor: accent, opacity: 0.1 }]} />
        </View>

        {/* Logo section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: animations.logoOpacity,
              transform: [{ scale: animations.logoScale }]
            }
          ]}
        >
          <View 
            style={[
              styles.logoContainer, 
              { width: logoSize + 32, height: logoSize + 32 }
            ]}
          >
            {/* Glow effect */}
            <Animated.View
              style={[
                styles.logoGlow,
                {
                  backgroundColor: accent,
                  opacity: animations.glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.8],
                  }),
                }
              ]}
            />
            
            <View style={[styles.logoWrapper, { width: logoSize, height: logoSize, backgroundColor: surface }]}>
              {!state.imageLoaded && <LoadingSpinner />}
              
              <Image
                source={logoSource}
                style={[
                  styles.logo,
                  { opacity: state.imageLoaded ? 1 : 0 }
                ]}
                onLoad={handleImageLoad}
                onError={handleImageError}
                resizeMode="cover"
                key={state.retryCount}
              />
            </View>
          </View>
        </Animated.View>

        {/* Text section */}
        <Animated.View
          style={[
            styles.textSection,
            {
              opacity: animations.textOpacity,
              transform: [{ translateY: animations.textSlide }]
            }
          ]}
        >
          <Text style={[styles.appName, { fontSize: isTablet ? 36 : 28, color: textColor }]}>
            {appName}
          </Text>
          
          <View style={[styles.divider, { backgroundColor: accent }]} />
          
          <Text style={[styles.tagline, { fontSize: isTablet ? 16 : 14, color: textSecondary }]}>
            {tagline}
          </Text>
        </Animated.View>

        {/* Progress section */}
        <Animated.View
          style={[
            styles.progressSection,
            { opacity: animations.progressOpacity }
          ]}
        >
          <View style={[styles.progressTrack, { backgroundColor: '#222' }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: animations.progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: accent
                }
              ]}
            />
          </View>
          <Text style={[styles.loadingText, { color: textSecondary }]}>Loading...</Text>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          style={[
            styles.footer,
            { opacity: animations.textOpacity }
          ]}
        >
          <Text style={[styles.footerText, { color: textSecondary }]}>© 2025 Pantrify</Text>
        </Animated.View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  background: {
    position: 'absolute',
    width: width * 2,
    height: height * 2,
    borderRadius: width,
    opacity: 0.8,
  },

  particles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  particle: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.1,
  },

  particle1: {
    width: 100,
    height: 100,
    top: '20%',
    right: '10%',
  },

  particle2: {
    width: 60,
    height: 60,
    bottom: '30%',
    left: '15%',
  },

  particle3: {
    width: 80,
    height: 80,
    top: '60%',
    right: '20%',
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },

  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  logoGlow: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    borderRadius: 100,
    opacity: 0.3,
  },

  logoWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  logo: {
    width: '100%',
    height: '100%',
  },

  spinner: {
    position: 'absolute',
    width: 40,
    height: 40,
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
  },

  spinnerRing: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#4CAF50',
  },

  textSection: {
    alignItems: 'center',
    marginBottom: 60,
  },

  appName: {
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  divider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
  },

  tagline: {
    fontWeight: '400',
    color: '#aaa',
    letterSpacing: 1,
  },

  progressSection: {
    alignItems: 'center',
    width: '70%',
    maxWidth: 280,
    marginBottom: 40,
  },

  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#222',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },

  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  loadingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  footer: {
    position: 'absolute',
    bottom: 50,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '400',
  },

  // Error styles
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  errorIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#ff4444',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },

  errorEmoji: {
    fontSize: 32,
  },

  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },

  errorMessage: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },

  retryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },

  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    letterSpacing: 1,
  },
});

export default SplashScreen;