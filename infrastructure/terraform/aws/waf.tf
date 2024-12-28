# AWS WAF v2 Web ACL Configuration for AI Email Management Platform
# Provider version: hashicorp/aws ~> 5.0

# Local variables for WAF configuration
locals {
  waf_name = "${local.project_name}-${var.environment}-waf"
  waf_description = "WAF for AI Email Management Platform ${var.environment} environment"
  waf_log_retention = 90
}

# WAF Web ACL Resource
resource "aws_wafv2_web_acl" "main" {
  name        = local.waf_name
  description = local.waf_description
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
        version     = "Version_2.0"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.waf_name}-common-rules"
      sampled_requests_enabled  = true
    }
  }

  # Rate-based rule for DDoS protection
  rule {
    name     = "RateBasedProtection"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 10000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.waf_name}-rate-limit"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection Protection
  rule {
    name     = "SQLiProtection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
        version     = "Version_2.0"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.waf_name}-sqli"
      sampled_requests_enabled  = true
    }
  }

  # Cross-site Scripting Protection
  rule {
    name     = "XSSProtection"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        version     = "Version_1.0"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.waf_name}-xss"
      sampled_requests_enabled  = true
    }
  }

  # Custom response body for blocked requests
  custom_response_body {
    key          = "blocked_request"
    content_type = "APPLICATION_JSON"
    content      = jsonencode({
      code    = 403
      message = "Access denied by WAF rules"
    })
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${local.waf_name}-metrics"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_kinesis_firehose_delivery_stream.waf_logs.arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  redacted_fields {
    single_header {
      name = "x-api-key"
    }
  }
}

# S3 Bucket for WAF Logs
resource "aws_s3_bucket" "waf_logs" {
  bucket = "${local.waf_name}-logs"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    id     = "log_retention"
    status = "Enabled"

    expiration {
      days = local.waf_log_retention
    }
  }
}

# Kinesis Firehose for WAF Logging
resource "aws_kinesis_firehose_delivery_stream" "waf_logs" {
  name        = "${local.waf_name}-logs"
  destination = "s3"

  s3_configuration {
    role_arn           = aws_iam_role.firehose_role.arn
    bucket_arn         = aws_s3_bucket.waf_logs.arn
    prefix            = "waf-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    compression_format = "GZIP"
    error_output_prefix = "waf-logs-errors/"
    buffer_size        = 128
    buffer_interval    = 300
  }

  tags = local.common_tags
}

# IAM Role for Kinesis Firehose
resource "aws_iam_role" "firehose_role" {
  name = "${local.waf_name}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Policy for Kinesis Firehose
resource "aws_iam_role_policy" "firehose_policy" {
  name = "${local.waf_name}-firehose-policy"
  role = aws_iam_role.firehose_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.waf_logs.arn,
          "${aws_s3_bucket.waf_logs.arn}/*"
        ]
      }
    ]
  })
}

# Outputs
output "waf_web_acl_id" {
  description = "WAF Web ACL ID for CloudFront integration"
  value       = aws_wafv2_web_acl.main.id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN for resource association"
  value       = aws_wafv2_web_acl.main.arn
}