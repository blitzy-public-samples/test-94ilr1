// Package config provides secure configuration management for the email service
// with enhanced validation, credential handling, and real-time monitoring capabilities.
package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper" // v1.17.0
	"golang.org/x/oauth2/google" // v0.13.0
)

// Constants for configuration defaults and validation
const (
	DefaultPort               = 8080
	DefaultLogLevel          = "info"
	DefaultRequestTimeout    = time.Second * 30
	DefaultShutdownTimeout   = time.Second * 10
	DefaultWatchExpiryDuration = time.Hour * 24
	MinPortNumber           = 1024
	MaxPortNumber           = 65535
)

// Config represents the main configuration structure with enhanced security
// and monitoring capabilities for the email service.
type Config struct {
	Environment      string        `mapstructure:"environment"`
	Port            int           `mapstructure:"port"`
	LogLevel        string        `mapstructure:"log_level"`
	Database        DatabaseConfig `mapstructure:"database"`
	Gmail           GmailConfig   `mapstructure:"gmail"`
	Outlook         OutlookConfig `mapstructure:"outlook"`
	Metrics         MetricsConfig `mapstructure:"metrics"`
	Security        SecurityConfig `mapstructure:"security"`
	RequestTimeout  time.Duration `mapstructure:"request_timeout"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
	Version         string        `mapstructure:"version"`
}

// SecurityConfig holds enhanced security settings for the service
type SecurityConfig struct {
	EncryptionKey           string   `mapstructure:"encryption_key"`
	AllowedOrigins         []string `mapstructure:"allowed_origins"`
	StrictTransportSecurity bool     `mapstructure:"strict_transport_security"`
	SecretManagerProvider   string   `mapstructure:"secret_manager_provider"`
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Name     string `mapstructure:"name"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	SSLMode  string `mapstructure:"ssl_mode"`
}

// GmailConfig holds enhanced Gmail API configuration with real-time capabilities
type GmailConfig struct {
	ClientID            string        `mapstructure:"client_id"`
	ClientSecret        string        `mapstructure:"client_secret"`
	RedirectURL         string        `mapstructure:"redirect_url"`
	Scopes             []string      `mapstructure:"scopes"`
	PubSubTopic        string        `mapstructure:"pubsub_topic"`
	PubSubSubscription string        `mapstructure:"pubsub_subscription"`
	WatchExpiryDuration time.Duration `mapstructure:"watch_expiry_duration"`
}

// OutlookConfig holds Microsoft Graph API configuration
type OutlookConfig struct {
	ClientID     string   `mapstructure:"client_id"`
	ClientSecret string   `mapstructure:"client_secret"`
	RedirectURL  string   `mapstructure:"redirect_url"`
	Scopes       []string `mapstructure:"scopes"`
	TenantID     string   `mapstructure:"tenant_id"`
}

// MetricsConfig holds monitoring and metrics configuration
type MetricsConfig struct {
	Enabled     bool   `mapstructure:"enabled"`
	ServiceName string `mapstructure:"service_name"`
	Endpoint    string `mapstructure:"endpoint"`
}

