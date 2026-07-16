# Standard tag schema for cost tracking and resource management
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "terraform"
  }
}

output "common_tags" {
  description = "Standard tags applied to all resources"
  value       = local.common_tags
}
