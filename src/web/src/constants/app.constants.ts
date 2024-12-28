/**
 * @fileoverview Core application constants for the AI-powered Email Management Platform.
 * These constants define configuration values, feature flags, and system-wide settings
 * with comprehensive type safety and runtime immutability.
 * @version 1.0.0
 */

import { ApiResponse } from '../types/api.types';

/**
 * Core application configuration with runtime immutability
 */
export const APP_CONFIG = Object.freeze({
  /** Application name as defined in technical specifications */
  APP_NAME: 'AI Email Assistant' as const,
  
  /** Current application version following semantic versioning */
  APP_VERSION: '1.0.0' as const,
  
  /** API version for backend communication */
  API_VERSION: 'v1' as const,
  
  /** Current environment with fallback to development */
  ENVIRONMENT: process.env.NODE_ENV || 'development' as const,
  
  /** Feature flags for conditional functionality */
  FEATURES: Object.freeze({
    CONTEXT_ANALYSIS: true,
    AUTO_RESPONSE: true,
    MULTI_LANGUAGE: true,
    DARK_MODE: true,
  }),
  
  /** System-wide timeouts (in milliseconds) */
  TIMEOUTS: Object.freeze({
    SESSION: 3600000, // 1 hour
    IDLE: 1800000,    // 30 minutes
    TOKEN: 900000,    // 15 minutes
  }),
}) as const;

/**
 * UI configuration constants based on Material Design 3.0 specifications
 */
export const UI_CONFIG = Object.freeze({
  /** Animation duration in milliseconds */
  ANIMATION_DURATION: 300 as const,
  
  /** Drawer width in pixels - based on Material Design guidelines */
  DRAWER_WIDTH: 240 as const,
  
  /** Context panel width in pixels */
  CONTEXT_PANEL_WIDTH: 320 as const,
  
  /** Responsive breakpoints in pixels */
  BREAKPOINTS: Object.freeze({
    xs: 320,  // Mobile breakpoint
    sm: 768,  // Tablet breakpoint
    md: 1024, // Small desktop breakpoint
    lg: 1440, // Large desktop breakpoint
  }),
  
  /** Theme mode options */
  THEME_MODE: Object.freeze({
    LIGHT: 'light' as const,
    DARK: 'dark' as const,
    SYSTEM: 'system' as const,
  }),
  
  /** Accessibility settings */
  A11Y: Object.freeze({
    MIN_CONTRAST_RATIO: 4.5,
    FOCUS_VISIBLE: true,
    REDUCED_MOTION: false,
    SCREEN_READER_SUPPORT: true,
  }),
  
  /** Layout constants */
  LAYOUT: Object.freeze({
    HEADER_HEIGHT: 64,
    FOOTER_HEIGHT: 48,
    SPACING_UNIT: 8,
    GRID_COLUMNS: 12,
  }),
}) as const;

/**
 * Email-specific configuration constants
 */
export const EMAIL_CONFIG = Object.freeze({
  /** Maximum attachment size in bytes (10MB) */
  MAX_ATTACHMENT_SIZE: 10485760 as const,
  
  /** Supported file types for attachments */
  SUPPORTED_FILE_TYPES: Object.freeze([
    '.pdf', '.doc', '.docx', 
    '.xls', '.xlsx', '.txt',
    '.jpg', '.jpeg', '.png',
  ]),
  
  /** Email refresh interval in milliseconds (30 seconds) */
  REFRESH_INTERVAL: 30000 as const,
  
  /** Maximum retry attempts for failed operations */
  MAX_RETRY_ATTEMPTS: 3 as const,
  
  /** Request timeout in milliseconds (30 seconds) */
  REQUEST_TIMEOUT: 30000 as const,
  
  /** Email processing settings */
  PROCESSING: Object.freeze({
    BATCH_SIZE: 50,
    CONTEXT_THRESHOLD: 0.85,
    RESPONSE_DELAY: 5000, // 5 seconds
    MAX_THREAD_DEPTH: 50,
  }),
  
  /** Rate limiting settings */
  RATE_LIMITS: Object.freeze({
    MAX_EMAILS_PER_MINUTE: 60,
    MAX_ATTACHMENTS_PER_EMAIL: 10,
    MAX_RECIPIENTS: 50,
  }),
}) as const;

/**
 * Error message constants
 */
export const ERROR_MESSAGES = Object.freeze({
  ATTACHMENT_SIZE: 'Attachment size exceeds maximum limit',
  UNSUPPORTED_FILE: 'File type not supported',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later',
  NETWORK_ERROR: 'Network error occurred. Please check your connection',
  AUTH_ERROR: 'Authentication error. Please log in again',
}) as const;

/**
 * Type definitions for runtime type checking
 */
export type AppConfig = typeof APP_CONFIG;
export type UiConfig = typeof UI_CONFIG;
export type EmailConfig = typeof EMAIL_CONFIG;
export type ErrorMessages = typeof ERROR_MESSAGES;

/**
 * Validation helper for configuration objects
 */
export const validateConfig = <T extends Record<string, unknown>>(
  config: T,
  requiredKeys: Array<keyof T>
): boolean => {
  return requiredKeys.every(key => key in config);
};

// Export configuration validation results
export const CONFIG_VALIDATION = Object.freeze({
  isAppConfigValid: validateConfig(APP_CONFIG, ['APP_NAME', 'APP_VERSION', 'API_VERSION']),
  isUiConfigValid: validateConfig(UI_CONFIG, ['BREAKPOINTS', 'THEME_MODE']),
  isEmailConfigValid: validateConfig(EMAIL_CONFIG, ['MAX_ATTACHMENT_SIZE', 'SUPPORTED_FILE_TYPES']),
}) as const;