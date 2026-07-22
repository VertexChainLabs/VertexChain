resource "aws_backup_vault" "main" {
  name        = "${var.project_name}-${var.environment}-vault"
  kms_key_arn = aws_kms_key.backup.arn

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Primary-region KMS key. The key policy permits the AWS Backup
# service principal from THIS region to use the key, so the service can
# perform daily backups of tagged resources.
resource "aws_kms_key" "backup" {
  description             = "${var.project_name} backup encryption key (primary region)"
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
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*",
          "kms:DescribeKey",
          "kms:CreateGrant",
          "kms:ListGrants",
        ]
        Resource = "*"
        # Restrict to the primary region so backups are scoped correctly.
        Condition = {
          StringEquals = {
            "aws:SourceRegion" = var.region
          }
        }
      },
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# --------------------------------------------------------------------------- #
# Disaster-recovery region mirror
#
# Created via the aliased `aws.dr` provider. The DR KMS key policy
# explicitly grants the AWS Backup service principal from the PRIMARY
# region permission to encrypt with it; this is required for the
# cross-region copy_action inside aws_backup_plan to succeed, because
# AWS Backup writes the replica using the source region's service
# identity and the destination region's key for envelope encryption.
# --------------------------------------------------------------------------- #
data "aws_caller_identity" "current" {
  count = var.enable_cross_region_backup ? 1 : 0
}

resource "aws_kms_key" "dr_backup" {
  provider                = aws.dr
  count                   = var.enable_cross_region_backup ? 1 : 0
  description             = "${var.project_name} backup encryption key (DR region)"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccountFullAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current[0].account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        # Allow the AWS Backup service in the primary region to write
        # cross-region copies into the DR vault using this key.
        Sid    = "AllowAWSBackupCrossRegionCopy"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*",
          "kms:DescribeKey",
          "kms:CreateGrant",
          "kms:ListGrants",
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

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_backup_vault" "dr" {
  # Count-gated so dev environments can opt out by setting
  # var.enable_cross_region_backup = false; this avoids provisioning
  # KMS keys / vaults in a region the workload isn't using.
  count = var.enable_cross_region_backup ? 1 : 0

  provider    = aws.dr
  name        = "${var.project_name}-${var.environment}-dr-vault"
  kms_key_arn = aws_kms_key.dr_backup[0].arn

  # Vault access policy: allow the AWS Backup service principal from
  # the source region to write recovery points into this vault. Without
  # this, the copy_action in the source plan is denied silently.
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
          "backup:CopyFromBackupVault",
          "backup:DescribeBackupVault",
          "backup:ListBackupVaultJobs",
          "backup:ListRecoveryPointsByBackupVault",
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

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
