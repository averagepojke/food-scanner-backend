// 🔐 SECURITY UTILITIES - Input validation and sanitization

const logger = require('./logger');

// XSS prevention - sanitize user input
const sanitizeInput = (input, options = {}) => {
  if (typeof input !== 'string') {
    return input;
  }

  const { 
    maxLength = 1000,
    allowHtml = false,
    allowScripts = false 
  } = options;

  let sanitized = input;

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, maxLength);

  if (!allowHtml) {
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  if (!allowScripts) {
    // Remove potential script injections
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+=/gi, '');
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/('|(\\')|(;)|(\|)|(\*)|(%)|(<)|(>)|(\{)|(\})|(\[)|(\])|(\()|(\)))/g, '');

  return sanitized;
};

// Validate email format
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
};

// Validate password strength
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password is too long' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return { 
      isValid: false, 
      message: 'Password must contain uppercase, lowercase, and numbers' 
    };
  }

  return { isValid: true, message: 'Password is strong' };
};

// Validate food item input
const validateFoodItem = (item) => {
  if (!item || typeof item !== 'object') {
    return { isValid: false, message: 'Invalid food item' };
  }

  const { name, calories, quantity } = item;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { isValid: false, message: 'Food name is required' };
  }

  if (name.length > 100) {
    return { isValid: false, message: 'Food name is too long' };
  }

  if (calories && (typeof calories !== 'number' || calories < 0 || calories > 10000)) {
    return { isValid: false, message: 'Invalid calorie value' };
  }

  if (quantity && (typeof quantity !== 'number' || quantity < 0 || quantity > 1000)) {
    return { isValid: false, message: 'Invalid quantity value' };
  }

  return { isValid: true, message: 'Valid food item' };
};

// Rate limiting for API calls
class RateLimiter {
  constructor() {
    this.calls = new Map();
  }

  canMakeCall(key, maxCalls = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.calls.has(key)) {
      this.calls.set(key, []);
    }
    
    const callTimes = this.calls.get(key);
    
    // Remove old calls outside the window
    const recentCalls = callTimes.filter(time => time > windowStart);
    this.calls.set(key, recentCalls);
    
    if (recentCalls.length >= maxCalls) {
      logger.warn('Rate limit exceeded for key:', key);
      return false;
    }
    
    // Add current call
    recentCalls.push(now);
    this.calls.set(key, recentCalls);
    
    return true;
  }

  getRemainingCalls(key, maxCalls = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.calls.has(key)) {
      return maxCalls;
    }
    
    const recentCalls = this.calls.get(key).filter(time => time > windowStart);
    return Math.max(0, maxCalls - recentCalls.length);
  }
}

const rateLimiter = new RateLimiter();

// Secure API request wrapper
const secureApiCall = async (url, options = {}) => {
  const { 
    timeout = 10000,
    maxRetries = 3,
    rateLimitKey,
    ...fetchOptions 
  } = options;

  // Rate limiting check
  if (rateLimitKey && !rateLimiter.canMakeCall(rateLimitKey)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  // Input validation
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  // Prevent SSRF by checking for private IPs
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.') || url.includes('10.0.')) {
    logger.warn('Attempted request to private IP address blocked:', url);
    throw new Error('Access to private networks is not allowed');
  }

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'User-Agent': 'FoodScannerApp/1.0',
          'Accept': 'application/json',
          ...fetchOptions.headers,
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } catch (error) {
      lastError = error;
      logger.warn(`API call attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  logger.error('All API call attempts failed:', lastError.message);
  throw lastError;
};

// Environment validation
const validateEnvironment = () => {
  const requiredEnvVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info('Environment validation passed');
  return true;
};

// Data encryption helper (for sensitive local storage)
const encryptSensitiveData = (data, key) => {
  // Simple obfuscation - in production, use proper encryption
  try {
    const jsonString = JSON.stringify(data);
    const encoded = Buffer.from(jsonString).toString('base64');
    return encoded;
  } catch (error) {
    logger.error('Failed to encrypt data:', error);
    return data;
  }
};

const decryptSensitiveData = (encryptedData, key) => {
  try {
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    logger.error('Failed to decrypt data:', error);
    return encryptedData;
  }
};

// Security headers for API responses
const getSecurityHeaders = () => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  };
};

// CommonJS exports
module.exports = {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateFoodItem,
  rateLimiter,
  secureApiCall,
  validateEnvironment,
  encryptSensitiveData,
  decryptSensitiveData,
  getSecurityHeaders
};