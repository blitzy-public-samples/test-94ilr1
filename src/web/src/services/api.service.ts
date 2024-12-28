// External dependencies
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^7.1.0

// Internal imports
import { ApiResponse, ApiRequestConfig, ApiError, RetryConfig } from '../types/api.types';
import { getStoredTokens } from '../utils/auth.utils';
import { apiConfig } from '../config/api.config';
import {
  API_ENDPOINTS,
  HTTP_STATUS,
  REQUEST_HEADERS,
  API_TIMEOUTS,
  SECURITY_CONFIG,
  API_ERRORS
} from '../constants/api.constants';

/**
 * Enhanced API Service with retry mechanism, circuit breaker, and monitoring
 */
export class ApiService {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;
  private readonly config: ApiRequestConfig;

  constructor(config?: Partial<ApiRequestConfig>) {
    this.config = {
      ...apiConfig,
      ...config,
      headers: {
        ...apiConfig.headers,
        ...config?.headers
      }
    };
    this.client = this.createAxiosInstance();
    this.breaker = this.createCircuitBreaker();
    this.setupInterceptors();
  }

  /**
   * Creates and configures Axios instance with enhanced features
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create(this.config);

    // Configure retry mechanism
    axiosRetry(instance, {
      retries: SECURITY_CONFIG.MAX_RETRY_ATTEMPTS,
      retryDelay: (retryCount) => {
        return Math.min(1000 * Math.pow(2, retryCount), 10000);
      },
      retryCondition: (error: AxiosError) => {
        const status = error.response?.status;
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (status ? status >= 500 : false);
      }
    });

    return instance;
  }

  /**
   * Creates circuit breaker with configurable thresholds
   */
  private createCircuitBreaker(): CircuitBreaker {
    const breaker = new CircuitBreaker(this.client, {
      timeout: API_TIMEOUTS.DEFAULT,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    breaker.on('open', () => {
      console.warn('Circuit breaker opened - API requests will be rejected');
    });

    breaker.on('halfOpen', () => {
      console.info('Circuit breaker half-open - testing API availability');
    });

    breaker.on('close', () => {
      console.info('Circuit breaker closed - API requests resumed');
    });

    return breaker;
  }

  /**
   * Configures request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add authentication token
        const tokens = await getStoredTokens();
        if (tokens?.accessToken) {
          config.headers[REQUEST_HEADERS.AUTHORIZATION] = 
            `${SECURITY_CONFIG.JWT_PREFIX} ${tokens.accessToken}`;
        }

        // Add CSRF token for non-GET requests
        if (config.method !== 'get') {
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
          if (csrfToken) {
            config.headers[REQUEST_HEADERS.CSRF_TOKEN] = csrfToken;
          }
        }

        // Add correlation ID for request tracking
        config.headers[REQUEST_HEADERS.CORRELATION_ID] = 
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return config;
      },
      (error) => Promise.reject(this.handleApiError(error))
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
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
      (error) => Promise.reject(this.handleApiError(error))
    );
  }

  /**
   * Enhanced error handling with detailed error information
   */
  private handleApiError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      code: 'API_ERROR',
      message: error.message || API_ERRORS.NETWORK_ERROR,
      statusCode: error.response?.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
      details: error.response?.data || {},
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', apiError);
    }

    return apiError;
  }

  /**
   * Generic request method with enhanced error handling and typing
   */
  private async request<T>(
    method: string,
    url: string,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.breaker.fire({
        method,
        url,
        ...config
      });

      return {
        success: true,
        data: response.data,
        error: null,
        timestamp: new Date().toISOString(),
        requestId: response.headers[REQUEST_HEADERS.CORRELATION_ID]
      };
    } catch (error) {
      const apiError = this.handleApiError(error as AxiosError);
      return {
        success: false,
        data: null,
        error: apiError,
        timestamp: new Date().toISOString(),
        requestId: null
      };
    }
  }

  /**
   * Enhanced GET request with type safety
   */
  public async get<T>(
    url: string,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, config);
  }

  /**
   * Enhanced POST request with type safety
   */
  public async post<T>(
    url: string,
    data?: any,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, { ...config, data });
  }

  /**
   * Enhanced PUT request with type safety
   */
  public async put<T>(
    url: string,
    data?: any,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, { ...config, data });
  }

  /**
   * Enhanced DELETE request with type safety
   */
  public async delete<T>(
    url: string,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, config);
  }

  /**
   * Enhanced PATCH request with type safety
   */
  public async patch<T>(
    url: string,
    data?: any,
    config?: Partial<AxiosRequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, { ...config, data });
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export endpoints for type-safe access
export { API_ENDPOINTS };