# AWS ElastiCache Redis Configuration
# Provider version: ~> 5.0

# Local variables for resource naming and configuration
locals {
  cache_name              = "${local.project_name}-${var.environment}-cache"
  cache_port             = "6379"
  redis_version          = "7.0"
  maintenance_window     = "sun:05:00-sun:07:00"
  snapshot_window        = "03:00-05:00"
  snapshot_retention_days = "7"
}

# ElastiCache subnet group for Redis cluster deployment
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.cache_name}-subnet-group"
  subnet_ids  = module.vpc.private_subnets
  description = "Subnet group for ${var.environment} Redis cluster"

  tags = merge(local.common_tags, {
    Name = "${local.cache_name}-subnet-group"
  })
}

# ElastiCache parameter group for Redis configuration
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis7"
  name        = "${local.cache_name}-params"
  description = "Redis parameter group for ${var.environment} environment"

  # Performance and reliability optimizations
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Least Recently Used eviction policy
  }

  parameter {
    name  = "timeout"
    value = "300"  # Connection timeout in seconds
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # TCP keepalive interval
  }

  parameter {
    name  = "maxclients"
    value = "65000"  # Maximum concurrent connections
  }

  tags = merge(local.common_tags, {
    Name = "${local.cache_name}-params"
  })
}

# ElastiCache replication group for Redis cluster
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = local.cache_name
  description         = "Redis cluster for ${var.environment} environment"
  node_type           = var.redis_node_type
  port               = local.cache_port

  # Parameter and subnet group associations
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  # High availability configuration
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters        = 3  # Primary + 2 replicas for HA

  # Security configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token_enabled         = true

  # Engine configuration
  engine         = "redis"
  engine_version = local.redis_version

  # Maintenance and backup configuration
  maintenance_window      = local.maintenance_window
  snapshot_window        = local.snapshot_window
  snapshot_retention_limit = local.snapshot_retention_days
  auto_minor_version_upgrade = true
  apply_immediately      = false

  # Monitoring and notifications
  notification_topic_arn = var.sns_topic_arn

  tags = merge(local.common_tags, {
    Name = local.cache_name
  })
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${local.cache_name}-sg"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for ${var.environment} Redis cluster"

  # Inbound rule for Redis access from private subnets
  ingress {
    from_port       = local.cache_port
    to_port         = local.cache_port
    protocol        = "tcp"
    cidr_blocks     = module.vpc.private_subnets_cidr_blocks
    description     = "Allow Redis access from private subnets"
  }

  # Outbound rule allowing all traffic
  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.cache_name}-sg"
  })
}

# Output definitions for Redis cluster
output "redis_endpoint" {
  description = "Primary Redis cluster endpoint for application connections"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis cluster port number for application configuration"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster access control"
  value       = aws_security_group.redis.id
}