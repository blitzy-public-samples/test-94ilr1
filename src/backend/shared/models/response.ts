// @version zod@3.22.0
import { z } from 'zod';
// @version google-protobuf@3.21.0
import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';

// Internal imports
import { IEmail } from './email';
import { Context } from './context';

// Global constants for validation
export const MIN_CONFIDENCE_SCORE = 0.0;
export const MAX_CONFIDENCE_SCORE = 1.0;
export const MIN_CONTENT_LENGTH = 10;
export const MAX_CONTENT_LENGTH = 5000;

/**
 * Enhanced enum defining response tone options with context awareness
 */
export enum ResponseTone {
    PROFESSIONAL = 0,
    FRIENDLY = 1,
    FORMAL = 2,
    CONCISE = 3,
    EMPATHETIC = 4,
    TECHNICAL = 5
}

/**
 * Enhanced enum defining response status states with review workflow
 */
export enum ResponseStatus {
    DRAFT = 0,
    PENDING_REVIEW = 1,
    APPROVED = 2,
    REJECTED = 3,
    SENT = 4,
    LEARNING = 5
}

/**
 * Enhanced interface for email response data with learning capabilities
 */
export interface IResponse {
    responseId: string;
    emailId: string;
    threadId: string;
    content: string;
    templateId: string;
    tone: ResponseTone;
    status: ResponseStatus;
    confidenceScore: number;
    generatedAt: Date;
    metadata: Record<string, string>;
    learningTags: string[];
    contextScores: Record<string, number>;
}

/**
 * Enhanced interface for response template data with versioning and context rules
 */
export interface IResponseTemplate {
    templateId: string;
    name: string;
    content: string;
    tone: ResponseTone;
    placeholders: string[];
    tags: string[];
    isActive: boolean;
    metadata: Record<string, string>;
    version: string;
    contextRules: Record<string, string>;
}

/**
 * Zod schema for response validation with enhanced rules
 */
const responseSchema = z.object({
    responseId: z.string().uuid(),
    emailId: z.string().uuid(),
    threadId: z.string().uuid(),
    content: z.string()
        .min(MIN_CONTENT_LENGTH, 'Response content too short')
        .max(MAX_CONTENT_LENGTH, 'Response content too long'),
    templateId: z.string().uuid(),
    tone: z.nativeEnum(ResponseTone),
    status: z.nativeEnum(ResponseStatus),
    confidenceScore: z.number()
        .min(MIN_CONFIDENCE_SCORE)
        .max(MAX_CONFIDENCE_SCORE),
    generatedAt: z.date(),
    metadata: z.record(z.string(), z.string()),
    learningTags: z.array(z.string()),
    contextScores: z.record(z.string(), z.number()
        .min(MIN_CONFIDENCE_SCORE)
        .max(MAX_CONFIDENCE_SCORE))
});

/**
 * Validation decorator for response-related methods
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args: any[]) {
        const response = args[0];
        validateResponse(response);
        return originalMethod.apply(this, args);
    };
    return descriptor;
}

/**
 * Validates a response object against the enhanced schema with confidence scoring
 * @param response The response object to validate
 * @returns True if response is valid, throws ValidationError with details if invalid
 */
export function validateResponse(response: IResponse): boolean {
    try {
        responseSchema.parse(response);

        // Additional validation checks
        if (response.content.length < MIN_CONTENT_LENGTH || 
            response.content.length > MAX_CONTENT_LENGTH) {
            throw new Error(`Content length must be between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH}`);
        }

        // Validate confidence scores
        if (response.confidenceScore < MIN_CONFIDENCE_SCORE || 
            response.confidenceScore > MAX_CONFIDENCE_SCORE) {
            throw new Error(`Invalid confidence score: ${response.confidenceScore}`);
        }

        // Validate context scores
        Object.entries(response.contextScores).forEach(([context, score]) => {
            if (score < MIN_CONFIDENCE_SCORE || score > MAX_CONFIDENCE_SCORE) {
                throw new Error(`Invalid context score ${score} for context ${context}`);
            }
        });

        // Validate generated timestamp
        if (response.generatedAt > new Date()) {
            throw new Error('Generated timestamp cannot be in the future');
        }

        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Enhanced Response class implementing IResponse interface with learning capabilities
 */
export class Response implements IResponse {
    public responseId: string;
    public emailId: string;
    public threadId: string;
    public content: string;
    public templateId: string;
    public tone: ResponseTone;
    public status: ResponseStatus;
    public confidenceScore: number;
    public generatedAt: Date;
    public metadata: Record<string, string>;
    public learningTags: string[];
    public contextScores: Record<string, number>;

    constructor(params: Partial<IResponse>) {
        this.validateConstructorParams(params);
        Object.assign(this, params);
        this.initializeDefaults();
    }

    private initializeDefaults(): void {
        this.status = this.status || ResponseStatus.DRAFT;
        this.tone = this.tone || ResponseTone.PROFESSIONAL;
        this.generatedAt = this.generatedAt || new Date();
        this.metadata = this.metadata || {};
        this.learningTags = this.learningTags || [];
        this.contextScores = this.contextScores || {};
    }

    private validateConstructorParams(params: Partial<IResponse>): void {
        if (!params.responseId) throw new Error('responseId is required');
        if (!params.emailId) throw new Error('emailId is required');
        if (!params.threadId) throw new Error('threadId is required');
        if (!params.content) throw new Error('content is required');
        if (!params.templateId) throw new Error('templateId is required');
    }

    /**
     * Validates response with enhanced learning feedback
     */
    public validate(): boolean {
        return validateResponse(this);
    }

    /**
     * Converts Response instance to protocol buffer format with enhanced metadata
     */
    @validateInput
    public toProto(): any {
        const timestamp = new Timestamp();
        timestamp.fromDate(this.generatedAt);

        return {
            responseId: this.responseId,
            emailId: this.emailId,
            threadId: this.threadId,
            content: this.content,
            templateId: this.templateId,
            tone: this.tone,
            status: this.status,
            confidenceScore: this.confidenceScore,
            generatedAt: timestamp,
            metadata: this.metadata,
            learningTags: this.learningTags,
            contextScores: this.contextScores
        };
    }
}