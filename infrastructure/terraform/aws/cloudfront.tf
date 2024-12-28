# Provider version: aws ~> 5.0

# Local variables for CloudFront configuration
locals {
  s3_origin_id = "${local.project_name}-${var.environment}-origin"
  
  # Custom error response configuration for SPA
  custom_error_responses = [
    {
      error_code         = 404
      response_code      = 200
      response_page_path = "/index.html"
    },
    {
      error_code         = 403
      response_code      = 200
      response_page_path = "/index.html"
    }
  ]
}

# CloudFront Origin Access Identity for S3 bucket access
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${var.environment} environment"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "AI Email Management Platform - ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  web_acl_id          = aws_wafv2_web_acl.cloudfront_waf.arn
  
  # Domain aliases based on environment
  aliases = [var.environment == "prod" ? var.domain_name : "${var.environment}.${var.domain_name}"]

  # Origin configuration for S3 bucket
  origin {
    domain_name = aws_s3_bucket.assets_bucket.bucket_regional_domain_name
    origin_id   = local.s3_origin_id

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    # Cache and origin request policies
    cache_policy_id          = data.aws_cloudfront_cache_policy.managed_caching.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.default.id

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Custom error responses for SPA
  dynamic "custom_error_response" {
    for_each = local.custom_error_responses
    content {
      error_code         = custom_error_response.value.error_code
      response_code      = custom_error_response.value.response_code
      response_page_path = custom_error_response.value.response_page_path
    }
  }

  # Geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Logging configuration
  logging_config {
    include_cookies = false
    bucket         = "${aws_s3_bucket.logs.bucket_domain_name}"
    prefix         = "cloudfront/"
  }

  tags = merge(local.common_tags, {
    Name        = "${local.project_name}-${var.environment}-distribution"
    Service     = "CloudFront"
    Description = "Content delivery for web application assets"
  })
}

# Origin request policy
resource "aws_cloudfront_origin_request_policy" "default" {
  name    = "${local.project_name}-${var.environment}-origin-request-policy"
  comment = "Default origin request policy for ${var.environment} environment"
  
  cookies_config {
    cookie_behavior = "none"
  }
  
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
    }
  }
  
  query_strings_config {
    query_string_behavior = "none"
  }
}

# Data source for managed cache policy
data "aws_cloudfront_cache_policy" "managed_caching" {
  name = "Managed-CachingOptimized"
}

# Outputs
output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main_distribution.id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main_distribution.domain_name
}