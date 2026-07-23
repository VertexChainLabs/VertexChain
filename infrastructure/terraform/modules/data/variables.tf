# =============================================================================
# Data submodule input variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix applied to all resource names (e.g. vertexchain-dev)"
  type        = string
}

variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_db_id" {
  description = "RDS security group ID"
  type        = string
}

variable "security_group_redis_id" {
  description = "Redis security group ID"
  type        = string
}

variable "backup_iam_role_arn" {
  description = "ARN of the IAM role for AWS Backup"
  type        = string
}

variable "enable_cross_region_backup" {
  description = "Whether to replicate backups to the DR region"
  type        = bool
  default     = true
}

# --------------- RDS ---------------

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage size in GB for RDS"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "vertexchain"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "vertexchain"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_backup_retention_days" {
  description = "Backup retention days for RDS"
  type        = number
  default     = 7
}

# --------------- ElastiCache / Redis ---------------

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

# --------------- Backup ---------------

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# --------------- Tags ---------------

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
