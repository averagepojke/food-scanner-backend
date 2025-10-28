import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Test utilities for the paywall system
 * Use these functions to test different scenarios
 */

export const PaywallTestUtils = {
  
  /**
   * Reset app to first-time user state
   * This will trigger the paywall after onboarding
   */
  resetToFirstTimeUser: async () => {
    try {
      await AsyncStorage.multiRemove([
        'hasLaunched',
        'subscriptionData',
        'onboardingSelection',
        'onboardingCompleted',
        'hasSeenPaywall',
        'userReferralCode',
        'hasUsedReferralCode',
        'referralStats'
      ]);
      console.log('✅ Reset to first-time user state');
      console.log('📱 Restart the app to see the onboarding → paywall flow');
    } catch (error) {
      console.error('❌ Error resetting user state:', error);
    }
  },

  /**
   * Reset to existing user without subscription
   * This will show paywall immediately on app start
   */
  resetToExistingUserNoSubscription: async () => {
    try {
      await AsyncStorage.multiRemove([
        'subscriptionData',
        'hasSeenPaywall'
      ]);
      await AsyncStorage.setItem('hasLaunched', 'true');
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem('onboardingSelection', JSON.stringify(['inventory', 'shopping']));
      
      console.log('✅ Reset to existing user without subscription');
      console.log('📱 Restart the app to see immediate paywall');
    } catch (error) {
      console.error('❌ Error resetting to existing user:', error);
    }
  },

  /**
   * Create a mock trial subscription
   */
  createTrialSubscription: async (referralCode = null) => {
    try {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month trial
      
      if (referralCode) {
        expiryDate.setMonth(expiryDate.getMonth() + 6); // +6 months for referral
      }

      const subscriptionData = {
        type: 'trial',
        referralCode: referralCode,
        userReferralCode: 'TEST123',
        price: '£4.99/year',
        isActive: true,
        subscribedAt: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        bonusMonthsFromReferral: referralCode ? 6 : 0,
        trialEndsAt: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
      };

      await AsyncStorage.setItem('subscriptionData', JSON.stringify(subscriptionData));
      await AsyncStorage.setItem('hasLaunched', 'true');
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem('onboardingSelection', JSON.stringify(['inventory', 'shopping']));
      
      console.log('✅ Created trial subscription');
      console.log('📊 Subscription details:', subscriptionData);
      console.log('📱 Restart the app to access premium features');
    } catch (error) {
      console.error('❌ Error creating trial subscription:', error);
    }
  },

  /**
   * Create a mock paid subscription
   */
  createPaidSubscription: async (referralCode = null) => {
    try {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year subscription
      
      if (referralCode) {
        expiryDate.setMonth(expiryDate.getMonth() + 6); // +6 months for referral
      }

      const subscriptionData = {
        type: 'subscription',
        referralCode: referralCode,
        userReferralCode: 'TEST456',
        price: '£4.99/year',
        isActive: true,
        subscribedAt: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        bonusMonthsFromReferral: referralCode ? 6 : 0,
        trialEndsAt: null,
      };

      await AsyncStorage.setItem('subscriptionData', JSON.stringify(subscriptionData));
      await AsyncStorage.setItem('hasLaunched', 'true');
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem('onboardingSelection', JSON.stringify(['inventory', 'shopping']));
      
      console.log('✅ Created paid subscription');
      console.log('📊 Subscription details:', subscriptionData);
      console.log('📱 Restart the app to access premium features');
    } catch (error) {
      console.error('❌ Error creating paid subscription:', error);
    }
  },

  /**
   * Create an expired subscription
   * This will trigger the paywall
   */
  createExpiredSubscription: async () => {
    try {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() - 1); // Expired 1 month ago

      const subscriptionData = {
        type: 'subscription',
        referralCode: null,
        userReferralCode: 'EXPIRED123',
        price: '£4.99/year',
        isActive: true,
        subscribedAt: new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString(),
        expiryDate: expiryDate.toISOString(),
        bonusMonthsFromReferral: 0,
        trialEndsAt: null,
      };

      await AsyncStorage.setItem('subscriptionData', JSON.stringify(subscriptionData));
      await AsyncStorage.setItem('hasLaunched', 'true');
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      await AsyncStorage.setItem('onboardingSelection', JSON.stringify(['inventory', 'shopping']));
      
      console.log('✅ Created expired subscription');
      console.log('📊 Subscription details:', subscriptionData);
      console.log('📱 Restart the app to see paywall for expired subscription');
    } catch (error) {
      console.error('❌ Error creating expired subscription:', error);
    }
  },

  /**
   * Check current subscription status
   */
  checkSubscriptionStatus: async () => {
    try {
      const subscriptionData = await AsyncStorage.getItem('subscriptionData');
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      
      console.log('📊 Current App State:');
      console.log('- Has Launched:', !!hasLaunched);
      console.log('- Onboarding Completed:', !!onboardingCompleted);
      console.log('- Has Subscription:', !!subscriptionData);
      
      if (subscriptionData) {
        const subscription = JSON.parse(subscriptionData);
        const now = new Date();
        const expiryDate = new Date(subscription.expiryDate);
        const isExpired = now > expiryDate;
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        console.log('📋 Subscription Details:');
        console.log('- Type:', subscription.type);
        console.log('- Expires:', expiryDate.toLocaleDateString());
        console.log('- Days Remaining:', daysRemaining);
        console.log('- Is Expired:', isExpired);
        console.log('- Referral Code Used:', subscription.referralCode || 'None');
        console.log('- Bonus Months:', subscription.bonusMonthsFromReferral || 0);
      }
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
    }
  },

  /**
   * Test referral code functionality
   */
  testReferralCode: async (code = 'FRIEND123') => {
    try {
      // Create a subscription with referral code
      await this.createTrialSubscription(code);
      
      // Set up referral stats
      const referralStats = {
        referralCount: 1,
        bonusMonths: 6,
        totalEarned: 6
      };
      
      await AsyncStorage.setItem('referralStats', JSON.stringify(referralStats));
      await AsyncStorage.setItem('userReferralCode', 'MYCODE123');
      
      console.log('✅ Set up referral test scenario');
      console.log('🎁 Used referral code:', code);
      console.log('📱 Restart the app and check the referral screen');
    } catch (error) {
      console.error('❌ Error setting up referral test:', error);
    }
  },

  /**
   * Clear all app data
   */
  clearAllData: async () => {
    try {
      await AsyncStorage.clear();
      console.log('✅ Cleared all app data');
      console.log('📱 Restart the app for a completely fresh start');
    } catch (error) {
      console.error('❌ Error clearing app data:', error);
    }
  }
};

// Usage examples:
console.log(`
🧪 PAYWALL TESTING UTILITIES

To test different scenarios, run these commands in your React Native debugger console:

// Test first-time user flow (onboarding → paywall)
PaywallTestUtils.resetToFirstTimeUser();

// Test existing user without subscription (immediate paywall)
PaywallTestUtils.resetToExistingUserNoSubscription();

// Test with active trial subscription
PaywallTestUtils.createTrialSubscription();

// Test with active paid subscription
PaywallTestUtils.createPaidSubscription();

// Test with referral code
PaywallTestUtils.createTrialSubscription('FRIEND123');

// Test expired subscription (triggers paywall)
PaywallTestUtils.createExpiredSubscription();

// Check current status
PaywallTestUtils.checkSubscriptionStatus();

// Test referral system
PaywallTestUtils.testReferralCode('FRIEND123');

// Start completely fresh
PaywallTestUtils.clearAllData();
`);

export default PaywallTestUtils;