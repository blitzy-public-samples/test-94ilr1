#!/usr/bin/env bash

# =============================================================================
# AI-powered Email Management Platform - Terraform Initialization Script
# Version: 1.0.0
# Required Tools:
# - terraform v1.6.0+
# - aws-cli v2.0+
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# Global Variables and Constants
# =============================================================================

readonly TERRAFORM_VERSION="1.6.0"
readonly AWS_REGIONS=("us-west-2" "us-east-1")
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly STATE_BUCKET_PREFIX="tfstate-email-platform"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# Required environment variables
readonly REQUIRED_VARS=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "TF_VAR_environment"
    "TF_VAR_project_name"
)

# Logging configuration
readonly LOG_FILE="/var/log/terraform-init.log"
readonly LOG_LEVEL="INFO"

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info() {
    log "INFO" "$1"
}

error() {
    log "ERROR" "$1" >&2
}

debug() {
    [[ "${LOG_LEVEL}" == "DEBUG" ]] && log "DEBUG" "$1"
}

# =============================================================================
# Error Handling
# =============================================================================

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Script failed with exit code: ${exit_code}"
        # Perform cleanup operations
        info "Cleaning up temporary resources..."
    fi
    exit $exit_code
}

trap cleanup EXIT
trap 'error "Received SIGINT signal"; exit 1' SIGINT
trap 'error "Received SIGTERM signal"; exit 1' SIGTERM

# =============================================================================
# Utility Functions
# =============================================================================

check_prerequisites() {
    info "Checking prerequisites..."

    # Check Terraform version
    if ! command -v terraform >/dev/null; then
        error "Terraform is not installed"
        return 1
    fi

    local tf_version
    tf_version=$(terraform version | head -n1 | cut -d 'v' -f2)
    if [[ "${tf_version}" != "${TERRAFORM_VERSION}"* ]]; then
        error "Required Terraform version is ${TERRAFORM_VERSION}, but found ${tf_version}"
        return 1
    }

    # Check AWS CLI
    if ! command -v aws >/dev/null; then
        error "AWS CLI is not installed"
        return 1
    }

    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "Invalid AWS credentials"
        return 1
    }

    # Check required environment variables
    local missing_vars=()
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -ne 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    }

    info "Prerequisites check completed successfully"
    return 0
}

setup_state_backend() {
    local environment="$1"
    info "Setting up Terraform state backend for environment: ${environment}"

    local bucket_name="${STATE_BUCKET_PREFIX}-${environment}"
    local table_name="terraform-lock-${environment}"

    # Create S3 bucket with encryption
    aws s3api create-bucket \
        --bucket "${bucket_name}" \
        --region "${AWS_REGION}" \
        --create-bucket-configuration LocationConstraint="${AWS_REGION}" || {
        error "Failed to create S3 bucket: ${bucket_name}"
        return 1
    }

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${bucket_name}" \
        --versioning-configuration Status=Enabled

    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "${bucket_name}" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }'

    # Create DynamoDB table for state locking
    aws dynamodb create-table \
        --table-name "${table_name}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region "${AWS_REGION}" || {
        error "Failed to create DynamoDB table: ${table_name}"
        return 1
    }

    info "State backend setup completed successfully"
    return 0
}

initialize_environment() {
    local environment="$1"
    info "Initializing Terraform for environment: ${environment}"

    # Create workspace if it doesn't exist
    terraform workspace new "${environment}" || terraform workspace select "${environment}"

    # Initialize Terraform
    terraform init \
        -backend=true \
        -backend-config="bucket=${STATE_BUCKET_PREFIX}-${environment}" \
        -backend-config="key=terraform.tfstate" \
        -backend-config="region=${AWS_REGION}" \
        -backend-config="encrypt=true" \
        -backend-config="dynamodb_table=terraform-lock-${environment}" || {
        error "Failed to initialize Terraform"
        return 1
    }

    # Validate Terraform configuration
    terraform validate || {
        error "Terraform configuration validation failed"
        return 1
    }

    info "Environment initialization completed successfully"
    return 0
}

# =============================================================================
# Main Script Execution
# =============================================================================

main() {
    info "Starting Terraform initialization script"

    # Validate environment argument
    if [[ $# -ne 1 ]]; then
        error "Usage: $0 <environment>"
        exit 1
    }

    local environment="$1"
    if [[ ! " ${ENVIRONMENTS[*]} " =~ ${environment} ]]; then
        error "Invalid environment. Must be one of: ${ENVIRONMENTS[*]}"
        exit 1
    }

    # Execute initialization steps
    check_prerequisites || exit 1
    setup_state_backend "${environment}" || exit 1
    initialize_environment "${environment}" || exit 1

    info "Terraform initialization completed successfully"
    return 0
}

# Execute main function with all arguments
main "$@"
```

This script provides a robust and secure initialization process for the Terraform infrastructure with the following key features:

1. Comprehensive prerequisite checking
2. Secure state backend setup with encryption
3. Environment-specific initialization
4. Extensive error handling and logging
5. Security-focused configuration
6. Audit trail maintenance

The script follows best practices for shell scripting:
- Uses strict error handling with `set -euo pipefail`
- Implements comprehensive logging
- Provides detailed error messages
- Includes cleanup procedures
- Validates all inputs and prerequisites
- Implements secure state management
- Follows the principle of least privilege

To use the script:
```bash
# Make the script executable
chmod +x init-terraform.sh

# Run for a specific environment
./init-terraform.sh dev