/**
 * @fileoverview Redux Toolkit slice for email state management
 * Implements normalized state, real-time updates, and caching
 * @version 1.0.0
 */

import { 
  createSlice, 
  createAsyncThunk, 
  createEntityAdapter,
  createSelector,
  PayloadAction
} from '@reduxjs/toolkit'; // ^1.9.0

import { 
  IEmailMessage, 
  IEmailThread, 
  EmailFilter, 
  EmailStatus,
  EmailPriority
} from '../types/email.types';

import { emailApi } from '../api/email.api';

// Entity adapters for normalized state management
const emailAdapter = createEntityAdapter<IEmailMessage>({
  selectId: (email) => email.messageId,
  sortComparer: (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
});

const threadAdapter = createEntityAdapter<IEmailThread>({
  selectId: (thread) => thread.threadId,
  sortComparer: (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
});

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// Initial state with comprehensive structure
interface EmailState {
  emails: ReturnType<typeof emailAdapter.getInitialState>;
  threads: ReturnType<typeof threadAdapter.getInitialState>;
  currentThread: string | null;
  loading: boolean;
  error: string | null;
  filter: EmailFilter;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    cursor: string | null;
  };
  offline: {
    queue: Array<{ type: string; payload: any }>;
    lastSync: number | null;
  };
  cache: {
    ttl: number;
    lastInvalidated: number | null;
  };
}

const initialState: EmailState = {
  emails: emailAdapter.getInitialState(),
  threads: threadAdapter.getInitialState(),
  currentThread: null,
  loading: false,
  error: null,
  filter: {
    status: EmailStatus.UNREAD,
    priority: EmailPriority.NORMAL,
    fromDate: null,
    toDate: null,
    searchTerm: '',
    labels: []
  },
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    cursor: null
  },
  offline: {
    queue: [],
    lastSync: null
  },
  cache: {
    ttl: CACHE_TTL,
    lastInvalidated: null
  }
};

// Async thunks with enhanced error handling and caching
export const fetchEmails = createAsyncThunk(
  'email/fetchEmails',
  async ({ filter, cursor, pageSize }: { 
    filter: EmailFilter; 
    cursor?: string | null; 
    pageSize: number 
  }, { rejectWithValue }) => {
    try {
      const response = await emailApi.getEmails(filter, 1, pageSize, true);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchThread = createAsyncThunk(
  'email/fetchThread',
  async (threadId: string, { rejectWithValue }) => {
    try {
      const response = await emailApi.getEmailThread(threadId, true);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const sendEmail = createAsyncThunk(
  'email/sendEmail',
  async (email: Partial<IEmailMessage>, { rejectWithValue }) => {
    try {
      const response = await emailApi.sendEmail(email);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateEmailStatus = createAsyncThunk(
  'email/updateStatus',
  async ({ messageId, status }: { messageId: string; status: EmailStatus }, 
    { rejectWithValue }) => {
    try {
      const response = await emailApi.updateEmailStatus(messageId, status);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Email slice with comprehensive state management
export const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<EmailFilter>) => {
      state.filter = action.payload;
      state.pagination.cursor = null;
      state.pagination.page = 1;
    },
    invalidateCache: (state) => {
      state.cache.lastInvalidated = Date.now();
    },
    addOfflineAction: (state, action: PayloadAction<{ type: string; payload: any }>) => {
      state.offline.queue.push(action.payload);
    },
    clearOfflineQueue: (state) => {
      state.offline.queue = [];
      state.offline.lastSync = Date.now();
    },
    setCurrentThread: (state, action: PayloadAction<string>) => {
      state.currentThread = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch emails reducers
      .addCase(fetchEmails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmails.fulfilled, (state, action) => {
        state.loading = false;
        emailAdapter.upsertMany(state.emails, action.payload.items);
        state.pagination = {
          ...state.pagination,
          total: action.payload.total,
          hasMore: action.payload.hasMore,
          cursor: action.payload.cursor
        };
      })
      .addCase(fetchEmails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch thread reducers
      .addCase(fetchThread.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.loading = false;
        threadAdapter.upsertOne(state.threads, action.payload);
        emailAdapter.upsertMany(state.emails, action.payload.messages);
      })
      .addCase(fetchThread.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Send email reducers with optimistic updates
      .addCase(sendEmail.pending, (state, action) => {
        const optimisticEmail = {
          ...action.meta.arg,
          messageId: `temp-${Date.now()}`,
          status: EmailStatus.UNREAD,
          sentAt: new Date(),
          receivedAt: new Date()
        } as IEmailMessage;
        emailAdapter.addOne(state.emails, optimisticEmail);
      })
      .addCase(sendEmail.fulfilled, (state, action) => {
        const tempId = `temp-${Date.now()}`;
        emailAdapter.removeOne(state.emails, tempId);
        emailAdapter.addOne(state.emails, action.payload);
      })
      .addCase(sendEmail.rejected, (state, action) => {
        const tempId = `temp-${Date.now()}`;
        emailAdapter.removeOne(state.emails, tempId);
        state.error = action.payload as string;
      });
  }
});

// Export actions
export const { 
  setFilter, 
  invalidateCache, 
  addOfflineAction, 
  clearOfflineQueue,
  setCurrentThread 
} = emailSlice.actions;

// Memoized selectors with type safety
export const {
  selectAll: selectAllEmails,
  selectById: selectEmailById,
  selectIds: selectEmailIds
} = emailAdapter.getSelectors((state: { email: EmailState }) => state.email.emails);

export const {
  selectAll: selectAllThreads,
  selectById: selectThreadById
} = threadAdapter.getSelectors((state: { email: EmailState }) => state.email.threads);

// Custom selectors
export const selectEmailsByThread = createSelector(
  [selectAllEmails, (state: { email: EmailState }, threadId: string) => threadId],
  (emails, threadId) => emails.filter(email => email.threadId === threadId)
);

export const selectFilteredEmails = createSelector(
  [selectAllEmails, (state: { email: EmailState }) => state.email.filter],
  (emails, filter) => {
    return emails.filter(email => {
      if (filter.status !== undefined && email.status !== filter.status) return false;
      if (filter.priority !== undefined && email.priority !== filter.priority) return false;
      if (filter.searchTerm && !email.subject.toLowerCase().includes(filter.searchTerm.toLowerCase())) return false;
      if (filter.fromDate && email.receivedAt < filter.fromDate) return false;
      if (filter.toDate && email.receivedAt > filter.toDate) return false;
      return true;
    });
  }
);

export default emailSlice.reducer;