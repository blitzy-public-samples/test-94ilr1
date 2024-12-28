// @testing-library/react-hooks version ^8.0.1
// @jest/globals version ^29.7.0
// @reduxjs/toolkit version ^1.9.5
// react-redux version ^8.1.0

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';

import { useAuth } from '../../src/hooks/useAuth';
import {
  AuthState,
  AuthCredentials,
  MFARequest,
  User,
  SecurityContext,
  UserRole,
  MFAMethod
} from '../../src/types/auth.types';
import authReducer, {
  login,
  verifyMFA,
  logout,
  validateSession
} from '../../src/store/auth.slice';

// Mock initial state with security context
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  mfaPending: false,
  securityEvents: []
};

// Mock user data
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  roles: [UserRole.USER],
  preferences: {
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      inApp: true
    }
  },
  mfaEnabled: true,
  lastLogin: new Date()
};

// Mock credentials
const mockCredentials: AuthCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  rememberMe: true
};

// Mock MFA request
const mockMFARequest: MFARequest = {
  code: '123456',
  challengeId: 'test-challenge',
  method: MFAMethod.TOTP
};

// Configure test store with security features
const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        ...initialState,
        ...preloadedState
      }
    }
  });
};

// Test wrapper with security context
const createWrapper = (store: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useAuth Hook - Security and Authentication Tests', () => {
  let store: any;
  let wrapper: any;

  beforeEach(() => {
    // Reset store and security context before each test
    store = createTestStore();
    wrapper = createWrapper(store);

    // Setup security monitoring mocks
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clean up security context and mocks
    jest.clearAllMocks();
    jest.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Authentication Flow Tests', () => {
    it('should handle successful login with security validation', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock successful login response
      store.dispatch = jest.fn().mockResolvedValueOnce({
        payload: {
          user: mockUser,
          requiresMFA: true
        }
      });

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('auth/login')
        })
      );
      expect(result.current.mfaPending).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle MFA verification with security checks', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Setup initial MFA pending state
      store = createTestStore({
        mfaPending: true,
        user: mockUser
      });

      // Mock successful MFA verification
      store.dispatch = jest.fn().mockResolvedValueOnce({
        payload: {
          user: mockUser,
          requiresMFA: false
        }
      });

      await act(async () => {
        await result.current.verifyMFA(mockMFARequest);
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('auth/verifyMFA')
        })
      );
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.mfaPending).toBe(false);
    });

    it('should handle secure logout with session cleanup', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Setup authenticated state
      store = createTestStore({
        isAuthenticated: true,
        user: mockUser
      });

      store.dispatch = jest.fn().mockResolvedValueOnce({});

      await act(async () => {
        await result.current.logout();
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('auth/logout')
        })
      );
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Security Validation Tests', () => {
    it('should validate session state and security context', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock session validation
      store.dispatch = jest.fn().mockResolvedValueOnce({
        payload: true
      });

      await act(async () => {
        await result.current.validateSession();
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('auth/validateSession')
        })
      );
      expect(result.current.securityContext.sessionValid).toBe(true);
    });

    it('should handle authentication errors securely', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock authentication error
      store.dispatch = jest.fn().mockRejectedValueOnce({
        code: 'AUTH_ERROR',
        message: 'Invalid credentials',
        details: { timestamp: new Date().toISOString() }
      });

      await act(async () => {
        try {
          await result.current.login(mockCredentials);
        } catch (error) {
          // Error expected
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isAuthenticated).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should enforce rate limiting on authentication attempts', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Simulate multiple failed login attempts
      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts + 1; i++) {
        store.dispatch = jest.fn().mockRejectedValueOnce({
          code: 'AUTH_ERROR',
          message: 'Invalid credentials'
        });

        await act(async () => {
          try {
            await result.current.login(mockCredentials);
          } catch (error) {
            // Error expected
          }
        });
      }

      // Verify rate limiting
      await act(async () => {
        try {
          await result.current.login(mockCredentials);
        } catch (error) {
          expect(error).toMatchObject({
            message: expect.stringContaining('Maximum authentication attempts exceeded')
          });
        }
      });
    });
  });

  describe('Session Management Tests', () => {
    it('should handle session timeout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Setup authenticated session
      store = createTestStore({
        isAuthenticated: true,
        user: mockUser
      });

      // Fast-forward past session timeout
      act(() => {
        jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should maintain security context during active session', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Setup active session
      store = createTestStore({
        isAuthenticated: true,
        user: mockUser,
        securityContext: {
          sessionValid: true,
          lastValidated: new Date().toISOString()
        }
      });

      // Simulate user activity
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });

      expect(result.current.securityContext.sessionValid).toBe(true);
    });
  });
});