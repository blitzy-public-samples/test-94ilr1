/**
 * @fileoverview API client module for response generation service with enhanced error handling,
 * retry mechanism, and performance optimization.
 * @version 1.0.0
 */

// External dependencies
import { AxiosRequestConfig } from 'axios'; // ^1.6.0

// Internal imports
import { apiService } from '../services/api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  ResponseTemplate,
  GeneratedResponse,
  GenerateResponseRequest,
  ListTemplatesParams,
  ResponseReviewData,
  ResponseApiResponse,
  ResponsePaginatedResponse
} from '../types/response.types';

/**
 * Generates an automated email response based on context and parameters
 * with enhanced error handling and retry mechanism
 * @param request - Generation request parameters
 * @returns Promise resolving to generated response with metadata
 */
export const generateResponse = async (
  request: GenerateResponseRequest
): Promise<ResponseApiResponse<GeneratedResponse>> => {
  try {
    // Validate request parameters
    if (!request.email_id || !request.context_id) {
      throw new Error('Missing required parameters: email_id or context_id');
    }

    // Configure request with retry options
    const config: AxiosRequestConfig = {
      headers: {
        'X-Request-Type': 'Response-Generation',
        'X-Context-ID': request.context_id
      }
    };

    // Make API request with retry support
    const response = await apiService.post<ResponseApiResponse<GeneratedResponse>>(
      API_ENDPOINTS.RESPONSE.GENERATE,
      request,
      config
    );

    // Validate response data
    if (!response.success || !response.data?.data?.response_id) {
      throw new Error('Invalid response data structure');
    }

    return response.data;
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};

/**
 * Retrieves available response templates with pagination and filtering support
 * Implements caching for improved performance
 * @param params - Template listing parameters
 * @returns Promise resolving to paginated template list
 */
export const getTemplates = async (
  params: ListTemplatesParams
): Promise<ResponsePaginatedResponse<ResponseTemplate>> => {
  try {
    // Validate pagination parameters
    const validatedParams = {
      ...params,
      page_size: Math.min(Math.max(1, params.page_size), 100) // Ensure page size is between 1 and 100
    };

    // Configure cache-control headers
    const config: AxiosRequestConfig = {
      headers: {
        'Cache-Control': 'max-age=300', // Cache for 5 minutes
        'X-Request-Type': 'Template-List'
      },
      params: validatedParams
    };

    // Make API request with caching
    const response = await apiService.get<ResponsePaginatedResponse<ResponseTemplate>>(
      API_ENDPOINTS.RESPONSE.TEMPLATES,
      config
    );

    // Validate response data
    if (!response.success || !Array.isArray(response.data?.items)) {
      throw new Error('Invalid template list response structure');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * Retrieves a specific generated response by ID with comprehensive error handling
 * @param responseId - Unique identifier of the response
 * @returns Promise resolving to response details
 */
export const getResponseById = async (
  responseId: string
): Promise<ResponseApiResponse<GeneratedResponse>> => {
  try {
    // Validate response ID format
    if (!responseId || typeof responseId !== 'string') {
      throw new Error('Invalid response ID format');
    }

    // Configure request
    const config: AxiosRequestConfig = {
      headers: {
        'X-Request-Type': 'Response-Detail',
        'X-Response-ID': responseId
      }
    };

    // Make API request
    const response = await apiService.get<ResponseApiResponse<GeneratedResponse>>(
      `${API_ENDPOINTS.RESPONSE.REVIEW}/${responseId}`,
      config
    );

    // Validate response data
    if (!response.success || !response.data?.data?.response_id) {
      throw new Error('Invalid response detail structure');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching response:', error);
    throw error;
  }
};

/**
 * Submits review feedback for a generated response with validation
 * @param reviewData - Review submission data
 * @returns Promise resolving to success/failure status
 */
export const submitResponseReview = async (
  reviewData: ResponseReviewData
): Promise<ResponseApiResponse<void>> => {
  try {
    // Validate review data
    if (!reviewData.response_id || !reviewData.status) {
      throw new Error('Missing required review data fields');
    }

    // Sanitize feedback content
    const sanitizedReview = {
      ...reviewData,
      feedback: reviewData.feedback?.trim() || ''
    };

    // Configure request
    const config: AxiosRequestConfig = {
      headers: {
        'X-Request-Type': 'Response-Review',
        'X-Response-ID': reviewData.response_id
      }
    };

    // Make API request
    const response = await apiService.put<ResponseApiResponse<void>>(
      `${API_ENDPOINTS.RESPONSE.REVIEW}/${reviewData.response_id}`,
      sanitizedReview,
      config
    );

    // Validate response
    if (!response.success) {
      throw new Error('Failed to submit response review');
    }

    return response.data;
  } catch (error) {
    console.error('Error submitting review:', error);
    throw error;
  }
};