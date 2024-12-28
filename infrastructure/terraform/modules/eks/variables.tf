# Cluster name configuration
variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
  validation {
    condition     = length(var.cluster_name) <= 100 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be less than 100 characters and start with a letter, containing only alphanumeric characters and hyphens"
  }
}

# Kubernetes version configuration
variable "eks_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster"
  default     = "1.28"
  validation {
    condition     = can(regex("^1\\.(2[7-8])$", var.eks_version))
    error_message = "EKS version must be 1.27 or 1.28"
  }
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where EKS cluster will be created"
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid and start with 'vpc-'"
  }
}

# Subnet configuration
variable "subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for EKS cluster and node groups"
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs are required for high availability"
  }
}

# Node group configuration
variable "node_groups" {
  type = map(object({
    desired_size    = number
    min_size       = number
    max_size       = number
    instance_types = list(string)
    capacity_type  = string
    labels         = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Map of node group configurations with detailed settings"
  default = {
    general = {
      desired_size    = 3
      min_size       = 2
      max_size       = 5
      instance_types = ["t3.xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        workload = "general"
      }
      taints = []
    }
    memory_optimized = {
      desired_size    = 2
      min_size       = 1
      max_size       = 4
      instance_types = ["r6i.2xlarge"]
      capacity_type  = "ON_DEMAND"
      labels = {
        workload = "memory-optimized"
      }
      taints = []
    }
  }
  validation {
    condition     = alltrue([for k, v in var.node_groups : v.min_size <= v.desired_size && v.desired_size <= v.max_size])
    error_message = "For each node group, min_size must be <= desired_size <= max_size"
  }
  validation {
    condition     = alltrue([for k, v in var.node_groups : contains(["ON_DEMAND", "SPOT"], v.capacity_type)])
    error_message = "Capacity type must be either ON_DEMAND or SPOT"
  }
}

# API server endpoint access configuration
variable "enable_private_access" {
  type        = bool
  description = "Enable private API server endpoint access"
  default     = true
}

variable "enable_public_access" {
  type        = bool
  description = "Enable public API server endpoint access"
  default     = false
}

variable "public_access_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access the public API server endpoint"
  default     = []
  validation {
    condition     = alltrue([for cidr in var.public_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be valid"
  }
}

# Cluster logging configuration
variable "cluster_log_types" {
  type        = list(string)
  description = "List of control plane logging types to enable"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  validation {
    condition     = alltrue([for log_type in var.cluster_log_types : contains(["api", "audit", "authenticator", "controllerManager", "scheduler"], log_type)])
    error_message = "Invalid log type specified"
  }
}

# Encryption configuration
variable "encryption_config" {
  type = object({
    enabled     = bool
    kms_key_arn = string
  })
  description = "Cluster encryption configuration"
  default = {
    enabled     = true
    kms_key_arn = ""
  }
  validation {
    condition     = !var.encryption_config.enabled || (var.encryption_config.enabled && length(var.encryption_config.kms_key_arn) > 0)
    error_message = "KMS key ARN must be provided when encryption is enabled"
  }
}

# Additional resource tagging
variable "tags" {
  type        = map(string)
  description = "Additional tags for EKS resources"
  default     = {}
  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum of 50 tags can be specified"
  }
}

# IAM configuration
variable "service_ipv4_cidr" {
  type        = string
  description = "The CIDR block to assign Kubernetes service IP addresses from"
  default     = "172.20.0.0/16"
  validation {
    condition     = can(cidrhost(var.service_ipv4_cidr, 0))
    error_message = "Service IPv4 CIDR must be a valid CIDR block"
  }
}

# Add-ons configuration
variable "cluster_addons" {
  type = map(object({
    version               = string
    resolve_conflicts    = string
    service_account_role = string
  }))
  description = "Map of cluster addon configurations to enable"
  default = {
    vpc-cni = {
      version               = "v1.12.6-eksbuild.1"
      resolve_conflicts    = "OVERWRITE"
      service_account_role = ""
    }
    coredns = {
      version               = "v1.9.3-eksbuild.3"
      resolve_conflicts    = "OVERWRITE"
      service_account_role = ""
    }
    kube-proxy = {
      version               = "v1.28.1-eksbuild.1"
      resolve_conflicts    = "OVERWRITE"
      service_account_role = ""
    }
  }
}