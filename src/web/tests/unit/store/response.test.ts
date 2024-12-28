/**
 * @fileoverview Unit tests for response Redux slice with comprehensive testing of
 * response generation, error handling, performance monitoring, and circuit breaker pattern.
 * @version 1.0.0
 */

// External imports
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'; // ^29.0.0

// Internal imports
import responseReducer, {
  generateResponseAsync,
  getTemplatesAsync,
  submitReviewAsync,
  resetErrors,
  updateCircuitBreaker,
  resetMetrics,
  selectCurrentResponse,
  selectTemplates,
  selectResponseMetrics,
  selectCircuitBreakerStatus
} from '../../../src/store/response.slice';

import {
  ResponseTemplate,
  GeneratedResponse,
  ResponseStatus,
  ResponseTone,
  CircuitBreakerStatus
} from '../../../src/types/response.types';

// Mock API functions
jest.mock('../../../src/api/response.api', () => ({
  generateResponse: jest.fn(),
  getTemplates: jest.fn(),
  submitResponseReview: jest.fn()
}));

/**
 * Test store configuration with monitoring middleware
 */
const setupTestStore = () => {
  return configureStore({
    reducer: {
      response: responseReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: {
          extraArgument: {
            performanceMonitor: jest.fn(),
            errorTracker: jest.fn()
          }
        }
      })
  });
};

/**
 * Mock template generator with performance metrics
 */
const generateMockTemplate = (overrides?: Partial<ResponseTemplate>): ResponseTemplate => ({
  template_id: 'template-123',
  name: 'Professional Response',
  content: 'Dear {{name}}, Thank you for your email.',
  tone: ResponseTone.PROFESSIONAL,
  placeholders: ['name'],
  tags: ['professional', 'general'],
  is_active: true,
  metadata: {
    performance_score: '0.95',
    success_rate: '0.98',
    avg_response_time: '150'
  },
  ...overrides
});

/**
 * Mock response generator with error scenarios
 */
const generateMockResponse = (overrides?: Partial<GeneratedResponse>): GeneratedResponse => ({
  response_id: 'response-123',
  email_id: 'email-123',
  thread_id: 'thread-123',
  content: 'Generated response content',
  template_id: 'template-123',
  tone: ResponseTone.PROFESSIONAL,
  status: ResponseStatus.DRAFT,
  confidence_score: 0.95,
  generated_at: new Date(),
  metadata: {
    performance_metrics: {
      generation_time: '120ms',
      token_count: '150',
      error_rate: '0.01'
    }
  },
  ...overrides
});

describe('response slice', () => {
  let store: ReturnType<typeof setupTestStore>;

  beforeEach(() => {
    store = setupTestStore();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty templates list with initialized metadata', () => {
      const state = store.getState().response;
      expect(state.templates).toEqual([]);
      expect(state.metrics).toBeDefined();
      expect(state.metrics.successCount).toBe(0);
      expect(state.metrics.errorCount).toBe(0);
    });

    it('should have null current response with error tracking enabled', () => {
      const state = store.getState().response;
      expect(state.currentResponse).toBeNull();
      expect(state.errors).toBeDefined();
    });

    it('should initialize circuit breaker in closed state', () => {
      const state = store.getState().response;
      expect(state.circuitBreaker.isOpen).toBe(false);
      expect(state.circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('generateResponseAsync', () => {
    const mockRequest = {
      emailId: 'email-123',
      contextId: 'context-123',
      tone: ResponseTone.PROFESSIONAL,
      templateId: 'template-123'
    };

    it('should set loading state with performance tracking', async () => {
      const mockResponse = generateMockResponse();
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockResolvedValueOnce({ data: mockResponse });

      const promise = store.dispatch(generateResponseAsync(mockRequest));
      
      const loadingState = store.getState().response;
      expect(Object.values(loadingState.loading).some(Boolean)).toBe(true);

      await promise;
    });

    it('should update current response with metrics on success', async () => {
      const mockResponse = generateMockResponse();
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockResolvedValueOnce({ data: mockResponse });

      await store.dispatch(generateResponseAsync(mockRequest));
      
      const state = store.getState().response;
      expect(state.currentResponse).toEqual(mockResponse);
      expect(state.metrics.successCount).toBe(1);
      expect(state.metrics.lastResponseTime).toBeGreaterThan(0);
    });

    it('should handle API errors with circuit breaker triggering', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockRejectedValueOnce(mockError);

      await store.dispatch(generateResponseAsync(mockRequest));
      
      const state = store.getState().response;
      expect(state.errors).toBeDefined();
      expect(state.metrics.errorCount).toBe(1);
      expect(state.circuitBreaker.failureCount).toBe(1);
    });
  });

  describe('getTemplatesAsync', () => {
    it('should update templates list with metrics on success', async () => {
      const mockTemplates = [generateMockTemplate(), generateMockTemplate()];
      jest.spyOn(require('../../../src/api/response.api'), 'getTemplates')
        .mockResolvedValueOnce({ items: mockTemplates });

      await store.dispatch(getTemplatesAsync({ forceRefresh: true }));
      
      const state = store.getState().response;
      expect(state.templates).toEqual(mockTemplates);
      expect(state.metrics.successCount).toBe(1);
    });

    it('should handle network errors with circuit breaker', async () => {
      const mockError = new Error('Network Error');
      jest.spyOn(require('../../../src/api/response.api'), 'getTemplates')
        .mockRejectedValueOnce(mockError);

      await store.dispatch(getTemplatesAsync({ forceRefresh: true }));
      
      const state = store.getState().response;
      expect(state.errors).toBeDefined();
      expect(state.circuitBreaker.failureCount).toBe(1);
    });
  });

  describe('circuit breaker functionality', () => {
    it('should transition to open state after error threshold', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockRejectedValue(mockError);

      const mockRequest = {
        emailId: 'email-123',
        contextId: 'context-123',
        tone: ResponseTone.PROFESSIONAL
      };

      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        await store.dispatch(generateResponseAsync(mockRequest));
      }

      const state = store.getState().response;
      expect(state.circuitBreaker.isOpen).toBe(true);
      expect(state.circuitBreaker.failureCount).toBe(5);
    });

    it('should reset to closed state after successful operations', async () => {
      // First set circuit breaker to open state
      store.dispatch(updateCircuitBreaker({
        isOpen: true,
        failureCount: 5,
        lastFailureTime: Date.now()
      }));

      // Mock successful response
      const mockResponse = generateMockResponse();
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockResolvedValueOnce({ data: mockResponse });

      await store.dispatch(generateResponseAsync({
        emailId: 'email-123',
        contextId: 'context-123',
        tone: ResponseTone.PROFESSIONAL
      }));

      const state = store.getState().response;
      expect(state.circuitBreaker.isOpen).toBe(false);
      expect(state.circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('performance monitoring', () => {
    it('should track response generation performance metrics', async () => {
      const mockResponse = generateMockResponse();
      jest.spyOn(require('../../../src/api/response.api'), 'generateResponse')
        .mockResolvedValueOnce({ data: mockResponse });

      const startTime = Date.now();
      await store.dispatch(generateResponseAsync({
        emailId: 'email-123',
        contextId: 'context-123',
        tone: ResponseTone.PROFESSIONAL
      }));

      const state = store.getState().response;
      expect(state.metrics.lastResponseTime).toBeGreaterThanOrEqual(0);
      expect(state.metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(Date.now() - startTime).toBeGreaterThan(0);
    });
  });
});