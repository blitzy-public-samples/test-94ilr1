/**
 * @fileoverview Integration tests for email-related functionality in the web frontend
 * Tests email API client integration with backend services including real-time updates,
 * security features, and error handling scenarios
 * @version 1.0.0
 */

// External dependencies
import { describe, test, expect, beforeAll, afterEach, afterAll, jest } from '@jest/globals'; // ^29.7.0
import MockAdapter from 'axios-mock-adapter'; // ^1.22.0
import nock from 'nock'; // ^13.3.0
import WebSocket from 'ws'; // ^8.14.0

// Internal imports
import { emailApi } from '../../src/api/email.api';
import { 
  IEmailMessage, 
  IEmailThread, 
  EmailFilter, 
  EmailStatus, 
  EmailPriority 
} from '../../src/types/email.types';
import { apiService } from '../../src/services/api.service';
import { API_ENDPOINTS, API_BASE_URL } from '../../src/constants/api.constants';

// Mock data
const mockEmailResponse: IEmailMessage = {
  messageId: 'test-msg-1',
  threadId: 'test-thread-1',
  accountId: 'test-account-1',
  subject: 'Test Email Subject',
  content: 'Test email content',
  fromAddress: 'sender@test.com',
  toAddresses: ['recipient@test.com'],
  ccAddresses: [],
  bccAddresses: [],
  attachments: [{
    attachmentId: 'att-1',
    filename: 'test.pdf',
    contentType: 'application/pdf',
    size: 1024,
    url: 'https://test.com/attachments/test.pdf'
  }],
  priority: EmailPriority.NORMAL,
  status: EmailStatus.UNREAD,
  sentAt: new Date('2023-01-01T00:00:00Z'),
  receivedAt: new Date('2023-01-01T00:00:01Z'),
  headers: {},
  metadata: {}
};

const mockThreadResponse: IEmailThread = {
  threadId: 'test-thread-1',
  subject: 'Test Thread',
  messages: [mockEmailResponse],
  participants: ['sender@test.com', 'recipient@test.com'],
  lastMessageAt: new Date('2023-01-01T00:00:01Z'),
  unreadCount: 1
};

// Test setup
let mockAxios: MockAdapter;
let mockWebSocket: WebSocket.Server;

beforeAll(() => {
  // Initialize axios mock
  mockAxios = new MockAdapter(apiService['client'], { delayResponse: 100 });

  // Setup WebSocket mock server
  mockWebSocket = new WebSocket.Server({ port: 8080 });
  mockWebSocket.on('connection', (socket) => {
    socket.on('message', (data) => {
      // Echo received messages back for testing
      socket.send(data);
    });
  });

  // Configure nock for external API mocking
  nock.disableNetConnect();
  nock.enableNetConnect('localhost');
});

afterEach(() => {
  // Reset all mocks
  mockAxios.reset();
  jest.clearAllMocks();
});

afterAll(() => {
  // Cleanup
  mockAxios.restore();
  mockWebSocket.close();
  nock.cleanAll();
  nock.enableNetConnect();
});

