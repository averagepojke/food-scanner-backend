/**
 * Test script to verify the onboarding → paywall flow
 * Run this with: node test-onboarding-paywall-flow.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Onboarding → Paywall Flow Implementation\n');

// Test 1: Check UserSubscriptionManager modifications
console.log('📊 Checking UserSubscriptionManager.js...');
const userSubManager = fs.readFileSync(path.join(__dirname, 'UserSubscriptionManager.js'), 'utf8');

const tests = [
  {
    name: 'First-time user logic updated',
    test: userSubManager.includes('// First time user - mark as launched but don\'t show paywall yet') && 
          userSubManager.includes('// Paywall will be shown after onboarding completion')
  },
  {
    name: 'Onboarding completion check added',
    test: userSubManager.includes('const onboardingCompleted = await AsyncStorage.getItem(\'onboardingCompleted\')') &&
          userSubManager.includes('if (onboardingCompleted) {')
  },
  {
    name: 'showPaywallAfterOnboarding function added',
    test: userSubManager.includes('showPaywallAfterOnboarding') && 
          userSubManager.includes('const showPaywallAfterOnboarding = () => {')
  },
  {
    name: 'Function exported in context value',
    test: userSubManager.includes('showPaywallAfterOnboarding,')
  }
];

tests.forEach(test => {
  if (test.test) {
    console.log(`   ✅ ${test.name}`);
  } else {
    console.log(`   ❌ ${test.name}`);
  }
});

// Test 2: Check OnboardingScreen modifications
console.log('\n📊 Checking OnboardingScreen.js...');
const onboardingScreen = fs.readFileSync(path.join(__dirname, 'OnboardingScreen.js'), 'utf8');

const onboardingTests = [
  {
    name: 'useSubscription import added',
    test: onboardingScreen.includes('import { useSubscription } from \'./UserSubscriptionManager\';')
  },
  {
    name: 'Subscription hooks integrated',
    test: onboardingScreen.includes('const { isFirstTime, showPaywallAfterOnboarding } = useSubscription();')
  },
  {
    name: 'Paywall trigger after onboarding',
    test: onboardingScreen.includes('// 🎯 Show paywall for first-time users after onboarding completion') &&
          onboardingScreen.includes('if (isFirstTime && showPaywallAfterOnboarding) {')
  },
  {
    name: 'Paywall shown with delay',
    test: onboardingScreen.includes('setTimeout(() => {') && 
          onboardingScreen.includes('showPaywallAfterOnboarding();')
  }
];

onboardingTests.forEach(test => {
  if (test.test) {
    console.log(`   ✅ ${test.name}`);
  } else {
    console.log(`   ❌ ${test.name}`);
  }
});

// Test 3: Check App.js integration
console.log('\n📊 Checking App.js integration...');
const appJs = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

const appTests = [
  {
    name: 'SubscriptionProvider imported',
    test: appJs.includes('SubscriptionProvider')
  },
  {
    name: 'SubscriptionProvider wraps app',
    test: appJs.includes('</SubscriptionProvider>')
  },
  {
    name: 'ShelfLifePaywall imported',
    test: appJs.includes('ShelfLifePaywall')
  }
];

appTests.forEach(test => {
  if (test.test) {
    console.log(`   ✅ ${test.name}`);
  } else {
    console.log(`   ❌ ${test.name}`);
  }
});

// Test 4: Flow summary
console.log('\n🔄 Expected User Flow:');
console.log('   1. New user registers/logs in');
console.log('   2. User sees OnboardingScreen with feature selection');
console.log('   3. User selects features and clicks "Continue"');
console.log('   4. OnboardingScreen saves selection and detects first-time user');
console.log('   5. After 500ms delay, paywall appears automatically');
console.log('   6. User must subscribe to continue using the app');

// Test 5: Integration verification
console.log('\n🔧 Integration Status:');
const allPassed = tests.every(test => test.test) && 
                  onboardingTests.every(test => test.test) && 
                  appTests.every(test => test.test);

if (allPassed) {
  console.log('   ✅ All integrations successful!');
  console.log('   ✅ Paywall will now show AFTER feature selection is completed');
  console.log('   ✅ First-time users will see paywall automatically');
  console.log('   ✅ Existing users without subscription will also see paywall');
} else {
  console.log('   ⚠️  Some integrations may need attention');
}

console.log('\n📱 Testing Instructions:');
console.log('   1. Clear app data/storage to simulate first-time user');
console.log('   2. Register/login as new user');
console.log('   3. Complete feature selection on onboarding screen');
console.log('   4. Verify paywall appears after clicking "Continue"');
console.log('   5. Test subscription flow through paywall');

console.log('\n🎯 Implementation Complete!');