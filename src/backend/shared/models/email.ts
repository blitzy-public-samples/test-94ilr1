// @version google-protobuf@3.21.0
import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';
// @version email-validator@2.0.4
import * as EmailValidator from 'email-validator';
import { EmailMessage, EmailPriority as ProtoEmailPriority, EmailStatus as ProtoEmailStatus, EmailImportance, Attachment } from '../proto/email';

/**
 * Email priority levels aligned with protobuf definitions
 */
export enum EmailPriority {
    NORMAL = 0,
    HIGH = 1,
    URGENT = 2
}

/**
 * Email status states aligned with protobuf definitions
 */
export enum EmailStatus {
    UNREAD = 0,
    READ = 1,
    ARCHIVED = 2,
    DELETED = 3,
    DRAFT = 4,
    SCHEDULED = 5
}

/**
 * Maximum allowed email content size in bytes (10MB)
 */
export const MAX_CONTENT_SIZE = 10485760;

/**
 * RFC 5322 compliant email regex pattern
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Interface for email address representation
 */
export interface IEmailAddress {
    address: string;
    name?: string;
    verified?: boolean;
}

/**
 * Interface for email attachments
 */
export interface IAttachment {
    attachmentId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    storagePath: string;
    checksum: string;
    isInline: boolean;
    contentId?: string;
    metadata?: Record<string, string>;
}

/**
 * Interface for thread tracking information
 */
export interface IThreadInfo {
    threadId: string;
    position: number;
    conversationId: string;
    isComplete: boolean;
    totalMessages: number;
}

/**
 * Interface for OAuth credentials
 */
export interface IOAuthCredentials {
    provider: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string[];
}

/**
 * Interface for email metadata
 */
export interface IEmailMetadata {
    threadPosition: number;
    conversationId: string;
    importance: EmailImportance;
    labels: string[];
    folderPath: string;
    customFields: Record<string, string>;
}

/**
 * Main email interface definition
 */
export interface IEmail {
    messageId: string;
    threadId: string;
    accountId: string;
    subject: string;
    content: string;
    fromAddress: IEmailAddress;
    toAddresses: IEmailAddress[];
    ccAddresses: IEmailAddress[];
    bccAddresses: IEmailAddress[];
    attachments: IAttachment[];
    priority: EmailPriority;
    status: EmailStatus;
    sentAt: Date;
    receivedAt: Date;
    headers: Record<string, string>;
    metadata: IEmailMetadata;
    threadInfo: IThreadInfo;
    oauthCredentials: IOAuthCredentials;
}

/**
 * Validation decorator for email-related methods
 */
function validateEmail(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args: any[]) {
        const email = args[0];
        const validationResult = Email.validateEmailObject(email);
        if (!validationResult.isValid) {
            throw new Error(`Email validation failed: ${validationResult.errors.join(', ')}`);
        }
        return originalMethod.apply(this, args);
    };
    return descriptor;
}

/**
 * Validation result interface
 */
interface IValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Email class implementation with comprehensive validation and conversion methods
 */
export class Email implements IEmail {
    public messageId: string;
    public threadId: string;
    public accountId: string;
    public subject: string;
    public content: string;
    public fromAddress: IEmailAddress;
    public toAddresses: IEmailAddress[];
    public ccAddresses: IEmailAddress[];
    public bccAddresses: IEmailAddress[];
    public attachments: IAttachment[];
    public priority: EmailPriority;
    public status: EmailStatus;
    public sentAt: Date;
    public receivedAt: Date;
    public headers: Record<string, string>;
    public metadata: IEmailMetadata;
    public threadInfo: IThreadInfo;
    public oauthCredentials: IOAuthCredentials;

    constructor(params: Partial<IEmail>) {
        this.validateConstructorParams(params);
        Object.assign(this, params);
        this.initializeDefaults();
    }

    private initializeDefaults(): void {
        this.priority = this.priority || EmailPriority.NORMAL;
        this.status = this.status || EmailStatus.UNREAD;
        this.headers = this.headers || {};
        this.ccAddresses = this.ccAddresses || [];
        this.bccAddresses = this.bccAddresses || [];
        this.attachments = this.attachments || [];
    }

