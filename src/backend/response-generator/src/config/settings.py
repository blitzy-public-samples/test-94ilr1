"""
Configuration settings module for the Response Generator service.
Handles environment variables, validation and type safety using Pydantic.

Version: 1.0.0
"""

from pydantic_settings import BaseSettings  # v2.0.0
from pydantic import Field, validator  # v2.4.0
from typing import Optional, Dict, Any
import logging
import re
from logging.handlers import RotatingFileHandler

# Default configuration constants
DEFAULT_MODEL_NAME = "gpt-4"
DEFAULT_MAX_TOKENS = 2048
DEFAULT_TEMPERATURE = 0.7
MIN_CONFIDENCE_SCORE = 0.7
MAX_TEMPLATE_SIZE = 10000
RETRY_ATTEMPTS = 3
RETRY_BACKOFF = 2
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DEFAULT_LOG_LEVEL = "INFO"

# Allowed models for response generation
ALLOWED_MODELS = ["gpt-4", "gpt-3.5-turbo", "gpt-4-32k"]

class Settings(BaseSettings):
    """
    Main settings class for Response Generator service configuration.
    Implements environment variable loading, validation, and type safety.
    """
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key for response generation")
    OPENAI_MODEL_NAME: str = Field(DEFAULT_MODEL_NAME, description="OpenAI model name")
    OPENAI_TEMPERATURE: float = Field(DEFAULT_TEMPERATURE, ge=0.0, le=1.0)
    OPENAI_MAX_TOKENS: int = Field(DEFAULT_MAX_TOKENS, gt=0, le=32000)
    
    # Response Generation Settings
    MIN_CONFIDENCE_THRESHOLD: float = Field(MIN_CONFIDENCE_SCORE, ge=0.0, le=1.0)
    MAX_TEMPLATE_LENGTH: int = Field(MAX_TEMPLATE_SIZE, gt=0)
    
    # Database Configuration
    MONGODB_URI: str = Field(..., description="MongoDB connection URI")
    REDIS_URI: str = Field(..., description="Redis connection URI")
    
    # Service Configuration
    LOG_LEVEL: str = Field(DEFAULT_LOG_LEVEL, regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    API_RATE_LIMIT: int = Field(100, gt=0, description="Requests per minute limit")
    API_TIMEOUT: int = Field(30, gt=0, description="API timeout in seconds")
    MAX_RETRIES: int = Field(RETRY_ATTEMPTS, ge=0)
    RETRY_DELAY: int = Field(RETRY_BACKOFF, gt=0)
    
    # Monitoring and Observability
    TELEMETRY_CONFIG: Dict[str, Any] = Field(
        default_factory=lambda: {
            "metrics_enabled": True,
            "tracing_enabled": True,
            "metrics_interval": 60,
            "trace_sample_rate": 0.1
        }
    )
    
    # Health Check Configuration
    HEALTH_CHECK_CONFIG: Dict[str, Any] = Field(
        default_factory=lambda: {
            "enabled": True,
            "interval": 30,
            "timeout": 5,
            "failure_threshold": 3
        }
    )
    
    # Audit Configuration
    AUDIT_CONFIG: Dict[str, Any] = Field(
        default_factory=lambda: {
            "enabled": True,
            "log_requests": True,
            "log_responses": True,
            "retention_days": 90
        }
    )

    @validator("OPENAI_API_KEY")
    def validate_api_key(cls, v: str) -> str:
        """Validate OpenAI API key format."""
        if not v.startswith("sk-") or len(v) < 20:
            raise ValueError("Invalid OpenAI API key format")
        return v

    @validator("OPENAI_MODEL_NAME")
    def validate_model_name(cls, v: str) -> str:
        """Validate OpenAI model name."""
        if v not in ALLOWED_MODELS:
            raise ValueError(f"Model must be one of: {', '.join(ALLOWED_MODELS)}")
        return v

    @validator("MONGODB_URI")
    def validate_mongodb_uri(cls, v: str) -> str:
        """Validate MongoDB URI format."""
        if not v.startswith("mongodb"):
            raise ValueError("Invalid MongoDB URI format")
        return v

    @validator("REDIS_URI")
    def validate_redis_uri(cls, v: str) -> str:
        """Validate Redis URI format."""
        if not v.startswith("redis"):
            raise ValueError("Invalid Redis URI format")
        return v

    def configure_logging(self) -> None:
        """Configure logging settings for the service."""
        log_level = getattr(logging, self.LOG_LEVEL.upper())
        
        # Create logger
        logger = logging.getLogger("response_generator")
        logger.setLevel(log_level)
        
        # Create formatters and handlers
        formatter = logging.Formatter(LOG_FORMAT)
        
        # File handler with rotation
        file_handler = RotatingFileHandler(
            "response_generator.log",
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        
        # Add handlers to logger
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        # Set logging filter for sensitive data
        class SensitiveDataFilter(logging.Filter):
            def filter(self, record):
                sensitive_patterns = [
                    (r'sk-[a-zA-Z0-9]{48}', 'sk-***'),
                    (r'password=[\w\d@$!%*?&]{8,}', 'password=***')
                ]
                for pattern, replacement in sensitive_patterns:
                    record.msg = re.sub(pattern, replacement, str(record.msg))
                return True
                
        logger.addFilter(SensitiveDataFilter())

    def validate_settings(self) -> bool:
        """Validate all settings meet required criteria."""
        try:
            # Validate OpenAI settings
            self.validate_api_key(self.OPENAI_API_KEY)
            self.validate_model_name(self.OPENAI_MODEL_NAME)
            
            # Validate database URIs
            self.validate_mongodb_uri(self.MONGODB_URI)
            self.validate_redis_uri(self.REDIS_URI)
            
            # Validate numeric ranges
            assert 0.0 <= self.OPENAI_TEMPERATURE <= 1.0
            assert 0.0 <= self.MIN_CONFIDENCE_THRESHOLD <= 1.0
            assert self.API_RATE_LIMIT > 0
            assert self.API_TIMEOUT > 0
            
            return True
        except (AssertionError, ValueError) as e:
            logging.error(f"Settings validation failed: {str(e)}")
            return False

    def initialize_telemetry(self) -> Dict[str, Any]:
        """Initialize telemetry and monitoring configuration."""
        telemetry_config = self.TELEMETRY_CONFIG.copy()
        
        # Configure metrics collection
        if telemetry_config["metrics_enabled"]:
            telemetry_config["metrics_exporters"] = {
                "prometheus": {
                    "port": 9090,
                    "path": "/metrics"
                }
            }
        
        # Configure tracing
        if telemetry_config["tracing_enabled"]:
            telemetry_config["tracing_exporters"] = {
                "jaeger": {
                    "agent_host": "localhost",
                    "agent_port": 6831
                }
            }
        
        return telemetry_config

    class Config:
        """Pydantic configuration class."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
```

This implementation provides a comprehensive settings module for the Response Generator service with the following key features:

1. Environment variable management using Pydantic BaseSettings
2. Strict validation for all configuration parameters
3. Type safety with proper annotations
4. Comprehensive logging configuration with rotation and sensitive data masking
5. Telemetry and monitoring setup
6. Health check configuration
7. Audit logging configuration
8. Extensive validation for critical settings like API keys and URIs

The code follows best practices for production environments:
- Proper error handling and validation
- Secure handling of sensitive information
- Configurable logging with rotation
- Comprehensive documentation
- Type safety throughout
- Flexible configuration options for different environments

The settings can be used by importing the Settings class and instantiating it:
```python
settings = Settings()
settings.configure_logging()
telemetry_config = settings.initialize_telemetry()