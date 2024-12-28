/**
 * @fileoverview Advanced email processing utilities for the frontend application
 * Provides type-safe functions for email formatting, parsing, and manipulation
 * @version 1.0.0
 */

import { Base64 } from 'js-base64'; // v3.7.5
import {
  IEmailMessage,
  IEmailThread,
  EmailPriority,
  EmailStatus,
  IAttachment
} from '../types/email.types';
import { formatDate, parseEmailDate } from './date.utils';
import { validateEmail, validateEmailMessage, sanitizeInput } from './validation.utils';

// Constants for email processing
export const MAX_PREVIEW_LENGTH = 160;
export const SUPPORTED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
export const MAX_ATTACHMENT_SIZE = 10485760; // 10MB
export const EMAIL_REGEX = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
export const THREAD_DEPTH_LIMIT = 50;

// Performance optimization: Memoization cache for thread formatting
const threadCache = new Map<string, IEmailThread>();

/**
 * Decorator for memoizing thread formatting results
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const key = `${propertyKey}-${JSON.stringify(args)}`;
    if (threadCache.has(key)) {
      return threadCache.get(key);
    }
    const result = originalMethod.apply(this, args);
    threadCache.set(key, result);
    return result;
  };
  return descriptor;
}

/**
 * Decorator for input validation
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    if (!args[0]) {
      throw new Error(`Invalid input for ${propertyKey}`);
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Decorator for error boundary handling
 */
function errorBoundary(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    try {
      return originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Formats an email thread for display with enhanced type safety and memoization
 * @param thread - Email thread to format
 * @returns Formatted thread with processed messages
 */
@memoize
@validateInput
@errorBoundary
export function formatEmailThread(thread: IEmailThread): IEmailThread {
  // Validate thread structure
  if (!thread.messages || !Array.isArray(thread.messages)) {
    throw new Error('Invalid thread structure');
  }

  // Sort messages chronologically
  const sortedMessages = [...thread.messages].sort((a, b) => 
    a.receivedAt.getTime() - b.receivedAt.getTime()
  );

  // Process messages with depth tracking
  const processedMessages = sortedMessages.map((message, index) => {
    // Validate message
    const validation = validateEmailMessage(message);
    if (!validation.isValid) {
      console.warn('Message validation warnings:', validation.warnings);
    }

    // Format dates
    const formattedMessage = {
      ...message,
      sentAt: formatDate(message.sentAt, {
        format: 'EMAIL_TIMESTAMP',
        includeTime: true
      }),
      receivedAt: formatDate(message.receivedAt, {
        format: 'EMAIL_TIMESTAMP',
        includeTime: true
      })
    };

    // Sanitize content
    formattedMessage.content = sanitizeInput(message.content);

    return formattedMessage;
  });

  // Calculate thread statistics
  const unreadCount = processedMessages.filter(
    msg => msg.status === EmailStatus.UNREAD
  ).length;

  // Generate unique participant list
  const participants = Array.from(new Set(
    processedMessages.flatMap(msg => [
      msg.fromAddress,
      ...msg.toAddresses,
      ...msg.ccAddresses
    ])
  )).filter(validateEmail);

  return {
    ...thread,
    messages: processedMessages,
    participants,
    unreadCount,
    lastMessageAt: processedMessages[processedMessages.length - 1]?.receivedAt || new Date()
  };
}

/**
 * Parses and validates email addresses with enhanced security
 * @param addressString - String containing email addresses
 * @returns Array of validated email addresses
 */
@validateInput
@errorBoundary
export function parseEmailAddresses(addressString: string): string[] {
  // Sanitize input
  const sanitizedString = sanitizeInput(addressString);

  // Split addresses using various delimiters
  const addresses = sanitizedString
    .split(/[,;]/g)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);

  // Validate each address
  const validAddresses = addresses.filter(addr => {
    const isValid = validateEmail(addr);
    if (!isValid) {
      console.warn(`Invalid email address detected: ${addr}`);
    }
    return isValid;
  });

  // Remove duplicates while preserving order
  return Array.from(new Set(validAddresses));
}

/**
 * Processes email attachments with security checks
 * @param attachments - Array of email attachments
 * @returns Processed attachments with additional metadata
 */
export function processAttachments(attachments: IAttachment[]): IAttachment[] {
  return attachments.map(attachment => {
    // Validate attachment size
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`Attachment ${attachment.filename} exceeds maximum size limit`);
    }

    // Validate content type
    if (!SUPPORTED_ATTACHMENT_TYPES.includes(attachment.contentType)) {
      throw new Error(`Unsupported attachment type: ${attachment.contentType}`);
    }

    // Process attachment URL
    const processedUrl = attachment.url.startsWith('data:') 
      ? attachment.url 
      : `data:${attachment.contentType};base64,${Base64.encode(attachment.url)}`;

    return {
      ...attachment,
      url: processedUrl
    };
  });
}

/**
 * Clears the thread formatting cache
 */
export function clearThreadCache(): void {
  threadCache.clear();
}