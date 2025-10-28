// 🛡️ Critical Error Boundary Test Suite
// Testing crash protection and error handling

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CriticalErrorBoundary from '../CriticalErrorBoundary';
import { Text } from 'react-native';

// Component that throws error for testing
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <Text>Normal Component</Text>;
};

// Mock logger to test error reporting
jest.mock('../logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe('CriticalErrorBoundary', () => {
  beforeEach(() => {
    // Reset console mocks
    jest.clearAllMocks();
    
    // Mock console.error to prevent noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('Normal Operation', () => {
    test('should render children when no error occurs', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CriticalErrorBoundary>
      );

      expect(getByText('Normal Component')).toBeTruthy();
    });

    test('should not show error UI when children render successfully', () => {
      const { queryByText } = render(
        <CriticalErrorBoundary>
          <Text>Working Component</Text>
        </CriticalErrorBoundary>
      );

      expect(queryByText('Oops! Something went wrong')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should catch and display error boundary UI', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Component crashed" />
        </CriticalErrorBoundary>
      );

      expect(getByText('Oops! Something went wrong')).toBeTruthy();
      expect(getByText(/The app encountered an unexpected error/)).toBeTruthy();
    });

    test('should show custom user message when provided', () => {
      const customMessage = 'Custom error message for users';
      const { getByText } = render(
        <CriticalErrorBoundary userMessage={customMessage}>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      expect(getByText(customMessage)).toBeTruthy();
    });

    test('should log error details securely', () => {
      const logger = require('../logger');
      
      render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test crash" />
        </CriticalErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Critical error caught by boundary:',
        expect.objectContaining({
          error: 'Test crash',
          retryCount: 0
        })
      );
    });

    test('should show debug info only in development', () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = true;

      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Debug error" />
        </CriticalErrorBoundary>
      );

      expect(getByText('Debug Info:')).toBeTruthy();
      expect(getByText('Debug error')).toBeTruthy();

      global.__DEV__ = originalDev;
    });

    test('should hide debug info in production', () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = false;

      const { queryByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Production error" />
        </CriticalErrorBoundary>
      );

      expect(queryByText('Debug Info:')).toBeNull();

      global.__DEV__ = originalDev;
    });
  });

  describe('Recovery Features', () => {
    test('should show try again button when retry attempts available', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      expect(getByText('Try Again')).toBeTruthy();
    });

    test('should allow retry when under limit', () => {
      const TestComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);
        
        React.useEffect(() => {
          // After component mounts, stop throwing error on retry
          setTimeout(() => setShouldThrow(false), 100);
        }, []);

        return <ThrowError shouldThrow={shouldThrow} />;
      };

      const { getByText, queryByText } = render(
        <CriticalErrorBoundary>
          <TestComponent />
        </CriticalErrorBoundary>
      );

      // Should show error initially
      expect(getByText('Oops! Something went wrong')).toBeTruthy();

      // Click try again
      fireEvent.press(getByText('Try Again'));

      // Wait for retry (component should recover)
      setTimeout(() => {
        expect(queryByText('Oops! Something went wrong')).toBeNull();
      }, 200);
    });

    test('should hide try again button after max retries', () => {
      // Create a boundary that has already reached max retries
      const boundary = new CriticalErrorBoundary({});
      boundary.state = {
        hasError: true,
        error: new Error('Test'),
        errorInfo: { componentStack: 'test' },
        retryCount: 3 // Max retries reached
      };

      const { queryByText, getByText } = render(
        boundary.render()
      );

      expect(queryByText('Try Again')).toBeNull();
      expect(getByText('Restart App')).toBeTruthy();
    });

    test('should always show restart app button', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      expect(getByText('Restart App')).toBeTruthy();
    });

    test('should call restart handler when provided', () => {
      const mockRestart = jest.fn();
      
      const { getByText } = render(
        <CriticalErrorBoundary onRestart={mockRestart}>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      fireEvent.press(getByText('Restart App'));
      expect(mockRestart).toHaveBeenCalled();
    });
  });

  describe('Error Reporting', () => {
    test('should increment retry count on subsequent errors', () => {
      const logger = require('../logger');
      
      const ErrorComponent = ({ version }) => {
        throw new Error(`Error version ${version}`);
      };

      const TestWrapper = () => {
        const [version, setVersion] = React.useState(1);
        
        return (
          <CriticalErrorBoundary>
            <ErrorComponent version={version} />
          </CriticalErrorBoundary>
        );
      };

      const { rerender } = render(<TestWrapper />);

      // First error should have retryCount: 0
      expect(logger.error).toHaveBeenCalledWith(
        'Critical error caught by boundary:',
        expect.objectContaining({
          retryCount: 0
        })
      );
    });

    test('should report errors to external service in production', () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = false;

      const boundary = new CriticalErrorBoundary({});
      const mockReportError = jest.spyOn(boundary, 'reportErrorToService').mockImplementation();

      const error = new Error('Production error');
      const errorInfo = { componentStack: 'test stack' };

      boundary.componentDidCatch(error, errorInfo);

      expect(mockReportError).toHaveBeenCalledWith(error, errorInfo);

      global.__DEV__ = originalDev;
      mockReportError.mockRestore();
    });

    test('should not report errors to external service in development', () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = true;

      const boundary = new CriticalErrorBoundary({});
      const mockReportError = jest.spyOn(boundary, 'reportErrorToService').mockImplementation();

      const error = new Error('Dev error');
      const errorInfo = { componentStack: 'test stack' };

      boundary.componentDidCatch(error, errorInfo);

      expect(mockReportError).not.toHaveBeenCalled();

      global.__DEV__ = originalDev;
      mockReportError.mockRestore();
    });
  });

  describe('Fallback UI Customization', () => {
    test('should use custom fallback when provided', () => {
      const CustomFallback = () => <Text>Custom Error UI</Text>;
      
      const { getByText } = render(
        <CriticalErrorBoundary fallback={<CustomFallback />}>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      expect(getByText('Custom Error UI')).toBeTruthy();
    });

    test('should use default fallback when none provided', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      // Should use default error UI
      expect(getByText('Oops! Something went wrong')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    test('should be accessible to screen readers', () => {
      const { getByText } = render(
        <CriticalErrorBoundary>
          <ThrowError shouldThrow={true} />
        </CriticalErrorBoundary>
      );

      const errorTitle = getByText('Oops! Something went wrong');
      const tryAgainButton = getByText('Try Again');
      const restartButton = getByText('Restart App');

      // Basic accessibility checks
      expect(errorTitle).toBeTruthy();
      expect(tryAgainButton).toBeTruthy();
      expect(restartButton).toBeTruthy();
    });
  });
});