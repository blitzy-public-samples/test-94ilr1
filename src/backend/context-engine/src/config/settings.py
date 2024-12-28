"""
Configuration settings for the Context Engine service.
Manages environment variables, database connections, API settings, and operational parameters.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import os
from typing import Dict, Optional, Any
from pydantic import BaseSettings, Field, validator
from python_dotenv import load_dotenv  # version: 1.0.0

from ..models.context import MIN_CONFIDENCE_SCORE, MAX_CONFIDENCE_SCORE

# Load environment variables from .env file
load_dotenv()

# Global constants
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_BATCH_SIZE = 100
DEFAULT_CACHE_TTL = 3600  # 1 hour in seconds
ALLOWED_ENVIRONMENTS = ["development", "staging", "production"]
MIN_POOL_SIZE = 5
MAX_REQUEST_TIMEOUT = 30  # seconds

class Settings(BaseSettings):
    """
    Pydantic settings class for Context Engine configuration with comprehensive validation.
    Implements environment-specific settings with security features.
    """
    
    # Application settings
    APP_NAME: str = Field(default="context-engine", description="Name of the application")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    ENV: str = Field(default="development", description="Environment name")
    LOG_LEVEL: str = Field(default=DEFAULT_LOG_LEVEL, description="Logging level")
    
    # MongoDB settings
    MONGODB_URI: str = Field(..., description="MongoDB connection URI")
    MONGODB_POOL_SIZE: int = Field(default=MIN_POOL_SIZE, ge=MIN_POOL_SIZE, description="MongoDB connection pool size")
    
    # Redis settings
    REDIS_HOST: str = Field(..., description="Redis host address")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_PASSWORD: str = Field(..., description="Redis password")
    CACHE_TTL: int = Field(default=DEFAULT_CACHE_TTL, description="Cache TTL in seconds")
    
    # NLP service settings
    NLP_SERVICE_URL: str = Field(..., description="NLP service endpoint URL")
    NLP_API_KEY: str = Field(..., description="NLP service API key")
    
    # Context engine settings
    MIN_CONFIDENCE_SCORE: float = Field(default=MIN_CONFIDENCE_SCORE, description="Minimum confidence score threshold")
    MAX_CONFIDENCE_SCORE: float = Field(default=MAX_CONFIDENCE_SCORE, description="Maximum confidence score threshold")
    BATCH_SIZE: int = Field(default=DEFAULT_BATCH_SIZE, description="Batch processing size")
    MAX_WORKERS: int = Field(default=10, description="Maximum number of worker threads")
    REQUEST_TIMEOUT: int = Field(default=MAX_REQUEST_TIMEOUT, description="Request timeout in seconds")
    
    # Security settings
    ENABLE_SENSITIVE_LOGGING: bool = Field(default=False, description="Enable sensitive data logging")
    
    # Version control
    CONFIG_VERSION: str = Field(default="1.0.0", description="Configuration version")
    
    # Feature flags
    FEATURE_FLAGS: Dict[str, bool] = Field(
        default_factory=lambda: {
            "enable_deep_analysis": True,
            "enable_historical_context": True,
            "enable_relationship_mapping": True
        },
        description="Feature flags configuration"
    )

    @validator("ENV")
    def validate_environment(cls, v: str) -> str:
        """Validate environment name against allowed values."""
        if v not in ALLOWED_ENVIRONMENTS:
            raise ValueError(f"Environment must be one of: {ALLOWED_ENVIRONMENTS}")
        return v

    @validator("MONGODB_URI")
    def validate_mongodb_uri(cls, v: str) -> str:
        """Validate MongoDB URI format."""
        if not v.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("Invalid MongoDB URI format")
        return v

    @validator("REDIS_PASSWORD")
    def validate_redis_password(cls, v: str) -> str:
        """Validate Redis password complexity."""
        if len(v) < 16:
            raise ValueError("Redis password must be at least 16 characters long")
        return v

    @validator("MIN_CONFIDENCE_SCORE", "MAX_CONFIDENCE_SCORE")
    def validate_confidence_scores(cls, v: float, values: Dict[str, Any]) -> float:
        """Validate confidence score ranges."""
        if v < MIN_CONFIDENCE_SCORE or v > MAX_CONFIDENCE_SCORE:
            raise ValueError(f"Confidence score must be between {MIN_CONFIDENCE_SCORE} and {MAX_CONFIDENCE_SCORE}")
        return v

    def get_mongodb_settings(self) -> Dict[str, Any]:
        """Returns MongoDB connection settings with security configurations."""
        return {
            "uri": self.MONGODB_URI,
            "minPoolSize": self.MONGODB_POOL_SIZE,
            "maxPoolSize": self.MONGODB_POOL_SIZE * 2,
            "connectTimeoutMS": 5000,
            "serverSelectionTimeoutMS": 5000,
            "ssl": True,
            "ssl_cert_reqs": "CERT_REQUIRED",
            "retryWrites": True,
            "w": "majority"
        }

    def get_redis_settings(self) -> Dict[str, Any]:
        """Returns Redis connection settings with security configurations."""
        return {
            "host": self.REDIS_HOST,
            "port": self.REDIS_PORT,
            "password": self.REDIS_PASSWORD,
            "ssl": True,
            "ssl_cert_reqs": "CERT_REQUIRED",
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30
        }

    def validate_settings(self) -> bool:
        """Validates all settings against security and operational requirements."""
        try:
            # Validate environment
            self.validate_environment(self.ENV)
            
            # Validate MongoDB settings
            self.validate_mongodb_uri(self.MONGODB_URI)
            
            # Validate Redis settings
            self.validate_redis_password(self.REDIS_PASSWORD)
            
            # Validate confidence scores
            self.validate_confidence_scores(self.MIN_CONFIDENCE_SCORE, {})
            self.validate_confidence_scores(self.MAX_CONFIDENCE_SCORE, {})
            
            return True
        except Exception as e:
            raise ValueError(f"Settings validation failed: {str(e)}")

# Create and validate settings instance
settings = Settings()
settings.validate_settings()