# VPC ID output for resource attachment
output "vpc_id" {
  description = "The ID of the VPC for resource attachment and network isolation"
  value       = aws_vpc.vpc.id
}

# Private subnet IDs for internal resources
output "private_subnets" {
  description = "List of private subnet IDs for internal resource deployment across availability zones"
  value       = aws_subnet.private_subnet[*].id
}

# Public subnet IDs for internet-facing resources
output "public_subnets" {
  description = "List of public subnet IDs for internet-facing resource deployment across availability zones"
  value       = aws_subnet.public_subnet[*].id
}

# NAT Gateway public IPs for outbound internet access
output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs for outbound internet access from private resources"
  value       = aws_eip.nat[*].public_ip
}

# Additional useful outputs for network configuration

output "private_subnet_cidrs" {
  description = "List of private subnet CIDR blocks for network planning and security group configuration"
  value       = aws_subnet.private_subnet[*].cidr_block
}

output "public_subnet_cidrs" {
  description = "List of public subnet CIDR blocks for network planning and security group configuration"
  value       = aws_subnet.public_subnet[*].cidr_block
}

output "availability_zones" {
  description = "List of availability zones where network resources are deployed"
  value       = aws_subnet.private_subnet[*].availability_zone
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway for public internet access configuration"
  value       = aws_internet_gateway.internet_gateway.id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs for private subnet outbound routing configuration"
  value       = aws_nat_gateway.nat_gateway[*].id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.vpc.cidr_block
}

output "private_route_table_ids" {
  description = "List of private route table IDs for custom route configuration"
  value       = aws_route_table.private[*].id
}

output "public_route_table_id" {
  description = "ID of the public route table for custom route configuration"
  value       = aws_route_table.public.id
}

output "vpc_flow_log_group" {
  description = "Name of the CloudWatch Log Group containing VPC Flow Logs"
  value       = aws_cloudwatch_log_group.vpc_flow_log.name
}