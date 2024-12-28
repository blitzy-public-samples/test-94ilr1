#!/bin/bash

# test.sh
# Comprehensive test suite executor for backend microservices
# Version: 1.0.0
# Requires: Node.js >=20.0.0, Jest 29.7.0, bash >=4.0

set -euo pipefail

# Configuration
readonly COVERAGE_DIR="coverage"
readonly REPORTS_DIR="reports"
readonly TEST_TIMEOUT=30000 # Matches jest.config.ts
readonly MAX_MEMORY_PERCENT=80
readonly RETRY_COUNT=1
readonly SERVICES=(
    "auth-service"
    "context-engine"
    "email-service"
    "response-generator"
)

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Calculate optimal number of parallel processes based on CPU cores and memory
calculate_workers() {
    local cpu_cores
    local available_memory
    local max_workers

    cpu_cores=$(nproc)
    available_memory=$(free -m | awk '/^Mem:/{print $2}')
    
    # Use 50% of CPU cores by default (matching jest.config.ts)
    max_workers=$((cpu_cores / 2))
    
    # Check memory constraints
    local memory_per_worker=512 # MB per worker estimate
    local memory_limited_workers=$((available_memory * MAX_MEMORY_PERCENT / 100 / memory_per_worker))
    
    # Take the lower of CPU-based or memory-based worker count
    if [ "$memory_limited_workers" -lt "$max_workers" ]; then
        max_workers=$memory_limited_workers
    fi
    
    echo "$max_workers"
}

# Setup test environment
setup_environment() {
    echo -e "${YELLOW}Setting up test environment...${NC}"
    
    # Clean previous test artifacts
    rm -rf "$COVERAGE_DIR" "$REPORTS_DIR"
    mkdir -p "$COVERAGE_DIR" "$REPORTS_DIR"
    
    # Export environment variables
    export NODE_ENV=test
    export JEST_JUNIT_OUTPUT_DIR="$REPORTS_DIR/junit"
    
    # Validate service directories
    for service in "${SERVICES[@]}"; do
        if [ ! -d "services/$service" ]; then
            echo -e "${RED}Error: Service directory 'services/$service' not found${NC}"
            exit 1
        fi
    done
}

# Run tests for a specific service
run_service_tests() {
    local service=$1
    local max_workers=$2
    local attempt=1
    local success=false
    
    while [ $attempt -le $RETRY_COUNT ] && [ "$success" = false ]; do
        echo -e "${YELLOW}Running tests for $service (Attempt $attempt)...${NC}"
        
        if npx jest \
            --config=jest.config.ts \
            --maxWorkers="$max_workers" \
            --coverage \
            --coverageDirectory="$COVERAGE_DIR/$service" \
            --testTimeout="$TEST_TIMEOUT" \
            --testPathPattern="services/$service" \
            --forceExit \
            --detectOpenHandles \
            --ci \
            --json \
            --outputFile="$REPORTS_DIR/$service-results.json" \
            --coverageReporters="json" "text" "html" \
            --reporters="default" "jest-junit"; then
            
            success=true
            echo -e "${GREEN}Tests passed for $service${NC}"
        else
            if [ $attempt -eq $RETRY_COUNT ]; then
                echo -e "${RED}Tests failed for $service after $RETRY_COUNT attempts${NC}"
                return 1
            fi
            echo -e "${YELLOW}Retrying tests for $service...${NC}"
            ((attempt++))
        fi
    done
}

# Run tests in parallel across all services
run_parallel_tests() {
    local max_workers
    max_workers=$(calculate_workers)
    local workers_per_service=$((max_workers / ${#SERVICES[@]} + 1))
    
    echo "Running tests with $workers_per_service workers per service..."
    
    # Create array to store parallel execution PIDs
    pids=()
    
    for service in "${SERVICES[@]}"; do
        run_service_tests "$service" "$workers_per_service" &
        pids+=($!)
    done
    
    # Wait for all processes and collect exit codes
    failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done
    
    return $failed
}

# Generate consolidated coverage report
generate_reports() {
    echo -e "${YELLOW}Generating consolidated reports...${NC}"
    
    # Merge coverage reports
    npx istanbul-merge \
        --out "$COVERAGE_DIR/coverage-final.json" \
        "$COVERAGE_DIR"/**/coverage-final.json
    
    # Generate HTML report
    npx istanbul report --dir "$COVERAGE_DIR/html" html
    
    # Check coverage thresholds
    if npx istanbul check-coverage \
        --statements 80 \
        --branches 80 \
        --functions 80 \
        --lines 80 \
        "$COVERAGE_DIR/coverage-final.json"; then
        echo -e "${GREEN}Coverage thresholds met${NC}"
    else
        echo -e "${RED}Coverage thresholds not met${NC}"
        return 1
    fi
    
    # Generate summary report
    echo "Test Summary:" > "$REPORTS_DIR/summary.txt"
    for service in "${SERVICES[@]}"; do
        if [ -f "$REPORTS_DIR/$service-results.json" ]; then
            jq -r '.numTotalTests, .numFailedTests, .numPassedTests' \
                "$REPORTS_DIR/$service-results.json" | \
                xargs printf "$service: %d total, %d failed, %d passed\n" \
                >> "$REPORTS_DIR/summary.txt"
        fi
    done
}

# Cleanup function for trap
cleanup() {
    local exit_code=$?
    
    # Kill any remaining test processes
    jobs -p | xargs -r kill
    
    # Archive logs if there was a failure
    if [ $exit_code -ne 0 ]; then
        echo -e "${YELLOW}Archiving logs due to failure...${NC}"
        tar -czf "test-logs-$(date +%Y%m%d_%H%M%S).tar.gz" "$REPORTS_DIR"
    fi
    
    exit $exit_code
}

# Main execution
main() {
    # Set trap for cleanup
    trap cleanup EXIT INT TERM
    
    # Start execution timer
    start_time=$(date +%s)
    
    # Run test phases
    setup_environment
    run_parallel_tests
    local test_exit_code=$?
    
    if [ $test_exit_code -eq 0 ]; then
        generate_reports
        local report_exit_code=$?
    else
        report_exit_code=1
    fi
    
    # Calculate execution time
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo -e "${YELLOW}Total execution time: ${duration}s${NC}"
    
    # Return overall status
    if [ $test_exit_code -eq 0 ] && [ $report_exit_code -eq 0 ]; then
        echo -e "${GREEN}All tests passed successfully${NC}"
        return 0
    else
        echo -e "${RED}Tests failed - check reports for details${NC}"
        return 1
    fi
}

# Execute main function
main "$@"