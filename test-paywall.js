/**
 * Test script to verify ShelfLifePaywall component works correctly
 * Run this with: node test-paywall.js
 */

console.log('🧪 Testing ShelfLifePaywall Integration...\n');

// Check if files exist
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'ShelfLifePaywall.js',
  'App.js',
  'TestShelfLifePaywall.js'
];

console.log('📁 Checking files...');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// Check if App.js contains the ShelfLifePaywall import
console.log('\n🔍 Checking App.js integration...');
const appJs = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

const checks = [
  {
    name: 'ShelfLifePaywall import',
    test: appJs.includes("import ShelfLifePaywall from './ShelfLifePaywall';")
  },
  {
    name: 'Premium drawer screen',
    test: appJs.includes('name="Premium"') && appJs.includes('component={ShelfLifePaywall}')
  },
  {
    name: 'Crown icon for premium',
    test: appJs.includes('name="crown"')
  }
];

checks.forEach(check => {
  console.log(`   ${check.test ? '✅' : '❌'} ${check.name}`);
});

// Check ShelfLifePaywall.js for key functionality
console.log('\n🔧 Checking paywall functionality...');
const paywallJs = fs.readFileSync(path.join(__dirname, 'ShelfLifePaywall.js'), 'utf8');

const functionalityChecks = [
  {
    name: 'Alert functionality',
    test: paywallJs.includes('Alert.alert')
  },
  {
    name: 'Free trial handler',
    test: paywallJs.includes('handleFreeTrial')
  },
  {
    name: 'Direct purchase handler',
    test: paywallJs.includes('handleDirectPurchase')
  },
  {
    name: 'Button press handlers',
    test: paywallJs.includes('onPress={handleFreeTrial}') && paywallJs.includes('onPress={handleDirectPurchase}')
  },
  {
    name: 'Modal component',
    test: paywallJs.includes('<Modal') && paywallJs.includes('visible={showPaywall}')
  }
];

functionalityChecks.forEach(check => {
  console.log(`   ${check.test ? '✅' : '❌'} ${check.name}`);
});

console.log('\n🎉 Test complete!');
console.log('\n📱 To see your paywall:');
console.log('   1. Start your Expo app: npm start');
console.log('   2. Open the drawer menu');
console.log('   3. Tap "Upgrade to Premium" (with crown icon)');
console.log('   4. Your paywall modal will appear!');

console.log('\n💡 Next steps:');
console.log('   - Integrate with real payment provider (Stripe, RevenueCat, etc.)');
console.log('   - Add loading states during purchase');
console.log('   - Store premium status in user profile');
console.log('   - Gate premium features behind subscription check');