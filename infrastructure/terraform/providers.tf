terraform {
  required_version = ">= 1.5.0"

  # Partial backend configuration — workspace-specific key is supplied at
  # `terraform init` time via -backend-config or the workspace-select helper.
  #
  # Usage:
  #   terraform init \
  #     -backend-config="key=env/dev/terraform.tfstate"
  #
  # Or let scripts/workspace-select.sh handle it automatically.
  backend "s3" {
    bucket         = "vertexchain-terraform-state"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vertexchain-terraform-locks"
    # `key` is intentionally omitted here so the workspace-select helper
    # (or CI) can supply:  env/<workspace>/terraform.tfstate
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
      Project     = "vertexchain"
      ManagedBy   = "terraform"
      Environment = terraform.workspace
    }
  }
}
