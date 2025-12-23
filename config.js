import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Prefer env var; otherwise choose sensible defaults per platform
const resolveDefaultBaseUrl = () => {
  try {
    // Check if we have an environment variable set
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_API_BASE_URL;
    }

    // Use deployed Railway URL for both development and production
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return 'https://food-scanner-backend-n1q3.onrender.com';
    }

    // Always use deployed Railway URL for production
    return 'https://food-scanner-backend-n1q3.onrender.com';
  } catch (e) {
    // Fallback to localhost in development, Railway in production
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return 'http://172.21.176.1:3001';
    }
    return 'https://food-scanner-backend-n1q3.onrender.com';
  }
};

export const API_BASE_URL = resolveDefaultBaseUrl();

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Helpful dev log to confirm which base URL the app is using
  // Route through secure logger
  try {
    const logger = require('./logger');
    (logger && logger.info ? logger.info : console.log)('API_BASE_URL =', API_BASE_URL);
  } catch {
    // Fallback for environments where logger cannot be resolved
    // eslint-disable-next-line no-console
    console.log('API_BASE_URL =', API_BASE_URL);
  }
}