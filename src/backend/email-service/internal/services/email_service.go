// Package services provides core email processing functionality with enhanced reliability
// and monitoring capabilities for the email management platform.
package services

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/pkg/errors" // v0.9.1
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promauto"
    "golang.org/x/time/rate" // v0.3.0
    "github.com/sony/gobreaker" // v0.5.0
    "github.com/patrickmn/go-cache" // v2.1.0

    "github.com/email-management-platform/backend/email-service/internal/models"
    "github.com/email-management-platform/backend/email-service/internal/repositories"
)

// Constants for service configuration
const (
    defaultPageSize          = 50
    maxRetries              = 3
    retryDelay              = time.Second * 2
    cacheTTL                = time.Minute * 5
    circuitBreakerTimeout   = time.Second * 30
    maxConcurrentRequests   = 100
)

// Metrics collectors
var (
    emailOperationDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name: "email_service_operation_duration_seconds",
        Help: "Duration of email service operations",
        Buckets: prometheus.DefBuckets,
    }, []string{"operation"})

    emailOperationErrors = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "email_service_operation_errors_total",
        Help: "Total number of email service operation errors",
    }, []string{"operation", "error_type"})

    emailOperationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "email_service_operations_total",
        Help: "Total number of email service operations",
    }, []string{"operation", "status"})

    activeRequests = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "email_service_active_requests",
        Help: "Number of currently active requests",
    })
)

// EmailService handles email operations with enhanced reliability and monitoring
type EmailService struct {
    repo            *repositories.EmailRepository
    rateLimiter     *rate.Limiter
    circuitBreaker  *gobreaker.CircuitBreaker
    cache           *cache.Cache
    cacheMutex      *sync.RWMutex
    metrics         *serviceMetrics
}

// serviceMetrics holds service-level metrics
type serviceMetrics struct {
    duration    *prometheus.HistogramVec
    errors      *prometheus.CounterVec
    operations  *prometheus.CounterVec
    active      prometheus.Gauge
}

// NewEmailService creates a new instance of EmailService with enhanced features
func NewEmailService(repo *repositories.EmailRepository) (*EmailService, error) {
    if repo == nil {
        return nil, errors.New("repository is required")
    }

    // Initialize circuit breaker
    cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        "email_service",
        MaxRequests: uint32(maxConcurrentRequests),
        Timeout:     circuitBreakerTimeout,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.6
        },
        OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
            emailOperationErrors.WithLabelValues("circuit_breaker", to.String()).Inc()
        },
    })

    service := &EmailService{
        repo:           repo,
        rateLimiter:    rate.NewLimiter(rate.Limit(maxConcurrentRequests), maxConcurrentRequests),
        circuitBreaker: cb,
        cache:          cache.New(cacheTTL, cacheTTL*2),
        cacheMutex:     &sync.RWMutex{},
        metrics: &serviceMetrics{
            duration:    emailOperationDuration,
            errors:      emailOperationErrors,
            operations:  emailOperationTotal,
            active:      activeRequests,
        },
    }

    return service, nil
}

// ProcessEmail handles email processing with retries and monitoring
func (s *EmailService) ProcessEmail(ctx context.Context, email *models.Email) error {
    timer := prometheus.NewTimer(s.metrics.duration.WithLabelValues("process_email"))
    defer timer.ObserveDuration()

    s.metrics.active.Inc()
    defer s.metrics.active.Dec()

    // Apply rate limiting
    if err := s.rateLimiter.Wait(ctx); err != nil {
        s.metrics.errors.WithLabelValues("process_email", "rate_limit").Inc()
        return errors.Wrap(err, "rate limit exceeded")
    }

    // Execute with circuit breaker
    _, err := s.circuitBreaker.Execute(func() (interface{}, error) {
        return nil, s.processEmailWithRetry(ctx, email)
    })

    if err != nil {
        s.metrics.errors.WithLabelValues("process_email", "execution").Inc()
        s.metrics.operations.WithLabelValues("process_email", "failure").Inc()
        return errors.Wrap(err, "failed to process email")
    }

    s.metrics.operations.WithLabelValues("process_email", "success").Inc()
    return nil
}

// processEmailWithRetry implements retry logic for email processing
func (s *EmailService) processEmailWithRetry(ctx context.Context, email *models.Email) error {
    var lastErr error

    for attempt := 0; attempt < maxRetries; attempt++ {
        if attempt > 0 {
            select {
            case <-ctx.Done():
                return ctx.Err()
            case <-time.After(retryDelay * time.Duration(attempt)):
            }
        }

        if err := s.repo.Create(ctx, email); err != nil {
            lastErr = err
            s.metrics.errors.WithLabelValues("process_email_retry", fmt.Sprintf("attempt_%d", attempt+1)).Inc()
            continue
        }

        // Cache successful result
        s.cacheEmail(email)
        return nil
    }

    return errors.Wrap(lastErr, "max retries exceeded")
}

// GetEmailByID retrieves an email by ID with caching
func (s *EmailService) GetEmailByID(ctx context.Context, messageID, accountID string) (*models.Email, error) {
    timer := prometheus.NewTimer(s.metrics.duration.WithLabelValues("get_email"))
    defer timer.ObserveDuration()

    s.metrics.active.Inc()
    defer s.metrics.active.Dec()

    // Check cache first
    if email := s.getCachedEmail(messageID); email != nil {
        s.metrics.operations.WithLabelValues("get_email", "cache_hit").Inc()
        return email, nil
    }

    // Execute with circuit breaker
    result, err := s.circuitBreaker.Execute(func() (interface{}, error) {
        return s.repo.GetByID(ctx, messageID, accountID)
    })

    if err != nil {
        s.metrics.errors.WithLabelValues("get_email", "execution").Inc()
        s.metrics.operations.WithLabelValues("get_email", "failure").Inc()
        return nil, errors.Wrap(err, "failed to get email")
    }

    email := result.(*models.Email)
    if email != nil {
        s.cacheEmail(email)
    }

    s.metrics.operations.WithLabelValues("get_email", "success").Inc()
    return email, nil
}

// cacheEmail stores email in cache
func (s *EmailService) cacheEmail(email *models.Email) {
    s.cacheMutex.Lock()
    defer s.cacheMutex.Unlock()
    s.cache.Set(email.MessageID, email, cache.DefaultExpiration)
}

// getCachedEmail retrieves email from cache
func (s *EmailService) getCachedEmail(messageID string) *models.Email {
    s.cacheMutex.RLock()
    defer s.cacheMutex.RUnlock()
    
    if cached, found := s.cache.Get(messageID); found {
        return cached.(*models.Email)
    }
    return nil
}

// GetHealth returns the service health status
func (s *EmailService) GetHealth() map[string]interface{} {
    return map[string]interface{}{
        "status":           "healthy",
        "circuit_breaker": s.circuitBreaker.State().String(),
        "active_requests": s.metrics.active.Value(),
        "cache_items":     s.cache.ItemCount(),
    }
}

// GetMetrics returns service metrics
func (s *EmailService) GetMetrics() map[string]float64 {
    return map[string]float64{
        "active_requests": s.metrics.active.Value(),
        "error_rate":     s.metrics.errors.WithLabelValues("process_email", "execution").Value(),
        "success_rate":   s.metrics.operations.WithLabelValues("process_email", "success").Value(),
    }
}