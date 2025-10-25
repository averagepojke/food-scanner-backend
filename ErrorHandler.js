import React from 'react';
import { Alert, ToastAndroid, Platform, View, Text } from 'react-native';

class ErrorHandler {
  constructor() {
    this.errorListeners = [];
    this.retryQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Add error listener
  addErrorListener(callback) {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(listener => listener !== callback);
    };
  }

  // Notify error listeners
  notifyErrorListeners(error, context = {}) {
    this.errorListeners.forEach(listener => listener(error, context));
  }

  // Handle errors with retry mechanism
  async handleWithRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Log error
        this.logError(error, { ...context, attempt });
        
        // If it's the last attempt, don't retry
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Wait before retrying
        await this.delay(this.retryDelay * attempt);
      }
    }
    
    // All retries failed
    this.handleError(lastError, context);
    throw lastError;
  }

  // Handle errors with custom retry logic
  async handleWithCustomRetry(operation, retryCondition, context = {}) {
    let lastError;
    let attempt = 1;
    
    while (attempt <= this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (!retryCondition(error, attempt)) {
          break;
        }
        
        this.logError(error, { ...context, attempt });
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        await this.delay(this.retryDelay * attempt);
        attempt++;
      }
    }
    
    this.handleError(lastError, context);
    throw lastError;
  }

  // Handle network errors specifically
  async handleNetworkError(operation, context = {}) {
    return this.handleWithCustomRetry(
      operation,
      (error, attempt) => {
        // Retry on network errors, but not on validation errors
        return error.message?.includes('network') || 
               error.message?.includes('timeout') ||
               error.code === 'NETWORK_ERROR';
      },
      context
    );
  }

  // Handle errors with user feedback
  handleError(error, context = {}) {
    // Log the error
    this.logError(error, context);
    
    // Notify listeners
    this.notifyErrorListeners(error, context);
    
    // Show user-friendly message
    this.showUserError(error, context);
  }

  // Show user-friendly error message
  showUserError(error, context = {}) {
    const message = this.getUserFriendlyMessage(error, context);
    
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert('Error', message);
    }
  }

  // Get user-friendly error message
  getUserFriendlyMessage(error, context = {}) {
    const errorMessage = error.message || error.toString();
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    
    // Storage errors
    if (errorMessage.includes('storage') || errorMessage.includes('AsyncStorage')) {
      return 'Unable to save data. Please try again.';
    }
    
    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('login')) {
      return 'Authentication failed. Please log in again.';
    }
    
    // Camera/Permission errors
    if (errorMessage.includes('camera') || errorMessage.includes('permission')) {
      return 'Camera permission required. Please enable camera access in settings.';
    }
    
    // Generic error
    return 'Something went wrong. Please try again.';
  }

  // Log error for debugging
  logError(error, context = {}) {
    console.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Queue operations for retry
  queueForRetry(operation, context = {}) {
    this.retryQueue.push({ operation, context, attempts: 0 });
    this.processRetryQueue();
  }

  // Process retry queue
  async processRetryQueue() {
    if (this.retryQueue.length === 0) return;
    
    const item = this.retryQueue.shift();
    
    try {
      await item.operation();
    } catch (error) {
      item.attempts++;
      
      if (item.attempts < this.maxRetries) {
        // Re-queue for retry
        setTimeout(() => {
          this.retryQueue.push(item);
          this.processRetryQueue();
        }, this.retryDelay * item.attempts);
      } else {
        // Max retries reached
        this.handleError(error, item.context);
      }
    }
  }

  // Clear retry queue
  clearRetryQueue() {
    this.retryQueue = [];
  }

  // Set retry configuration
  setRetryConfig(maxRetries, retryDelay) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();
export default errorHandler;

// React Error Boundary Component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorHandler.logError(error, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#666' }}>
            Something went wrong. Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Hook for error handling
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);
  
  React.useEffect(() => {
    const unsubscribe = errorHandler.addErrorListener((error, context) => {
      setError(error);
    });
    
    return unsubscribe;
  }, []);
  
  const handleError = React.useCallback((error, context = {}) => {
    errorHandler.handleError(error, context);
  }, []);
  
  const handleWithRetry = React.useCallback(async (operation, context = {}) => {
    return errorHandler.handleWithRetry(operation, context);
  }, []);
  
  return { error, handleError, handleWithRetry };
}; 