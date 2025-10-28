import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from './ImprovedSubscriptionManager';
import { SafeAreaView} from 'react-native-safe-area-context';


const THEME = {
  primary: '#3B82F6',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
};

const FEATURES = [
  {
    key: 'calorie',
    label: 'Calorie Tracking',
    icon: 'fire',
    description: 'Track your daily calories and nutrition intake.',
    color: '#EF4444',
  },
  {
    key: 'meal',
    label: 'Meal Planning',
    icon: 'calendar-week',
    description: 'Plan your meals for the week with smart suggestions.',
    color: '#8B5CF6',
  },
  {
    key: 'inventory',
    label: 'Food Inventory',
    icon: 'food-apple',
    description: 'Manage what food you have at home and track expiration dates.',
    color: '#10B981',
  },
  {
    key: 'shopping',
    label: 'Shopping List',
    icon: 'cart-outline',
    description: 'Keep track of what you need to buy with smart recommendations.',
    color: '#F59E0B',
  },
  {
    key: 'finance',
    label: 'Finance & Budget',
    icon: 'cash-multiple',
    description: 'Track your food spending and stay within budget.',
    color: '#06B6D4',
  },
];

const LOADING_MESSAGES = [
  'Setting up your personalized experience...',
  'Preparing your dashboard...',
  'Almost ready to go...',
];

const { width } = Dimensions.get('window');
const isWide = width > 600;

export default function OnboardingScreen() {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const navigation = useNavigation();
  const { isFirstTime, showPaywallAfterOnboarding } = useSubscription();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessage(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const toggleSelect = (key) => {
    if (selected.includes(key)) {
      setSelected(selected.filter(k => k !== key));
    } else {
      setSelected([...selected, key]);
    }
  };


  const handleContinue = async () => {
    if (selected.length === 0) {
      Alert.alert(
        'Selection Required',
        'Please select at least one feature to continue.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    try {
      setLoading(true);
      await Promise.all([
        AsyncStorage.setItem('onboardingSelection', JSON.stringify(selected)),
        AsyncStorage.setItem('onboardingCompleted', 'true')
      ]);
  
      // ✅ After saving, let RootNavigator handle the navigation automatically
      
      // 🎯 Show paywall for first-time users after onboarding completion
      if (isFirstTime && showPaywallAfterOnboarding) {
        setTimeout(() => {
          showPaywallAfterOnboarding();
        }, 500); // Small delay to ensure navigation completes first
      }
      
      // Trigger the callback to force RootNavigator to re-evaluate
      if (global.onboardingCompletionCallback) {
        global.onboardingCompletionCallback();
      }
      
      setLoading(false);
      
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Setup Error',
        'There was a problem saving your preferences. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };
  

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <MaterialCommunityIcons 
          name="food-apple" 
          size={80} 
          color={THEME.primary} 
          style={{ marginBottom: 24 }} 
        />
        <ActivityIndicator size="large" color={THEME.primary} style={{ marginBottom: 20 }} />
        <Text style={styles.loadingText}>
          {LOADING_MESSAGES[loadingMessage]}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.headerWrap, { opacity: fadeAnim }]}> 
        <MaterialCommunityIcons name="food-apple" size={56} color={THEME.primary} style={{ marginBottom: 10 }} />
        <Text style={styles.title}>Welcome to PantryPal</Text>
        <Text style={styles.subtitle}>Select the features you want to use. You can always change this later in your profile.</Text>
      </Animated.View>
      <ScrollView contentContainerStyle={styles.gridScroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.grid, isWide && { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }]}> 
          {FEATURES.map((feature, idx) => (
            <FeatureCard
              key={feature.key}
              feature={feature}
              isSelected={selected.includes(feature.key)}
              onPress={() => toggleSelect(feature.key)}
              index={idx}
              isWide={isWide}
            />
          ))}
        </View>
      </ScrollView>
      <Animated.View style={[styles.fabWrap, { opacity: selected.length > 0 ? 1 : 0.5 }]}> 
        <TouchableOpacity
          style={[styles.continueButton, selected.length === 0 && { backgroundColor: THEME.border }]}
          onPress={handleContinue}
          disabled={selected.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <MaterialCommunityIcons name="arrow-right" size={22} color={selected.length === 0 ? THEME.textSecondary : THEME.surface} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

function FeatureCard({ feature, isSelected, onPress, index, isWide }) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], margin: isWide ? 12 : 0 }}>
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && { backgroundColor: feature.color, borderColor: feature.color },
          isWide && { width: (width / 2) - 36, minWidth: 220, maxWidth: 320 },
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: isSelected ? 'rgba(255,255,255,0.18)' : feature.color + '15' }]}> 
          <MaterialCommunityIcons name={feature.icon} size={32} color={isSelected ? THEME.surface : feature.color} />
        </View>
        <View style={styles.cardTextWrap}>
          <Text style={[styles.cardLabel, isSelected && { color: THEME.surface }]}>{feature.label}</Text>
          <Text style={[styles.cardDesc, isSelected && { color: '#E0E7EF' }]}>{feature.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkOverlay}>
            <MaterialCommunityIcons name="check-circle" size={28} color={THEME.surface} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  headerWrap: {
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 18 : 32,
    marginBottom: 18,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  gridScroll: {
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: THEME.border,
    padding: 22,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: width - 48,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTextWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 19,
  },
  checkOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 16,
    padding: 2,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
    backgroundColor: 'transparent',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 36,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: THEME.surface,
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    color: THEME.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
  },
  progressContainer: {
    width: '80%',
    height: 4,
    backgroundColor: THEME.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME.primary,
    borderRadius: 2,
    width: '100%',
  },
});