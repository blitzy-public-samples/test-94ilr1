# Provider version: aws ~> 5.0

# Local variables for Route53 configuration
locals {
  # Domain names based on environment
  domain_names = {
    prod    = var.domain_name
    staging = "staging.${var.domain_name}"
    dev     = "dev.${var.domain_name}"
  }

  # Common tags for Route53 resources
  route53_tags = {
    Service     = "Route53"
    Component   = "DNS"
    Description = "DNS management for Email Platform"
  }
}

# Primary hosted zone for the domain
resource "aws_route53_zone" "main" {
  name = var.domain_name
  
  comment = "Managed by Terraform - AI Email Management Platform ${var.environment}"
  
  # VPC association for private DNS
  dynamic "vpc" {
    for_each = var.environment != "prod" ? [1] : []
    content {
      vpc_id     = aws_vpc.main.id
      vpc_region = var.aws_region
    }
  }

  tags = merge(
    local.route53_tags,
    {
      Name        = "${var.environment}-dns-zone"
      Environment = var.environment
    }
  )
}

# DNSSEC configuration for enhanced security
resource "aws_route53_key_signing_key" "main" {
  hosted_zone_id = aws_route53_zone.main.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name = "${var.environment}-dnssec-key"
  status = "ACTIVE"
}

resource "aws_route53_hosted_zone_dnssec" "main" {
  hosted_zone_id = aws_route53_zone.main.id
}

# Health check for DNS failover
resource "aws_route53_health_check" "primary" {
  fqdn              = local.domain_names[var.environment]
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  regions = ["us-west-2", "us-east-1", "eu-west-1"]
  
  tags = merge(
    local.route53_tags,
    {
      Name = "${var.environment}-health-check"
    }
  )

  measure_latency = true
  enable_sni      = true
}

# Primary A record for CloudFront distribution
resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain_names[var.environment]
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main_distribution.domain_name
    zone_id               = aws_cloudfront_distribution.main_distribution.hosted_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "${var.environment}-primary"
}

# Secondary A record for failover
resource "aws_route53_record" "secondary" {
  count   = var.environment == "prod" ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain_names[var.environment]
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.backup_distribution.domain_name
    zone_id               = aws_cloudfront_distribution.backup_distribution.hosted_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "${var.environment}-secondary"
}

# CNAME record for www subdomain
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${local.domain_names[var.environment]}"
  type    = "CNAME"
  ttl     = "300"
  records = [local.domain_names[var.environment]]
}

# MX records for email handling
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain_names[var.environment]
  type    = "MX"
  ttl     = "300"
  records = [
    "10 inbound-smtp.${var.aws_region}.amazonaws.com"
  ]
}

# TXT record for SPF
resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain_names[var.environment]
  type    = "TXT"
  ttl     = "300"
  records = [
    "v=spf1 include:amazonses.com ~all"
  ]
}

# DMARC record
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${local.domain_names[var.environment]}"
  type    = "TXT"
  ttl     = "300"
  records = [
    "v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}"
  ]
}

# Outputs for external reference
output "route53_zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_zone_nameservers" {
  description = "The nameservers for the Route53 hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "route53_health_check_id" {
  description = "The ID of the Route53 health check"
  value       = aws_route53_health_check.primary.id
}