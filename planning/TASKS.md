# Implementation Task List: gw-sdk Migration to GitHub

**Project**: gw-sdk Package Migration
**Type**: Brownfield Enhancement - Repository Migration + Dual-Publishing
**Version**: 0.1.1 (maintained during migration)

---

## Executive Summary

This task list provides ordered implementation steps for migrating `@marketplace/provider-sdk` from Bitbucket to GitHub as `@mission_sciences/provider-sdk` with dual-publishing to npm registry and AWS CodeArtifact.

**Critical Path Duration**: 8-12 hours (excluding waiting periods for access approvals)
**Risk Level**: Medium (requires careful coordination of authentication and publishing)
**Rollback Complexity**: Low (can revert to Bitbucket pipeline if needed)

---

## Phase 1: Pre-Migration Setup & Access Verification

### Task 1.1: GitHub Organization Access Verification
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: None
**Owner**: Project Lead

**Actions**:
1. Verify access to Mission-Sciences GitHub organization
2. Confirm repository creation permissions
3. Verify GitHub Actions usage is enabled for organization

**Required Permissions**:
- Admin or Owner role in Mission-Sciences GitHub org
- Ability to create public repositories

**Verification Steps**:
```bash
# Navigate to GitHub
https://github.com/orgs/Mission-Sciences/repositories

# Verify you can click "New repository" button
# Confirm GitHub Actions tab is visible in organization settings
```

**Rollback**: N/A (read-only verification)

**Risk Mitigation**:
- Complete this task before proceeding to avoid blocking later steps
- If access is missing, request from organization admin immediately

---

### Task 1.2: npm Registry Access Setup
**Complexity**: Low | **Duration**: 20 minutes | **Dependencies**: Task 1.1
**Owner**: DevOps Engineer

**Actions**:
1. Verify access to npm `mission_sciences` organization
2. Create npm access token with publish permissions
3. Document token storage location for GitHub Secrets

**Required Permissions**:
- Member of `mission_sciences` npm organization
- Ability to create automation tokens

**Verification Steps**:
```bash
# Login to npm
npm login

# Verify organization membership
npm org ls mission_sciences

# Create automation token (do NOT commit this)
npm token create --type automation

# Test token locally
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" > .npmrc.test
npm whoami
rm .npmrc.test
```

**Output**:
- `NPM_TOKEN` value ready for GitHub Secrets
- Documented in secure location (password manager)

**Rollback**: Revoke token if created incorrectly

**Risk Mitigation**:
- Use automation token type (not classic token)
- Set token expiration to 90 days initially
- Document token rotation procedure

---

### Task 1.3: AWS CodeArtifact Authentication Review
**Complexity**: Low | **Duration**: 20 minutes | **Dependencies**: None
**Owner**: DevOps Engineer

**Actions**:
1. Review current AWS authentication method (OIDC vs. IAM keys)
2. Verify CodeArtifact repository access (`ghostdogbase/sdk-packages`)
3. Prepare AWS credentials for GitHub Actions

**Required Permissions**:
- AWS IAM access to view roles and policies
- CodeArtifact domain access verification

**Verification Steps**:
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Verify CodeArtifact access
aws codeartifact list-repositories --domain ghostdogbase --region us-east-1

# Test publish permissions (dry run)
aws codeartifact get-authorization-token \
  --domain ghostdogbase \
  --domain-owner <account-id> \
  --region us-east-1 \
  --query authorizationToken \
  --output text
```

**Output**:
- AWS credentials ready for GitHub Secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_DEFAULT_REGION` (us-east-1)

**Rollback**: N/A (read-only verification)

**Risk Mitigation**:
- Prefer IAM user with minimal permissions (CodeArtifact publish only)
- Consider using OIDC for GitHub Actions in future iteration
- Document credential rotation schedule

---

## Phase 2: Local Package Configuration Updates

### Task 2.1: Update package.json Configuration
**Complexity**: Low | **Duration**: 10 minutes | **Dependencies**: None
**Owner**: Developer

**Actions**:
1. Change package name from `@marketplace/provider-sdk` to `@mission_sciences/provider-sdk`
2. Update package description if needed
3. Add repository field pointing to GitHub
4. Update author field
5. Verify all export paths still reference correct build outputs

**Files Modified**:
- `/Users/patrick.henry/dev/gw-sdk/package.json`

**Changes**:
```json
{
  "name": "@mission_sciences/provider-sdk",
  "version": "0.1.1",
  "description": "Provider SDK for JWT-based marketplace session management",
  "repository": {
    "type": "git",
    "url": "https://github.com/Mission-Sciences/provider-sdk.git"
  },
  "bugs": {
    "url": "https://github.com/Mission-Sciences/provider-sdk/issues"
  },
  "homepage": "https://github.com/Mission-Sciences/provider-sdk#readme",
  "author": "Mission Sciences",
  "license": "MIT"
}
```

**Verification Steps**:
```bash
cd /Users/patrick.henry/dev/gw-sdk
npm run build
npm pack --dry-run

# Verify tarball name is correct
# Expected: mission_sciences-provider-sdk-0.1.1.tgz
```

**Rollback**:
```bash
git checkout package.json
```

**Risk Mitigation**:
- Create feature branch before making changes
- Verify build still succeeds after name change
- Test local installation with updated name

---

### Task 2.2: Update Build Output Filenames
**Complexity**: Medium | **Duration**: 30 minutes | **Dependencies**: Task 2.1
**Owner**: Developer

**Actions**:
1. Update `vite.config.ts` to generate correctly named output files
2. Update `package.json` main/module/types paths if build output names change
3. Rebuild and verify all entry points work

**Files Modified**:
- `/Users/patrick.henry/dev/gw-sdk/vite.config.ts`
- `/Users/patrick.henry/dev/gw-sdk/package.json` (if needed)

**Current Build Outputs**:
- `marketplace-sdk.umd.js`
- `marketplace-sdk.es.js`

**Decision Point**: Keep existing filenames or rename to `mission-sciences-sdk.*`?
**Recommendation**: Keep existing filenames to avoid breaking existing consumers during transition

**Verification Steps**:
```bash
npm run build
ls -la dist/

# Expected output files:
# - marketplace-sdk.umd.js
# - marketplace-sdk.es.js
# - index.d.ts

npm run test
npm run lint
```

**Rollback**:
```bash
git checkout vite.config.ts package.json
npm run build
```

**Risk Mitigation**:
- Keeping existing build filenames reduces migration impact
- Document filename strategy in README
- Consider renaming in future major version

---

### Task 2.3: Update Documentation Files
**Complexity**: Medium | **Duration**: 45 minutes | **Dependencies**: Task 2.1
**Owner**: Technical Writer / Developer

**Actions**:
1. Update all npm install commands to use new package name
2. Update repository links to GitHub
3. Update organization references
4. Add migration guide for existing users

