# Daily backup plan. Recovery points are written to the primary-region
# vault, then copied to the DR-region vault via the `copy_action` block
# below — giving us regional resilience without needing a separate
# copy-jobs plan. The `dynamic` block lets us turn replication off in
# dev/local environments by setting `enable_cross_region_backup=false`.

resource "aws_backup_plan" "main" {
  name = "${var.project_name}-${var.environment}-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = var.backup_retention_days
    }

    # Cross-region copy: any resource selected (by the `Backup=true`
    # tag in aws_backup_selection below) is automatically mirrored to
    # `aws_backup_vault.dr` after the primary backup completes.
    dynamic "copy_action" {
      for_each = var.enable_cross_region_backup ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn

        lifecycle {
          delete_after = var.backup_retention_days
        }
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_backup_selection" "main" {
  name         = "${var.project_name}-${var.environment}-backup-selection"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn

  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}
