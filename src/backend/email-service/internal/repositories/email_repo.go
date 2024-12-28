// Package repositories provides data persistence layer implementations
// with support for high-volume processing, sharding, and replication
package repositories

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "time"

    "github.com/lib/pq" // v1.10.9
    "github.com/pkg/errors" // v0.9.1
    "github.com/prometheus/client_golang/prometheus" // v1.16.0
    "github.com/prometheus/client_golang/prometheus/promauto"

    "github.com/email-management-platform/backend/email-service/internal/config"
    "github.com/email-management-platform/backend/email-service/internal/models"
)

const (
    // Default batch size for bulk operations
    defaultBatchSize = 100

    // Maximum query timeout
    maxQueryTimeout = time.Second * 30

    // Maximum number of retries for database operations
    maxRetries = 3

    // Base delay for exponential backoff
    retryBackoff = time.Millisecond * 100
)

// Metrics collectors
var (
    emailOperationDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name: "email_repository_operation_duration_seconds",
        Help: "Duration of email repository operations",
    }, []string{"operation"})

    emailOperationErrors = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "email_repository_operation_errors_total",
        Help: "Total number of email repository operation errors",
    }, []string{"operation"})
)

// EmailRepository handles email data persistence with sharding support
type EmailRepository struct {
    db            *sql.DB
    shardMgr      *ShardManager
    preparedStmts map[string]*sql.Stmt
    metrics       *metrics
}

// metrics holds repository operation metrics
type metrics struct {
    duration *prometheus.HistogramVec
    errors   *prometheus.CounterVec
}

// NewEmailRepository creates a new EmailRepository instance
func NewEmailRepository(db *sql.DB, shardCfg *config.ShardConfig) (*EmailRepository, error) {
    if db == nil {
        return nil, errors.New("database connection is required")
    }

    // Initialize shard manager
    shardMgr, err := NewShardManager(shardCfg)
    if err != nil {
        return nil, errors.Wrap(err, "failed to initialize shard manager")
    }

    // Initialize prepared statements
    stmts, err := prepareStatements(db)
    if err != nil {
        return nil, errors.Wrap(err, "failed to prepare statements")
    }

    repo := &EmailRepository{
        db:            db,
        shardMgr:      shardMgr,
        preparedStmts: stmts,
        metrics: &metrics{
            duration: emailOperationDuration,
            errors:   emailOperationErrors,
        },
    }

    return repo, nil
}

// Create inserts a new email record with proper sharding
func (r *EmailRepository) Create(ctx context.Context, email *models.Email) error {
    timer := prometheus.NewTimer(r.metrics.duration.WithLabelValues("create"))
    defer timer.ObserveDuration()

    if err := email.Validate(); err != nil {
        r.metrics.errors.WithLabelValues("create").Inc()
        return errors.Wrap(err, "invalid email data")
    }

    // Determine shard for email
    shardID := r.shardMgr.GetShardID(email.AccountID)

    // Begin transaction
    tx, err := r.beginTx(ctx)
    if err != nil {
        r.metrics.errors.WithLabelValues("create").Inc()
        return errors.Wrap(err, "failed to begin transaction")
    }
    defer tx.Rollback()

    // Insert email record
    if err := r.insertEmail(ctx, tx, email, shardID); err != nil {
        r.metrics.errors.WithLabelValues("create").Inc()
        return errors.Wrap(err, "failed to insert email")
    }

    // Insert attachments if present
    if len(email.Attachments) > 0 {
        if err := r.insertAttachments(ctx, tx, email.MessageID, email.Attachments); err != nil {
            r.metrics.errors.WithLabelValues("create").Inc()
            return errors.Wrap(err, "failed to insert attachments")
        }
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        r.metrics.errors.WithLabelValues("create").Inc()
        return errors.Wrap(err, "failed to commit transaction")
    }

    return nil
}

