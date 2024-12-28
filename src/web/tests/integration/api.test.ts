// External dependencies
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // ^29.7.0
import nock from 'nock'; // ^13.3.8
import axios from 'axios'; // ^1.6.0
import MockAdapter from 'axios-mock-adapter'; // ^1.22.0

// Internal imports
import { ApiService } from '../../src/services/api.service';
import { ApiResponse } from '../../src/types/api.types';
import { apiConfig } from '../../src/config/api.config';
import { API_ENDPOINTS, HTTP_STATUS, REQUEST_HEADERS, API_ERRORS } from '../../src/constants/api.constants';

// Test configuration
const TEST_API_URL = 'http://localhost:3000/api';
const TEST_TIMEOUT = 5000;
const MOCK_AUTH_TOKEN = 'test-auth-token';
const CORRELATION_ID_HEADER = 'x-correlation-id';

// Mock data
interface TestEmailData {
  id: string;
  subject: string;
  content: string;
}

interface TestContextData {
  emailId: string;
  analysis: Record<string, any>;
}

// Test setup and utilities
let apiService: ApiService;
let mockAxios: MockAdapter;
let correlationIds: string[] = [];

/**
 * Initializes test environment and configures mocks
 */
beforeAll(() => {
  // Configure nock for HTTP mocking
  nock.disableNetConnect();
  nock.enableNetConnect('localhost');

  // Initialize API service with test configuration
  apiService = new ApiService({
    baseURL: TEST_API_URL,
    timeout: TEST_TIMEOUT
  });

  // Setup axios mock adapter
  mockAxios = new MockAdapter(axios);

  // Configure correlation ID tracking
  axios.interceptors.response.use(response => {
    const correlationId = response.headers[CORRELATION_ID_HEADER];
    if (correlationId) {
      correlationIds.push(correlationId);
    }
    return response;
  });
});

/**
 * Cleanup after all tests
 */
afterAll(() => {
  nock.cleanAll();
  nock.enableNetConnect();
  mockAxios.restore();
});

/**
 * Reset state before each test
 */
beforeEach(() => {
  correlationIds = [];
  mockAxios.reset();
  jest.clearAllMocks();
});

describe('API Service Integration Tests', () => {
  describe('Request Handling', () => {
    test('should successfully make GET request with correlation tracking', async () => {
      // Arrange
      const mockEmailData: TestEmailData = {
        id: '123',
        subject: 'Test Email',
        content: 'Test Content'
      };

      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.DETAIL.replace(':id', '123')}`)
        .reply(HTTP_STATUS.OK, mockEmailData, {
          [CORRELATION_ID_HEADER]: 'test-correlation-id'
        });

      // Act
      const response = await apiService.get<TestEmailData>(
        API_ENDPOINTS.EMAIL.DETAIL.replace(':id', '123')
      );

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockEmailData);
      expect(correlationIds).toContain('test-correlation-id');
    });

    test('should handle POST request with request body and headers', async () => {
      // Arrange
      const requestData = {
        subject: 'New Email',
        content: 'Email Content'
      };

      mockAxios.onPost(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.SEND}`, requestData)
        .reply(config => {
          expect(config.headers[REQUEST_HEADERS.CONTENT_TYPE]).toBe('application/json');
          return [HTTP_STATUS.CREATED, { id: '123', ...requestData }];
        });

      // Act
      const response = await apiService.post<TestEmailData>(
        API_ENDPOINTS.EMAIL.SEND,
        requestData
      );

      // Assert
      expect(response.success).toBe(true);
      expect(response.data?.id).toBe('123');
    });
  });

  describe('Authentication Flow', () => {
    test('should include authentication token in requests when set', async () => {
      // Arrange
      apiService.setAuthToken(MOCK_AUTH_TOKEN);

      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.LIST}`)
        .reply(config => {
          expect(config.headers[REQUEST_HEADERS.AUTHORIZATION])
            .toBe(`Bearer ${MOCK_AUTH_TOKEN}`);
          return [HTTP_STATUS.OK, []];
        });

      // Act
      await apiService.get(API_ENDPOINTS.EMAIL.LIST);

      // Assert
      expect(mockAxios.history.get.length).toBe(1);
    });

    test('should handle token refresh when receiving 401 response', async () => {
      // Arrange
      const newToken = 'new-auth-token';
      let requestCount = 0;

      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.LIST}`)
        .reply(() => {
          requestCount++;
          return requestCount === 1 
            ? [HTTP_STATUS.UNAUTHORIZED] 
            : [HTTP_STATUS.OK, []];
        });

      mockAxios.onPost(`${TEST_API_URL}${API_ENDPOINTS.AUTH.REFRESH}`)
        .reply(HTTP_STATUS.OK, { accessToken: newToken });

      // Act
      const response = await apiService.get(API_ENDPOINTS.EMAIL.LIST);

      // Assert
      expect(response.success).toBe(true);
      expect(requestCount).toBe(2);
      expect(mockAxios.history.post).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors with proper error structure', async () => {
      // Arrange
      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.LIST}`)
        .networkError();

      // Act
      const response = await apiService.get(API_ENDPOINTS.EMAIL.LIST);

      // Assert
      expect(response.success).toBe(false);
      expect(response.error?.message).toBe(API_ERRORS.NETWORK_ERROR);
    });

    test('should handle timeout errors with circuit breaker', async () => {
      // Arrange
      const timeoutRequests = Array(apiConfig.retryConfig.maxAttempts).fill(null);
      let requestCount = 0;

      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.LIST}`)
        .reply(() => {
          requestCount++;
          return [HTTP_STATUS.SERVICE_UNAVAILABLE];
        });

      // Act
      for await (const _ of timeoutRequests) {
        await apiService.get(API_ENDPOINTS.EMAIL.LIST);
      }

      // Assert
      expect(requestCount).toBe(apiConfig.retryConfig.maxAttempts);
      
      // Circuit should be open now, this should fail immediately
      const finalResponse = await apiService.get(API_ENDPOINTS.EMAIL.LIST);
      expect(finalResponse.error?.code).toBe('CIRCUIT_BREAKER_OPEN');
    });
  });

  describe('Context Processing', () => {
    test('should process context analysis request with proper data transformation', async () => {
      // Arrange
      const contextRequest = {
        emailId: '123',
        content: 'Test email content for analysis'
      };

      const expectedAnalysis: TestContextData = {
        emailId: '123',
        analysis: {
          sentiment: 'positive',
          topics: ['test', 'email']
        }
      };

      mockAxios.onPost(`${TEST_API_URL}${API_ENDPOINTS.CONTEXT.ANALYZE}`, contextRequest)
        .reply(HTTP_STATUS.OK, expectedAnalysis);

      // Act
      const response = await apiService.post<TestContextData>(
        API_ENDPOINTS.CONTEXT.ANALYZE,
        contextRequest
      );

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toEqual(expectedAnalysis);
    });
  });

  describe('Monitoring Integration', () => {
    test('should track request metrics and correlation IDs', async () => {
      // Arrange
      const requestMetrics: any[] = [];
      
      mockAxios.onGet(`${TEST_API_URL}${API_ENDPOINTS.EMAIL.LIST}`)
        .reply(config => {
          requestMetrics.push({
            timestamp: Date.now(),
            correlationId: config.headers[CORRELATION_ID_HEADER]
          });
          return [HTTP_STATUS.OK, []];
        });

      // Act
      await apiService.get(API_ENDPOINTS.EMAIL.LIST);

      // Assert
      expect(requestMetrics).toHaveLength(1);
      expect(requestMetrics[0].correlationId).toBeDefined();
    });
  });
});