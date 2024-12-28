// Package main provides the entry point for the email service with enhanced
// reliability, monitoring, and performance features.
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    "time"

    "go.uber.org/zap" // v1.26.0
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promauto"

    "github.com/email-management-platform/backend/email-service/internal/config"
    "github.com/email-management-platform/backend/email-service/cmd/server"
)

// Configuration defaults
const (
    defaultConfigPath     = "./config/config.yaml"
    defaultShutdownTimeout = time.Second * 30
    defaultStartupRetries = 3
    defaultRetryDelay     = time.Second * 5
)

// Metrics collectors
var (
    serverStartupTime = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "email_service_startup_timestamp",
        Help: "Timestamp when the server started",
    })

    serverShutdownTime = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "email_service_shutdown_timestamp",
        Help: "Timestamp when the server shut down",
    })

    startupAttempts = promauto.NewCounter(prometheus.CounterOpts{
        Name: "email_service_startup_attempts_total",
        Help: "Total number of server startup attempts",
    })

    startupErrors = promauto.NewCounter(prometheus.CounterOpts{
        Name: "email_service_startup_errors_total",
        Help: "Total number of server startup errors",
    })
)

func main() {
    // Initialize production logger
    logger, err := zap.NewProduction()
    if err != nil {
        panic("failed to initialize logger: " + err.Error())
    }
    defer logger.Sync()

    // Load configuration
    cfg, err := config.LoadConfig(".", os.Getenv("ENV"))
    if err != nil {
        logger.Fatal("failed to load configuration",
            zap.Error(err),
            zap.String("config_path", defaultConfigPath),
        )
    }

    // Initialize server with retry mechanism
    srv, err := initializeServer(cfg, logger)
    if err != nil {
        logger.Fatal("failed to initialize server",
            zap.Error(err),
            zap.Int("max_retries", defaultStartupRetries),
        )
    }

    // Record startup time
    serverStartupTime.SetToCurrentTime()

    // Start server in a goroutine
    go func() {
        if err := srv.Start(); err != nil {
            logger.Error("server error", zap.Error(err))
            os.Exit(1)
        }
    }()

    // Set up signal handling for graceful shutdown
    sigChan := setupSignalHandler()

    // Wait for shutdown signal
    sig := <-sigChan
    logger.Info("received shutdown signal",
        zap.String("signal", sig.String()),
    )

    // Record shutdown time
    serverShutdownTime.SetToCurrentTime()

    // Create shutdown context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), defaultShutdownTimeout)
    defer cancel()

    // Initiate graceful shutdown
    if err := srv.Shutdown(ctx); err != nil {
        logger.Error("failed to shutdown server gracefully",
            zap.Error(err),
            zap.Duration("timeout", defaultShutdownTimeout),
        )
        os.Exit(1)
    }

    logger.Info("server shutdown completed successfully")
}

// setupSignalHandler creates a channel to handle OS signals for graceful shutdown
func setupSignalHandler() chan os.Signal {
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan,
        syscall.SIGTERM, // Kubernetes termination
        syscall.SIGINT,  // Ctrl+C
        syscall.SIGQUIT, // Ctrl+\
    )
    return sigChan
}

// initializeServer attempts to initialize the server with retries
func initializeServer(cfg *config.Config, logger *zap.Logger) (*server.Server, error) {
    var srv *server.Server
    var err error

    for attempt := 1; attempt <= defaultStartupRetries; attempt++ {
        startupAttempts.Inc()

        srv, err = server.NewServer(cfg)
        if err == nil {
            return srv, nil
        }

        startupErrors.Inc()
        logger.Warn("server initialization attempt failed",
            zap.Error(err),
            zap.Int("attempt", attempt),
            zap.Int("max_attempts", defaultStartupRetries),
        )

        if attempt < defaultStartupRetries {
            time.Sleep(defaultRetryDelay * time.Duration(attempt))
        }
    }

    return nil, err
}