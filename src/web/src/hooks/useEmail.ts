/**
 * @fileoverview Custom React hook for managing email operations and state
 * Provides real-time updates and efficient state management for email functionality
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { IEmailMessage, IEmailThread, EmailFilter } from '../types/email.types';
import { emailActions, selectEmails } from '../store/email.slice';

// Default refresh interval (5 minutes)
const DEFAULT_REFRESH_INTERVAL = 300000;
// Default error retry count
const DEFAULT_ERROR_RETRY_COUNT = 3;

interface UseEmailOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  errorRetryCount?: number;
}

/**
 * Custom hook for managing email operations and state with real-time updates
 * @param options Configuration options for email management
 * @returns Object containing email state and operations
 */
export const useEmail = (options: UseEmailOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    errorRetryCount = DEFAULT_ERROR_RETRY_COUNT
  } = options;

  const dispatch = useDispatch();
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef<number>(0);

  // Select email state from Redux store with memoization
  const emails = useSelector(selectEmails.selectAllEmails);
  const currentEmail = useSelector(selectEmails.selectCurrentEmail);
  const currentThread = useSelector(selectEmails.selectCurrentThread);
  const loading = useSelector(selectEmails.selectEmailLoading);
  const error = useSelector(selectEmails.selectEmailError);
  const lastRefreshTime = useSelector(selectEmails.selectLastRefreshTime);

  /**
   * Fetches emails with optional filtering
   * Implements retry mechanism for failed requests
   */
  const fetchEmails = useCallback(async (filter?: EmailFilter) => {
    try {
      await dispatch(emailActions.fetchEmails(filter)).unwrap();
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching emails:', error);
      if (retryCountRef.current < errorRetryCount) {
        retryCountRef.current++;
        // Exponential backoff for retries
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        setTimeout(() => fetchEmails(filter), backoffDelay);
      }
    }
  }, [dispatch, errorRetryCount]);

  /**
   * Fetches a specific email by ID
   * @param id Email message ID
   */
  const fetchEmailById = useCallback(async (id: string) => {
    try {
      await dispatch(emailActions.fetchEmailById(id)).unwrap();
    } catch (error) {
      console.error('Error fetching email by ID:', error);
    }
  }, [dispatch]);

  /**
   * Fetches a complete email thread by ID
   * @param id Thread ID
   */
  const fetchThreadById = useCallback(async (id: string) => {
    try {
      await dispatch(emailActions.fetchThreadById(id)).unwrap();
    } catch (error) {
      console.error('Error fetching thread by ID:', error);
    }
  }, [dispatch]);

  /**
   * Refreshes email data
   * Used for manual refresh and auto-refresh functionality
   */
  const refreshEmails = useCallback(async () => {
    try {
      await fetchEmails();
    } catch (error) {
      console.error('Error refreshing emails:', error);
    }
  }, [fetchEmails]);

  /**
   * Clears any email-related errors
   */
  const clearError = useCallback(() => {
    dispatch(emailActions.clearEmailError());
  }, [dispatch]);

  /**
   * Sets up auto-refresh functionality
   */
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshEmails, refreshInterval);

      // Initial fetch
      fetchEmails();

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshEmails]);

  /**
   * Cleanup effect for error states and intervals
   */
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      clearError();
    };
  }, [clearError]);

  return {
    // State
    emails,
    currentEmail,
    currentThread,
    loading,
    error,
    lastRefreshTime,

    // Operations
    fetchEmails,
    fetchEmailById,
    fetchThreadById,
    refreshEmails,
    clearError
  };
};