# Terraform Configurations

Infrastructure as Code for VertexChain cloud resource provisioning.

## Overview

Terraform modules for provisioning AWS infrastructure for VertexChain,
a location-aware micro-messaging platform built on Stellar.

## Module Structure

```
infrastructure/terraform/
├── main.tf            # Root module entry point
├── variables.tf       # Root module input variables
├── outputs.tf         # Root module outputs (ARNs for every resource)
├── providers.tf       # Terraform and provider configuration
├── modules/
│   ├── network/       # VPC, subnets, gateways, NACLs, security groups
│   ├── compute/       # EKS, ASG, ALB, launch templates, target groups
│   └── data/          # RDS, ElastiCache, S3, backup vaults & plans
├── envs/              # Per-environment tfvars files
│   ├── terraform.tfvars.dev
│   ├── terraform.tfvars.staging
│   ├── terraform.tfvars.prod
│   └── terraform.tfvars.example
├── tests/             # Terratest integration tests
│   └── test_helper.go
└── archive/           # Previous flat .tf files (kept for reference)
```

## Usage

```bash
# Initialize Terraform
terraform init

# Select workspace
terraform workspace select dev || terraform workspace new dev

# Plan with environment-specific variables
terraform plan -var-file=envs/terraform.tfvars.dev

# Apply changes
terraform apply -var-file=envs/terraform.tfvars.dev
```

## Workspace Strategy

Per-environment state isolation is handled by workspaces. Each environment
uses its own `tfvars` file while sharing the same root module:

| Environment | Workspace | Variable file            |
|-------------|-----------|--------------------------|
| dev         | `dev`     | `envs/terraform.tfvars.dev` |
| staging     | `staging` | `envs/terraform.tfvars.staging` |
| prod        | `prod`    | `envs/terraform.tfvars.prod` |

## Outputs

All resource ARNs are surfaced through the root module's `outputs.tf`.
Run `terraform output` to see the full list after an apply.

```bash
terraform output
# vpc_id                  = "vpc-xxx"
# alb_arn                 = "arn:aws:elasticloadbalancing:..."
# rds_instance_arn        = "arn:aws:rds:..."
# redis_replication_group_arn = "arn:aws:elasticache:..."
# s3_uploads_bucket_arn   = "arn:aws:s3:::..."
# eks_cluster_arn         = "arn:aws:eks:..."
# waf_web_acl_arn         = "arn:aws:wafv2:..."
# cloudfront_distribution_arn = "arn:aws:cloudfront:..."
# ...and many more
```

## Migrating from the flat structure

The previous flat `.tf` files (vpc.tf, rds.tf, etc.) have been refactored into
the submodule structure above. The original files are preserved in the
`archive/` directory for reference and should be removed once the new modular
structure is validated.

Before applying the new module structure to an existing deployment:

1. Import existing resources into the new module state:
   ```bash
   terraform import module.network.aws_vpc.this vpc-xxx
   terraform import module.data.aws_db_instance.postgres db-xxx
   # ... etc.
   ```

2. Run `terraform plan` to verify no unexpected changes.

3. Apply once all differences are reconciled.
