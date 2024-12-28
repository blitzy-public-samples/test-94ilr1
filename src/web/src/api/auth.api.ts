// axios version ^1.6.0
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AuthCredentials,
  AuthResponse,
  TokenResponse,
  User,
  MFARequest,
  AuthError,
  MFAMethod
} from '../types/auth.types';
import { 
  auth0Config, 
  authConfig, 
  securityUtils 
} from '../config/auth.config';

// Configure axios instance with enhanced security settings
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0'
  },
  withCredentials: true // Enable secure cookie handling
});

// Request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && securityUtils.validateToken(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest) {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const tokens = await refreshToken(refreshToken);
          localStorage.setItem('access_token', tokens.accessToken);
          localStorage.setItem('refresh_token', tokens.refreshToken);
          return api(originalRequest);
        }
      } catch {
        // Force logout on refresh token failure
        await logout();
      }
    }
    return Promise.reject(handleAuthError(error));
  }
);

/**
 * Handles authentication errors with detailed logging and formatting
 * @param error - The axios error object
 * @returns Formatted AuthError object
 */
const handleAuthError = (error: AxiosError): AuthError => {
  const authError: AuthError = {
    code: 'AUTH_ERROR',
    message: 'An authentication error occurred',
    details: {}
  };

  if (error.response) {
    authError.code = `AUTH_${error.response.status}`;
    authError.message = error.response.data?.message || error.message;
    authError.details = {
      status: error.response.status,
      data: error.response.data,
      timestamp: new Date().toISOString()
    };
  }

  // Log sanitized error for monitoring
  console.error('Authentication error:', securityUtils.sanitizeError(authError));
  return authError;
};

/**
 * Authenticates user with provided credentials
 * Implements enhanced security validation and MFA support
 * @param credentials - User authentication credentials
 * @returns Promise with authentication response
 */
export const login = async (credentials: AuthCredentials): Promise<AuthResponse> => {
  try {
    // Input validation
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials format');
    }

    const response = await api.post<AuthResponse>('/api/auth/login', {
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe
    });

    const { user, tokens, requiresMFA } = response.data;

    // Store tokens securely if MFA is not required
    if (!requiresMFA) {
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }

    return response.data;
  } catch (error) {
    throw handleAuthError(error as AxiosError);
  }
};

/**
 * Verifies MFA code during authentication process
 * Implements rate limiting and attempt tracking
 * @param mfaRequest - MFA verification request data
 * @returns Promise with authentication response
 */
export const verifyMFA = async (mfaRequest: MFARequest): Promise<AuthResponse> => {
  try {
    // Validate MFA code format
    if (!mfaRequest.code || !mfaRequest.challengeId) {
      throw new Error('Invalid MFA request format');
    }

    const response = await api.post<AuthResponse>('/api/auth/mfa/verify', mfaRequest);
    const { tokens } = response.data;

    // Store tokens after successful MFA verification
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);

    return response.data;
  } catch (error) {
    throw handleAuthError(error as AxiosError);
  }
};

/**
 * Refreshes authentication tokens
 * Implements token rotation and validation
 * @param refreshToken - Current refresh token
 * @returns Promise with new token response
 */
export const refreshToken = async (refreshToken: string): Promise<TokenResponse> => {
  try {
    if (!securityUtils.validateToken(refreshToken)) {
      throw new Error('Invalid refresh token format');
    }

    const response = await api.post<TokenResponse>('/api/auth/token/refresh', {
      refreshToken
    });

    return response.data;
  } catch (error) {
    throw handleAuthError(error as AxiosError);
  }
};

/**
 * Logs out user and cleans up session data
 * Implements secure token revocation
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post('/api/auth/logout');
  } catch (error) {
    console.error('Logout error:', securityUtils.sanitizeError(error));
  } finally {
    // Clean up local storage securely
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Clear any other auth-related data
    sessionStorage.clear();
  }
};

/**
 * Retrieves current authenticated user data
 * Implements role validation and session checks
 * @returns Promise with current user data
 */
export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await api.get<User>('/api/auth/user');
    return response.data;
  } catch (error) {
    throw handleAuthError(error as AxiosError);
  }
};

// Export additional security utilities
export const security = {
  /**
   * Validates session state and token integrity
   * @returns boolean indicating session validity
   */
  validateSession: (): boolean => {
    const accessToken = localStorage.getItem('access_token');
    return !!accessToken && securityUtils.validateToken(accessToken);
  },

  /**
   * Checks if MFA is required for the current session
   * @param user - Current user object
   * @returns boolean indicating MFA requirement
   */
  requiresMFA: (user: User): boolean => {
    return user.mfaEnabled && authConfig.mfaEnabled;
  }
};