# AWS OIDC Setup for GitHub Actions

## Overview

GitHub Actions can authenticate to AWS using **OpenID Connect (OIDC)** instead of storing long-lived AWS credentials. This is more secure because:
- ✅ No hardcoded AWS access keys
- ✅ Temporary credentials that expire automatically
- ✅ Fine-grained permissions via IAM role
- ✅ Auditable via CloudTrail

## Architecture

```
GitHub Actions Workflow
    ↓ (OIDC token request)
AWS STS (Security Token Service)
    ↓ (validate token against trust policy)
Assume IAM Role
    ↓ (return temporary credentials)
GitHub Actions uses credentials
```

## Step 1: Create GitHub OIDC Provider in AWS

This is a **one-time setup** per AWS account.

### Via AWS Console

1. Navigate to: **IAM → Identity providers → Add provider**
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

### Via AWS CLI

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --tags Key=Purpose,Value=GitHubActions
```

**Note**: The thumbprint is GitHub's current certificate thumbprint (as of 2024).

### Verify Provider Created

```bash
aws iam list-open-id-connect-providers
# Should show: arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com
```

## Step 2: Create IAM Role for GitHub Actions

### IAM Role Trust Policy

Create a file: `github-actions-trust-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Mission-Sciences/provider-sdk:*"
        }
      }
    }
  ]
}
```

**Important**: Replace `YOUR_ACCOUNT_ID` with your AWS account ID.

**Security Note**: The `StringLike` condition restricts this role to only the `Mission-Sciences/provider-sdk` repository.

### Create the IAM Role

```bash
# Replace YOUR_ACCOUNT_ID with your actual AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Update the trust policy with your account ID
sed "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" github-actions-trust-policy.json > trust-policy-updated.json

# Create the role
aws iam create-role \
  --role-name GitHubActions-ProviderSDK-Publisher \
  --assume-role-policy-document file://trust-policy-updated.json \
  --description "Role for GitHub Actions to publish provider-sdk package" \
  --tags Key=Project,Value=provider-sdk Key=ManagedBy,Value=GitHub
```

### Attach Permissions Policy

Create a file: `github-actions-permissions-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CodeArtifactPublish",
      "Effect": "Allow",
      "Action": [
        "codeartifact:GetAuthorizationToken",
        "codeartifact:GetRepositoryEndpoint",
        "codeartifact:PublishPackageVersion",
        "codeartifact:PutPackageMetadata",
        "codeartifact:ReadFromRepository",
        "codeartifact:ListPackages",
        "codeartifact:DescribePackageVersion",
        "codeartifact:ListPackageVersions"
      ],
      "Resource": [
        "arn:aws:codeartifact:us-east-1:*:domain/ghostdogbase",
        "arn:aws:codeartifact:us-east-1:*:repository/ghostdogbase/sdk-packages",
        "arn:aws:codeartifact:us-east-1:*:package/ghostdogbase/sdk-packages/*/*"
      ]
    },
    {
      "Sid": "STSGetServiceBearerToken",
      "Effect": "Allow",
      "Action": "sts:GetServiceBearerToken",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "sts:AWSServiceName": "codeartifact.amazonaws.com"
        }
      }
    },
    {
      "Sid": "TerraformCodeArtifact",
      "Effect": "Allow",
      "Action": [
        "codeartifact:CreateDomain",
        "codeartifact:CreateRepository",
        "codeartifact:DeleteDomain",
        "codeartifact:DeleteRepository",
        "codeartifact:DescribeDomain",
        "codeartifact:DescribeRepository",
        "codeartifact:GetDomainPermissionsPolicy",
        "codeartifact:GetRepositoryPermissionsPolicy",
        "codeartifact:PutDomainPermissionsPolicy",
        "codeartifact:PutRepositoryPermissionsPolicy",
        "codeartifact:ListRepositoriesInDomain",
        "codeartifact:ListDomains",
        "codeartifact:UpdateRepository"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerraformState",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::your-terraform-state-bucket",
        "arn:aws:s3:::your-terraform-state-bucket/*"
      ]
    },
    {
      "Sid": "TerraformDynamoDBLock",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DeleteItem",
        "dynamodb:DescribeTable"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/terraform-state-lock"
    }
  ]
}
```

**Note**: If you don't use S3 for Terraform state, remove the `TerraformState` and `TerraformDynamoDBLock` statements.

### Create and Attach Policy

```bash
# Create the policy
aws iam create-policy \
  --policy-name GitHubActions-ProviderSDK-Permissions \
  --policy-document file://github-actions-permissions-policy.json \
  --description "Permissions for GitHub Actions to publish provider-sdk"

