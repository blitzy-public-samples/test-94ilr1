// @auth0/auth0-spa-js version ^2.1.0
// react version ^18.2.0
// react-redux version ^8.1.0
import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  AuthState,
  AuthCredentials,
  AuthResponse,
  User,
  MFARequest,
  SecurityContext,
  TokenValidation
} from '../types/auth.types';
import {
  login,
  verifyMFA,
  logout,
  validateSession,
  selectAuthState,
  selectUser,
  selectSecurityStatus,
  addSecurityEvent
} from '../store/auth.slice';
import { AuthService } from '../services/auth.service';
import { authConfig, securityUtils } from '../config/auth.config';

/**
 * Enhanced React hook for managing secure authentication state and operations
 * Implements comprehensive security features including OAuth 2.0, JWT validation,
 * MFA handling, session management, and security monitoring
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector(selectAuthState);
  const user = useSelector(selectUser);
  const securityStatus = useSelector(selectSecurityStatus);

  // Refs for tracking security-related state
  const sessionCheckInterval = useRef<NodeJS.Timeout>();
  const lastActivityTime = useRef<number>(Date.now());
  const authAttempts = useRef<number>(0);

  /**
   * Handles secure user login with enhanced validation and rate limiting
   * @param credentials - User authentication credentials
   * @returns Promise with authentication response
   */
  const handleLogin = useCallback(async (credentials: AuthCredentials): Promise<AuthResponse> => {
    try {
      // Rate limiting check
      if (authAttempts.current >= authConfig.errorHandling.maxRetries) {
        throw new Error('Maximum authentication attempts exceeded. Please try again later.');
      }

      // Input validation
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid credentials format');
      }

      authAttempts.current++;

      // Dispatch login action with security context
      const response = await dispatch(login(credentials)).unwrap();

      // Reset auth attempts on success
      authAttempts.current = 0;

      // Log successful authentication
      dispatch(addSecurityEvent({
        type: 'AUTH_SUCCESS',
        details: {
          email: credentials.email,
          timestamp: new Date().toISOString()
        }
      }));

      return response;
    } catch (error) {
      // Log failed attempt
      dispatch(addSecurityEvent({
        type: 'AUTH_FAILURE',
        details: {
          email: credentials.email,
          attempt: authAttempts.current,
          error: securityUtils.sanitizeError(error),
          timestamp: new Date().toISOString()
        }
      }));
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles MFA verification with enhanced security validation
   * @param mfaRequest - MFA verification request data
   * @returns Promise with authentication response
   */
  const handleMFAVerification = useCallback(async (mfaRequest: MFARequest): Promise<AuthResponse> => {
    try {
      // Validate MFA request format
      if (!mfaRequest.code || !mfaRequest.challengeId) {
        throw new Error('Invalid MFA request format');
      }

      const response = await dispatch(verifyMFA(mfaRequest)).unwrap();

      // Log successful MFA verification
      dispatch(addSecurityEvent({
        type: 'MFA_SUCCESS',
        details: {
          method: mfaRequest.method,
          timestamp: new Date().toISOString()
        }
      }));

      return response;
    } catch (error) {
      // Log failed MFA attempt
      dispatch(addSecurityEvent({
        type: 'MFA_FAILURE',
        details: {
          method: mfaRequest.method,
          error: securityUtils.sanitizeError(error),
          timestamp: new Date().toISOString()
        }
      }));
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles secure user logout with session cleanup
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await dispatch(logout()).unwrap();
      
      // Clean up security monitoring
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }

      // Log successful logout
      dispatch(addSecurityEvent({
        type: 'LOGOUT_SUCCESS',
        details: {
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Logout error:', securityUtils.sanitizeError(error));
    }
  }, [dispatch]);

  /**
   * Validates current session state and security context
   * @returns boolean indicating session validity
   */
  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await dispatch(validateSession()).unwrap();
      
      if (!isValid) {
        dispatch(addSecurityEvent({
          type: 'SESSION_INVALID',
          details: {
            timestamp: new Date().toISOString()
          }
        }));
      }

      return isValid;
    } catch (error) {
      console.error('Session validation error:', securityUtils.sanitizeError(error));
      return false;
    }
  }, [dispatch]);

  /**
   * Sets up security monitoring and session validation
   */
  useEffect(() => {
    if (securityStatus.isAuthenticated && user) {
      // Set up periodic session validation
      sessionCheckInterval.current = setInterval(async () => {
        const currentTime = Date.now();
        const idleTime = currentTime - lastActivityTime.current;

        // Check for session timeout
        if (idleTime > authConfig.sessionConfig.idleTimeout * 1000) {
          await handleLogout();
          return;
        }

        // Validate session
        await validateCurrentSession();
      }, authConfig.sessionConfig.absoluteTimeout * 1000);

      // Set up activity monitoring
      const updateActivity = () => {
        lastActivityTime.current = Date.now();
      };

      window.addEventListener('mousemove', updateActivity);
      window.addEventListener('keypress', updateActivity);

      return () => {
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
        }
        window.removeEventListener('mousemove', updateActivity);
        window.removeEventListener('keypress', updateActivity);
      };
    }
  }, [securityStatus.isAuthenticated, user, handleLogout, validateCurrentSession]);

  return {
    isAuthenticated: securityStatus.isAuthenticated,
    user,
    loading: authState.loading,
    error: authState.error,
    mfaPending: authState.mfaPending,
    securityContext: {
      sessionValid: securityStatus.sessionValid,
      lastValidated: securityStatus.lastValidated
    },
    login: handleLogin,
    verifyMFA: handleMFAVerification,
    logout: handleLogout,
    validateSession: validateCurrentSession
  };
};

export default useAuth;