**Files Modified**:
- `/Users/patrick.henry/dev/gw-sdk/README.md`
- `/Users/patrick.henry/dev/gw-sdk/docs/INTEGRATION_GUIDE.md`
- `/Users/patrick.henry/dev/gw-sdk/docs/QUICKSTART.md`
- `/Users/patrick.henry/dev/gw-sdk/docs/TESTING_GUIDE.md`
- `/Users/patrick.henry/dev/gw-sdk/docs/VALIDATION.md`

**Search and Replace**:
```bash
# Find all occurrences of old package name
grep -r "@marketplace/provider-sdk" ./*.md ./docs/*.md

# Replace with new package name
# OLD: npm install @marketplace/provider-sdk
# NEW: npm install @mission_sciences/provider-sdk
```

**New Section to Add to README.md**:
```markdown
## Migration from @marketplace/provider-sdk

This package was previously published as `@marketplace/provider-sdk` on AWS CodeArtifact.

**Migration Steps**:
1. Uninstall old package: `npm uninstall @marketplace/provider-sdk`
2. Install new package: `npm install @mission_sciences/provider-sdk`
3. Update imports in your code:
   - No code changes needed - API remains identical
   - Only package name changes in package.json

**Version Compatibility**:
- v0.1.1 is functionally identical between old and new package names
- All features, APIs, and behaviors are preserved
```

**Verification Steps**:
```bash
# Verify no references to old package name remain
grep -r "@marketplace/provider-sdk" README.md docs/

# Verify all code examples are syntactically correct
npm run lint
```

**Rollback**:
```bash
git checkout README.md docs/
```

**Risk Mitigation**:
- Keep a MIGRATION.md document with detailed transition steps
- Document support period for old package name
- Add deprecation notice to old package in CodeArtifact

---

### Task 2.4: Create Changelog Entry
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 2.3
**Owner**: Developer

**Actions**:
1. Create or update CHANGELOG.md
2. Document package name change
3. Document new publishing targets

**Files Created/Modified**:
- `/Users/patrick.henry/dev/gw-sdk/CHANGELOG.md`

**Changelog Content**:
```markdown
# Changelog

## [0.1.1] - 2024-12-10

### Changed
- **BREAKING**: Package name changed from `@marketplace/provider-sdk` to `@mission_sciences/provider-sdk`
- Repository migrated from Bitbucket to GitHub (https://github.com/Mission-Sciences/provider-sdk)
- Package now published to npm registry in addition to AWS CodeArtifact

### Migration Guide
See README.md for detailed migration instructions from the old package name.

### Note
This version is functionally identical to the previous 0.1.1 release. Only the package name and distribution channels have changed.
```

**Verification Steps**:
```bash
cat CHANGELOG.md
# Verify formatting is correct
```

**Rollback**:
```bash
git checkout CHANGELOG.md
```

---

## Phase 3: GitHub Repository Setup

### Task 3.1: Create GitHub Repository
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 1.1
**Owner**: Project Lead

**Actions**:
1. Create public repository at `https://github.com/Mission-Sciences/provider-sdk`
2. Add repository description
3. Initialize with README (or push existing code)
4. Configure repository settings

**Repository Settings**:
- **Name**: `provider-sdk`
- **Description**: "Provider SDK for JWT-based marketplace session management"
- **Visibility**: Public
- **License**: MIT
- **Features**:
  - Issues: Enabled
  - Projects: Disabled (optional)
  - Wiki: Disabled
  - Discussions: Optional

**Verification Steps**:
```bash
# Verify repository is accessible
curl -I https://github.com/Mission-Sciences/provider-sdk

# Expected: 200 OK (even if empty initially)
```

**Rollback**: Delete repository if created incorrectly

**Risk Mitigation**:
- Verify repository name matches package.json before proceeding
- Set up branch protection rules before pushing code

---

### Task 3.2: Configure GitHub Repository Settings
**Complexity**: Low | **Duration**: 20 minutes | **Dependencies**: Task 3.1
**Owner**: DevOps Engineer

**Actions**:
1. Configure branch protection rules for `main` branch
2. Set up required status checks
3. Configure merge options
4. Set up repository secrets

**Branch Protection Rules**:
```yaml
Branch: main
Protection Rules:
  - Require pull request reviews: No (for initial setup, enable later)
  - Require status checks to pass: Yes
    - Required checks: "test" (will be defined in workflow)
  - Require branches to be up to date: Yes
  - Require linear history: No
  - Include administrators: No
```

**Repository Secrets** (Settings → Secrets and variables → Actions):
1. `AWS_ACCESS_KEY_ID` - From Task 1.3
2. `AWS_SECRET_ACCESS_KEY` - From Task 1.3
3. `AWS_DEFAULT_REGION` - `us-east-1`
4. `NPM_TOKEN` - From Task 1.2
5. `API_BASE_URL` - (for integration tests, copy from existing)
6. `COGNITO_USER_POOL_ID` - (for integration tests)
7. `COGNITO_CLIENT_ID` - (for integration tests)
8. `TEST_USERNAME` - (for integration tests)
9. `TEST_PASSWORD` - (for integration tests)

**Verification Steps**:
```bash
# Navigate to repository settings
https://github.com/Mission-Sciences/provider-sdk/settings

# Verify secrets are added (values will be hidden)
https://github.com/Mission-Sciences/provider-sdk/settings/secrets/actions
```

**Rollback**: Remove secrets if needed

**Risk Mitigation**:
- Double-check secret names match workflow file exactly
- Use GitHub environment secrets for production
- Document secret rotation procedures

---

### Task 3.3: Push Code to GitHub
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Tasks 2.1-2.4, Task 3.1
**Owner**: Developer

**Actions**:
1. Create feature branch with all changes
2. Add GitHub remote
3. Push code to GitHub
4. Verify all files are present

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Create feature branch
git checkout -b migration/github-dual-publish

# Stage all changes
git add package.json vite.config.ts README.md docs/ CHANGELOG.md

# Commit changes
git commit -m "feat: migrate package to @mission_sciences scope

- Change package name from @marketplace/provider-sdk to @mission_sciences/provider-sdk
- Update repository links to GitHub
- Update documentation with new package name
- Add migration guide for existing users"

# Add GitHub remote (if not already added)
git remote add github https://github.com/Mission-Sciences/provider-sdk.git

# Push to GitHub
git push -u github migration/github-dual-publish
```

**Verification Steps**:
```bash
# Verify code is on GitHub
https://github.com/Mission-Sciences/provider-sdk/tree/migration/github-dual-publish

