/**
 * Enhanced Context Management Hook
 * Version: 1.0.0
 * 
 * Provides a comprehensive interface for components to interact with context data,
 * project relationships, and analysis results with built-in caching, error handling,
 * and performance optimizations.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import type { AppDispatch } from '../store/store';

import {
  Context,
  ProjectContext,
  RelationshipContext,
  validateContext
} from '../types/context.types';

import {
  fetchContextById,
  batchUpdateContexts,
  setActiveContext,
  updateContextLocally,
  clearError,
  invalidateCache,
  selectContextById,
  selectContextLoadingState,
  selectContextError,
  selectCachedContext
} from '../store/context.slice';

/**
 * Cache configuration options
 */
interface CacheConfig {
  enabled: boolean;
  ttl: number;
  invalidateOnUpdate: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 300000, // 5 minutes
  invalidateOnUpdate: true
};

/**
 * Operation options interface
 */
interface OperationOptions {
  skipCache?: boolean;
  optimisticUpdate?: boolean;
  retryAttempts?: number;
}

/**
 * Loading states for different operations
 */
interface LoadingState {
  fetch: boolean;
  update: boolean;
  analyze: boolean;
  batch: boolean;
}

/**
 * Enhanced context hook result interface
 */
interface UseContextResult {
  // State
  context: Context | null;
  loading: LoadingState;
  error: Error | null;
  
  // Operations
  fetchContext: (contextId: string, options?: OperationOptions) => Promise<void>;
  fetchContextByEmail: (emailId: string, options?: OperationOptions) => Promise<void>;
  updateContext: (contextData: Partial<Context>, options?: OperationOptions) => Promise<void>;
  batchUpdate: (contexts: Context[]) => Promise<void>;
  
  // Cache management
  invalidateCache: (contextId?: string) => void;
  clearCache: () => void;
  
  // Utility functions
  isContextValid: (context: unknown) => context is Context;
  getProjectContext: (projectId: string) => ProjectContext | undefined;
  getRelationshipContext: (contactId: string) => RelationshipContext | undefined;
}

/**
 * Enhanced context management hook with caching and error handling
 */
