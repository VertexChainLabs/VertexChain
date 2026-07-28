# =============================================================================
# Network submodule outputs
# =============================================================================

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_arns" {
  description = "List of public subnet ARNs"
  value       = aws_subnet.public[*].arn
}

output "private_subnet_arns" {
  description = "List of private subnet ARNs"
  value       = aws_subnet.private[*].arn
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway"
  value       = aws_internet_gateway.this.id
}

output "nat_gateway_id" {
  description = "The ID of the NAT Gateway"
  value       = aws_nat_gateway.this.id
}

output "nat_eip_id" {
  description = "The ID of the Elastic IP for NAT"
  value       = aws_eip.nat.id
}

output "nat_eip_public_ip" {
  description = "The public IP of the NAT Gateway EIP"
  value       = aws_eip.nat.public_ip
}

output "security_group_alb_id" {
  description = "The ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "security_group_alb_arn" {
  description = "The ARN of the ALB security group"
  value       = aws_security_group.alb.arn
}

output "security_group_app_id" {
  description = "The ID of the App security group"
  value       = aws_security_group.app.id
}

output "security_group_app_arn" {
  description = "The ARN of the App security group"
  value       = aws_security_group.app.arn
}

output "security_group_db_id" {
  description = "The ID of the DB security group"
  value       = aws_security_group.db.id
}

output "security_group_db_arn" {
  description = "The ARN of the DB security group"
  value       = aws_security_group.db.arn
}

output "security_group_redis_id" {
  description = "The ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "security_group_redis_arn" {
  description = "The ARN of the Redis security group"
  value       = aws_security_group.redis.arn
}

output "public_route_table_id" {
  description = "The ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "The ID of the private route table"
  value       = aws_route_table.private.id
}
