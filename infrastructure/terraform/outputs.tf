# =============================================================================
# Root module outputs – surfaces ARNs and attributes of every created resource
# =============================================================================

# --------------- Network ---------------

output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.network.vpc_id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = module.network.vpc_cidr
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.network.private_subnet_ids
}

output "public_subnet_arns" {
  description = "List of public subnet ARNs"
  value       = module.network.public_subnet_arns
}

output "private_subnet_arns" {
  description = "List of private subnet ARNs"
  value       = module.network.private_subnet_arns
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway"
  value       = module.network.internet_gateway_id
}

output "nat_gateway_id" {
  description = "The ID of the NAT Gateway"
  value       = module.network.nat_gateway_id
}

output "nat_eip_id" {
  description = "The ID of the NAT Elastic IP"
  value       = module.network.nat_eip_id
}

output "nat_eip_public_ip" {
  description = "The public IP of the NAT Gateway"
  value       = module.network.nat_eip_public_ip
}

output "security_group_alb_id" {
  description = "The ID of the ALB security group"
  value       = module.network.security_group_alb_id
}

output "security_group_alb_arn" {
  description = "The ARN of the ALB security group"
  value       = module.network.security_group_alb_arn
}

output "security_group_app_id" {
  description = "The ID of the App security group"
  value       = module.network.security_group_app_id
}

output "security_group_app_arn" {
  description = "The ARN of the App security group"
  value       = module.network.security_group_app_arn
}

output "security_group_db_id" {
  description = "The ID of the DB security group"
  value       = module.network.security_group_db_id
}

output "security_group_db_arn" {
  description = "The ARN of the DB security group"
  value       = module.network.security_group_db_arn
}

output "security_group_redis_id" {
  description = "The ID of the Redis security group"
  value       = module.network.security_group_redis_id
}

output "security_group_redis_arn" {
  description = "The ARN of the Redis security group"
  value       = module.network.security_group_redis_arn
}

output "public_route_table_id" {
  description = "The ID of the public route table"
  value       = module.network.public_route_table_id
}

output "private_route_table_id" {
  description = "The ID of the private route table"
  value       = module.network.private_route_table_id
}

# --------------- Compute ---------------

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.compute.alb_arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = module.compute.alb_dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB"
  value       = module.compute.alb_zone_id
}

output "target_group_arn" {
  description = "ARN of the ALB target group"
  value       = module.compute.target_group_arn
}

output "listener_https_arn" {
  description = "ARN of the HTTPS listener"
  value       = module.compute.listener_https_arn
}

output "asg_name" {
  description = "Name of the Auto Scaling Group"
  value       = module.compute.asg_name
}

output "asg_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = module.compute.asg_arn
}

output "launch_template_id" {
  description = "ID of the EC2 launch template"
  value       = module.compute.launch_template_id
}

output "launch_template_arn" {
  description = "ARN of the EC2 launch template"
  value       = module.compute.launch_template_arn
}

output "iam_instance_profile_arn" {
  description = "ARN of the IAM instance profile"
  value       = module.compute.iam_instance_profile_arn
}

output "scaling_policy_arn" {
  description = "ARN of the CPU scaling policy"
  value       = module.compute.scaling_policy_arn
}

output "eks_cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = module.compute.eks_cluster_arn
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.compute.eks_cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = module.compute.eks_cluster_endpoint
}

output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = module.compute.eks_cluster_role_arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = module.compute.eks_node_role_arn
}

output "eks_node_group_arn" {
  description = "ARN of the EKS node group"
  value       = module.compute.eks_node_group_arn
}

# --------------- Data ---------------

output "rds_instance_arn" {
  description = "ARN of the RDS PostgreSQL instance"
  value       = module.data.rds_instance_arn
}

output "rds_instance_id" {
  description = "ID of the RDS instance"
  value       = module.data.rds_instance_id
}

output "rds_instance_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = module.data.rds_instance_endpoint
}

output "rds_instance_address" {
  description = "Address of the RDS instance"
  value       = module.data.rds_instance_address
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = module.data.rds_port
}

output "rds_parameter_group_arn" {
  description = "ARN of the RDS parameter group"
  value       = module.data.rds_parameter_group_arn
}

output "redis_replication_group_arn" {
  description = "ARN of the Redis replication group"
  value       = module.data.redis_replication_group_arn
}

output "redis_primary_endpoint" {
  description = "Primary endpoint of the Redis cluster"
  value       = module.data.redis_primary_endpoint
}

