// Firebase initialization for the app
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import AsyncStorage from '../AsyncStorageWrapper';

// 🔐 SECURITY: Firebase configuration from environment variables
// Never commit sensitive keys to source code!
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('🚨 Firebase configuration missing! Check your .env file.');
}

const app = initializeApp(firebaseConfig);

// 🛡️ SECURITY: Initialize App Check for bot protection
// This prevents unauthorized access to your Firebase resources
if (!__DEV__) {
  // Only enable App Check in production to avoid development issues
  const recaptchaSiteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    try {
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true // Auto-refresh tokens
      });
      console.log('🛡️ Firebase App Check initialized');
    } catch (error) {
      console.warn('⚠️ App Check initialization failed:', error.message);
    }
  } else {
    console.warn('⚠️ ReCaptcha site key missing - App Check disabled');
  }
} else {
  console.log('🔧 Development mode - App Check disabled');
}

// Initialize Auth with AsyncStorage persistence (keeps you signed in)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const storage = getStorage(app);

export { auth, storage };