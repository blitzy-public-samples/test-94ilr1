// @ts-check
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0 - Generate unique notification IDs
import { ApiError } from '../types/api.types';

/**
 * Configuration options for notifications
 */
interface NotificationOptions {
  /** Custom CSS classes to apply */
  className?: string;
  /** Position of the notification */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Whether to pause timer on hover */
  pauseOnHover?: boolean;
  /** Whether notification is dismissible */
  dismissible?: boolean;
  /** Custom action button configuration */
  action?: {
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  };
  /** RTL support flag */
  rtl?: boolean;
  /** Animation configuration */
  animation?: {
    enter: string;
    exit: string;
    duration: number;
  };
  /** ARIA live region setting */
  ariaLive?: 'polite' | 'assertive';
}

/**
 * Configuration for a specific notification instance
 */
interface NotificationConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number | null;
  options: NotificationOptions;
  timestamp: number;
}

// Global constants
const DEFAULT_NOTIFICATION_DURATION = 5000;
const ERROR_NOTIFICATION_DURATION = 7000;
const MAX_CONCURRENT_NOTIFICATIONS = 3;
const ANIMATION_DURATION = 300;

/**
 * Singleton service class for managing application notifications with Material Design principles
 */
export class NotificationService {
  private static instance: NotificationService;
  private activeNotifications: Map<string, NodeJS.Timeout>;
  private notificationQueue: NotificationConfig[];
  private maxConcurrentNotifications: number;
  private containerElement: HTMLElement | null;

  private constructor() {
    this.activeNotifications = new Map();
    this.notificationQueue = [];
    this.maxConcurrentNotifications = MAX_CONCURRENT_NOTIFICATIONS;
    this.containerElement = null;
    this.initializeContainer();
  }

