/**
 * Context Management Redux Toolkit Slice
 * Version: 1.0.0
 * 
 * Manages email context state with features:
 * - Optimistic updates
 * - Caching with TTL
 * - Granular loading states
 * - Comprehensive error handling
 * - Batch operations support
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // ^1.9.0
import { Context, validateContext } from '../types/context.types';
import { contextApi } from '../api/context.api';

// Types for the slice state
interface ContextState {
  contexts: Record<string, Context>;
  activeContextId: string | null;
  loading: {
    fetch: boolean;
    analyze: boolean;
    update: boolean;
    batch: boolean;
  };
  error: {
    type: string | null;
    message: string | null;
    details: Record<string, any> | null;
  };
  cache: {
    ttl: number;
    items: Record<string, {
      data: Context;
      timestamp: number;
    }>;
  };
}

// Initial state
const initialState: ContextState = {
  contexts: {},
  activeContextId: null,
  loading: {
    fetch: false,
    analyze: false,
    update: false,
    batch: false
  },
  error: {
    type: null,
    message: null,
    details: null
  },
  cache: {
    ttl: 300000, // 5 minutes
    items: {}
  }
};

/**
 * Async thunk for fetching context by ID with caching
 */
export const fetchContextById = createAsyncThunk(
  'context/fetchById',
  async (contextId: string, { rejectWithValue, getState }) => {
    try {
      // Check cache first
      const state = getState() as { context: ContextState };
      const cachedItem = state.context.cache.items[contextId];
      const now = Date.now();

      if (cachedItem && (now - cachedItem.timestamp) < state.context.cache.ttl) {
        return cachedItem.data;
      }

      const context = await contextApi.getContextById(contextId);
      
      if (!validateContext(context)) {
        throw new Error('Invalid context data received');
      }

      return context;
    } catch (error: any) {
      return rejectWithValue({
        type: 'FETCH_ERROR',
        message: error.message,
        details: error.details
      });
    }
  }
);

/**
 * Async thunk for batch updating multiple contexts
 */
export const batchUpdateContexts = createAsyncThunk(
  'context/batchUpdate',
  async (contexts: Context[], { rejectWithValue, dispatch }) => {
    try {
      // Validate all contexts before proceeding
      if (!contexts.every(validateContext)) {
        throw new Error('Invalid context data in batch update');
      }

      // Optimistically update local state
      contexts.forEach(context => {
        dispatch(contextSlice.actions.updateContextLocally(context));
      });

      const updatedContexts = await contextApi.batchUpdateContexts(contexts);
      return updatedContexts;
    } catch (error: any) {
      return rejectWithValue({
        type: 'BATCH_UPDATE_ERROR',
        message: error.message,
        details: error.details
      });
    }
  }
);

/**
 * Context management slice
 */
const contextSlice = createSlice({
  name: 'context',
  initialState,
  reducers: {
    setActiveContext: (state, action) => {
      state.activeContextId = action.payload;
    },
    updateContextLocally: (state, action) => {
      const context = action.payload;
      state.contexts[context.contextId] = context;
    },
    clearError: (state) => {
      state.error = {
        type: null,
        message: null,
        details: null
      };
    },
    invalidateCache: (state, action) => {
      const contextId = action.payload;
      delete state.cache.items[contextId];
    },
    clearAllCache: (state) => {
      state.cache.items = {};
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchContextById reducers
      .addCase(fetchContextById.pending, (state) => {
        state.loading.fetch = true;
        state.error = initialState.error;
      })
      .addCase(fetchContextById.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.contexts[action.payload.contextId] = action.payload;
        state.cache.items[action.payload.contextId] = {
          data: action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchContextById.rejected, (state, action) => {
        state.loading.fetch = false;
        state.error = action.payload as typeof initialState.error;
      })
      // batchUpdateContexts reducers
      .addCase(batchUpdateContexts.pending, (state) => {
        state.loading.batch = true;
        state.error = initialState.error;
      })
      .addCase(batchUpdateContexts.fulfilled, (state, action) => {
        state.loading.batch = false;
        action.payload.forEach(context => {
          state.contexts[context.contextId] = context;
          state.cache.items[context.contextId] = {
            data: context,
            timestamp: Date.now()
          };
        });
      })
      .addCase(batchUpdateContexts.rejected, (state, action) => {
        state.loading.batch = false;
        state.error = action.payload as typeof initialState.error;
      });
  }
});

// Selectors
export const selectContextById = createSelector(
  [(state: { context: ContextState }) => state.context.contexts, 
   (_, contextId: string) => contextId],
  (contexts, contextId) => contexts[contextId]
);

export const selectContextLoadingState = createSelector(
  [(state: { context: ContextState }) => state.context.loading],
  (loading) => loading
);

export const selectContextError = createSelector(
  [(state: { context: ContextState }) => state.context.error],
  (error) => error
);

export const selectCachedContext = createSelector(
  [(state: { context: ContextState }) => state.context.cache.items,
   (_, contextId: string) => contextId],
  (cacheItems, contextId) => cacheItems[contextId]
);

// Export actions and reducer
export const { 
  setActiveContext, 
  updateContextLocally, 
  clearError, 
  invalidateCache, 
  clearAllCache 
} = contextSlice.actions;

export default contextSlice.reducer;