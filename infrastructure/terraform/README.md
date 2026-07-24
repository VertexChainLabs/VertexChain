# Terraform Configurations

Infrastructure as Code for cloud resource provisioning.

## Overview

Terraform modules for provisioning cloud infrastructure for VertexChain.

## Contents

- AWS/GCP/Azure resource definitions
- Network configurations
- Database provisioning
- Storage buckets
- Load balancers

## Usage

Run `terraform plan` and `terraform apply` to provision resources.

## CI Security Scans

Terraform changes are automatically scanned by **tfsec** and **checkov** in CI.

### Regenerating the checkov baseline

The `.checkov.baseline` file acknowledges pre-existing findings so CI only fails
on new regressions. After fixing infrastructure security issues, regenerate it:

```bash
checkov -d infrastructure/terraform --framework terraform --create-baseline
```

Then commit the updated `.checkov.baseline` alongside the fix.