    /**
     * Validates constructor parameters
     */
    private validateConstructorParams(params: Partial<IEmail>): void {
        if (!params.messageId) throw new Error('messageId is required');
        if (!params.accountId) throw new Error('accountId is required');
        if (!params.fromAddress) throw new Error('fromAddress is required');
        if (!params.toAddresses || params.toAddresses.length === 0) {
            throw new Error('At least one recipient is required');
        }
    }

    /**
     * Validates email object integrity
     */
    public static validateEmailObject(email: Partial<IEmail>): IValidationResult {
        const errors: string[] = [];

        // Validate required fields
        if (!email.messageId) errors.push('messageId is required');
        if (!email.accountId) errors.push('accountId is required');
        if (!email.subject) errors.push('subject is required');

        // Validate email addresses
        if (email.fromAddress && !EmailValidator.validate(email.fromAddress.address)) {
            errors.push('Invalid from address');
        }

        email.toAddresses?.forEach((addr, idx) => {
            if (!EmailValidator.validate(addr.address)) {
                errors.push(`Invalid to address at index ${idx}`);
            }
        });

        // Validate content size
        if (email.content && Buffer.byteLength(email.content) > MAX_CONTENT_SIZE) {
            errors.push('Content size exceeds maximum limit');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Converts Email instance to protobuf message
     */
    @validateEmail
    public toProto(): EmailMessage {
        const message = new EmailMessage();
        
        message.setMessageId(this.messageId);
        message.setThreadId(this.threadId);
        message.setAccountId(this.accountId);
        message.setSubject(this.subject);
        message.setContent(this.content);
        message.setFromAddress(this.fromAddress.address);
        message.setToAddressesList(this.toAddresses.map(addr => addr.address));
        message.setCcAddressesList(this.ccAddresses.map(addr => addr.address));
        message.setBccAddressesList(this.bccAddresses.map(addr => addr.address));
        
        // Convert dates to Timestamp
        const sentAtTimestamp = new Timestamp();
        sentAtTimestamp.fromDate(this.sentAt);
        message.setSentAt(sentAtTimestamp);

        const receivedAtTimestamp = new Timestamp();
        receivedAtTimestamp.fromDate(this.receivedAt);
        message.setReceivedAt(receivedAtTimestamp);

        // Set metadata
        message.setThreadPosition(this.metadata.threadPosition);
        message.setConversationId(this.metadata.conversationId);
        message.setImportanceLevel(this.metadata.importance);
        message.setLabelsList(this.metadata.labels);
        message.setFolderPath(this.metadata.folderPath);

        return message;
    }

    /**
     * Creates Email instance from protobuf message
     */
    public static fromProto(message: EmailMessage): Email {
        return new Email({
            messageId: message.getMessageId(),
            threadId: message.getThreadId(),
            accountId: message.getAccountId(),
            subject: message.getSubject(),
            content: message.getContent(),
            fromAddress: {
                address: message.getFromAddress()
            },
            toAddresses: message.getToAddressesList().map(addr => ({ address: addr })),
            ccAddresses: message.getCcAddressesList().map(addr => ({ address: addr })),
            bccAddresses: message.getBccAddressesList().map(addr => ({ address: addr })),
            sentAt: message.getSentAt()?.toDate() || new Date(),
            receivedAt: message.getReceivedAt()?.toDate() || new Date(),
            metadata: {
                threadPosition: message.getThreadPosition(),
                conversationId: message.getConversationId(),
                importance: message.getImportanceLevel(),
                labels: message.getLabelsList(),
                folderPath: message.getFolderPath(),
                customFields: {}
            },
            threadInfo: {
                threadId: message.getThreadId(),
                position: message.getThreadPosition(),
                conversationId: message.getConversationId(),
                isComplete: true,
                totalMessages: 1
            },
            priority: EmailPriority.NORMAL,
            status: EmailStatus.UNREAD,
            headers: {},
            attachments: []
        });
    }
}