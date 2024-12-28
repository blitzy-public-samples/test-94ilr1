// jest version ^29.7.0
// nock version ^13.3.8
// axios-mock-adapter version ^1.22.0
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import nock from 'nock';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import {
  login,
  verifyMFA,
  refreshToken,
  logout,
  getCurrentUser,
  validateToken
} from '../../src/api/auth.api';
import { AuthService } from '../../src/services/auth.service';
import {
  AuthCredentials,
  MFARequest,
  MFAMethod,
  UserRole,
  AuthError
} from '../../src/types/auth.types';
import { authConfig, securityUtils } from '../../src/config/auth.config';

// Mock security headers
const mockSecurityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
};

// Mock successful login response
const mockLoginResponse = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: [UserRole.USER],
    mfaEnabled: true,
    lastLogin: new Date().toISOString(),
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        inApp: true
      }
    }
  },
  tokens: {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    idToken: 'mock-id-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  },
  requiresMFA: true,
  mfaChallengeId: 'mock-challenge-id',
  mfaMethods: [MFAMethod.TOTP]
};

// Mock MFA verification response
const mockMFAResponse = {
  ...mockLoginResponse,
  requiresMFA: false,
  mfaChallengeId: null
};

describe('Authentication Integration Tests', () => {
  let mockAxios: MockAdapter;
  let authService: AuthService;
  const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Configure nock for secure HTTP mocking
    nock.enableNetConnect();
    
    // Initialize axios mock with security headers
    mockAxios = new MockAdapter(axios);
    mockAxios.onAny().reply(config => {
      return [200, {}, mockSecurityHeaders];
    });

    // Initialize auth service
    authService = new AuthService();
  });

  afterAll(async () => {
    mockAxios.restore();
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Reset rate limiting counters
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('Login Flow', () => {
    it('should handle successful login with MFA requirement', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'Test123!@#',
        rememberMe: true
      };

      mockAxios.onPost(`${baseURL}/api/auth/login`).reply(200, mockLoginResponse, mockSecurityHeaders);

      const response = await login(credentials);

      expect(response.requiresMFA).toBe(true);
      expect(response.mfaChallengeId).toBeDefined();
      expect(response.mfaMethods).toContain(MFAMethod.TOTP);
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('should enforce rate limiting on failed login attempts', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'wrong-password',
        rememberMe: false
      };

      mockAxios.onPost(`${baseURL}/api/auth/login`).reply(429, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts'
      }, mockSecurityHeaders);

      await expect(login(credentials)).rejects.toThrow('Too many login attempts');
    });

    it('should validate security headers in login response', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'Test123!@#',
        rememberMe: true
      };

      mockAxios.onPost(`${baseURL}/api/auth/login`).reply(200, mockLoginResponse, mockSecurityHeaders);

      const response = await login(credentials);
      const headers = mockAxios.history.post[0].headers;

      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('MFA Verification', () => {
    it('should successfully verify MFA and complete login', async () => {
      const mfaRequest: MFARequest = {
        code: '123456',
        challengeId: 'mock-challenge-id',
        method: MFAMethod.TOTP
      };

      mockAxios.onPost(`${baseURL}/api/auth/mfa/verify`).reply(200, mockMFAResponse, mockSecurityHeaders);

      const response = await verifyMFA(mfaRequest);

      expect(response.requiresMFA).toBe(false);
      expect(localStorage.getItem('access_token')).toBe('mock-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
    });

    it('should handle invalid MFA code attempts', async () => {
      const mfaRequest: MFARequest = {
        code: 'invalid',
        challengeId: 'mock-challenge-id',
        method: MFAMethod.TOTP
      };

      mockAxios.onPost(`${baseURL}/api/auth/mfa/verify`).reply(400, {
        code: 'INVALID_MFA_CODE',
        message: 'Invalid MFA code'
      }, mockSecurityHeaders);

      await expect(verifyMFA(mfaRequest)).rejects.toThrow('Invalid MFA code');
    });
  });

  describe('Token Management', () => {
    it('should successfully refresh tokens', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      };

      mockAxios.onPost(`${baseURL}/api/auth/token/refresh`).reply(200, newTokens, mockSecurityHeaders);

      const response = await refreshToken('mock-refresh-token');

      expect(response.accessToken).toBe('new-access-token');
      expect(response.refreshToken).toBe('new-refresh-token');
    });

    it('should handle token refresh failures', async () => {
      mockAxios.onPost(`${baseURL}/api/auth/token/refresh`).reply(401, {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      }, mockSecurityHeaders);

      await expect(refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should successfully logout and clear session', async () => {
      mockAxios.onPost(`${baseURL}/api/auth/logout`).reply(200, {}, mockSecurityHeaders);

      await logout();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(sessionStorage.length).toBe(0);
    });

    it('should retrieve current user with valid session', async () => {
      localStorage.setItem('access_token', 'mock-access-token');

      mockAxios.onGet(`${baseURL}/api/auth/user`).reply(200, mockLoginResponse.user, mockSecurityHeaders);

      const user = await getCurrentUser();

      expect(user.id).toBe('test-user-id');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain(UserRole.USER);
    });
  });

  describe('Security Validations', () => {
    it('should validate token structure and expiration', () => {
      const mockValidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64') +
        '.signature';

      expect(securityUtils.validateToken(mockValidToken)).toBe(true);
      expect(securityUtils.validateToken('invalid-token')).toBe(false);
    });

    it('should handle and sanitize authentication errors', () => {
      const error: AuthError = {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        details: { sensitive: 'data' }
      };

      const sanitizedError = securityUtils.sanitizeError(error);
      expect(sanitizedError).not.toContain('sensitive');
      expect(JSON.parse(sanitizedError)).toHaveProperty('timestamp');
    });
  });
});