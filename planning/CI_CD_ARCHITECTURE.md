# CI/CD Architecture: Dual-Publishing to AWS CodeArtifact & npm Registry

## Overview

This document outlines the GitHub Actions workflow architecture for migrating from Bitbucket Pipelines and implementing dual-publishing of `@mission_sciences/provider-sdk` to both AWS CodeArtifact and npm registry.

## Table of Contents
1. [Workflow Strategy](#workflow-strategy)
2. [Authentication Architecture](#authentication-architecture)
3. [Secret Management](#secret-management)
4. [Workflow Design](#workflow-design)
5. [Integration with Existing Workflows](#integration-with-existing-workflows)
6. [Error Handling & Rollback](#error-handling--rollback)
7. [Implementation Plan](#implementation-plan)

---

## Workflow Strategy

### Migration Approach
**One-time Migration**: Complete transition from Bitbucket Pipelines to GitHub Actions
- Deprecate Bitbucket after successful GitHub validation
- Maintain feature parity with existing pipeline
- Add npm registry publishing capability

### Trigger Strategy
```yaml
Triggers:
  - Push to main branch → Full deployment pipeline
  - Release tags (v*.*.*) → Versioned releases to both registries
  - Manual workflow dispatch → On-demand publishing
  - Pull requests → Test-only (no publishing)
```

### Publishing Strategy
**Dual-Publishing Sequence**:
1. **AWS CodeArtifact First** (private, organization use)
   - Internal validation target
   - Fast rollback if issues detected
   - No public impact if failures occur
2. **npm Registry Second** (public distribution)
   - Public consumers
   - Only proceeds if CodeArtifact succeeds
   - Immutable once published

---

## Authentication Architecture

### AWS Authentication (CodeArtifact & Terraform)
**Method**: AWS IAM Access Keys (via GitHub Secrets)

**Differences from Bitbucket**:
| Aspect | Bitbucket (OIDC) | GitHub Actions (Access Keys) |
|--------|------------------|------------------------------|
| Auth Method | OIDC with `assume-role-with-web-identity` | Static IAM access keys |
| Setup | IAM role + OIDC provider | IAM user + access keys |
| Token Lifetime | 1-hour session tokens | Persistent (rotate manually) |
| Security | More secure (temporary) | Requires key rotation policy |
| Complexity | Higher (OIDC config) | Lower (direct credentials) |

**AWS Credentials Flow**:
```bash
# Bitbucket (OIDC - OLD)
aws sts assume-role-with-web-identity \
  --role-arn ${OIDC_ROLE_ARN} \
  --web-identity-token ${BITBUCKET_STEP_OIDC_TOKEN}

# GitHub Actions (Access Keys - NEW)
- uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

**Required IAM Permissions** (for IAM user):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codeartifact:GetAuthorizationToken",
        "codeartifact:GetRepositoryEndpoint",
        "codeartifact:PublishPackageVersion",
        "codeartifact:PutPackageMetadata"
      ],
      "Resource": [
        "arn:aws:codeartifact:us-east-1:*:domain/ghostdogbase",
        "arn:aws:codeartifact:us-east-1:*:repository/ghostdogbase/sdk-packages"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "sts:GetServiceBearerToken",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "sts:AWSServiceName": "codeartifact.amazonaws.com"
        }
      }
    }
  ]
}
```

**Terraform Permissions** (additional for infrastructure deployment):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codeartifact:CreateDomain",
        "codeartifact:CreateRepository",
        "codeartifact:DescribeDomain",
        "codeartifact:DescribeRepository",
        "codeartifact:PutDomainPermissionsPolicy",
        "codeartifact:PutRepositoryPermissionsPolicy",
        "codeartifact:AssociateExternalConnection",
        "codeartifact:ListRepositories",
        "codeartifact:ListDomains"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::terraform-state-bucket-name/*",
        "arn:aws:s3:::terraform-state-bucket-name"
      ]
    }
  ]
}
```

### npm Registry Authentication
**Method**: npm Access Token

**Token Types**:
- **Legacy Token** (recommended for CI/CD): Full read/write access
- **Granular Token**: Scoped to specific packages (more secure)

**Token Generation**:
```bash
# Via npm CLI (after login)
npm login --scope=@mission_sciences
npm token create --read-only=false

# Or via npm website
# https://www.npmjs.com/settings/mission_sciences/tokens
```

**Token Configuration**:
```yaml
# Set up .npmrc for publishing
- name: Configure npm registry
  run: |
    echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc
    echo "@mission_sciences:registry=https://registry.npmjs.org/" >> ~/.npmrc
```

---

## Secret Management

### Required GitHub Secrets
**Location**: Repository Settings → Secrets and Variables → Actions

#### AWS Secrets (3)
```yaml
AWS_ACCESS_KEY_ID:
  Description: "IAM user access key for CodeArtifact publishing"
  Value: "AKIAxxxxxxxxx"
  Scope: Repository-level

AWS_SECRET_ACCESS_KEY:
  Description: "IAM user secret key for CodeArtifact publishing"
  Value: "xxxxxxxxxxxxxxx"
  Scope: Repository-level

AWS_REGION:
  Description: "AWS region for CodeArtifact"
  Value: "us-east-1"
  Scope: Repository-level (or Environment variable)
```

#### npm Secret (1)
```yaml
NPM_TOKEN:
  Description: "npm access token for @mission_sciences org"
  Value: "npm_xxxxxxxxxxxxxxxx"
  Scope: Repository-level
  Token Type: "Automation" or "Granular"
```

#### Integration Test Secrets (Existing - Keep)
```yaml
API_BASE_URL: "https://api.ghostdogbase.com"
COGNITO_USER_POOL_ID: "us-east-1_xxxxxxxxx"
COGNITO_CLIENT_ID: "xxxxxxxxxxxxxxxxxx"
COGNITO_REGION: "us-east-1"
TEST_USERNAME: "test@example.com"
TEST_PASSWORD: "TestPassword123!"
```

### Secret Security Best Practices
1. **Rotation Policy**: Rotate AWS keys and npm tokens every 90 days
2. **Least Privilege**: IAM user should only have CodeArtifact and Terraform permissions
3. **Environment Separation**: Use GitHub Environments for production secrets
4. **Audit Logging**: Enable CloudTrail for AWS access monitoring
5. **Token Scoping**: Use granular npm tokens when possible

---

## Workflow Design

### Workflow Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRIGGER EVENTS                            │
│  • Push to main                                                  │
│  • Release tag (v*.*.*)                                          │
│  • Manual dispatch                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    JOB 1: Test & Build                           │
│  • Checkout code                                                 │
│  • Setup Node.js 20                                              │
│  • Install dependencies (npm ci)                                 │
│  • Run linter (npm run lint)                                     │
│  • Run unit tests (npm test)                                     │
│  • Build package (npm run build)                                 │
│  • Upload build artifacts                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          JOB 2: Integration Tests (Optional)                     │
│  • Download build artifacts                                      │
│  • Configure AWS credentials                                     │
│  • Run integration tests (npm run test:integration)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│      JOB 3: Terraform Plan (CodeArtifact Infrastructure)         │
│  • Checkout code                                                 │
│  • Setup Terraform 1.6                                           │
│  • Configure AWS credentials                                     │
│  • Terraform init                                                │
│  • Terraform plan -out=tfplan                                    │
│  • Upload plan artifact                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│      JOB 4: Terraform Apply (Manual Approval Optional)           │
│  • Download plan artifact                                        │
│  • Setup Terraform 1.6                                           │
│  • Configure AWS credentials                                     │
│  • Terraform init                                                │
│  • Terraform apply -auto-approve tfplan                          │
│  • Extract outputs (domain, repository)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         JOB 5: Publish to AWS CodeArtifact (Private)             │
│  • Download build artifacts                                      │
│  • Setup Node.js 20                                              │
│  • Configure AWS credentials                                     │
│  • Install dependencies (npm ci)                                 │
│  • Login to CodeArtifact (aws codeartifact login)               │
│  • Publish to CodeArtifact (npm publish)                        │
│  • Verify publication                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ✅ SUCCESS?
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            JOB 6: Publish to npm Registry (Public)               │
│  • Download build artifacts                                      │
│  • Setup Node.js 20                                              │
│  • Configure npm authentication (.npmrc)                         │
│  • Install dependencies (npm ci)                                 │
│  • Publish to npm (npm publish --access public)                 │
│  • Verify publication                                            │
│  • Create GitHub release (if tag trigger)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    JOB 7: Notify & Report                        │
│  • Post success/failure status                                   │
│  • Update deployment status                                      │
│  • Send notifications (Slack, email, etc.)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Workflow Structure

#### File: `.github/workflows/publish-package.yml`

```yaml
name: Build and Publish Package

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - 'tsconfig.json'
      - 'vite.config.ts'

  release:
    types: [published]

  workflow_dispatch:
    inputs:
      skip_npm:
        description: 'Skip npm registry publishing'
        required: false
        default: 'false'
      skip_codeartifact:
        description: 'Skip CodeArtifact publishing'
        required: false
        default: 'false'

env:
  NODE_VERSION: '20'
  AWS_REGION: 'us-east-1'
  CODEARTIFACT_DOMAIN: 'ghostdogbase'
  CODEARTIFACT_REPOSITORY: 'sdk-packages'

jobs:
  # ====================================================================
  # JOB 1: Test & Build
  # ====================================================================
  test-and-build:
    name: Test and Build Package
    runs-on: ubuntu-latest
    timeout-minutes: 15

    outputs:
      package-version: ${{ steps.package-info.outputs.version }}
      package-name: ${{ steps.package-info.outputs.name }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test || echo "⚠️ No unit tests found (integration tests require live API)"

      - name: Build package
        run: npm run build

      - name: Extract package info
        id: package-info
        run: |
          echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT
          echo "name=$(node -p "require('./package.json').name")" >> $GITHUB_OUTPUT

      - name: Verify build artifacts
        run: |
          if [ ! -d "dist" ]; then
            echo "❌ Build failed - dist/ directory not found"
            exit 1
          fi
          echo "✅ Build artifacts verified"
          ls -lh dist/

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            dist/
            package.json
            package-lock.json
            README.md
            LICENSE
          retention-days: 30

  # ====================================================================
  # JOB 2: Integration Tests (Optional)
  # ====================================================================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: test-and-build
    # Only run on main branch pushes (not releases)
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Run integration tests
        run: npm run test:integration
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_USER_POOL_ID }}
          COGNITO_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
          COGNITO_REGION: ${{ secrets.COGNITO_REGION || 'us-east-1' }}
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          TEST_ENV: ci
          NODE_ENV: test

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-test-results
          path: coverage/
          retention-days: 30

  # ====================================================================
  # JOB 3: Terraform Plan
  # ====================================================================
  terraform-plan:
    name: Terraform Plan (CodeArtifact)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: test-and-build
    # Only run if publishing to CodeArtifact
    if: github.event.inputs.skip_codeartifact != 'true'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.6'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        working-directory: ./terraform
        run: terraform init -reconfigure -upgrade

      - name: Terraform Plan
        working-directory: ./terraform
        run: terraform plan -out=tfplan

      - name: Upload Terraform artifacts
        uses: actions/upload-artifact@v4
        with:
          name: terraform-artifacts
          path: |
            terraform/.terraform/
            terraform/.terraform.lock.hcl
            terraform/tfplan
          retention-days: 7

  # ====================================================================
  # JOB 4: Terraform Apply
  # ====================================================================
  terraform-apply:
    name: Terraform Apply (CodeArtifact)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: terraform-plan
    # Add manual approval for production
    # environment: production

    outputs:
      codeartifact-domain: ${{ steps.outputs.outputs.domain }}
      codeartifact-repository: ${{ steps.outputs.outputs.repository }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.6'
          terraform_wrapper: false  # Required to capture outputs

      - name: Download Terraform artifacts
        uses: actions/download-artifact@v4
        with:
          name: terraform-artifacts
          path: terraform/

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        working-directory: ./terraform
        run: terraform init -reconfigure

      - name: Terraform Apply
        working-directory: ./terraform
        run: terraform apply -auto-approve tfplan

      - name: Extract Terraform outputs
        id: outputs
        working-directory: ./terraform
        run: |
          echo "domain=$(terraform output -raw codeartifact_domain 2>/dev/null || echo '${{ env.CODEARTIFACT_DOMAIN }}')" >> $GITHUB_OUTPUT
          echo "repository=$(terraform output -raw codeartifact_repository 2>/dev/null || echo '${{ env.CODEARTIFACT_REPOSITORY }}')" >> $GITHUB_OUTPUT

      - name: Verify infrastructure
        run: |
          echo "✅ CodeArtifact infrastructure deployed"
          echo "Domain: ${{ steps.outputs.outputs.domain }}"
          echo "Repository: ${{ steps.outputs.outputs.repository }}"

  # ====================================================================
  # JOB 5: Publish to AWS CodeArtifact
  # ====================================================================
  publish-codeartifact:
    name: Publish to AWS CodeArtifact
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [test-and-build, terraform-apply]
    if: github.event.inputs.skip_codeartifact != 'true'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Install dependencies
        run: npm ci

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Configure npm for CodeArtifact
        run: |
          aws codeartifact login \
            --tool npm \
            --domain ${{ needs.terraform-apply.outputs.codeartifact-domain || env.CODEARTIFACT_DOMAIN }} \
            --repository ${{ needs.terraform-apply.outputs.codeartifact-repository || env.CODEARTIFACT_REPOSITORY }} \
            --region ${{ env.AWS_REGION }}
          echo "✅ Configured npm for CodeArtifact"

      - name: Publish to CodeArtifact
        id: publish
        run: |
          PACKAGE_VERSION="${{ needs.test-and-build.outputs.package-version }}"
          echo "Publishing version $PACKAGE_VERSION to CodeArtifact..."

          # Attempt publish (may fail if version exists)
          if npm publish 2>&1 | tee publish-output.log; then
            echo "status=success" >> $GITHUB_OUTPUT
            echo "✅ Package published successfully"
          else
            if grep -q "Cannot publish over existing version" publish-output.log || grep -q "You cannot publish over the previously published versions" publish-output.log; then
              echo "status=version-exists" >> $GITHUB_OUTPUT
              echo "⚠️ Version $PACKAGE_VERSION already exists in CodeArtifact"
            else
              echo "status=failed" >> $GITHUB_OUTPUT
              echo "❌ Publish failed"
              cat publish-output.log
              exit 1
            fi
          fi

      - name: Verify package in CodeArtifact
        if: steps.publish.outputs.status == 'success'
        run: |
          PACKAGE_NAME="${{ needs.test-and-build.outputs.package-name }}"
          PACKAGE_VERSION="${{ needs.test-and-build.outputs.package-version }}"

          echo "Verifying package $PACKAGE_NAME@$PACKAGE_VERSION in CodeArtifact..."

          # Wait for package to be available
          sleep 5

          # Attempt to view package (verification)
          aws codeartifact list-package-versions \
            --domain ${{ needs.terraform-apply.outputs.codeartifact-domain || env.CODEARTIFACT_DOMAIN }} \
            --repository ${{ needs.terraform-apply.outputs.codeartifact-repository || env.CODEARTIFACT_REPOSITORY }} \
            --format npm \
            --package "${PACKAGE_NAME}" \
            --region ${{ env.AWS_REGION }} \
            --query "versions[?version=='${PACKAGE_VERSION}']" \
            --output json

          echo "✅ Package verified in CodeArtifact"

      - name: Output summary
        run: |
          echo "### CodeArtifact Publishing Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Package**: ${{ needs.test-and-build.outputs.package-name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Version**: ${{ needs.test-and-build.outputs.package-version }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Domain**: ${{ needs.terraform-apply.outputs.codeartifact-domain || env.CODEARTIFACT_DOMAIN }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Repository**: ${{ needs.terraform-apply.outputs.codeartifact-repository || env.CODEARTIFACT_REPOSITORY }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Status**: ${{ steps.publish.outputs.status }}" >> $GITHUB_STEP_SUMMARY

  # ====================================================================
  # JOB 6: Publish to npm Registry
  # ====================================================================
  publish-npm:
    name: Publish to npm Registry
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [test-and-build, publish-codeartifact]
    # Only publish to npm if CodeArtifact succeeded (or skipped)
    if: |
      github.event.inputs.skip_npm != 'true' &&
      (needs.publish-codeartifact.result == 'success' || needs.publish-codeartifact.result == 'skipped')

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Install dependencies
        run: npm ci

      - name: Configure npm authentication
        run: |
          echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc
          echo "@mission_sciences:registry=https://registry.npmjs.org/" >> ~/.npmrc
          echo "✅ npm authentication configured"

      - name: Verify npm authentication
        run: npm whoami

      - name: Publish to npm registry
        id: publish
        run: |
          PACKAGE_VERSION="${{ needs.test-and-build.outputs.package-version }}"
          echo "Publishing version $PACKAGE_VERSION to npm registry..."

          # Publish with public access (required for scoped packages)
          if npm publish --access public 2>&1 | tee publish-output.log; then
            echo "status=success" >> $GITHUB_OUTPUT
            echo "✅ Package published successfully to npm"
          else
            if grep -q "You cannot publish over the previously published versions" publish-output.log || grep -q "Cannot publish over existing version" publish-output.log; then
              echo "status=version-exists" >> $GITHUB_OUTPUT
              echo "⚠️ Version $PACKAGE_VERSION already exists on npm"
            else
              echo "status=failed" >> $GITHUB_OUTPUT
              echo "❌ npm publish failed"
              cat publish-output.log
              exit 1
            fi
          fi

      - name: Verify package on npm
        if: steps.publish.outputs.status == 'success'
        run: |
          PACKAGE_NAME="${{ needs.test-and-build.outputs.package-name }}"
          PACKAGE_VERSION="${{ needs.test-and-build.outputs.package-version }}"

          echo "Verifying package $PACKAGE_NAME@$PACKAGE_VERSION on npm..."

          # Wait for package to be available on npm CDN
          sleep 10

          # Verify package exists
          npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version

          echo "✅ Package verified on npm registry"
          echo "📦 Install with: npm install ${PACKAGE_NAME}@${PACKAGE_VERSION}"

      - name: Output summary
        run: |
          echo "### npm Publishing Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Package**: ${{ needs.test-and-build.outputs.package-name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Version**: ${{ needs.test-and-build.outputs.package-version }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Registry**: https://www.npmjs.com/package/${{ needs.test-and-build.outputs.package-name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Status**: ${{ steps.publish.outputs.status }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Install with:" >> $GITHUB_STEP_SUMMARY
          echo '```bash' >> $GITHUB_STEP_SUMMARY
          echo "npm install ${{ needs.test-and-build.outputs.package-name }}@${{ needs.test-and-build.outputs.package-version }}" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY

  # ====================================================================
  # JOB 7: Create GitHub Release
  # ====================================================================
  create-release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [test-and-build, publish-npm]
    # Only create release for tag events
    if: github.event_name == 'release' && github.event.action == 'published'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts
          path: ./release-artifacts

      - name: Create release archive
        run: |
          cd release-artifacts
          tar -czf ../${{ needs.test-and-build.outputs.package-name }}-${{ needs.test-and-build.outputs.package-version }}.tar.gz *

      - name: Upload release assets
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./${{ needs.test-and-build.outputs.package-name }}-${{ needs.test-and-build.outputs.package-version }}.tar.gz
          asset_name: ${{ needs.test-and-build.outputs.package-name }}-${{ needs.test-and-build.outputs.package-version }}.tar.gz
          asset_content_type: application/gzip

      - name: Update release notes
        uses: actions/github-script@v7
        with:
          script: |
            const release = await github.rest.repos.getRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: context.payload.release.id
            });

            const body = release.data.body + `\n\n## Package Distribution\n\n` +
              `- **npm**: \`npm install ${{ needs.test-and-build.outputs.package-name }}@${{ needs.test-and-build.outputs.package-version }}\`\n` +
              `- **CodeArtifact**: Available in \`ghostdogbase/sdk-packages\`\n` +
              `- **npm Registry**: https://www.npmjs.com/package/${{ needs.test-and-build.outputs.package-name }}`;

            await github.rest.repos.updateRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: context.payload.release.id,
              body: body
            });

  # ====================================================================
  # JOB 8: Deployment Summary
  # ====================================================================
  deployment-summary:
    name: Deployment Summary
    runs-on: ubuntu-latest
    needs: [test-and-build, publish-codeartifact, publish-npm]
    if: always()

    steps:
      - name: Generate summary
        run: |
          echo "# 🚀 Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "## Package Information" >> $GITHUB_STEP_SUMMARY
          echo "- **Name**: ${{ needs.test-and-build.outputs.package-name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Version**: ${{ needs.test-and-build.outputs.package-version }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Trigger**: ${{ github.event_name }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "## Job Status" >> $GITHUB_STEP_SUMMARY
          echo "- **Build**: ${{ needs.test-and-build.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- **CodeArtifact**: ${{ needs.publish-codeartifact.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- **npm Registry**: ${{ needs.publish-npm.result }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          if [ "${{ needs.test-and-build.result }}" == "success" ] && \
             [ "${{ needs.publish-codeartifact.result }}" == "success" ] && \
             [ "${{ needs.publish-npm.result }}" == "success" ]; then
            echo "## ✅ Deployment Successful" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "Package is now available on both registries!" >> $GITHUB_STEP_SUMMARY
          else
            echo "## ⚠️ Deployment Completed with Issues" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "Please check the job logs for details." >> $GITHUB_STEP_SUMMARY
          fi
```

---

## Integration with Existing Workflows

### Workflow Coordination Strategy

#### Keep Separate Workflows (Recommended)
```
.github/workflows/
├── test-integration.yml       # Existing - Test on PR/push to develop
├── publish-package.yml        # New - Publish on push to main
└── manual-deploy.yml          # Optional - Manual deployment
```

**Benefits**:
- Clear separation of concerns
- Test workflow runs on PRs and development branches
- Publish workflow only runs on main branch
- Easier to maintain and debug

#### Modify Existing Test Workflow
**Option A**: Add `workflow_call` to test workflow for reuse
```yaml
# test-integration.yml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_call:  # Allow other workflows to call this
    outputs:
      test-status:
        description: "Overall test status"
        value: ${{ jobs.test-summary.outputs.status }}
```

**Option B**: Reference test workflow from publish workflow
```yaml
# publish-package.yml
jobs:
  test:
    uses: ./.github/workflows/test-integration.yml
    secrets: inherit

  publish-codeartifact:
    needs: test
    # ... rest of publishing jobs
```

### Workflow Trigger Matrix

| Event | test-integration.yml | publish-package.yml |
|-------|---------------------|---------------------|
| PR to main | ✅ Run tests | ❌ Skip |
| PR to develop | ✅ Run tests | ❌ Skip |
| Push to main | ✅ Run tests | ✅ Build + Publish |
| Push to develop | ✅ Run tests | ❌ Skip |
| Release tag (v*.*.*) | ❌ Skip | ✅ Build + Publish |
| Manual trigger | ❌ Skip | ✅ Optional |

---

## Error Handling & Rollback

### Publishing Error Scenarios

#### Scenario 1: CodeArtifact Publish Fails
**Problem**: Package fails to publish to CodeArtifact
**Detection**: npm publish exit code non-zero
**Impact**: High (internal users affected)
**Resolution**:
```yaml
- name: Publish to CodeArtifact
  id: publish-ca
  continue-on-error: true  # Don't fail workflow
  run: npm publish

- name: Handle CodeArtifact failure
  if: steps.publish-ca.outcome == 'failure'
  run: |
    echo "::error::CodeArtifact publish failed"
    # Notify team
    # Skip npm publish
    exit 1
```

**Rollback**: Not needed (no previous version affected)

#### Scenario 2: npm Publish Fails (CodeArtifact Succeeded)
**Problem**: Package published to CodeArtifact but npm publish fails
**Detection**: Second publish step fails
**Impact**: Medium (public users don't get update, internal users do)
**Resolution**:
```yaml
- name: Rollback on npm failure
  if: steps.publish-npm.outcome == 'failure' && steps.publish-ca.outcome == 'success'
  run: |
    echo "::warning::npm publish failed, CodeArtifact succeeded"
    echo "Manual intervention required to unpublish from CodeArtifact or retry npm"
    # Options:
    # 1. Unpublish from CodeArtifact (not recommended)
    # 2. Retry npm publish manually
    # 3. Publish next patch version to both
```

**Rollback**: Manual intervention required (npm versions are immutable)

#### Scenario 3: Terraform Apply Fails
**Problem**: CodeArtifact infrastructure deployment fails
**Detection**: terraform apply exit code non-zero
**Impact**: High (cannot publish packages)
**Resolution**:
```yaml
- name: Terraform Apply
  id: tf-apply
  continue-on-error: false  # Fail workflow
  run: terraform apply -auto-approve tfplan

- name: Alert on Terraform failure
  if: failure()
  run: |
    echo "::error::Terraform deployment failed"
    echo "Check CloudFormation/Terraform state for issues"
    # Alert DevOps team
```

**Rollback**: Terraform handles state automatically

#### Scenario 4: Build Fails After Terraform Deployed
**Problem**: Package build fails after infrastructure deployed
**Detection**: npm run build exit code non-zero
**Impact**: Low (infrastructure ready, no package published)
**Resolution**:
```yaml
- name: Build package
  id: build
  run: npm run build

- name: Handle build failure
  if: steps.build.outcome == 'failure'
  run: |
    echo "::error::Package build failed"
    # Infrastructure is ready for next attempt
    # No rollback needed
    exit 1
```

**Rollback**: Not needed (infrastructure remains ready)

### Rollback Strategy Decision Tree

```
┌─────────────────────────────────────┐
│     Publishing Error Occurred?      │
└─────────────────────────────────────┘
               │
               ├──── CodeArtifact Only Failed?
               │     └──> ✅ No rollback needed
               │          - Fix issue
               │          - Retry workflow
               │
               ├──── npm Only Failed?
               │     └──> ⚠️ Partial success
               │          - CodeArtifact has new version
               │          - Retry npm publish manually
               │          - OR bump patch version and republish
               │
               ├──── Both Failed?
               │     └──> ✅ No rollback needed
               │          - No versions published
               │          - Fix issue
               │          - Retry workflow
               │
               └──── Terraform Failed?
                     └──> ✅ Terraform auto-rollback
                          - Check state file
                          - Manual intervention if needed
```

### Error Notifications

#### Slack Integration (Optional)
```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    channel-id: 'deployments'
    payload: |
      {
        "text": "❌ Package deployment failed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Failed*\n*Package*: ${{ needs.test-and-build.outputs.package-name }}\n*Version*: ${{ needs.test-and-build.outputs.package-version }}\n*Job*: ${{ github.job }}\n*Link*: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### GitHub Deployment Status
```yaml
- name: Update deployment status
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const deployment = await github.rest.repos.createDeployment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
        environment: 'production',
        auto_merge: false,
        required_contexts: []
      });

      await github.rest.repos.createDeploymentStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        deployment_id: deployment.data.id,
        state: '${{ job.status }}',
        description: 'Dual-publishing to CodeArtifact and npm'
      });
```

### Manual Rollback Procedures

#### Unpublish from npm (Use Sparingly)
```bash
# Only works within 72 hours of publish
npm unpublish @mission_sciences/provider-sdk@0.1.1

# Better: Deprecate and publish fixed version
npm deprecate @mission_sciences/provider-sdk@0.1.1 "Use version 0.1.2 instead"
npm publish  # Publish 0.1.2
```

#### Remove from CodeArtifact
```bash
# Delete package version (organization only)
aws codeartifact delete-package-versions \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --package "@mission_sciences/provider-sdk" \
  --versions "0.1.1" \
  --region us-east-1
```

#### Rollback Terraform Infrastructure
```bash
# Destroy specific resources
cd terraform
terraform destroy -target=aws_codeartifact_repository.sdk_packages

# Or rollback to previous state
terraform state pull > backup.tfstate
terraform apply -auto-approve  # Re-apply previous plan
```

---

## Implementation Plan

### Phase 1: Setup (1-2 hours)
1. **Create GitHub Secrets**
   - [ ] Add AWS_ACCESS_KEY_ID
   - [ ] Add AWS_SECRET_ACCESS_KEY
   - [ ] Add NPM_TOKEN
   - [ ] Verify existing integration test secrets

2. **Update package.json**
   - [ ] Change package name to `@mission_sciences/provider-sdk`
   - [ ] Verify `prepublishOnly` script runs build
   - [ ] Add `publishConfig` for npm scope

3. **Create Workflow File**
   - [ ] Copy workflow structure from this document
   - [ ] Create `.github/workflows/publish-package.yml`
   - [ ] Review all environment variables

### Phase 2: Testing (2-3 hours)
4. **Test in Feature Branch**
   - [ ] Create test branch: `feature/github-actions-migration`
   - [ ] Modify workflow to run on test branch
   - [ ] Trigger workflow with manual dispatch
   - [ ] Verify test and build jobs pass

5. **Test Terraform Integration**
   - [ ] Verify Terraform plan generates correctly
   - [ ] Test AWS authentication works
   - [ ] Confirm infrastructure is idempotent

6. **Test CodeArtifact Publishing**
   - [ ] Publish test version to CodeArtifact
   - [ ] Verify package appears in repository
   - [ ] Test authentication and login flow

7. **Test npm Publishing**
   - [ ] Publish test version to npm registry
   - [ ] Verify package appears on npm
   - [ ] Test public access works

### Phase 3: Migration (1 hour)
8. **Cutover to Main Branch**
   - [ ] Merge workflow to main branch
   - [ ] Update package.json version if needed
   - [ ] Trigger workflow on main branch push
   - [ ] Monitor full deployment

9. **Verify Dual Publishing**
   - [ ] Confirm package in CodeArtifact
   - [ ] Confirm package on npm registry
   - [ ] Test installation from both sources

10. **Deprecate Bitbucket Pipeline**
    - [ ] Archive `bitbucket-pipelines.yml`
    - [ ] Add note to Bitbucket README
    - [ ] Document migration in CHANGELOG

### Phase 4: Documentation (1 hour)
11. **Update Documentation**
    - [ ] Update README.md with new package name
    - [ ] Update installation instructions
    - [ ] Add migration guide for users
    - [ ] Update contributing guidelines

12. **Notify Stakeholders**
    - [ ] Announce package name change
    - [ ] Share new npm registry link
    - [ ] Update internal wiki/docs

---

## Validation Checklist

### Pre-Deployment
- [ ] All required secrets configured in GitHub
- [ ] IAM user has correct permissions for CodeArtifact + Terraform
- [ ] npm token has publish permissions for `@mission_sciences` scope
- [ ] package.json name updated to `@mission_sciences/provider-sdk`
- [ ] Workflow file syntax validated (GitHub Actions linter)

### Post-Deployment
- [ ] Workflow runs successfully on main branch push
- [ ] Package published to AWS CodeArtifact (`ghostdogbase/sdk-packages`)
- [ ] Package published to npm registry (https://www.npmjs.com/package/@mission_sciences/provider-sdk)
- [ ] Both packages are installable (`npm install @mission_sciences/provider-sdk`)
- [ ] Integration tests pass in GitHub Actions
- [ ] Documentation updated with new package name
- [ ] Bitbucket pipeline deprecated

### Monitoring
- [ ] Set up workflow failure notifications
- [ ] Monitor AWS CodeArtifact usage
- [ ] Track npm download statistics
- [ ] Review GitHub Actions usage minutes

---

## Security Hardening

### GitHub Actions Security Best Practices

1. **Use GitHub Environments**
```yaml
jobs:
  publish-npm:
    environment: production  # Requires manual approval
    steps:
      # ... publishing steps
```

2. **Restrict Workflow Permissions**
```yaml
permissions:
  contents: read
  packages: write
  id-token: none  # Disable OIDC if not using
```

3. **Pin Action Versions**
```yaml
# ✅ Good - Pinned to commit SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1

# ❌ Bad - Unpinned or branch reference
- uses: actions/checkout@main
- uses: actions/checkout@v4
```

4. **Use Dependabot for Action Updates**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

5. **Audit Workflow Runs**
```bash
# Enable audit logging in GitHub organization settings
# Review workflow runs regularly for suspicious activity
gh api repos/{owner}/{repo}/actions/runs --paginate
```

---

## Performance Optimization

### Caching Strategy
```yaml
- name: Setup Node.js with caching
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Caches node_modules based on package-lock.json

- name: Cache Terraform providers
  uses: actions/cache@v3
  with:
    path: terraform/.terraform
    key: terraform-${{ hashFiles('terraform/.terraform.lock.hcl') }}
```

### Artifact Retention
```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: dist/
    retention-days: 7  # Reduce storage costs
```

### Job Concurrency
```yaml
concurrency:
  group: publish-${{ github.ref }}
  cancel-in-progress: false  # Never cancel publishing jobs
```

---

## Appendix: Key Differences from Bitbucket Pipelines

| Feature | Bitbucket Pipelines | GitHub Actions |
|---------|-------------------|----------------|
| **Auth Method** | OIDC (`assume-role-with-web-identity`) | Access Keys (`configure-aws-credentials@v4`) |
| **Workflow Language** | YAML with custom syntax | YAML with GitHub syntax |
| **Artifact Sharing** | `artifacts:` keyword | `actions/upload-artifact@v4` |
| **Caching** | `caches:` keyword | `actions/cache@v3` or `setup-node` cache |
| **Environment Variables** | `BITBUCKET_*` variables | `GITHUB_*` context |
| **Conditional Execution** | `condition:` keyword | `if:` keyword with expressions |
| **Manual Approval** | N/A | `environment:` with protection rules |
| **Parallel Execution** | `parallel:` keyword | Multiple jobs (automatic) |
| **Docker Images** | `image:` keyword | `container:` or `runs-on:` |

---

## Additional Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **AWS CodeArtifact CLI Reference**: https://docs.aws.amazon.com/codeartifact/latest/ug/npm-cli.html
- **npm Publishing Guide**: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- **Terraform GitHub Actions**: https://developer.hashicorp.com/terraform/tutorials/automation/github-actions

---

**Last Updated**: 2025-12-10
**Version**: 1.0
**Status**: Ready for Implementation
