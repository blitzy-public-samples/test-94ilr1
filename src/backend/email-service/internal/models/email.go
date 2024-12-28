// Package models provides data structures and methods for email processing
// @version 1.0.0
package models

import (
    "crypto/rand"
    "encoding/hex"
    "errors"
    "fmt"
    "net/mail"
    "time"

    "google.golang.org/protobuf/types/known/timestamppb" // v1.31.0
    emailpb "github.com/email-management-platform/backend/shared/proto/email"
)

// MaxAttachmentSize defines the maximum allowed size for email attachments (25MB)
const MaxAttachmentSize = 25 * 1024 * 1024

// EmailPriority represents the priority level of an email
type EmailPriority int32

// EmailStatus represents the current status of an email
type EmailStatus int32

// Priority constants mapping to proto enum values
const (
    PriorityUnspecified EmailPriority = iota
    PriorityLow
    PriorityNormal
    PriorityHigh
)

// Status constants mapping to proto enum values
const (
    StatusUnspecified EmailStatus = iota
    StatusUnread
    StatusRead
    StatusArchived
    StatusDeleted
    StatusSpam
)

// Email represents a comprehensive email message with threading and conversation tracking
type Email struct {
    MessageID      string
    ThreadID       string
    ConversationID string
    ThreadPosition int32
    AccountID      string
    Subject        string
    Content        string
    FromAddress    string
    ToAddresses    []string
    CCAddresses    []string
    BCCAddresses   []string
    Attachments    []Attachment
    Priority       EmailPriority
    Status         EmailStatus
    Labels         []string
    FolderPath     string
    SentAt         time.Time
    ReceivedAt     time.Time
    Headers        map[string]string
    Metadata       map[string]string
}

// Attachment represents an email attachment with validation capabilities
type Attachment struct {
    AttachmentID string
    Filename     string
    ContentType  string
    SizeBytes    int64
    StoragePath  string
    Checksum     string
    IsInline     bool
    ContentID    string
    Metadata     map[string]string
}

// ToProto converts the Email struct to its protocol buffer representation
func (e *Email) ToProto() *emailpb.EmailMessage {
    if e == nil {
        return nil
    }

    attachments := make([]*emailpb.Attachment, len(e.Attachments))
    for i, att := range e.Attachments {
        attachments[i] = &emailpb.Attachment{
            AttachmentId: att.AttachmentID,
            Filename:     att.Filename,
            ContentType:  att.ContentType,
            SizeBytes:    att.SizeBytes,
            StoragePath:  att.StoragePath,
            Checksum:     att.Checksum,
            IsInline:     att.IsInline,
            ContentId:    att.ContentID,
            Metadata:     att.Metadata,
        }
    }

    return &emailpb.EmailMessage{
        MessageId:      e.MessageID,
        ThreadId:       e.ThreadID,
        ConversationId: e.ConversationID,
        ThreadPosition: e.ThreadPosition,
        AccountId:      e.AccountID,
        Subject:        e.Subject,
        Content:        e.Content,
        FromAddress:    e.FromAddress,
        ToAddresses:    e.ToAddresses,
        CcAddresses:    e.CCAddresses,
        BccAddresses:   e.BCCAddresses,
        Attachments:    attachments,
        Priority:       emailpb.EmailPriority(e.Priority),
        Status:         emailpb.EmailStatus(e.Status),
        Labels:         e.Labels,
        FolderPath:     e.FolderPath,
        SentAt:         timestamppb.New(e.SentAt),
        ReceivedAt:     timestamppb.New(e.ReceivedAt),
        Headers:        e.Headers,
        Metadata:       e.Metadata,
        HasThread:      e.ThreadID != "",
    }
}

// FromProto creates an Email struct from a protocol buffer message
func FromProto(msg *emailpb.EmailMessage) *Email {
    if msg == nil {
        return nil
    }

    attachments := make([]Attachment, len(msg.Attachments))
    for i, att := range msg.Attachments {
        attachments[i] = Attachment{
            AttachmentID: att.AttachmentId,
            Filename:     att.Filename,
            ContentType:  att.ContentType,
            SizeBytes:    att.SizeBytes,
            StoragePath:  att.StoragePath,
            Checksum:     att.Checksum,
            IsInline:     att.IsInline,
            ContentID:    att.ContentId,
            Metadata:     att.Metadata,
        }
    }

    return &Email{
        MessageID:      msg.MessageId,
        ThreadID:       msg.ThreadId,
        ConversationID: msg.ConversationId,
        ThreadPosition: msg.ThreadPosition,
        AccountID:      msg.AccountId,
        Subject:        msg.Subject,
        Content:        msg.Content,
        FromAddress:    msg.FromAddress,
        ToAddresses:    msg.ToAddresses,
        CCAddresses:    msg.CcAddresses,
        BCCAddresses:   msg.BccAddresses,
        Attachments:    attachments,
        Priority:       EmailPriority(msg.Priority),
        Status:         EmailStatus(msg.Status),
        Labels:         msg.Labels,
        FolderPath:     msg.FolderPath,
        SentAt:         msg.SentAt.AsTime(),
        ReceivedAt:     msg.ReceivedAt.AsTime(),
        Headers:        msg.Headers,
        Metadata:       msg.Metadata,
    }
}

// Validate performs comprehensive validation of the email struct
func (e *Email) Validate() error {
    if e == nil {
        return errors.New("email is nil")
    }

    if e.AccountID == "" {
        return errors.New("account ID is required")
    }

    // Validate email addresses
    if _, err := mail.ParseAddress(e.FromAddress); err != nil {
        return fmt.Errorf("invalid from address: %w", err)
    }

    for _, addr := range e.ToAddresses {
        if _, err := mail.ParseAddress(addr); err != nil {
            return fmt.Errorf("invalid to address %s: %w", addr, err)
        }
    }

    // Validate dates
    if !e.SentAt.IsZero() && !e.ReceivedAt.IsZero() && e.ReceivedAt.Before(e.SentAt) {
        return errors.New("received time cannot be before sent time")
    }

    // Validate attachments
    for _, att := range e.Attachments {
        if err := att.Validate(); err != nil {
            return fmt.Errorf("invalid attachment %s: %w", att.Filename, err)
        }
    }

    return nil
}

// Validate performs validation of the attachment
func (a *Attachment) Validate() error {
    if a.SizeBytes > MaxAttachmentSize {
        return fmt.Errorf("attachment size %d exceeds maximum allowed size %d", a.SizeBytes, MaxAttachmentSize)
    }

    if a.Filename == "" {
        return errors.New("attachment filename is required")
    }

    if a.ContentType == "" {
        return errors.New("attachment content type is required")
    }

    return nil
}

// GenerateMessageID creates a new unique message ID
func GenerateMessageID() (string, error) {
    bytes := make([]byte, 16)
    if _, err := rand.Read(bytes); err != nil {
        return "", fmt.Errorf("failed to generate message ID: %w", err)
    }
    return hex.EncodeToString(bytes), nil
}

// IsPartOfThread checks if the email belongs to a thread
func (e *Email) IsPartOfThread() bool {
    return e.ThreadID != "" && e.ThreadPosition > 0
}

// GetConversationContext returns the conversation metadata
func (e *Email) GetConversationContext() map[string]string {
    if e.Metadata == nil {
        return nil
    }
    context := make(map[string]string)
    for k, v := range e.Metadata {
        if k[:5] == "conv_" {
            context[k[5:]] = v
        }
    }
    return context
}

// VerifyChecksum validates the attachment's integrity
func (a *Attachment) VerifyChecksum(providedChecksum string) bool {
    return a.Checksum == providedChecksum
}