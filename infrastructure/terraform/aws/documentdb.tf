# AWS DocumentDB Configuration for Email Context and Analysis Data Storage
# Provider version ~> 5.0 required for latest DocumentDB features

# Local variables for DocumentDB configuration
locals {
  docdb_port           = 27017
  docdb_family         = "docdb4.0"
  docdb_engine        = "docdb"
  docdb_engine_version = "4.0.0"
  
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "documentdb"
    Purpose     = "email-context-store"
  }
}

# DocumentDB subnet group for cluster deployment
resource "aws_docdb_subnet_group" "docdb_subnet_group" {
  name        = "${var.environment}-docdb-subnet-group"
  subnet_ids  = var.private_subnet_ids
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-docdb-subnet-group"
    }
  )
}

# DocumentDB cluster parameter group for custom configurations
resource "aws_docdb_cluster_parameter_group" "docdb_cluster_parameter_group" {
  family = local.docdb_family
  name   = "${var.environment}-docdb-cluster-params"
  
  parameter {
    name  = "tls"
    value = "enabled"
  }
  
  parameter {
    name  = "audit_logs"
    value = "enabled"
  }
  
  parameter {
    name  = "profiler"
    value = "enabled"
  }
  
  tags = local.common_tags
}

# DocumentDB cluster configuration
resource "aws_docdb_cluster" "docdb_cluster" {
  cluster_identifier     = "${var.environment}-docdb"
  engine                = local.docdb_engine
  engine_version        = local.docdb_engine_version
  master_username       = "admin"
  master_password       = random_password.docdb_master_password.result
  port                 = local.docdb_port
  
  db_subnet_group_name   = aws_docdb_subnet_group.docdb_subnet_group.name
  vpc_security_group_ids = [aws_security_group.docdb_security_group.id]
  
  # High availability and backup configuration
  backup_retention_period      = var.backup_retention_period
  preferred_backup_window      = "02:00-03:00"
  preferred_maintenance_window = "mon:03:00-mon:04:00"
  skip_final_snapshot         = false
  final_snapshot_identifier   = "${var.environment}-docdb-final-snapshot"
  
  # Security configuration
  storage_encrypted = true
  kms_key_id       = aws_kms_key.docdb_encryption_key.arn
  
  # Monitoring and logging
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  
  # Apply common tags
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-docdb"
    }
  )
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "docdb_cluster_instance" {
  count              = 3
  identifier         = "${var.environment}-docdb-${count.index}"
  cluster_identifier = aws_docdb_cluster.docdb_cluster.id
  instance_class     = var.documentdb_instance_class
  
  # Enable automatic minor version upgrades
  auto_minor_version_upgrade = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-docdb-${count.index}"
    }
  )
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb_security_group" {
  name        = "${var.environment}-docdb-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = local.docdb_port
    to_port         = local.docdb_port
    protocol        = "tcp"
    cidr_blocks     = ["10.0.0.0/8"]
    description     = "Allow DocumentDB access from VPC"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-docdb-sg"
    }
  )
}

# KMS key for DocumentDB encryption
resource "aws_kms_key" "docdb_encryption_key" {
  description             = "KMS key for DocumentDB encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = local.common_tags
}

# Random password generation for DocumentDB master user
resource "random_password" "docdb_master_password" {
  length  = 16
  special = true
  
  # Ensure password meets DocumentDB requirements
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store DocumentDB credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "docdb_credentials" {
  name        = "${var.environment}/docdb/credentials"
  description = "DocumentDB cluster credentials"
  kms_key_id  = aws_kms_key.docdb_encryption_key.arn
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "docdb_credentials" {
  secret_id = aws_secretsmanager_secret.docdb_credentials.id
  secret_string = jsonencode({
    username = aws_docdb_cluster.docdb_cluster.master_username
    password = random_password.docdb_master_password.result
    host     = aws_docdb_cluster.docdb_cluster.endpoint
    port     = local.docdb_port
  })
}

# Output definitions
output "docdb_cluster_endpoint" {
  description = "The cluster endpoint for DocumentDB"
  value       = aws_docdb_cluster.docdb_cluster.endpoint
  sensitive   = true
}

output "docdb_cluster_reader_endpoint" {
  description = "The reader endpoint for DocumentDB cluster"
  value       = aws_docdb_cluster.docdb_cluster.reader_endpoint
  sensitive   = true
}

output "docdb_cluster_port" {
  description = "The port number for DocumentDB cluster"
  value       = local.docdb_port
}