/**
 * API Utilities
 * Version: 1.0.0
 * 
 * Enterprise-grade utility functions for API request handling, error processing,
 * response transformation, and common API operations with enhanced support for
 * correlation tracking, request deduplication, and comprehensive error handling.
 */

import axios, { AxiosError, AxiosResponse } from 'axios'; // ^1.6.0
import qs from 'qs'; // ^6.11.0

import {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  ApiRequestConfig,
  isApiError
} from '../types/api.types';

import {
  API_VERSION,
  HTTP_STATUS,
  REQUEST_HEADERS,
  API_TIMEOUTS,
  API_ERRORS,
  CONTENT_TYPES
} from '../constants/api.constants';

// Global constants
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.';
const DEFAULT_CONTENT_TYPE = CONTENT_TYPES.JSON;
const REQUEST_DEDUP_TIMEOUT = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Options for query string building
 */
interface QueryStringOptions {
  arrayFormat?: 'brackets' | 'indices' | 'repeat' | 'comma';
  encodeValuesOnly?: boolean;
  skipNulls?: boolean;
  allowDots?: boolean;
}

/**
 * Generates a unique request key for deduplication
 * @param method HTTP method
 * @param url Request URL
 * @param params Query parameters
 * @param data Request body
 */
const generateRequestKey = (
  method: string,
  url: string,
  params?: Record<string, unknown>,
  data?: unknown
): string => {
  return JSON.stringify({
    method,
    url,
    params,
    data
  });
};

/**
 * Enhanced error formatter with correlation ID tracking and environment-specific details
 * @param error AxiosError instance
 * @param correlationId Request correlation ID
 * @returns Formatted API error object
 */
export const formatApiError = (error: AxiosError, correlationId?: string): ApiError => {
  const timestamp = new Date().toISOString();
  const requestUrl = error.config?.url || 'unknown';
  const statusCode = error.response?.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Extract error details from response
  const responseData = error.response?.data as any;
  const errorCode = responseData?.error?.code || 'UNKNOWN_ERROR';
  const errorMessage = responseData?.error?.message || DEFAULT_ERROR_MESSAGE;

  const apiError: ApiError = {
    code: errorCode,
    message: errorMessage,
    statusCode,
    details: {
      timestamp,
      url: requestUrl,
      correlationId,
      method: error.config?.method?.toUpperCase(),
      ...(responseData?.error?.details || {})
    }
  };

  // Include stack trace in development environment
  if (process.env.NODE_ENV === 'development') {
    apiError.stack = error.stack;
  }

  return apiError;
};

/**
 * Advanced query string builder with support for nested objects and arrays
 * @param params Query parameters object
 * @param options Query string formatting options
 * @returns Formatted query string
 */
export const buildQueryString = (
  params: Record<string, unknown>,
  options: QueryStringOptions = {}
): string => {
  const defaultOptions: QueryStringOptions = {
    arrayFormat: 'brackets',
    encodeValuesOnly: true,
    skipNulls: true,
    allowDots: true,
    ...options
  };

  // Remove undefined and null values if skipNulls is true
  const cleanParams = defaultOptions.skipNulls
    ? Object.entries(params).reduce((acc, [key, value]) => {
        if (value != null) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, unknown>)
    : params;

  return qs.stringify(cleanParams, defaultOptions);
};

/**
 * Creates an axios request with enhanced error handling and retry logic
 * @param config API request configuration
 * @returns Promise with API response
 */
export const createApiRequest = async <T>(
  config: ApiRequestConfig
): Promise<ApiResponse<T>> => {
  const requestKey = generateRequestKey(
    config.method || 'GET',
    config.url,
    config.params,
    config.data
  );

  // Check for pending duplicate request
  const pendingRequest = pendingRequests.get(requestKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Create new request promise
  const requestPromise = (async () => {
    let retryCount = 0;
    const correlationId = crypto.randomUUID();

    while (retryCount <= (config.retryConfig?.maxAttempts || MAX_RETRIES)) {
      try {
        const response = await axios({
          ...config,
          headers: {
            [REQUEST_HEADERS.CONTENT_TYPE]: DEFAULT_CONTENT_TYPE,
            [REQUEST_HEADERS.API_VERSION]: API_VERSION.v1,
            [REQUEST_HEADERS.CORRELATION_ID]: correlationId,
            ...config.headers
          },
          timeout: config.timeout || API_TIMEOUTS.DEFAULT,
          withCredentials: config.withCredentials ?? true
        });

        return {
          success: true,
          data: response.data,
          error: null,
          timestamp: new Date().toISOString(),
          requestId: correlationId
        } as ApiResponse<T>;
      } catch (error) {
        const apiError = formatApiError(error as AxiosError, correlationId);

        // Check if retry is allowed for this error
        const shouldRetry = config.retryConfig?.shouldRetry?.(apiError) ??
          [HTTP_STATUS.SERVICE_UNAVAILABLE, HTTP_STATUS.INTERNAL_SERVER_ERROR].includes(apiError.statusCode);

        if (retryCount === MAX_RETRIES || !shouldRetry) {
          return {
            success: false,
            data: null,
            error: apiError,
            timestamp: new Date().toISOString(),
            requestId: correlationId
          } as ApiResponse<T>;
        }

        // Exponential backoff delay
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      }
    }
  })();

  // Store promise in pending requests map
  pendingRequests.set(requestKey, requestPromise);

  // Remove from pending requests after completion or timeout
  setTimeout(() => {
    pendingRequests.delete(requestKey);
  }, REQUEST_DEDUP_TIMEOUT);

  return requestPromise;
};

/**
 * Transforms API response data based on response type
 * @param response API response object
 * @returns Transformed response data
 */
export const transformResponseData = <T>(response: ApiResponse<T>): T | null => {
  if (!response.success || !response.data) {
    return null;
  }

  // Handle paginated responses
  if (isPaginatedResponse(response.data)) {
    return {
      ...response.data,
      items: response.data.items.map(item => transformResponseData({ 
        success: true, 
        data: item, 
        error: null,
        timestamp: response.timestamp,
        requestId: response.requestId
      }))
    } as unknown as T;
  }

  return response.data;
};

/**
 * Type guard to check if response is paginated
 * @param data Response data
 * @returns Boolean indicating if response is paginated
 */
function isPaginatedResponse<T>(data: any): data is PaginatedResponse<T> {
  return (
    data &&
    Array.isArray(data.items) &&
    typeof data.pagination === 'object' &&
    typeof data.filters === 'object'
  );
}

export default {
  formatApiError,
  buildQueryString,
  createApiRequest,
  transformResponseData
};