// GetByID retrieves an email by its message ID
func (r *EmailRepository) GetByID(ctx context.Context, messageID string, accountID string) (*models.Email, error) {
    timer := prometheus.NewTimer(r.metrics.duration.WithLabelValues("get_by_id"))
    defer timer.ObserveDuration()

    shardID := r.shardMgr.GetShardID(accountID)
    query := r.preparedStmts["get_email_by_id"]

    var email models.Email
    var metadataJSON []byte

    err := query.QueryRowContext(ctx, messageID, shardID).Scan(
        &email.MessageID,
        &email.ThreadID,
        &email.ConversationID,
        &email.ThreadPosition,
        &email.AccountID,
        &email.Subject,
        &email.Content,
        &email.FromAddress,
        pq.Array(&email.ToAddresses),
        pq.Array(&email.CCAddresses),
        pq.Array(&email.BCCAddresses),
        &email.Priority,
        &email.Status,
        pq.Array(&email.Labels),
        &email.FolderPath,
        &email.SentAt,
        &email.ReceivedAt,
        &metadataJSON,
    )

    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        r.metrics.errors.WithLabelValues("get_by_id").Inc()
        return nil, errors.Wrap(err, "failed to get email")
    }

    // Unmarshal metadata
    if err := json.Unmarshal(metadataJSON, &email.Metadata); err != nil {
        r.metrics.errors.WithLabelValues("get_by_id").Inc()
        return nil, errors.Wrap(err, "failed to unmarshal metadata")
    }

    // Load attachments
    attachments, err := r.getAttachments(ctx, messageID)
    if err != nil {
        r.metrics.errors.WithLabelValues("get_by_id").Inc()
        return nil, errors.Wrap(err, "failed to get attachments")
    }
    email.Attachments = attachments

    return &email, nil
}

// beginTx starts a new transaction with retry mechanism
func (r *EmailRepository) beginTx(ctx context.Context) (*sql.Tx, error) {
    var tx *sql.Tx
    var err error

    for attempt := 0; attempt < maxRetries; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(attempt) * retryBackoff)
        }

        tx, err = r.db.BeginTx(ctx, &sql.TxOptions{
            Isolation: sql.LevelSerializable,
        })
        if err == nil {
            return tx, nil
        }

        if !isRetryableError(err) {
            return nil, err
        }
    }

    return nil, errors.Wrap(err, "max retries exceeded")
}

// insertEmail inserts the main email record
func (r *EmailRepository) insertEmail(ctx context.Context, tx *sql.Tx, email *models.Email, shardID int) error {
    metadataJSON, err := json.Marshal(email.Metadata)
    if err != nil {
        return errors.Wrap(err, "failed to marshal metadata")
    }

    _, err = tx.StmtContext(ctx, r.preparedStmts["insert_email"]).ExecContext(ctx,
        email.MessageID,
        email.ThreadID,
        email.ConversationID,
        email.ThreadPosition,
        email.AccountID,
        email.Subject,
        email.Content,
        email.FromAddress,
        pq.Array(email.ToAddresses),
        pq.Array(email.CCAddresses),
        pq.Array(email.BCCAddresses),
        email.Priority,
        email.Status,
        pq.Array(email.Labels),
        email.FolderPath,
        email.SentAt,
        email.ReceivedAt,
        metadataJSON,
        shardID,
    )

    return err
}

// prepareStatements prepares all SQL statements
func prepareStatements(db *sql.DB) (map[string]*sql.Stmt, error) {
    statements := map[string]string{
        "insert_email": `
            INSERT INTO emails (
                message_id, thread_id, conversation_id, thread_position,
                account_id, subject, content, from_address,
                to_addresses, cc_addresses, bcc_addresses,
                priority, status, labels, folder_path,
                sent_at, received_at, metadata, shard_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        "get_email_by_id": `
            SELECT message_id, thread_id, conversation_id, thread_position,
                   account_id, subject, content, from_address,
                   to_addresses, cc_addresses, bcc_addresses,
                   priority, status, labels, folder_path,
                   sent_at, received_at, metadata
            FROM emails
            WHERE message_id = $1 AND shard_id = $2`,
    }

    prepared := make(map[string]*sql.Stmt)
    for name, query := range statements {
        stmt, err := db.Prepare(query)
        if err != nil {
            return nil, errors.Wrapf(err, "failed to prepare statement: %s", name)
        }
        prepared[name] = stmt
    }

    return prepared, nil
}

// isRetryableError checks if an error is retryable
func isRetryableError(err error) bool {
    if pqErr, ok := err.(*pq.Error); ok {
        switch pqErr.Code {
        case "40001", // serialization_failure
             "40P01", // deadlock_detected
             "55P03": // lock_not_available
            return true
        }
    }
    return false
}

// Close closes all prepared statements and connections
func (r *EmailRepository) Close() error {
    for _, stmt := range r.preparedStmts {
        if err := stmt.Close(); err != nil {
            return errors.Wrap(err, "failed to close prepared statement")
        }
    }
    return nil
}