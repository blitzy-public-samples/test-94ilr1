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

  # Production state management in S3 with DynamoDB locking
  backend "s3" {
    bucket         = "ai-email-platform-prod-tfstate"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "ai-email-platform-prod-tflock"
  }
}

# Local variables for production environment
locals {
  environment = "prod"
  common_tags = {
    Environment  = "prod"
    Project      = "ai-email-platform"
    ManagedBy    = "terraform"
    BusinessUnit = "engineering"
    CostCenter   = "prod-infrastructure"
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
    args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
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
      args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
    }
  }
}

# Core AWS infrastructure module for production environment
module "aws_infrastructure" {
  source = "../../aws"

  # Production-specific configuration
  aws_region    = "us-west-2"
  environment   = local.environment
  vpc_cidr      = "10.0.0.0/16"
  
  # High availability configuration
  availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
  
  # EKS configuration for production workloads
  eks_version = "1.28"
  eks_node_instance_types = {
    general = ["t3.xlarge"]
    memory_optimized = ["r6i.2xlarge"]
  }
  
  # Database configurations for production scale
  rds_instance_class     = "db.r6g.xlarge"
  elasticache_node_type  = "cache.r6g.xlarge"
  docdb_instance_class   = "db.r6g.xlarge"
  
  # Production backup and security settings
  backup_retention_period = 30
  enable_encryption      = true
  
  # Resource tagging
  tags = local.common_tags
}

# Output production infrastructure endpoints
output "vpc_id" {
  description = "Production VPC identifier"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Production EKS cluster endpoint"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.aws_infrastructure.rds_endpoint
  sensitive   = true
}

# Additional production-specific security group rules
resource "aws_security_group_rule" "eks_api_access" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = [module.aws_infrastructure.vpc_cidr]
  security_group_id = module.aws_infrastructure.eks_cluster_security_group_id
  description       = "Allow HTTPS access to EKS API endpoint"
}

# CloudWatch alarms for production monitoring
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "prod-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [module.aws_infrastructure.sns_alert_topic_arn]
  
  dimensions = {
    DBInstanceIdentifier = module.aws_infrastructure.rds_instance_id
  }
}

resource "aws_cloudwatch_metric_alarm" "eks_cpu" {
  alarm_name          = "prod-eks-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "node_cpu_utilization"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors EKS node CPU utilization"
  alarm_actions       = [module.aws_infrastructure.sns_alert_topic_arn]
  
  dimensions = {
    ClusterName = module.aws_infrastructure.eks_cluster_name
  }
}