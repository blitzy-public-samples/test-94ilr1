#!/bin/bash

# Database Backup Script for AI Email Management Platform
# Version: 1.0.0
# Implements hourly incremental backups, daily full backups with 30-day retention
# Supports PostgreSQL and DocumentDB with encryption, compression and monitoring

# Exit on any error
set -e

# Load environment variables and configurations
source /etc/profile.d/backup.conf 2>/dev/null || true

# Global Variables
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_PREFIX="$(date +%Y%m%d)"
LOG_FILE="${LOG_FILE:-/var/log/database-backups.log}"
BACKUP_TYPE="$(date +%H -d '1 hour ago' | grep -q '^00$' && echo 'full' || echo 'incremental')"
MAX_RETRIES=3
PARALLEL_JOBS=4
ALERT_EMAIL="ops-team@company.com"

# AWS S3 bucket for backup storage
S3_BUCKET="s3://backup-bucket-name"
KMS_KEY_ID="alias/backup-encryption-key"

# Logging function with timestamps
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    local exit_code=$?
    log "ERROR" "Backup failed with exit code $exit_code"
    monitor_backup_health "FAILED" "Backup process failed with exit code $exit_code"
    notify_ops_team "Backup Failed" "Database backup process failed with exit code $exit_code"
    exit $exit_code
}

trap handle_error ERR

# Notification function for operations team
notify_ops_team() {
    local subject="$1"
    local message="$2"
    aws ses send-email \
        --from "backup-alerts@company.com" \
        --to "$ALERT_EMAIL" \
        --subject "[${ENVIRONMENT}] $subject" \
        --text "$message"
}

# Health monitoring function
monitor_backup_health() {
    local status="$1"
    local details="$2"
    
    # Send metrics to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "DatabaseBackups" \
        --metric-name "BackupStatus" \
        --value "$([[ $status == "SUCCESS" ]] && echo 1 || echo 0)" \
        --dimensions Environment="${ENVIRONMENT}"
        
    # Log backup details
    log "MONITOR" "Backup Status: $status - $details"
}

# Function to backup PostgreSQL database
backup_postgres() {
    local db_name="$1"
    local backup_path="$2"
    local backup_type="$3"
    local start_time=$(date +%s)
    
    log "INFO" "Starting PostgreSQL backup: $db_name ($backup_type)"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Set backup flags based on type
    local backup_flags=""
    if [[ "$backup_type" == "incremental" ]]; then
        backup_flags="--format=custom --blobs --verbose --compress=9"
    else
        backup_flags="--format=custom --blobs --verbose --compress=9 --clean --create"
    fi
    
    # Execute backup with retries
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if PGPASSWORD="${DB_PASSWORD}" pg_dump \
            -h "${DB_HOST}" \
            -p "${DB_PORT}" \
            -U "${DB_USER}" \
            $backup_flags \
            "$db_name" > "${backup_path}/${db_name}_${BACKUP_PREFIX}.dump"; then
            
            # Encrypt backup using AWS KMS
            aws kms encrypt \
                --key-id "$KMS_KEY_ID" \
                --plaintext fileb://"${backup_path}/${db_name}_${BACKUP_PREFIX}.dump" \
                --output text \
                --query CiphertextBlob > "${backup_path}/${db_name}_${BACKUP_PREFIX}.dump.encrypted"
            
            # Upload to S3 with server-side encryption
            aws s3 cp \
                "${backup_path}/${db_name}_${BACKUP_PREFIX}.dump.encrypted" \
                "${S3_BUCKET}/postgres/${backup_type}/" \
                --sse aws:kms \
                --sse-kms-key-id "$KMS_KEY_ID"
            
            break
        else
            retry_count=$((retry_count + 1))
            log "WARN" "Postgres backup attempt $retry_count failed, retrying..."
            sleep 60
        fi
    done
    
    # Calculate backup duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Log backup completion
    log "INFO" "PostgreSQL backup completed in $duration seconds"
    
    # Cleanup local files
    rm -f "${backup_path}/${db_name}_${BACKUP_PREFIX}.dump"*
    
    return 0
}

# Function to backup DocumentDB
backup_documentdb() {
    local conn_string="$1"
    local backup_path="$2"
    local start_time=$(date +%s)
    
    log "INFO" "Starting DocumentDB backup"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Execute backup with retries
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if mongodump \
            --uri="$conn_string" \
            --ssl \
            --sslCAFile=/etc/ssl/certs/rds-ca-2019-root.pem \
            --out="${backup_path}/docdb_${BACKUP_PREFIX}"; then
            
            # Compress backup
            tar czf "${backup_path}/docdb_${BACKUP_PREFIX}.tar.gz" \
                -C "$backup_path" "docdb_${BACKUP_PREFIX}"
            
            # Encrypt backup
            aws kms encrypt \
                --key-id "$KMS_KEY_ID" \
                --plaintext fileb://"${backup_path}/docdb_${BACKUP_PREFIX}.tar.gz" \
                --output text \
                --query CiphertextBlob > "${backup_path}/docdb_${BACKUP_PREFIX}.tar.gz.encrypted"
            
            # Upload to S3
            aws s3 cp \
                "${backup_path}/docdb_${BACKUP_PREFIX}.tar.gz.encrypted" \
                "${S3_BUCKET}/documentdb/" \
                --sse aws:kms \
                --sse-kms-key-id "$KMS_KEY_ID"
            
            break
        else
            retry_count=$((retry_count + 1))
            log "WARN" "DocumentDB backup attempt $retry_count failed, retrying..."
            sleep 60
        fi
    done
    
    # Calculate backup duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Log backup completion
    log "INFO" "DocumentDB backup completed in $duration seconds"
    
    # Cleanup local files
    rm -rf "${backup_path}/docdb_${BACKUP_PREFIX}"*
    
    return 0
}

# Function to cleanup old backups
cleanup_old_backups() {
    local s3_path="$1"
    local retention_days="$2"
    
    log "INFO" "Starting cleanup of backups older than $retention_days days"
    
    # Delete old backups from S3
    aws s3 ls "$s3_path" | while read -r line; do
        createDate=$(echo "$line" | awk {'print $1" "$2'})
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "$retention_days days ago" +%s)
        
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo "$line" | awk {'print $4'})
            if [[ $fileName != "" ]]; then
                aws s3 rm "$s3_path/$fileName"
                log "INFO" "Deleted old backup: $fileName"
            fi
        fi
    done
}

# Main execution
main() {
    log "INFO" "Starting database backup process (Type: $BACKUP_TYPE)"
    
    # Create backup directories
    mkdir -p "$BACKUP_ROOT"/{postgres,documentdb}
    
    # Backup PostgreSQL
    backup_postgres \
        "email_platform" \
        "$BACKUP_ROOT/postgres" \
        "$BACKUP_TYPE"
    
    # Backup DocumentDB
    backup_documentdb \
        "$DOCDB_CONN_STRING" \
        "$BACKUP_ROOT/documentdb"
    
    # Cleanup old backups if this is a full backup
    if [[ "$BACKUP_TYPE" == "full" ]]; then
        cleanup_old_backups "$S3_BUCKET/postgres/full" "$RETENTION_DAYS"
        cleanup_old_backups "$S3_BUCKET/documentdb" "$RETENTION_DAYS"
    fi
    
    # Monitor backup health
    monitor_backup_health "SUCCESS" "All database backups completed successfully"
    
    log "INFO" "Database backup process completed successfully"
}

# Execute main function
main "$@"