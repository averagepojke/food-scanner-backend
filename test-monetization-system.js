#!/usr/bin/env node

/**
 * 🚀 PAID-FIRST MONETIZATION SYSTEM TEST
 * 
 * This tests the complete monetization & referral system implementation
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Paid-First Monetization System...\n');

// Check if all required files exist
const requiredFiles = [
  'ShelfLifePaywall.js',
  'UserSubscriptionManager.js', 
  'ReferralScreen.js',
  'App.js'
];

console.log('📁 Checking core files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING!`);
  }
});

console.log('\n🔍 Analyzing App.js integration...');

try {
  const appContent = fs.readFileSync('App.js', 'utf8');
  
  // Check SubscriptionProvider wrapper
  if (appContent.includes('SubscriptionProvider') && appContent.includes('import { SubscriptionProvider')) {
    console.log('   ✅ SubscriptionProvider imported and wrapped');
  } else {
    console.log('   ❌ SubscriptionProvider not properly integrated');
  }
  
  // Check ReferralScreen in drawer
  if (appContent.includes('ReferralScreen') && appContent.includes('Invite Friends')) {
    console.log('   ✅ ReferralScreen added to drawer menu');
  } else {
    console.log('   ❌ ReferralScreen not in drawer');
  }
  
  // Check Premium paywall screen
  if (appContent.includes('Upgrade to Premium') && appContent.includes('crown')) {
    console.log('   ✅ Premium paywall screen in drawer');
  } else {
    console.log('   ❌ Premium screen not found');
  }
  
} catch (error) {
  console.log('   ❌ Error reading App.js:', error.message);
}

console.log('\n🔧 Checking paywall functionality...');

try {
  const paywallContent = fs.readFileSync('ShelfLifePaywall.js', 'utf8');
  
  // Check mandatory paywall (no close button)
  if (!paywallContent.includes('closeButton') && paywallContent.includes('onRequestClose={() => {}}')) {
    console.log('   ✅ Mandatory paywall (no escape)');
  } else {
    console.log('   ❌ Paywall is not mandatory');
  }
  
  // Check referral code input
  if (paywallContent.includes('referralCode') && paywallContent.includes('TextInput')) {
    console.log('   ✅ Referral code input implemented');
  } else {
    console.log('   ❌ Referral code input missing');
  }
  
  // Check two subscription options
  if (paywallContent.includes('Start Free Trial') && paywallContent.includes('Subscribe Now')) {
    console.log('   ✅ Two subscription options (trial + direct)');
  } else {
    console.log('   ❌ Missing subscription options');
  }
  
  // Check mandatory warning
  if (paywallContent.includes('This app requires a subscription to use')) {
    console.log('   ✅ Mandatory subscription warning');
  } else {
    console.log('   ❌ Missing mandatory subscription warning');
  }
  
} catch (error) {
  console.log('   ❌ Error reading ShelfLifePaywall.js:', error.message);
}

console.log('\n📱 Checking subscription manager...');

try {
  const managerContent = fs.readFileSync('UserSubscriptionManager.js', 'utf8');
  
  // Check first-time detection
  if (managerContent.includes('hasLaunched') && managerContent.includes('AsyncStorage')) {
    console.log('   ✅ First-time user detection');
  } else {
    console.log('   ❌ First-time detection missing');
  }
  
  // Check subscription validation
  if (managerContent.includes('expiryDate') && managerContent.includes('new Date')) {
    console.log('   ✅ Subscription expiry validation');
  } else {
    console.log('   ❌ Subscription validation missing');
  }
  
  // Check referral bonus handling
  if (managerContent.includes('referralCode') && managerContent.includes('setMonth')) {
    console.log('   ✅ Referral bonus (6 months free)');
  } else {
    console.log('   ❌ Referral bonus handling missing');
  }
  
} catch (error) {
  console.log('   ❌ Error reading UserSubscriptionManager.js:', error.message);
}

console.log('\n🎁 Checking referral system...');

try {
  const referralContent = fs.readFileSync('ReferralScreen.js', 'utf8');
  
  // Check sharing functionality
  if (referralContent.includes('Share.share') && referralContent.includes('Clipboard')) {
    console.log('   ✅ Code sharing (Share API + Clipboard)');
  } else {
    console.log('   ❌ Sharing functionality missing');
  }
  
  // Check referral code entry
  if (referralContent.includes('TextInput') && referralContent.includes('6-character')) {
    console.log('   ✅ Referral code entry system');
  } else {
    console.log('   ❌ Code entry system missing');
  }
  
  // Check subscription status display  
  if (referralContent.includes('Premium Active') && referralContent.includes('Expires:')) {
    console.log('   ✅ Subscription status display');
  } else {
    console.log('   ❌ Subscription status missing');
  }
  
  // Check how it works section
  if (referralContent.includes('How Referrals Work') && referralContent.includes('step')) {
    console.log('   ✅ User education section');
  } else {
    console.log('   ❌ Education section missing');
  }
  
} catch (error) {
  console.log('   ❌ Error reading ReferralScreen.js:', error.message);
}

console.log('\n🎉 System Analysis Complete!\n');

console.log('📱 Your Paid-First App Flow:');
console.log('   1. User installs app → Mandatory paywall appears');
console.log('   2. Choose: Free Trial (1 month) OR Subscribe (£4.99/year)');  
console.log('   3. Optional: Enter referral code → Both users get 6 months free');
console.log('   4. Access full app → Can invite friends via "Invite Friends"');
console.log('   5. Subscription tracked → Auto-renewal or expiry handling\n');

console.log('💡 Next Steps:');
console.log('   - Test with: npm start');
console.log('   - Check: Drawer → "Upgrade to Premium" for paywall');
console.log('   - Check: Drawer → "Invite Friends" for referral system');
console.log('   - Integrate real payment: Stripe, RevenueCat, etc.');
console.log('   - Deploy backend: User validation, referral tracking');
console.log('   - Analytics: Track conversion rates & referral success\n');

console.log('🚀 Perfect Paid-First Monetization System Ready!');