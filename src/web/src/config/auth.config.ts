// @auth0/auth0-spa-js version ^2.1.0
import { Auth0ClientOptions } from '@auth0/auth0-spa-js';
import { AuthState, MFAMethod } from '../types/auth.types';

/**
 * Authentication token cookie name
 * Used for persistent authentication state
 */
export const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Token refresh interval in milliseconds (5 minutes)
 * Ensures tokens are refreshed before expiration
 */
export const TOKEN_REFRESH_INTERVAL = 300000;

/**
 * Buffer time before token expiry in milliseconds (1 minute)
 * Prevents token expiration during active sessions
 */
export const TOKEN_EXPIRY_BUFFER = 60000;

/**
 * Maximum number of token renewal attempts
 * Prevents infinite renewal loops
 */
export const MAX_TOKEN_RENEWAL_ATTEMPTS = 3;

/**
 * Enhanced security settings for Auth0 configuration
 */
const securitySettings = {
  allowedConnections: ['Username-Password-Authentication'],
  passwordPolicy: 'fair',
  brute_force_protection: true,
  enabledHostedPage: true,
  mfa: {
    enabled: true,
    preferredMethod: MFAMethod.TOTP,
    allowRememberBrowser: false,
    requireAllFactors: true
  },
  session: {
    absoluteDuration: 7200, // 2 hours
    idleTimeout: 1800 // 30 minutes
  }
};

/**
 * Auth0 configuration with enhanced security parameters
 */
export const auth0Config: Auth0ClientOptions = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  redirectUri: `${window.location.origin}/callback`,
  scope: 'openid profile email offline_access',
  useRefreshTokens: true,
  cacheLocation: 'localstorage',
  advancedOptions: {
    defaultScope: 'openid profile email',
    timeoutInSeconds: 60,
    allowSignUp: false,
  },
  httpTimeoutInSeconds: 30,
  leeway: 60, // Clock skew tolerance in seconds
  useCookiesForTransactions: true,
  useFormData: true // Enhanced security for token endpoint
};

/**
 * Enhanced authentication configuration
 * Includes security features and MFA settings
 */
export const authConfig = {
  tokenRefreshInterval: TOKEN_REFRESH_INTERVAL,
  tokenExpiryBuffer: TOKEN_EXPIRY_BUFFER,
  maxRenewalAttempts: MAX_TOKEN_RENEWAL_ATTEMPTS,
  cookieName: AUTH_COOKIE_NAME,
  mfaEnabled: true,
  securitySettings,
  sessionConfig: {
    rolling: true,
    absoluteTimeout: securitySettings.session.absoluteDuration,
    idleTimeout: securitySettings.session.idleTimeout,
    cookieConfig: {
      secure: true,
      sameSite: 'strict',
      httpOnly: true,
      path: '/',
      maxAge: securitySettings.session.absoluteDuration
    }
  },
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000,
    fallbackBehavior: 'logout'
  }
};

/**
 * Initial authentication state
 */
export const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
  mfaPending: false
};

/**
 * Validates the Auth0 configuration
 * Ensures all required parameters are present and valid
 */
const validateConfig = (config: Auth0ClientOptions): boolean => {
  const requiredFields = ['domain', 'clientId', 'audience'];
  return requiredFields.every(field => 
    config[field as keyof Auth0ClientOptions] && 
    typeof config[field as keyof Auth0ClientOptions] === 'string' &&
    (config[field as keyof Auth0ClientOptions] as string).length > 0
  );
};

/**
 * Creates and configures an Auth0 client instance with enhanced security
 * @returns Promise<Auth0Client> Configured Auth0 client instance
 * @throws Error if configuration validation fails
 */
export const createAuth0Client = async () => {
  if (!validateConfig(auth0Config)) {
    throw new Error('Invalid Auth0 configuration. Please check required parameters.');
  }

  try {
    const { createAuth0Client } = await import('@auth0/auth0-spa-js');
    const client = await createAuth0Client({
      ...auth0Config,
      onRedirectCallback: (appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo || window.location.pathname
        );
      }
    });

    return client;
  } catch (error) {
    console.error('Failed to initialize Auth0 client:', error);
    throw error;
  }
};

/**
 * Security utility functions
 */
export const securityUtils = {
  /**
   * Sanitizes authentication errors for safe logging
   */
  sanitizeError: (error: any): string => {
    const safeError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An authentication error occurred',
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(safeError);
  },

  /**
   * Validates token structure and expiration
   */
  validateToken: (token: string): boolean => {
    try {
      const [header, payload] = token.split('.').slice(0, 2);
      if (!header || !payload) return false;
      
      const decodedPayload = JSON.parse(atob(payload));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return decodedPayload.exp > currentTime;
    } catch {
      return false;
    }
  }
};