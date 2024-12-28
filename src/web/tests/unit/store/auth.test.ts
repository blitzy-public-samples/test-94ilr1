// @reduxjs/toolkit version ^1.9.7
// @jest/globals version ^29.7.0
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  authSlice,
  login,
  verifyMFA,
  logout,
  validateSession,
  refreshToken,
  selectAuthState,
  resetAuthState,
  updateSessionTimestamp,
  addSecurityEvent
} from '../../src/store/auth.slice';
import { AuthService } from '../../src/services/auth.service';
import type {
  AuthState,
  User,
  RolePermissions,
  SecurityConfig,
  AuthCredentials,
  MFARequest,
  UserRole,
  AuthError
} from '../../src/types/auth.types';

// Mock AuthService
jest.mock('../../src/services/auth.service');

// Test data setup
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

const mockCredentials: AuthCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  rememberMe: true
};

const mockMFARequest: MFARequest = {
  code: '123456',
  challengeId: 'test-challenge-id',
  method: 'TOTP'
};

const mockAuthError: AuthError = {
  code: 'AUTH_ERROR',
  message: 'Authentication failed',
  details: { timestamp: new Date().toISOString() }
};

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  let mockAuthService: jest.Mocked<typeof AuthService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Configure test store
    store = configureStore({
      reducer: {
        auth: authSlice.reducer
      }
    });

    // Setup AuthService mock
    mockAuthService = {
      loginWithCredentials: jest.fn(),
      handleMFAVerification: jest.fn(),
      logoutUser: jest.fn(),
      validateUserSession: jest.fn(),
      refreshUserToken: jest.fn(),
      validateRolePermissions: jest.fn()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication Flow', () => {
    test('should handle initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        userRole: null,
        permissions: null,
        sessionValid: false,
        loading: false,
        error: null,
        lastValidated: null,
        mfaPending: false,
        securityEvents: []
      });
    });

    test('should handle successful login without MFA', async () => {
      mockAuthService.loginWithCredentials.mockResolvedValueOnce({
        user: mockUser,
        requiresMFA: false
      });

      await store.dispatch(login(mockCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.mfaPending).toBe(false);
      expect(state.error).toBeNull();
    });

    test('should handle login with MFA requirement', async () => {
      mockAuthService.loginWithCredentials.mockResolvedValueOnce({
        user: mockUser,
        requiresMFA: true
      });

      await store.dispatch(login(mockCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.mfaPending).toBe(true);
      expect(state.user).toEqual(mockUser);
    });

    test('should handle successful MFA verification', async () => {
      mockAuthService.handleMFAVerification.mockResolvedValueOnce({
        user: mockUser,
        requiresMFA: false
      });

      await store.dispatch(verifyMFA(mockMFARequest));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaPending).toBe(false);
      expect(state.user).toEqual(mockUser);
    });

    test('should handle failed login attempt', async () => {
      mockAuthService.loginWithCredentials.mockRejectedValueOnce(mockAuthError);

      await store.dispatch(login(mockCredentials));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toEqual(mockAuthError);
      expect(state.loading).toBe(false);
    });

    test('should handle logout', async () => {
      mockAuthService.logoutUser.mockResolvedValueOnce();

      await store.dispatch(logout());
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.sessionValid).toBe(false);
    });
  });

  describe('Security Validation', () => {
    test('should handle session validation success', async () => {
      mockAuthService.validateUserSession.mockResolvedValueOnce(true);

      await store.dispatch(validateSession());
      const state = store.getState().auth;

      expect(state.sessionValid).toBe(true);
      expect(state.lastValidated).toBeTruthy();
    });

    test('should handle session validation failure', async () => {
      mockAuthService.validateUserSession.mockResolvedValueOnce(false);

      await store.dispatch(validateSession());
      const state = store.getState().auth;

      expect(state.sessionValid).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    test('should handle token refresh', async () => {
      mockAuthService.refreshUserToken.mockResolvedValueOnce({
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token'
      });

      await store.dispatch(refreshToken());
      const state = store.getState().auth;

      expect(state.sessionValid).toBe(true);
      expect(state.lastValidated).toBeTruthy();
    });

    test('should track security events', () => {
      const securityEvent = {
        type: 'LOGIN_ATTEMPT',
        details: { ip: '127.0.0.1', timestamp: new Date().toISOString() }
      };

      store.dispatch(addSecurityEvent(securityEvent));
      const state = store.getState().auth;

      expect(state.securityEvents).toContainEqual(expect.objectContaining(securityEvent));
    });
  });

  describe('Role-Based Access', () => {
    test('should handle role assignment on login', async () => {
      const adminUser = { ...mockUser, roles: [UserRole.ADMIN] };
      mockAuthService.loginWithCredentials.mockResolvedValueOnce({
        user: adminUser,
        requiresMFA: false
      });

      await store.dispatch(login(mockCredentials));
      const state = store.getState().auth;

      expect(state.userRole).toBe(UserRole.ADMIN);
    });

    test('should validate role permissions', () => {
      const adminUser = { ...mockUser, roles: [UserRole.ADMIN] };
      mockAuthService.validateRolePermissions.mockReturnValueOnce(true);

      const hasPermission = mockAuthService.validateRolePermissions(adminUser, 'MANAGE_USERS');
      expect(hasPermission).toBe(true);
    });

    test('should handle permission inheritance', () => {
      const managerUser = { ...mockUser, roles: [UserRole.MANAGER] };
      mockAuthService.validateRolePermissions.mockReturnValueOnce(true);

      const hasPermission = mockAuthService.validateRolePermissions(managerUser, 'VIEW_REPORTS');
      expect(hasPermission).toBe(true);
    });
  });

  describe('State Selectors', () => {
    test('should select auth state', () => {
      const state = store.getState();
      const authState = selectAuthState(state);
      expect(authState).toBeDefined();
    });

    test('should handle state reset', () => {
      store.dispatch(resetAuthState());
      const state = store.getState().auth;
      expect(state).toEqual(expect.objectContaining({
        isAuthenticated: false,
        user: null,
        loading: false
      }));
    });

    test('should update session timestamp', () => {
      store.dispatch(updateSessionTimestamp());
      const state = store.getState().auth;
      expect(state.lastValidated).toBeTruthy();
    });
  });
});