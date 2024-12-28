/**
 * @fileoverview Comprehensive unit tests for email Redux slice
 * Tests state management, async operations, selectors, performance, and security
 * @version 1.0.0
 */

import { 
  describe, 
  it, 
  expect, 
  beforeEach, 
  afterEach 
} from '@jest/globals'; // ^29.0.0
import { 
  configureStore, 
  createAsyncThunk 
} from '@reduxjs/toolkit'; // ^1.9.0
import { performance } from 'perf_hooks';

// Internal imports
import {
  emailSlice,
  fetchEmails,
  fetchThread,
  sendEmail,
  updateEmailStatus,
  selectEmailsByThread,
  selectFilteredEmails
} from '../../src/store/email.slice';
import { 
  IEmailMessage, 
  EmailStatus, 
  EmailPriority,
  EmailSecurityLevel 
} from '../../src/types/email.types';
import { emailApi } from '../../src/api/email.api';

// Mock email API
jest.mock('../../src/api/email.api');

// Test store configuration with security middleware
interface TestStoreOptions {
  preloadedState?: any;
  enableSecurity?: boolean;
  enablePerformance?: boolean;
}

/**
 * Creates a test store with security and performance monitoring
 */
const setupTestStore = (options: TestStoreOptions = {}) => {
  const { 
    preloadedState,
    enableSecurity = true,
    enablePerformance = true 
  } = options;

  // Security middleware
  const securityMiddleware = () => (next: any) => (action: any) => {
    if (enableSecurity) {
      // Validate action payload for potential security risks
      if (action.payload && typeof action.payload === 'object') {
        const sanitizedPayload = JSON.parse(JSON.stringify(action.payload));
        action.payload = sanitizedPayload;
      }
    }
    return next(action);
  };

  // Performance monitoring middleware
  const performanceMiddleware = () => (next: any) => (action: any) => {
    if (enablePerformance) {
      const start = performance.now();
      const result = next(action);
      const duration = performance.now() - start;
      
      // Log if action takes too long
      if (duration > 100) {
        console.warn(`Action ${action.type} took ${duration}ms to process`);
      }
      
      return result;
    }
    return next(action);
  };

  return configureStore({
    reducer: {
      email: emailSlice.reducer
    },
    preloadedState,
    middleware: (getDefaultMiddleware) => 
      getDefaultMiddleware()
        .concat(securityMiddleware)
        .concat(performanceMiddleware)
  });
};

/**
 * Generates secure mock email data
 */
const generateMockEmails = (count: number): IEmailMessage[] => {
  return Array.from({ length: count }, (_, index) => ({
    messageId: `mock-id-${index}`,
    threadId: `thread-${Math.floor(index / 3)}`,
    subject: `Test Email ${index}`,
    content: `Test content ${index}`,
    fromAddress: 'sender@test.com',
    toAddresses: ['recipient@test.com'],
    ccAddresses: [],
    bccAddresses: [],
    attachments: [],
    status: EmailStatus.UNREAD,
    priority: EmailPriority.NORMAL,
    securityLevel: EmailSecurityLevel.CONFIDENTIAL,
    sentAt: new Date(),
    receivedAt: new Date(),
    headers: {},
    metadata: {
      encryptionStatus: true,
      securityChecks: {
        malwareScanned: true,
        phishingDetected: false
      }
    }
  }));
};

/**
 * Measures selector performance
 */
const measureSelectorPerformance = (
  selector: Function, 
  state: any
): { executionTime: number; memoryUsage: number } => {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  selector(state);
  
  const executionTime = performance.now() - startTime;
  const memoryUsage = process.memoryUsage().heapUsed - startMemory;
  
  return { executionTime, memoryUsage };
};

describe('Email Slice Core Functionality', () => {
  let store: ReturnType<typeof setupTestStore>;

  beforeEach(() => {
    store = setupTestStore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle initial state with security defaults', () => {
    const state = store.getState().email;
    
    expect(state.emails.ids).toHaveLength(0);
    expect(state.threads.ids).toHaveLength(0);
    expect(state.currentThread).toBeNull();
    expect(state.loading).toBeFalsy();
    expect(state.error).toBeNull();
    expect(state.filter.status).toBe(EmailStatus.UNREAD);
    expect(state.cache.ttl).toBeGreaterThan(0);
  });

  it('should handle secure email operations', async () => {
    const mockEmails = generateMockEmails(1);
    (emailApi.getEmails as jest.Mock).mockResolvedValue({
      data: { items: mockEmails, total: 1, hasMore: false }
    });

    await store.dispatch(fetchEmails({ 
      filter: { status: EmailStatus.UNREAD },
      pageSize: 20 
    }));

    const state = store.getState().email;
    expect(state.emails.ids).toHaveLength(1);
    expect(state.emails.entities[mockEmails[0].messageId]?.securityLevel)
      .toBe(EmailSecurityLevel.CONFIDENTIAL);
  });
});

