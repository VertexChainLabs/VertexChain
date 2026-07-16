# Terraform Setup

VertexChain uses **per-environment Terraform workspaces** so that dev, staging,
and prod each maintain isolated state, use distinct variable values, and carry
zero blast-radius risk from each other.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Terraform | 1.5.0 |
| AWS CLI | 2.x |
| AWS credentials | OIDC (CI) or named profile (local) |

---

## Directory layout

```
infrastructure/terraform/
├── envs/
│   ├── terraform.tfvars.dev       # dev-specific values
│   ├── terraform.tfvars.staging   # staging-specific values
│   └── terraform.tfvars.prod      # prod-specific values
├── variables.tf                   # single source of truth — all variable declarations
├── providers.tf                   # partial backend config (key supplied at init time)
├── workspaces.tf                  # env_config locals + workspace outputs
└── *.tf                           # resource files (no variable declarations)

infrastructure/scripts/
└── workspace-select.sh            # workspace helper (see below)
```

---

## One-time backend bootstrap

Create the S3 bucket and DynamoDB lock table **once**, before the first `init`:

```bash
aws s3api create-bucket \
  --bucket vertexchain-terraform-state \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket vertexchain-terraform-state \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name vertexchain-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

---

## Switching workspaces locally

Use the helper script — it handles `terraform init` (with the correct state
key) **and** workspace selection in one step:

```bash
# Select dev workspace
./infrastructure/scripts/workspace-select.sh dev

# Select staging workspace
./infrastructure/scripts/workspace-select.sh staging

# Select prod workspace
./infrastructure/scripts/workspace-select.sh prod
```

Each environment stores its state at a dedicated S3 key:

| Workspace | State key |
|-----------|-----------|
| dev | `env/dev/terraform.tfstate` |
| staging | `env/staging/terraform.tfstate` |
| prod | `env/prod/terraform.tfstate` |

---

## Plan and apply

After selecting a workspace, supply the matching tfvars file:

```bash
# Plan
terraform plan \
  -var-file="envs/terraform.tfvars.dev" \
  -input=false

# Apply (dev / staging only — prod requires manual approval in CI)
terraform apply \
  -var-file="envs/terraform.tfvars.dev" \
  -input=false \
  -auto-approve
```

Sensitive variables (`db_password`, `certificate_arn`, etc.) should **never**
be committed to the repo.  Supply them via:

```bash
export TF_VAR_db_password="$(aws secretsmanager get-secret-value \
  --secret-id vertexchain-dev-db-password --query SecretString --output text)"
```

---

## CI matrix workflow

The `.github/workflows/terraform-plan-matrix.yml` workflow runs **speculative
`terraform plan`** jobs in parallel against all three environments on every PR
that touches `infrastructure/terraform/**`.

```
PR opened / updated
       │
       ├─► Plan (dev)     ──► posts collapsible plan comment to PR
       ├─► Plan (staging) ──► posts collapsible plan comment to PR
       └─► Plan (prod)    ──► posts collapsible plan comment to PR
                │
                └─► all-plans-passed  (branch-protection gate)
```

Required GitHub secret (per environment):

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | IAM role ARN assumed via OIDC |

Configure one GitHub Actions environment (`dev`, `staging`, `prod`) per
workspace and store the corresponding `AWS_ROLE_ARN` in each environment's
secrets.

---

## Adding a new variable

1. Declare it in `variables.tf` (the single source of truth).
2. Add the value to **all three** tfvars files in `envs/`.
3. Reference it in the resource file — never redeclare it there.

---

## Troubleshooting

**`Error: Backend configuration changed`**
Re-run `workspace-select.sh` or pass `-reconfigure` to `terraform init` to
update the backend key for the current workspace.

**`Error: workspace already exists`**
The script handles this automatically — it selects an existing workspace
instead of failing.

**Plan shows unexpected destroy**
Check that you are on the correct workspace (`terraform workspace show`) and
using the matching tfvars file.
