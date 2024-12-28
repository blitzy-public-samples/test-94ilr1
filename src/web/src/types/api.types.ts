// @ts-check
import { AxiosResponse } from 'axios'; // ^1.6.0 - Type definition for Axios HTTP responses

/**
 * Global configuration constants for API requests and pagination
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_TIMEOUT = 30000;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

/**
 * Sort order enum for API queries
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Enhanced API error type with detailed error information
 */
export interface ApiError {
  /** Unique error code for the specific error type */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details as key-value pairs */
  details: Record<string, unknown>;
  /** Optional stack trace for development environments */
  stack?: string;
  /** HTTP status code */
  statusCode: number;
}

/**
 * Generic API response wrapper type with enhanced error tracking
 * @template T The type of the response data
 */
export interface ApiResponse<T> {
  /** Indicates if the request was successful */
  success: boolean;
  /** Response data of type T if successful, null otherwise */
  data: T | null;
  /** Error information if request failed, null otherwise */
  error: ApiError | null;
  /** ISO timestamp of when the response was generated */
  timestamp: string;
  /** Unique identifier for request tracing */
  requestId: string;
}

/**
 * Enhanced pagination metadata with navigation helpers
 */
export interface PaginationMetadata {
  /** Current page number (1-based) */
  currentPage: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Indicates if there is a next page available */
  hasNextPage: boolean;
  /** Indicates if there is a previous page available */
  hasPreviousPage: boolean;
}

/**
 * Generic paginated response wrapper type with filter metadata
 * @template T The type of items in the response
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  items: readonly T[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
  /** Applied filters as key-value pairs */
  filters: Record<string, unknown>;
}

/**
 * Enhanced pagination parameters with filtering support
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Optional field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder: SortOrder;
  /** Optional filters as key-value pairs */
  filters: Record<string, unknown>;
}

/**
 * Retry configuration for failed requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Delay between retry attempts in milliseconds */
  delayMs: number;
  /** Optional function to determine if a request should be retried */
  shouldRetry?: (error: ApiError) => boolean;
}

/**
 * Cancellation token for request cancellation
 */
export interface CancelToken {
  /** Promise that resolves when the request is cancelled */
  promise: Promise<void>;
  /** Function to trigger request cancellation */
  cancel: () => void;
}

/**
 * Enhanced API request configuration with retry and cancellation support
 */
export interface ApiRequestConfig {
  /** Custom headers to include with the request */
  headers: Record<string, string>;
  /** URL parameters as key-value pairs */
  params: Record<string, unknown>;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether to include credentials with the request */
  withCredentials: boolean;
  /** Optional retry configuration */
  retryConfig?: RetryConfig;
  /** Optional cancellation token */
  cancelToken?: CancelToken;
}

/**
 * Type guard to check if a response is paginated
 * @template T The type of items in the response
 */
export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'pagination' in response &&
    'filters' in response
  );
}

/**
 * Type guard to check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  );
}

/**
 * Helper type for extracting data type from API response
 * @template T The type of the API response
 */
export type ExtractResponseData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Helper type for API response with axios
 * @template T The type of the response data
 */
export type AxiosApiResponse<T> = AxiosResponse<ApiResponse<T>>;