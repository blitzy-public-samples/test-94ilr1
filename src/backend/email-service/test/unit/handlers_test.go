// Package unit provides comprehensive unit tests for email service handlers
// with extensive error scenario coverage and reliability testing.
package unit

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/http/httptest"
    "sync"
    "testing"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/stretchr/testify/assert" // v1.8.4
    "github.com/stretchr/testify/mock" // v1.8.4
    "github.com/stretchr/testify/require" // v1.8.4

    "github.com/email-management-platform/backend/email-service/internal/handlers"
    "github.com/email-management-platform/backend/email-service/internal/models"
    "github.com/email-management-platform/backend/email-service/internal/services"
)

const (
    testTimeout    = 5 * time.Second
    testAccountID  = "test-account-123"
    testMessageID  = "test-message-456"
    testThreadID   = "test-thread-789"
    maxConcurrentTests = 10
)

// MockEmailService provides a mock implementation of the EmailService interface
type MockEmailService struct {
    mock.Mock
    mutex   sync.Mutex
    timeout time.Duration
}

// NewMockEmailService creates a new mock service with configurable behavior
func NewMockEmailService(timeout time.Duration) *MockEmailService {
    return &MockEmailService{
        timeout: timeout,
    }
}

// GetEmailByID implements the EmailService interface with timeout simulation
func (m *MockEmailService) GetEmailByID(ctx context.Context, messageID, accountID string) (*models.Email, error) {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    // Simulate timeout if configured
    if m.timeout > 0 {
        time.Sleep(m.timeout)
    }

    args := m.Called(ctx, messageID, accountID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.Email), args.Error(1)
}

// ListEmails implements the EmailService interface with pagination support
func (m *MockEmailService) ListEmails(ctx context.Context, opts *services.ListEmailsOptions) (*services.ListEmailsResponse, error) {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    args := m.Called(ctx, opts)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*services.ListEmailsResponse), args.Error(1)
}

// setupTestRouter creates a test router with the email handler
func setupTestRouter(mockService *MockEmailService) (*gin.Engine, *handlers.EmailHandler) {
    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.Use(gin.Recovery())

    handler, err := handlers.NewEmailHandler(mockService)
    if err != nil {
        panic(fmt.Sprintf("failed to create handler: %v", err))
    }

    group := router.Group("/api/v1")
    handler.RegisterHTTPRoutes(group)

    return router, handler
}

// TestNewEmailHandler tests EmailHandler creation with dependency validation
func TestNewEmailHandler(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name        string
        service     services.EmailService
        expectError bool
    }{
        {
            name:        "Valid service dependency",
            service:     NewMockEmailService(0),
            expectError: false,
        },
        {
            name:        "Nil service dependency",
            service:     nil,
            expectError: true,
        },
    }

    for _, tt := range tests {
        tt := tt // Capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()

            handler, err := handlers.NewEmailHandler(tt.service)
            if tt.expectError {
                assert.Error(t, err)
                assert.Nil(t, handler)
            } else {
                assert.NoError(t, err)
                assert.NotNil(t, handler)
            }
        })
    }
}

