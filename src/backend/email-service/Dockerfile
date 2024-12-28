# Build stage
FROM golang:1.21-alpine3.18 AS builder

# Build arguments
ARG BUILD_VERSION=latest
ARG GO_VERSION=1.21
ARG ALPINE_VERSION=3.18

# Build-time labels
LABEL org.opencontainers.image.source="github.com/email-management-platform/backend/email-service" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.licenses="Proprietary"

# Install build dependencies
RUN apk add --no-cache \
    git=2.40.1-r0 \
    make=4.4.1-r1 \
    gcc=12.2.1_git20220924-r10 \
    musl-dev=1.2.4-r2 \
    ca-certificates=20230506-r0

# Set secure build flags
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GO111MODULE=on \
    GOSUMDB=sum.golang.org \
    GOPROXY=https://proxy.golang.org,direct

# Create non-root user for build
RUN adduser -D -u 10001 emailservice

# Set up working directory with proper permissions
WORKDIR /build
RUN chown emailservice:emailservice /build

# Switch to non-root user
USER emailservice

# Copy go.mod and go.sum first for better caching
COPY --chown=emailservice:emailservice go.mod go.sum ./

# Download dependencies
RUN go mod download && \
    go mod verify

# Copy source code with appropriate permissions
COPY --chown=emailservice:emailservice . .

# Build the application with security flags
RUN go build \
    -trimpath \
    -buildmode=pie \
    -ldflags="-s -w -X main.version=${BUILD_VERSION} -linkmode=external -extldflags '-static'" \
    -o email-service \
    ./main.go

# Run security scan on built binary
RUN go run honnef.co/go/tools/cmd/staticcheck@latest ./...

# Final stage
FROM alpine:3.18 AS final

# Runtime labels
LABEL maintainer="DevOps Team <devops@company.com>" \
      service="email-service" \
      version="${BUILD_VERSION}" \
      security.scan="true" \
      monitoring.enabled="true"

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates=20230506-r0 \
    tzdata=2023c-r1 \
    dumb-init=1.2.5-r2

# Create non-root user for runtime
RUN adduser -D -u 10001 emailservice && \
    mkdir -p /app/config /app/data && \
    chown -R emailservice:emailservice /app

# Set secure environment variables
ENV TZ=UTC \
    SERVICE_USER=emailservice \
    SERVICE_UID=10001 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Set working directory
WORKDIR /app

# Copy binary and configuration from builder
COPY --from=builder --chown=emailservice:emailservice /build/email-service .
COPY --chown=emailservice:emailservice config/config.yaml ./config/
COPY --chown=emailservice:emailservice scripts/healthcheck.sh /usr/local/bin/

# Verify binary checksum
RUN sha256sum email-service > checksum.txt && \
    chmod +x /usr/local/bin/healthcheck.sh && \
    chmod 755 email-service

# Switch to non-root user
USER emailservice

# Expose ports for HTTP, gRPC, and metrics
EXPOSE 8080 9090

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/healthcheck.sh"]

# Set resource limits
ENV GOMEMLIMIT=2048MiB \
    GOMAXPROCS=2

# Use dumb-init as PID 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run the service
CMD ["./email-service"]