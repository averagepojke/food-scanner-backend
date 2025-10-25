// 🔐 SECURE LOGGING UTILITY
// Prevents sensitive data exposure in production

// Check if we're in development mode (works in both React Native and Node.js)
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const isProduction = !isDev;

class SecureLogger {
  constructor() {
    this.isEnabled = isDev;
  }

  // Safe logging - only in development
  log(...args) {
    if (this.isEnabled) {
      console.log('[DEV]', ...args);
    }
  }

  // Important info - shows in development, limited in production
  info(...args) {
    if (this.isEnabled) {
      console.info('[INFO]', ...args);
    } else {
      // In production, only log non-sensitive info
      const safeArgs = this.sanitizeArgs(args);
      console.info('[INFO]', ...safeArgs);
    }
  }

  // Warnings always show but sanitized in production
  warn(...args) {
    if (this.isEnabled) {
      console.warn('[WARN]', ...args);
    } else {
      const safeArgs = this.sanitizeArgs(args);
      console.warn('[WARN]', ...safeArgs);
    }
  }

  // Errors always show (needed for debugging production issues)
  error(...args) {
    console.error('[ERROR]', ...args);
  }

  // Sanitize sensitive data for production logging
  sanitizeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Remove potential sensitive patterns
        return arg
          .replace(/userId[:\s]*[^\s,}]*/gi, 'userId: [REDACTED]')
          .replace(/email[:\s]*[^\s,}]*/gi, 'email: [REDACTED]')
          .replace(/token[:\s]*[^\s,}]*/gi, 'token: [REDACTED]')
          .replace(/key[:\s]*[^\s,}]*/gi, 'key: [REDACTED]');
      }
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        // Remove sensitive object properties
        if (sanitized.userId) sanitized.userId = '[REDACTED]';
        if (sanitized.email) sanitized.email = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.password) sanitized.password = '[REDACTED]';
        return sanitized;
      }
      return arg;
    });
  }

  // Debug method - completely disabled in production
  debug(...args) {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  }
}

// Create singleton instance
const logger = new SecureLogger();

module.exports = logger;
module.exports.default = logger;

// Convenience exports
module.exports.log = logger.log.bind(logger);
module.exports.info = logger.info.bind(logger);
module.exports.warn = logger.warn.bind(logger);
module.exports.error = logger.error.bind(logger);
module.exports.debug = logger.debug.bind(logger);