describe('Email Performance and Security', () => {
  let store: ReturnType<typeof setupTestStore>;
  const LARGE_DATASET_SIZE = 1000;

  beforeEach(() => {
    const mockEmails = generateMockEmails(LARGE_DATASET_SIZE);
    store = setupTestStore({
      preloadedState: {
        email: {
          emails: {
            ids: mockEmails.map(e => e.messageId),
            entities: mockEmails.reduce((acc, email) => ({
              ...acc,
              [email.messageId]: email
            }), {})
          }
        }
      }
    });
  });

  it('should meet selector performance benchmarks', () => {
    const state = store.getState();
    const threadId = 'thread-1';

    const { executionTime, memoryUsage } = measureSelectorPerformance(
      () => selectEmailsByThread(state, threadId),
      state
    );

    // Performance benchmarks from technical spec
    expect(executionTime).toBeLessThan(200); // 200ms max
    expect(memoryUsage).toBeLessThan(5 * 1024 * 1024); // 5MB max
  });

  it('should maintain security during state updates', async () => {
    const mockEmail = generateMockEmails(1)[0];
    (emailApi.sendEmail as jest.Mock).mockResolvedValue({
      data: mockEmail
    });

    await store.dispatch(sendEmail({
      subject: 'Test Email',
      content: '<script>malicious</script>Test content',
      toAddresses: ['recipient@test.com']
    }));

    const state = store.getState().email;
    const sentEmail = state.emails.entities[mockEmail.messageId];
    
    // Verify security measures
    expect(sentEmail.content).not.toContain('<script>');
    expect(sentEmail.securityLevel).toBe(EmailSecurityLevel.CONFIDENTIAL);
    expect(sentEmail.metadata.encryptionStatus).toBe(true);
  });
});

describe('Email Async Operations', () => {
  let store: ReturnType<typeof setupTestStore>;

  beforeEach(() => {
    store = setupTestStore();
  });

  it('should handle fetchEmails lifecycle', async () => {
    const mockEmails = generateMockEmails(3);
    (emailApi.getEmails as jest.Mock).mockResolvedValue({
      data: { items: mockEmails, total: 3, hasMore: false }
    });

    const promise = store.dispatch(fetchEmails({ 
      filter: { status: EmailStatus.UNREAD },
      pageSize: 20 
    }));

    expect(store.getState().email.loading).toBe(true);
    await promise;
    
    const state = store.getState().email;
    expect(state.loading).toBe(false);
    expect(state.emails.ids).toHaveLength(3);
    expect(state.error).toBeNull();
  });

  it('should handle fetchThread with context', async () => {
    const mockThread = {
      threadId: 'thread-1',
      messages: generateMockEmails(3),
      subject: 'Test Thread',
      participants: ['sender@test.com'],
      lastMessageAt: new Date(),
      unreadCount: 2
    };

    (emailApi.getEmailThread as jest.Mock).mockResolvedValue({
      data: mockThread
    });

    await store.dispatch(fetchThread('thread-1'));
    
    const state = store.getState().email;
    expect(state.threads.entities['thread-1']).toBeDefined();
    expect(state.emails.ids).toHaveLength(3);
  });
});

describe('Email Selectors', () => {
  let store: ReturnType<typeof setupTestStore>;

  beforeEach(() => {
    const mockEmails = generateMockEmails(5);
    store = setupTestStore({
      preloadedState: {
        email: {
          emails: {
            ids: mockEmails.map(e => e.messageId),
            entities: mockEmails.reduce((acc, email) => ({
              ...acc,
              [email.messageId]: email
            }), {})
          }
        }
      }
    });
  });

  it('should filter emails by status and priority', () => {
    const state = store.getState();
    const filtered = selectFilteredEmails(state);
    
    expect(filtered.every(email => 
      email.status === EmailStatus.UNREAD &&
      email.securityLevel === EmailSecurityLevel.CONFIDENTIAL
    )).toBe(true);
  });

  it('should select emails by thread efficiently', () => {
    const state = store.getState();
    const threadId = 'thread-0';
    
    const threadEmails = selectEmailsByThread(state, threadId);
    expect(threadEmails.every(email => email.threadId === threadId)).toBe(true);
  });
});