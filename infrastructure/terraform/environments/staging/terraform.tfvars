# AWS Region Configuration
aws_region = "us-west-2"
environment = "staging"

# Network Configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# EKS Configuration
eks_version = "1.28"
eks_node_instance_types = {
  general = ["t3.xlarge"]          # 4 vCPU, 16GB RAM for general workloads
  memory_optimized = ["r6i.2xlarge"] # 8 vCPU, 64GB RAM for memory-intensive workloads
}
eks_node_counts = {
  general = {
    desired_size = 3
    min_size = 2
    max_size = 5
  }
  memory_optimized = {
    desired_size = 2
    min_size = 1
    max_size = 4
  }
}

# RDS Configuration
rds_instance_class = "db.r6g.xlarge"    # 4 vCPU, 32GB RAM
rds_engine_version = "14"               # PostgreSQL 14
multi_az = true
db_deletion_protection = true

# ElastiCache Configuration
elasticache_node_type = "cache.t4g.medium"  # 2 vCPU, 3.09GB RAM
elasticache_engine_version = "7.0"
elasticache_cluster_size = 2

# DocumentDB Configuration
docdb_instance_class = "db.r6g.large"    # 2 vCPU, 16GB RAM
docdb_engine_version = "6.0"
docdb_cluster_size = 2

# Backup Configuration
backup_retention_period = 14  # 14 days retention for staging

# Security Configuration
enable_encryption = true
enable_waf = true
enable_monitoring = true

# Domain Configuration
domain_name = "staging.email-platform.com"

# Common Tags
tags = {
  Environment = "staging"
  ManagedBy = "terraform"
  Project = "email-platform"
  CostCenter = "engineering"
}

# Monitoring Configuration
enable_monitoring = true
monitoring_retention_days = 30

# Auto Scaling Configuration
eks_min_size = 3
eks_max_size = 10

# Storage Configuration
storage_encrypted = true
storage_type = "gp3"
storage_iops = 3000
storage_throughput = 125

# Network Security Configuration
enable_network_policy = true
enable_pod_security_policy = true
enable_cluster_encryption = true

# Load Balancer Configuration
enable_cross_zone_load_balancing = true
enable_deletion_protection = true
enable_http2 = true