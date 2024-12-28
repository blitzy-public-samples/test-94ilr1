# Configure Terraform and required providers
terraform {
  required_providers {
    # AWS Provider v5.0+ for managing AWS infrastructure resources
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Kubernetes Provider v2.23+ for EKS cluster management
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    # Helm Provider v2.11+ for Kubernetes service deployments
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  # Enforce minimum Terraform version
  required_version = ">= 1.5.0"
}

# Local variables for configuration
locals {
  cluster_name = "email-platform-${var.environment}-cluster"
}

# Configure AWS Provider with regional settings and default tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "email-management-platform"
      Owner       = "platform-team"
    }
  }
}

# Configure Kubernetes Provider for EKS cluster management
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
  token                  = module.eks.cluster_token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      local.cluster_name
    ]
  }
}

# Configure Helm Provider for Kubernetes service deployments
provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
    token                  = module.eks.cluster_token

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        local.cluster_name
      ]
    }
  }
}