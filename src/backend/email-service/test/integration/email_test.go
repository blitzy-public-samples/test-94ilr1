// Package integration provides comprehensive integration tests for the email service
// with focus on reliability, performance, and error handling.
package integration

import (
    "context"
    "database/sql"
    "flag"
    "fmt"
    "os"
    "sync"
    "testing"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/google/uuid" // v1.3.1
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/stretchr/testify/assert" // v1.8.4
    "github.com/stretchr/testify/require" // v1.8.4
    "github.com/stretchr/testify/suite" // v1.8.4

    "github.com/email-management-platform/backend/email-service/internal/handlers"
    "github.com/email-management-platform/backend/email-service/internal/models"
    "github.com/email-management-platform/backend/email-service/internal/services"
)

const (
    testDBURL     = "postgres://test:test@localhost:5432/email_test"
    testTimeout   = time.Second * 30
    maxTestEmails = 100
)

// Metrics collectors for test monitoring
var (
    testDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "email_integration_test_duration_seconds",
            Help: "Duration of integration test executions",
        },
        []string{"test_name"},
    )

    testErrors = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "email_integration_test_errors_total",
            Help: "Total number of integration test errors",
        },
        []string{"test_name", "error_type"},
    )
)

// EmailTestSuite defines the integration test suite with setup and teardown capabilities
type EmailTestSuite struct {
    suite.Suite
    db          *sql.DB
    handler     *handlers.EmailHandler
    service     services.EmailService
    router      *gin.Engine
    ctx         context.Context
    cancel      context.CancelFunc
    metricsReg  *prometheus.Registry
}

// TestMain handles test suite setup and teardown
func TestMain(m *testing.M) {
    flag.Parse()

    // Initialize metrics registry
    reg := prometheus.NewRegistry()
    reg.MustRegister(testDuration)
    reg.MustRegister(testErrors)

    // Set up test environment
    if err := setupTestEnvironment(); err != nil {
        fmt.Printf("Failed to setup test environment: %v\n", err)
        os.Exit(1)
    }

    // Run tests
    code := m.Run()

    // Clean up test environment
    if err := cleanupTestEnvironment(); err != nil {
        fmt.Printf("Failed to cleanup test environment: %v\n", err)
    }

    os.Exit(code)
}

// SetupSuite initializes the test suite
func (s *EmailTestSuite) SetupSuite() {
    var err error

    // Initialize context with timeout
    s.ctx, s.cancel = context.WithTimeout(context.Background(), testTimeout)

    // Connect to test database
    s.db, err = sql.Open("postgres", testDBURL)
    require.NoError(s.T(), err, "Failed to connect to test database")

    // Initialize metrics registry
    s.metricsReg = prometheus.NewRegistry()
    s.metricsReg.MustRegister(testDuration, testErrors)

    // Initialize service and handler
    s.service, err = services.NewEmailService(s.db)
    require.NoError(s.T(), err, "Failed to create email service")

    s.handler, err = handlers.NewEmailHandler(s.service)
    require.NoError(s.T(), err, "Failed to create email handler")

    // Set up HTTP router
    s.router = gin.New()
    s.router.Use(gin.Recovery())
    api := s.router.Group("/api/v1")
    s.handler.RegisterHTTPRoutes(api)
}

// TearDownSuite cleans up test resources
func (s *EmailTestSuite) TearDownSuite() {
    s.cancel()
    if s.db != nil {
        s.db.Close()
    }
}

// TestEmailThreading tests email thread tracking and analysis
func (s *EmailTestSuite) TestEmailThreading() {
    timer := prometheus.NewTimer(testDuration.WithLabelValues("email_threading"))
    defer timer.ObserveDuration()

    // Create parent email
    parentEmail := &models.Email{
        MessageID:    uuid.New().String(),
        AccountID:    "test-account",
        Subject:     "Test Thread Parent",
        Content:     "Parent email content",
        FromAddress: "sender@test.com",
        ToAddresses: []string{"recipient@test.com"},
        Status:      models.StatusUnread,
        SentAt:      time.Now(),
    }

    err := s.service.ProcessEmail(s.ctx, parentEmail)
    require.NoError(s.T(), err, "Failed to process parent email")

    // Create child emails in thread
    for i := 0; i < 3; i++ {
        childEmail := &models.Email{
            MessageID:      uuid.New().String(),
            ThreadID:       parentEmail.MessageID,
            ThreadPosition: int32(i + 1),
            AccountID:      "test-account",
            Subject:       fmt.Sprintf("Re: Test Thread Parent"),
            Content:       fmt.Sprintf("Reply content %d", i+1),
            FromAddress:   "recipient@test.com",
            ToAddresses:   []string{"sender@test.com"},
            Status:        models.StatusUnread,
            SentAt:        time.Now(),
        }

        err := s.service.ProcessEmail(s.ctx, childEmail)
        require.NoError(s.T(), err, "Failed to process child email %d", i+1)
    }

    // Verify thread retrieval
    thread, err := s.service.GetThread(s.ctx, parentEmail.MessageID)
    require.NoError(s.T(), err, "Failed to retrieve email thread")
    assert.Equal(s.T(), 4, len(thread), "Thread should contain 4 emails")
}