# Verify all files are present
# - src/
# - tests/
# - docs/
# - package.json
# - README.md
# - CHANGELOG.md
```

**Rollback**:
```bash
# Delete remote branch if needed
git push github --delete migration/github-dual-publish
```

**Risk Mitigation**:
- Use feature branch initially (not main)
- Review all files before pushing
- Ensure sensitive files are in .gitignore

---

## Phase 4: GitHub Actions Workflow Implementation

### Task 4.1: Create GitHub Actions Workflow for Testing
**Complexity**: Medium | **Duration**: 45 minutes | **Dependencies**: Task 3.3
**Owner**: DevOps Engineer

**Actions**:
1. Review existing `.github/workflows/test-integration.yml`
2. Create enhanced workflow for comprehensive testing
3. Ensure workflow runs on PRs and pushes to main

**Files Created/Modified**:
- `/Users/patrick.henry/dev/gw-sdk/.github/workflows/test.yml`

**Workflow Content**:
```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test

      - name: Run integration tests
        run: npm run test:integration
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: ${{ secrets.AWS_DEFAULT_REGION }}
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_USER_POOL_ID }}
          COGNITO_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}

      - name: Build package
        run: npm run build

      - name: Test package installation
        run: |
          npm pack
          npm install -g ./mission_sciences-provider-sdk-*.tgz
```

**Verification Steps**:
```bash
# Push workflow file
git add .github/workflows/test.yml
git commit -m "feat: add comprehensive testing workflow"
git push github migration/github-dual-publish

# Verify workflow runs automatically
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/actions
```

**Rollback**:
```bash
git rm .github/workflows/test.yml
git commit -m "revert: remove test workflow"
git push github migration/github-dual-publish
```

**Risk Mitigation**:
- Test workflow locally with `act` if possible
- Start with simple workflow, add complexity iteratively
- Monitor first few runs for issues

---

### Task 4.2: Create GitHub Actions Workflow for Publishing
**Complexity**: High | **Duration**: 90 minutes | **Dependencies**: Task 4.1
**Owner**: DevOps Engineer

**Actions**:
1. Create dual-publish workflow (npm + CodeArtifact)
2. Configure triggers (manual + tag-based)
3. Add validation steps before publishing
4. Implement rollback mechanism

**Files Created**:
- `/Users/patrick.henry/dev/gw-sdk/.github/workflows/publish.yml`

**Workflow Content**:
```yaml
name: Publish Package

on:
  workflow_dispatch:
    inputs:
      publish-target:
        description: 'Publish target'
        required: true
        type: choice
        options:
          - npm-only
          - codeartifact-only
          - both
  push:
    tags:
      - 'v*'

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build

      - name: Verify package contents
        run: |
          npm pack --dry-run
          echo "Package size:"
          npm pack | wc -c

  publish-npm:
    needs: validate
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') ||
      (github.event_name == 'workflow_dispatch' &&
       (github.event.inputs.publish-target == 'npm-only' ||
        github.event.inputs.publish-target == 'both'))

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Verify npm publication
        run: |
          sleep 10
          npm view @mission_sciences/provider-sdk version

  publish-codeartifact:
    needs: validate
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') ||
      (github.event_name == 'workflow_dispatch' &&
       (github.event.inputs.publish-target == 'codeartifact-only' ||
        github.event.inputs.publish-target == 'both'))

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Configure CodeArtifact registry
        run: |
          aws codeartifact login \
            --tool npm \
            --domain ghostdogbase \
            --repository sdk-packages \
            --region us-east-1

      - name: Publish to CodeArtifact
        run: npm publish

      - name: Verify CodeArtifact publication
        run: |
          aws codeartifact list-package-versions \
            --domain ghostdogbase \
            --repository sdk-packages \
            --format npm \
            --namespace mission_sciences \
            --package provider-sdk \
            --region us-east-1
```

**Verification Steps**:
```bash
# Push workflow file
git add .github/workflows/publish.yml
git commit -m "feat: add dual-publish workflow"
git push github migration/github-dual-publish

# Test manual trigger (dry run)
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/actions
# Click "Publish Package" → "Run workflow"
# Select "npm-only" for initial test
```

**Rollback**:
- Unpublish from npm: `npm unpublish @mission_sciences/provider-sdk@0.1.1` (within 72 hours)
- CodeArtifact: Cannot unpublish, but can delete package version via AWS console

**Risk Mitigation**:
- Always test with manual trigger before tag-based automation
- Use `npm publish --dry-run` locally first
- Have rollback documentation ready
- Consider publishing to test registry first

---

### Task 4.3: Create Release Workflow
**Complexity**: Medium | **Duration**: 30 minutes | **Dependencies**: Task 4.2
**Owner**: DevOps Engineer

**Actions**:
1. Create workflow to automatically create GitHub releases
2. Generate release notes from commits
3. Attach build artifacts to releases

**Files Created**:
- `/Users/patrick.henry/dev/gw-sdk/.github/workflows/release.yml`

**Workflow Content**:
```yaml
name: Create Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create package tarball
        run: npm pack

      - name: Generate release notes
        id: release_notes
        run: |
          echo "RELEASE_NOTES<<EOF" >> $GITHUB_OUTPUT
          git log $(git describe --tags --abbrev=0 HEAD^)..HEAD --pretty=format:"- %s" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body: |
            ## Changes
            ${{ steps.release_notes.outputs.RELEASE_NOTES }}

            ## Installation
            ```bash
            npm install @mission_sciences/provider-sdk@${{ github.ref_name }}
            ```

            ## Published to
            - npm registry: https://www.npmjs.com/package/@mission_sciences/provider-sdk
            - AWS CodeArtifact: ghostdogbase/sdk-packages
          files: |
            mission_sciences-provider-sdk-*.tgz
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Verification Steps**:
```bash
# Workflow will trigger automatically on tag push
# Verify by checking: https://github.com/Mission-Sciences/provider-sdk/releases
```

**Rollback**:
- Delete GitHub release if created incorrectly
- Remove tag: `git push --delete github v0.1.1`

---

## Phase 5: Testing & Verification

### Task 5.1: Local Build and Publish Test
**Complexity**: Medium | **Duration**: 30 minutes | **Dependencies**: Tasks 2.1-2.4
**Owner**: Developer

**Actions**:
1. Clean build from scratch
2. Run all tests locally
3. Test package installation locally
4. Verify package contents

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Clean previous builds
rm -rf dist/ node_modules/ package-lock.json

# Fresh install
npm install

# Lint
npm run lint

# Test
npm run test
npm run test:coverage

# Build
npm run build

# Verify dist/ contents
ls -la dist/

# Create tarball
npm pack

# Test local installation
mkdir -p /tmp/test-install
cd /tmp/test-install
npm init -y
npm install /Users/patrick.henry/dev/gw-sdk/mission_sciences-provider-sdk-0.1.1.tgz

# Verify installed package
npm list @mission_sciences/provider-sdk
node -e "const sdk = require('@mission_sciences/provider-sdk'); console.log(sdk);"

