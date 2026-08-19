# =============================================================================
# Terraform Remote State Backend
#
# Uses S3 for state storage with KMS encryption, DynamoDB for state locking to
# prevent concurrent modifications, and lifecycle rules to manage state history.
#
# The S3 bucket and DynamoDB table are created by this configuration via a
# bootstrap process. After initial creation, uncomment the backend block below
# and run `terraform init -migrate-state` to migrate local state to the remote
# backend.
# =============================================================================

# ---------------------------------------------------------------------------
# 1. TERRAFORM BACKEND — uncomment after bootstrap
# ---------------------------------------------------------------------------
# terraform {
#   backend "s3" {
#     bucket         = aws_s3_bucket.terraform_state.bucket
#     key            = "vertexchain/terraform.tfstate"
#     region         = var.region
#     encrypt        = true
#     kms_key_id     = aws_kms_key.terraform_state.arn
#     dynamodb_table = aws_dynamodb_table.terraform_state_lock.name
#
#     # Workspace isolation — state paths become:
#     #   env:/dev/vertexchain/terraform.tfstate
#     #   env:/staging/vertexchain/terraform.tfstate
#     #   env:/prod/vertexchain/terraform.tfstate
#     workspace_key_prefix = "env:"
#   }
# }

# ---------------------------------------------------------------------------
# 2. KMS KEY — encrypts the Terraform state at rest
# ---------------------------------------------------------------------------
resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for encrypting Terraform remote state in S3"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.state_backend.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key for state encryption"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_kms_alias" "terraform_state" {
  name          = "alias/${local.name_prefix}-terraform-state"
  target_key_id = aws_kms_key.terraform_state.key_id
}

# ---------------------------------------------------------------------------
# 3. S3 BUCKET — stores Terraform state files
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${data.aws_caller_identity.state_backend.account_id}"

  tags = merge(local.common_tags, {
    Purpose = "terraform-remote-state"
  })
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning so every state change is recoverable
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# KMS server-side encryption (default for all objects)
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.terraform_state.arn
    }
    bucket_key_enabled = true
  }
}

# ---------------------------------------------------------------------------
# 4. LIFECYCLE RULES — manage state file history
#    - Keep the latest N noncurrent versions for rollback
#    - Expire older versions after 90 days
# ---------------------------------------------------------------------------
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "state-version-lifecycle"
    status = "Enabled"

    # Applies to all objects in the state bucket
    filter {}

    # Keep up to 10 noncurrent versions for safe rollback
    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 10
    }

    # Abort incomplete multipart uploads (e.g. from interrupted applies)
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ---------------------------------------------------------------------------
# 5. DYNAMODB TABLE — state locking to prevent concurrent modifications
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "terraform_state_lock" {
  name         = "${var.project_name}-terraform-state-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable point-in-time recovery so lock history is preserved
  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_state.arn
  }

  tags = merge(local.common_tags, {
    Purpose = "terraform-state-lock"
  })
}

# ---------------------------------------------------------------------------
# 6. DATA SOURCE — needed for KMS policy and globally unique bucket name.
#    Uses a distinct name ("state_backend") to avoid colliding with the
#    conditional data "aws_caller_identity" "current" in backup-vaults.tf.
# ---------------------------------------------------------------------------
data "aws_caller_identity" "state_backend" {}
