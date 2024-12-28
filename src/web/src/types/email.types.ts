/**
 * @fileoverview TypeScript type definitions for email-related entities and operations
 * Provides type safety and interfaces for email handling in the web frontend
 * @version 1.0.0
 */

/**
 * Email priority levels enumeration
 */
export enum EmailPriority {
  NORMAL = 0,
  HIGH = 1,
  URGENT = 2
}

/**
 * Email status enumeration
 */
export enum EmailStatus {
  UNREAD = 0,
  READ = 1,
  ARCHIVED = 2,
  DELETED = 3
}

/**
 * Interface for email attachments
 */
export interface IAttachment {
  /** Unique identifier for the attachment */
  attachmentId: string;
  /** Original filename of the attachment */
  filename: string;
  /** MIME type of the attachment */
  contentType: string;
  /** Size of the attachment in bytes */
  size: number;
  /** URL to download/access the attachment */
  url: string;
}

/**
 * Core email message interface
 */
export interface IEmailMessage {
  /** Unique identifier for the email message */
  messageId: string;
  /** Thread identifier this message belongs to */
  threadId: string;
  /** Email account identifier */
  accountId: string;
  /** Email subject line */
  subject: string;
  /** Email body content */
  content: string;
  /** Sender email address */
  fromAddress: string;
  /** List of primary recipient email addresses */
  toAddresses: string[];
  /** List of CC recipient email addresses */
  ccAddresses: string[];
  /** List of BCC recipient email addresses */
  bccAddresses: string[];
  /** List of email attachments */
  attachments: IAttachment[];
  /** Email priority level */
  priority: EmailPriority;
  /** Current status of the email */
  status: EmailStatus;
  /** Timestamp when email was sent */
  sentAt: Date;
  /** Timestamp when email was received */
  receivedAt: Date;
  /** Email headers key-value pairs */
  headers: Record<string, string>;
  /** Additional metadata key-value pairs */
  metadata: Record<string, unknown>;
}

/**
 * Interface for email thread grouping
 */
export interface IEmailThread {
  /** Unique identifier for the thread */
  threadId: string;
  /** Thread subject line */
  subject: string;
  /** Array of messages in the thread */
  messages: IEmailMessage[];
  /** List of unique participant email addresses */
  participants: string[];
  /** Timestamp of the most recent message */
  lastMessageAt: Date;
  /** Count of unread messages in thread */
  unreadCount: number;
}

/**
 * Type definition for email filtering options
 */
export type EmailFilter = {
  /** Filter by email status */
  status?: EmailStatus;
  /** Filter by priority level */
  priority?: EmailPriority;
  /** Filter by start date */
  fromDate?: Date;
  /** Filter by end date */
  toDate?: Date;
  /** Search term for content/subject */
  searchTerm?: string;
};

/**
 * Generic API response wrapper interface
 */
export interface EmailApiResponse<T> {
  /** Indicates if the operation was successful */
  success: boolean;
  /** Response data of generic type */
  data: T;
  /** Error message if operation failed */
  error: string | null;
}

/**
 * Interface for paginated email listings
 */
export interface EmailPaginatedResponse<T> {
  /** Array of items for current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Indicates if more pages exist */
  hasMore: boolean;
}