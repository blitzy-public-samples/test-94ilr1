# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent configuration
locals {
  db_name          = "email_platform"
  db_port          = "5432"
  db_username      = "admin"
  db_family        = "postgres14"
  db_engine        = "postgres"
  db_engine_version = "14.9"  # Latest stable version of PostgreSQL 14
}

# RDS module configuration
module "rds" {
  source = "../modules/rds"

  # Basic instance configuration
  identifier        = "${var.environment}-email-platform"
  instance_class    = var.rds_instance_class
  engine           = local.db_engine
  engine_version   = local.db_engine_version
  database_name    = local.db_name
  port             = local.db_port
  username         = local.db_username
  family           = local.db_family

  # Network configuration
  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids

  # Storage configuration
  allocated_storage      = 500  # 500GB initial storage
  max_allocated_storage  = 1000 # 1TB max storage
  storage_type          = "gp3" # General Purpose SSD
  iops                  = 12000 # Optimized for high performance

  # Backup configuration
  backup_retention_period = 30  # 30 days retention
  backup_window          = "03:00-04:00"  # 3-4 AM UTC
  maintenance_window     = "Mon:04:00-Mon:05:00"  # 4-5 AM UTC Monday

  # High availability configuration
  multi_az = var.environment == "prod"  # Enable Multi-AZ for production

  # Security configuration
  storage_encrypted = true
  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"
  apply_immediately = var.environment != "prod"

  # Performance monitoring
  monitoring_interval = 60  # Enhanced monitoring every minute
  monitoring_role_arn = var.monitoring_role_arn
  performance_insights_enabled = true
  performance_insights_retention_period = 731  # 2 years retention

  # Maintenance configuration
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot = true

  # Logging configuration
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]

  # Parameter group configuration
  parameter_group_parameters = {
    max_connections = "1000"
    shared_buffers = "8GB"
    effective_cache_size = "24GB"
    maintenance_work_mem = "2GB"
    checkpoint_completion_target = "0.9"
    wal_buffers = "16MB"
    default_statistics_target = "100"
    random_page_cost = "1.1"
    effective_io_concurrency = "200"
    work_mem = "8MB"
    min_wal_size = "2GB"
    max_wal_size = "8GB"
  }

  # Resource tagging
  tags = {
    Name = "${var.environment}-rds"
    Environment = var.environment
    Service = "email-platform"
    Terraform = "true"
    Backup = "required"
    SecurityCompliance = "required"
  }
}

# Output values for other modules to consume
output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "The port number for the RDS instance"
  value       = module.rds.port
}