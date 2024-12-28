/**
 * @fileoverview Email Service
 * Implements comprehensive email management functionality with real-time updates,
 * caching, and reactive state management for the web frontend.
 * @version 1.0.0
 */

// External dependencies - RxJS v7.8.1
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { 
  debounceTime, 
  distinctUntilChanged, 
  catchError, 
  retry, 
  map, 
  switchMap 
} from 'rxjs/operators';

// Internal imports
import { 
  getEmails, 
  getEmailThread, 
  sendEmail, 
  updateEmailStatus, 
  deleteEmail, 
  batchUpdateEmails 
} from '../api/email.api';
import { 
  IEmailMessage, 
  IEmailThread, 
  EmailFilter, 
  EmailStatus, 
  EmailPriority, 
  IEmailCache 
} from '../types/email.types';

/**
 * Cache configuration for email data
 */
const CACHE_CONFIG = {
  MAX_AGE: 5 * 60 * 1000, // 5 minutes
  CLEANUP_INTERVAL: 15 * 60 * 1000 // 15 minutes
};

/**
 * Email Service class implementing comprehensive email management functionality
 */
export class EmailService {
  // State management subjects
  private emailsSubject = new BehaviorSubject<IEmailMessage[]>([]);
  private filterSubject = new BehaviorSubject<EmailFilter>({});
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<Error | null>(null);
  private refreshTrigger = new Subject<void>();

  // Cache management
  private emailCache = new Map<string, IEmailCache>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize service with subscriptions and cache cleanup
   */
  private initializeService(): void {
    // Setup filter subscription with debounce
    this.filterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(() => {
      this.refreshEmails();
    });

    // Setup refresh trigger subscription
    this.refreshTrigger.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.refreshEmails();
    });

    // Setup cache cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, CACHE_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Observable getters for reactive state
   */
  get emails$(): Observable<IEmailMessage[]> {
    return this.emailsSubject.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  get error$(): Observable<Error | null> {
    return this.errorSubject.asObservable();
  }

  /**
   * Updates the current filter and triggers email refresh
   */
  updateFilter(filter: Partial<EmailFilter>): void {
    this.filterSubject.next({
      ...this.filterSubject.value,
      ...filter
    });
  }

  /**
   * Retrieves emails based on current filter with caching
   */
  async getEmails(page: number = 1, pageSize: number = 50): Promise<void> {
    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const cacheKey = this.generateCacheKey(page, pageSize);
      const cachedData = this.getCachedData(cacheKey);

      if (cachedData) {
        this.emailsSubject.next(cachedData.data);
        return;
      }

      const response = await getEmails(
        this.filterSubject.value,
        page,
        pageSize,
        true // Enable real-time updates
      );

      if (response.success && response.data) {
        this.updateCache(cacheKey, response.data.items);
        this.emailsSubject.next(response.data.items);
      }
    } catch (error) {
      this.errorSubject.next(error as Error);
      console.error('Error fetching emails:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Performs batch operations on multiple emails
   */
  async batchUpdateEmails(
    messageIds: string[], 
    operation: 'read' | 'archive' | 'delete'
  ): Promise<void> {
    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      // Optimistic update
      const currentEmails = this.emailsSubject.value;
      const updatedEmails = currentEmails.map(email => {
        if (messageIds.includes(email.messageId)) {
          return {
            ...email,
            status: this.getStatusForOperation(operation)
          };
        }
        return email;
      });

      this.emailsSubject.next(updatedEmails);

      // Perform API update
      await batchUpdateEmails(messageIds, operation);
      this.invalidateCache();
    } catch (error) {
      // Revert optimistic update on error
      this.refreshEmails();
      this.errorSubject.next(error as Error);
      console.error('Error performing batch update:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Sends a new email message
   */
  async sendEmail(message: Partial<IEmailMessage>, isDraft: boolean = false): Promise<void> {
    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      const response = await sendEmail(message, isDraft);
      
      if (response.success) {
        this.invalidateCache();
        this.refreshEmails();
      }
    } catch (error) {
      this.errorSubject.next(error as Error);
      console.error('Error sending email:', error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Cleanup resources on service destruction
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.emailCache.clear();
  }

  /**
   * Private helper methods
   */
  private getStatusForOperation(operation: string): EmailStatus {
    switch (operation) {
      case 'read': return EmailStatus.READ;
      case 'archive': return EmailStatus.ARCHIVED;
      case 'delete': return EmailStatus.DELETED;
      default: return EmailStatus.UNREAD;
    }
  }

  private generateCacheKey(page: number, pageSize: number): string {
    return `${JSON.stringify(this.filterSubject.value)}_${page}_${pageSize}`;
  }

  private getCachedData(key: string): IEmailCache | null {
    const cached = this.emailCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.MAX_AGE) {
      return cached;
    }
    return null;
  }

  private updateCache(key: string, data: IEmailMessage[]): void {
    this.emailCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private invalidateCache(): void {
    this.emailCache.clear();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.emailCache.entries()) {
      if (now - value.timestamp > CACHE_CONFIG.MAX_AGE) {
        this.emailCache.delete(key);
      }
    }
  }

  private refreshEmails(): void {
    this.getEmails().catch(error => {
      console.error('Error refreshing emails:', error);
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();