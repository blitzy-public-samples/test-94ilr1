// @ts-check
import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0 - For generating unique notification IDs
import { ApiError } from '../types/api.types';

// Constants for notification configuration
export const DEFAULT_DURATION = 5000;
export const ERROR_DURATION = 7000;
export const MAX_NOTIFICATIONS = 5;
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

// Type definitions for notifications
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export interface NotificationAction {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}

export interface NotificationPayload {
  type: NotificationType;
  message: string;
  duration?: number | null;
  priority?: number;
  dismissible?: boolean;
  actions?: NotificationAction[];
  ariaLive?: 'polite' | 'assertive';
}

export interface Notification extends Required<NotificationPayload> {
  id: string;
  createdAt: number;
  timeoutId?: number;
}

// State interface
interface NotificationState {
  notifications: Notification[];
  history: string[]; // Keep track of notification IDs for cleanup
}

// Initial state
const initialState: NotificationState = {
  notifications: [],
  history: [],
};

// Create the notification slice
export const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    showNotification: {
      reducer: (state, action: PayloadAction<Notification>) => {
        // Remove oldest notification if limit reached
        if (state.notifications.length >= MAX_NOTIFICATIONS) {
          const oldestNotification = state.notifications[0];
          if (oldestNotification.timeoutId) {
            window.clearTimeout(oldestNotification.timeoutId);
          }
          state.notifications.shift();
        }

        // Add new notification with priority ordering
        const insertIndex = state.notifications.findIndex(
          (n) => n.priority < action.payload.priority
        );
        if (insertIndex === -1) {
          state.notifications.push(action.payload);
        } else {
          state.notifications.splice(insertIndex, 0, action.payload);
        }

        // Update history
        state.history = [...state.history, action.payload.id].slice(-MAX_NOTIFICATIONS);
      },
      prepare: (payload: NotificationPayload) => {
        const id = uuidv4();
        return {
          payload: {
            id,
            type: payload.type,
            message: payload.message,
            duration: payload.duration ?? 
              (payload.type === NOTIFICATION_TYPES.ERROR ? ERROR_DURATION : DEFAULT_DURATION),
            priority: payload.priority ?? 1,
            dismissible: payload.dismissible ?? true,
            actions: payload.actions ?? [],
            ariaLive: payload.ariaLive ?? 
              (payload.type === NOTIFICATION_TYPES.ERROR ? 'assertive' : 'polite'),
            createdAt: Date.now(),
            timeoutId: payload.duration !== null
              ? window.setTimeout(() => {
                  notificationSlice.actions.hideNotification(id);
                }, payload.duration ?? DEFAULT_DURATION)
              : undefined,
          },
        };
      },
    },

    hideNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification?.timeoutId) {
        window.clearTimeout(notification.timeoutId);
      }
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },

    updateNotification: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<NotificationPayload> }>
    ) => {
      const index = state.notifications.findIndex((n) => n.id === action.payload.id);
      if (index !== -1) {
        const notification = state.notifications[index];
        
        // Clear existing timeout if duration is being updated
        if (action.payload.updates.duration !== undefined && notification.timeoutId) {
          window.clearTimeout(notification.timeoutId);
        }

        // Create new timeout if needed
        const newTimeoutId = action.payload.updates.duration !== null
          ? window.setTimeout(() => {
              notificationSlice.actions.hideNotification(notification.id);
            }, action.payload.updates.duration ?? DEFAULT_DURATION)
          : undefined;

        state.notifications[index] = {
          ...notification,
          ...action.payload.updates,
          timeoutId: newTimeoutId,
        };
      }
    },

    clearAllNotifications: (state) => {
      state.notifications.forEach((notification) => {
        if (notification.timeoutId) {
          window.clearTimeout(notification.timeoutId);
        }
      });
      state.notifications = [];
      state.history = [];
    },
  },
});

// Selectors
export const selectNotifications = (state: { notification: NotificationState }) =>
  state.notification.notifications;

export const selectNotificationsByType = (
  state: { notification: NotificationState },
  type: NotificationType
) => state.notification.notifications.filter((n) => n.type === type);

export const selectActiveNotifications = (state: { notification: NotificationState }) =>
  state.notification.notifications.filter((n) => n.duration !== null);

// Action creators
export const { showNotification, hideNotification, updateNotification, clearAllNotifications } =
  notificationSlice.actions;

// Utility function for creating error notifications from API errors
export const createErrorNotification = (error: ApiError): NotificationPayload => ({
  type: NOTIFICATION_TYPES.ERROR,
  message: error.message,
  duration: ERROR_DURATION,
  priority: 2, // Higher priority for errors
  dismissible: true,
  ariaLive: 'assertive',
  actions: [
    {
      label: 'Dismiss',
      onClick: () => {},
      ariaLabel: 'Dismiss error notification',
    },
  ],
});

export default notificationSlice.reducer;