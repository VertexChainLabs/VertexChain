terraform {
  required_version = ">= 1.5.0"

  # The S3 backend automatically isolates state per workspace when using
  # workspace_key_prefix.  State paths will be:
  #   env:/dev/vertexchain/terraform.tfstate
  #   env:/staging/vertexchain/terraform.tfstate
  #   env:/prod/vertexchain/terraform.tfstate
  # The default workspace continues to use the key directly:
  #   vertexchain/terraform.tfstate
  backend "s3" {
    bucket               = "vertexchain-terraform-state"
    key                  = "vertexchain/terraform.tfstate"
    workspace_key_prefix = "env:"
    region               = "us-east-1"
    encrypt              = true
    dynamodb_table       = "vertexchain-terraform-locks"
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
      Project   = "vertexchain"
      ManagedBy = "terraform"
    }
  }
}
