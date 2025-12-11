# GitHub Repository Setup Guide

## Step-by-Step Setup Instructions

### Phase 1: Create GitHub Repository

1. **Navigate to Mission-Sciences Organization**
   - URL: https://github.com/Mission-Sciences
   - Ensure you have admin permissions

2. **Create New Repository**
   - Click "New repository"
   - Repository name: `provider-sdk`
   - Description: "Provider SDK for JWT-based marketplace session management"
   - Visibility: **Public**
   - ❌ DO NOT initialize with README, .gitignore, or license (we'll push existing)

3. **Configure Repository Settings**
   - Navigate to: Settings → General
   - Features:
     - ✅ Issues enabled
     - ✅ Projects enabled (optional)
     - ✅ Wiki disabled
     - ✅ Discussions disabled
   - Pull Requests:
     - ✅ Allow squash merging
     - ✅ Allow merge commits
     - ❌ Allow rebase merging
     - ✅ Automatically delete head branches

4. **Set Up Branch Protection (main branch)**
   - Navigate to: Settings → Branches → Add rule
   - Branch name pattern: `main`
   - Protection rules:
     - ✅ Require a pull request before merging
     - ✅ Require approvals: 1
     - ✅ Dismiss stale pull request approvals when new commits are pushed
     - ✅ Require status checks to pass before merging
       - Required checks: `test-and-build`, `integration-tests`
     - ✅ Require conversation resolution before merging
     - ✅ Require linear history
     - ✅ Include administrators (recommended)

### Phase 2: Configure GitHub Secrets

Navigate to: Settings → Secrets and variables → Actions → New repository secret

#### AWS Secrets (for CodeArtifact + Terraform)

1. **AWS_ACCESS_KEY_ID**
   - Description: IAM user access key for CodeArtifact publishing
   - Value: `AKIAxxxxxxxxxxxxxxxxxx` (20 chars)
   - How to get:
     ```bash
     # AWS CLI method
     aws iam create-access-key --user-name github-actions-publisher
     ```
   - Or: AWS Console → IAM → Users → [username] → Security credentials → Create access key

2. **AWS_SECRET_ACCESS_KEY**
   - Description: IAM user secret key for CodeArtifact publishing
   - Value: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (40 chars)
   - Same source as AWS_ACCESS_KEY_ID
   - **Security**: Store securely - cannot be retrieved after creation

3. **AWS_REGION** (optional)
   - Description: AWS region for CodeArtifact
   - Value: `us-east-1`
   - Note: Can use environment variable in workflow instead

#### npm Secret (for npm Registry)

4. **NPM_TOKEN**
   - Description: npm access token for @mission_sciences org
   - Value: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (starts with `npm_`)
   - How to generate:

     **Option A: npm CLI**
     ```bash
     npm login --scope=@mission_sciences
     npm token create --read-only=false
     ```

     **Option B: npm Website**
     - Go to: https://www.npmjs.com/settings/mission_sciences/tokens
     - Click "Generate New Token"
     - Token Type: **Automation** (recommended) or **Granular**
     - If Granular:
       - Expiration: No expiration or custom
       - Packages and scopes: Select `@mission_sciences` scope
       - Permissions: Publish
     - Copy token immediately (shown only once)

#### Integration Test Secrets (if not already set)

5. **API_BASE_URL**
   - Value: `https://api.generalwisdom.com` (or your API endpoint)

6. **COGNITO_USER_POOL_ID**
   - Value: `us-east-1_xxxxxxxxx`

7. **COGNITO_CLIENT_ID**
   - Value: `xxxxxxxxxxxxxxxxxxxx`

8. **COGNITO_REGION** (optional)
   - Value: `us-east-1`

9. **TEST_USERNAME**
   - Value: `test@example.com` (your test user email)

10. **TEST_PASSWORD**
    - Value: `YourSecureTestPassword123!`

### Phase 3: Push Code to GitHub

From your local gw-sdk directory:

```bash
# Add GitHub remote
git remote add github https://github.com/Mission-Sciences/provider-sdk.git

# Or if you want to replace origin:
git remote rename origin bitbucket
git remote add origin https://github.com/Mission-Sciences/provider-sdk.git

# Verify remotes
git remote -v

# Push all branches and tags
git push github main
git push github --all
git push github --tags

# Or if you renamed origin:
git push origin main
git push origin --all
git push origin --tags
```

**Alternative: Complete Migration**
```bash
# Rename Bitbucket remote to backup
git remote rename origin bitbucket-backup

# Add GitHub as primary origin
git remote add origin https://github.com/Mission-Sciences/provider-sdk.git

# Push everything
git push -u origin main
git push origin --all
git push origin --tags

# Verify
git remote -v
```

### Phase 4: Verify Setup

1. **Check Repository Access**
   - Visit: https://github.com/Mission-Sciences/provider-sdk
   - Verify public visibility
   - Check README displays correctly

2. **Verify Branch Protection**
   - Settings → Branches
   - Confirm `main` has protection rules

3. **Verify Secrets**
   - Settings → Secrets and variables → Actions
   - Confirm all secrets are listed (values hidden)
   - Count: Should have 10 secrets minimum

4. **Check GitHub Actions**
   - Navigate to: Actions tab
   - Should see workflows listed:
     - "SDK Integration Tests" (existing)
     - "Build and Publish Package" (new)

### Phase 5: Test Workflow (Optional Dry Run)

Before production publish, test the workflow:

1. **Create Test Branch**
   ```bash
   git checkout -b test/workflow-validation
   ```

2. **Modify Workflow for Dry Run**
   - Edit `.github/workflows/publish-package.yml`
   - Change publish commands to dry-run:
     ```yaml
     # In publish-codeartifact job
     - name: Publish to CodeArtifact
       run: npm publish --dry-run

     # In publish-npm job
     - name: Publish to npm
       run: npm publish --dry-run
     ```

3. **Push Test Branch**
   ```bash
   git add .github/workflows/publish-package.yml
   git commit -m "test: workflow validation with dry-run"
   git push github test/workflow-validation
   ```

4. **Manual Trigger**
   - GitHub → Actions → "Build and Publish Package" → "Run workflow"
   - Select branch: `test/workflow-validation`
   - Check "Skip CodeArtifact publish": Yes
   - Check "Skip npm publish": Yes
   - Click "Run workflow"

5. **Monitor Execution**
   - Watch job progress in Actions tab
   - Verify all steps complete successfully
   - Check for any error messages

6. **Clean Up Test**
   ```bash
   git checkout main
   git branch -D test/workflow-validation
   git push github :test/workflow-validation
   ```

## IAM User Setup (AWS)

### Required IAM Policy

Create IAM user `github-actions-publisher` with this policy:

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
        "codeartifact:ReadFromRepository"
      ],
      "Resource": [
        "arn:aws:codeartifact:us-east-1:*:domain/ghostdogbase",
        "arn:aws:codeartifact:us-east-1:*:repository/ghostdogbase/sdk-packages",
        "arn:aws:codeartifact:us-east-1:*:package/ghostdogbase/sdk-packages/*"
      ]
    },
    {
      "Sid": "STSGetServiceBearerToken",
      "Effect": "Allow",
      "Action": "sts:GetServiceBearerToken",
      "Resource": "*"
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
        "codeartifact:ListDomains"
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
    }
  ]
}
```

### Create IAM User

```bash
# Create user
aws iam create-user --user-name github-actions-publisher

