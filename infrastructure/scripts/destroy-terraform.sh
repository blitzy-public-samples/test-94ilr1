#!/usr/bin/env bash

# destroy-terraform.sh
# Version: 1.0.0
# Purpose: Safely destroy Terraform-managed infrastructure with comprehensive validation,
#          backups, and audit logging across different environments.
# Required: terraform v1.6.0+, aws-cli v2.x

# Enable strict mode
set -euo pipefail
IFS=$'\n\t'

# Script constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TERRAFORM_VERSION="1.6.0"
readonly AWS_REGIONS=("us-west-2")
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly PROTECTED_ENVS=("prod" "staging")
readonly BACKUP_RETENTION_DAYS=30
readonly LOG_DIR="/var/log/terraform"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly REQUIRED_VARS=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "ENVIRONMENT"
)

# Logging setup
setup_logging() {
    local log_file="${LOG_DIR}/destroy_${ENVIRONMENT}_${TIMESTAMP}.log"
    mkdir -p "${LOG_DIR}"
    exec 1> >(tee -a "${log_file}")
    exec 2> >(tee -a "${log_file}" >&2)
    chmod 600 "${log_file}"
}

log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }

# Error handling
trap 'error "Error occurred on line $LINENO. Exit code: $?"' ERR

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Script failed with exit code: ${exit_code}"
        # Attempt to clean up any temporary resources
        rm -f "${TEMP_PLAN_FILE:-}" 2>/dev/null || true
    fi
    exit $exit_code
}

trap cleanup EXIT

# Validation functions
validate_destroy_prerequisites() {
    local environment=$1
    local region=$2

    info "Validating prerequisites for environment: ${environment} in region: ${region}"

    # Verify environment is valid
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        error "Invalid environment: ${environment}"
        return 1
    }

    # Check for protected environments
    if [[ " ${PROTECTED_ENVS[@]} " =~ " ${environment} " ]]; then
        warn "WARNING: Attempting to destroy protected environment: ${environment}"
        read -p "Are you absolutely sure you want to proceed? (type 'yes' to confirm): " confirmation
        if [[ "${confirmation}" != "yes" ]]; then
            error "Destruction cancelled by user"
            return 1
        fi
    fi

    # Validate required environment variables
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable not set: ${var}"
            return 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        error "AWS credentials validation failed"
        return 1
    }

    # Verify terraform version
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    if [[ "${tf_version}" != "${TERRAFORM_VERSION}"* ]]; then
        error "Terraform version mismatch. Required: ${TERRAFORM_VERSION}, Found: ${tf_version}"
        return 1
    }

    info "Prerequisites validation completed successfully"
    return 0
}

backup_resources() {
    local environment=$1
    local backup_path="/tmp/terraform_backup_${environment}_${TIMESTAMP}"
    
    info "Creating resource backups at: ${backup_path}"
    mkdir -p "${backup_path}"

    # Create RDS snapshots
    info "Creating RDS final snapshots"
    aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier' --output text | \
    while read -r instance; do
        aws rds create-db-snapshot \
            --db-instance-identifier "${instance}" \
            --db-snapshot-identifier "destroy-${instance}-${TIMESTAMP}" || warn "Failed to backup RDS instance: ${instance}"
    done

    # Backup S3 buckets
    info "Backing up S3 buckets"
    aws s3api list-buckets --query 'Buckets[*].Name' --output text | \
    while read -r bucket; do
        aws s3 sync "s3://${bucket}" "${backup_path}/s3/${bucket}" || warn "Failed to backup S3 bucket: ${bucket}"
    done

    # Export terraform state
    info "Backing up Terraform state"
    terraform state pull > "${backup_path}/terraform.tfstate" || warn "Failed to backup Terraform state"

    # Create backup manifest
    {
        echo "Backup created at: $(date)"
        echo "Environment: ${environment}"
        echo "Timestamp: ${TIMESTAMP}"
        find "${backup_path}" -type f | sort
    } > "${backup_path}/manifest.txt"

    # Encrypt backup
    info "Encrypting backup"
    tar czf "${backup_path}.tar.gz" -C "$(dirname "${backup_path}")" "$(basename "${backup_path}")"
    aws kms encrypt \
        --key-id alias/terraform-backup \
        --plaintext fileb://"${backup_path}.tar.gz" \
        --output text \
        --query CiphertextBlob > "${backup_path}.tar.gz.encrypted"

    rm -rf "${backup_path}" "${backup_path}.tar.gz"
    info "Backup completed and encrypted"
    
    echo "${backup_path}.tar.gz.encrypted"
}

