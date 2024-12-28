# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Add labels for maintainability
LABEL maintainer="DevOps Team <devops@company.com>" \
      service="auth-service" \
      version="1.0.0" \
      security.scan="snyk" \
      monitoring="enabled"

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ git curl \
    && npm install -g snyk

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Run security scan
RUN snyk test || true

# Copy source code and configs
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Run security audit
RUN npm audit

# Stage 2: Production
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Add security headers and system dependencies
RUN apk add --no-cache tini curl \
    && addgroup -g 1001 nodejs \
    && adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    COMPRESSION_LEVEL=6 \
    RATE_LIMIT_WINDOW=15m \
    RATE_LIMIT_MAX=100

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production \
    && npm cache clean --force

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create necessary directories with proper permissions
RUN mkdir -p /usr/src/app/logs \
    && chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose application port
EXPOSE ${PORT}

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application with clustering enabled
CMD ["node", "-r", "source-map-support/register", "dist/main.js"]

# Security hardening
RUN echo "fs.file-max = 65535" > /etc/sysctl.conf \
    && echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf \
    && echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf

# Resource limits
RUN ulimit -n 65535 \
    && ulimit -u 2048

# Add security headers
ENV SECURITY_HEADERS="helmet,cors,csp,hsts" \
    CORS_ORIGIN="https://*.company.com" \
    CSP_DIRECTIVES="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'" \
    HSTS_MAX_AGE="31536000"