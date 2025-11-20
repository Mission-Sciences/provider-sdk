# Terraform Configuration for SDK Infrastructure

This directory contains Terraform configuration for AWS CodeArtifact setup.

## What It Creates

- **CodeArtifact Domain**: `ghostdogbase`
- **CodeArtifact Repository**: `sdk-packages`
- **npm Registry URL**: `https://ghostdogbase-<account>.d.codeartifact.us-east-1.amazonaws.com/npm/sdk-packages/`
- **IAM Permissions**: Adds CodeArtifact permissions to Bitbucket OIDC role
- **Upstream Connection**: Links to public npm for dependencies

## Quick Start

```bash
# From SDK root directory
make setup-codeartifact

# Or manually
cd terraform
terraform init
terraform plan
terraform apply
```

## State Management

Terraform state is stored in S3:
- **Bucket**: `general-wisdom-dev-terraform-state`
- **Key**: `gw-sdk/terraform.tfstate`
- **Region**: `us-east-1`
- **Encryption**: Enabled

## Outputs

After applying, Terraform outputs:
- Domain name
- Repository name
- npm registry URL
- Setup commands for publishing and consuming

View outputs:
```bash
terraform output
```

## Required AWS Permissions

Your AWS profile needs:
- `codeartifact:*`
- `iam:GetRole`
- `iam:PutRolePolicy`
- `s3:GetObject` (for state)
- `s3:PutObject` (for state)

## Integration with Pipelines

### gw-sdk Pipeline (Publishing)

Pipeline uses OIDC to authenticate:
```yaml
oidc: true
script:
  - aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages
  - npm publish
```

### extension-ghostdog Pipeline (Consuming)

Pipeline uses OIDC to install packages:
```yaml
oidc: true
script:
  - aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages
  - make build
```

## Local Development

```bash
# Authenticate (valid 12 hours)
aws codeartifact login --tool npm \
  --domain ghostdogbase \
  --repository sdk-packages \
  --region us-east-1

# Publish
npm publish

# Or use make target
make publish
```

## Cost

Based on typical usage:
- Storage: ~$0.00005/month
- Requests: ~$0.05/month
- **Total: ~$0.05/month**

## Cleanup

To remove all CodeArtifact resources:

```bash
terraform destroy
```

**Warning**: This deletes all published packages!

## Files

- `main.tf` - Main configuration
- `.terraform/` - Terraform working directory (gitignored)
- `.terraform.lock.hcl` - Provider lock file (committed)
- `terraform.tfstate` - State (stored in S3, not local)

## Module Structure

Uses same pattern as gw-api:
- Reusable module in `gw-api/terraform/modules/codeartifact/`
- Environment-specific configs (this file)
- S3 backend for state management
- OIDC role integration

## Related Documentation

- [Setup Quick Start](../SETUP_QUICKSTART.md)
- [Full Setup Guide](../CODEARTIFACT_SETUP.md)
- [Package Registry Comparison](../PACKAGE_REGISTRY_COMPARISON.md)