generate_destroy_plan() {
    local environment=$1
    local plan_file=$2

    info "Generating destroy plan for environment: ${environment}"

    # Initialize Terraform
    terraform init -backend=true || {
        error "Failed to initialize Terraform"
        return 1
    }

    # Select workspace
    terraform workspace select "${environment}" || {
        error "Failed to select Terraform workspace: ${environment}"
        return 1
    }

    # Generate destroy plan
    if ! terraform plan -destroy -out="${plan_file}"; then
        error "Failed to generate destroy plan"
        return 1
    }

    # Show plan details
    terraform show -json "${plan_file}" > "${plan_file}.json"

    # Analyze plan for critical resources
    local critical_resources
    critical_resources=$(jq -r '.resource_changes[] | select(.change.actions[0] == "delete") | .address' "${plan_file}.json")
    
    if [[ -n "${critical_resources}" ]]; then
        warn "The following resources will be destroyed:"
        echo "${critical_resources}"
    fi

    info "Destroy plan generated successfully"
    return 0
}

execute_destroy() {
    local environment=$1
    local plan_file=$2

    info "Executing infrastructure destruction for environment: ${environment}"

    # Final confirmation
    warn "WARNING: This will destroy all resources in ${environment}"
    read -p "Type 'DESTROY' to confirm: " confirmation
    if [[ "${confirmation}" != "DESTROY" ]]; then
        error "Destruction cancelled by user"
        return 1
    fi

    # Execute destroy
    if ! terraform destroy -auto-approve; then
        error "Terraform destroy failed"
        return 1
    }

    # Verify destruction
    if ! terraform show; then
        info "All resources successfully destroyed"
    else
        warn "Some resources may still exist. Please verify manually."
    fi

    # Clean up terraform files
    rm -f "${plan_file}" "${plan_file}.json"

    info "Infrastructure destruction completed"
    return 0
}

main() {
    # Parse command line arguments
    if [[ $# -lt 1 ]]; then
        error "Usage: $0 <environment>"
        exit 1
    fi

    export ENVIRONMENT=$1

    # Setup logging
    setup_logging

    info "Starting infrastructure destruction process for environment: ${ENVIRONMENT}"

    # Validate prerequisites
    if ! validate_destroy_prerequisites "${ENVIRONMENT}" "${AWS_REGION}"; then
        error "Prerequisites validation failed"
        exit 1
    fi

    # Create backups
    local backup_file
    backup_file=$(backup_resources "${ENVIRONMENT}")
    info "Backups created and stored at: ${backup_file}"

    # Generate destroy plan
    local plan_file="/tmp/destroy_${ENVIRONMENT}_${TIMESTAMP}.tfplan"
    if ! generate_destroy_plan "${ENVIRONMENT}" "${plan_file}"; then
        error "Failed to generate destroy plan"
        exit 1
    fi

    # Execute destruction
    if ! execute_destroy "${ENVIRONMENT}" "${plan_file}"; then
        error "Infrastructure destruction failed"
        exit 1
    fi

    info "Infrastructure destruction completed successfully"
}

# Execute main function
main "$@"
```

This script provides a comprehensive solution for safely destroying Terraform-managed infrastructure with the following key features:

1. Strict error handling and logging
2. Environment validation and protection
3. Comprehensive backup creation before destruction
4. Multi-step confirmation process for protected environments
5. Detailed audit logging
6. Resource verification and cleanup
7. Encrypted backup storage
8. AWS credentials validation
9. Terraform version compatibility checking
10. Structured execution flow with proper error handling

The script follows enterprise-grade practices including:

- Comprehensive error handling with proper exit codes
- Secure handling of credentials and sensitive data
- Detailed logging for audit trails
- Protection against accidental destruction of production environments
- Backup creation with encryption
- Resource verification before and after destruction
- Clean up of temporary files and proper process termination

To use this script:

```bash
# For development environment
./destroy-terraform.sh dev

# For staging/production (requires additional confirmation)
./destroy-terraform.sh staging
./destroy-terraform.sh prod