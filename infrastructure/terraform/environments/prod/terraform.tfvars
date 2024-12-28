# AWS Region Configuration
# Latest stable region with full service availability and optimal latency for ML workloads
aws_region = "us-west-2"

# Environment Identifier
# Production environment tag for resource management and cost allocation
environment = "prod"

# Network Configuration
# Production VPC with large CIDR block for future scaling
vpc_cidr = "10.0.0.0/16"

# High Availability Configuration
# Multi-AZ deployment across three availability zones for redundancy
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# EKS Configuration
# Latest stable EKS version with production-grade settings
eks_version = "1.28"

# Node group instance types optimized for different workload profiles
eks_node_instance_types = {
  # General purpose nodes for API and web services
  general = ["t3.xlarge"]
  
  # Memory optimized nodes for ML workloads and context processing
  memory_optimized = ["r6i.2xlarge"]
}

# Database Configuration
# Memory-optimized instance class for high-performance database operations
rds_instance_class = "db.r6g.xlarge"

# Extended backup retention for compliance and disaster recovery
backup_retention_period = 30

# Security Configuration
# Enable encryption for all data at rest
enable_encryption = true

# Cache Configuration
# Memory-optimized instance type for high-performance caching
redis_node_type = "cache.r6g.xlarge"

# Document Store Configuration
# Memory-optimized instance class for context and analysis data
documentdb_instance_class = "db.r6g.xlarge"

# Domain Configuration
# Production domain for SSL certificate and DNS routing
domain_name = "email-platform.company.com"

# Security Features
# Enable WAF protection with enhanced rule sets
enable_waf = true

# Resource Tagging
# Comprehensive tagging strategy for resource management and cost allocation
tags = {
  Environment   = "prod"
  Project       = "ai-email-platform"
  ManagedBy     = "terraform"
  BusinessUnit  = "engineering"
  CostCenter    = "prod-infrastructure"
}

# Additional Production Settings
multi_az = true
db_deletion_protection = true
enable_monitoring = true

# Auto Scaling Configuration
eks_min_size = 3
eks_max_size = 10