# Cleanup
cd /Users/patrick.henry/dev/gw-sdk
rm -rf /tmp/test-install
```

**Verification Steps**:
- All tests pass (unit + integration)
- Build completes without errors
- Package installs locally without issues
- Package exports are accessible

**Rollback**: N/A (local testing only)

**Risk Mitigation**:
- Test in clean environment to catch missing dependencies
- Verify peer dependencies work correctly
- Test both CommonJS and ESM imports

---

### Task 5.2: Test Publishing to npm (Dry Run)
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 5.1
**Owner**: Developer

**Actions**:
1. Configure local npm authentication
2. Run publish in dry-run mode
3. Verify package contents and metadata

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Configure npm authentication (use token from Task 1.2)
npm config set //registry.npmjs.org/:_authToken YOUR_NPM_TOKEN

# Dry run publish
npm publish --dry-run --access public

# Review output carefully
# Expected output should show:
# - Package name: @mission_sciences/provider-sdk@0.1.1
# - Package size
# - Files included
# - No errors or warnings
```

**Verification Steps**:
- Dry run completes successfully
- Package size is reasonable (< 1MB)
- Correct files included (dist/, README.md, LICENSE)
- No sensitive files included

**Rollback**: N/A (dry run only)

**Risk Mitigation**:
- Never skip dry run before actual publish
- Review file list carefully to avoid leaking sensitive data
- Verify .npmignore or files field in package.json

---

### Task 5.3: Test Publishing to AWS CodeArtifact (Dry Run)
**Complexity**: Medium | **Duration**: 20 minutes | **Dependencies**: Task 5.1
**Owner**: DevOps Engineer

**Actions**:
1. Configure AWS credentials
2. Authenticate with CodeArtifact
3. Test publish (dry run if possible, or use test version)

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Configure AWS credentials
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1

# Login to CodeArtifact
aws codeartifact login \
  --tool npm \
  --domain ghostdogbase \
  --repository sdk-packages \
  --region us-east-1

# Verify authentication
cat ~/.npmrc | grep codeartifact

# Option 1: Dry run (if supported)
npm publish --dry-run

# Option 2: Publish test version (0.1.1-test.1)
# Update version temporarily
npm version 0.1.1-test.1 --no-git-tag-version
npm publish
npm version 0.1.1 --no-git-tag-version
git checkout package.json

# Verify CodeArtifact publication
aws codeartifact list-package-versions \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --namespace mission_sciences \
  --package provider-sdk \
  --region us-east-1
```

**Verification Steps**:
- Authentication succeeds
- Package appears in CodeArtifact repository
- Package metadata is correct
- Test version can be installed from CodeArtifact

**Rollback**:
- Delete test version from CodeArtifact:
```bash
aws codeartifact delete-package-versions \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --namespace mission_sciences \
  --package provider-sdk \
  --versions 0.1.1-test.1 \
  --region us-east-1
```

**Risk Mitigation**:
- Use test version numbers to avoid conflicts
- Verify CodeArtifact domain and repository names
- Test installation from CodeArtifact after publishing

---

### Task 5.4: GitHub Actions Workflow Testing
**Complexity**: Medium | **Duration**: 45 minutes | **Dependencies**: Tasks 4.1-4.3, Task 5.3
**Owner**: DevOps Engineer

**Actions**:
1. Create test PR to trigger test workflow
2. Manually trigger publish workflow (dry run target)
3. Verify all jobs complete successfully
4. Review logs for any issues

**Steps**:
```bash
# 1. Trigger test workflow via PR
cd /Users/patrick.henry/dev/gw-sdk
git checkout migration/github-dual-publish
git push github migration/github-dual-publish

# Create PR on GitHub
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/pulls
# Click "New pull request"
# Base: main, Compare: migration/github-dual-publish

# 2. Monitor test workflow
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/actions
# Wait for workflow to complete
# Review logs for each job

# 3. Test manual publish workflow
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/actions
# Click "Publish Package" workflow
# Click "Run workflow"
# Select branch: migration/github-dual-publish
# Select target: "npm-only" (for initial test)
# Click "Run workflow"

# 4. Monitor publish workflow execution
# Review validation job logs
# Review npm publish job logs (should complete successfully)
```

**Verification Steps**:
- Test workflow completes successfully
- All test jobs (lint, test, build) pass
- Integration tests pass with AWS credentials
- Publish workflow completes validation step
- npm publish (if executed) succeeds

**Rollback**:
- Close PR without merging if tests fail
- Investigate and fix workflow issues
- Re-push corrected workflow files

**Risk Mitigation**:
- Test workflows incrementally (test → publish-dry-run → publish-actual)
- Monitor GitHub Actions usage quotas
- Have rollback plan for failed publishes

---

### Task 5.5: End-to-End Integration Test
**Complexity**: Medium | **Duration**: 30 minutes | **Dependencies**: Task 5.4
**Owner**: QA Engineer / Developer

**Actions**:
1. Create test project consuming new package from npm
2. Verify all SDK features work correctly
3. Test both UMD and ES module imports
4. Validate TypeScript types

**Test Project Setup**:
```bash
# Create test project
mkdir -p /tmp/sdk-integration-test
cd /tmp/sdk-integration-test

npm init -y

# Install from npm (after successful publish)
npm install @mission_sciences/provider-sdk

# Create test file
cat > test.js << 'EOF'
// Test ES module import
import { validateToken } from '@mission_sciences/provider-sdk';

console.log('SDK imported successfully');
console.log('validateToken function:', typeof validateToken);
EOF

# Create CommonJS test
cat > test.cjs << 'EOF'
// Test CommonJS require
const sdk = require('@mission_sciences/provider-sdk');

console.log('SDK required successfully');
console.log('SDK exports:', Object.keys(sdk));
EOF

# Create TypeScript test
npm install -D typescript @types/node

cat > test.ts << 'EOF'
import { validateToken, JWTPayload } from '@mission_sciences/provider-sdk';

// Verify TypeScript types work
const testToken = async () => {
  try {
    const payload: JWTPayload = await validateToken('test-token', 'test-jwks-url');
    console.log('TypeScript types working correctly');
  } catch (error) {
    console.error('Test error (expected):', error.message);
  }
};

testToken();
EOF

npx tsc test.ts --esModuleInterop --module commonjs
node test.js

# Cleanup
rm -rf /tmp/sdk-integration-test
```

**Verification Steps**:
- Package installs without errors
- ES module imports work
- CommonJS requires work
- TypeScript types are available and correct
- All SDK functions are accessible
- Basic functionality works

**Rollback**: N/A (testing only)

**Risk Mitigation**:
- Test in multiple Node.js versions (18, 20)
- Test in different project types (CJS, ESM, TypeScript)
- Verify peer dependencies work correctly

---

## Phase 6: Production Deployment

### Task 6.1: Merge to Main Branch
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: All Phase 5 tasks
**Owner**: Project Lead

**Actions**:
1. Final review of all changes
2. Merge PR to main branch
3. Verify merge triggers workflows

**Steps**:
```bash
# Ensure all changes are committed and pushed
cd /Users/patrick.henry/dev/gw-sdk
git status