output "redis_reader_endpoint" {
  description = "Reader endpoint of the Redis cluster"
  value       = module.data.redis_reader_endpoint
}

output "redis_parameter_group_arn" {
  description = "ARN of the Redis parameter group"
  value       = module.data.redis_parameter_group_arn
}

output "s3_uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = module.data.s3_uploads_bucket_arn
}

output "s3_backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = module.data.s3_backups_bucket_arn
}

output "s3_logs_bucket_arn" {
  description = "ARN of the logs S3 bucket"
  value       = module.data.s3_logs_bucket_arn
}

output "s3_frontend_bucket_arn" {
  description = "ARN of the frontend S3 bucket"
  value       = module.data.s3_frontend_bucket_arn
}

output "s3_frontend_bucket_id" {
  description = "ID of the frontend S3 bucket"
  value       = module.data.s3_frontend_bucket_id
}

output "backup_vault_arn" {
  description = "ARN of the primary backup vault"
  value       = module.data.backup_vault_arn
}

output "backup_kms_key_arn" {
  description = "ARN of the backup KMS key"
  value       = module.data.backup_kms_key_arn
}

output "backup_dr_vault_arn" {
  description = "ARN of the DR backup vault"
  value       = module.data.backup_dr_vault_arn
}

output "backup_daily_plan_arn" {
  description = "ARN of the daily backup plan"
  value       = module.data.backup_daily_plan_arn
}

output "backup_weekly_plan_arn" {
  description = "ARN of the weekly backup plan"
  value       = module.data.backup_weekly_plan_arn
}

# --------------- IAM ---------------

output "iam_ec2_role_arn" {
  description = "ARN of the EC2 IAM role"
  value       = aws_iam_role.ec2.arn
}

output "iam_lambda_role_arn" {
  description = "ARN of the Lambda IAM role"
  value       = aws_iam_role.lambda.arn
}

output "iam_backup_role_arn" {
  description = "ARN of the Backup IAM role"
  value       = aws_iam_role.backup.arn
}

output "iam_ec2_ssm_policy_arn" {
  description = "ARN of the EC2 SSM policy"
  value       = aws_iam_policy.ec2_ssm.arn
}

output "iam_lambda_basic_policy_arn" {
  description = "ARN of the Lambda basic policy"
  value       = aws_iam_policy.lambda_basic.arn
}

# --------------- Route53 ---------------

output "route53_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_zone_arn" {
  description = "ARN of the Route53 hosted zone"
  value       = aws_route53_zone.main.arn
}

output "route53_health_check_id" {
  description = "ID of the Route53 health check"
  value       = aws_route53_health_check.api.id
}

# --------------- ACM ---------------

output "acm_certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  value       = aws_acm_certificate.frontend.arn
}

# --------------- CloudFront ---------------

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "cloudfront_distribution_domain" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_oai_id" {
  description = "ID of the CloudFront origin access identity"
  value       = aws_cloudfront_origin_access_identity.frontend.id
}

# --------------- WAF ---------------

output "waf_web_acl_arn" {
  description = "ARN of the WAF web ACL"
  value       = aws_wafv2_web_acl.app.arn
}

output "waf_web_acl_id" {
  description = "ID of the WAF web ACL"
  value       = aws_wafv2_web_acl.app.id
}

# --------------- CloudWatch ---------------

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.arn
}

output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "alarm_cpu_high_arn" {
  description = "ARN of the CPU high alarm"
  value       = aws_cloudwatch_metric_alarm.cpu_high.arn
}

output "alarm_memory_high_arn" {
  description = "ARN of the memory high alarm"
  value       = aws_cloudwatch_metric_alarm.memory_high.arn
}

output "alarm_errors_high_arn" {
  description = "ARN of the errors high alarm"
  value       = aws_cloudwatch_metric_alarm.errors_high.arn
}

# --------------- SNS ---------------

output "sns_topic_arn" {
  description = "ARN of the SNS alert topic"
  value       = aws_sns_topic.alerts.arn
}

# --------------- Secrets Manager ---------------

output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app.arn
}

output "secrets_manager_secret_id" {
  description = "ID of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app.id
}

# --------------- Workspace ---------------

output "workspace_name" {
  description = "Current Terraform workspace"
  value       = terraform.workspace
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "common_tags" {
  description = "Standard tags applied to all resources"
  value       = local.common_tags
}
