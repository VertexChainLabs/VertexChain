variable "region" {
  description = "Primary AWS region where most resources are deployed"
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "Disaster-recovery AWS region used to mirror backups for cross-region resilience"
  type        = string
  default     = "us-west-2"
}

variable "enable_cross_region_backup" {
  description = "Whether to replicate AWS Backup recovery points to the DR region. Set false in dev/test to avoid DR-region costs."
  type        = bool
  default     = true
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "vertexchain"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "backup_retention_days" {
  description = "Number of days to retain both primary and DR backups"
  type        = number
  default     = 30
}
