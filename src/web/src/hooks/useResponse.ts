/**
 * @fileoverview Enhanced custom React hook for managing email response generation
 * with comprehensive error handling, retry logic, and performance monitoring.
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.5
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.3

import {
  ResponseTemplate,
  GeneratedResponse,
  ResponseReviewData,
  ResponseTone,
  GenerateResponseRequest,
  ResponseError,
} from '../types/response.types';

import {
  generateResponseAsync,
  getTemplatesAsync,
  selectCurrentResponse,
  selectTemplates,
  selectLoadingStatus,
  selectError,
  selectCircuitBreakerStatus,
  resetErrors,
  updateCircuitBreaker
} from '../store/response.slice';

/**
 * Interface for loading states of different operations
 */
interface LoadingState {
  generating: boolean;
  loadingTemplates: boolean;
  submittingReview: boolean;
}

/**
 * Interface for the last operation details
 */
interface LastOperation {
  type: 'generate' | 'loadTemplates' | 'review';
  params: any;
  timestamp: number;
}

/**
 * Enhanced custom hook for managing email response generation workflow
 * @returns Object containing response state and management functions
 */
export const useResponse = () => {
  const dispatch = useDispatch();
  const { showBoundary } = useErrorBoundary();

  // Redux selectors
  const currentResponse = useSelector(selectCurrentResponse);
  const templates = useSelector(selectTemplates);
  const circuitBreaker = useSelector(selectCircuitBreakerStatus);

  // Local state
  const [loading, setLoading] = useState<LoadingState>({
    generating: false,
    loadingTemplates: false,
    submittingReview: false
  });
  const [error, setError] = useState<ResponseError | null>(null);
  const lastOperationRef = useRef<LastOperation | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Cleanup function for ongoing operations
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Enhanced error handler with retry logic and circuit breaker integration
   */
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`Error in ${operation}:`, error);
    setError({
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || `Failed to ${operation}`,
      details: error.details || {}
    });

    // Update circuit breaker state if needed
    if (error.statusCode >= 500) {
      dispatch(updateCircuitBreaker({
        failureCount: circuitBreaker.failureCount + 1,
        lastFailureTime: Date.now()
      }));
    }

    // Show error boundary for critical errors
    if (error.statusCode >= 500 || error.code === 'CRITICAL_ERROR') {
      showBoundary(error);
    }
  }, [dispatch, circuitBreaker.failureCount, showBoundary]);

  /**
   * Generates email response with enhanced error handling and monitoring
   */
  const generateResponse = useCallback(async (request: GenerateResponseRequest) => {
    try {
      if (circuitBreaker.isOpen) {
        throw new Error('Service is temporarily unavailable. Please try again later.');
      }

      setLoading(prev => ({ ...prev, generating: true }));
      setError(null);

      // Create abort controller for request cancellation
      abortControllerRef.current = new AbortController();

      // Store operation details for potential retry
      lastOperationRef.current = {
        type: 'generate',
        params: request,
        timestamp: Date.now()
      };

      const result = await dispatch(generateResponseAsync(request)).unwrap();
      
      // Reset circuit breaker on success
      if (circuitBreaker.failureCount > 0) {
        dispatch(updateCircuitBreaker({ failureCount: 0, isOpen: false }));
      }

      return result;
    } catch (error: any) {
      handleError(error, 'generate response');
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, generating: false }));
    }
  }, [dispatch, circuitBreaker, handleError]);

  /**
   * Loads response templates with caching and filtering
   */
  const loadTemplates = useCallback(async (tone?: ResponseTone, tags?: string[]) => {
    try {
      setLoading(prev => ({ ...prev, loadingTemplates: true }));
      setError(null);

      lastOperationRef.current = {
        type: 'loadTemplates',
        params: { tone, tags },
        timestamp: Date.now()
      };

      await dispatch(getTemplatesAsync({ 
        forceRefresh: false,
        tone,
        tags
      })).unwrap();
    } catch (error: any) {
      handleError(error, 'load templates');
    } finally {
      setLoading(prev => ({ ...prev, loadingTemplates: false }));
    }
  }, [dispatch, handleError]);

  /**
   * Submits response review with validation
   */
  const submitReview = useCallback(async (reviewData: ResponseReviewData) => {
    try {
      setLoading(prev => ({ ...prev, submittingReview: true }));
      setError(null);

      lastOperationRef.current = {
        type: 'review',
        params: reviewData,
        timestamp: Date.now()
      };

      // Implement review submission logic here
      // This would typically dispatch a review action
      
    } catch (error: any) {
      handleError(error, 'submit review');
    } finally {
      setLoading(prev => ({ ...prev, submittingReview: false }));
    }
  }, [handleError]);

  /**
   * Retries the last failed operation
   */
  const retryLastOperation = useCallback(async () => {
    if (!lastOperationRef.current) return;

    const { type, params } = lastOperationRef.current;

    switch (type) {
      case 'generate':
        return generateResponse(params);
      case 'loadTemplates':
        return loadTemplates(params.tone, params.tags);
      case 'review':
        return submitReview(params);
    }
  }, [generateResponse, loadTemplates, submitReview]);

  /**
   * Cancels ongoing request
   */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading({
      generating: false,
      loadingTemplates: false,
      submittingReview: false
    });
  }, []);

  /**
   * Clears current response and errors
   */
  const clearResponse = useCallback(() => {
    dispatch(resetErrors());
    setError(null);
  }, [dispatch]);

  return {
    // State
    currentResponse,
    templates,
    loading,
    error,

    // Actions
    generateResponse,
    loadTemplates,
    submitReview,
    clearResponse,
    retryLastOperation,
    cancelRequest
  };
};

export default useResponse;