# Configure Terraform and providers
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"  # v5.0
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"  # v2.23
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"  # v2.11
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "${local.project_name}-${var.environment}-tfstate"
    key            = "terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "${local.project_name}-${var.environment}-tflock"
  }
}

# Local variables
locals {
  project_name = "email-platform"
  common_tags = {
    Project             = local.project_name
    Environment         = var.environment
    ManagedBy          = "terraform"
    SLA                = "99.9%"
    SecurityCompliance = "enterprise"
    BackupEnabled      = "true"
  }
  
  # EKS configuration
  eks_cluster_name = "${local.project_name}-${var.environment}-eks"
  
  # Database configuration
  db_instance_class = {
    dev     = "db.r6g.large"
    staging = "db.r6g.xlarge"
    prod    = "db.r6g.2xlarge"
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}

# VPC Module
module "vpc" {
  source = "../modules/vpc"
  
  vpc_cidr            = "10.0.0.0/16"
  environment         = var.environment
  availability_zones  = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  enable_nat_gateway  = true
  single_nat_gateway  = var.environment != "prod"
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = local.eks_cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = module.vpc.private_subnets
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_cloudwatch_log_group.eks_cluster
  ]

  tags = merge(
    local.common_tags,
    {
      Name = local.eks_cluster_name
    }
  )
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgresql" {
  identifier        = "${local.project_name}-${var.environment}-postgresql"
  engine            = "postgres"
  engine_version    = "14.9"
  instance_class    = local.db_instance_class[var.environment]
  allocated_storage = 100
  
  db_name  = "emailplatform"
  username = "dbadmin"
  password = aws_secretsmanager_secret_version.db_password.secret_string
  
  multi_az                = var.environment == "prod"
  db_subnet_group_name    = aws_db_subnet_group.postgresql.name
  vpc_security_group_ids  = [aws_security_group.postgresql.id]
  
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  storage_encrypted      = true
  kms_key_id            = aws_kms_key.rds.arn
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn        = aws_iam_role.rds_monitoring.arn
  
  deletion_protection = true
  skip_final_snapshot = false
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_name}-${var.environment}-postgresql"
    }
  )
}

# DocumentDB Cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier     = "${local.project_name}-${var.environment}-docdb"
  engine                = "docdb"
  master_username       = "docdbadmin"
  master_password       = aws_secretsmanager_secret_version.docdb_password.secret_string
  
  vpc_security_group_ids = [aws_security_group.docdb.id]
  db_subnet_group_name   = aws_docdb_subnet_group.main.name
  
  backup_retention_period = var.backup_retention_period
  preferred_backup_window = "02:00-03:00"
  
  storage_encrypted = true
  kms_key_id       = aws_kms_key.docdb.arn
  
  deletion_protection = true
  skip_final_snapshot = false
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_name}-${var.environment}-docdb"
    }
  )
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.project_name}-${var.environment}-redis"
  engine              = "redis"
  engine_version      = "7.0"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = var.environment == "prod" ? 3 : 1
  
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
  
  port                = 6379
  
  snapshot_retention_limit = var.backup_retention_period
  snapshot_window         = "01:00-02:00"
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_name}-${var.environment}-redis"
    }
  )
}

# S3 Bucket for attachments
resource "aws_s3_bucket" "attachments" {
  bucket = "${local.project_name}-${var.environment}-attachments"
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_name}-${var.environment}-attachments"
    }
  )
}

resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "${local.project_name}-${var.environment}-waf"
  description = "WAF rules for Email Platform"
  scope       = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }
  
  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/${local.project_name}/${var.environment}/application"
  retention_in_days = 30
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}