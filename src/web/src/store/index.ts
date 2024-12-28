/**
 * Root Redux Store Configuration
 * Version: 1.0.0
 * 
 * Configures the Redux store with:
 * - Enhanced middleware setup
 * - Performance monitoring
 * - Error handling
 * - Real-time updates
 * - Type-safe store configuration
 */

// External dependencies
import { 
  configureStore, 
  combineReducers,
  Middleware,
  isRejectedWithValue,
  MiddlewareAPI,
  Dispatch,
  AnyAction
} from '@reduxjs/toolkit'; // ^1.9.7

// Feature reducers
import authReducer from './auth.slice';
import emailReducer from './email.slice';
import contextReducer from './context.slice';
import responseReducer from './response.slice';

// Error monitoring middleware
const errorMonitoringMiddleware: Middleware =
  (api: MiddlewareAPI) => (next: Dispatch) => (action: AnyAction) => {
    // Monitor rejected actions
    if (isRejectedWithValue(action)) {
      console.error('Action Error:', {
        type: action.type,
        payload: action.payload,
        meta: action.meta,
        timestamp: new Date().toISOString()
      });
    }
    return next(action);
  };

// Performance monitoring middleware
const performanceMiddleware: Middleware =
  (api: MiddlewareAPI) => (next: Dispatch) => (action: AnyAction) => {
    const startTime = performance.now();
    const result = next(action);
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Log slow actions (> 100ms)
    if (duration > 100) {
      console.warn('Slow Action:', {
        type: action.type,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  };

// Real-time update middleware
const realTimeMiddleware: Middleware =
  (api: MiddlewareAPI) => (next: Dispatch) => (action: AnyAction) => {
    const result = next(action);

    // Handle real-time updates for specific actions
    if (action.type.startsWith('email/') || action.type.startsWith('context/')) {
      // Dispatch updates to real-time listeners
      window.dispatchEvent(new CustomEvent('storeUpdate', {
        detail: {
          type: action.type,
          payload: action.payload,
          timestamp: Date.now()
        }
      }));
    }

    return result;
  };

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  email: emailReducer,
  context: contextReducer,
  response: responseReducer
});

// Configure store with enhanced middleware
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      // Ignore these action types in serializability check
      ignoredActions: [
        'auth/login/fulfilled',
        'email/sendEmail/pending'
      ],
      // Ignore these paths in state serialization check
      ignoredPaths: ['auth.user.lastLogin', 'email.pagination.cursor']
    },
    thunk: {
      extraArgument: {
        env: process.env.NODE_ENV
      }
    }
  }).concat([
    errorMonitoringMiddleware,
    performanceMiddleware,
    realTimeMiddleware
  ]),
  devTools: process.env.NODE_ENV !== 'production' && {
    name: 'AI Email Management Platform',
    trace: true,
    traceLimit: 25
  }
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type-safe hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store instance
export default store;

/**
 * Type definitions for type-safe store usage
 */
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

/**
 * Type-safe dispatch hook
 * @returns Typed dispatch function
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Type-safe selector hook
 * Use this hook instead of plain `useSelector`
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;