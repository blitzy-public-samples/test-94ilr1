# Stage 1: Build environment
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Run security audit
RUN npm audit --production

# Remove devDependencies
RUN npm prune --production

# Stage 2: Production environment
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init=1.2.5-r1

# Create non-root user/group
RUN addgroup -S apigateway && \
    adduser -S -G apigateway apigateway

# Set working directory
WORKDIR /usr/src/app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Copy built artifacts and production dependencies
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Set up health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Set proper permissions
RUN chown -R apigateway:apigateway /usr/src/app && \
    chmod -R 550 /usr/src/app/dist && \
    chmod -R 550 /usr/src/app/node_modules && \
    chmod 550 /usr/src/app/package.json && \
    chmod 550 /usr/src/app/package-lock.json

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE ${PORT}

# Set read-only filesystem where possible
VOLUME ["/tmp", "/var/run"]

# Use dumb-init as entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]

# Labels for container metadata
LABEL maintainer="AI Email Management Platform Team" \
      version="1.0.0" \
      description="API Gateway service for AI Email Management Platform" \
      org.opencontainers.image.source="https://github.com/org/ai-email-platform" \
      org.opencontainers.image.vendor="AI Email Management Platform" \
      org.opencontainers.image.title="API Gateway" \
      org.opencontainers.image.description="API Gateway service container" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.created=${BUILD_DATE} \
      org.opencontainers.image.revision=${BUILD_REVISION} \
      security.capabilities="{\"bounding\":[\"CAP_NET_BIND_SERVICE\"],\"effective\":[\"CAP_NET_BIND_SERVICE\"],\"inheritable\":[\"CAP_NET_BIND_SERVICE\"],\"permitted\":[\"CAP_NET_BIND_SERVICE\"],\"ambient\":[\"CAP_NET_BIND_SERVICE\"]}"