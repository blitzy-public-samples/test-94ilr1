# Provider version: aws ~> 5.0

# Local variables for bucket naming
locals {
  attachment_bucket_name = "${local.project_name}-${var.environment}-attachments"
  backup_bucket_name    = "${local.project_name}-${var.environment}-backups"
  assets_bucket_name    = "${local.project_name}-${var.environment}-assets"
}

# Email Attachments Bucket
resource "aws_s3_bucket" "attachment_bucket" {
  bucket        = local.attachment_bucket_name
  force_destroy = false

  tags = merge(local.common_tags, {
    Type = "Attachments"
    Description = "Storage for email attachments"
  })
}

resource "aws_s3_bucket_versioning" "attachment_bucket_versioning" {
  bucket = aws_s3_bucket.attachment_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachment_bucket_encryption" {
  bucket = aws_s3_bucket.attachment_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "attachment_bucket_lifecycle" {
  bucket = aws_s3_bucket.attachment_bucket.id

  rule {
    id     = "archive_old_attachments"
    status = "Enabled"

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "attachment_bucket_access" {
  bucket = aws_s3_bucket.attachment_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# System Backups Bucket
resource "aws_s3_bucket" "backup_bucket" {
  bucket        = local.backup_bucket_name
  force_destroy = false

  tags = merge(local.common_tags, {
    Type = "Backups"
    Description = "Storage for system backups"
  })
}

resource "aws_s3_bucket_versioning" "backup_bucket_versioning" {
  bucket = aws_s3_bucket.backup_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_bucket_encryption" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backup_bucket_access" {
  bucket = aws_s3_bucket.backup_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Application Assets Bucket
resource "aws_s3_bucket" "assets_bucket" {
  bucket        = local.assets_bucket_name
  force_destroy = false

  tags = merge(local.common_tags, {
    Type = "Assets"
    Description = "Storage for application assets"
  })
}

resource "aws_s3_bucket_versioning" "assets_bucket_versioning" {
  bucket = aws_s3_bucket.assets_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets_bucket_encryption" {
  bucket = aws_s3_bucket.assets_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets_bucket_access" {
  bucket = aws_s3_bucket.assets_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for assets bucket (if needed for web assets)
resource "aws_s3_bucket_cors_configuration" "assets_bucket_cors" {
  bucket = aws_s3_bucket.assets_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["https://*.${var.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Outputs
output "attachment_bucket_id" {
  description = "ID of the email attachments S3 bucket"
  value       = aws_s3_bucket.attachment_bucket.id
}

output "backup_bucket_id" {
  description = "ID of the system backups S3 bucket"
  value       = aws_s3_bucket.backup_bucket.id
}

output "assets_bucket_id" {
  description = "ID of the application assets S3 bucket"
  value       = aws_s3_bucket.assets_bucket.id
}