// LoadConfig loads and validates configuration from multiple sources with secure credential handling
func LoadConfig(configPath string, environment string) (*Config, error) {
	v := viper.New()

	// Set secure defaults
	v.SetDefault("port", DefaultPort)
	v.SetDefault("log_level", DefaultLogLevel)
	v.SetDefault("request_timeout", DefaultRequestTimeout)
	v.SetDefault("shutdown_timeout", DefaultShutdownTimeout)
	v.SetDefault("gmail.watch_expiry_duration", DefaultWatchExpiryDuration)

	// Configure Viper
	v.SetConfigName(fmt.Sprintf("config.%s", environment))
	v.SetConfigType("yaml")
	v.AddConfigPath(configPath)
	v.AddConfigPath(".")

	// Enable environment variable override
	v.AutomaticEnv()
	v.SetEnvPrefix("EMAIL_SERVICE")

	// Load configuration file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Load secure credentials from environment
	loadSecureCredentials(v)

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Set environment
	config.Environment = environment

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// loadSecureCredentials loads sensitive credentials from environment variables
func loadSecureCredentials(v *viper.Viper) {
	// Database credentials
	if dbPass := os.Getenv("EMAIL_SERVICE_DB_PASSWORD"); dbPass != "" {
		v.Set("database.password", dbPass)
	}

	// Gmail credentials
	if gmailSecret := os.Getenv("EMAIL_SERVICE_GMAIL_CLIENT_SECRET"); gmailSecret != "" {
		v.Set("gmail.client_secret", gmailSecret)
	}

	// Outlook credentials
	if outlookSecret := os.Getenv("EMAIL_SERVICE_OUTLOOK_CLIENT_SECRET"); outlookSecret != "" {
		v.Set("outlook.client_secret", outlookSecret)
	}

	// Security credentials
	if encKey := os.Getenv("EMAIL_SERVICE_ENCRYPTION_KEY"); encKey != "" {
		v.Set("security.encryption_key", encKey)
	}
}

// Validate performs comprehensive validation of all configuration values with security checks
func (c *Config) Validate() error {
	// Validate environment
	if c.Environment == "" {
		return fmt.Errorf("environment must be specified")
	}

	// Validate port range
	if c.Port < MinPortNumber || c.Port > MaxPortNumber {
		return fmt.Errorf("port must be between %d and %d", MinPortNumber, MaxPortNumber)
	}

	// Validate log level
	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("invalid log level: %s", c.LogLevel)
	}

	// Validate timeouts
	if c.RequestTimeout < time.Second {
		return fmt.Errorf("request timeout must be at least 1 second")
	}
	if c.ShutdownTimeout < time.Second {
		return fmt.Errorf("shutdown timeout must be at least 1 second")
	}

	// Validate database configuration
	if err := c.validateDatabaseConfig(); err != nil {
		return fmt.Errorf("database config validation failed: %w", err)
	}

	// Validate Gmail configuration
	if err := c.validateGmailConfig(); err != nil {
		return fmt.Errorf("gmail config validation failed: %w", err)
	}

	// Validate Outlook configuration
	if err := c.validateOutlookConfig(); err != nil {
		return fmt.Errorf("outlook config validation failed: %w", err)
	}

	// Validate security configuration
	if err := c.validateSecurityConfig(); err != nil {
		return fmt.Errorf("security config validation failed: %w", err)
	}

	return nil
}

// validateDatabaseConfig validates database configuration
func (c *Config) validateDatabaseConfig() error {
	db := c.Database
	if db.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if db.Port < MinPortNumber || db.Port > MaxPortNumber {
		return fmt.Errorf("invalid database port")
	}
	if db.Name == "" {
		return fmt.Errorf("database name is required")
	}
	if db.User == "" {
		return fmt.Errorf("database user is required")
	}
	if db.Password == "" {
		return fmt.Errorf("database password is required")
	}
	return nil
}

// validateGmailConfig validates Gmail configuration
func (c *Config) validateGmailConfig() error {
	gmail := c.Gmail
	if gmail.ClientID == "" {
		return fmt.Errorf("gmail client ID is required")
	}
	if gmail.ClientSecret == "" {
		return fmt.Errorf("gmail client secret is required")
	}
	if gmail.RedirectURL == "" {
		return fmt.Errorf("gmail redirect URL is required")
	}
	if len(gmail.Scopes) == 0 {
		return fmt.Errorf("gmail scopes are required")
	}
	if gmail.WatchExpiryDuration < time.Hour {
		return fmt.Errorf("gmail watch expiry duration must be at least 1 hour")
	}
	return nil
}

// validateOutlookConfig validates Outlook configuration
func (c *Config) validateOutlookConfig() error {
	outlook := c.Outlook
	if outlook.ClientID == "" {
		return fmt.Errorf("outlook client ID is required")
	}
	if outlook.ClientSecret == "" {
		return fmt.Errorf("outlook client secret is required")
	}
	if outlook.RedirectURL == "" {
		return fmt.Errorf("outlook redirect URL is required")
	}
	if len(outlook.Scopes) == 0 {
		return fmt.Errorf("outlook scopes are required")
	}
	if outlook.TenantID == "" {
		return fmt.Errorf("outlook tenant ID is required")
	}
	return nil
}

// validateSecurityConfig validates security configuration
func (c *Config) validateSecurityConfig() error {
	security := c.Security
	if security.EncryptionKey == "" {
		return fmt.Errorf("encryption key is required")
	}
	if len(security.EncryptionKey) < 32 {
		return fmt.Errorf("encryption key must be at least 32 characters")
	}
	if len(security.AllowedOrigins) == 0 {
		return fmt.Errorf("allowed origins must be specified")
	}
	return nil
}