#!/usr/bin/env bash
# bootstrap-state.sh — One-time setup for Terraform remote state backend.
# Creates the S3 state bucket (versioned, encrypted, public-access blocked)
# and the DynamoDB lock table required by providers.tf backend config.
#
# Usage:
#   ./infrastructure/scripts/bootstrap-state.sh [AWS_REGION]
#
# Prerequisites:
#   - AWS CLI v2 configured with admin credentials
#   - jq installed

set -euo pipefail

REGION="${1:-us-east-1}"
BUCKET="vertexchain-terraform-state"
TABLE="vertexchain-terraform-locks"

echo "==> Bootstrapping Terraform remote state in ${REGION}"

# ── S3 bucket ────────────────────────────────────────────────────────────────
if aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "[skip] S3 bucket '${BUCKET}' already exists"
else
  echo "[create] S3 bucket '${BUCKET}'"
  if [ "${REGION}" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi
fi

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled \
  --region "${REGION}"
echo "[ok] Versioning enabled"

# Block all public access
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --region "${REGION}"
echo "[ok] Public access blocked"

# Enforce AES-256 encryption by default
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --region "${REGION}"
echo "[ok] AES-256 default encryption enabled"

# ── DynamoDB lock table ──────────────────────────────────────────────────────
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "[skip] DynamoDB table '${TABLE}' already exists"
else
  echo "[create] DynamoDB table '${TABLE}'"
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --region "${REGION}" \
    --query 'TableDescription.TableArn' \
    --output text
  echo "[ok] DynamoDB table created (PAY_PER_REQUEST, SSE enabled)"
fi

echo ""
echo "==> Bootstrap complete."
echo "    Run 'terraform init' in infrastructure/terraform/ to configure the remote backend."
