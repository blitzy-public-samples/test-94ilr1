#!/usr/bin/env bash

# Enable strict mode
set -euo pipefail
IFS=$'\n\t'

# Build script for AI Email Management Platform backend services
# Version: 1.0.0

# Environment variables with defaults
export DOCKER_BUILDKIT=1
export BUILD_VERSION=$(cat ../package.json | jq -r .version)
export BUILD_ENV=${BUILD_ENV:-development}
export LOG_LEVEL=${LOG_LEVEL:-info}
export CACHE_DIR=${CACHE_DIR:-/tmp/docker-cache}
export SECURITY_SCAN_LEVEL=${SECURITY_SCAN_LEVEL:-medium}
export BUILD_TIMEOUT=${BUILD_TIMEOUT:-3600}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate build environment and dependencies
validate_environment() {
    log_info "Validating build environment..."

    # Check Docker version and BuildKit support
    if ! docker info | grep -q "BuildKit"; then
        log_error "Docker BuildKit not available. Please enable BuildKit."
        return 1
    fi

    # Check for required tools
    for tool in docker jq trivy; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed."
            return 1
        fi
    done

    # Verify cache directory exists
    mkdir -p "${CACHE_DIR}"

    # Verify required Dockerfiles exist
    local services=("api-gateway" "email-service" "context-engine" "response-generator")
    for service in "${services[@]}"; do
        if [[ ! -f "../$service/Dockerfile" ]]; then
            log_error "Dockerfile not found for $service"
            return 1
        fi
    done

    return 0
}

# Security scanning function
security_scan() {
    local image_name=$1
    local scan_level=$2
    local scan_output_file="${CACHE_DIR}/security-scan-${image_name//\//-}.json"

    log_info "Running security scan for ${image_name}..."

    if ! trivy image \
        --quiet \
        --severity "${scan_level}" \
        --format json \
        --output "${scan_output_file}" \
        "${image_name}"; then
        log_error "Security scan failed for ${image_name}"
        return 1
    fi

    # Check for critical vulnerabilities
    if jq -e '.Results[] | select(.Vulnerabilities[] | select(.Severity == "CRITICAL"))' "${scan_output_file}" > /dev/null; then
        log_error "Critical vulnerabilities found in ${image_name}"
        return 1
    fi

    log_info "Security scan passed for ${image_name}"
    return 0
}

# Build single service
build_service() {
    local service_name=$1
    local dockerfile_path=$2
    local build_context=$3
    local image_tag="ai-email-platform/${service_name}:${BUILD_VERSION}"
    local build_args=(
        "--build-arg" "BUILD_VERSION=${BUILD_VERSION}"
        "--build-arg" "BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
        "--build-arg" "BUILD_REVISION=$(git rev-parse --short HEAD)"
        "--build-arg" "BUILD_ENV=${BUILD_ENV}"
    )

    log_info "Building ${service_name}..."

    # Setup build cache
    local cache_from="type=local,src=${CACHE_DIR}/${service_name}"
    local cache_to="type=local,dest=${CACHE_DIR}/${service_name}"

    # Build image with BuildKit
    if ! DOCKER_BUILDKIT=1 docker build \
        "${build_args[@]}" \
        --file "${dockerfile_path}" \
        --tag "${image_tag}" \
        --cache-from="${cache_from}" \
        --cache-to="${cache_to}" \
        --progress=plain \
        "${build_context}"; then
        log_error "Build failed for ${service_name}"
        return 1
    fi

    # Run security scan
    if ! security_scan "${image_tag}" "${SECURITY_SCAN_LEVEL}"; then
        return 1
    fi

    # Tag image for environment
    docker tag "${image_tag}" "ai-email-platform/${service_name}:${BUILD_ENV}"

    log_info "Successfully built ${service_name}"
    return 0
}

# Main build function
build_all() {
    local start_time=$(date +%s)
    local build_status=0

    # Validate environment first
    if ! validate_environment; then
        log_error "Environment validation failed"
        return 1
    }

    # Create build report directory
    local report_dir="${CACHE_DIR}/build-reports"
    mkdir -p "${report_dir}"

    # Build services in parallel with dependency order
    log_info "Starting parallel builds..."

    # Build shared dependencies first
    build_service "api-gateway" "../api-gateway/Dockerfile" "../api-gateway" &
    build_service "email-service" "../email-service/Dockerfile" "../email-service" &
    wait

    # Build dependent services
    build_service "context-engine" "../context-engine/Dockerfile" "../context-engine" &
    build_service "response-generator" "../response-generator/Dockerfile" "../response-generator" &
    wait

    # Check if any background processes failed
    for job in $(jobs -p); do
        wait "$job" || build_status=1
    done

    # Generate build report
    local end_time=$(date +%s)
    local build_duration=$((end_time - start_time))

    {
        echo "Build Report"
        echo "============"
        echo "Build Version: ${BUILD_VERSION}"
        echo "Environment: ${BUILD_ENV}"
        echo "Duration: ${build_duration} seconds"
        echo "Status: $([[ ${build_status} -eq 0 ]] && echo "Success" || echo "Failed")"
        echo "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    } > "${report_dir}/build-report-${BUILD_VERSION}.txt"

    if [[ ${build_status} -eq 0 ]]; then
        log_info "Build completed successfully in ${build_duration} seconds"
        return 0
    else
        log_error "Build failed after ${build_duration} seconds"
        return 1
    fi
}

# Execute main build function
build_all