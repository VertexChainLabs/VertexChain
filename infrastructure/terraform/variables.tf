# ─────────────────────────────────────────────────────────────────────────────
# variables.tf — single source of truth for all input variables.
#
# Per-environment values live in infrastructure/terraform/envs/:
#   terraform.tfvars.dev | terraform.tfvars.staging | terraform.tfvars.prod
#
# Supply the right file at plan / apply time:
#   terraform plan -var-file="envs/terraform.tfvars.dev"
# ─────────────────────────────────────────────────────────────────────────────

# ── Core ─────────────────────────────────────────────────────────────────────

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
  description = "Deployment environment (dev | staging | prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name — used as a prefix for all resource names"
  type        = string
  default     = "vertexchain"
}

# Kept for modules that still reference app_name; aliases project_name.
variable "app_name" {
  description = "Application name (alias for project_name)"
  type        = string
  default     = "vertexchain"
}

# ── Networking ────────────────────────────────────────────────────────────────

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

# ── Compute ───────────────────────────────────────────────────────────────────

variable "ami_id" {
  description = "AMI ID for EC2 instances"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_password" {
  description = "RDS master password (supply via TF_VAR_db_password or -var)"
  type        = string
  sensitive   = true
}

variable "backup_retention_days" {
  description = "Number of days to retain both primary and DR backups"
  type        = number
  default     = 30
}

# ── ElastiCache / Redis ───────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes (≥ 2 enables automatic failover)"
  type        = number
  default     = 1
}

# ── DNS / TLS ─────────────────────────────────────────────────────────────────

variable "domain_name" {
  description = "Primary domain name (used by CloudFront)"
  type        = string
  default     = "vertexchain.io"
}

variable "api_domain" {
  description = "API sub-domain (CloudFront ALB origin)"
  type        = string
  default     = "api.vertexchain.io"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS listeners"
  type        = string
}

# ── Tagging ───────────────────────────────────────────────────────────────────

variable "cost_center" {
  description = "Cost center code for billing allocation"
  type        = string
  default     = "engineering"
}

variable "owner" {
  description = "Team or individual responsible for resources"
  type        = string
  default     = "platform-team"
}
