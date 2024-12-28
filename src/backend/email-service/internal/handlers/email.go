// Package handlers provides HTTP and gRPC handlers for email service endpoints
// with enhanced reliability, monitoring, and error handling features.
package handlers

import (
    "context"
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/sony/gobreaker" // v0.5.0
    "github.com/pkg/errors" // v0.9.1
    "golang.org/x/time/rate" // v0.3.0
    "google.golang.org/grpc" // v1.58.2
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    "github.com/email-management-platform/backend/email-service/internal/models"
    "github.com/email-management-platform/backend/email-service/internal/services"
)

const (
    defaultPageSize = 50
    maxPageSize    = 100
    defaultTimeout = 30 * time.Second
    maxRetries     = 3
)

// Metrics collectors
var (
    requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name: "email_handler_request_duration_seconds",
        Help: "Duration of email handler requests",
        Buckets: prometheus.DefBuckets,
    }, []string{"method", "status"})

    requestErrors = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "email_handler_errors_total",
        Help: "Total number of email handler errors",
    }, []string{"method", "error_type"})

    activeRequests = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "email_handler_active_requests",
        Help: "Number of currently active requests",
    })
)

// EmailHandler handles email-related HTTP/gRPC endpoints with reliability features
type EmailHandler struct {
    emailService services.EmailService
    breaker     *gobreaker.CircuitBreaker
    rateLimiter *rate.Limiter
    metrics     *handlerMetrics
}

type handlerMetrics struct {
    duration *prometheus.HistogramVec
    errors   *prometheus.CounterVec
    active   prometheus.Gauge
}

// NewEmailHandler creates a new instance of EmailHandler with required dependencies
func NewEmailHandler(emailService services.EmailService) (*EmailHandler, error) {
    if emailService == nil {
        return nil, errors.New("email service is required")
    }

    // Initialize circuit breaker
    cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        "email_handler",
        MaxRequests: uint32(maxPageSize),
        Timeout:     defaultTimeout,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.6
        },
    })

    // Initialize rate limiter
    limiter := rate.NewLimiter(rate.Limit(100), maxPageSize)

    handler := &EmailHandler{
        emailService: emailService,
        breaker:     cb,
        rateLimiter: limiter,
        metrics: &handlerMetrics{
            duration: requestDuration,
            errors:   requestErrors,
            active:   activeRequests,
        },
    }

    return handler, nil
}

// RegisterHTTPRoutes registers HTTP routes with middleware and monitoring
func (h *EmailHandler) RegisterHTTPRoutes(router *gin.RouterGroup) {
    if router == nil {
        return
    }

    // Add middleware
    router.Use(h.metricsMiddleware())
    router.Use(h.rateLimitMiddleware())
    router.Use(h.circuitBreakerMiddleware())

    // Register routes
    router.GET("/emails/:messageId", h.handleGetEmail)
    router.GET("/emails", h.handleListEmails)
    router.POST("/emails", h.handleSendEmail)
    router.DELETE("/emails/:messageId", h.handleDeleteEmail)
    router.PUT("/emails/:messageId/labels", h.handleUpdateLabels)
    router.PUT("/emails/:messageId/folder", h.handleMoveToFolder)
    router.GET("/threads/:threadId", h.handleGetThread)
}

// RegisterGRPCServer registers gRPC server methods with monitoring
func (h *EmailHandler) RegisterGRPCServer(server *grpc.Server) {
    if server == nil {
        return
    }

    // Register gRPC service implementation
    // Note: Actual implementation would be in a separate protobuf-generated file
}

// HTTP handler implementations

func (h *EmailHandler) handleGetEmail(c *gin.Context) {
    timer := prometheus.NewTimer(h.metrics.duration.WithLabelValues("get_email", ""))
    defer timer.ObserveDuration()

    h.metrics.active.Inc()
    defer h.metrics.active.Dec()

    messageID := c.Param("messageId")
    accountID := c.GetHeader("X-Account-ID")

    if messageID == "" || accountID == "" {
        h.metrics.errors.WithLabelValues("get_email", "invalid_request").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "missing required parameters"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), defaultTimeout)
    defer cancel()

    email, err := h.emailService.GetEmailByID(ctx, messageID, accountID)
    if err != nil {
        h.metrics.errors.WithLabelValues("get_email", "internal_error").Inc()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get email"})
        return
    }

    if email == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "email not found"})
        return
    }

    c.JSON(http.StatusOK, email)
}

func (h *EmailHandler) handleListEmails(c *gin.Context) {
    timer := prometheus.NewTimer(h.metrics.duration.WithLabelValues("list_emails", ""))
    defer timer.ObserveDuration()

    h.metrics.active.Inc()
    defer h.metrics.active.Dec()

    accountID := c.GetHeader("X-Account-ID")
    if accountID == "" {
        h.metrics.errors.WithLabelValues("list_emails", "invalid_request").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "missing account ID"})
        return
    }

    pageSize := defaultPageSize
    if size := c.Query("pageSize"); size != "" {
        if parsed, err := strconv.Atoi(size); err == nil && parsed > 0 {
            pageSize = min(parsed, maxPageSize)
        }
    }

    options := &services.ListEmailsOptions{
        AccountID:  accountID,
        PageSize:   pageSize,
        PageToken:  c.Query("pageToken"),
        FolderPath: c.Query("folderPath"),
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), defaultTimeout)
    defer cancel()

    emails, err := h.emailService.ListEmails(ctx, options)
    if err != nil {
        h.metrics.errors.WithLabelValues("list_emails", "internal_error").Inc()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list emails"})
        return
    }

    c.JSON(http.StatusOK, emails)
}

// Middleware implementations

func (h *EmailHandler) metricsMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        duration := time.Since(start)

        h.metrics.duration.WithLabelValues(
            c.Request.Method,
            strconv.Itoa(c.Writer.Status()),
        ).Observe(duration.Seconds())
    }
}

func (h *EmailHandler) rateLimitMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if !h.rateLimiter.Allow() {
            h.metrics.errors.WithLabelValues(c.Request.Method, "rate_limit").Inc()
            c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
            c.Abort()
            return
        }
        c.Next()
    }
}

func (h *EmailHandler) circuitBreakerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        _, err := h.breaker.Execute(func() (interface{}, error) {
            c.Next()
            if c.Writer.Status() >= 500 {
                return nil, errors.New("server error")
            }
            return nil, nil
        })

        if err != nil {
            h.metrics.errors.WithLabelValues(c.Request.Method, "circuit_breaker").Inc()
            c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service temporarily unavailable"})
            c.Abort()
            return
        }
    }
}

// Helper functions

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}