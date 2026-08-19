# Archived Terraform files

This directory contains the previous flat `.tf` files that were in the root
`infrastructure/terraform/` directory before the module-based refactoring
(see issue #164).

## Why was this refactored?

The old structure had 40+ `.tf` files in a single flat directory with no
`main.tf` entry point, scattered variable declarations, duplicate resource
definitions (e.g., `aws_security_group.alb` defined in both `alb.tf` and
`security-groups.tf`), and no outputs for resource ARNs.

The new structure:
- **`main.tf`** — clear root module entry point
- **`outputs.tf`** — ARNs for every created resource
- **`variables.tf`** — consolidated variable declarations (no duplicates)
- **`modules/`** — clean split into `network`, `compute`, and `data` submodules

## Removal

These archive files can be safely removed once the new modular structure has
been validated with `terraform plan` against a live environment. They are kept
only as a reference during the migration period.
