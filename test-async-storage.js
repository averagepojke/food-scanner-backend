// 🧪 Test script to verify AsyncStorage resolution
// Run with: node test-async-storage.js

try {
  console.log('🔍 Testing AsyncStorage resolution...');
  
  // Test if we can resolve AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  
  if (AsyncStorage) {
    console.log('✅ AsyncStorage resolved successfully!');
    console.log('📦 Version info:', AsyncStorage.default ? 'Default export found' : 'Direct export');
  } else {
    console.log('❌ AsyncStorage resolution failed');
  }
  
} catch (error) {
  console.log('❌ Error resolving AsyncStorage:', error.message);
  console.log('💡 This indicates a bundling/resolution issue');
}

console.log('\n📋 Resolution test complete');