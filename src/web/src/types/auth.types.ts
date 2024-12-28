// @auth0/auth0-spa-js version ^2.1.0
import { Auth0User } from '@auth0/auth0-spa-js';

/**
 * Enumeration of user roles for role-based access control
 * Implements hierarchical access model from highest to lowest privilege
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  GUEST = 'GUEST'
}

/**
 * Enumeration of supported MFA methods
 */
export enum MFAMethod {
  TOTP = 'TOTP',  // Time-based One-Time Password
  SMS = 'SMS',    // SMS-based verification
  EMAIL = 'EMAIL' // Email-based verification
}

/**
 * Interface for notification preferences within user settings
 */
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

/**
 * Interface for user preference settings
 */
export interface UserPreferences {
  theme: string;
  language: string;
  notifications: NotificationPreferences;
}

/**
 * Extended user interface building upon Auth0User
 * Includes additional fields for role-based access and MFA support
 */
export interface User extends Auth0User {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  preferences: UserPreferences;
  mfaEnabled: boolean;
  lastLogin: Date;
}

/**
 * Interface for authentication state management
 * Used for global auth state tracking
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  mfaPending: boolean;
}

/**
 * Structured authentication error information
 */
export interface AuthError {
  code: string;
  message: string;
  details: Record<string, any>;
}

/**
 * Login credentials structure with optional remember me flag
 */
export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * JWT token response structure
 * Includes all necessary tokens for authentication flow
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * MFA verification request structure
 */
export interface MFARequest {
  code: string;
  challengeId: string;
  method: MFAMethod;
}

/**
 * Complete authentication response including MFA support
 */
export interface AuthResponse {
  user: User;
  tokens: TokenResponse;
  requiresMFA: boolean;
  mfaChallengeId: string | null;
  mfaMethods: MFAMethod[];
}

// Type guard for checking user roles
export const hasRole = (user: User, role: UserRole): boolean => {
  return user.roles.includes(role);
};

// Type guard for checking if user has sufficient privileges
export const hasMinimumRole = (user: User, minimumRole: UserRole): boolean => {
  const roleHierarchy = [UserRole.GUEST, UserRole.USER, UserRole.MANAGER, UserRole.ADMIN];
  const userHighestRoleIndex = Math.max(...user.roles.map(role => roleHierarchy.indexOf(role)));
  const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);
  return userHighestRoleIndex >= minimumRoleIndex;
};