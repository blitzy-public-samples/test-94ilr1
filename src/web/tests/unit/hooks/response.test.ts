/**
 * @fileoverview Unit tests for useResponse hook with comprehensive coverage of
 * response generation, template management, and review workflow.
 * @version 1.0.0
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks'; // ^8.0.1
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { Provider } from 'react-redux'; // ^8.0.5
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

import { useResponse } from '../../../src/hooks/useResponse';
import {
  ResponseTone,
  GenerateResponseRequest,
  ResponseTemplate,
  GeneratedResponse,
  ResponseStatus,
  ResponseReviewData
} from '../../../src/types/response.types';

// Mock Redux store slice
jest.mock('../../../src/store/response.slice', () => ({
  generateResponseAsync: jest.fn(),
  getTemplatesAsync: jest.fn(),
  selectCurrentResponse: jest.fn(),
  selectTemplates: jest.fn(),
  selectLoadingStatus: jest.fn(),
  selectError: jest.fn(),
  selectCircuitBreakerStatus: jest.fn(),
  resetErrors: jest.fn(),
  updateCircuitBreaker: jest.fn()
}));

// Mock performance monitoring
const mockPerformanceMonitor = jest.fn();
jest.mock('../../../src/utils/performance.utils', () => ({
  measurePerformance: () => mockPerformanceMonitor
}));

/**
 * Test setup helper with Redux store and mock configurations
 */
const setupTest = (initialState = {}, mockConfig = {}) => {
  // Create Redux store
  const store = configureStore({
    reducer: {
      response: (state = initialState) => state
    },
    preloadedState: {
      response: {
        currentResponse: null,
        templates: [],
        loading: {},
        errors: {},
        circuitBreaker: {
          isOpen: false,
          failureCount: 0,
          lastFailureTime: null
        },
        ...initialState
      }
    }
  });

  // Create wrapper with Redux Provider
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { store, wrapper };
};

describe('useResponse Hook', () => {
  // Clean up after each test
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization and Security', () => {
    it('should initialize with secure default values', () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useResponse(), { wrapper });

      expect(result.current.currentResponse).toBeNull();
      expect(result.current.templates).toEqual([]);
      expect(result.current.loading).toEqual({
        generating: false,
        loadingTemplates: false,
        submittingReview: false
      });
      expect(result.current.error).toBeNull();
    });

    it('should validate input parameters for security', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useResponse(), { wrapper });

      const invalidRequest = {} as GenerateResponseRequest;

      await act(async () => {
        await expect(result.current.generateResponse(invalidRequest))
          .rejects
          .toThrow('Missing required parameters');
      });
    });
  });

  describe('Response Generation', () => {
    const mockRequest: GenerateResponseRequest = {
      email_id: 'test-email-123',
      context_id: 'test-context-123',
      preferred_tone: ResponseTone.PROFESSIONAL,
      template_id: 'template-123',
      parameters: {}
    };

    const mockResponse: GeneratedResponse = {
      response_id: 'response-123',
      email_id: 'test-email-123',
      thread_id: 'thread-123',
      content: 'Generated response content',
      template_id: 'template-123',
      tone: ResponseTone.PROFESSIONAL,
      status: ResponseStatus.DRAFT,
      confidence_score: 0.95,
      generated_at: new Date(),
      metadata: {}
    };

    it('should handle successful response generation', async () => {
      const { wrapper, store } = setupTest();
      store.dispatch = jest.fn().mockResolvedValue({ payload: mockResponse });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await result.current.generateResponse(mockRequest);
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('response/generate')
        })
      );
      expect(mockPerformanceMonitor).toHaveBeenCalled();
    });

    it('should handle response generation with retries', async () => {
      const { wrapper, store } = setupTest();
      const error = new Error('Network error');
      store.dispatch = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ payload: mockResponse });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await result.current.generateResponse(mockRequest);
      });

      expect(store.dispatch).toHaveBeenCalledTimes(2);
    });

    it('should handle circuit breaker activation', async () => {
      const { wrapper } = setupTest({
        circuitBreaker: {
          isOpen: true,
          failureCount: 5,
          lastFailureTime: Date.now()
        }
      });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await expect(result.current.generateResponse(mockRequest))
          .rejects
          .toThrow('Service is temporarily unavailable');
      });
    });
  });

  describe('Template Management', () => {
    const mockTemplates: ResponseTemplate[] = [
      {
        template_id: 'template-1',
        name: 'Professional Response',
        content: 'Template content',
        tone: ResponseTone.PROFESSIONAL,
        placeholders: [],
        tags: ['business'],
        is_active: true,
        metadata: {}
      }
    ];

    it('should handle template loading with caching', async () => {
      const { wrapper, store } = setupTest();
      store.dispatch = jest.fn().mockResolvedValue({ payload: { templates: mockTemplates } });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await result.current.loadTemplates(ResponseTone.PROFESSIONAL);
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('response/templates')
        })
      );
    });

    it('should validate template security before loading', async () => {
      const { wrapper, store } = setupTest();
      store.dispatch = jest.fn().mockResolvedValue({ 
        payload: { 
          templates: mockTemplates.map(t => ({ ...t, content: '<script>alert("xss")</script>' }))
        } 
      });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Review Workflow', () => {
    const mockReviewData: ResponseReviewData = {
      response_id: 'response-123',
      status: ResponseStatus.APPROVED,
      feedback: 'Looks good',
      edited_content: 'Updated content'
    };

    it('should handle review submission securely', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        await result.current.submitReview(mockReviewData);
      });

      expect(result.current.loading.submittingReview).toBe(false);
    });

    it('should validate review data before submission', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useResponse(), { wrapper });

      const invalidReview = {} as ResponseReviewData;

      await act(async () => {
        await expect(result.current.submitReview(invalidReview))
          .rejects
          .toThrow('Invalid review data');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle request cancellation', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        result.current.cancelRequest();
      });

      expect(result.current.loading).toEqual({
        generating: false,
        loadingTemplates: false,
        submittingReview: false
      });
    });

    it('should clear response and errors', async () => {
      const { wrapper, store } = setupTest({
        error: { message: 'Test error' }
      });

      const { result } = renderHook(() => useResponse(), { wrapper });

      await act(async () => {
        result.current.clearResponse();
      });

      expect(result.current.error).toBeNull();
      expect(store.dispatch).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});