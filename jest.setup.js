// Jest setup for Food Scanner App Security Testing

import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    manifest: {},
    platform: {
      ios: {},
      android: {},
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  NavigationContainer: ({ children }) => children,
}));

// Mock React Native components that don't work well in tests
jest.mock('react-native/Libraries/Components/Switch/Switch', () => 'Switch');
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock network requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock console methods for testing
global.console = {
  ...console,
  // Suppress console logs during tests unless testing logging specifically
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Security-focused test utilities
global.securityTestUtils = {
  // Generate malicious input for XSS testing
  generateXSSPayloads: () => [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    '"><script>alert(1)</script>',
    "'; DROP TABLE users; --",
    '<iframe src="javascript:alert(1)"></iframe>',
  ],

  // Generate SQL injection payloads
  generateSQLInjectionPayloads: () => [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1; SELECT * FROM users",
    "' UNION SELECT username, password FROM users--",
    "admin'--",
    "1' OR 1=1#",
  ],

  // Generate invalid inputs for validation testing
  generateInvalidInputs: () => [
    null,
    undefined,
    '',
    ' '.repeat(1000), // Very long string
    '{}',
    '[]',
    'true',
    'false',
    '12345',
    '\n\r\t',
  ],

  // Mock user objects for testing
  createMockUser: (overrides = {}) => ({
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    emailVerified: true,
    ...overrides,
  }),

  // Wait for async operations in tests
  waitForAsync: (timeout = 1000) => 
    new Promise(resolve => setTimeout(resolve, timeout)),

  // Create mock authentication errors
  createAuthError: (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  },
};

// Set up test environment variables
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';

// Suppress warnings that aren't relevant to security testing
const originalWarn = console.warn;
console.warn = (message) => {
  if (
    message.includes('Warning: ReactDOM.render') ||
    message.includes('Warning: componentWillMount') ||
    message.includes('Animated:')
  ) {
    return;
  }
  originalWarn(message);
};

// Global test timeout
jest.setTimeout(30000);