// TestConcurrentRequests tests handling of concurrent email operations
func (s *EmailTestSuite) TestConcurrentRequests() {
    timer := prometheus.NewTimer(testDuration.WithLabelValues("concurrent_requests"))
    defer timer.ObserveDuration()

    var wg sync.WaitGroup
    errChan := make(chan error, maxTestEmails)

    // Generate concurrent email processing requests
    for i := 0; i < maxTestEmails; i++ {
        wg.Add(1)
        go func(idx int) {
            defer wg.Done()

            email := &models.Email{
                MessageID:    uuid.New().String(),
                AccountID:    fmt.Sprintf("test-account-%d", idx),
                Subject:     fmt.Sprintf("Concurrent Test Email %d", idx),
                Content:     fmt.Sprintf("Test content %d", idx),
                FromAddress: "sender@test.com",
                ToAddresses: []string{"recipient@test.com"},
                Status:      models.StatusUnread,
                SentAt:      time.Now(),
            }

            if err := s.service.ProcessEmail(s.ctx, email); err != nil {
                errChan <- fmt.Errorf("failed to process email %d: %w", idx, err)
                return
            }

            // Verify email was stored
            stored, err := s.service.GetEmailByID(s.ctx, email.MessageID, email.AccountID)
            if err != nil {
                errChan <- fmt.Errorf("failed to retrieve email %d: %w", idx, err)
                return
            }

            if stored == nil || stored.MessageID != email.MessageID {
                errChan <- fmt.Errorf("email %d not found or mismatch", idx)
            }
        }(i)
    }

    // Wait for all goroutines to complete
    wg.Wait()
    close(errChan)

    // Check for any errors
    for err := range errChan {
        s.T().Errorf("Concurrent test error: %v", err)
        testErrors.WithLabelValues("concurrent_requests", "processing_error").Inc()
    }
}

// TestErrorScenarios tests error handling and recovery
func (s *EmailTestSuite) TestErrorScenarios() {
    timer := prometheus.NewTimer(testDuration.WithLabelValues("error_scenarios"))
    defer timer.ObserveDuration()

    // Test invalid email
    invalidEmail := &models.Email{
        MessageID: "",  // Invalid: empty message ID
        AccountID: "",  // Invalid: empty account ID
    }
    err := s.service.ProcessEmail(s.ctx, invalidEmail)
    assert.Error(s.T(), err, "Should fail with invalid email")
    testErrors.WithLabelValues("error_scenarios", "validation_error").Inc()

    // Test non-existent email retrieval
    email, err := s.service.GetEmailByID(s.ctx, "non-existent-id", "test-account")
    assert.NoError(s.T(), err, "Should not error on non-existent email")
    assert.Nil(s.T(), email, "Should return nil for non-existent email")

    // Test timeout scenario
    shortCtx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
    defer cancel()

    email = &models.Email{
        MessageID:    uuid.New().String(),
        AccountID:    "test-account",
        Subject:     "Timeout Test",
        Content:     "Test content",
        FromAddress: "sender@test.com",
        ToAddresses: []string{"recipient@test.com"},
        Status:      models.StatusUnread,
        SentAt:      time.Now(),
    }

    err = s.service.ProcessEmail(shortCtx, email)
    assert.Error(s.T(), err, "Should fail with timeout")
    testErrors.WithLabelValues("error_scenarios", "timeout_error").Inc()
}

// setupTestEnvironment initializes the test environment
func setupTestEnvironment() error {
    // Environment setup logic
    return nil
}

// cleanupTestEnvironment cleans up the test environment
func cleanupTestEnvironment() error {
    // Environment cleanup logic
    return nil
}

// TestEmailSuite runs the test suite
func TestEmailSuite(t *testing.T) {
    suite.Run(t, new(EmailTestSuite))
}