# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent naming and configuration
locals {
  db_family              = "postgres14"
  db_engine             = "postgres"
  db_engine_version     = "14.9"  # Latest stable version of PostgreSQL 14
  db_port               = "5432"
  monitoring_role_name  = "${var.identifier}-monitoring-role"
  parameter_group_name  = "${var.identifier}-parameter-group"
  subnet_group_name     = "${var.identifier}-subnet-group"
  security_group_name   = "${var.identifier}-security-group"
}

# RDS instance configuration
resource "aws_db_instance" "db_instance" {
  identifier     = var.identifier
  engine         = local.db_engine
  engine_version = local.db_engine_version
  
  # Instance specifications matching technical requirements
  instance_class        = var.instance_class  # db.r6g.2xlarge for 8vCPU, 32GB RAM
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type         = "gp3"  # Latest generation SSD storage
  iops                 = 12000  # Optimized for high performance
  
  # Database configuration
  db_name  = var.database_name
  username = var.username
  port     = var.port
  
  # High availability configuration
  multi_az                = true
  availability_zone       = null  # AWS chooses optimal AZ
  
  # Backup configuration
  backup_retention_period    = 30
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  
  # Security configuration
  storage_encrypted        = true
  deletion_protection      = true
  publicly_accessible      = false
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.identifier}-final-snapshot"
  
  # Performance monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 731  # 2 years
  monitoring_interval                   = 60   # Enhanced monitoring every minute
  monitoring_role_arn                  = aws_iam_role.rds_monitoring_role.arn
  
  # Logging configuration
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]
  
  # Network configuration
  db_subnet_group_name    = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.db_security_group.id]
  
  # Parameter group configuration
  parameter_group_name = aws_db_parameter_group.db_parameter_group.name
  
  # Maintenance configuration
  auto_minor_version_upgrade = true
  
  tags = var.tags
}

# Parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "db_parameter_group" {
  name        = local.parameter_group_name
  family      = local.db_family
  description = "Custom parameter group for PostgreSQL RDS instance"

  # Performance and connection parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_hint_plan"
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries taking more than 1 second
  }
  
  parameter {
    name  = "max_connections"
    value = "1000"  # Support high concurrency
  }
  
  parameter {
    name  = "work_mem"
    value = "16384"  # 16MB per operation
  }
  
  parameter {
    name  = "maintenance_work_mem"
    value = "2097152"  # 2GB for maintenance operations
  }
  
  parameter {
    name  = "effective_cache_size"
    value = "24576000"  # 24GB for query planning
  }
  
  parameter {
    name  = "ssl"
    value = "1"  # Enforce SSL connections
  }

  tags = var.tags
}

# Subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "db_subnet_group" {
  name        = local.subnet_group_name
  subnet_ids  = var.subnet_ids
  description = "Subnet group for RDS instance"
  
  tags = var.tags
}

# Security group for database access control
resource "aws_security_group" "db_security_group" {
  name        = local.security_group_name
  vpc_id      = var.vpc_id
  description = "Security group for RDS instance"

  # Inbound rule for PostgreSQL access
  ingress {
    description = "PostgreSQL access from allowed CIDR blocks"
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # Outbound rule for database connections
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = local.monitoring_role_name
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  ]

  tags = var.tags
}

# Output values for other modules
output "endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.db_instance.endpoint
}

output "address" {
  description = "The hostname of the RDS instance"
  value       = aws_db_instance.db_instance.address
}

output "port" {
  description = "The port of the RDS instance"
  value       = aws_db_instance.db_instance.port
}

output "arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.db_instance.arn
}

output "security_group_id" {
  description = "The ID of the security group"
  value       = aws_security_group.db_security_group.id
}