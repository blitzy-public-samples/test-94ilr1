// Package main provides the entry point for the email service with enhanced
// reliability, monitoring, and performance features.
package main

import (
    "context"
    "fmt"
    "net"
    "net/http"
    "os"
    "os/signal"
    "sync"
    "syscall"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "github.com/sony/gobreaker" // v1.5.0
    "go.uber.org/zap" // v1.26.0
    "golang.org/x/time/rate" // v0.3.0
    "google.golang.org/grpc" // v1.58.2
    "google.golang.org/grpc/health"
    "google.golang.org/grpc/health/grpc_health_v1"
    "google.golang.org/grpc/keepalive"

    "github.com/email-management-platform/backend/email-service/internal/config"
    "github.com/email-management-platform/backend/email-service/internal/handlers"
    "github.com/email-management-platform/backend/email-service/internal/services"
)

const (
    defaultGracePeriod    = time.Second * 30
    defaultMetricsPath    = "/metrics"
    defaultHealthCheckPath = "/health"
    defaultShutdownTimeout = time.Second * 60
    defaultRequestTimeout  = time.Second * 30
)

// Server represents the main server instance with enhanced reliability features
type Server struct {
    cfg            *config.Config
    httpServer     *http.Server
    grpcServer     *grpc.Server
    metricsServer  *http.Server
    healthCheck    *health.Server
    logger         *zap.Logger
    emailService   services.EmailService
    rateLimiter    *rate.Limiter
    circuitBreaker *gobreaker.CircuitBreaker
    shutdownTimeout time.Duration
    wg             sync.WaitGroup
}

// Metrics collectors
var (
    serverUptime = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "email_service_uptime_seconds",
        Help: "Time since server startup in seconds",
    })

    activeConnections = prometheus.NewGaugeVec(prometheus.GaugeOpts{
        Name: "email_service_active_connections",
        Help: "Number of active connections by protocol",
    }, []string{"protocol"})

    requestLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "email_service_request_duration_seconds",
        Help:    "Request duration in seconds",
        Buckets: prometheus.DefBuckets,
    }, []string{"method", "endpoint"})
)

func init() {
    // Register metrics
    prometheus.MustRegister(serverUptime)
    prometheus.MustRegister(activeConnections)
    prometheus.MustRegister(requestLatency)
}

// newServer creates a new server instance with enhanced reliability features
func newServer(cfg *config.Config) (*Server, error) {
    if err := cfg.Validate(); err != nil {
        return nil, fmt.Errorf("invalid configuration: %w", err)
    }

    // Initialize logger
    logger, err := zap.NewProduction()
    if err != nil {
        return nil, fmt.Errorf("failed to initialize logger: %w", err)
    }

    // Initialize rate limiter
    limiter := rate.NewLimiter(rate.Limit(cfg.Security.RateLimit), cfg.Security.BurstLimit)

    // Initialize circuit breaker
    cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        "server_breaker",
        MaxRequests: uint32(cfg.Security.MaxRequests),
        Timeout:     time.Duration(cfg.Security.TimeoutSeconds) * time.Second,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.6
        },
    })

    // Initialize email service
    emailService, err := services.NewEmailService(nil) // Repository would be initialized here
    if err != nil {
        return nil, fmt.Errorf("failed to initialize email service: %w", err)
    }

    // Initialize HTTP router
    router := gin.New()
    router.Use(gin.Recovery())
    
    // Initialize gRPC server with keepalive settings
    grpcServer := grpc.NewServer(
        grpc.KeepaliveParams(keepalive.ServerParameters{
            MaxConnectionIdle:     time.Minute * 5,
            MaxConnectionAge:      time.Hour,
            MaxConnectionAgeGrace: time.Minute,
            Time:                  time.Minute,
            Timeout:              time.Second * 20,
        }),
    )

    // Initialize health check server
    healthCheck := health.NewServer()
    grpc_health_v1.RegisterHealthServer(grpcServer, healthCheck)

    // Create server instance
    server := &Server{
        cfg:            cfg,
        logger:         logger,
        emailService:   emailService,
        rateLimiter:    limiter,
        circuitBreaker: cb,
        healthCheck:    healthCheck,
        shutdownTimeout: defaultShutdownTimeout,
        httpServer: &http.Server{
            Handler:      router,
            ReadTimeout:  defaultRequestTimeout,
            WriteTimeout: defaultRequestTimeout,
        },
        grpcServer: grpcServer,
        metricsServer: &http.Server{
            Handler: promhttp.Handler(),
        },
    }

    // Register HTTP routes
    server.registerHTTPRoutes(router)

    return server, nil
}

