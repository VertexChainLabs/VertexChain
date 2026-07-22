#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# workspace-select.sh
#
# Selects (or creates) a Terraform workspace and re-initialises the S3 backend
# with the correct per-environment state key.
#
# Usage:
#   ./infrastructure/scripts/workspace-select.sh <dev|staging|prod>
#
# What it does:
#   1. Validates the requested workspace name.
#   2. Runs `terraform init` with the workspace-specific backend key so that
#      each environment stores state in its own S3 prefix:
#         env/dev/terraform.tfstate
#         env/staging/terraform.tfstate
#         env/prod/terraform.tfstate
#   3. Selects the workspace (creates it if it doesn't exist yet).
#   4. Prints a reminder of which -var-file to use for plan / apply.
#
# Prerequisites:
#   - Terraform >= 1.5 on $PATH
#   - AWS credentials configured (env vars, instance profile, or ~/.aws/*)
#   - The S3 bucket and DynamoDB lock table already exist
#     (see infrastructure/docs/terraform-setup.md for bootstrap instructions)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <dev|staging|prod>" >&2
  exit 1
}

info()  { echo "[workspace-select] $*"; }
error() { echo "[workspace-select] ERROR: $*" >&2; exit 1; }

# ── argument validation ───────────────────────────────────────────────────────

[[ $# -eq 1 ]] || usage

WORKSPACE="$1"

case "$WORKSPACE" in
  dev|staging|prod) ;;
  *) error "Unknown workspace '${WORKSPACE}'. Must be one of: dev, staging, prod." ;;
esac

# ── locate the Terraform root ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$(cd "${SCRIPT_DIR}/../terraform" && pwd)"
TFVARS_FILE="${TF_DIR}/envs/terraform.tfvars.${WORKSPACE}"

[[ -d "$TF_DIR" ]]       || error "Terraform directory not found: ${TF_DIR}"
[[ -f "$TFVARS_FILE" ]]  || error "tfvars file not found: ${TFVARS_FILE}"

cd "$TF_DIR"

# ── terraform init with per-workspace backend key ────────────────────────────

STATE_KEY="env/${WORKSPACE}/terraform.tfstate"
info "Initialising backend with key: ${STATE_KEY}"

terraform init \
  -reconfigure \
  -backend-config="key=${STATE_KEY}" \
  -input=false

# ── select / create workspace ─────────────────────────────────────────────────

if terraform workspace list | grep -qE "^\*?\s+${WORKSPACE}$"; then
  info "Selecting existing workspace: ${WORKSPACE}"
  terraform workspace select "$WORKSPACE"
else
  info "Creating new workspace: ${WORKSPACE}"
  terraform workspace new "$WORKSPACE"
fi

# ── summary ───────────────────────────────────────────────────────────────────

cat <<EOF

──────────────────────────────────────────────────────────
  Workspace   : ${WORKSPACE}
  State key   : ${STATE_KEY}
  Var file    : envs/terraform.tfvars.${WORKSPACE}
──────────────────────────────────────────────────────────

Next steps:
  terraform plan  -var-file="${TFVARS_FILE}" -input=false
  terraform apply -var-file="${TFVARS_FILE}" -input=false -auto-approve

EOF