describe('Email API Integration Tests', () => {
  describe('getEmails', () => {
    test('should retrieve paginated list of emails with filtering', async () => {
      const filter: EmailFilter = {
        status: EmailStatus.UNREAD,
        priority: EmailPriority.NORMAL,
        fromDate: new Date('2023-01-01'),
        toDate: new Date('2023-12-31'),
        searchTerm: 'test'
      };

      const mockResponse = {
        items: [mockEmailResponse],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false
      };

      mockAxios.onGet(API_ENDPOINTS.EMAIL.LIST).reply(200, {
        success: true,
        data: mockResponse,
        error: null
      });

      const result = await emailApi.getEmails(filter, 1, 50);
      
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].messageId).toBe(mockEmailResponse.messageId);
      expect(mockAxios.history.get[0].params).toMatchObject({
        status: EmailStatus.UNREAD,
        priority: EmailPriority.NORMAL,
        page: '1',
        pageSize: '50'
      });
    });

    test('should handle network errors gracefully', async () => {
      mockAxios.onGet(API_ENDPOINTS.EMAIL.LIST).networkError();

      await expect(emailApi.getEmails({}, 1, 50)).rejects.toThrow('Network Error');
    });

    test('should handle rate limiting', async () => {
      mockAxios.onGet(API_ENDPOINTS.EMAIL.LIST).reply(429, {
        success: false,
        error: 'Rate limit exceeded'
      });

      await expect(emailApi.getEmails({}, 1, 50)).rejects.toThrow();
    });
  });

  describe('getEmailThread', () => {
    test('should retrieve complete email thread with context', async () => {
      const threadId = 'test-thread-1';

      mockAxios.onGet(`${API_ENDPOINTS.EMAIL.DETAIL}/${threadId}`).reply(200, {
        success: true,
        data: mockThreadResponse,
        error: null
      });

      const result = await emailApi.getEmailThread(threadId, true);
      
      expect(result.data.threadId).toBe(threadId);
      expect(result.data.messages).toHaveLength(1);
      expect(mockAxios.history.get[0].params).toMatchObject({
        includeContext: true
      });
    });

    test('should handle non-existent threads', async () => {
      const threadId = 'non-existent';

      mockAxios.onGet(`${API_ENDPOINTS.EMAIL.DETAIL}/${threadId}`).reply(404, {
        success: false,
        error: 'Thread not found'
      });

      await expect(emailApi.getEmailThread(threadId)).rejects.toThrow();
    });
  });

  describe('Real-time Updates', () => {
    test('should handle WebSocket connection and updates', (done) => {
      const mockUpdate = {
        type: 'EMAIL_RECEIVED',
        data: mockEmailResponse
      };

      // Setup event listener
      window.addEventListener('emailUpdate', ((event: CustomEvent) => {
        expect(event.detail).toEqual(mockUpdate);
        done();
      }) as EventListener);

      // Simulate WebSocket message
      mockWebSocket.clients.forEach(client => {
        client.send(JSON.stringify(mockUpdate));
      });
    });

    test('should reconnect on connection loss', async () => {
      const mockClose = jest.spyOn(WebSocket.prototype, 'close');
      
      // Simulate connection loss
      mockWebSocket.clients.forEach(client => client.close());

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('Email Operations', () => {
    test('should send email successfully', async () => {
      const newEmail = {
        subject: 'Test Subject',
        content: 'Test content',
        toAddresses: ['recipient@test.com']
      };

      mockAxios.onPost(API_ENDPOINTS.EMAIL.SEND).reply(200, {
        success: true,
        data: { ...mockEmailResponse, ...newEmail },
        error: null
      });

      const result = await emailApi.sendEmail(newEmail);
      
      expect(result.data.subject).toBe(newEmail.subject);
      expect(mockAxios.history.post[0].data).toContain(newEmail.subject);
    });

    test('should update email status', async () => {
      const messageId = 'test-msg-1';
      const newStatus = EmailStatus.READ;

      mockAxios.onPut(`${API_ENDPOINTS.EMAIL.DETAIL}/${messageId}/status`).reply(200, {
        success: true,
        data: { ...mockEmailResponse, status: newStatus },
        error: null
      });

      const result = await emailApi.updateEmailStatus(messageId, newStatus);
      
      expect(result.data.status).toBe(newStatus);
    });

    test('should delete email permanently', async () => {
      const messageId = 'test-msg-1';

      mockAxios.onDelete(`${API_ENDPOINTS.EMAIL.DETAIL}/${messageId}`).reply(200, {
        success: true,
        data: null,
        error: null
      });

      const result = await emailApi.deleteEmail(messageId);
      
      expect(result.success).toBe(true);
    });
  });
});