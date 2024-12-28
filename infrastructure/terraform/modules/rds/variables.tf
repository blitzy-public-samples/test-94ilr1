# terraform ~> 1.0

# Basic Instance Configuration
variable "identifier" {
  description = "Unique identifier for the RDS instance"
  type        = string
  validation {
    condition     = length(var.identifier) <= 63
    error_message = "RDS identifier must be 63 characters or less"
  }
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "14.7"
  validation {
    condition     = can(regex("^14\\.[0-9]+$", var.engine_version))
    error_message = "Engine version must be PostgreSQL 14.x"
  }
}

variable "instance_class" {
  description = "The instance type of the RDS instance"
  type        = string
  default     = "db.r6g.2xlarge"
  validation {
    condition     = can(regex("^db\\.(r6g|r6i|r5)\\..*", var.instance_class))
    error_message = "Instance class must be memory-optimized r6g, r6i, or r5 series"
  }
}

# Storage Configuration
variable "allocated_storage" {
  description = "The allocated storage in gigabytes"
  type        = number
  default     = 500
  validation {
    condition     = var.allocated_storage >= 100
    error_message = "Allocated storage must be at least 100GB"
  }
}

variable "max_allocated_storage" {
  description = "The upper limit for storage autoscaling in gigabytes"
  type        = number
  default     = 2000
  validation {
    condition     = var.max_allocated_storage >= var.allocated_storage
    error_message = "Max allocated storage must be greater than or equal to allocated storage"
  }
}

# Database Configuration
variable "database_name" {
  description = "The name of the database to create when the DB instance is created"
  type        = string
  default     = "email_platform_db"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "username" {
  description = "Username for the master DB user"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.username))
    error_message = "Username must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "password" {
  description = "Password for the master DB user"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.password) >= 16
    error_message = "Password must be at least 16 characters long"
  }
}

variable "port" {
  description = "The port on which the DB accepts connections"
  type        = number
  default     = 5432
  validation {
    condition     = var.port >= 1024 && var.port <= 65535
    error_message = "Port must be between 1024 and 65535"
  }
}

# Network Configuration
variable "vpc_id" {
  description = "VPC ID where the DB instance will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of VPC subnet IDs for DB subnet group"
  type        = list(string)
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability"
  }
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to connect to the database"
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All elements must be valid CIDR blocks"
  }
}

# High Availability Configuration
variable "multi_az" {
  description = "Specifies if the RDS instance is multi-AZ"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_retention_period" {
  description = "The days to retain backups for"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_period >= 30
    error_message = "Backup retention period must be at least 30 days"
  }
}

variable "backup_window" {
  description = "The daily time range during which automated backups are created"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "The window to perform maintenance in"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

# Security Configuration
variable "storage_encrypted" {
  description = "Specifies whether the DB instance is encrypted"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "The ARN for the KMS encryption key for storage encryption"
  type        = string
  default     = null
}

variable "deletion_protection" {
  description = "If the DB instance should have deletion protection enabled"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "performance_insights_enabled" {
  description = "Specifies whether Performance Insights are enabled"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Amount of time in days to retain Performance Insights data"
  type        = number
  default     = 731
  validation {
    condition     = contains([7, 731, 2192], var.performance_insights_retention_period)
    error_message = "Performance insights retention period must be 7, 731, or 2192 days"
  }
}

variable "monitoring_interval" {
  description = "The interval, in seconds, between points when Enhanced Monitoring metrics are collected"
  type        = number
  default     = 60
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 0, 1, 5, 10, 15, 30, or 60 seconds"
  }
}

# Parameter Group Configuration
variable "parameter_group_family" {
  description = "The family of the DB parameter group"
  type        = string
  default     = "postgres14"
  validation {
    condition     = can(regex("^postgres14", var.parameter_group_family))
    error_message = "Parameter group family must be for PostgreSQL 14"
  }
}

# Tagging
variable "tags" {
  description = "A mapping of tags to assign to all resources"
  type        = map(string)
  default     = {}
}