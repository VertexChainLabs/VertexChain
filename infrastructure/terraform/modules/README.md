# Terraform Modules

Reusable Terraform modules for VertexChain infrastructure, refactored from a
flat collection of `.tf` files into a clean, composable module structure.

## Structure

```
modules/
├── network/   — VPC, subnets, route tables, NAT gateway, NACLs, security groups
├── compute/   — EKS cluster, node groups, ASG, ALB, launch templates, target groups
└── data/      — RDS, ElastiCache, S3 buckets, backup vaults and plans
```

## Module dependency graph

```
┌────────────────────────────────────────────┐
│                  Root module               │
│  (IAM, CloudFront, WAF, Route53, ACM,     │
│   CloudWatch, SNS, Secrets Manager)        │
└────┬────┬────┬─────────────────────────────┘
     │    │    │
     ▼    ▼    ▼
  ┌────┐ ┌────┐ ┌────┐
  │net-│ │data│ │comp│
  │work│ │    │ │ute │
  └──┬─┘ └─▲──┘ └─▲──┘
     │     │      │
     │     └──┬───┘ (references network outputs)
     │        │
     ▼────────┘
  (all modules use root-level IAM roles)
```

## Root module usage

```hcl
terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "vertexchain-terraform-state"
    key    = "vertexchain/terraform.tfstate"
    region = "us-east-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
```

## Per-environment config

```bash
# Plan / apply with environment-specific variables
terraform plan   -var-file=envs/terraform.tfvars.dev
terraform apply  -var-file=envs/terraform.tfvars.dev

terraform plan   -var-file=envs/terraform.tfvars.staging
terraform apply  -var-file=envs/terraform.tfvars.staging

terraform plan   -var-file=envs/terraform.tfvars.prod
terraform apply  -var-file=envs/terraform.tfvars.prod
```

## Version Constraints

All modules require:
- Terraform `>= 1.5.0`
- AWS provider `~> 5.0`

## Inputs / Outputs

Each module exposes typed input variables (`variables.tf`) and output values
(`outputs.tf`). See the `README.md` inside each module directory for the full
variable reference. The root module's `outputs.tf` surfaces ARNs for every
created resource.
