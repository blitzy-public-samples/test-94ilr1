// jwt-decode version ^3.1.2
import jwtDecode from 'jwt-decode';
// js-cookie version ^3.0.5
import Cookies from 'js-cookie';
// crypto-js version ^4.1.1
import CryptoJS from 'crypto-js';

import { UserRole, User, TokenResponse } from '../types/auth.types';
import { authConfig } from '../config/auth.config';

/**
 * Interface for decoded JWT token payload
 */
interface DecodedToken {
  exp: number;
  iat: number;
  sub: string;
  [key: string]: any;
}

/**
 * Securely decodes and validates a JWT token with additional security checks
 * @param token - JWT token string to parse
 * @returns Decoded token payload or null if invalid
 */
export const parseToken = (token: string): DecodedToken | null => {
  try {
    // Validate token format
    if (!token || typeof token !== 'string' || !token.split('.').length === 3) {
      console.warn('Invalid token format detected');
      return null;
    }

    // Decode token with validation
    const decoded = jwtDecode<DecodedToken>(token);

    // Verify token claims
    const currentTime = Math.floor(Date.now() / 1000);
    if (!decoded.exp || !decoded.iat || decoded.exp <= currentTime) {
      console.warn('Token validation failed: Invalid claims or expired');
      return null;
    }

    // Verify token age
    const tokenAge = currentTime - decoded.iat;
    if (tokenAge < 0) {
      console.warn('Token validation failed: Invalid issue time');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token parsing failed:', error);
    return null;
  }
};

/**
 * Checks if a token is expired with configurable buffer time
 * @param token - Token response object to check
 * @returns True if token is expired or will expire within buffer
 */
export const isTokenExpired = (token: TokenResponse): boolean => {
  try {
    if (!token?.accessToken) {
      console.warn('Invalid token object');
      return true;
    }

    const decoded = parseToken(token.accessToken);
    if (!decoded) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    const expiryWithBuffer = decoded.exp - (authConfig.tokenExpiryBuffer / 1000);

    const isExpired = currentTime >= expiryWithBuffer;
    if (isExpired) {
      console.info('Token expired or approaching expiration');
    }

    return isExpired;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Validates user role with enhanced security checks
 * @param user - User object to validate
 * @param role - Role to check
 * @returns True if user has specified role
 */
export const hasRole = (user: User, role: UserRole): boolean => {
  try {
    // Validate user object integrity
    if (!user?.roles || !Array.isArray(user.roles)) {
      console.warn('Invalid user object or roles array');
      return false;
    }

    // Validate role parameter
    if (!Object.values(UserRole).includes(role)) {
      console.warn('Invalid role specified');
      return false;
    }

    // Check role hierarchy
    const roleHierarchy = [UserRole.GUEST, UserRole.USER, UserRole.MANAGER, UserRole.ADMIN];
    const userHighestRoleIndex = Math.max(...user.roles.map(r => roleHierarchy.indexOf(r)));
    const requiredRoleIndex = roleHierarchy.indexOf(role);

    const hasRequiredRole = userHighestRoleIndex >= requiredRoleIndex;
    console.info(`Role check result: ${hasRequiredRole}`);
    
    return hasRequiredRole;
  } catch (error) {
    console.error('Error validating user role:', error);
    return false;
  }
};

/**
 * Securely stores encrypted authentication tokens
 * @param tokens - Token response object to store
 */
export const storeAuthTokens = (tokens: TokenResponse): void => {
  try {
    // Validate token object
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('Invalid token object');
    }

    // Encrypt tokens
    const encryptedTokens = CryptoJS.AES.encrypt(
      JSON.stringify(tokens),
      authConfig.encryptionKey
    ).toString();

    // Store in secure cookie with strict options
    Cookies.set(authConfig.cookieName, encryptedTokens, {
      ...authConfig.cookieOptions,
      secure: true,
      sameSite: 'strict'
    });

    console.info('Auth tokens stored securely');
  } catch (error) {
    console.error('Failed to store auth tokens:', error);
    clearAuthTokens();
  }
};

/**
 * Securely removes all stored authentication tokens
 */
export const clearAuthTokens = (): void => {
  try {
    // Remove auth cookie
    Cookies.remove(authConfig.cookieName, {
      path: '/',
      secure: true,
      sameSite: 'strict'
    });

    // Clear any session storage
    sessionStorage.clear();
    
    console.info('Auth tokens cleared successfully');
  } catch (error) {
    console.error('Error clearing auth tokens:', error);
  }
};

/**
 * Securely retrieves and decrypts stored authentication tokens
 * @returns Decrypted tokens or null if invalid
 */
export const getStoredTokens = (): TokenResponse | null => {
  try {
    // Get encrypted cookie
    const encryptedTokens = Cookies.get(authConfig.cookieName);
    if (!encryptedTokens) {
      return null;
    }

    // Decrypt tokens
    const decryptedBytes = CryptoJS.AES.decrypt(
      encryptedTokens,
      authConfig.encryptionKey
    );
    const decryptedTokens = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

    // Validate decrypted token structure
    if (!decryptedTokens?.accessToken || !decryptedTokens?.refreshToken) {
      console.warn('Invalid token structure detected');
      clearAuthTokens();
      return null;
    }

    // Verify token validity
    if (isTokenExpired(decryptedTokens)) {
      console.info('Retrieved tokens are expired');
      clearAuthTokens();
      return null;
    }

    return decryptedTokens;
  } catch (error) {
    console.error('Error retrieving stored tokens:', error);
    clearAuthTokens();
    return null;
  }
};