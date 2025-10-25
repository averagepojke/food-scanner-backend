// 🔐 Security Utilities Test Suite
// Comprehensive security testing for input validation and sanitization

import {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateFoodItem,
  secureApiCall,
  validateEnvironment,
} from '../security';

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    test('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeInput(input);
      expect(result).toBe('alertxssHello World');
      expect(result).not.toContain('<script>');
    });

    test('should handle XSS attack vectors', () => {
      const xssPayloads = global.securityTestUtils.generateXSSPayloads();
      
      xssPayloads.forEach(payload => {
        const result = sanitizeInput(payload);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror=');
        expect(result).not.toContain('onload=');
      });
    });

    test('should handle SQL injection attempts', () => {
      const sqlPayloads = global.securityTestUtils.generateSQLInjectionPayloads();
      
      sqlPayloads.forEach(payload => {
        const result = sanitizeInput(payload);
        expect(result).not.toContain("'");
        expect(result).not.toContain(';');
        expect(result).not.toContain('--');
        expect(result).not.toContain('DROP TABLE');
      });
    });

    test('should limit input length', () => {
      const longInput = 'a'.repeat(2000);
      const result = sanitizeInput(longInput, { maxLength: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
    });

    test('should handle null and undefined gracefully', () => {
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
      expect(sanitizeInput('')).toBe('');
    });

    test('should preserve safe HTML when allowed', () => {
      const input = '<p>Safe content</p>';
      const result = sanitizeInput(input, { allowHtml: true });
      expect(result).toBe('<p>Safe content</p>');
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'firstname+lastname@example.com',
        'email@123.123.123.123', // IP address
        '1234567890@example.com',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    test('should reject invalid email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@missingdomain.com',
        'missing@.com',
        'missing.domain@.com',
        'two@@signs@example.com',
        'spaces in@email.com',
        'a'.repeat(250) + '@example.com', // Too long
        '',
        null,
        undefined,
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    test('should handle malicious email inputs', () => {
      const maliciousInputs = [
        '<script>alert(1)</script>@example.com',
        'test@<script>alert(1)</script>.com',
        "admin'--@example.com",
        'test@example.com; DROP TABLE users;',
      ];

      maliciousInputs.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    test('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPass123!',
        'MySecure$Pass456',
        'Complex1ty!',
        'Another#Strong2Pass',
      ];

      strongPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject weak passwords', () => {
      const weakPasswords = [
        'short',
        'alllowercase',
        'ALLUPPERCASE',
        'NoNumbers!',
        '12345678',
        'SimplePassword',
      ];

      weakPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.message).toBeDefined();
      });
    });

    test('should reject passwords that are too long', () => {
      const tooLong = 'a'.repeat(200);
      const result = validatePassword(tooLong);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('too long');
    });

    test('should handle null and undefined', () => {
      expect(validatePassword(null).isValid).toBe(false);
      expect(validatePassword(undefined).isValid).toBe(false);
      expect(validatePassword('').isValid).toBe(false);
    });
  });

  describe('validateFoodItem', () => {
    test('should validate correct food items', () => {
      const validItems = [
        { name: 'Apple', calories: 80, quantity: 1 },
        { name: 'Banana', calories: 105 },
        { name: 'Chicken Breast', quantity: 200 },
        { name: 'Rice' },
      ];

      validItems.forEach(item => {
        const result = validateFoodItem(item);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject invalid food items', () => {
      const invalidItems = [
        null,
        undefined,
        {},
        { name: '', calories: 80 },
        { name: 'a'.repeat(200), calories: 80 }, // Too long name
        { name: 'Apple', calories: -50 }, // Negative calories
        { name: 'Apple', calories: 20000 }, // Too many calories
        { name: 'Apple', quantity: -1 }, // Negative quantity
      ];

      invalidItems.forEach(item => {
        const result = validateFoodItem(item);
        expect(result.isValid).toBe(false);
      });
    });

    test('should sanitize food item names', () => {
      const maliciousItem = {
        name: '<script>alert("xss")</script>Apple',
        calories: 80,
      };
      
      // The function should not validate malicious names
      const result = validateFoodItem(maliciousItem);
      // Note: This test assumes validateFoodItem also sanitizes input
      expect(result.isValid).toBe(false);
    });
  });

  describe('secureApiCall', () => {
    beforeEach(() => {
      global.fetch.mockClear();
    });

    test('should make successful API calls', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const response = await secureApiCall('https://api.example.com/test');
      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'FoodScannerApp/1.0',
            'Accept': 'application/json',
          }),
        })
      );
    });

    test('should prevent SSRF attacks', async () => {
      const maliciousUrls = [
        'http://localhost:3000/admin',
        'http://127.0.0.1:8080/internal',
        'http://192.168.1.1/router',
        'http://10.0.0.1/internal',
      ];

      for (const url of maliciousUrls) {
        await expect(secureApiCall(url)).rejects.toThrow(
          'Access to private networks is not allowed'
        );
      }
    });

    test('should handle timeouts', async () => {
      global.fetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 15000))
      );

      await expect(
        secureApiCall('https://slow-api.example.com', { timeout: 1000 })
      ).rejects.toThrow();
    });

    test('should retry failed requests', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      const response = await secureApiCall('https://api.example.com/test', {
        maxRetries: 3,
      });
      
      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('should validate URL input', async () => {
      const invalidUrls = [null, undefined, '', 'not-a-url', 123];

      for (const url of invalidUrls) {
        await expect(secureApiCall(url)).rejects.toThrow('Invalid URL provided');
      }
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should pass with all required environment variables', () => {
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-key';
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';

      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should fail with missing environment variables', () => {
      delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      
      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables'
      );
    });

    test('should identify all missing variables', () => {
      delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

      expect(() => validateEnvironment()).toThrow(
        expect.stringContaining('EXPO_PUBLIC_FIREBASE_API_KEY')
      );
      expect(() => validateEnvironment()).toThrow(
        expect.stringContaining('EXPO_PUBLIC_FIREBASE_PROJECT_ID')
      );
    });
  });
});