# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.6.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install system dependencies required for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root

# Copy source code
COPY . .

# Install project
RUN poetry install --no-dev

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512 \
    MODEL_CACHE_DIR=/app/models

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin -d /app appuser \
    && mkdir -p /app/models /app/tmp \
    && chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy virtual environment and source from builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app/src /app/src
COPY --from=builder --chown=appuser:appuser /app/log_config.json /app/log_config.json

# Set PATH to include virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Create and set volumes
VOLUME ["/app/models", "/app/tmp"]

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Resource limits
LABEL com.docker.resource.memory="8G" \
      com.docker.resource.cpu="4" \
      com.docker.resource.gpu="1"

# Add metadata labels
LABEL maintainer="AI Email Platform Team" \
      version="1.0.0" \
      description="Response Generator service with ML capabilities"

# Set entrypoint
ENTRYPOINT ["uvicorn"]

# Set default command
CMD ["src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--log-config", "log_config.json"]