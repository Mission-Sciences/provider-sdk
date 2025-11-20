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

# IAM policy for CodeArtifact access (for Bitbucket pipeline)
data "aws_iam_role" "bitbucket_pipeline" {
  name = "BitbucketPipelineRole-ghostdog-dev"
}

# Attach CodeArtifact permissions to existing Bitbucket OIDC role
resource "aws_iam_role_policy" "codeartifact_publish" {
  name = "CodeArtifactPublishPolicy"
  role = data.aws_iam_role.bitbucket_pipeline.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "codeartifact:GetAuthorizationToken",
          "codeartifact:GetRepositoryEndpoint",
          "codeartifact:ReadFromRepository"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codeartifact:PublishPackageVersion",
          "codeartifact:PutPackageMetadata"
        ]
        Resource = "${aws_codeartifact_repository.sdk.arn}/*"
      },
      {
        Effect = "Allow"
        Action = "sts:GetServiceBearerToken"
        Resource = "*"
        Condition = {
          StringEquals = {
            "sts:AudRaw" = "codeartifact.amazonaws.com"
          }
        }
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
  value = <<-EOT
    # Publish SDK (from gw-sdk directory):
    aws codeartifact login --tool npm --domain ${aws_codeartifact_domain.sdk.domain} --repository ${aws_codeartifact_repository.sdk.repository} --region ${data.aws_region.current.name}
    npm publish

    # Install SDK (from consuming app):
    aws codeartifact login --tool npm --domain ${aws_codeartifact_domain.sdk.domain} --repository ${aws_codeartifact_repository.sdk.repository} --region ${data.aws_region.current.name}
    npm install @marketplace/provider-sdk
  EOT
}
