# =============================================================================
# Root module – VertexChain Terraform configuration
#
# Orchestrates the network, compute, and data submodules, then creates
# cross-cutting resources such as IAM roles/policies, CloudFront, WAF,
# Route53, ACM, CloudWatch, SNS, and Secrets Manager.
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    CostCenter  = var.cost_center
    Owner       = var.owner
    ManagedBy   = "terraform"
  }
}

# =============================================================================
# Network submodule
# =============================================================================
module "network" {
  source = "./modules/network"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr

  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  tags = local.common_tags
}

# =============================================================================
# Data submodule (RDS, ElastiCache, S3, backups)
# =============================================================================
module "data" {
  source = "./modules/data"

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }

  name_prefix        = local.name_prefix
  region             = var.region
  private_subnet_ids = module.network.private_subnet_ids

  security_group_db_id    = module.network.security_group_db_id
  security_group_redis_id = module.network.security_group_redis_id

  backup_iam_role_arn        = aws_iam_role.backup.arn
  enable_cross_region_backup = var.enable_cross_region_backup

  # RDS
  db_instance_class = var.db_instance_class
  db_password       = var.db_password

  # Redis
  redis_node_type       = var.redis_node_type
  redis_num_cache_nodes = var.redis_num_cache_nodes

  # Backup
  backup_retention_days = var.backup_retention_days

  tags = local.common_tags
}

# =============================================================================
# Compute submodule (EKS, ASG, ALB)
# =============================================================================
module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  security_group_alb_id = module.network.security_group_alb_id
  security_group_app_id = module.network.security_group_app_id

  certificate_arn   = aws_acm_certificate.frontend.arn
  ami_id            = var.ami_id
  instance_type     = var.instance_type
  ec2_iam_role_name = aws_iam_role.ec2.name

  # ASG
  asg_min_size     = var.asg_min_size
  asg_max_size     = var.asg_max_size
  asg_desired_size = var.asg_desired_size

  # EKS
  eks_version            = var.eks_version
  eks_node_instance_type = var.eks_node_instance_type
  eks_desired_size       = var.eks_desired_size
  eks_min_size           = var.eks_min_size
  eks_max_size           = var.eks_max_size

  tags = local.common_tags
}

# =============================================================================
# IAM Roles & Policies
# =============================================================================

# EC2 role (used by ASG launch template)
resource "aws_iam_role" "ec2" {
  name = "${local.name_prefix}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "ec2_ssm" {
  name        = "${local.name_prefix}-ec2-ssm"
  description = "Allow EC2 instances to use SSM Session Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:UpdateInstanceInformation",
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_ssm.arn
}

# Lambda role
resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "lambda_basic" {
  name        = "${local.name_prefix}-lambda-basic"
  description = "Least privilege policy for Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.region}:*:log-group:/aws/lambda/${local.name_prefix}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_basic.arn
}

# Backup role
resource "aws_iam_role" "backup" {
  name = "${local.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore_policy" {
  count      = var.enable_cross_region_backup ? 1 : 0
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# =============================================================================
# Route53 – DNS zone
# =============================================================================
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = local.common_tags
}

resource "aws_route53_record" "root_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = ["0.0.0.0"] # FIXME: replace with actual ALB IP or use alias
}

resource "aws_route53_record" "api_cname" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["alb.${var.domain_name}"]
}

resource "aws_route53_health_check" "api" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = local.common_tags
}

# =============================================================================
# ACM – SSL/TLS certificates
# =============================================================================
resource "aws_acm_certificate" "frontend" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }

  tags = local.common_tags
}

resource "aws_acm_certificate_validation" "frontend" {
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for r in aws_acm_certificate.frontend.domain_validation_options : r.resource_record_name]
}

# =============================================================================
# CloudFront – CDN for frontend assets
# =============================================================================
resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "OAI for ${local.name_prefix} frontend"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  origin {
    domain_name = module.data.s3_frontend_bucket_regional_domain_name
    origin_id   = "S3-frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.frontend.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  tags = local.common_tags
}

# =============================================================================
# WAF – Web Application Firewall
# =============================================================================
resource "aws_wafv2_web_acl" "app" {
  name  = "${local.name_prefix}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

# =============================================================================
# WAF Association with ALB
# =============================================================================
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = module.compute.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.app.arn
}

# =============================================================================
# CloudWatch – Logging & Monitoring
# =============================================================================
resource "aws_cloudwatch_log_group" "app" {
  name              = "/vertexchain/app"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title   = "CPU Utilization"
          metrics = [["AWS/ECS", "CPUUtilization", "ServiceName", var.project_name]]
          period  = 300
          stat    = "Average"
        }
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms
# =============================================================================
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "${var.project_name}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "errors_high" {
  alarm_name          = "${var.project_name}-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# =============================================================================
# SNS – Notifications
# =============================================================================
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# =============================================================================
# Secrets Manager
# =============================================================================
resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}-secret"
  description             = "Application secrets for ${var.environment}"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    placeholder = "replace-with-real-secret"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
