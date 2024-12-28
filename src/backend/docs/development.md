# Development Guide

This guide provides comprehensive instructions for setting up and developing the AI-powered Email Management Platform backend services.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Service Development](#service-development)
- [Testing Guidelines](#testing-guidelines)
- [Database Management](#database-management)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Security Practices](#security-practices)

## Prerequisites

### Hardware Requirements
- CPU: Minimum 4 cores (8 recommended)
- RAM: Minimum 16GB (32GB recommended)
- Storage: 100GB+ SSD
- GPU: NVIDIA GPU with 8GB+ VRAM (for ML development)

### Software Requirements
- Docker Engine 24.0+
- Docker Compose 2.0+
- Git 2.40+
- Node.js 20 LTS
- Python 3.11+
- Go 1.21+
- Visual Studio Code or JetBrains IDE

## Development Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/org/ai-email-platform
cd ai-email-platform
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for Context Engine
cd src/backend/context-engine
poetry install

# Install Python dependencies for Response Generator
cd ../response-generator
poetry install

# Install Go dependencies for Email Service
cd ../email-service
go mod download
```

### 3. Environment Configuration

Create `.env` file in the root directory:

```env
# Development Environment
ENV=development

# Database Credentials
POSTGRES_USER=emailservice
POSTGRES_PASSWORD=<secure-password>
MONGO_USER=contextengine
MONGO_PASSWORD=<secure-password>

# Redis Configuration
REDIS_URL=redis://redis:6379

# Authentication
AUTH_SECRET=<jwt-secret>

# API Keys
OPENAI_API_KEY=<your-api-key>

# Service Ports
API_GATEWAY_PORT=3000
EMAIL_SERVICE_PORT=8080
CONTEXT_ENGINE_PORT=8000
RESPONSE_GEN_PORT=8001
```

### 4. Start Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Start specific service
docker-compose up email-service -d
```

## Service Development

### API Gateway (Node.js/TypeScript)

```bash
cd src/backend/api-gateway
npm run dev
```

Key files:
- `src/routes/` - API route definitions
- `src/middleware/` - Custom middleware
- `src/services/` - Service integrations

### Email Service (Go)

```bash
cd src/backend/email-service
go run main.go
```

Key files:
- `internal/handlers/` - HTTP/gRPC handlers
- `internal/services/` - Business logic
- `internal/models/` - Data models

### Context Engine (Python/TensorFlow)

```bash
cd src/backend/context-engine
poetry run start
```

Key files:
- `src/models/` - ML model definitions
- `src/services/` - Analysis services
- `src/api/` - FastAPI routes

### Response Generator (Python/PyTorch)

```bash
cd src/backend/response-generator
poetry run start
```

Key files:
- `src/models/` - ML model definitions
- `src/templates/` - Response templates
- `src/api/` - FastAPI routes

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm run test:all

# Run service-specific tests
npm run test:email-service
npm run test:context-engine
npm run test:response-gen

# Run with coverage
npm run test:coverage
```

### Test Requirements
- Unit test coverage: Minimum 80%
- Integration test coverage: Minimum 70%
- E2E test coverage: Minimum 50%
- Performance benchmarks must pass defined thresholds

## Database Management

### Local Database Setup

```bash
# Start database services
docker-compose up postgres mongodb redis -d

# Run migrations
npm run migrate:up

# Seed development data
npm run seed:dev
```

### Database Connections
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Redis: localhost:6379

## Monitoring and Debugging

### Logging
- Structured logging using Winston/Zap
- Log levels: debug, info, warn, error
- Log rotation enabled

### Metrics
- Prometheus metrics exposed on /metrics
- Grafana dashboards available
- Custom metrics for ML model performance

### Tracing
- OpenTelemetry integration
- Jaeger UI available at localhost:16686

## Security Practices

### Authentication
- JWT-based authentication
- OAuth2 for email provider integration
- Rate limiting enabled

### Development Security
- No secrets in code
- HTTPS in development
- Input validation
- SQL injection prevention

### Code Quality
```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run security scan
npm run security-check
```

## Troubleshooting

### Common Issues

1. Docker Container Startup Failures
```bash
# Check container logs
docker-compose logs <service-name>

# Verify environment variables
docker-compose config
```

2. Database Connection Issues
```bash
# Check database status
docker-compose ps postgres mongodb redis

# Reset database
npm run db:reset
```

3. ML Model Loading Failures
```bash
# Verify model files
ls -l src/backend/context-engine/models
ls -l src/backend/response-generator/models

# Check CUDA configuration
nvidia-smi
```

### Getting Help
- Check service logs
- Review documentation
- Contact DevOps team
- Submit GitHub issue

## Best Practices

1. Code Style
- Follow language-specific style guides
- Use consistent naming conventions
- Document public APIs
- Write meaningful comments

2. Git Workflow
- Use feature branches
- Write descriptive commit messages
- Keep commits atomic
- Rebase before merging

3. Performance
- Profile code regularly
- Optimize database queries
- Cache frequently accessed data
- Monitor memory usage

4. Security
- Keep dependencies updated
- Follow security guidelines
- Review security alerts
- Regular security audits