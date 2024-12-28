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
    bucket         = "email-platform-staging-tfstate"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "email-platform-staging-tflock"
  }
}

# Local variables for environment-specific configuration
locals {
  environment = "staging"
  aws_region = "us-west-2"
  
  # Common tags for resource management
  common_tags = {
    Environment = "staging"
    Project     = "email-platform"
    ManagedBy   = "terraform"
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}

# Configure Kubernetes provider for EKS
provider "kubernetes" {
  host                   = module.aws_infrastructure.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.aws_infrastructure.eks_cluster_ca_certificate)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
  }
}

# Configure Helm provider for service deployments
provider "helm" {
  kubernetes {
    host                   = module.aws_infrastructure.eks_cluster_endpoint
    cluster_ca_certificate = base64decode(module.aws_infrastructure.eks_cluster_ca_certificate)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
    }
  }
}

# Main AWS infrastructure module
module "aws_infrastructure" {
  source = "../../aws"

  # Environment configuration
  environment = local.environment
  aws_region  = local.aws_region

  # VPC Configuration
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

  # EKS Configuration
  eks_version = "1.28"
  eks_node_instance_types = {
    general = ["t3.xlarge"]
    memory_optimized = ["r6i.2xlarge"]
  }
  eks_node_counts = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 5
    }
    memory_optimized = {
      desired_size = 2
      min_size     = 1
      max_size     = 4
    }
  }

  # Database Configuration
  rds_instance_class    = "db.r6g.xlarge"
  rds_engine_version    = "14"
  elasticache_node_type = "cache.t4g.medium"
  elasticache_engine_version = "7.0"
  docdb_instance_class  = "db.r6g.large"
  docdb_engine_version  = "6.0"

  # Backup and Security Configuration
  backup_retention_period = 14
  enable_encryption      = true

  # Resource Tags
  tags = local.common_tags
}

# Output the VPC ID for reference
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.aws_infrastructure.vpc_id
}

# Output the EKS cluster endpoint
output "eks_cluster_endpoint" {
  description = "The endpoint for the EKS cluster"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

# Output the EKS cluster name
output "eks_cluster_name" {
  description = "The name of the EKS cluster"
  value       = module.aws_infrastructure.eks_cluster_name
}

# Output the RDS endpoint
output "rds_endpoint" {
  description = "The endpoint of the RDS instance"
  value       = module.aws_infrastructure.rds_endpoint
  sensitive   = true
}

# Output the DocumentDB endpoint
output "docdb_endpoint" {
  description = "The endpoint of the DocumentDB cluster"
  value       = module.aws_infrastructure.docdb_endpoint
  sensitive   = true
}

# Output the ElastiCache endpoint
output "elasticache_endpoint" {
  description = "The endpoint of the ElastiCache cluster"
  value       = module.aws_infrastructure.elasticache_endpoint
  sensitive   = true
}