// TestGetEmail tests the GetEmail handler with various scenarios
func TestGetEmail(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name           string
        messageID      string
        accountID      string
        setupMock      func(*MockEmailService)
        expectedStatus int
        expectedBody   string
    }{
        {
            name:      "Successful email retrieval",
            messageID: testMessageID,
            accountID: testAccountID,
            setupMock: func(m *MockEmailService) {
                m.On("GetEmailByID", mock.Anything, testMessageID, testAccountID).Return(
                    &models.Email{
                        MessageID: testMessageID,
                        AccountID: testAccountID,
                        Subject:   "Test Email",
                    },
                    nil,
                )
            },
            expectedStatus: http.StatusOK,
            expectedBody:   `{"message_id":"test-message-456","account_id":"test-account-123","subject":"Test Email"}`,
        },
        {
            name:      "Missing message ID",
            messageID: "",
            accountID: testAccountID,
            setupMock: func(m *MockEmailService) {},
            expectedStatus: http.StatusBadRequest,
            expectedBody:   `{"error":"missing required parameters"}`,
        },
        {
            name:      "Email not found",
            messageID: testMessageID,
            accountID: testAccountID,
            setupMock: func(m *MockEmailService) {
                m.On("GetEmailByID", mock.Anything, testMessageID, testAccountID).Return(nil, nil)
            },
            expectedStatus: http.StatusNotFound,
            expectedBody:   `{"error":"email not found"}`,
        },
        {
            name:      "Service error",
            messageID: testMessageID,
            accountID: testAccountID,
            setupMock: func(m *MockEmailService) {
                m.On("GetEmailByID", mock.Anything, testMessageID, testAccountID).Return(
                    nil,
                    fmt.Errorf("internal error"),
                )
            },
            expectedStatus: http.StatusInternalServerError,
            expectedBody:   `{"error":"failed to get email"}`,
        },
    }

    for _, tt := range tests {
        tt := tt // Capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()

            mockService := NewMockEmailService(0)
            tt.setupMock(mockService)

            router, _ := setupTestRouter(mockService)
            w := httptest.NewRecorder()
            req, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/emails/%s", tt.messageID), nil)
            req.Header.Set("X-Account-ID", tt.accountID)

            router.ServeHTTP(w, req)

            assert.Equal(t, tt.expectedStatus, w.Code)
            assert.JSONEq(t, tt.expectedBody, w.Body.String())
            mockService.AssertExpectations(t)
        })
    }
}

// TestListEmails tests the ListEmails handler with pagination and filtering
func TestListEmails(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name           string
        accountID      string
        queryParams    map[string]string
        setupMock      func(*MockEmailService)
        expectedStatus int
        expectedBody   string
    }{
        {
            name:      "Successful emails listing",
            accountID: testAccountID,
            queryParams: map[string]string{
                "pageSize": "10",
                "pageToken": "next-page",
            },
            setupMock: func(m *MockEmailService) {
                m.On("ListEmails", mock.Anything, &services.ListEmailsOptions{
                    AccountID: testAccountID,
                    PageSize:  10,
                    PageToken: "next-page",
                }).Return(
                    &services.ListEmailsResponse{
                        Emails: []*models.Email{
                            {
                                MessageID: testMessageID,
                                Subject:   "Test Email",
                            },
                        },
                        NextPageToken: "next-token",
                        TotalCount:    1,
                    },
                    nil,
                )
            },
            expectedStatus: http.StatusOK,
            expectedBody: `{
                "emails": [{
                    "message_id": "test-message-456",
                    "subject": "Test Email"
                }],
                "next_page_token": "next-token",
                "total_count": 1
            }`,
        },
        {
            name:      "Missing account ID",
            accountID: "",
            queryParams: map[string]string{
                "pageSize": "10",
            },
            setupMock:      func(m *MockEmailService) {},
            expectedStatus: http.StatusBadRequest,
            expectedBody:   `{"error":"missing account ID"}`,
        },
        {
            name:      "Invalid page size",
            accountID: testAccountID,
            queryParams: map[string]string{
                "pageSize": "invalid",
            },
            setupMock: func(m *MockEmailService) {
                m.On("ListEmails", mock.Anything, &services.ListEmailsOptions{
                    AccountID: testAccountID,
                    PageSize:  50, // Default page size
                }).Return(
                    &services.ListEmailsResponse{
                        Emails:     []*models.Email{},
                        TotalCount: 0,
                    },
                    nil,
                )
            },
            expectedStatus: http.StatusOK,
            expectedBody:   `{"emails":[],"total_count":0}`,
        },
    }

    for _, tt := range tests {
        tt := tt // Capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()

            mockService := NewMockEmailService(0)
            tt.setupMock(mockService)

            router, _ := setupTestRouter(mockService)
            w := httptest.NewRecorder()

            // Build query string
            url := "/api/v1/emails"
            if len(tt.queryParams) > 0 {
                url += "?"
                for k, v := range tt.queryParams {
                    url += fmt.Sprintf("%s=%s&", k, v)
                }
            }

            req, _ := http.NewRequest(http.MethodGet, url, nil)
            if tt.accountID != "" {
                req.Header.Set("X-Account-ID", tt.accountID)
            }

            router.ServeHTTP(w, req)

            assert.Equal(t, tt.expectedStatus, w.Code)
            assert.JSONEq(t, tt.expectedBody, w.Body.String())
            mockService.AssertExpectations(t)
        })
    }
}