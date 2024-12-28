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

  # S3 backend configuration for state management
  backend "s3" {
    bucket         = "email-platform-dev-tfstate"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "email-platform-dev-tflock"
  }
}

# Local variables for resource naming and tagging
locals {
  environment = "dev"
  project_name = "email-platform"
  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
    Team        = "platform-engineering"
    CostCenter  = "development"
  }
}

# AWS Provider configuration
provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = local.common_tags
  }
}

# Configure Kubernetes provider after EKS cluster creation
provider "kubernetes" {
  host                   = module.aws_infrastructure.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.aws_infrastructure.eks_cluster_ca_cert)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", "${local.project_name}-${local.environment}-eks"]
  }
}

# Configure Helm provider for service deployments
provider "helm" {
  kubernetes {
    host                   = module.aws_infrastructure.eks_cluster_endpoint
    cluster_ca_certificate = base64decode(module.aws_infrastructure.eks_cluster_ca_cert)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", "${local.project_name}-${local.environment}-eks"]
    }
  }
}

# Core AWS infrastructure module
module "aws_infrastructure" {
  source = "../../aws"

  # Development environment configuration
  aws_region    = "us-west-2"
  environment   = local.environment
  vpc_cidr      = "10.0.0.0/16"
  
  # High availability configuration for development
  availability_zones = ["us-west-2a", "us-west-2b"]
  
  # EKS cluster configuration - development sizing
  eks_version            = "1.28"
  eks_node_instance_types = ["t3.medium"]  # Cost-optimized instance type for dev
  eks_min_nodes         = 1
  eks_max_nodes         = 3
  eks_desired_nodes     = 2
  
  # Database configurations - development sizing
  rds_instance_class    = "db.t4g.medium"  # Cost-optimized instance type for dev
  rds_allocated_storage = 50
  
  # Cache configuration - minimal for development
  elasticache_node_type       = "cache.t4g.medium"
  elasticache_num_cache_nodes = 1
  
  # DocumentDB configuration - minimal for development
  docdb_instance_class  = "db.t4g.medium"
  docdb_instance_count  = 1
  
  # Development environment specific settings
  backup_retention_period          = 7  # 7 days retention for dev
  enable_encryption               = true
  enable_multi_az                 = false  # Single AZ for dev
  enable_deletion_protection      = false  # Allow deletion in dev
  enable_performance_insights     = true
  enable_auto_minor_version_upgrade = true
  
  # Resource tagging
  tags = local.common_tags
}

# Output the core infrastructure values
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "The endpoint for the EKS cluster"
  value       = module.aws_infrastructure.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "The endpoint for the RDS instance"
  value       = module.aws_infrastructure.rds_endpoint
}