# Navigate to GitHub PR
# https://github.com/Mission-Sciences/provider-sdk/pulls

# Review all changes one final time
# Check "Files changed" tab
# Verify all tests passed
# Get approval from team members (if required)

# Merge PR
# Click "Merge pull request" → "Confirm merge"

# Delete feature branch
git branch -d migration/github-dual-publish
git push github --delete migration/github-dual-publish
```

**Verification Steps**:
- PR merged successfully
- Main branch contains all changes
- Test workflow triggered and passed

**Rollback**:
```bash
# Revert merge commit if needed
git revert -m 1 <merge-commit-hash>
git push github main
```

**Risk Mitigation**:
- Ensure all team members are aware of merge
- Have rollback plan ready
- Monitor post-merge for any issues

---

### Task 6.2: Create Release Tag
**Complexity**: Low | **Duration**: 10 minutes | **Dependencies**: Task 6.1
**Owner**: DevOps Engineer

**Actions**:
1. Create annotated git tag for version 0.1.1
2. Push tag to GitHub
3. Trigger release and publish workflows

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Ensure on main branch with latest changes
git checkout main
git pull github main

# Create annotated tag
git tag -a v0.1.1 -m "Release v0.1.1 - Initial public release

- Package renamed to @mission_sciences/provider-sdk
- Published to npm registry and AWS CodeArtifact
- Migrated from Bitbucket to GitHub

See CHANGELOG.md for full details."

# Push tag to GitHub
git push github v0.1.1
```

**Verification Steps**:
```bash
# Verify tag exists
git tag -l v0.1.1

# Check GitHub
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/tags

# Monitor workflows
# Navigate to: https://github.com/Mission-Sciences/provider-sdk/actions
# - Publish workflow should trigger automatically
# - Release workflow should create GitHub release
```

**Rollback**:
```bash
# Delete tag if needed
git tag -d v0.1.1
git push github --delete v0.1.1
```

**Risk Mitigation**:
- Use annotated tags (not lightweight tags)
- Include comprehensive tag message
- Monitor workflow execution carefully

---

### Task 6.3: Verify npm Publication
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 6.2
**Owner**: DevOps Engineer

**Actions**:
1. Verify package published to npm registry
2. Check package metadata and contents
3. Test installation from npm

**Commands**:
```bash
# Wait for publish workflow to complete (5-10 minutes)

# Check npm registry
npm view @mission_sciences/provider-sdk

# Expected output:
# - version: 0.1.1
# - description: Provider SDK for JWT-based marketplace session management
# - repository: https://github.com/Mission-Sciences/provider-sdk
# - license: MIT

# Test installation
mkdir -p /tmp/npm-test
cd /tmp/npm-test
npm init -y
npm install @mission_sciences/provider-sdk

# Verify installation
npm list @mission_sciences/provider-sdk
node -e "console.log(require('@mission_sciences/provider-sdk'))"

# Cleanup
rm -rf /tmp/npm-test

# Check npm package page
# Navigate to: https://www.npmjs.com/package/@mission_sciences/provider-sdk
```

**Verification Steps**:
- Package appears on npm registry
- Version is correct (0.1.1)
- Metadata is accurate
- Package installs successfully
- npm package page displays correctly

**Rollback**:
```bash
# Unpublish if needed (within 72 hours)
npm unpublish @mission_sciences/provider-sdk@0.1.1

# Or deprecate
npm deprecate @mission_sciences/provider-sdk@0.1.1 "Deprecated due to [reason]"
```

**Risk Mitigation**:
- Monitor npm package page for correct information
- Test installation immediately after publish
- Have support plan for users encountering issues

---

### Task 6.4: Verify AWS CodeArtifact Publication
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 6.2
**Owner**: DevOps Engineer

**Actions**:
1. Verify package published to CodeArtifact
2. Check package versions and metadata
3. Test installation from CodeArtifact

**Commands**:
```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1

# Check CodeArtifact
aws codeartifact list-package-versions \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --namespace mission_sciences \
  --package provider-sdk \
  --region us-east-1

# Expected output: version 0.1.1 listed

# Get package details
aws codeartifact describe-package \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --namespace mission_sciences \
  --package provider-sdk \
  --region us-east-1

# Test installation from CodeArtifact
mkdir -p /tmp/codeartifact-test
cd /tmp/codeartifact-test

# Login to CodeArtifact
aws codeartifact login \
  --tool npm \
  --domain ghostdogbase \
  --repository sdk-packages \
  --region us-east-1

# Install package
npm init -y
npm install @mission_sciences/provider-sdk

# Verify installation
npm list @mission_sciences/provider-sdk

# Cleanup
rm -rf /tmp/codeartifact-test
```

**Verification Steps**:
- Package version 0.1.1 appears in CodeArtifact
- Package metadata is correct
- Package installs successfully from CodeArtifact
- Old package name still works (if not deprecated yet)

**Rollback**:
```bash
# Delete package version if needed
aws codeartifact delete-package-versions \
  --domain ghostdogbase \
  --repository sdk-packages \
  --format npm \
  --namespace mission_sciences \
  --package provider-sdk \
  --versions 0.1.1 \
  --region us-east-1
```

**Risk Mitigation**:
- Verify both npm and CodeArtifact have same version
- Test installation from both registries
- Document registry selection for internal teams

---

### Task 6.5: Verify GitHub Release Creation
**Complexity**: Low | **Duration**: 10 minutes | **Dependencies**: Task 6.2
**Owner**: Project Lead

**Actions**:
1. Check GitHub releases page
2. Verify release notes
3. Download and verify attached artifacts

**Steps**:
```bash
# Navigate to releases page
# https://github.com/Mission-Sciences/provider-sdk/releases

# Verify release v0.1.1 exists with:
# - Release title: v0.1.1
# - Release notes: Auto-generated or from CHANGELOG
# - Attached artifacts: mission_sciences-provider-sdk-0.1.1.tgz

# Download tarball
cd /tmp
curl -LO https://github.com/Mission-Sciences/provider-sdk/releases/download/v0.1.1/mission_sciences-provider-sdk-0.1.1.tgz

# Verify tarball
tar -tzf mission_sciences-provider-sdk-0.1.1.tgz

# Expected contents:
# - package/dist/
# - package/README.md
# - package/package.json
# - package/LICENSE

rm mission_sciences-provider-sdk-0.1.1.tgz
```

**Verification Steps**:
- GitHub release exists for v0.1.1
- Release notes are accurate
- Tarball artifact is attached
- Tarball contains correct files

**Rollback**:
- Edit or delete GitHub release if incorrect
- Re-create release with corrected information

---

## Phase 7: Documentation & Communication

### Task 7.1: Update README with Migration Information
**Complexity**: Low | **Duration**: 20 minutes | **Dependencies**: Task 6.3
**Owner**: Technical Writer

