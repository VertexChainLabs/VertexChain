# =============================================================================
# Compute submodule outputs
# =============================================================================

# --------------- ALB ---------------

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB"
  value       = aws_lb.main.zone_id
}

output "target_group_arn" {
  description = "ARN of the ALB target group"
  value       = aws_lb_target_group.app.arn
}

output "listener_https_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "listener_http_arn" {
  description = "ARN of the HTTP redirect listener"
  value       = aws_lb_listener.http_redirect.arn
}

# --------------- ASG ---------------

output "asg_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.name
}

output "asg_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.arn
}

output "launch_template_id" {
  description = "ID of the EC2 launch template"
  value       = aws_launch_template.app.id
}

output "launch_template_arn" {
  description = "ARN of the EC2 launch template"
  value       = aws_launch_template.app.arn
}

output "iam_instance_profile_arn" {
  description = "ARN of the IAM instance profile"
  value       = aws_iam_instance_profile.app.arn
}

output "scaling_policy_arn" {
  description = "ARN of the CPU target tracking scaling policy"
  value       = aws_autoscaling_policy.cpu_target.arn
}

# --------------- EKS ---------------

output "eks_cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = aws_eks_cluster.main.arn
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = aws_iam_role.eks_nodes.arn
}

output "eks_node_group_arn" {
  description = "ARN of the EKS managed node group"
  value       = aws_eks_node_group.app.arn
}
