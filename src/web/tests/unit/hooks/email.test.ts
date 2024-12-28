/**
 * @fileoverview Unit tests for useEmail hook
 * Tests email operations, state management, and Redux interactions
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { waitFor } from '@testing-library/react'; // ^13.4.0

import { useEmail } from '../../src/hooks/useEmail';
import { emailActions } from '../../src/store/email.slice';
import { IEmailMessage, EmailStatus, EmailPriority } from '../../src/types/email.types';

// Mock data for testing
const mockEmailData: IEmailMessage[] = [
  {
    messageId: '1',
    threadId: 'thread-1',
    accountId: 'account-1',
    subject: 'Test Email 1',
    content: 'Test content 1',
    fromAddress: 'sender@test.com',
    toAddresses: ['recipient@test.com'],
    ccAddresses: [],
    bccAddresses: [],
    attachments: [],
    priority: EmailPriority.NORMAL,
    status: EmailStatus.UNREAD,
    sentAt: new Date('2023-01-01T10:00:00Z'),
    receivedAt: new Date('2023-01-01T10:01:00Z'),
    headers: {},
    metadata: {}
  },
  {
    messageId: '2',
    threadId: 'thread-1',
    accountId: 'account-1',
    subject: 'Test Email 2',
    content: 'Test content 2',
    fromAddress: 'sender@test.com',
    toAddresses: ['recipient@test.com'],
    ccAddresses: [],
    bccAddresses: [],
    attachments: [],
    priority: EmailPriority.HIGH,
    status: EmailStatus.READ,
    sentAt: new Date('2023-01-01T11:00:00Z'),
    receivedAt: new Date('2023-01-01T11:01:00Z'),
    headers: {},
    metadata: {}
  }
];

// Mock Redux store
const createMockStore = () => {
  return configureStore({
    reducer: {
      email: (state = {
        emails: {
          ids: [],
          entities: {},
          loading: false,
          error: null,
          currentEmail: null,
          currentThread: null,
          lastRefreshTime: null
        }
      }, action) => state
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware()
  });
};

describe('useEmail hook', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useEmail(), { wrapper });

    expect(result.current.emails).toEqual([]);
    expect(result.current.currentEmail).toBeNull();
    expect(result.current.currentThread).toBeNull();
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
  });

  it('should fetch emails successfully', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Mock successful API response
    jest.spyOn(emailActions, 'fetchEmails').mockImplementation(() => ({
      type: 'email/fetchEmails/fulfilled',
      payload: { items: mockEmailData, total: 2, hasMore: false }
    }));

    const { result } = renderHook(() => useEmail(), { wrapper });

    await act(async () => {
      await result.current.fetchEmails();
    });

    expect(emailActions.fetchEmails).toHaveBeenCalled();
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
  });

  it('should handle email fetch errors with retry', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Mock API error
    const mockError = new Error('API Error');
    jest.spyOn(emailActions, 'fetchEmails').mockRejectedValue(mockError);

    const { result } = renderHook(() => useEmail({ errorRetryCount: 2 }), { wrapper });

    await act(async () => {
      await result.current.fetchEmails();
    });

    // Wait for retries
    await waitFor(() => {
      expect(emailActions.fetchEmails).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should manage auto-refresh correctly', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Mock successful API response
    jest.spyOn(emailActions, 'fetchEmails').mockImplementation(() => ({
      type: 'email/fetchEmails/fulfilled',
      payload: { items: mockEmailData, total: 2, hasMore: false }
    }));

    const refreshInterval = 5000; // 5 seconds
    const { result, unmount } = renderHook(
      () => useEmail({ autoRefresh: true, refreshInterval }),
      { wrapper }
    );

    // Initial fetch
    expect(emailActions.fetchEmails).toHaveBeenCalledTimes(1);

    // Advance timers
    act(() => {
      jest.advanceTimersByTime(refreshInterval);
    });

    // Should trigger refresh
    expect(emailActions.fetchEmails).toHaveBeenCalledTimes(2);

    // Cleanup on unmount
    unmount();
    act(() => {
      jest.advanceTimersByTime(refreshInterval);
    });

    // Should not trigger after unmount
    expect(emailActions.fetchEmails).toHaveBeenCalledTimes(2);
  });

  it('should fetch email thread successfully', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const threadId = 'thread-1';
    jest.spyOn(emailActions, 'fetchThreadById').mockImplementation(() => ({
      type: 'email/fetchThread/fulfilled',
      payload: {
        threadId,
        messages: mockEmailData,
        subject: 'Test Thread',
        participants: ['sender@test.com', 'recipient@test.com'],
        lastMessageAt: new Date(),
        unreadCount: 1
      }
    }));

    const { result } = renderHook(() => useEmail(), { wrapper });

    await act(async () => {
      await result.current.fetchThreadById(threadId);
    });

    expect(emailActions.fetchThreadById).toHaveBeenCalledWith(threadId);
    expect(result.current.error).toBeNull();
  });

  it('should clear error state', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useEmail(), { wrapper });

    // Set error state
    mockStore.dispatch({
      type: 'email/fetchEmails/rejected',
      payload: 'Test error'
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});