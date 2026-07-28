# =============================================================================
# Data submodule – RDS, ElastiCache, S3, backups
# =============================================================================

# ---------------------------------------------------------------------------
# RDS PostgreSQL
# ---------------------------------------------------------------------------
resource "aws_db_parameter_group" "postgres" {
  name   = "${var.name_prefix}-postgres-params"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-params"
  })
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.name_prefix}-postgres"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [var.security_group_db_id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  backup_retention_period   = var.db_backup_retention_days
  monitoring_interval       = 60
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-final"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}

# ---------------------------------------------------------------------------
# ElastiCache Redis
# ---------------------------------------------------------------------------
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.name_prefix}-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-params"
  })
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-subnet-group"
  })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis cluster for ${var.name_prefix}"

  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_nodes
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [var.security_group_redis_id]
  port                       = 6379
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.redis_num_cache_nodes > 1 ? true : false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

# ---------------------------------------------------------------------------
# S3 Buckets
# ---------------------------------------------------------------------------

# Uploads bucket
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.name_prefix}-uploads"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-uploads" })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# Backups bucket
resource "aws_s3_bucket" "backups" {
  bucket = "${var.name_prefix}-backups"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-backups" })
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Logs bucket
resource "aws_s3_bucket" "logs" {
  bucket = "${var.name_prefix}-logs"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-logs" })
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"

    expiration {
      days = 90
    }
  }
}

# Frontend bucket (for CloudFront / S3 static hosting)
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.name_prefix}-frontend"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-frontend" })
}

# ---------------------------------------------------------------------------
# Backup – KMS keys, vaults, plans
# ---------------------------------------------------------------------------
data "aws_caller_identity" "current" {}

resource "aws_kms_key" "backup" {
  description             = "${var.name_prefix} backup encryption key (primary)"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccountFullAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowAWSBackupServiceUseKey"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey",
          "kms:ReEncrypt*", "kms:DescribeKey", "kms:CreateGrant", "kms:ListGrants",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceRegion" = var.region
          }
        }
      },
    ]
  })

  tags = var.tags
}

resource "aws_backup_vault" "main" {
  name        = "${var.name_prefix}-vault"
  kms_key_arn = aws_kms_key.backup.arn

  tags = merge(var.tags, { Name = "${var.name_prefix}-vault" })
}

resource "aws_kms_key" "dr_backup" {
  count = var.enable_cross_region_backup ? 1 : 0

  providers = { aws = aws.dr }

  description             = "${var.name_prefix} backup encryption key (DR)"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccountFullAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowAWSBackupCrossRegionCopy"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey",
          "kms:ReEncrypt*", "kms:DescribeKey", "kms:CreateGrant", "kms:ListGrants",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceRegion" = var.region
          }
        }
      },
    ]
  })

  tags = var.tags
}

resource "aws_backup_vault" "dr" {
  count = var.enable_cross_region_backup ? 1 : 0

  providers = { aws = aws.dr }

  name        = "${var.name_prefix}-dr-vault"
  kms_key_arn = aws_kms_key.dr_backup[0].arn

  access_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAWSBackupCrossRegionWrites"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "backup:CopyFromBackupVault", "backup:DescribeBackupVault",
          "backup:ListBackupVaultJobs", "backup:ListRecoveryPointsByBackupVault",
          "backup:PutBackupVaultAccessPolicy",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceRegion" = var.region
          }
        }
      },
    ]
  })

  tags = merge(var.tags, { Name = "${var.name_prefix}-dr-vault" })
}

resource "aws_backup_plan" "daily" {
  name = "${var.name_prefix}-daily-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = var.backup_retention_days
    }

    dynamic "copy_action" {
      for_each = var.enable_cross_region_backup ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn
        lifecycle {
          delete_after = var.backup_retention_days
        }
      }
    }
  }

  tags = var.tags
}

resource "aws_backup_plan" "weekly" {
  name = "${var.name_prefix}-weekly-plan"

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 ? * SUN *)"
    start_window      = 60
    completion_window = 360

    lifecycle {
      cold_storage_after = 30
      delete_after       = 365
    }

    dynamic "copy_action" {
      for_each = var.enable_cross_region_backup ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn
        lifecycle {
          cold_storage_after = 30
          delete_after       = var.backup_retention_days
        }
      }
    }
  }

  tags = var.tags
}

resource "aws_backup_selection" "main" {
  name         = "${var.name_prefix}-backup-selection"
  plan_id      = aws_backup_plan.daily.id
  iam_role_arn = var.backup_iam_role_arn

  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}
