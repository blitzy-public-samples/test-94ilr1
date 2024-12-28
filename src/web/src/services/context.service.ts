/**
 * Context Service Module
 * Version: 1.0.0
 * 
 * Provides enterprise-grade service layer for managing email context operations with:
 * - Enhanced error handling and validation
 * - Request caching and performance optimization
 * - Security measures and rate limiting
 * - Comprehensive logging and monitoring
 */

// External dependencies
import { z } from 'zod'; // ^3.22.0
import QuickLRU from 'quick-lru'; // ^6.1.1

// Internal imports
import { contextApi } from '../api/context.api';
import {
  Context,
  ProjectContext,
  RelationshipContext,
  ContextSchema,
  ContextAnalysisResult,
  ContextUpdate,
  ContextQuery,
  validateContext
} from '../types/context.types';

// Constants for configuration
const MIN_CONFIDENCE_THRESHOLD = 0.7;
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_TTL_MS = 300000; // 5 minutes
const MAX_REQUESTS_PER_MINUTE = 100;

// Initialize LRU cache for context data
const contextCache = new QuickLRU<string, Context>({
  maxSize: 1000,
  maxAge: CACHE_TTL_MS
});

// Rate limiting state
let requestCount = 0;
let lastResetTime = Date.now();

/**
 * Decorator for request validation
 */
function validateRequest(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    // Rate limiting check
    const currentTime = Date.now();
    if (currentTime - lastResetTime > 60000) {
      requestCount = 0;
      lastResetTime = currentTime;
    }

    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    requestCount++;

    // Input validation
    if (!args[0] || typeof args[0] !== 'string') {
      throw new Error('Invalid input parameter');
    }

    return originalMethod.apply(this, args);
  };
}

/**
 * Decorator for response caching
 */
function withCache(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    const cacheKey = `${propertyKey}:${args.join(':')}`;
    const cachedResult = contextCache.get(cacheKey);

    if (cachedResult) {
      console.info(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }

    const result = await originalMethod.apply(this, args);
    if (result) {
      contextCache.set(cacheKey, result);
    }
    return result;
  };
}

/**
 * Context Service class providing enhanced context management functionality
 */
class ContextService {
  /**
   * Retrieves context information for a specific email with validation and caching
   * @param emailId - Unique identifier of the email
   * @returns Promise resolving to validated Context information
   */
  @validateRequest
  @withCache
  async getEmailContext(emailId: string): Promise<Context> {
    try {
      const context = await contextApi.getContextByEmailId(emailId);
      
      if (!validateContext(context)) {
        throw new Error('Invalid context data received from API');
      }

      if (context.confidenceScore < MIN_CONFIDENCE_THRESHOLD) {
        console.warn(`Low confidence score (${context.confidenceScore}) for email ${emailId}`);
      }

      return context;
    } catch (error) {
      console.error('Error retrieving email context:', error);
      throw new Error(`Failed to retrieve email context: ${error.message}`);
    }
  }

  /**
   * Retrieves detailed context information by context ID
   * @param contextId - Unique identifier of the context
   * @returns Promise resolving to validated Context information
   */
  @validateRequest
  @withCache
  async getContextDetails(contextId: string): Promise<Context> {
    try {
      const context = await contextApi.getContextById(contextId);
      
      if (!validateContext(context)) {
        throw new Error('Invalid context data received from API');
      }

      return context;
    } catch (error) {
      console.error('Error retrieving context details:', error);
      throw new Error(`Failed to retrieve context details: ${error.message}`);
    }
  }

  /**
   * Retrieves project-specific context information
   * @param projectId - Unique identifier of the project
   * @param query - Optional query parameters
   * @returns Promise resolving to array of Context objects
   */
  @validateRequest
  @withCache
  async getProjectDetails(projectId: string, query?: ContextQuery): Promise<Context[]> {
    try {
      const contexts = await contextApi.getProjectContext(projectId, query);
      
      if (!contexts.every(validateContext)) {
        throw new Error('Invalid context data received from API');
      }

      return contexts;
    } catch (error) {
      console.error('Error retrieving project context:', error);
      throw new Error(`Failed to retrieve project context: ${error.message}`);
    }
  }

  /**
   * Updates existing context information with validation
   * @param contextId - Context identifier to update
   * @param update - Partial context update data
   * @returns Promise resolving to updated Context
   */
  @validateRequest
  async updateContextData(contextId: string, update: ContextUpdate): Promise<Context> {
    try {
      // Validate update data
      const partialSchema = ContextSchema.partial();
      const validationResult = partialSchema.safeParse(update);
      
      if (!validationResult.success) {
        throw new Error(`Invalid update data: ${validationResult.error.message}`);
      }

      const updatedContext = await contextApi.updateContext(contextId, update);
      
      if (!validateContext(updatedContext)) {
        throw new Error('Invalid context data received from API');
      }

      // Invalidate cache for updated context
      contextCache.delete(`getContextDetails:${contextId}`);
      
      return updatedContext;
    } catch (error) {
      console.error('Error updating context:', error);
      throw new Error(`Failed to update context: ${error.message}`);
    }
  }

  /**
   * Triggers context analysis for an email
   * @param emailId - Email identifier to analyze
   * @returns Promise resolving to analysis results
   */
  @validateRequest
  async analyzeEmail(emailId: string): Promise<ContextAnalysisResult> {
    try {
      const result = await contextApi.analyzeEmailContext(emailId, {
        includeProjects: true,
        includeRelationships: true,
        minConfidence: MIN_CONFIDENCE_THRESHOLD
      });

      if (!validateContext(result.context)) {
        throw new Error('Invalid context data received from analysis');
      }

      // Cache the analyzed context
      contextCache.set(`getEmailContext:${emailId}`, result.context);

      return result;
    } catch (error) {
      console.error('Error analyzing email context:', error);
      throw new Error(`Failed to analyze email context: ${error.message}`);
    }
  }
}

// Export singleton instance
export const contextService = new ContextService();