  /**
   * Gets the singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initializes the notification container with proper accessibility attributes
   */
  private initializeContainer(): void {
    if (typeof document === 'undefined') return;

    this.containerElement = document.getElementById('notification-container');
    if (!this.containerElement) {
      this.containerElement = document.createElement('div');
      this.containerElement.id = 'notification-container';
      this.containerElement.setAttribute('role', 'alert');
      this.containerElement.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.containerElement);
    }
  }

  /**
   * Generates a unique notification ID
   */
  private generateNotificationId(): string {
    return `notification-${uuidv4()}`;
  }

  /**
   * Shows a notification with comprehensive configuration options
   */
  public show(
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration?: number | null,
    options: NotificationOptions = {}
  ): string {
    const id = this.generateNotificationId();
    const notificationConfig: NotificationConfig = {
      id,
      type,
      message,
      duration: duration ?? (type === 'error' ? ERROR_NOTIFICATION_DURATION : DEFAULT_NOTIFICATION_DURATION),
      options: this.applyDefaultOptions(options, type),
      timestamp: Date.now()
    };

    if (this.activeNotifications.size >= this.maxConcurrentNotifications) {
      this.notificationQueue.push(notificationConfig);
      return id;
    }

    this.renderNotification(notificationConfig);
    return id;
  }

  /**
   * Applies default options based on notification type
   */
  private applyDefaultOptions(options: NotificationOptions, type: string): NotificationOptions {
    return {
      position: 'top-right',
      pauseOnHover: true,
      dismissible: true,
      rtl: document.dir === 'rtl',
      animation: {
        enter: 'notification-enter',
        exit: 'notification-exit',
        duration: ANIMATION_DURATION
      },
      ariaLive: type === 'error' ? 'assertive' : 'polite',
      ...options
    };
  }

  /**
   * Renders a notification to the DOM
   */
  private renderNotification(config: NotificationConfig): void {
    if (!this.containerElement) return;

    const notificationElement = document.createElement('div');
    notificationElement.id = config.id;
    notificationElement.className = `notification notification-${config.type} ${config.options.className || ''}`;
    notificationElement.setAttribute('role', 'alert');
    notificationElement.setAttribute('aria-live', config.options.ariaLive || 'polite');

    if (config.options.rtl) {
      notificationElement.setAttribute('dir', 'rtl');
    }

    // Apply Material Design elevation and shape
    notificationElement.style.cssText = `
      border-radius: 16px;
      padding: 16px;
      margin: 8px;
      box-shadow: 0px 3px 5px -1px rgba(0,0,0,0.2),
                  0px 6px 10px 0px rgba(0,0,0,0.14),
                  0px 1px 18px 0px rgba(0,0,0,0.12);
    `;

    // Create message content
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = config.message;
    notificationElement.appendChild(messageElement);

    // Add action button if configured
    if (config.options.action) {
      const actionButton = document.createElement('button');
      actionButton.className = 'notification-action';
      actionButton.textContent = config.options.action.label;
      actionButton.setAttribute('aria-label', config.options.action.ariaLabel || config.options.action.label);
      actionButton.onclick = config.options.action.onClick;
      notificationElement.appendChild(actionButton);
    }

    // Add dismiss button if dismissible
    if (config.options.dismissible) {
      const dismissButton = document.createElement('button');
      dismissButton.className = 'notification-dismiss';
      dismissButton.setAttribute('aria-label', 'Dismiss notification');
      dismissButton.onclick = () => this.hide(config.id);
      notificationElement.appendChild(dismissButton);
    }

    this.containerElement.appendChild(notificationElement);
    this.applyAnimation(notificationElement, config.options.animation?.enter);

    if (config.duration) {
      const timeout = setTimeout(() => this.hide(config.id), config.duration);
      this.activeNotifications.set(config.id, timeout);
    }
  }

  /**
   * Applies animation to notification element
   */
  private applyAnimation(element: HTMLElement, animationClass?: string): void {
    if (animationClass) {
      element.classList.add(animationClass);
      element.addEventListener('animationend', () => {
        element.classList.remove(animationClass);
      }, { once: true });
    }
  }

  /**
   * Hides a specific notification with cleanup
   */
  public hide(id: string, options: NotificationOptions = {}): void {
    const element = document.getElementById(id);
    if (!element) return;

    const timeout = this.activeNotifications.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.activeNotifications.delete(id);
    }

    this.applyAnimation(element, options.animation?.exit);
    setTimeout(() => {
      element.remove();
      this.processQueue();
    }, options.animation?.duration || ANIMATION_DURATION);
  }

  /**
   * Processes the next notification in queue
   */
  private processQueue(): void {
    if (this.notificationQueue.length === 0) return;
    if (this.activeNotifications.size >= this.maxConcurrentNotifications) return;

    const nextNotification = this.notificationQueue.shift();
    if (nextNotification) {
      this.renderNotification(nextNotification);
    }
  }

  /**
   * Clears all active notifications with proper cleanup
   */
  public clearAll(): void {
    this.activeNotifications.forEach((timeout, id) => {
      clearTimeout(timeout);
      this.hide(id);
    });
    this.activeNotifications.clear();
    this.notificationQueue = [];
  }

  /**
   * Handles API errors with detailed error processing
   */
  public handleApiError(error: ApiError, options: NotificationOptions = {}): void {
    const errorMessage = this.formatErrorMessage(error);
    const errorOptions: NotificationOptions = {
      ...options,
      dismissible: true,
      ariaLive: 'assertive',
      className: 'error-notification',
      action: error.statusCode >= 500 ? {
        label: 'Retry',
        onClick: () => window.location.reload(),
        ariaLabel: 'Retry the failed operation'
      } : undefined
    };

    this.show('error', errorMessage, ERROR_NOTIFICATION_DURATION, errorOptions);
    console.error('[NotificationService]', error);
  }

  /**
   * Formats error message for display
   */
  private formatErrorMessage(error: ApiError): string {
    if (error.statusCode >= 500) {
      return 'An unexpected error occurred. Please try again later.';
    }
    return error.message || 'An error occurred while processing your request.';
  }
}

// Export singleton instance
export default NotificationService.getInstance();
```

This implementation provides a comprehensive notification service that follows Material Design 3.0 principles and includes:

1. Singleton pattern for global notification management
2. Full accessibility support with ARIA attributes
3. RTL support for internationalization
4. Material Design styling with proper elevation and shape
5. Animation support for smooth transitions
6. Queue management for multiple notifications
7. Error handling with retry capabilities
8. Customizable options for each notification
9. Type safety with TypeScript
10. Proper cleanup and memory management

The service can be used throughout the application to show various types of notifications:

```typescript
// Usage examples:
import notificationService from './notification.service';

// Show success notification
notificationService.show('success', 'Operation completed successfully');

// Show error notification with custom duration
notificationService.show('error', 'Failed to save changes', 10000);

// Show warning notification with custom options
notificationService.show('warning', 'Please review your changes', null, {
  position: 'top-center',
  dismissible: true,
  action: {
    label: 'Review',
    onClick: () => { /* handle action */ }
  }
});

// Handle API error
notificationService.handleApiError(error);