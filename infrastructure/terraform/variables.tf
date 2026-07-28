# =============================================================
# Root module variable definitions
# All variable declarations are consolidated here. Duplicate
# declarations in individual .tf files have been removed.
# =============================================================

# --------------- General ---------------

variable "environment" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
}

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

variable "project_name" {
  description = "Project name used in resource naming and cost-allocation tags"
  type        = string
  default     = "vertexchain"
}

variable "domain_name" {
  description = "Custom domain name for Route53 / ACM / CloudFront"
  type        = string
  default     = "vertexchain.io"
}

variable "alert_email" {
  description = "Email address for SNS alert notifications"
  type        = string
  default     = "ops@vertexchain.io"
}

# --------------- Networking ---------------

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to deploy into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# --------------- Tags ---------------

variable "cost_center" {
  description = "Cost-centre code for billing allocation"
  type        = string
  default     = "engineering"
}

variable "owner" {
  description = "Team or individual responsible for these resources"
  type        = string
  default     = "platform-team"
}

# --------------- Compute ---------------

variable "ami_id" {
  description = "AMI ID for EC2 instances (ASG launch template)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for ASG launch template"
  type        = string
  default     = "t3.medium"
}

variable "eks_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.small"
}

variable "eks_desired_size" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 1
}

variable "eks_min_size" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 1
}

variable "eks_max_size" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 3
}

# --------------- Auto Scaling Group ---------------

variable "asg_min_size" {
  description = "Minimum ASG capacity"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum ASG capacity"
  type        = number
  default     = 3
}

variable "asg_desired_size" {
  description = "Desired ASG capacity"
  type        = number
  default     = 1
}

# --------------- RDS ---------------

variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t3.micro for dev, db.t3.medium for prod)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_password" {
  description = "RDS master password — supply via AWS Secrets Manager or CI secret"
  type        = string
  sensitive   = true
}

# --------------- ElastiCache / Redis ---------------

variable "redis_node_type" {
  description = "ElastiCache node type (e.g. cache.t3.micro)"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes (>=2 enables automatic failover)"
  type        = number
  default     = 1
}

# --------------- Backup & DR ---------------

variable "backup_retention_days" {
  description = "Number of days to retain both primary and DR backups"
  type        = number
  default     = 30
}
