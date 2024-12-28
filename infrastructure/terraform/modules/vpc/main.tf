# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for subnet calculations and common tags
locals {
  # Calculate number of subnets based on AZ count
  subnet_count = length(var.availability_zones)
  
  # Generate CIDR blocks for private subnets
  private_subnets = [for i in range(local.subnet_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  
  # Generate CIDR blocks for public subnets
  public_subnets = [for i in range(local.subnet_count) : cidrsubnet(var.vpc_cidr, 4, i + local.subnet_count)]
  
  # Determine NAT gateway count based on environment
  enable_nat_gateway = var.environment == "prod" ? local.subnet_count : 1
  
  # Common tags for all resources
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "EmailManagementPlatform"
  }
}

# VPC Resource
resource "aws_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-vpc"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public_subnet" {
  count                   = local.subnet_count
  vpc_id                  = aws_vpc.vpc.id
  cidr_block             = local.public_subnets[count.index]
  availability_zone      = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-public-${var.availability_zones[count.index]}"
      Type = "Public"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private_subnet" {
  count             = local.subnet_count
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-private-${var.availability_zones[count.index]}"
      Type = "Private"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "internet_gateway" {
  vpc_id = aws_vpc.vpc.id
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-igw"
    }
  )
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = local.enable_nat_gateway
  domain = "vpc"
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-eip-${var.availability_zones[count.index]}"
    }
  )
}

# NAT Gateways
resource "aws_nat_gateway" "nat_gateway" {
  count         = local.enable_nat_gateway
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnet[count.index].id
  
  depends_on = [aws_internet_gateway.internet_gateway]
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-nat-${var.availability_zones[count.index]}"
    }
  )
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.internet_gateway.id
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-public-rt"
      Type = "Public"
    }
  )
}

# Private Route Tables
resource "aws_route_table" "private" {
  count  = local.subnet_count
  vpc_id = aws_vpc.vpc.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gateway[count.index % local.enable_nat_gateway].id
  }
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-private-rt-${var.availability_zones[count.index]}"
      Type = "Private"
    }
  )
}

# Public Subnet Route Table Associations
resource "aws_route_table_association" "public" {
  count          = local.subnet_count
  subnet_id      = aws_subnet.public_subnet[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Subnet Route Table Associations
resource "aws_route_table_association" "private" {
  count          = local.subnet_count
  subnet_id      = aws_subnet.private_subnet[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# VPC Flow Logs
resource "aws_flow_log" "vpc_flow_log" {
  vpc_id          = aws_vpc.vpc.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.vpc_flow_log_role.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn
  
  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-vpc-flow-log"
    }
  )
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  name              = "/aws/vpc/${var.environment}-flow-logs"
  retention_in_days = 30
  
  tags = local.common_tags
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_log_role" {
  name = "${var.environment}-vpc-flow-log-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_log_policy" {
  name = "${var.environment}-vpc-flow-log-policy"
  role = aws_iam_role.vpc_flow_log_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect = "Allow"
        Resource = "*"
      }
    ]
  })
}