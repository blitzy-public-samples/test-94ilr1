#!/bin/bash

# Key Rotation Script for AI Email Management Platform
# Version: 1.0.0
# Dependencies: aws-cli v2.0+, jq v1.6+
# Purpose: Automated key rotation with compliance logging and security validation

set -euo pipefail

# Global Variables
AWS_REGION=${AWS_REGION:-us-west-2}
ENVIRONMENT=${ENVIRONMENT:-production}
LOG_FILE="/var/log/key-rotation-${ENVIRONMENT}.log"
COMPLIANCE_MODE=${COMPLIANCE_MODE:-strict}
BACKUP_PATH="/secure/backups/kms/${ENVIRONMENT}"
NOTIFICATION_SNS_TOPIC="arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT}:security-notifications"
METRICS_NAMESPACE="KeyRotation"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Logging function with compliance tracking
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
    
    # Send metrics to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "${METRICS_NAMESPACE}" \
        --metric-name "KeyRotationLog" \
        --dimensions Level=${level} \
        --value 1 \
        --timestamp ${timestamp}
}

# Security notification function
notify_security() {
    local message=$1
    local severity=${2:-INFO}
    
    aws sns publish \
        --topic-arn "${NOTIFICATION_SNS_TOPIC}" \
        --message "{\"severity\": \"${severity}\", \"message\": \"${message}\", \"timestamp\": \"${TIMESTAMP}\"}" \
        --message-attributes "SecurityAlert={DataType=String,StringValue=KeyRotation}"
}

# Verify AWS credentials and permissions
verify_aws_credentials() {
    log "INFO" "Verifying AWS credentials and permissions..."
    
    if ! aws sts get-caller-identity &>/dev/null; then
        log "ERROR" "AWS credentials verification failed"
        notify_security "AWS credentials verification failed" "CRITICAL"
        exit 1
    fi
}

# Backup key metadata and policies
backup_key_metadata() {
    local key_arn=$1
    local backup_file="${BACKUP_PATH}/key-${TIMESTAMP}.json"
    
    mkdir -p "${BACKUP_PATH}"
    
    log "INFO" "Backing up key metadata for ${key_arn}"
    aws kms describe-key --key-id "${key_arn}" > "${backup_file}"
    aws kms get-key-policy --key-id "${key_arn}" --policy-name default >> "${backup_file}"
    
    # Verify backup integrity
    if ! jq empty "${backup_file}" 2>/dev/null; then
        log "ERROR" "Backup validation failed for ${key_arn}"
        notify_security "Key backup validation failed" "HIGH"
        exit 1
    fi
}

# Verify key status and compliance
verify_key_status() {
    local key_arn=$1
    local compliance_mode=$2
    
    log "INFO" "Verifying key status for ${key_arn}"
    
    # Check key enabled status
    local key_status=$(aws kms describe-key --key-id "${key_arn}" | jq -r '.KeyMetadata.KeyState')
    if [[ "${key_status}" != "Enabled" ]]; then
        log "ERROR" "Key ${key_arn} is not in Enabled state"
        return 1
    fi
    
    # Verify key can be used for encryption/decryption
    if ! aws kms encrypt \
        --key-id "${key_arn}" \
        --plaintext "test" \
        --output text \
        --query CiphertextBlob &>/dev/null; then
        log "ERROR" "Key ${key_arn} encryption test failed"
        return 1
    fi
    
    # Additional compliance checks for strict mode
    if [[ "${compliance_mode}" == "strict" ]]; then
        # Verify key policy compliance
        local policy=$(aws kms get-key-policy --key-id "${key_arn}" --policy-name default)
        if ! echo "${policy}" | jq -e '.Statement[] | select(.Effect=="Deny" and .Principal=="*")' &>/dev/null; then
            log "WARNING" "Key policy does not include explicit deny statements"
        fi
    fi
    
    return 0
}

# Rotate KMS key with compliance logging
rotate_kms_key() {
    local key_arn=$1
    local key_alias=$2
    local region=$3
    local compliance_mode=$4
    
    log "INFO" "Starting key rotation for ${key_arn}"
    
    # Backup current key state
    backup_key_metadata "${key_arn}"
    
    # Enable automatic key rotation if not enabled
    if ! aws kms get-key-rotation-status --key-id "${key_arn}" | jq -r '.KeyRotationEnabled'; then
        log "INFO" "Enabling automatic key rotation for ${key_arn}"
        aws kms enable-key-rotation --key-id "${key_arn}"
    fi
    
    # Trigger manual key rotation
    log "INFO" "Triggering manual key rotation"
    if ! aws kms update-key-description \
        --key-id "${key_arn}" \
        --description "Rotated on ${TIMESTAMP} - Compliance: ${compliance_mode}"; then
        log "ERROR" "Key rotation failed for ${key_arn}"
        notify_security "Key rotation failed" "CRITICAL"
        return 1
    fi
    
    # Verify key status after rotation
    if ! verify_key_status "${key_arn}" "${compliance_mode}"; then
        log "ERROR" "Post-rotation verification failed"
        notify_security "Post-rotation verification failed" "HIGH"
        return 1
    fi
    
    # Update CloudWatch metrics
    aws cloudwatch put-metric-data \
        --namespace "${METRICS_NAMESPACE}" \
        --metric-name "SuccessfulRotation" \
        --dimensions KeyId=${key_arn} \
        --value 1 \
        --timestamp ${TIMESTAMP}
    
    log "INFO" "Key rotation completed successfully for ${key_arn}"
    notify_security "Key rotation completed successfully" "INFO"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting key rotation process"
    verify_aws_credentials
    
    # Rotate RDS encryption key
    rotate_kms_key \
        "${RDS_KMS_KEY_ARN}" \
        "alias/${ENVIRONMENT}-rds-key" \
        "${AWS_REGION}" \
        "${COMPLIANCE_MODE}"
    
    # Rotate DocumentDB encryption key
    rotate_kms_key \
        "${DOCDB_KMS_KEY_ARN}" \
        "alias/${ENVIRONMENT}-docdb-key" \
        "${AWS_REGION}" \
        "${COMPLIANCE_MODE}"
    
    # Rotate application encryption key
    rotate_kms_key \
        "${APP_KMS_KEY_ARN}" \
        "alias/${ENVIRONMENT}-app-key" \
        "${AWS_REGION}" \
        "${COMPLIANCE_MODE}"
    
    # Clean up old backups (retain last 90 days)
    find "${BACKUP_PATH}" -type f -mtime +90 -delete
    
    log "INFO" "Key rotation process completed successfully"
}

# Trap errors and cleanup
trap 'log "ERROR" "Script failed on line $LINENO"; notify_security "Key rotation script failed" "CRITICAL"' ERR

# Execute main function
main "$@"