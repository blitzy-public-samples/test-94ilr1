# Cluster identification outputs
output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.eks_cluster.name
}

output "cluster_version" {
  description = "Kubernetes version of the cluster"
  value       = aws_eks_cluster.eks_cluster.version
}

# Cluster access outputs
output "cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.eks_cluster.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data for cluster authentication"
  value       = aws_eks_cluster.eks_cluster.certificate_authority[0].data
  sensitive   = true
}

# Security outputs
output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_eks_cluster.eks_cluster.vpc_config[0].cluster_security_group_id
}

output "cluster_oidc_issuer_url" {
  description = "The URL of the OpenID Connect identity provider for IAM role federation"
  value       = aws_eks_cluster.eks_cluster.identity[0].oidc[0].issuer
}

# Node group outputs
output "node_groups" {
  description = "Map of node groups created with their configurations"
  value = {
    for k, v in aws_eks_node_group.node_groups : k => {
      node_group_name = v.node_group_name
      status         = v.status
      capacity_type  = v.capacity_type
      instance_types = v.instance_types
      scaling_config = v.scaling_config
      labels        = v.labels
      taints        = v.taints
    }
  }
}

# Networking outputs
output "cluster_vpc_config" {
  description = "VPC configuration details for the EKS cluster"
  value = {
    vpc_id             = aws_eks_cluster.eks_cluster.vpc_config[0].vpc_id
    subnet_ids         = aws_eks_cluster.eks_cluster.vpc_config[0].subnet_ids
    security_group_ids = aws_eks_cluster.eks_cluster.vpc_config[0].security_group_ids
  }
}

# Add-ons outputs
output "cluster_addons" {
  description = "Map of installed EKS add-ons and their status"
  value = {
    for k, v in var.cluster_addons : k => {
      version            = v.version
      resolve_conflicts = v.resolve_conflicts
    }
  }
}

# IAM outputs
output "cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_eks_cluster.eks_cluster.role_arn
}

output "node_group_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = aws_iam_role.node_group.arn
}

# Logging outputs
output "cluster_log_types" {
  description = "List of enabled control plane logging types"
  value       = aws_eks_cluster.eks_cluster.enabled_cluster_log_types
}

# Service mesh outputs
output "istio_config" {
  description = "Istio service mesh configuration details"
  value = {
    version           = module.istio.version
    monitoring_enabled = module.istio.monitoring_enabled
    tracing_enabled   = module.istio.tracing_enabled
    mesh_config       = module.istio.mesh_config
  }
}