terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "vertexchain-terraform-state"
    key            = "vertexchain/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vertexchain-terraform-locks"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.55"
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
