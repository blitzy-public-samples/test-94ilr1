/**
 * @fileoverview Redux slice for managing email response generation state with enhanced
 * error handling, performance monitoring, and circuit breaker pattern implementation.
 * @version 1.0.0
 */

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import {
  ResponseTemplate,
  GeneratedResponse,
  ResponseStatus,
  ResponseTone,
  ResponseMetrics,
  CircuitBreakerConfig
} from '../types/response.types';
import {
  generateResponse,
  getTemplates,
  getResponseById,
  submitResponseReview,
  ResponseError
} from '../api/response.api';

/**
 * Interface for response slice state
 */
interface ResponseState {
  currentResponse: GeneratedResponse | null;
  templates: ResponseTemplate[];
  loading: Record<string, boolean>;
  errors: Record<string, ResponseError | null>;
  metrics: ResponseMetrics;
  circuitBreaker: CircuitBreakerConfig;
}

/**
 * Initial state with performance monitoring and circuit breaker configuration
 */
const initialState: ResponseState = {
  currentResponse: null,
  templates: [],
  loading: {},
  errors: {},
  metrics: {
    successCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    lastResponseTime: 0
  },
  circuitBreaker: {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: null,
    resetTimeout: 30000 // 30 seconds
  }
};

/**
 * Async thunk for generating email responses with enhanced error handling
 * and performance monitoring
 */
export const generateResponseAsync = createAsyncThunk(
  'response/generate',
  async (request: { emailId: string; contextId: string; tone: ResponseTone; templateId?: string }, { rejectWithValue, getState }) => {
    const startTime = Date.now();
    const correlationId = `gen-${Date.now()}`;

    try {
      // Check circuit breaker status
      const state = getState() as { response: ResponseState };
      if (state.response.circuitBreaker.isOpen) {
        throw new Error('Circuit breaker is open - request rejected');
      }

      const response = await generateResponse({
        email_id: request.emailId,
        context_id: request.contextId,
        preferred_tone: request.tone,
        template_id: request.templateId || '',
        parameters: {}
      });

      // Calculate response time
      const responseTime = Date.now() - startTime;

      return {
        response: response.data,
        metrics: {
          responseTime,
          correlationId
        }
      };
    } catch (error) {
      return rejectWithValue({
        error,
        correlationId,
        responseTime: Date.now() - startTime
      });
    }
  }
);

/**
 * Async thunk for fetching response templates with caching support
 */
export const getTemplatesAsync = createAsyncThunk(
  'response/templates',
  async ({ forceRefresh = false }: { forceRefresh?: boolean }, { getState, rejectWithValue }) => {
    const startTime = Date.now();
    const correlationId = `tmp-${Date.now()}`;

    try {
      const state = getState() as { response: ResponseState };
      
      // Return cached templates unless force refresh
      if (!forceRefresh && state.response.templates.length > 0) {
        return {
          templates: state.response.templates,
          fromCache: true,
          correlationId
        };
      }

      const response = await getTemplates({
        tags: [],
        tone: ResponseTone.PROFESSIONAL,
        page_size: 100,
        page_token: ''
      });

      return {
        templates: response.items,
        fromCache: false,
        responseTime: Date.now() - startTime,
        correlationId
      };
    } catch (error) {
      return rejectWithValue({
        error,
        correlationId,
        responseTime: Date.now() - startTime
      });
    }
  }
);

/**
 * Response management slice with enhanced error handling and metrics
 */
const responseSlice = createSlice({
  name: 'response',
  initialState,
  reducers: {
    resetErrors: (state) => {
      state.errors = {};
    },
    updateCircuitBreaker: (state, action: PayloadAction<Partial<CircuitBreakerConfig>>) => {
      state.circuitBreaker = {
        ...state.circuitBreaker,
        ...action.payload
      };
    },
    resetMetrics: (state) => {
      state.metrics = initialState.metrics;
    }
  },
  extraReducers: (builder) => {
    // Generate Response Handlers
    builder
      .addCase(generateResponseAsync.pending, (state, action) => {
        const correlationId = action.meta.requestId;
        state.loading[correlationId] = true;
        state.errors[correlationId] = null;
      })
      .addCase(generateResponseAsync.fulfilled, (state, action) => {
        const correlationId = action.meta.requestId;
        const { response, metrics } = action.payload;
        
        state.currentResponse = response;
        state.loading[correlationId] = false;
        state.errors[correlationId] = null;
        
        // Update metrics
        state.metrics.successCount++;
        state.metrics.lastResponseTime = metrics.responseTime;
        state.metrics.averageResponseTime = 
          (state.metrics.averageResponseTime * (state.metrics.successCount - 1) + metrics.responseTime) / 
          state.metrics.successCount;

        // Reset circuit breaker on success
        state.circuitBreaker.failureCount = 0;
        state.circuitBreaker.isOpen = false;
      })
      .addCase(generateResponseAsync.rejected, (state, action) => {
        const correlationId = action.meta.requestId;
        const { error, responseTime } = action.payload as any;
        
        state.loading[correlationId] = false;
        state.errors[correlationId] = error;
        
        // Update error metrics
        state.metrics.errorCount++;
        state.metrics.lastResponseTime = responseTime;

        // Update circuit breaker
        state.circuitBreaker.failureCount++;
        state.circuitBreaker.lastFailureTime = Date.now();
        if (state.circuitBreaker.failureCount >= 5) {
          state.circuitBreaker.isOpen = true;
        }
      });

    // Template Fetching Handlers
    builder
      .addCase(getTemplatesAsync.pending, (state, action) => {
        const correlationId = action.meta.requestId;
        state.loading[correlationId] = true;
        state.errors[correlationId] = null;
      })
      .addCase(getTemplatesAsync.fulfilled, (state, action) => {
        const correlationId = action.meta.requestId;
        const { templates, fromCache, responseTime } = action.payload;
        
        state.templates = templates;
        state.loading[correlationId] = false;
        
        // Update metrics only for non-cached responses
        if (!fromCache) {
          state.metrics.successCount++;
          state.metrics.lastResponseTime = responseTime;
          state.metrics.averageResponseTime = 
            (state.metrics.averageResponseTime * (state.metrics.successCount - 1) + responseTime) / 
            state.metrics.successCount;
        }
      })
      .addCase(getTemplatesAsync.rejected, (state, action) => {
        const correlationId = action.meta.requestId;
        const { error, responseTime } = action.payload as any;
        
        state.loading[correlationId] = false;
        state.errors[correlationId] = error;
        state.metrics.errorCount++;
        state.metrics.lastResponseTime = responseTime;
      });
  }
});

// Export actions and reducer
export const { resetErrors, updateCircuitBreaker, resetMetrics } = responseSlice.actions;
export default responseSlice.reducer;

// Selectors
export const selectCurrentResponse = (state: { response: ResponseState }) => state.response.currentResponse;
export const selectTemplates = (state: { response: ResponseState }) => state.response.templates;
export const selectResponseMetrics = (state: { response: ResponseState }) => state.response.metrics;
export const selectCircuitBreakerStatus = (state: { response: ResponseState }) => state.response.circuitBreaker;
export const selectLoadingStatus = (correlationId: string) => 
  (state: { response: ResponseState }) => state.response.loading[correlationId];
export const selectError = (correlationId: string) => 
  (state: { response: ResponseState }) => state.response.errors[correlationId];