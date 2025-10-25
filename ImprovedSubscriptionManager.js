import React, { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImprovedPaywall from './ImprovedPaywall';
import { useAuth } from './food-scanner-app/AuthContext';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Check subscription status when user changes or on app start
  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
    } else {
      // No user logged in - reset subscription state
      resetSubscriptionState();
    }
  }, [user]);

  const resetSubscriptionState = () => {
    setIsSubscribed(false);
    setSubscriptionData(null);
    setShowPaywall(false);
    setIsFirstTime(false);
    setIsLoading(false);
  };

  const getUserStorageKey = (key) => {
    return user ? `user_${user.uid}_${key}` : key;
  };

  const checkSubscriptionStatus = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Determine if onboarding is complete (selection saved and completion flag set)
      const selection = await AsyncStorage.getItem('onboardingSelection');
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      const onboardingIsComplete = !!(selection && onboardingCompleted);

      // Check if this is the first time the user is opening the app
      const firstTimeKey = getUserStorageKey('first_time');
      const hasLaunchedBefore = await AsyncStorage.getItem(firstTimeKey);
      
      if (!hasLaunchedBefore) {
        setIsFirstTime(true);
        await AsyncStorage.setItem(firstTimeKey, 'true');
        // Do NOT show paywall for the very first session of this user
        setIsSubscribed(false);
        setShowPaywall(false);
        setIsLoading(false);
        return;
      }

      // Check subscription data
      const subscriptionKey = getUserStorageKey('subscription');
      const storedSubscription = await AsyncStorage.getItem(subscriptionKey);
      
      if (storedSubscription) {
        const subscription = JSON.parse(storedSubscription);
        
        // Check if subscription is still valid
        const now = new Date();
        const expiryDate = new Date(subscription.expiryDate); 
        
        if (now <= expiryDate) {
          setIsSubscribed(true);
          setSubscriptionData(subscription);
          setShowPaywall(false);
        } else {
          // Subscription expired
          setIsSubscribed(false);
          setSubscriptionData(null);
          setShowPaywall(onboardingIsComplete);
        }
      } else {
        // No subscription found
        setIsSubscribed(false);
        setSubscriptionData(null);
        setShowPaywall(onboardingIsComplete);
      }
      
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // On error, only show paywall after onboarding is complete
      setIsSubscribed(false);
      try {
        const selection = await AsyncStorage.getItem('onboardingSelection');
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
        const onboardingIsComplete = !!(selection && onboardingCompleted);
        setShowPaywall(onboardingIsComplete);
      } catch {
        setShowPaywall(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscription = async (subscriptionInfo) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      // Calculate expiry date based on plan
      const now = new Date();
      let expiryDate = new Date(now);
      
      if (subscriptionInfo.type === 'yearly') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else if (subscriptionInfo.type === 'monthly') {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }

      // Add bonus time for referral code
      if (subscriptionInfo.referralCode && validateReferralCode(subscriptionInfo.referralCode)) {
        expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month bonus
      }

      const fullSubscriptionData = {
        ...subscriptionInfo,
        userId: user.uid,
        userEmail: user.email,
        isActive: true,
        subscribedAt: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        hasReferralBonus: !!subscriptionInfo.referralCode,
      };

      // Store subscription data
      const subscriptionKey = getUserStorageKey('subscription');
      await AsyncStorage.setItem(subscriptionKey, JSON.stringify(fullSubscriptionData));
      
      // Update state
      setSubscriptionData(fullSubscriptionData);
      setIsSubscribed(true);
      setShowPaywall(false);

      console.log('✅ Subscription processed successfully:', {
        type: subscriptionInfo.type,
        hasReferral: !!subscriptionInfo.referralCode,
        expiryDate: expiryDate.toISOString()
      });

      return fullSubscriptionData;
      
    } catch (error) {
      console.error('Error processing subscription:', error);
      throw error;
    }
  };

  const validateReferralCode = (code) => {
    // Simple validation - in real app, this would check against your backend
    return code && code.length >= 4 && /^[A-Z0-9]+$/.test(code);
  };

  const cancelSubscription = async () => {
    if (!user) return;

    try {
      const subscriptionKey = getUserStorageKey('subscription');
      const stored = await AsyncStorage.getItem(subscriptionKey);
      if (stored) {
        const current = JSON.parse(stored);
        const updated = {
          ...current,
          cancelAtPeriodEnd: true,
          canceledAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(subscriptionKey, JSON.stringify(updated));
        setSubscriptionData(updated);
        // Keep access active until the expiry date; do not show paywall yet
        setIsSubscribed(true);
        setShowPaywall(false);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscriptionData) return null;
    
    const now = new Date();
    const expiryDate = new Date(subscriptionData.expiryDate);
    const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    const willCancelAtPeriodEnd = !!subscriptionData.cancelAtPeriodEnd;
    const status = daysRemaining > 0 
      ? (willCancelAtPeriodEnd ? 'cancels_at_period_end' : 'active')
      : 'expired';
    
    return {
      ...subscriptionData,
      daysRemaining,
      isExpiringSoon: daysRemaining <= 7,
      isExpired: daysRemaining <= 0,
      willCancelAtPeriodEnd,
      status,
    };
  };

  const triggerPaywall = () => {
    setShowPaywall(true);
  };

  const hidePaywall = () => {
    setShowPaywall(false);
  };

  // Explicit helper to show paywall right after onboarding completes
  const showPaywallAfterOnboarding = () => {
    setShowPaywall(true);
  };

  // Check if user can access the app
  const canAccessApp = () => {
    if (isLoading) return false; // Still loading
    if (!user) return false; // No user logged in
    return isSubscribed; // Require active subscription for all users
  };

  const value = {
    isSubscribed,
    subscriptionData,
    isFirstTime,
    isLoading,
    showPaywall,
    handleSubscription,
    cancelSubscription,
    getSubscriptionStatus,
    refreshSubscription: checkSubscriptionStatus,
    triggerPaywall,
    hidePaywall,
    // Used by OnboardingScreen to present paywall after saving selections
    showPaywallAfterOnboarding,
    canAccessApp,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      
      {/* Improved Paywall */}
      {showPaywall && user && (
        <ImprovedPaywall
          visible={showPaywall}
          onSubscribed={handleSubscription}
          onClose={hidePaywall}
        />
      )}
    </SubscriptionContext.Provider>
  );
};

// Helper component to protect screens that require subscription
export const ProtectedScreen = ({ children, fallback }) => {
  const { canAccessApp } = useSubscription();
  
  if (!canAccessApp()) {
    return fallback || null;
  }
  
  return children;
};

// Hook to check if user can access premium features
export const usePremiumFeatures = () => {
  const { isSubscribed, getSubscriptionStatus } = useSubscription();
  
  return {
    canAccess: isSubscribed,
    subscriptionStatus: getSubscriptionStatus(),
  };
};

export default SubscriptionProvider;