**Actions**:
1. Add prominent migration notice to README
2. Update installation instructions
3. Add links to npm and GitHub

**Content to Add**:
```markdown
## Important: Package Name Change

This package was previously published as `@marketplace/provider-sdk` on AWS CodeArtifact.

**New Installation**:
```bash
npm install @mission_sciences/provider-sdk
```

**For Existing Users**:
If you were using the old package name, see the [Migration Guide](#migration-from-marketplaceprovider-sdk) below.

---

## Installation

### From npm Registry (Public)
```bash
npm install @mission_sciences/provider-sdk
```

### From AWS CodeArtifact (Private)
```bash
# Configure CodeArtifact
aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages

# Install package
npm install @mission_sciences/provider-sdk
```

---

## Links

- **npm**: https://www.npmjs.com/package/@mission_sciences/provider-sdk
- **GitHub**: https://github.com/Mission-Sciences/provider-sdk
- **Issues**: https://github.com/Mission-Sciences/provider-sdk/issues
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)
```

**Verification Steps**:
```bash
# Push updated README
git add README.md
git commit -m "docs: add migration notice and update installation"
git push github main
```

**Rollback**:
```bash
git revert HEAD
git push github main
```

---

### Task 7.2: Create Migration Guide Document
**Complexity**: Low | **Duration**: 30 minutes | **Dependencies**: Task 7.1
**Owner**: Technical Writer

**Actions**:
1. Create comprehensive MIGRATION.md document
2. Include step-by-step migration instructions
3. Document common issues and solutions
4. Add timeline and support information

**File Created**:
- `/Users/patrick.henry/dev/gw-sdk/MIGRATION.md`

**Content**:
```markdown
# Migration Guide: @marketplace/provider-sdk → @mission_sciences/provider-sdk

## Overview

The Provider SDK has been migrated from Bitbucket to GitHub and renamed from `@marketplace/provider-sdk` to `@mission_sciences/provider-sdk`.

**Key Changes**:
- Package name change
- Published to public npm registry (in addition to AWS CodeArtifact)
- Repository moved to GitHub
- No API changes - fully backward compatible

## Migration Steps

### Step 1: Update package.json

**Old**:
```json
{
  "dependencies": {
    "@marketplace/provider-sdk": "^0.1.1"
  }
}
```

**New**:
```json
{
  "dependencies": {
    "@mission_sciences/provider-sdk": "^0.1.1"
  }
}
```

### Step 2: Update Import Statements

**No changes needed!** The package exports remain identical:

```javascript
// These imports work exactly the same
import { validateToken } from '@mission_sciences/provider-sdk';
```

### Step 3: Reinstall Dependencies

```bash
# Remove old package
npm uninstall @marketplace/provider-sdk

# Install new package
npm install @mission_sciences/provider-sdk

# Or use npm registry directly
npm install @mission_sciences/provider-sdk --registry https://registry.npmjs.org
```

### Step 4: Update Registry Configuration (if needed)

If you were using AWS CodeArtifact exclusively, you can now choose:

**Option A: Use npm registry (public)**
```bash
# No special configuration needed
npm install @mission_sciences/provider-sdk
```

**Option B: Continue using CodeArtifact (private)**
```bash
aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages
npm install @mission_sciences/provider-sdk
```

## API Compatibility

**No breaking changes** - Version 0.1.1 under the new name is functionally identical to 0.1.1 under the old name.

All exports, functions, types, and behaviors remain the same.

## Timeline

- **December 10, 2024**: New package published to npm and CodeArtifact
- **December 31, 2024**: Old package deprecated on CodeArtifact
- **January 31, 2025**: Old package support ends

## Support

For migration assistance:
- GitHub Issues: https://github.com/Mission-Sciences/provider-sdk/issues
- Email: [support contact]

## FAQ

**Q: Do I need to change my code?**
A: No, only update package.json and reinstall dependencies.

**Q: Can I still use CodeArtifact?**
A: Yes, the new package is published to both npm and CodeArtifact.

**Q: What happens to the old package?**
A: It will be deprecated but remain available for 60 days.

**Q: Is there a performance difference?**
A: No, the package code is identical.
```

**Verification Steps**:
```bash
git add MIGRATION.md
git commit -m "docs: add migration guide"
git push github main
```

---

### Task 7.3: Deprecate Old Package on CodeArtifact
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: Task 6.4
**Owner**: DevOps Engineer

**Actions**:
1. Add deprecation notice to old package
2. Update CodeArtifact package description
3. Document deprecation timeline

**Commands**:
```bash
# Configure AWS
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1

# Login to CodeArtifact for old package
aws codeartifact login \
  --tool npm \
  --domain ghostdogbase \
  --repository sdk-packages \
  --region us-east-1

# Option 1: Use npm deprecate (if old package still configured)
npm deprecate @marketplace/provider-sdk "This package has been renamed to @mission_sciences/provider-sdk. Please migrate: https://github.com/Mission-Sciences/provider-sdk/blob/main/MIGRATION.md"

# Option 2: Update package metadata via AWS
# Note: May need to publish deprecation notice via package update
```

**Verification Steps**:
```bash
# Check deprecation notice
npm view @marketplace/provider-sdk

# Expected output should include deprecation warning
```

**Rollback**:
```bash
# Remove deprecation if needed
npm deprecate @marketplace/provider-sdk ""
```

**Risk Mitigation**:
- Provide clear migration path in deprecation message
- Include support contact information
- Set reasonable deprecation timeline

---

### Task 7.4: Announce Migration to Stakeholders
**Complexity**: Low | **Duration**: 30 minutes | **Dependencies**: Tasks 7.1-7.3
**Owner**: Project Lead / Product Manager

**Actions**:
1. Create announcement email/message
2. Notify all known package consumers
3. Update internal documentation
4. Post announcement in relevant channels

**Communication Template**:
```
Subject: Provider SDK Package Name Change - Action Required

Dear Team,

The Provider SDK has been migrated to a new GitHub repository and npm package name.

**What's Changing**:
- Package Name: @marketplace/provider-sdk → @mission_sciences/provider-sdk
- Repository: Bitbucket → GitHub (https://github.com/Mission-Sciences/provider-sdk)
- Registry: AWS CodeArtifact + npm registry (public)

**Action Required**:
1. Update your package.json to use @mission_sciences/provider-sdk
2. Reinstall dependencies
3. See full migration guide: https://github.com/Mission-Sciences/provider-sdk/blob/main/MIGRATION.md

**Timeline**:
- Now: New package available on npm and CodeArtifact
- Dec 31, 2024: Old package deprecated
- Jan 31, 2025: Old package support ends

**No Code Changes**: The API remains exactly the same - only the package name changes.

**Support**:
- Migration Guide: https://github.com/Mission-Sciences/provider-sdk/blob/main/MIGRATION.md
- GitHub Issues: https://github.com/Mission-Sciences/provider-sdk/issues
- Contact: [support contact]

Thank you for your cooperation.

Best regards,
[Your Name]
```