# Attach policy (after creating policy above)
aws iam attach-user-policy \
  --user-name github-actions-publisher \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/GitHubActionsCodeArtifactPublish

# Create access key
aws iam create-access-key --user-name github-actions-publisher
```

## npm Organization Setup

### Verify Organization Exists

1. Visit: https://www.npmjs.com/org/mission_sciences
2. Ensure you have owner/admin permissions
3. Check scope: `@mission_sciences` is available

### Create npm Token

**Via npm CLI:**
```bash
# Login
npm login --scope=@mission_sciences

# Create token
npm token create --read-only=false

# List tokens (verify creation)
npm token list
```

**Via npm Website:**
1. Go to: https://www.npmjs.com/settings/mission_sciences/tokens
2. Click "Generate New Token"
3. Select token type: **Automation** (recommended)
4. Copy token immediately
5. Add to GitHub secrets

## Troubleshooting

### Issue: Repository Creation Fails
- Verify Mission-Sciences org exists
- Check permissions (must be org admin)
- Try different repository name if collision

### Issue: Secrets Not Working
- Verify secret names match workflow file exactly (case-sensitive)
- Re-create secret if values incorrect
- Check AWS IAM permissions for access key
- Verify npm token not expired

### Issue: Workflow Fails to Trigger
- Check branch protection rules
- Verify workflow file syntax: `yamllint .github/workflows/publish-package.yml`
- Check workflow triggers match your push pattern
- Review Actions tab for error messages

### Issue: CodeArtifact Publish Fails
- Verify AWS credentials in secrets
- Check IAM policy permissions
- Test CodeArtifact login locally:
  ```bash
  aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages
  ```
- Review CloudTrail logs for permission errors

### Issue: npm Publish Fails
- Verify NPM_TOKEN in secrets
- Check token permissions on npm website
- Test locally:
  ```bash
  echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc
  npm publish --dry-run
  ```
- Verify package name available: `npm view @mission_sciences/provider-sdk`

## Security Checklist

- ✅ GitHub repository is public (intended)
- ✅ AWS credentials stored as secrets (not in code)
- ✅ npm token stored as secrets (not in code)
- ✅ Branch protection enabled on main
- ✅ Require PR reviews before merge
- ✅ IAM user has least-privilege permissions
- ✅ npm token is automation type (not personal)
- ✅ No secrets in git history
- ✅ .gitignore includes `.env`, `*.pem`, `keys/`

## Post-Setup Validation

Run this checklist after setup:

```bash
# 1. Verify repository exists
curl -I https://github.com/Mission-Sciences/provider-sdk

# 2. Verify GitHub Actions workflows
gh workflow list --repo Mission-Sciences/provider-sdk

# 3. Test AWS credentials locally (optional)
aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages

# 4. Verify npm package name available
npm view @mission_sciences/provider-sdk
# Should return: npm ERR! code E404 (expected before first publish)

# 5. Check branch protection
gh api repos/Mission-Sciences/provider-sdk/branches/main/protection
```

All steps complete? Proceed to production publishing! 🚀
