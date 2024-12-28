"""
Main entry point for the Context Engine service.
Initializes FastAPI application with comprehensive monitoring, observability, and high-availability features.

@version: 1.0.0
@author: AI Email Management Platform Team
"""

import asyncio
import logging
import signal
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient  # version: 3.3.1
from redis import asyncio as aioredis  # version: 5.0.1
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17.1
from opentelemetry import trace  # version: 1.19.0
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from circuitbreaker import circuit  # version: 1.4.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.3

from .config.settings import Settings
from .routes import context_routes, health_routes
from .middleware.logging import RequestLoggingMiddleware
from .middleware.auth import AuthMiddleware
from .middleware.error_handler import ErrorHandlerMiddleware

# Initialize settings
settings = Settings()

# Initialize logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_latency = Histogram('http_request_duration_seconds', 'HTTP request latency')
active_connections = Gauge('active_connections', 'Number of active connections')
error_count = Counter('error_count_total', 'Total error count by type', ['error_type'])

# Initialize FastAPI app
app = FastAPI(
    title="Context Engine",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

@circuit(failure_threshold=5, recovery_timeout=60)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def init_mongodb() -> AsyncIOMotorClient:
    """Initialize MongoDB connection with retry logic and connection pooling."""
    mongo_settings = settings.get_mongodb_settings()
    client = AsyncIOMotorClient(**mongo_settings)
    # Verify connection
    await client.admin.command('ping')
    return client

@circuit(failure_threshold=3, recovery_timeout=30)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def init_redis() -> aioredis.Redis:
    """Initialize Redis connection with retry logic."""
    redis_settings = settings.get_redis_settings()
    client = await aioredis.from_url(
        f"redis://{redis_settings['host']}:{redis_settings['port']}",
        password=redis_settings['password'],
        ssl=redis_settings['ssl'],
        ssl_cert_reqs=redis_settings['ssl_cert_reqs']
    )
    # Verify connection
    await client.ping()
    return client

async def init_telemetry() -> None:
    """Initialize OpenTelemetry with trace sampling and metrics."""
    resource = Resource.create({
        "service.name": "context-engine",
        "service.version": "1.0.0",
        "deployment.environment": settings.ENV
    })
    
    trace.set_tracer_provider(TracerProvider(resource=resource))
    otlp_exporter = OTLPSpanExporter()
    span_processor = BatchSpanProcessor(otlp_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with graceful startup and shutdown."""
    # Startup
    try:
        # Initialize services
        app.state.mongodb = await init_mongodb()
        app.state.redis = await init_redis()
        await init_telemetry()
        
        logger.info("Context Engine service initialized successfully")
        yield
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}")
        raise
    finally:
        # Shutdown
        try:
            if hasattr(app.state, 'mongodb'):
                app.state.mongodb.close()
            if hasattr(app.state, 'redis'):
                await app.state.redis.close()
            logger.info("Context Engine service shut down successfully")
        except Exception as e:
            logger.error(f"Error during shutdown: {str(e)}")

# Configure middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(ErrorHandlerMiddleware)

# Register routes
app.include_router(health_routes.router, prefix="/api/health", tags=["Health"])
app.include_router(context_routes.router, prefix="/api/v1/context", tags=["Context"])

@app.middleware("http")
async def metrics_middleware(request: Request, call_next) -> Response:
    """Collect metrics for each request."""
    active_connections.inc()
    
    with request_latency.time():
        response = await call_next(request)
        
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    active_connections.dec()
    return response

def handle_shutdown(signal_type: signal.Signals) -> None:
    """Handle graceful shutdown on system signals."""
    logger.info(f"Received shutdown signal: {signal_type.name}")
    raise SystemExit(0)

if __name__ == "__main__":
    # Register signal handlers
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, handle_shutdown)
    
    # Start application
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENV == "development",
        lifespan="on"
    )