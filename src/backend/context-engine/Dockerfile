# Build stage
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.6.1 \
    POETRY_HOME=/opt/poetry \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install system dependencies required for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgomp1 \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root

# Production stage
FROM python:3.11-slim

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    POETRY_VERSION=1.6.1 \
    POETRY_HOME=/opt/poetry \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -g 10001 context-engine && \
    useradd -u 10001 -g context-engine -s /bin/bash -m context-engine

# Set working directory
WORKDIR /app

# Copy poetry installation and dependencies from builder
COPY --from=builder /opt/poetry /opt/poetry
COPY --from=builder /app/.venv /app/.venv
RUN ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Copy application code
COPY --chown=context-engine:context-engine . .

# Set proper permissions
RUN chmod -R 755 /app && \
    chmod -R 644 /app/src/*.py && \
    chmod -R 644 /app/pyproject.toml /app/poetry.lock

# Switch to non-root user
USER context-engine

# Expose port
EXPOSE 8000

# Set resource limits
ENV MEMORY_LIMIT=8G \
    CPU_LIMIT=4 \
    PIDS_LIMIT=1000

# Health check configuration
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application with production configuration
ENTRYPOINT ["poetry", "run", "uvicorn"]
CMD ["src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--limit-concurrency", "500"]

# Labels for container metadata
LABEL maintainer="AI Email Management Platform Team" \
      version="1.0.0" \
      description="Context Engine service for AI-powered email analysis" \
      org.opencontainers.image.source="https://github.com/org/ai-email-platform" \
      org.opencontainers.image.documentation="https://docs.ai-email-platform.com"