import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Prefer env var; otherwise choose sensible defaults per platform
const resolveDefaultBaseUrl = () => {
  try {
    // Check if we have an environment variable set
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_API_BASE_URL;
    }

    // For production, use Railway deployment URL
    // Temporarily force Railway URL for testing
    return 'https://food-scanner-backend-production-dcec.up.railway.app';

    // Development: Derive host from the Expo packager host when available (works for Expo Go on phone)
    // Examples: "192.168.1.23:19000" or "localhost:19000"
    const hostUri = (Constants?.expoConfig && Constants.expoConfig.hostUri) || (Constants?.manifest && Constants.manifest.debuggerHost) || '';
    let host = String(hostUri).split(':')[0] || 'localhost';
    if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
      // For Android emulator, we need to use 10.0.2.2 to access host machine
      host = '10.0.2.2';
    }
    return `http://${host}:3001`;
  } catch (e) {
    // Fallback for any errors
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:3001`;
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