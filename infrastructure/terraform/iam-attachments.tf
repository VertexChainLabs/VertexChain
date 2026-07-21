resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_basic.arn
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_ssm.arn
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

# `AWSBackupServiceRolePolicyForRestores` is the AWS-recommended
# companion to AWSBackupServiceRolePolicyForBackup whenever a backup
# plan contains a cross-region `copy_action`. Without it the plan
# applies but cross-region copy jobs can fail with `AccessDenied` on
# the destination-side actions that AWS Backup triggers when it
# replicates. Attachments are conditional so legacy deployments that
# don't enable cross-region replication don't carry unused permissions.
resource "aws_iam_role_policy_attachment" "backup_restore_policy" {
  count      = var.enable_cross_region_backup ? 1 : 0
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}
