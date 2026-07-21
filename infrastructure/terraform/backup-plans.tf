# Weekly backup plan. Adds a higher frequency cold-storage tier on top
# of the daily plan so we keep monthly snapshots for a full year without
# paying hot-storage costs.
#
# `backup_retention_days` is declared in variables.tf; it controls the
# DR-region copy retention, matching the primary tier so DR capacity
# planning stays predictable.

resource "aws_backup_plan" "weekly" {
  name = "${var.project_name}-${var.environment}-weekly-plan"

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 ? * SUN *)"
    start_window      = 60
    completion_window = 360

    lifecycle {
      cold_storage_after = 30
      delete_after       = 365
    }

    # Mirror the weekly snapshot into the DR-region vault so a single
    # regional outage does not lose the last good monthly copy.
    dynamic "copy_action" {
      for_each = var.enable_cross_region_backup ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn

        lifecycle {
          # Match the on-primary retention for consistency.
          cold_storage_after = 30
          delete_after       = var.backup_retention_days
        }
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
