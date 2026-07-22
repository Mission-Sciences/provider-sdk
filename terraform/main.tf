# Terraform configuration for Marketplace Provider SDK Infrastructure
# Creates CodeArtifact domain and repository for npm package hosting

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "general-wisdom-dev-terraform-state"
    key     = "gw-sdk/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "gw-sdk"
      Environment = "shared"
      ManagedBy   = "terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "CodeArtifact domain name"
  type        = string
  default     = "ghostdogbase"
}

variable "repository_name" {
  description = "CodeArtifact repository name"
  type        = string
  default     = "sdk-packages"
}

variable "consumer_account_ids" {
  description = "AWS account IDs allowed to consume packages from this domain (cross-account access)"
  type        = list(string)
  # gw-prod account needs GetAuthorizationToken to run `aws codeartifact login`
  default     = ["448806488514"]
}

# CodeArtifact for SDK packages
resource "aws_codeartifact_domain" "sdk" {
  domain = var.domain_name
}

resource "aws_codeartifact_repository" "sdk" {
  repository = var.repository_name
  domain     = aws_codeartifact_domain.sdk.domain

  # Connect to public npm registry for upstream dependencies
  external_connections {
    external_connection_name = "public:npmjs"
  }
}

# Domain-level permissions policy for cross-account access.
# GetAuthorizationToken is a domain-level action — it cannot be granted via
# repository policies. Consumer accounts (e.g. gw-prod) need this to call
# `aws codeartifact login` before npm install/publish.
resource "aws_codeartifact_domain_permissions_policy" "cross_account" {
  count  = length(var.consumer_account_ids) > 0 ? 1 : 0
  domain = aws_codeartifact_domain.sdk.domain
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CrossAccountGetAuthToken"
        Effect = "Allow"
        Principal = {
          AWS = [for id in var.consumer_account_ids : "arn:aws:iam::${id}:root"]
        }
        Action = [
          "codeartifact:GetAuthorizationToken",
          "codeartifact:GetRepositoryEndpoint",
          "codeartifact:ReadFromRepository"
        ]
        Resource = "*"
      }
    ]
  })
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Outputs
output "domain_name" {
  description = "CodeArtifact domain name"
  value       = aws_codeartifact_domain.sdk.domain
}

output "repository_name" {
  description = "CodeArtifact repository name"
  value       = aws_codeartifact_repository.sdk.repository
}

output "registry_url" {
  description = "npm registry URL for this repository"
  value       = "https://${aws_codeartifact_domain.sdk.domain}-${data.aws_caller_identity.current.account_id}.d.codeartifact.${data.aws_region.current.name}.amazonaws.com/npm/${aws_codeartifact_repository.sdk.repository}/"
}

output "setup_commands" {
  description = "Commands to publish and consume packages"
  value       = <<-EOT
    # Publish SDK (from gw-sdk directory):
    aws codeartifact login --tool npm --domain ${aws_codeartifact_domain.sdk.domain} --repository ${aws_codeartifact_repository.sdk.repository} --region ${data.aws_region.current.name}
    npm publish

    # Install SDK (from consuming app):
    aws codeartifact login --tool npm --domain ${aws_codeartifact_domain.sdk.domain} --repository ${aws_codeartifact_repository.sdk.repository} --region ${data.aws_region.current.name}
    npm install @mission_sciences/provider-sdk
  EOT
}
