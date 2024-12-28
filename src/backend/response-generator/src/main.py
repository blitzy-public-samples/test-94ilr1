"""
Response Generator Service Main Module

Implements the main FastAPI application with comprehensive monitoring, security middleware,
and production-ready configuration for automated email response generation.

Version: 1.0.0
License: MIT
"""

import logging
import sys
import signal
from typing import Dict, Any
import uvicorn  # v0.23.0
from fastapi import FastAPI, Request, Response  # v0.104.0
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import start_http_server, Counter, Histogram  # v0.17.0
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentation  # v0.41b0
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
import sentry_sdk  # v1.32.0
from redis import Redis  # v5.0.1

from .config.settings import Settings, configure_logging, validate_settings
from .api.routes import router as api_router
from .services.generator import ResponseGenerator

# Initialize settings and logging
settings = Settings()
configure_logging()
logger = logging.getLogger(__name__)

# Initialize metrics
response_time_metric = Histogram(
    'response_generation_time_seconds',
    'Time spent generating responses',
    ['endpoint', 'status']
)
error_counter = Counter(
    'response_generation_errors_total',
    'Total number of response generation errors',
    ['type']
)

def configure_monitoring() -> None:
    """Configure comprehensive monitoring, tracing and error tracking."""
    # Initialize Prometheus metrics server
    start_http_server(9090)
    
    # Configure OpenTelemetry tracing
    trace.set_tracer_provider(TracerProvider())
    jaeger_exporter = JaegerExporter(
        agent_host_name="jaeger",
        agent_port=6831,
    )
    trace.get_tracer_provider().add_span_processor(
        BatchSpanProcessor(jaeger_exporter)
    )
    FastAPIInstrumentation().instrument()
    
    # Configure Sentry error tracking
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1,
        enable_tracing=True
    )
    
    logger.info("Monitoring systems configured successfully")

def configure_app(app: FastAPI) -> FastAPI:
    """
    Configure FastAPI application with comprehensive middleware and routes.
    
    Args:
        app: FastAPI application instance
        
    Returns:
        FastAPI: Configured application
    """
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Add custom request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        with logger.contextvars.bind(request_id=request_id):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
    
    # Add response time tracking middleware
    @app.middleware("http")
    async def track_response_time(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        response_time_metric.labels(
            endpoint=request.url.path,
            status=response.status_code
        ).observe(duration)
        return response
    
    # Register API routes
    app.include_router(
        api_router,
        prefix="/api/v1",
        tags=["response-generator"]
    )
    
    return app

async def health_check() -> Dict[str, Any]:
    """
    Enhanced health check endpoint for kubernetes probes.
    
    Returns:
        Dict[str, Any]: Detailed health status
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "services": {}
    }
    
    try:
        # Check Redis connection
        redis_client = Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            socket_timeout=5
        )
        redis_client.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Add memory usage
    import psutil
    memory = psutil.Process().memory_info()
    health_status["metrics"] = {
        "memory_usage_mb": memory.rss / 1024 / 1024,
        "cpu_percent": psutil.cpu_percent()
    }
    
    return health_status

def handle_shutdown(signum: int, frame: Any) -> None:
    """
    Handle graceful shutdown on SIGTERM/SIGINT.
    
    Args:
        signum: Signal number
        frame: Current stack frame
    """
    logger.info(f"Received shutdown signal {signum}")
    sys.exit(0)

def main() -> None:
    """
    Main entry point for the response generator service.
    Configures and starts the FastAPI application with all required middleware.
    """
    try:
        # Validate settings
        if not validate_settings():
            logger.error("Settings validation failed")
            sys.exit(1)
            
        # Configure monitoring
        configure_monitoring()
        
        # Initialize FastAPI app
        app = FastAPI(
            title="Response Generator Service",
            version="1.0.0",
            docs_url="/api/docs",
            redoc_url="/api/redoc"
        )
        
        # Configure app with middleware and routes
        app = configure_app(app)
        
        # Add health check endpoint
        app.get("/health", tags=["monitoring"])(health_check)
        app.get("/readiness", tags=["monitoring"])(health_check)
        
        # Register shutdown handlers
        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)
        
        # Start application
        logger.info("Starting Response Generator service")
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            workers=settings.WORKERS,
            loop="uvloop",
            log_config=None  # Use our custom logging config
        )
        
    except Exception as e:
        logger.error(f"Failed to start service: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()