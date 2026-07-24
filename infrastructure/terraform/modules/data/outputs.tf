# =============================================================================
# Data submodule outputs
# =============================================================================

# --------------- RDS ---------------

output "rds_instance_arn" {
  description = "ARN of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.arn
}

output "rds_instance_id" {
  description = "ID of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.id
}

output "rds_instance_endpoint" {
  description = "Connection endpoint of the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_instance_address" {
  description = "DNS address of the RDS instance"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.postgres.port
}

output "rds_parameter_group_arn" {
  description = "ARN of the RDS parameter group"
  value       = aws_db_parameter_group.postgres.arn
}

output "rds_subnet_group_arn" {
  description = "ARN of the RDS subnet group"
  value       = aws_db_subnet_group.postgres.arn
}

# --------------- ElastiCache / Redis ---------------

output "redis_replication_group_arn" {
  description = "ARN of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.arn
}

output "redis_replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint address of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_parameter_group_arn" {
  description = "ARN of the Redis parameter group"
  value       = aws_elasticache_parameter_group.redis.arn
}

output "redis_subnet_group_arn" {
  description = "ARN of the Redis subnet group"
  value       = aws_elasticache_subnet_group.redis.arn
}

# --------------- S3 ---------------

output "s3_uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.arn
}

output "s3_uploads_bucket_id" {
  description = "ID of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.id
}

output "s3_backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = aws_s3_bucket.backups.arn
}

output "s3_backups_bucket_id" {
  description = "ID of the backups S3 bucket"
  value       = aws_s3_bucket.backups.id
}

output "s3_logs_bucket_arn" {
  description = "ARN of the logs S3 bucket"
  value       = aws_s3_bucket.logs.arn
}

output "s3_logs_bucket_id" {
  description = "ID of the logs S3 bucket"
  value       = aws_s3_bucket.logs.id
}

output "s3_frontend_bucket_arn" {
  description = "ARN of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.arn
}

output "s3_frontend_bucket_id" {
  description = "ID of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.id
}

output "s3_frontend_bucket_regional_domain_name" {
  description = "Regional domain name of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.bucket_regional_domain_name
}

# --------------- Backup ---------------

output "backup_vault_arn" {
  description = "ARN of the primary backup vault"
  value       = aws_backup_vault.main.arn
}

output "backup_vault_name" {
  description = "Name of the primary backup vault"
  value       = aws_backup_vault.main.name
}

output "backup_kms_key_arn" {
  description = "ARN of the backup KMS key"
  value       = aws_kms_key.backup.arn
}

output "backup_dr_vault_arn" {
  description = "ARN of the DR backup vault"
  value       = var.enable_cross_region_backup ? aws_backup_vault.dr[0].arn : null
}

output "backup_dr_kms_key_arn" {
  description = "ARN of the DR backup KMS key"
  value       = var.enable_cross_region_backup ? aws_kms_key.dr_backup[0].arn : null
}

output "backup_daily_plan_arn" {
  description = "ARN of the daily backup plan"
  value       = aws_backup_plan.daily.arn
}

output "backup_weekly_plan_arn" {
  description = "ARN of the weekly backup plan"
  value       = aws_backup_plan.weekly.arn
}

output "backup_selection_id" {
  description = "ID of the backup selection"
  value       = aws_backup_selection.main.id
}
