# Project Information
output "project_name" {
  description = "Name of the email management platform project"
  value       = local.project_name
}

output "environment" {
  description = "Current deployment environment (dev, staging, prod)"
  value       = var.environment
}

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC where resources are deployed"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for internal resources"
  value       = module.vpc.private_subnets
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for external-facing resources"
  value       = module.vpc.public_subnets
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
  sensitive   = false
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
  sensitive   = false
}

output "eks_cluster_autoscaler_role_arn" {
  description = "IAM role ARN for cluster autoscaler"
  value       = module.eks.cluster_autoscaler_role_arn
  sensitive   = false
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# RDS Database Outputs
output "rds_primary_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_replica_endpoint" {
  description = "Connection endpoint for the RDS replica instance"
  value       = module.rds.replica_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "Port number for database connections"
  value       = module.rds.port
  sensitive   = false
}

output "rds_security_group_id" {
  description = "Security group ID for RDS database access"
  value       = module.rds.security_group_id
  sensitive   = false
}

# Network Configuration Outputs
output "vpc_cidr" {
  description = "CIDR block for the VPC"
  value       = module.vpc.vpc_cidr_block
  sensitive   = false
}

output "availability_zones" {
  description = "List of availability zones used in the deployment"
  value       = module.vpc.azs
  sensitive   = false
}

# Security Outputs
output "vpc_flow_logs_group" {
  description = "CloudWatch log group name for VPC flow logs"
  value       = "/aws/vpc/${var.environment}-flow-logs"
  sensitive   = false
}

output "monitoring_security_group_id" {
  description = "Security group ID for monitoring and observability tools"
  value       = aws_security_group.monitoring.id
  sensitive   = false
}

# Service Discovery Outputs
output "service_discovery_namespace" {
  description = "AWS Cloud Map namespace for service discovery"
  value       = aws_service_discovery_private_dns_namespace.main.name
  sensitive   = false
}

# Load Balancer Outputs
output "internal_lb_dns" {
  description = "DNS name of the internal application load balancer"
  value       = module.internal_alb.dns_name
  sensitive   = false
}

output "external_lb_dns" {
  description = "DNS name of the external application load balancer"
  value       = module.external_alb.dns_name
  sensitive   = false
}

# Monitoring and Logging Outputs
output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.application.arn
  sensitive   = false
}

output "prometheus_endpoint" {
  description = "Endpoint for the managed Prometheus service"
  value       = module.amp.prometheus_endpoint
  sensitive   = true
}

# Tags Output
output "resource_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
  sensitive   = false
}