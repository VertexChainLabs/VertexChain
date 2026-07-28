# =============================================================================
# Compute submodule input variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix applied to all resource names (e.g. vertexchain-dev)"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_alb_id" {
  description = "ALB security group ID"
  type        = string
}

variable "security_group_app_id" {
  description = "App security group ID"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for EC2 launch template"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for ASG launch template"
  type        = string
  default     = "t3.medium"
}

variable "ec2_iam_role_name" {
  description = "Name of the IAM role for EC2 instances"
  type        = string
}

# --------------- ASG ---------------

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

# --------------- EKS ---------------

variable "eks_version" {
  description = "Kubernetes version for EKS cluster"
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

# --------------- Tags ---------------

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}
