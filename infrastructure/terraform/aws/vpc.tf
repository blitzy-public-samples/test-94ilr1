# AWS Provider configuration
# AWS Provider version ~> 5.0 for latest features and security updates
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource tagging and configuration
locals {
  vpc_tags = {
    Project             = "AI-Email-Platform"
    ManagedBy          = "Terraform"
    Environment        = var.environment
    SecurityZone       = "restricted"
    DataClassification = "confidential"
    CostCenter         = "email-platform"
    BackupPolicy       = "daily"
    MaintenanceWindow  = "sun:03:00-sun:05:00"
  }
}

# VPC Module configuration
# Implements a multi-AZ VPC with public and private subnets
module "vpc" {
  source = "../modules/vpc"

  # Core VPC Configuration
  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  availability_zones   = var.availability_zones
  enable_dns_hostnames = true
  enable_dns_support   = true

  # NAT Gateway Configuration - One per AZ for high availability
  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  # VPN Gateway - Disabled by default, enable if VPN connectivity is required
  enable_vpn_gateway = false

  # DNS and DHCP Configuration
  enable_dhcp_options = true

  # VPC Flow Logs Configuration for network monitoring and security
  enable_flow_log                          = true
  create_flow_log_cloudwatch_log_group    = true
  create_flow_log_cloudwatch_iam_role     = true
  flow_log_max_aggregation_interval       = 60

  # Apply common tags to all VPC resources
  tags = local.vpc_tags
}

# Output definitions for use by other Terraform configurations
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}