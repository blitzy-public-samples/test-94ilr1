# AWS Region Configuration
aws_region = "us-west-2"

# Environment Identifier
environment = "dev"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b"
]

# EKS Configuration
eks_version = "1.28"
eks_node_instance_types = ["t3.medium"]
eks_min_size = 2
eks_max_size = 4

# RDS Configuration
rds_instance_class = "db.t4g.medium"
backup_retention_period = 7
multi_az = false
db_deletion_protection = false

# ElastiCache Configuration
redis_node_type = "cache.t4g.medium"

# DocumentDB Configuration
documentdb_instance_class = "db.t4g.medium"

# Security Configuration
enable_encryption = true
enable_waf = true

# Domain Configuration
domain_name = "dev.email-platform.internal"

# Monitoring Configuration
enable_monitoring = true

# Resource Tags
tags = {
  Environment = "dev"
  ManagedBy = "terraform"
  Project = "email-platform"
  CostCenter = "development"
}