// Start initializes and starts all servers with enhanced monitoring
func (s *Server) Start() error {
    // Start uptime tracking
    go func() {
        start := time.Now()
        for {
            serverUptime.Set(time.Since(start).Seconds())
            time.Sleep(time.Second)
        }
    }()

    // Start HTTP server
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        addr := fmt.Sprintf(":%d", s.cfg.Port)
        s.logger.Info("starting HTTP server", zap.String("addr", addr))
        activeConnections.WithLabelValues("http").Inc()
        if err := s.httpServer.ListenAndServe(); err != http.ErrServerClosed {
            s.logger.Error("HTTP server error", zap.Error(err))
        }
        activeConnections.WithLabelValues("http").Dec()
    }()

    // Start gRPC server
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        addr := fmt.Sprintf(":%d", s.cfg.Port+1)
        lis, err := net.Listen("tcp", addr)
        if err != nil {
            s.logger.Error("failed to start gRPC listener", zap.Error(err))
            return
        }
        s.logger.Info("starting gRPC server", zap.String("addr", addr))
        activeConnections.WithLabelValues("grpc").Inc()
        if err := s.grpcServer.Serve(lis); err != nil {
            s.logger.Error("gRPC server error", zap.Error(err))
        }
        activeConnections.WithLabelValues("grpc").Dec()
    }()

    // Start metrics server
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        addr := fmt.Sprintf(":%d", s.cfg.Port+2)
        s.logger.Info("starting metrics server", zap.String("addr", addr))
        if err := s.metricsServer.ListenAndServe(); err != http.ErrServerClosed {
            s.logger.Error("metrics server error", zap.Error(err))
        }
    }()

    return nil
}

// Shutdown performs a graceful shutdown of all servers
func (s *Server) Shutdown(ctx context.Context) error {
    s.logger.Info("initiating graceful shutdown")
    
    // Set health check to not serving
    s.healthCheck.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)

    // Create shutdown context with timeout
    shutdownCtx, cancel := context.WithTimeout(ctx, s.shutdownTimeout)
    defer cancel()

    // Shutdown HTTP server
    if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
        s.logger.Error("HTTP server shutdown error", zap.Error(err))
    }

    // Shutdown gRPC server
    s.grpcServer.GracefulStop()

    // Shutdown metrics server
    if err := s.metricsServer.Shutdown(shutdownCtx); err != nil {
        s.logger.Error("metrics server shutdown error", zap.Error(err))
    }

    // Wait for all goroutines to finish
    waitCh := make(chan struct{})
    go func() {
        s.wg.Wait()
        close(waitCh)
    }()

    select {
    case <-waitCh:
        s.logger.Info("graceful shutdown completed")
    case <-shutdownCtx.Done():
        s.logger.Warn("shutdown deadline exceeded")
    }

    // Flush logger
    return s.logger.Sync()
}

func main() {
    // Initialize logger
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // Load configuration
    cfg, err := config.LoadConfig(".", os.Getenv("ENV"))
    if err != nil {
        logger.Fatal("failed to load configuration", zap.Error(err))
    }

    // Create and start server
    server, err := newServer(cfg)
    if err != nil {
        logger.Fatal("failed to create server", zap.Error(err))
    }

    if err := server.Start(); err != nil {
        logger.Fatal("failed to start server", zap.Error(err))
    }

    // Handle shutdown signals
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    <-sigCh

    // Perform graceful shutdown
    shutdownCtx, cancel := context.WithTimeout(context.Background(), defaultGracePeriod)
    defer cancel()

    if err := server.Shutdown(shutdownCtx); err != nil {
        logger.Error("shutdown error", zap.Error(err))
        os.Exit(1)
    }
}