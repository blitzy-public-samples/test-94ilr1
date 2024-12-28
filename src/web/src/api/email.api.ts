/**
 * @fileoverview Email API Client Module
 * Provides type-safe API client functions for email-related operations
 * with real-time monitoring, thread tracking, and secure communication
 * @version 1.0.0
 */

// External dependencies
import { AxiosRequestConfig } from 'axios'; // ^1.6.0

// Internal imports
import { 
  apiService,
  withRetry,
  createAbortController
} from '../services/api.service';
import { 
  IEmailMessage, 
  IEmailThread, 
  EmailFilter, 
  EmailApiResponse, 
  EmailPaginatedResponse,
  EmailStatus,
  ThreadContext
} from '../types/email.types';
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Cache duration for email data in seconds
 */
const EMAIL_CACHE_DURATION = {
  LIST: 300, // 5 minutes
  THREAD: 300, // 5 minutes
  CONTEXT: 600 // 10 minutes
} as const;

/**
 * WebSocket connection for real-time updates
 */
class EmailWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;

  constructor(private url: string, private onMessage: (data: any) => void) {}

  connect(): void {
    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (error) {
        console.error('WebSocket message parsing failed:', error);
      }
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, this.RECONNECT_DELAY * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Email API client with enhanced features and real-time capabilities
 */
class EmailApiClient {
  private wsConnection: EmailWebSocket | null = null;

  /**
   * Retrieves paginated list of emails with real-time updates and filtering
   * @param filter - Email filtering criteria
   * @param page - Page number for pagination
   * @param pageSize - Number of items per page
   * @param enableRealtime - Enable real-time updates via WebSocket
   * @param signal - AbortSignal for request cancellation
   */
  @withRetry(3)
  async getEmails(
    filter: EmailFilter,
    page: number = 1,
    pageSize: number = 50,
    enableRealtime: boolean = false,
    signal?: AbortSignal
  ): Promise<EmailPaginatedResponse<IEmailMessage[]>> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(filter.status !== undefined && { status: filter.status.toString() }),
        ...(filter.priority !== undefined && { priority: filter.priority.toString() }),
        ...(filter.fromDate && { fromDate: filter.fromDate.toISOString() }),
        ...(filter.toDate && { toDate: filter.toDate.toISOString() }),
        ...(filter.searchTerm && { search: filter.searchTerm })
      });

      const config: AxiosRequestConfig = {
        params: queryParams,
        signal,
        headers: {
          'Cache-Control': `max-age=${EMAIL_CACHE_DURATION.LIST}`
        }
      };

      const response = await apiService.get<EmailPaginatedResponse<IEmailMessage[]>>(
        API_ENDPOINTS.EMAIL.LIST,
        config
      );

      if (enableRealtime && !this.wsConnection) {
        this.setupRealtimeUpdates();
      }

      return response.data;
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Retrieves complete email thread with context tracking
   * @param threadId - Unique identifier of the thread
   * @param includeContext - Include additional context information
   * @param signal - AbortSignal for request cancellation
   */
  @withRetry(3)
  async getEmailThread(
    threadId: string,
    includeContext: boolean = false,
    signal?: AbortSignal
  ): Promise<EmailApiResponse<IEmailThread & ThreadContext>> {
    try {
      const config: AxiosRequestConfig = {
        params: { includeContext },
        signal,
        headers: {
          'Cache-Control': `max-age=${EMAIL_CACHE_DURATION.THREAD}`
        }
      };

      const response = await apiService.get<EmailApiResponse<IEmailThread & ThreadContext>>(
        `${API_ENDPOINTS.EMAIL.DETAIL}/${threadId}`,
        config
      );

      return response.data;
    } catch (error) {
      console.error('Failed to fetch email thread:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Sends a new email message
   * @param message - Email message to send
   * @param isDraft - Save as draft instead of sending
   */
  async sendEmail(
    message: Partial<IEmailMessage>,
    isDraft: boolean = false
  ): Promise<EmailApiResponse<IEmailMessage>> {
    try {
      const endpoint = isDraft ? API_ENDPOINTS.EMAIL.DRAFT : API_ENDPOINTS.EMAIL.SEND;
      const response = await apiService.post<EmailApiResponse<IEmailMessage>>(
        endpoint,
        message
      );

      return response.data;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Updates email status (read, archived, deleted)
   * @param messageId - ID of the email message
   * @param status - New status to set
   */
  async updateEmailStatus(
    messageId: string,
    status: EmailStatus
  ): Promise<EmailApiResponse<IEmailMessage>> {
    try {
      const response = await apiService.put<EmailApiResponse<IEmailMessage>>(
        `${API_ENDPOINTS.EMAIL.DETAIL}/${messageId}/status`,
        { status }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update email status:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Permanently deletes an email message
   * @param messageId - ID of the email message
   */
  async deleteEmail(messageId: string): Promise<EmailApiResponse<void>> {
    try {
      const response = await apiService.delete<EmailApiResponse<void>>(
        `${API_ENDPOINTS.EMAIL.DETAIL}/${messageId}`
      );

      return response.data;
    } catch (error) {
      console.error('Failed to delete email:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Sets up real-time email updates via WebSocket
   */
  private setupRealtimeUpdates(): void {
    const wsUrl = `${process.env.REACT_APP_WS_URL}/emails/realtime`;
    
    this.wsConnection = new EmailWebSocket(wsUrl, (data) => {
      // Handle real-time updates
      this.handleRealtimeUpdate(data);
    });
    
    this.wsConnection.connect();
  }

  /**
   * Handles incoming real-time email updates
   */
  private handleRealtimeUpdate(data: any): void {
    // Implement update handling logic
    const event = new CustomEvent('emailUpdate', { detail: data });
    window.dispatchEvent(event);
  }

  /**
   * Normalizes API errors into a consistent format
   */
  private normalizeError(error: any): Error {
    return new Error(error.message || 'An unexpected error occurred');
  }

  /**
   * Cleanup method to close WebSocket connection
   */
  cleanup(): void {
    if (this.wsConnection) {
      this.wsConnection.disconnect();
      this.wsConnection = null;
    }
  }
}

// Export singleton instance
export const emailApi = new EmailApiClient();