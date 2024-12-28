# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region where resources will be deployed"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be in the format: us-west-2, eu-central-1, etc."
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# VPC Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ deployment"
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

# EKS Configuration
variable "eks_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.28"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.eks_version))
    error_message = "EKS version must be in the format: 1.28"
  }
}

variable "eks_node_instance_types" {
  type        = list(string)
  description = "Instance types for EKS worker nodes"
  default     = ["t3.large", "t3.xlarge"]
}

# RDS Configuration
variable "rds_instance_class" {
  type        = string
  description = "Instance class for RDS database"
  default     = "db.t3.large"
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain database backups"
  default     = 30

  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days"
  }
}

# Security Configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable encryption for data at rest"
  default     = true
}

# ElastiCache Configuration
variable "redis_node_type" {
  type        = string
  description = "Node type for Redis cache cluster"
  default     = "cache.t3.medium"
}

# DocumentDB Configuration
variable "documentdb_instance_class" {
  type        = string
  description = "Instance class for DocumentDB cluster"
  default     = "db.t3.medium"
}

# Domain and SSL Configuration
variable "domain_name" {
  type        = string
  description = "Domain name for Route53 and SSL certificate"

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid fully qualified domain name"
  }
}

# WAF Configuration
variable "enable_waf" {
  type        = bool
  description = "Enable WAF for API Gateway and ALB"
  default     = true
}

# Tags Configuration
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default = {
    ManagedBy = "terraform"
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring for resources"
  default     = true
}

# Auto Scaling Configuration
variable "eks_min_size" {
  type        = number
  description = "Minimum size of EKS node group"
  default     = 3

  validation {
    condition     = var.eks_min_size >= 1
    error_message = "Minimum size must be at least 1"
  }
}

variable "eks_max_size" {
  type        = number
  description = "Maximum size of EKS node group"
  default     = 10

  validation {
    condition     = var.eks_max_size >= var.eks_min_size
    error_message = "Maximum size must be greater than or equal to minimum size"
  }
}

# Database Configuration
variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for databases"
  default     = true
}

variable "db_deletion_protection" {
  type        = bool
  description = "Enable deletion protection for databases"
  default     = true
}