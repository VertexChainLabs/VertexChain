terraform {
  required_version = ">= 1.5.0"

  # Backend configuration has been moved to backend.tf.
  # See backend.tf for S3 remote state, DynamoDB locking,
  # KMS encryption, and lifecycle rules.

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

# Aliased provider used for the disaster-recovery region so we can
# provision the mirrored backup vault and KMS key there. Only the
# resources that need cross-region presence attach to this provider.
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project   = "vertexchain"
      ManagedBy = "terraform"
    }
  }
}
