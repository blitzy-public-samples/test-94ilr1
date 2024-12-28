/**
 * API Constants
 * Version: 1.0.0
 * 
 * Core API-related constants for frontend application including:
 * - API endpoints
 * - HTTP methods
 * - Status codes
 * - Headers
 * - Timeouts
 * - Security configurations
 */

// Base API URL from environment or default to localhost
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// API Version for backward compatibility
export const API_VERSION = {
  v1: 'v1'
} as const;

// Comprehensive API endpoints with type safety
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
    MFA: '/auth/mfa'
  },
  EMAIL: {
    LIST: '/emails',
    DETAIL: '/emails/:id',
    SEND: '/emails/send',
    DRAFT: '/emails/draft',
    ATTACHMENTS: '/emails/attachments',
    SEARCH: '/emails/search'
  },
  CONTEXT: {
    ANALYZE: '/context/analyze',
    HISTORY: '/context/history',
    RELATIONSHIPS: '/context/relationships',
    PROJECTS: '/context/projects',
    INSIGHTS: '/context/insights'
  },
  RESPONSE: {
    GENERATE: '/response/generate',
    TEMPLATES: '/response/templates',
    REVIEW: '/response/review',
    APPROVE: '/response/approve',
    REJECT: '/response/reject'
  },
  PROJECTS: {
    LIST: '/projects',
    DETAIL: '/projects/:id',
    CREATE: '/projects',
    UPDATE: '/projects/:id',
    DELETE: '/projects/:id',
    MEMBERS: '/projects/:id/members'
  },
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    REPORTS: '/analytics/reports',
    METRICS: '/analytics/metrics',
    EXPORT: '/analytics/export'
  }
} as const;

// HTTP Methods enum for type safety
export enum HTTP_METHODS {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS'
}

// Comprehensive HTTP Status codes
export enum HTTP_STATUS {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

// Enhanced security and tracking headers
export const REQUEST_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  API_VERSION: 'X-API-Version',
  ACCEPT: 'Accept',
  CORRELATION_ID: 'X-Correlation-ID',
  TENANT_ID: 'X-Tenant-ID',
  CSRF_TOKEN: 'X-CSRF-Token'
} as const;

// Common content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain'
} as const;

// Operation-specific timeout configurations (in milliseconds)
export const API_TIMEOUTS = {
  DEFAULT: 30000,    // 30 seconds
  LONG: 60000,       // 60 seconds
  SHORT: 10000,      // 10 seconds
  UPLOAD: 300000,    // 5 minutes
  ANALYTICS: 45000   // 45 seconds
} as const;

// Security configurations
export const SECURITY_CONFIG = {
  JWT_PREFIX: 'Bearer',
  TOKEN_REFRESH_THRESHOLD: 300, // 5 minutes in seconds
  MAX_RETRY_ATTEMPTS: 3,
  RATE_LIMIT_WINDOW: 60000, // 1 minute in milliseconds
  MAX_REQUESTS_PER_WINDOW: 100
} as const;

// Error message constants
export const API_ERRORS = {
  NETWORK_ERROR: 'Network error occurred',
  TIMEOUT: 'Request timed out',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
} as const;

// Type definitions for better type safety
export type ApiVersion = typeof API_VERSION[keyof typeof API_VERSION];
export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];
export type RequestHeader = typeof REQUEST_HEADERS[keyof typeof REQUEST_HEADERS];
export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];
export type ApiTimeout = typeof API_TIMEOUTS[keyof typeof API_TIMEOUTS];
export type SecurityConfig = typeof SECURITY_CONFIG[keyof typeof SECURITY_CONFIG];
export type ApiError = typeof API_ERRORS[keyof typeof API_ERRORS];

// Utility type for API response
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: number;
  };
}