export const useContext = (cacheConfig: Partial<CacheConfig> = {}): UseContextResult => {
  const dispatch = useDispatch<AppDispatch>();
  const mountedRef = useRef(true);
  const pendingOperations = useRef(new Set<string>());

  // Merge cache configuration with defaults
  const config = useMemo(
    () => ({ ...DEFAULT_CACHE_CONFIG, ...cacheConfig }),
    [cacheConfig]
  );

  // Select state from Redux store
  const context = useSelector(selectContextById);
  const loading = useSelector(selectContextLoadingState);
  const error = useSelector(selectContextError);
  const cachedContext = useSelector(selectCachedContext);

  /**
   * Fetches context by ID with caching support
   */
  const fetchContext = useCallback(async (
    contextId: string,
    options: OperationOptions = {}
  ): Promise<void> => {
    try {
      if (!contextId) {
        throw new Error('Context ID is required');
      }

      const operationKey = `fetch_${contextId}`;
      if (pendingOperations.current.has(operationKey)) {
        return;
      }

      pendingOperations.current.add(operationKey);

      // Check cache if enabled and not skipped
      if (config.enabled && !options.skipCache && cachedContext) {
        const cacheAge = Date.now() - cachedContext.timestamp;
        if (cacheAge < config.ttl) {
          dispatch(updateContextLocally(cachedContext.data));
          return;
        }
      }

      const result = await dispatch(fetchContextById(contextId)).unwrap();
      
      if (mountedRef.current) {
        dispatch(setActiveContext(contextId));
      }
    } catch (err) {
      console.error('Error fetching context:', err);
      throw err;
    } finally {
      pendingOperations.current.delete(`fetch_${contextId}`);
    }
  }, [dispatch, config, cachedContext]);

  /**
   * Fetches context by email ID with optimistic updates
   */
  const fetchContextByEmail = useCallback(async (
    emailId: string,
    options: OperationOptions = {}
  ): Promise<void> => {
    try {
      if (!emailId) {
        throw new Error('Email ID is required');
      }

      const operationKey = `fetch_email_${emailId}`;
      if (pendingOperations.current.has(operationKey)) {
        return;
      }

      pendingOperations.current.add(operationKey);

      // Optimistic update if enabled
      if (options.optimisticUpdate && context) {
        dispatch(updateContextLocally({
          ...context,
          emailId,
          analyzedAt: new Date()
        }));
      }

      // Implement actual fetch logic here
      // This would typically call an API endpoint

    } catch (err) {
      console.error('Error fetching context by email:', err);
      throw err;
    } finally {
      pendingOperations.current.delete(`fetch_email_${emailId}`);
    }
  }, [dispatch, context]);

  /**
   * Updates context with optimistic updates and rollback support
   */
  const updateContext = useCallback(async (
    contextData: Partial<Context>,
    options: OperationOptions = {}
  ): Promise<void> => {
    const previousContext = context;
    try {
      if (!contextData.contextId) {
        throw new Error('Context ID is required for updates');
      }

      const operationKey = `update_${contextData.contextId}`;
      if (pendingOperations.current.has(operationKey)) {
        return;
      }

      pendingOperations.current.add(operationKey);

      // Optimistic update
      if (options.optimisticUpdate && context) {
        dispatch(updateContextLocally({
          ...context,
          ...contextData,
          analyzedAt: new Date()
        }));
      }

      // Dispatch batch update
      await dispatch(batchUpdateContexts([contextData as Context])).unwrap();

      // Invalidate cache if configured
      if (config.invalidateOnUpdate) {
        dispatch(invalidateCache(contextData.contextId));
      }

    } catch (err) {
      // Rollback on error if optimistic update was performed
      if (options.optimisticUpdate && previousContext) {
        dispatch(updateContextLocally(previousContext));
      }
      console.error('Error updating context:', err);
      throw err;
    } finally {
      pendingOperations.current.delete(`update_${contextData.contextId}`);
    }
  }, [dispatch, context, config.invalidateOnUpdate]);

  /**
   * Performs batch update of multiple contexts
   */
  const batchUpdate = useCallback(async (
    contexts: Context[]
  ): Promise<void> => {
    try {
      if (!contexts.length) {
        return;
      }

      // Validate all contexts
      if (!contexts.every(validateContext)) {
        throw new Error('Invalid context data in batch update');
      }

      await dispatch(batchUpdateContexts(contexts)).unwrap();

      // Invalidate cache for all updated contexts
      if (config.invalidateOnUpdate) {
        contexts.forEach(ctx => {
          dispatch(invalidateCache(ctx.contextId));
        });
      }

    } catch (err) {
      console.error('Error performing batch update:', err);
      throw err;
    }
  }, [dispatch, config.invalidateOnUpdate]);

  /**
   * Utility function to get project context by ID
   */
  const getProjectContext = useCallback((
    projectId: string
  ): ProjectContext | undefined => {
    return context?.projectContexts.find(
      project => project.projectId === projectId
    );
  }, [context]);

  /**
   * Utility function to get relationship context by contact ID
   */
  const getRelationshipContext = useCallback((
    contactId: string
  ): RelationshipContext | undefined => {
    return context?.relationshipContexts.find(
      relationship => relationship.contactId === contactId
    );
  }, [context]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      pendingOperations.current.clear();
    };
  }, []);

  return {
    // State
    context,
    loading,
    error,

    // Operations
    fetchContext,
    fetchContextByEmail,
    updateContext,
    batchUpdate,

    // Cache management
    invalidateCache: (contextId?: string) => dispatch(invalidateCache(contextId)),
    clearCache: () => dispatch(clearError()),

    // Utility functions
    isContextValid: validateContext,
    getProjectContext,
    getRelationshipContext
  };
};