**Distribution Channels**:
- Email to known package consumers
- Slack/Teams announcement
- Internal wiki/documentation update
- Project management tools (Jira, etc.)

**Verification Steps**:
- Announcement sent to all stakeholders
- Confirmation received from key consumers
- Internal documentation updated

---

## Phase 8: Bitbucket Deprecation

### Task 8.1: Archive Bitbucket Pipeline
**Complexity**: Low | **Duration**: 15 minutes | **Dependencies**: All Phase 6 tasks
**Owner**: DevOps Engineer

**Actions**:
1. Disable Bitbucket pipeline
2. Archive bitbucket-pipelines.yml
3. Add README notice to Bitbucket repository

**Steps**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Rename bitbucket-pipelines.yml to mark as archived
git mv bitbucket-pipelines.yml bitbucket-pipelines.yml.archived

# Add note to Bitbucket README
cat > README.bitbucket.md << 'EOF'
# ARCHIVED: This repository has been migrated to GitHub

This repository is no longer actively maintained.

**New Location**: https://github.com/Mission-Sciences/provider-sdk

**New Package Name**: `@mission_sciences/provider-sdk`

Please update your dependencies and switch to the GitHub repository.

See [Migration Guide](https://github.com/Mission-Sciences/provider-sdk/blob/main/MIGRATION.md) for details.
EOF

git add bitbucket-pipelines.yml.archived README.bitbucket.md
git commit -m "chore: archive Bitbucket pipeline after GitHub migration"
git push origin main  # Push to Bitbucket
```

**Verification Steps**:
- Bitbucket pipeline no longer triggers on push
- README notice visible on Bitbucket repository
- Archived pipeline file preserved for reference

**Rollback**:
```bash
# Restore pipeline if needed
git mv bitbucket-pipelines.yml.archived bitbucket-pipelines.yml
git rm README.bitbucket.md
git commit -m "revert: restore Bitbucket pipeline"
git push origin main
```

---

### Task 8.2: Update Bitbucket Repository Settings
**Complexity**: Low | **Duration**: 10 minutes | **Dependencies**: Task 8.1
**Owner**: Project Lead

**Actions**:
1. Mark Bitbucket repository as archived (if possible)
2. Update repository description
3. Disable new branches/PRs (if possible)

**Settings to Update**:
- **Description**: "ARCHIVED - Migrated to GitHub: https://github.com/Mission-Sciences/provider-sdk"
- **Website**: `https://github.com/Mission-Sciences/provider-sdk`
- **Branching Model**: Disable if possible
- **Pipeline**: Already disabled in Task 8.1

**Verification Steps**:
- Repository description shows migration notice
- Website link points to GitHub
- No new development happening on Bitbucket

---

## Phase 9: Monitoring & Validation

### Task 9.1: Set Up Package Download Monitoring
**Complexity**: Low | **Duration**: 20 minutes | **Dependencies**: Task 6.3
**Owner**: DevOps Engineer

**Actions**:
1. Monitor npm download statistics
2. Track CodeArtifact usage
3. Set up alerts for issues

**Monitoring Setup**:
```bash
# npm download stats
# Visit: https://npm-stat.com/charts.html?package=@mission_sciences/provider-sdk

# Or use npm API
curl https://api.npmjs.org/downloads/point/last-week/@mission_sciences/provider-sdk

# CodeArtifact metrics via AWS CloudWatch
# Set up dashboard in AWS Console for:
# - Package download counts
# - Error rates
# - Storage usage
```

**Metrics to Track**:
- npm downloads per day/week
- CodeArtifact downloads
- Package installation errors
- GitHub issues related to migration
- Old package deprecation warnings triggered

**Verification Steps**:
- Download statistics accessible
- Metrics dashboard configured
- Alerts set up for anomalies

---

### Task 9.2: Monitor GitHub Issues and Discussions
**Complexity**: Low | **Duration**: Ongoing | **Dependencies**: Task 7.4
**Owner**: Support Team / Project Lead

**Actions**:
1. Monitor GitHub issues for migration problems
2. Respond to user questions quickly
3. Document common issues and solutions
4. Update FAQ as needed

**Monitoring Checklist**:
- [ ] Check GitHub issues daily for migration-related problems
- [ ] Respond to issues within 24 hours
- [ ] Update MIGRATION.md with newly discovered issues
- [ ] Track successful migrations vs. problems

**Common Issues to Watch For**:
- TypeScript type resolution problems
- Registry configuration issues
- Dependency conflicts
- Build errors after package update

**Verification Steps**:
- Issues are being monitored
- Response time is reasonable
- Documentation is being updated

---

### Task 9.3: Performance and Error Monitoring
**Complexity**: Medium | **Duration**: 30 minutes | **Dependencies**: Task 6.3
**Owner**: DevOps Engineer

**Actions**:
1. Set up error tracking (if applicable)
2. Monitor package installation failures
3. Track registry availability
4. Document and investigate anomalies

**Monitoring Tools**:
- **npm Registry**: Check https://status.npmjs.org/ for outages
- **CodeArtifact**: Monitor via AWS CloudWatch
- **GitHub Actions**: Track workflow failure rates
- **Package Stats**: Monitor download trends

**Alerts to Configure**:
- Package installation failures spike
- npm registry unavailable
- CodeArtifact authentication failures
- GitHub Actions workflow failures

**Verification Steps**:
- Monitoring tools configured
- Alerts are triggering correctly
- Team is notified of issues promptly

---

## Phase 10: Post-Migration Cleanup

### Task 10.1: Remove Old Package References
**Complexity**: Low | **Duration**: 30 minutes | **Dependencies**: All Phase 7 tasks
**Owner**: Developer

**Actions**:
1. Search codebase for any remaining old package references
2. Update any missed documentation
3. Clean up old configuration files

**Commands**:
```bash
cd /Users/patrick.henry/dev/gw-sdk

# Search for old package name
grep -r "@marketplace/provider-sdk" . --exclude-dir=node_modules --exclude-dir=.git

# Expected: No results (or only in archived/migration docs)

# Check for old registry configurations
grep -r "codeartifact" . --exclude-dir=node_modules --exclude-dir=.git

# Update any found references
```

**Files to Check**:
- README.md
- All docs/ files
- package.json scripts
- Test files
- Example projects
- Configuration files

**Verification Steps**:
- No unexpected references to old package name
- All documentation uses new package name
- All links point to GitHub

---

### Task 10.2: Update Internal Documentation
**Complexity**: Low | **Duration**: 45 minutes | **Dependencies**: Task 10.1
**Owner**: Technical Writer

**Actions**:
1. Update company/team wikis
2. Update onboarding documentation
3. Update development guides
4. Archive old documentation

**Documentation to Update**:
- Internal wiki pages
- Developer onboarding guides
- Architecture documentation
- API documentation sites
- Training materials

**Verification Steps**:
- All internal docs updated
- Old docs archived or removed
- Links redirected to new locations

---

### Task 10.3: Conduct Post-Migration Review
**Complexity**: Low | **Duration**: 60 minutes | **Dependencies**: All previous tasks
**Owner**: Project Lead + Team

**Actions**:
1. Review migration success metrics
2. Identify lessons learned
3. Document best practices
4. Plan improvements for future migrations

**Review Agenda**:
1. **Metrics Review**:
   - Migration timeline vs. plan
   - Number of issues encountered
   - User adoption rate
   - Support requests volume

2. **Lessons Learned**:
   - What went well?
   - What could be improved?
   - Unexpected challenges?
   - Effective strategies?

3. **Documentation**:
   - Were migration docs sufficient?
   - What additional resources were needed?
   - User feedback on documentation

4. **Process Improvements**:
   - Updates to migration playbook
   - Tool improvements
   - Communication strategies

**Deliverables**:
- Post-migration report document
- Updated migration playbook for future use
- Team retrospective notes

---

## Appendix A: Rollback Procedures

### Emergency Rollback Plan

If critical issues are discovered post-migration, follow this rollback procedure:

**Step 1: Assess Impact**
- Determine severity of issue
- Identify affected users
- Decide if rollback is necessary

**Step 2: Communication**
- Notify stakeholders immediately
- Explain issue and rollback plan
- Set expectations for resolution timeline

**Step 3: Technical Rollback**

```bash
# 1. Deprecate new package on npm
npm deprecate @mission_sciences/provider-sdk "Temporarily deprecated due to [issue]. Use @marketplace/provider-sdk from CodeArtifact."

# 2. Re-enable Bitbucket pipeline
cd /Users/patrick.henry/dev/gw-sdk
git mv bitbucket-pipelines.yml.archived bitbucket-pipelines.yml
git rm README.bitbucket.md
git commit -m "revert: restore Bitbucket pipeline"
git push origin main

# 3. Remove GitHub releases (if needed)
# Via GitHub web UI or gh CLI

# 4. Notify users
# Send rollback communication to all stakeholders
```

**Step 4: Root Cause Analysis**
- Investigate issue thoroughly
- Document findings
- Plan fix implementation

**Step 5: Re-Migration**
- Fix identified issues
- Test more thoroughly
- Re-execute migration plan

---

## Appendix B: Required Access and Permissions

### GitHub
- [ ] Admin or Owner role in Mission-Sciences organization
- [ ] Ability to create public repositories
- [ ] Ability to manage GitHub Secrets
- [ ] Ability to configure branch protection rules

### npm Registry
- [ ] Member of `mission_sciences` npm organization
- [ ] Ability to create automation tokens
- [ ] Ability to publish packages

### AWS
- [ ] IAM credentials with CodeArtifact access
- [ ] Permissions for `codeartifact:PublishPackageVersion`
- [ ] Permissions for `codeartifact:GetAuthorizationToken`
- [ ] Access to `ghostdogbase` domain and `sdk-packages` repository

### Bitbucket (for archival)
- [ ] Admin access to existing Bitbucket repository
- [ ] Ability to disable pipelines
- [ ] Ability to update repository settings

---

## Appendix C: Risk Matrix

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| npm publish fails | Medium | High | Test with dry run, have rollback ready | DevOps |
| CodeArtifact authentication issues | Medium | Medium | Test auth thoroughly, document troubleshooting | DevOps |
| Breaking change introduced | Low | High | Comprehensive testing, version pinning | Developer |
| Users miss migration notice | High | Medium | Multi-channel communication, deprecation warnings | PM |
| Old package used by mistake | High | Low | Deprecation warnings, clear documentation | PM |
| GitHub Actions workflow failure | Medium | Medium | Test workflows incrementally, monitoring | DevOps |
| Package name typo/conflict | Low | High | Verify name availability before publishing | Developer |
| Documentation incomplete | Medium | Medium | Peer review, user testing | Tech Writer |

---

## Appendix D: Communication Timeline

### Pre-Migration (1 week before)
- [ ] Announce upcoming migration to team
- [ ] Share migration guide draft for feedback
- [ ] Identify all package consumers

### Migration Day
- [ ] Internal team notification (migration starting)
- [ ] Execute technical migration
- [ ] Publish new package
- [ ] Announce completion to stakeholders

### Post-Migration
- **Day 1**: Monitor for immediate issues, respond to questions
- **Day 3**: Send reminder to teams that haven't migrated yet
- **Week 1**: Share migration success metrics
- **Week 2**: Identify any stragglers, offer migration assistance
- **Month 1**: Deprecate old package
- **Month 2**: End support for old package

---

## Appendix E: Verification Checklist

Use this checklist to verify successful migration completion:

### Package Configuration
- [ ] package.json updated with new name
- [ ] Repository field points to GitHub
- [ ] Build completes successfully
- [ ] All tests pass
- [ ] Package tarball contains correct files

### GitHub Setup
- [ ] Repository created and accessible
- [ ] Branch protection rules configured
- [ ] Secrets added and verified
- [ ] Code pushed to repository
- [ ] Workflows executing successfully

### Publishing
- [ ] Package published to npm registry
- [ ] Package published to AWS CodeArtifact
- [ ] GitHub release created
- [ ] All publications have correct metadata

### Documentation
- [ ] README updated
- [ ] MIGRATION.md created
- [ ] CHANGELOG.md updated
- [ ] All docs reference new package name
- [ ] Migration guide comprehensive

### Communication
- [ ] Stakeholders notified
- [ ] Migration guide distributed
- [ ] Old package deprecated
- [ ] Support channels ready

### Monitoring
- [ ] Download statistics tracking
- [ ] Error monitoring configured
- [ ] GitHub issues being monitored
- [ ] Metrics dashboard set up

### Cleanup
- [ ] Bitbucket pipeline archived
- [ ] Bitbucket repository marked as archived
- [ ] Old package references removed
- [ ] Internal documentation updated

---

## Summary

This migration plan provides a comprehensive, ordered approach to migrating the gw-sdk package from Bitbucket to GitHub with dual-publishing. The 10-phase approach ensures:

1. **Minimal Risk**: Extensive testing and validation at each phase
2. **Clear Communication**: Stakeholders informed throughout process
3. **Easy Rollback**: Documented procedures for reverting changes
4. **Quality Assurance**: Multiple verification steps prevent issues
5. **Complete Documentation**: Comprehensive guides for all users

**Estimated Total Duration**: 12-16 hours (across multiple days for testing and validation periods)

**Critical Success Factors**:
- Thorough testing before production deployment
- Clear communication to all stakeholders
- Monitoring and quick response to issues
- Comprehensive documentation

**Next Steps**:
1. Review and approve this plan
2. Assign tasks to team members
3. Schedule migration timeline
4. Begin Phase 1: Pre-Migration Setup
