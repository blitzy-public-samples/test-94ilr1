/**
 * @fileoverview TypeScript type definitions for email context management
 * Provides comprehensive type safety and runtime validation for context analysis
 * @version 1.0.0
 */

import type { IEmailMessage } from '../types/email.types';
import { z } from 'zod';

// Global constants for validation
const MIN_CONFIDENCE_SCORE = 0.0;
const MAX_CONFIDENCE_SCORE = 1.0;
const MAX_TOPICS = 10;

/**
 * Project status enumeration for context tracking
 */
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Relationship type enumeration for contact classification
 */
export enum RelationshipType {
  TEAM_MEMBER = 'TEAM_MEMBER',
  STAKEHOLDER = 'STAKEHOLDER',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR'
}

/**
 * Interface for project-specific context
 */
interface ProjectContext {
  readonly projectId: string & { readonly brand: 'ProjectId' };
  readonly name: string;
  readonly status: ProjectStatus;
  readonly priority: number;
  readonly lastInteractionAt: Date;
  readonly relatedThreadIds: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Interface for relationship/contact context
 */
interface RelationshipContext {
  readonly contactId: string & { readonly brand: 'ContactId' };
  readonly emailAddress: string;
  readonly relationshipType: RelationshipType;
  readonly interactionCount: number;
  readonly lastInteractionAt: Date;
  readonly averageResponseTime: number;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Comprehensive interface for email context data
 */
export interface Context {
  readonly contextId: string & { readonly brand: 'ContextId' };
  readonly emailId: string & { readonly brand: 'EmailId' };
  readonly threadId: string & { readonly brand: 'ThreadId' };
  readonly projectContexts: readonly ProjectContext[];
  readonly relationshipContexts: readonly RelationshipContext[];
  readonly topics: readonly string[];
  readonly confidenceScore: number;
  readonly analyzedAt: Date;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Zod schema for ProjectContext validation
 */
const ProjectContextSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  status: z.nativeEnum(ProjectStatus),
  priority: z.number().min(1).max(5),
  lastInteractionAt: z.date(),
  relatedThreadIds: z.array(z.string()).min(1),
  metadata: z.record(z.string())
});

/**
 * Zod schema for RelationshipContext validation
 */
const RelationshipContextSchema = z.object({
  contactId: z.string().min(1),
  emailAddress: z.string().email(),
  relationshipType: z.nativeEnum(RelationshipType),
  interactionCount: z.number().min(0),
  lastInteractionAt: z.date(),
  averageResponseTime: z.number().min(0),
  metadata: z.record(z.string())
});

/**
 * Comprehensive Zod schema for Context validation
 */
export const ContextSchema = z.object({
  contextId: z.string().min(1),
  emailId: z.string().min(1),
  threadId: z.string().min(1),
  projectContexts: z.array(ProjectContextSchema),
  relationshipContexts: z.array(RelationshipContextSchema),
  topics: z.array(z.string()).max(MAX_TOPICS),
  confidenceScore: z.number().min(MIN_CONFIDENCE_SCORE).max(MAX_CONFIDENCE_SCORE),
  analyzedAt: z.date(),
  metadata: z.record(z.string())
}).strict();

/**
 * Type guard function for Context interface validation
 * @param value - Value to validate against Context interface
 * @returns boolean indicating if value implements Context interface
 */
export function validateContext(value: unknown): value is Context {
  try {
    ContextSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type alias for context analysis results
 */
export type ContextAnalysisResult = {
  readonly context: Context;
  readonly processingTimeMs: number;
  readonly confidenceMetrics: Readonly<Record<string, number>>;
};

/**
 * Type for context update operations
 */
export type ContextUpdate = Partial<Omit<Context, 'contextId' | 'emailId' | 'threadId'>>;

/**
 * Type for context query parameters
 */
export type ContextQuery = {
  readonly emailId?: string;
  readonly threadId?: string;
  readonly projectId?: string;
  readonly contactId?: string;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly minConfidence?: number;
};