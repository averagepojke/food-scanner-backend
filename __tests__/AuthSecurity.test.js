// 🔐 Authentication Security Test Suite
// Testing enhanced authentication features

import { authSecurity, secureAuth } from '../AuthSecurity';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Firebase auth
jest.mock('../food-scanner-app/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

describe('Authentication Security', () => {
  beforeEach(() => {
    AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Account Lockout Protection', () => {
    test('should allow login attempts within limit', async () => {
      const email = 'test@example.com';
      
      // Simulate 3 failed attempts (under the limit of 5)
      for (let i = 0; i < 3; i++) {
        const result = await authSecurity.recordFailedLogin(email);
        expect(result.attemptsRemaining).toBe(5 - (i + 1));
      }
      
      // Should not be locked yet
      const lockStatus = await authSecurity.isAccountLocked(email);
      expect(lockStatus).toBe(false);
    });

    test('should lock account after max failed attempts', async () => {
      const email = 'test@example.com';
      
      // Simulate 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await authSecurity.recordFailedLogin(email);
      }
      
      // 5th attempt should lock the account
      await expect(
        authSecurity.recordFailedLogin(email)
      ).rejects.toThrow('Too many failed login attempts');
      
      const lockStatus = await authSecurity.isAccountLocked(email);
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.minutesRemaining).toBeGreaterThan(0);
    });

    test('should clear failed attempts after successful login', async () => {
      const email = 'test@example.com';
      
      // Record some failed attempts
      await authSecurity.recordFailedLogin(email);
      await authSecurity.recordFailedLogin(email);
      
      // Clear attempts (simulate successful login)
      await authSecurity.clearFailedAttempts(email);
      
      // Should be able to fail again without immediate lockout
      const result = await authSecurity.recordFailedLogin(email);
      expect(result.attemptsRemaining).toBe(4); // Reset to max attempts
    });

    test('should automatically unlock after lockout period', async () => {
      const email = 'test@example.com';
      
      // Force lock by setting old lockout time
      const pastLockoutTime = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      await AsyncStorage.setItem(`lockoutTime_${email}`, pastLockoutTime.toString());
      
      const lockStatus = await authSecurity.isAccountLocked(email);
      expect(lockStatus).toBe(false); // Should be automatically unlocked
    });
  });

  describe('Session Management', () => {
    test('should start new session correctly', async () => {
      const userId = 'test-user-123';
      await authSecurity.startSession(userId);
      
      const sessionStart = await AsyncStorage.getItem('sessionStartTime');
      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      
      expect(sessionStart).toBeDefined();
      expect(lastActivity).toBeDefined();
      expect(parseInt(sessionStart)).toBeGreaterThan(Date.now() - 1000);
    });

    test('should update activity time', async () => {
      await authSecurity.updateActivityTime();
      
      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      expect(lastActivity).toBeDefined();
      expect(parseInt(lastActivity)).toBeGreaterThan(Date.now() - 1000);
    });

    test('should detect expired sessions', async () => {
      // Set session start time to 25 hours ago (past 24-hour limit)
      const expiredTime = Date.now() - (25 * 60 * 60 * 1000);
      await AsyncStorage.setItem('sessionStartTime', expiredTime.toString());
      await AsyncStorage.setItem('lastActivityTime', expiredTime.toString());
      
      const mockForceLogout = jest.spyOn(authSecurity, 'forceLogout').mockImplementation();
      
      await authSecurity.checkSessionValidity();
      
      expect(mockForceLogout).toHaveBeenCalledWith('Session expired');
      mockForceLogout.mockRestore();
    });

    test('should detect inactivity timeout', async () => {
      // Set valid session but old activity (35 minutes ago)
      const recentTime = Date.now() - (1000 * 60); // 1 minute ago (valid session)
      const inactiveTime = Date.now() - (35 * 60 * 1000); // 35 minutes ago (inactive)
      
      await AsyncStorage.setItem('sessionStartTime', recentTime.toString());
      await AsyncStorage.setItem('lastActivityTime', inactiveTime.toString());
      
      const mockForceLogout = jest.spyOn(authSecurity, 'forceLogout').mockImplementation();
      
      await authSecurity.checkSessionValidity();
      
      expect(mockForceLogout).toHaveBeenCalledWith('Inactivity timeout');
      mockForceLogout.mockRestore();
    });
  });

  describe('Password Reset Rate Limiting', () => {
    test('should allow first password reset', async () => {
      const email = 'test@example.com';
      const result = await authSecurity.checkPasswordResetCooldown(email);
      expect(result).toBe(true);
    });

    test('should prevent rapid password reset requests', async () => {
      const email = 'test@example.com';
      
      // First request should succeed
      await authSecurity.checkPasswordResetCooldown(email);
      
      // Second immediate request should fail
      await expect(
        authSecurity.checkPasswordResetCooldown(email)
      ).rejects.toThrow('Please wait');
    });

    test('should allow password reset after cooldown period', async () => {
      const email = 'test@example.com';
      
      // Set old reset time (10 minutes ago, past 5-minute cooldown)
      const oldResetTime = Date.now() - (10 * 60 * 1000);
      await AsyncStorage.setItem(`passwordReset_${email}`, oldResetTime.toString());
      
      const result = await authSecurity.checkPasswordResetCooldown(email);
      expect(result).toBe(true);
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should record normal activity', async () => {
      const userId = 'test-user-123';
      const activityType = 'login_attempt';
      
      const result = await authSecurity.detectSuspiciousActivity(
        userId, 
        activityType, 
        { userAgent: 'test-agent' }
      );
      
      expect(result).toBe(false); // Not suspicious yet
    });

    test('should detect suspicious activity patterns', async () => {
      const userId = 'test-user-123';
      const activityType = 'login_attempt';
      
      // Generate suspicious activity (3+ attempts quickly)
      for (let i = 0; i < 3; i++) {
        await authSecurity.detectSuspiciousActivity(userId, activityType);
      }
      
      const result = await authSecurity.detectSuspiciousActivity(userId, activityType);
      expect(result).toBe(true); // Should be flagged as suspicious
    });

    test('should force logout after repeated suspicious activity', async () => {
      const userId = 'test-user-123';
      const activityType = 'failed_login';
      
      const mockForceLogout = jest.spyOn(authSecurity, 'forceLogout').mockImplementation();
      
      // Generate multiple suspicious activities
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          await authSecurity.detectSuspiciousActivity(userId, `${activityType}_${i}`);
        }
      }
      
      expect(mockForceLogout).toHaveBeenCalledWith('Suspicious activity detected');
      mockForceLogout.mockRestore();
    });
  });

  describe('Secure Authentication Wrapper', () => {
    test('should handle successful sign in', async () => {
      const email = 'test@example.com';
      const password = 'ValidPass123!';
      const mockUser = global.securityTestUtils.createMockUser();
      
      const mockSignIn = jest.fn().mockResolvedValue({ user: mockUser });
      
      const result = await secureAuth.signIn(email, password, mockSignIn);
      
      expect(result.user).toEqual(mockUser);
      expect(mockSignIn).toHaveBeenCalledWith(email, password);
    });

    test('should handle failed sign in with lockout', async () => {
      const email = 'test@example.com';
      const password = 'WrongPassword';
      
      const mockSignIn = jest.fn().mockRejectedValue(
        global.securityTestUtils.createAuthError(
          'auth/invalid-credential', 
          'Invalid credentials'
        )
      );
      
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await secureAuth.signIn(email, password, mockSignIn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // 6th attempt should be blocked due to lockout
      await expect(
        secureAuth.signIn(email, password, mockSignIn)
      ).rejects.toThrow('Account locked');
    });

    test('should prevent sign in for locked accounts', async () => {
      const email = 'locked@example.com';
      const password = 'ValidPass123!';
      
      // Pre-lock the account
      const lockTime = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      await AsyncStorage.setItem(`lockoutTime_${email}`, lockTime.toString());
      
      const mockSignIn = jest.fn();
      
      await expect(
        secureAuth.signIn(email, password, mockSignIn)
      ).rejects.toThrow('Account locked');
      
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  describe('Force Logout', () => {
    test('should clear session data on force logout', async () => {
      // Set up session data
      await AsyncStorage.setItem('sessionStartTime', Date.now().toString());
      await AsyncStorage.setItem('lastActivityTime', Date.now().toString());
      
      await authSecurity.forceLogout('Test logout');
      
      const sessionStart = await AsyncStorage.getItem('sessionStartTime');
      const lastActivity = await AsyncStorage.getItem('lastActivityTime');
      
      expect(sessionStart).toBeNull();
      expect(lastActivity).toBeNull();
    });

    test('should handle logout errors gracefully', async () => {
      // Mock signOut to throw error
      const { signOut } = require('firebase/auth');
      signOut.mockRejectedValueOnce(new Error('Logout failed'));
      
      // Should not throw error
      await expect(
        authSecurity.forceLogout('Test logout')
      ).resolves.toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup intervals and listeners', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      authSecurity.cleanup();
      
      // Verify cleanup was called (exact number depends on implementation)
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});