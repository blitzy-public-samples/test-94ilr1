/**
 * @fileoverview TypeScript type definitions for email response generation, template management,
 * and response review operations in the frontend application.
 * @version 1.0.0
 */

/**
 * Enum defining available response tone options for email generation
 */
export enum ResponseTone {
  PROFESSIONAL = 'PROFESSIONAL',
  FRIENDLY = 'FRIENDLY',
  FORMAL = 'FORMAL',
  CONCISE = 'CONCISE'
}

/**
 * Enum defining response workflow status states
 */
export enum ResponseStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT = 'SENT'
}

/**
 * Interface defining response template structure
 */
export interface ResponseTemplate {
  /** Unique identifier for the template */
  template_id: string;
  /** Display name of the template */
  name: string;
  /** Template content with placeholder markers */
  content: string;
  /** Tone setting for the template */
  tone: ResponseTone;
  /** Array of placeholder keys used in the template */
  placeholders: string[];
  /** Categorization tags for the template */
  tags: string[];
  /** Flag indicating if template is currently usable */
  is_active: boolean;
  /** Additional template metadata key-value pairs */
  metadata: Record<string, string>;
}

/**
 * Interface defining generated response structure
 */
export interface GeneratedResponse {
  /** Unique identifier for the generated response */
  response_id: string;
  /** Reference to the email being responded to */
  email_id: string;
  /** Reference to the email thread */
  thread_id: string;
  /** Generated response content */
  content: string;
  /** Reference to the template used */
  template_id: string;
  /** Tone used in generation */
  tone: ResponseTone;
  /** Current workflow status */
  status: ResponseStatus;
  /** AI confidence score for the response */
  confidence_score: number;
  /** Timestamp of generation */
  generated_at: Date;
  /** Additional response metadata */
  metadata: Record<string, string>;
}

/**
 * Interface defining response generation request parameters
 */
export interface GenerateResponseRequest {
  /** ID of email to respond to */
  email_id: string;
  /** ID of context to use for generation */
  context_id: string;
  /** Desired tone for the response */
  preferred_tone: ResponseTone;
  /** Optional template to base response on */
  template_id: string;
  /** Key-value pairs for template placeholders */
  parameters: Record<string, string>;
}

/**
 * Interface defining template listing parameters
 */
export interface ListTemplatesParams {
  /** Filter templates by tags */
  tags: string[];
  /** Filter templates by tone */
  tone: ResponseTone;
  /** Number of items per page */
  page_size: number;
  /** Token for pagination */
  page_token: string;
}

/**
 * Interface defining response review submission data
 */
export interface ResponseReviewData {
  /** ID of response being reviewed */
  response_id: string;
  /** Updated status after review */
  status: ResponseStatus;
  /** Reviewer feedback comments */
  feedback: string;
  /** Modified response content if edited */
  edited_content: string;
}

/**
 * Generic interface for API response structure
 */
export interface ResponseApiResponse<T> {
  /** Operation success indicator */
  success: boolean;
  /** Response payload */
  data: T;
  /** Error message if operation failed */
  error: string;
}

/**
 * Generic interface for paginated API response structure
 */
export interface ResponsePaginatedResponse<T> {
  /** Array of response items */
  items: T[];
  /** Token for fetching next page */
  next_page_token: string;
  /** Total count of available items */
  total_count: number;
}