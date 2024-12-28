// @version zod@3.22.0
import { z } from 'zod';
// @version google-protobuf@3.21.0
import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';
import { EmailMessage } from './email';

// Global constants for validation and limits
export const MIN_CONFIDENCE_SCORE = 0.0;
export const MAX_CONFIDENCE_SCORE = 1.0;
export const MAX_TOPICS = 10;
export const MIN_INTERACTION_FREQUENCY = 0;
export const MAX_SENTIMENT_SCORE = 1.0;
export const MIN_SENTIMENT_SCORE = -1.0;

/**
 * Enum defining project status states
 */
export enum ProjectStatus {
    ACTIVE = 0,
    COMPLETED = 1,
    ON_HOLD = 2,
    ARCHIVED = 3
}

/**
 * Enum defining types of relationships between communicating parties
 */
export enum RelationshipType {
    TEAM_MEMBER = 0,
    STAKEHOLDER = 1,
    CLIENT = 2,
    VENDOR = 3
}

/**
 * Interface for project-related context with relevance scoring
 */
export interface ProjectContext {
    projectId: string;
    projectName: string;
    status: ProjectStatus;
    relevanceScore: number;
    keyTerms: string[];
    attributes: Record<string, string>;
}

/**
 * Interface for relationship mapping context with sentiment analysis
 */
export interface RelationshipContext {
    personId: string;
    emailAddress: string;
    name: string;
    type: RelationshipType;
    interactionFrequency: number;
    lastInteraction: Timestamp;
    sentimentMetrics: Record<string, number>;
}

/**
 * Main interface for email context data with enhanced metadata support
 */
export interface Context {
    contextId: string;
    emailId: string;
    threadId: string;
    projectContexts: ProjectContext[];
    relationshipContexts: RelationshipContext[];
    topics: string[];
    confidenceScore: number;
    analyzedAt: Timestamp;
    metadata: Record<string, string>;
}

/**
 * Enhanced Zod schema for runtime validation of context objects
 */
export const contextSchema = z.object({
    contextId: z.string().uuid(),
    emailId: z.string().uuid(),
    threadId: z.string().uuid(),
    projectContexts: z.array(z.object({
        projectId: z.string().uuid(),
        projectName: z.string().min(1),
        status: z.nativeEnum(ProjectStatus),
        relevanceScore: z.number()
            .min(MIN_CONFIDENCE_SCORE)
            .max(MAX_CONFIDENCE_SCORE),
        keyTerms: z.array(z.string()),
        attributes: z.record(z.string(), z.string())
    })),
    relationshipContexts: z.array(z.object({
        personId: z.string().uuid(),
        emailAddress: z.string().email(),
        name: z.string().min(1),
        type: z.nativeEnum(RelationshipType),
        interactionFrequency: z.number()
            .min(MIN_INTERACTION_FREQUENCY),
        lastInteraction: z.instanceof(Timestamp),
        sentimentMetrics: z.record(z.string(), z.number()
            .min(MIN_SENTIMENT_SCORE)
            .max(MAX_SENTIMENT_SCORE))
    })),
    topics: z.array(z.string())
        .max(MAX_TOPICS),
    confidenceScore: z.number()
        .min(MIN_CONFIDENCE_SCORE)
        .max(MAX_CONFIDENCE_SCORE),
    analyzedAt: z.instanceof(Timestamp),
    metadata: z.record(z.string(), z.string())
});

/**
 * Validates a context object against the enhanced schema with comprehensive checks
 * @param context The context object to validate
 * @returns True if context is valid, throws ZodError with detailed validation failures
 * @throws ZodError
 */
export function validateContext(context: Context): boolean {
    try {
        // Parse and validate the context object against the schema
        contextSchema.parse(context);

        // Additional validation checks
        if (context.topics.length > MAX_TOPICS) {
            throw new Error(`Topics array exceeds maximum limit of ${MAX_TOPICS}`);
        }

        // Validate sentiment scores
        context.relationshipContexts.forEach((relationship, index) => {
            Object.entries(relationship.sentimentMetrics).forEach(([metric, score]) => {
                if (score < MIN_SENTIMENT_SCORE || score > MAX_SENTIMENT_SCORE) {
                    throw new Error(
                        `Invalid sentiment score ${score} for metric ${metric} in relationship at index ${index}`
                    );
                }
            });
        });

        // Validate project relevance scores
        context.projectContexts.forEach((project, index) => {
            if (project.relevanceScore < MIN_CONFIDENCE_SCORE || 
                project.relevanceScore > MAX_CONFIDENCE_SCORE) {
                throw new Error(
                    `Invalid relevance score ${project.relevanceScore} for project at index ${index}`
                );
            }
        });

        // Validate timestamps
        const now = new Date().getTime();
        if (context.analyzedAt.toDate().getTime() > now) {
            throw new Error('analyzedAt timestamp cannot be in the future');
        }

        context.relationshipContexts.forEach((relationship, index) => {
            if (relationship.lastInteraction.toDate().getTime() > now) {
                throw new Error(
                    `Invalid lastInteraction timestamp for relationship at index ${index}`
                );
            }
        });

        return true;
    } catch (error) {
        throw error;
    }
}