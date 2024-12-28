# Provider configuration for AWS and Kubernetes
# AWS Provider version ~> 5.0
provider "aws" {
  region = var.aws_region
}

# Kubernetes Provider version ~> 2.23
provider "kubernetes" {
  host                   = aws_eks_cluster.eks_cluster.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.eks_cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

# Helm Provider version ~> 2.11
provider "helm" {
  kubernetes {
    host                   = aws_eks_cluster.eks_cluster.endpoint
    cluster_ca_certificate = base64decode(aws_eks_cluster.eks_cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

# Local variables for EKS configuration
locals {
  cluster_name = "${local.project_name}-${var.environment}-eks"
  node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 5
      instance_types = ["t3.xlarge"]
      labels = {
        "role" = "general"
      }
    }
    memory_optimized = {
      desired_size = 2
      min_size     = 1
      max_size     = 4
      instance_types = ["r6i.2xlarge"]
      labels = {
        "role" = "memory-optimized"
      }
    }
    compute_optimized = {
      desired_size = 2
      min_size     = 1
      max_size     = 4
      instance_types = ["c6i.2xlarge"]
      labels = {
        "role" = "compute-optimized"
      }
    }
  }
}

# Data source for EKS cluster authentication
data "aws_eks_cluster_auth" "cluster" {
  name = aws_eks_cluster.eks_cluster.name
}

# KMS key for EKS cluster encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Component = "EKS Encryption"
  })
}

# IAM role for EKS cluster
resource "aws_iam_role" "eks_cluster" {
  name = "${local.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Component = "EKS IAM"
  })
}

# Attach required policies to EKS cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# Security group for EKS cluster
resource "aws_security_group" "eks_cluster" {
  name        = "${local.cluster_name}-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Component = "EKS Security"
  })
}

# EKS cluster resource
resource "aws_eks_cluster" "eks_cluster" {
  name     = local.cluster_name
  version  = var.eks_version
  role_arn = aws_iam_role.eks_cluster.arn

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

  tags = merge(local.common_tags, {
    Component = "EKS Cluster"
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# IAM role for EKS node groups
resource "aws_iam_role" "eks_node_group" {
  name = "${local.cluster_name}-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Component = "EKS Node IAM"
  })
}

# Attach required policies to node group role
resource "aws_iam_role_policy_attachment" "eks_node_group_policy" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ])

  policy_arn = each.value
  role       = aws_iam_role.eks_node_group.name
}

# EKS node groups
resource "aws_eks_node_group" "eks_node_groups" {
  for_each = local.node_groups

  cluster_name    = aws_eks_cluster.eks_cluster.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = module.vpc.private_subnets

  instance_types = each.value.instance_types

  scaling_config {
    desired_size = each.value.desired_size
    min_size     = each.value.min_size
    max_size     = each.value.max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = each.value.labels

  tags = merge(local.common_tags, {
    NodeGroup = each.key
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_node_group_policy
  ]
}

# Istio service mesh installation
module "istio" {
  source = "terraform-aws-modules/eks/aws//modules/istio"

  cluster_name     = aws_eks_cluster.eks_cluster.name
  cluster_endpoint = aws_eks_cluster.eks_cluster.endpoint
  cluster_version  = var.eks_version

  enable_monitoring = true
  enable_tracing    = true

  values = {
    global = {
      mtls = {
        enabled = true
      }
    }
  }

  depends_on = [
    aws_eks_cluster.eks_cluster,
    aws_eks_node_group.eks_node_groups
  ]
}

# Prometheus and Grafana monitoring stack
module "monitoring" {
  source = "terraform-aws-modules/eks/aws//modules/prometheus-grafana"

  cluster_name        = aws_eks_cluster.eks_cluster.name
  enable_alertmanager = true
  retention_period    = "15d"
  storage_class       = "gp3"
  storage_size        = "50Gi"

  depends_on = [
    aws_eks_cluster.eks_cluster,
    aws_eks_node_group.eks_node_groups
  ]
}

# Output values
output "cluster_endpoint" {
  description = "EKS cluster endpoint URL for application access"
  value       = aws_eks_cluster.eks_cluster.endpoint
}

output "cluster_name" {
  description = "EKS cluster name for reference"
  value       = aws_eks_cluster.eks_cluster.name
}

output "cluster_security_group_id" {
  description = "Security group ID for cluster access control"
  value       = aws_eks_cluster.eks_cluster.vpc_config[0].cluster_security_group_id
}

output "cluster_oidc_issuer_url" {
  description = "OIDC provider URL for IAM role federation"
  value       = aws_eks_cluster.eks_cluster.identity[0].oidc[0].issuer
}