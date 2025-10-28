import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import logger from './logger';

// 🛡️ CRITICAL ERROR BOUNDARY - Prevents app crashes in production
class CriticalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error securely
    logger.error('Critical error caught by boundary:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    });

    this.setState({
      error,
      errorInfo,
    });

    // Report to error tracking service in production
    if (!__DEV__) {
      this.reportErrorToService(error, errorInfo);
    }
  }

  reportErrorToService = (error, errorInfo) => {
    // TODO: Integrate with crash analytics like Sentry or Bugsnag
    logger.error('Production error reported:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent || 'Unknown'
    });
  };

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    if (newRetryCount > 3) {
      logger.warn('Max retry attempts reached, showing permanent error');
      return;
    }

    logger.info('User attempting error recovery, retry:', newRetryCount);
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount
    });
  };

  handleRestart = () => {
    logger.info('User requested app restart');
    // In a real app, you might trigger a complete app reload
    if (this.props.onRestart) {
      this.props.onRestart();
    }
  };

  render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < 3;
      
      return this.props.fallback || (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <MaterialCommunityIcons 
              name="alert-circle" 
              size={64} 
              color="#F43F5E" 
              style={styles.icon}
            />
            
            <Text style={styles.title}>
              Oops! Something went wrong
            </Text>
            
            <Text style={styles.message}>
              {this.props.userMessage || 
               'The app encountered an unexpected error. This has been reported and will be fixed soon.'}
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              {canRetry && (
                <TouchableOpacity 
                  style={[styles.button, styles.retryButton]} 
                  onPress={this.handleRetry}
                >
                  <MaterialCommunityIcons name="refresh" size={20} color="white" />
                  <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.button, styles.restartButton]} 
                onPress={this.handleRestart}
              >
                <MaterialCommunityIcons name="restart" size={20} color="white" />
                <Text style={styles.buttonText}>Restart App</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.supportText}>
              If this problem persists, please contact support or try restarting the app.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  debugContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
  },
  restartButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  supportText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CriticalErrorBoundary;

// HOC for easy wrapping
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <CriticalErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </CriticalErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};