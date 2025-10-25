#!/usr/bin/env node
// 🔐 Security validation script for Food Scanner App

const fs = require('fs');
const path = require('path');

console.log('🛡️  FOOD SCANNER APP - Security Validation');
console.log('==========================================\n');

let issues = 0;
let passed = 0;

function check(description, condition, fix = '') {
  if (condition) {
    console.log(`✅ ${description}`);
    passed++;
  } else {
    console.log(`❌ ${description}`);
    if (fix) console.log(`   Fix: ${fix}`);
    issues++;
  }
}

// 1. Environment Variables Check
console.log('🔐 Environment Variables:');
check(
  'Firebase API key is not hardcoded',
  !fs.readFileSync('./food-scanner-app/firebase.js', 'utf8').includes('AIzaSy'),
  'Use environment variables for Firebase config'
);

check(
  '.env file exists',
  fs.existsSync('./.env'),
  'Create .env file with your API keys'
);

check(
  '.env is in .gitignore',
  fs.readFileSync('./.gitignore', 'utf8').includes('.env'),
  'Add .env to .gitignore'
);

// 2. Secure Logging Check
console.log('\n📝 Secure Logging:');
check(
  'Secure logger exists',
  fs.existsSync('./logger.js'),
  'Create secure logging utility'
);

const appJsContent = fs.readFileSync('./App.js', 'utf8');
check(
  'App.js uses secure logger',
  appJsContent.includes('import logger from') || appJsContent.includes('logger.debug'),
  'Replace console.log with secure logger'
);

// 3. Error Boundaries Check
console.log('\n🛡️  Error Boundaries:');
check(
  'Critical error boundary exists',
  fs.existsSync('./CriticalErrorBoundary.js'),
  'Create error boundary component'
);

check(
  'App wrapped with error boundary',
  appJsContent.includes('CriticalErrorBoundary'),
  'Wrap main App with error boundary'
);

// 4. Input Validation Check
console.log('\n🔒 Input Validation:');
check(
  'Security utilities exist',
  fs.existsSync('./security.js'),
  'Create security utility functions'
);

// Test security functions
try {
  const security = require('./security');
  check(
    'Input sanitization works',
    security.sanitizeInput('<script>test</script>') === 'test',
    'Fix sanitizeInput function'
  );
  
  check(
    'Email validation works',
    security.validateEmail('test@example.com') === true,
    'Fix validateEmail function'
  );
} catch (e) {
  check('Security module loads correctly', false, 'Fix module export issues');
}

// 5. Package Security
console.log('\n📦 Package Security:');
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  check(
    'Security audit script exists',
    packageJson.scripts && packageJson.scripts['security:audit'],
    'Add npm run security:audit script'
  );
} catch (e) {
  check('Package.json is valid', false, 'Fix package.json syntax');
}

// 6. Advanced Security Features
console.log('\n🚀 Advanced Security Features:');
check(
  'Enhanced authentication system exists',
  fs.existsSync('./AuthSecurity.js'),
  'Create AuthSecurity.js for advanced auth features'
);

check(
  'Secure storage utility exists',
  fs.existsSync('./SecureStorage.js'),
  'Create SecureStorage.js for encrypted local storage'
);

check(
  'Security monitoring system exists',
  fs.existsSync('./SecurityMonitoring.js'),
  'Create SecurityMonitoring.js for threat detection'
);

check(
  'Firebase App Check configured',
  fs.readFileSync('./food-scanner-app/firebase.js', 'utf8').includes('initializeAppCheck'),
  'Configure Firebase App Check for bot protection'
);

// 7. Testing Framework
console.log('\n🧪 Security Testing:');
check(
  'Jest configuration exists',
  fs.existsSync('./jest.config.js'),
  'Create Jest configuration file'
);

check(
  'Security test suite exists',
  fs.existsSync('./__tests__/security.test.js'),
  'Create security test suite'
);

check(
  'Authentication test suite exists',
  fs.existsSync('./__tests__/AuthSecurity.test.js'),
  'Create authentication security tests'
);

check(
  'Error boundary tests exist',
  fs.existsSync('./__tests__/CriticalErrorBoundary.test.js'),
  'Create error boundary tests'
);

// 8. Phase 3 Elite Security Features
console.log('\n🚀 Phase 3 Elite Security:');
check(
  'Biometric authentication system exists',
  fs.existsSync('./BiometricAuth.js'),
  'Create BiometricAuth.js for Touch ID/Face ID support'
);

check(
  'Multi-factor authentication system exists',
  fs.existsSync('./MultiFactorAuth.js'),
  'Create MultiFactorAuth.js for TOTP/SMS/Email MFA'
);

check(
  'Network security with certificate pinning exists',
  fs.existsSync('./NetworkSecurity.js'),
  'Create NetworkSecurity.js for certificate pinning'
);

check(
  'Elite security dashboard exists',
  fs.existsSync('./SecurityDashboard.js'),
  'Create SecurityDashboard.js for comprehensive monitoring'
);

// 9. Dependencies Check
console.log('\n📦 Elite Security Dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  
  check(
    'Biometric dependencies installed',
    packageJson.dependencies['expo-local-authentication'] && 
    packageJson.dependencies['expo-secure-store'],
    'Install: npm install expo-local-authentication expo-secure-store'
  );
} catch (e) {
  check('Package.json dependencies check failed', false, 'Fix package.json or install missing packages');
}

// 10. Console.log Check
console.log('\n🔍 Production Safety:');
const dangerousLogs = [
  './App.js',
  './MealPlanner.js'
].filter(file => {
  if (!fs.existsSync(file)) return false;
  const content = fs.readFileSync(file, 'utf8');
  return content.includes('console.log(') && !content.includes('logger.');
});

check(
  'No dangerous console.log statements',
  dangerousLogs.length === 0,
  `Replace console.log in: ${dangerousLogs.join(', ')}`
);

// Summary
console.log('\n📊 Security Validation Summary:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Issues: ${issues}`);

if (issues === 0) {
  console.log('\n🎉 All critical security checks passed!');
  console.log('Your app is now significantly more secure.');
  process.exit(0);
} else {
  console.log(`\n⚠️  Please fix ${issues} security issue${issues > 1 ? 's' : ''} before deploying to production.`);
  process.exit(1);
}