# Get the policy ARN
export POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='GitHubActions-ProviderSDK-Permissions'].Arn" --output text)

# Attach policy to role
aws iam attach-role-policy \
  --role-name GitHubActions-ProviderSDK-Publisher \
  --policy-arn $POLICY_ARN
```

### Get the Role ARN

```bash
aws iam get-role --role-name GitHubActions-ProviderSDK-Publisher --query Role.Arn --output text
```

**Output**: `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-ProviderSDK-Publisher`

**Save this ARN** - you'll need it for GitHub secrets!

## Step 3: Configure GitHub Secret

Only **ONE** secret is needed now (instead of 3):

### Add to GitHub Repository

1. Go to: https://github.com/Mission-Sciences/provider-sdk/settings/secrets/actions
2. Click **New repository secret**
3. Name: `AWS_ROLE_ARN`
4. Value: `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-ProviderSDK-Publisher`
5. Click **Add secret**

**That's it!** No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed.

## Step 4: Verify Setup

### Test Locally (Optional)

You can't fully test OIDC locally, but you can verify the role exists:

```bash
# Verify role exists
aws iam get-role --role-name GitHubActions-ProviderSDK-Publisher

# Verify trust policy
aws iam get-role --role-name GitHubActions-ProviderSDK-Publisher --query Role.AssumeRolePolicyDocument

# List attached policies
aws iam list-attached-role-policies --role-name GitHubActions-ProviderSDK-Publisher
```

### Test in GitHub Actions

Push a test commit to trigger the workflow:

```bash
git commit --allow-empty -m "test: verify OIDC authentication"
git push origin main
```

Watch the workflow in: https://github.com/Mission-Sciences/provider-sdk/actions

The "Configure AWS credentials via OIDC" step should succeed and show:
```
✓ Assumed role: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-ProviderSDK-Publisher
```

## Troubleshooting

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Cause**: Trust policy doesn't allow GitHub Actions.

**Fix**: Verify trust policy includes:
```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:Mission-Sciences/provider-sdk:*"
}
```

### Error: "No OpenID Connect provider found"

**Cause**: OIDC provider not created in AWS.

**Fix**: Run Step 1 again to create the provider.

### Error: "Access Denied" during CodeArtifact operations

**Cause**: Permissions policy doesn't include required actions.

**Fix**: Verify the permissions policy includes all CodeArtifact actions from Step 2.

### Error: Role ARN not found in secrets

**Cause**: GitHub secret not set.

**Fix**: Add `AWS_ROLE_ARN` secret in repository settings.

## Security Best Practices

### ✅ Least Privilege Permissions
- Role has only permissions needed for publishing
- Trust policy restricts to specific repository
- Temporary credentials expire automatically

### ✅ Restrict by Branch (Optional)
Add to trust policy to restrict to `main` branch only:
```json
"StringEquals": {
  "token.actions.githubusercontent.com:sub": "repo:Mission-Sciences/provider-sdk:ref:refs/heads/main"
}
```

### ✅ Restrict by Environment (Optional)
For production deployments, use GitHub environments:
```json
"StringEquals": {
  "token.actions.githubusercontent.com:sub": "repo:Mission-Sciences/provider-sdk:environment:production"
}
```

### ✅ Audit with CloudTrail
Enable CloudTrail to track all AWS API calls made by the role:
```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=GitHubActions-ProviderSDK-Publisher \
  --max-results 10
```

## Migration from IAM User Credentials

### Before (Access Keys)
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

### After (OIDC)
```yaml
- name: Configure AWS credentials via OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1
    role-session-name: GitHubActions-Publish
```

### Cleanup Old Credentials

After verifying OIDC works:

```bash
# Delete old IAM user (if it exists)
aws iam delete-access-key --user-name github-actions-publisher --access-key-id AKIA...
aws iam delete-user --user-name github-actions-publisher
```

Remove old GitHub secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Summary

✅ **More Secure**: No long-lived credentials stored
✅ **Simpler**: Only 1 secret instead of 2-3
✅ **Auditable**: CloudTrail tracks all access
✅ **Auto-Expiring**: Temporary credentials expire after use
✅ **Fine-Grained**: Restrict by repository, branch, environment

## Quick Reference

**OIDC Provider URL**: `https://token.actions.githubusercontent.com`
**Audience**: `sts.amazonaws.com`
**GitHub Secret**: `AWS_ROLE_ARN`
**Role Name**: `GitHubActions-ProviderSDK-Publisher`

**Workflow Configuration**:
```yaml
permissions:
  id-token: write  # Required for OIDC
  contents: read

steps:
  - name: Configure AWS credentials via OIDC
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
      aws-region: us-east-1
      role-session-name: GitHubActions-Publish
```

For more details: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
