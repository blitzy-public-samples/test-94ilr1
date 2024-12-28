# Connection Information
output "endpoint" {
  description = "RDS instance endpoint URL for application connectivity"
  value       = aws_db_instance.db_instance.endpoint
  sensitive   = true
}

output "address" {
  description = "RDS instance hostname for DNS resolution"
  value       = aws_db_instance.db_instance.address
  sensitive   = true
}

output "port" {
  description = "RDS instance port for connection configuration"
  value       = aws_db_instance.db_instance.port
  sensitive   = false
}

# Network Configuration
output "db_subnet_group_name" {
  description = "Name of the RDS subnet group for network configuration"
  value       = aws_db_subnet_group.db_subnet_group.name
  sensitive   = false
}

output "security_group_id" {
  description = "ID of the RDS security group for access control"
  value       = aws_security_group.db_security_group.id
  sensitive   = false
}

# Database Configuration
output "parameter_group_name" {
  description = "Name of the RDS parameter group for PostgreSQL settings"
  value       = aws_db_parameter_group.db_parameter_group.name
  sensitive   = false
}

# Instance Information
output "instance_id" {
  description = "Identifier of the RDS instance"
  value       = aws_db_instance.db_instance.id
  sensitive   = false
}

output "arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.db_instance.arn
  sensitive   = false
}

# High Availability Information
output "availability_zone" {
  description = "Availability zone of the RDS instance"
  value       = aws_db_instance.db_instance.availability_zone
  sensitive   = false
}

output "multi_az" {
  description = "Whether the RDS instance is multi-AZ"
  value       = aws_db_instance.db_instance.multi_az
  sensitive   = false
}

# Monitoring Information
output "monitoring_role_arn" {
  description = "ARN of the IAM role used for enhanced monitoring"
  value       = aws_iam_role.rds_monitoring_role.arn
  sensitive   = false
}

output "performance_insights_enabled" {
  description = "Whether Performance Insights is enabled"
  value       = aws_db_instance.db_instance.performance_insights_enabled
  sensitive   = false
}

# Storage Information
output "allocated_storage" {
  description = "Storage allocated to the RDS instance in GiB"
  value       = aws_db_instance.db_instance.allocated_storage
  sensitive   = false
}

output "storage_type" {
  description = "Storage type used by the RDS instance"
  value       = aws_db_instance.db_instance.storage_type
  sensitive   = false
}

# Backup Configuration
output "backup_retention_period" {
  description = "Number of days automated backups are retained"
  value       = aws_db_instance.db_instance.backup_retention_period
  sensitive   = false
}

output "backup_window" {
  description = "Daily time range during which automated backups are created"
  value       = aws_db_instance.db_instance.backup_window
  sensitive   = false
}

# Engine Information
output "engine_version" {
  description = "Version number of the database engine"
  value       = aws_db_instance.db_instance.engine_version
  sensitive   = false
}

# Status Information
output "status" {
  description = "Current status of the RDS instance"
  value       = aws_db_instance.db_instance.status
  sensitive   = false
}