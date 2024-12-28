/**
 * API Configuration Module
 * Version: 1.0.0
 * 
 * Provides centralized configuration for API client settings with enhanced features:
 * - Request/Response interceptors
 * - Security headers and CSRF protection
 * - Circuit breaker pattern
 * - Retry mechanism
 * - Correlation tracking
 * - Comprehensive error handling
 * - Request/Response logging
 */

import axios, { AxiosInstance, AxiosError } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^7.1.0

import { 
  ApiResponse, 
  ApiRequestConfig, 
  ApiError, 
  RetryConfig 
} from '../types/api.types';

import { 
  API_ENDPOINTS, 
  API_BASE_URL, 
  API_VERSION,
  REQUEST_HEADERS,
  CONTENT_TYPES,
  API_TIMEOUTS,
  SECURITY_CONFIG
} from '../constants/api.constants';

// Global configuration constants
const DEFAULT_TIMEOUT = API_TIMEOUTS.DEFAULT;
const MAX_RETRIES = SECURITY_CONFIG.MAX_RETRY_ATTEMPTS;
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

/**
 * Default API configuration with enhanced security and monitoring features
 */
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    [REQUEST_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [REQUEST_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
    [REQUEST_HEADERS.API_VERSION]: API_VERSION.v1
  },
  retryConfig: {
    maxAttempts: MAX_RETRIES,
    delayMs: 1000,
    shouldRetry: (error: ApiError) => error.statusCode >= 500
  },
  circuitBreakerOptions: CIRCUIT_BREAKER_OPTIONS
};

/**
 * Configures request interceptor with enhanced security and monitoring
 * @param apiClient Axios instance to configure
 * @returns Interceptor ID
 */
const configureRequestInterceptor = (apiClient: AxiosInstance): number => {
  return apiClient.interceptors.request.use(
    (config) => {
      // Add authorization if token exists
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers[REQUEST_HEADERS.AUTHORIZATION] = `${SECURITY_CONFIG.JWT_PREFIX} ${token}`;
      }

      // Add CSRF token for non-GET requests
      if (config.method !== 'get') {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrfToken) {
          config.headers[REQUEST_HEADERS.CSRF_TOKEN] = csrfToken;
        }
      }

      // Add correlation ID for request tracking
      config.headers[REQUEST_HEADERS.CORRELATION_ID] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add tenant ID if available
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) {
        config.headers[REQUEST_HEADERS.TENANT_ID] = tenantId;
      }

      // Log request in development
      if (process.env.NODE_ENV === 'development') {
        console.log('API Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers,
          data: config.data
        });
      }

      return config;
    },
    (error) => Promise.reject(error)
  );
};

/**
 * Configures response interceptor with error handling and monitoring
 * @param apiClient Axios instance to configure
 * @returns Interceptor ID
 */
const configureResponseInterceptor = (apiClient: AxiosInstance): number => {
  return apiClient.interceptors.response.use(
    (response) => {
      // Store correlation ID for tracking
      const correlationId = response.headers[REQUEST_HEADERS.CORRELATION_ID];
      if (correlationId) {
        response.data.correlationId = correlationId;
      }

      // Log response in development
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
      }

      return response;
    },
    (error: AxiosError) => {
      const apiError: ApiError = {
        code: 'API_ERROR',
        message: error.message,
        statusCode: error.response?.status || 500,
        details: error.response?.data || {},
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };

      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('API Error:', apiError);
      }

      return Promise.reject(apiError);
    }
  );
};

/**
 * Creates and configures an Axios instance with enhanced features
 * @param options Optional configuration overrides
 * @returns Configured Axios instance
 */
export const createApiClient = (options?: Partial<ApiRequestConfig>): AxiosInstance => {
  // Create base axios instance
  const apiClient = axios.create({
    ...apiConfig,
    ...options
  });

  // Configure retry mechanism
  axiosRetry(apiClient, {
    retries: apiConfig.retryConfig.maxAttempts,
    retryDelay: (retryCount) => {
      return retryCount * apiConfig.retryConfig.delayMs;
    },
    retryCondition: (error) => {
      return apiConfig.retryConfig.shouldRetry?.(error as ApiError) ?? false;
    }
  });

  // Configure circuit breaker
  const breaker = new CircuitBreaker(apiClient, apiConfig.circuitBreakerOptions);
  
  // Handle circuit breaker events
  breaker.on('open', () => {
    console.warn('Circuit breaker opened - API requests will be rejected');
  });
  
  breaker.on('halfOpen', () => {
    console.info('Circuit breaker half-open - testing API availability');
  });
  
  breaker.on('close', () => {
    console.info('Circuit breaker closed - API requests resumed');
  });

  // Configure interceptors
  configureRequestInterceptor(apiClient);
  configureResponseInterceptor(apiClient);

  return apiClient;
};

/**
 * Default pre-configured API client instance
 */
export const apiClient = createApiClient();

/**
 * Export endpoints for type-safe access
 */
export { API_ENDPOINTS };