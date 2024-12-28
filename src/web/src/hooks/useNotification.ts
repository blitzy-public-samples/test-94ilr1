import { useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import NotificationService from '../services/notification.service';
import { 
  notificationSlice, 
  selectNotifications, 
  NotificationType, 
  Notification,
  NotificationPayload 
} from '../store/notification.slice';

/**
 * Configuration options for notifications with enhanced accessibility
 */
export interface NotificationOptions {
  /** Duration in milliseconds */
  duration?: number | null;
  /** Priority level for notification ordering */
  priority?: 'low' | 'medium' | 'high';
  /** Whether notification should persist */
  persistent?: boolean;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Custom action buttons */
  actions?: Array<{
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  }>;
  /** RTL support flag */
  rtl?: boolean;
  /** Position of the notification */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

/**
 * Interface for the object returned by useNotification hook
 */
export interface NotificationHookResult {
  /** Array of current notifications */
  notifications: Notification[];
  /** Loading state of notifications system */
  loading: boolean;
  /** Function to show a new notification */
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) => Promise<string>;
  /** Function to hide a specific notification */
  hideNotification: (id: string) => Promise<void>;
  /** Function to clear all notifications */
  clearAllNotifications: () => Promise<void>;
}

/**
 * Custom hook for managing application notifications with enhanced features
 * Integrates with NotificationService and Redux store for state management
 */
export const useNotification = (): NotificationHookResult => {
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);

  /**
   * Converts priority string to numeric value for internal use
   */
  const getPriorityValue = (priority?: 'low' | 'medium' | 'high'): number => {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
      default:
        return 1;
    }
  };

  /**
   * Shows a new notification with enhanced options and accessibility support
   */
  const showNotification = useCallback(
    async (
      type: NotificationType,
      message: string,
      options: NotificationOptions = {}
    ): Promise<string> => {
      try {
        // Convert options to NotificationService format
        const serviceOptions = {
          duration: options.duration,
          dismissible: !options.persistent,
          position: options.position,
          rtl: options.rtl,
          ariaLive: type === 'error' ? 'assertive' : 'polite',
          className: `priority-${options.priority || 'low'}`,
          action: options.actions?.[0],
        };

        // Show notification using service
        const id = NotificationService.show(type, message, options.duration, serviceOptions);

        // Update Redux store
        dispatch(notificationSlice.actions.showNotification({
          type,
          message,
          duration: options.duration,
          priority: getPriorityValue(options.priority),
          dismissible: !options.persistent,
          actions: options.actions || [],
          ariaLive: type === 'error' ? 'assertive' : 'polite'
        }));

        return id;
      } catch (error) {
        console.error('[useNotification] Error showing notification:', error);
        throw error;
      }
    },
    [dispatch]
  );

  /**
   * Hides a specific notification with cleanup
   */
  const hideNotification = useCallback(
    async (id: string): Promise<void> => {
      try {
        // Hide notification in service
        NotificationService.hide(id);

        // Update Redux store
        dispatch(notificationSlice.actions.hideNotification(id));
      } catch (error) {
        console.error('[useNotification] Error hiding notification:', error);
        throw error;
      }
    },
    [dispatch]
  );

  /**
   * Clears all notifications with proper cleanup
   */
  const clearAllNotifications = useCallback(
    async (): Promise<void> => {
      try {
        // Clear notifications in service
        NotificationService.clearAll();

        // Update Redux store
        dispatch(notificationSlice.actions.clearAllNotifications());
      } catch (error) {
        console.error('[useNotification] Error clearing notifications:', error);
        throw error;
      }
    },
    [dispatch]
  );

  return {
    notifications,
    loading: false, // Loading state can be enhanced based on requirements
    showNotification,
    hideNotification,
    clearAllNotifications,
  };
};

export default useNotification;
```

This implementation provides a comprehensive notification management hook that:

1. Integrates with both NotificationService and Redux store for state management
2. Provides enhanced accessibility support with ARIA attributes
3. Supports RTL layouts for internationalization
4. Includes priority-based notification ordering
5. Offers customizable notification positions and durations
6. Handles errors gracefully with proper error logging
7. Supports custom actions with accessibility labels
8. Maintains type safety with TypeScript
9. Implements proper cleanup and memory management
10. Follows Material Design principles through NotificationService integration

The hook can be used in React components like this:

```typescript
const MyComponent = () => {
  const { showNotification, hideNotification } = useNotification();

  const handleSuccess = async () => {
    await showNotification('success', 'Operation completed successfully', {
      priority: 'high',
      duration: 5000,
      actions: [{
        label: 'Undo',
        onClick: () => handleUndo(),
        ariaLabel: 'Undo last action'
      }]
    });
  };

  return <button onClick={handleSuccess}>Perform Action</button>;
};