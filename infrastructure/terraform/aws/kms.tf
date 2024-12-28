# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common tags and configurations
locals {
  common_tags = {
    Project             = "email-platform"
    Environment         = var.environment
    ManagedBy          = "terraform"
    SecurityCompliance = "GDPR-SOC2-HIPAA"
  }
}

# KMS key for RDS database encryption
resource "aws_kms_key" "rds_encryption_key" {
  description              = "KMS key for RDS database encryption with automatic rotation"
  deletion_window_in_days  = 30
  enable_key_rotation     = true
  multi_region            = false
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose = "RDS Encryption"
  })
}

# Alias for RDS encryption key
resource "aws_kms_alias" "rds_key_alias" {
  name          = "alias/${var.environment}-rds-key"
  target_key_id = aws_kms_key.rds_encryption_key.key_id
}

# KMS key for DocumentDB encryption
resource "aws_kms_key" "docdb_encryption_key" {
  description              = "KMS key for DocumentDB encryption with automatic rotation"
  deletion_window_in_days  = 30
  enable_key_rotation     = true
  multi_region            = false
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose = "DocumentDB Encryption"
  })
}

# Alias for DocumentDB encryption key
resource "aws_kms_alias" "docdb_key_alias" {
  name          = "alias/${var.environment}-docdb-key"
  target_key_id = aws_kms_key.docdb_encryption_key.key_id
}

# KMS key for application data encryption
resource "aws_kms_key" "app_encryption_key" {
  description              = "KMS key for application data encryption with automatic rotation"
  deletion_window_in_days  = 30
  enable_key_rotation     = true
  multi_region            = false
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose = "Application Data Encryption"
  })
}

# Alias for application encryption key
resource "aws_kms_alias" "app_key_alias" {
  name          = "alias/${var.environment}-app-key"
  target_key_id = aws_kms_key.app_encryption_key.key_id
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for key ARNs
output "rds_kms_key_arn" {
  description = "ARN of KMS key for RDS encryption"
  value       = aws_kms_key.rds_encryption_key.arn
}

output "docdb_kms_key_arn" {
  description = "ARN of KMS key for DocumentDB encryption"
  value       = aws_kms_key.docdb_encryption_key.arn
}

output "app_kms_key_arn" {
  description = "ARN of KMS key for application data encryption"
  value       = aws_kms_key.app_encryption_key.arn
}