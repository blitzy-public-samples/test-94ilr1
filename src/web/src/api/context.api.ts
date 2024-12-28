/**
 * Context API Client Module
 * Version: 1.0.0
 * 
 * Provides methods for interacting with the Context Engine service through the API Gateway
 * with enhanced error handling, validation, and monitoring capabilities.
 */

// External dependencies
import { z } from 'zod'; // ^3.22.0

// Internal imports
import { apiService } from '../services/api.service';
import { 
  Context, 
  ProjectContext, 
  RelationshipContext, 
  ContextSchema, 
  ContextQuery,
  ContextUpdate,
  ContextAnalysisResult,
  validateContext
} from '../types/context.types';
import { API_ENDPOINTS, API_TIMEOUTS } from '../constants/api.constants';

/**
 * Analysis options for context generation
 */
interface AnalysisOptions {
  includeProjects?: boolean;
  includeRelationships?: boolean;
  minConfidence?: number;
  maxTopics?: number;
}

/**
 * Default analysis options
 */
const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  includeProjects: true,
  includeRelationships: true,
  minConfidence: 0.7,
  maxTopics: 5
};

/**
 * Retrieves context information by context ID with enhanced error handling
 * @param contextId - Unique identifier for the context
 * @returns Promise resolving to Context information
 */
const getContextById = async (contextId: string): Promise<Context> => {
  const response = await apiService.withRetry(
    () => apiService.get<Context>(
      `${API_ENDPOINTS.CONTEXT.BASE}/${contextId}`,
      { timeout: API_TIMEOUTS.DEFAULT }
    )
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to retrieve context: ${response.error?.message}`);
  }

  // Validate response data
  if (!validateContext(response.data)) {
    throw new Error('Invalid context data received from server');
  }

  return response.data;
};

/**
 * Retrieves context information by email ID
 * @param emailId - Email identifier to get context for
 * @returns Promise resolving to Context information
 */
const getContextByEmailId = async (emailId: string): Promise<Context> => {
  const response = await apiService.withRetry(
    () => apiService.get<Context>(
      `${API_ENDPOINTS.CONTEXT.BASE}/email/${emailId}`,
      { timeout: API_TIMEOUTS.DEFAULT }
    )
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to retrieve context for email: ${response.error?.message}`);
  }

  // Validate response data
  if (!validateContext(response.data)) {
    throw new Error('Invalid context data received from server');
  }

  return response.data;
};

/**
 * Updates existing context information
 * @param contextId - Context identifier to update
 * @param update - Partial context update data
 * @returns Promise resolving to updated Context
 */
const updateContext = async (contextId: string, update: ContextUpdate): Promise<Context> => {
  // Validate update data structure
  const partialSchema = ContextSchema.partial();
  const validationResult = partialSchema.safeParse(update);
  
  if (!validationResult.success) {
    throw new Error(`Invalid update data: ${validationResult.error.message}`);
  }

  const response = await apiService.withRetry(
    () => apiService.put<Context>(
      `${API_ENDPOINTS.CONTEXT.BASE}/${contextId}`,
      update,
      { timeout: API_TIMEOUTS.DEFAULT }
    )
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to update context: ${response.error?.message}`);
  }

  // Validate response data
  if (!validateContext(response.data)) {
    throw new Error('Invalid context data received from server');
  }

  return response.data;
};

/**
 * Triggers context analysis for an email with progress tracking
 * @param emailId - Email identifier to analyze
 * @param options - Analysis configuration options
 * @returns Promise resolving to analysis results
 */
const analyzeEmailContext = async (
  emailId: string,
  options: AnalysisOptions = DEFAULT_ANALYSIS_OPTIONS
): Promise<ContextAnalysisResult> => {
  const response = await apiService.withCircuitBreaker(
    () => apiService.post<ContextAnalysisResult>(
      API_ENDPOINTS.CONTEXT.ANALYZE,
      {
        emailId,
        options: { ...DEFAULT_ANALYSIS_OPTIONS, ...options }
      },
      { timeout: API_TIMEOUTS.LONG }
    )
  );

  if (!response.success || !response.data) {
    throw new Error(`Context analysis failed: ${response.error?.message}`);
  }

  // Validate analysis result
  if (!validateContext(response.data.context)) {
    throw new Error('Invalid context analysis result received from server');
  }

  return response.data;
};

/**
 * Retrieves project-specific context information
 * @param projectId - Project identifier
 * @param query - Optional query parameters
 * @returns Promise resolving to array of Context objects
 */
const getProjectContext = async (
  projectId: string,
  query?: ContextQuery
): Promise<Context[]> => {
  const response = await apiService.withRetry(
    () => apiService.get<Context[]>(
      `${API_ENDPOINTS.CONTEXT.PROJECTS}/${projectId}`,
      {
        params: query,
        timeout: API_TIMEOUTS.DEFAULT
      }
    )
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to retrieve project context: ${response.error?.message}`);
  }

  // Validate each context object in the response
  if (!response.data.every(validateContext)) {
    throw new Error('Invalid context data received from server');
  }

  return response.data;
};

/**
 * Exports the context API client functions
 */
export const contextApi = {
  getContextById,
  getContextByEmailId,
  getProjectContext,
  updateContext,
  analyzeEmailContext
};

/**
 * Export types for external use
 */
export type {
  AnalysisOptions,
  ContextAnalysisResult,
  ContextQuery,
  ContextUpdate
};