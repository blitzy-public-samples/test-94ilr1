/**
 * @fileoverview Comprehensive validation utilities for form validation, data validation,
 * input sanitization, and security enforcement across the web application
 * @version 1.0.0
 */

import { isEmail, escape } from 'validator'; // validator v13.11.0
import { IEmailMessage } from '../types/email.types';
import { AuthCredentials } from '../types/auth.types';

// Constants for validation rules
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321
export const MAX_SUBJECT_LENGTH = 998; // RFC 5322
export const MAX_RECIPIENTS = 50;
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
export const ALLOWED_ATTACHMENT_TYPES = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.png'];
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi
];

// Common email domains for additional validation
const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com'
];

/**
 * Validates email address format with enhanced checks
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmedEmail = email.trim();
  
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  if (!isEmail(trimmedEmail, {
    allow_utf8_local_part: false,
    require_tld: true,
    allow_ip_domain: false
  })) {
    return false;
  }

  // Additional security checks
  if (trimmedEmail.includes('..') || trimmedEmail.includes('--')) {
    return false;
  }

  const [, domain] = trimmedEmail.split('@');
  if (!domain) {
    return false;
  }

  // Optional: Validate against common domains
  if (!COMMON_EMAIL_DOMAINS.includes(domain.toLowerCase()) && 
      !domain.endsWith('.edu') && 
      !domain.endsWith('.org') && 
      !domain.endsWith('.gov')) {
    // Consider logging suspicious domains
    console.warn(`Uncommon email domain detected: ${domain}`);
  }

  return true;
};

/**
 * Enhanced password validation with complexity scoring
 * @param password - Password to validate
 * @returns Validation result with complexity score and errors
 */
export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
  complexityScore: number;
} => {
  const errors: string[] = [];
  let complexityScore = 0;

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors, complexityScore: 0 };
  }

  // Length check
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  } else {
    complexityScore += 1;
  }

  // Character type checks
  if (/[A-Z]/.test(password)) complexityScore += 1;
  if (/[a-z]/.test(password)) complexityScore += 1;
  if (/[0-9]/.test(password)) complexityScore += 1;
  if (/[^A-Za-z0-9]/.test(password)) complexityScore += 1;

  if (!PASSWORD_REGEX.test(password)) {
    errors.push('Password must contain at least one uppercase letter, lowercase letter, number, and special character');
  }

  // Check for common patterns
  if (/^(password|admin|user|12345)/.test(password.toLowerCase())) {
    errors.push('Password contains common patterns');
    complexityScore = Math.max(0, complexityScore - 1);
  }

  // Additional complexity bonuses
  if (password.length >= 12) complexityScore += 1;
  if (password.length >= 16) complexityScore += 1;

  return {
    isValid: errors.length === 0,
    errors,
    complexityScore: Math.min(complexityScore, 7) // Max score of 7
  };
};

/**
 * Comprehensive email message validation
 * @param message - Email message to validate
 * @returns Validation result with errors and warnings
 */
export const validateEmailMessage = (message: IEmailMessage): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate from address
  if (!validateEmail(message.fromAddress)) {
    errors.push('Invalid sender email address');
  }

  // Validate to addresses
  if (!message.toAddresses || message.toAddresses.length === 0) {
    errors.push('At least one recipient is required');
  } else if (message.toAddresses.length > MAX_RECIPIENTS) {
    errors.push(`Maximum of ${MAX_RECIPIENTS} recipients allowed`);
  } else {
    message.toAddresses.forEach((email, index) => {
      if (!validateEmail(email)) {
        errors.push(`Invalid recipient email address at position ${index + 1}`);
      }
    });
  }

  // Subject validation
  if (message.subject && message.subject.length > MAX_SUBJECT_LENGTH) {
    errors.push(`Subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters`);
  }

  // Attachment validation
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach(attachment => {
      if (attachment.size > MAX_ATTACHMENT_SIZE) {
        errors.push(`Attachment ${attachment.filename} exceeds size limit of ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB`);
      }
      
      const fileExtension = attachment.filename.toLowerCase().slice(attachment.filename.lastIndexOf('.'));
      if (!ALLOWED_ATTACHMENT_TYPES.includes(fileExtension)) {
        errors.push(`File type ${fileExtension} is not allowed`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced authentication credentials validation
 * @param credentials - Authentication credentials to validate
 * @returns Validation result with security flags
 */
export const validateAuthCredentials = (credentials: AuthCredentials): {
  isValid: boolean;
  errors: string[];
  securityFlags: string[];
} => {
  const errors: string[] = [];
  const securityFlags: string[] = [];

  if (!validateEmail(credentials.email)) {
    errors.push('Invalid email address');
  }

  const passwordValidation = validatePassword(credentials.password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }

  // Additional security checks
  if (credentials.email === credentials.password) {
    errors.push('Email and password cannot be the same');
    securityFlags.push('CREDENTIALS_MATCH');
  }

  if (passwordValidation.complexityScore < 3) {
    securityFlags.push('LOW_PASSWORD_STRENGTH');
  }

  return {
    isValid: errors.length === 0,
    errors,
    securityFlags
  };
};

/**
 * Advanced input sanitization with XSS protection
 * @param input - String input to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Escape HTML special characters
  sanitized = escape(sanitized);

  // Remove potential XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Handle Unicode homoglyphs
  sanitized = sanitized.normalize('NFKC');

  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
};