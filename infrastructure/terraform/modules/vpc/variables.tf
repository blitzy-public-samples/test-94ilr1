# VPC CIDR block configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network infrastructure"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation (e.g., 10.0.0.0/16)"
  }
}

# Environment identifier for resource naming and tagging
variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev, staging, prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Availability zones configuration for high availability
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment"

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability"
  }
}

# DNS configuration options
variable "enable_dns_hostnames" {
  type        = bool
  description = "Enable DNS hostnames in the VPC"
  default     = true
}

variable "enable_dns_support" {
  type        = bool
  description = "Enable DNS resolution support in the VPC"
  default     = true
}

# NAT Gateway configuration options
variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway for private subnet internet access"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use a single NAT Gateway instead of one per AZ (cost optimization for non-prod)"
  default     = false
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Resource tags for VPC and associated resources"
  default = {
    Terraform = "true"
    Module    = "vpc"
  }
}