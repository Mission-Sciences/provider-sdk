# gw-sdk Migration Checklist

## Pre-Migration Verification

### ☐ Prerequisites Confirmed
- [ ] Access to Mission-Sciences GitHub organization (admin)
- [ ] Access to mission_sciences npm organization (owner/admin)
- [ ] AWS IAM user created with CodeArtifact permissions
- [ ] AWS access keys generated
- [ ] npm automation token generated
- [ ] Local build passes: `npm run build`
- [ ] Local tests pass: `npm test`

### ☐ Planning Documents Reviewed
- [ ] REQUIREMENTS.md reviewed and approved
- [ ] CI_CD_ARCHITECTURE.md reviewed and understood
- [ ] TASKS.md reviewed for implementation steps
- [ ] Team notified of migration timeline

## Phase 1: GitHub Repository Setup (1 hour)

### ☐ Repository Creation
- [ ] GitHub repository created: `Mission-Sciences/provider-sdk`
- [ ] Repository visibility: Public
- [ ] Description added
- [ ] Topics/tags added (optional)
- [ ] Repository URL verified: https://github.com/Mission-Sciences/provider-sdk

### ☐ Repository Settings
- [ ] Issues enabled
- [ ] Wiki disabled
- [ ] Discussions disabled
- [ ] Projects enabled (optional)
- [ ] Squash merging allowed
- [ ] Auto-delete head branches enabled

### ☐ Branch Protection
- [ ] Branch protection rule created for `main`
- [ ] Require pull request reviews: 1 approval
- [ ] Require status checks: `test-and-build`, `integration-tests`
- [ ] Require conversation resolution
- [ ] Require linear history
- [ ] Include administrators

### ☐ GitHub Secrets Configured
- [ ] AWS_ACCESS_KEY_ID added
- [ ] AWS_SECRET_ACCESS_KEY added
- [ ] AWS_REGION added (or using default us-east-1)
- [ ] NPM_TOKEN added
- [ ] API_BASE_URL added (integration tests)
- [ ] COGNITO_USER_POOL_ID added (integration tests)
- [ ] COGNITO_CLIENT_ID added (integration tests)
- [ ] COGNITO_REGION added (integration tests)
- [ ] TEST_USERNAME added (integration tests)
- [ ] TEST_PASSWORD added (integration tests)

### ☐ Secret Verification
- [ ] Secret count: 10 minimum
- [ ] AWS credentials tested locally (optional):
  ```bash
  aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages
  ```
- [ ] npm token tested locally (optional):
  ```bash
  echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" > .npmrc
  npm publish --dry-run
  ```

## Phase 2: Code Migration (2 hours)

### ☐ Local Changes Committed
- [ ] package.json updated with new scope
- [ ] README.md updated with migration guide
- [ ] INTEGRATION_GUIDE.md updated
- [ ] QUICKSTART.md reviewed (no changes needed)
- [ ] TESTING_GUIDE.md reviewed (no changes needed)
- [ ] GitHub Actions workflow created: `.github/workflows/publish-package.yml`
- [ ] All changes committed to local git
- [ ] Commit message: "chore: migrate to @mission_sciences scope and GitHub"

### ☐ Build Verification
- [ ] Clean build: `npm run build`
- [ ] Build output verified in `dist/`:
  - `marketplace-sdk.es.js` exists
  - `marketplace-sdk.umd.js` exists
  - `index.d.ts` exists
- [ ] Package tarball created: `npm pack --dry-run`
- [ ] Tarball size reasonable (< 150KB)

### ☐ Test Verification
- [ ] Unit tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Integration tests pass locally (if possible): `npm run test:integration`

### ☐ Git Push to GitHub
- [ ] Remote added: `git remote add github https://github.com/Mission-Sciences/provider-sdk.git`
- [ ] Main branch pushed: `git push github main`
- [ ] All branches pushed: `git push github --all`
- [ ] All tags pushed: `git push github --tags`
- [ ] Code visible on GitHub: https://github.com/Mission-Sciences/provider-sdk

## Phase 3: Workflow Testing (2 hours)

### ☐ Workflow Files Visible
- [ ] `.github/workflows/publish-package.yml` visible on GitHub
- [ ] `.github/workflows/test-integration.yml` visible on GitHub
- [ ] GitHub Actions tab shows both workflows

### ☐ Test Workflow Created (Optional Dry Run)
- [ ] Test branch created: `test/workflow-validation`
- [ ] Workflow modified for dry-run (skip publish steps)
- [ ] Test branch pushed to GitHub
- [ ] Workflow manually triggered from Actions tab
- [ ] All jobs completed successfully:
  - [ ] test-and-build ✅
  - [ ] integration-tests ✅ (or skipped)
  - [ ] terraform-plan ✅
  - [ ] terraform-apply ✅
  - [ ] publish-codeartifact ✅ (dry-run)
  - [ ] publish-npm ✅ (dry-run)
  - [ ] deployment-summary ✅
- [ ] Workflow logs reviewed for errors
- [ ] Test branch deleted after validation

### ☐ Workflow Syntax Validation
- [ ] YAML syntax valid: `yamllint .github/workflows/publish-package.yml`
- [ ] No obvious errors in workflow file
- [ ] Job dependencies correct (needs: clauses)
- [ ] Artifact upload/download pairs match

## Phase 4: Production Publish (1 hour)

### ☐ Pre-Publish Verification
- [ ] All previous phases complete
- [ ] No pending changes in local git
- [ ] Branch is `main`
- [ ] GitHub secrets all configured
- [ ] AWS IAM permissions verified
- [ ] npm token permissions verified
- [ ] Team notified of imminent publish

### ☐ Trigger Production Publish
**Method 1: Push to main (recommended)**
- [ ] Latest changes on main branch
- [ ] Push to GitHub: `git push github main`
- [ ] Workflow automatically triggered

**Method 2: Manual dispatch**
- [ ] GitHub Actions → "Build and Publish Package" → "Run workflow"
- [ ] Branch: `main`
- [ ] Skip CodeArtifact: No
- [ ] Skip npm: No
- [ ] Workflow triggered manually

**Method 3: Release tag**
- [ ] Tag created: `git tag v0.1.1`
- [ ] Tag pushed: `git push github v0.1.1`
- [ ] Workflow triggered by tag

### ☐ Monitor Workflow Execution
- [ ] Workflow started in Actions tab
- [ ] `test-and-build` job completed ✅
- [ ] `integration-tests` job completed ✅ (or skipped)
- [ ] `terraform-plan` job completed ✅
- [ ] `terraform-apply` job completed ✅
- [ ] `publish-codeartifact` job completed ✅
- [ ] `publish-npm` job completed ✅
- [ ] `create-release` job completed ✅ (if tag push)
- [ ] `deployment-summary` job completed ✅
- [ ] Total workflow time: ~8-12 minutes

### ☐ Publication Verification

**CodeArtifact Verification:**
- [ ] Package published to CodeArtifact:
  ```bash
  aws codeartifact list-packages \
    --domain ghostdogbase \
    --repository sdk-packages \
    --region us-east-1
  ```
- [ ] Package version 0.1.1 visible
- [ ] Package name: `@mission_sciences/provider-sdk`

**npm Registry Verification:**
- [ ] Package visible on npm: https://www.npmjs.com/package/@mission_sciences/provider-sdk
- [ ] Version 0.1.1 published
- [ ] README displayed correctly
- [ ] Package metadata correct:
  ```bash
  npm view @mission_sciences/provider-sdk
  ```
- [ ] Package installable:
  ```bash
  npm install @mission_sciences/provider-sdk
  ```
- [ ] Test installation in separate directory:
  ```bash
  mkdir /tmp/test-sdk
  cd /tmp/test-sdk
  npm init -y
  npm install @mission_sciences/provider-sdk
  node -e "const sdk = require('@mission_sciences/provider-sdk'); console.log('✅ SDK loaded');"
  ```

**GitHub Release Verification (if tag push):**
- [ ] Release visible: https://github.com/Mission-Sciences/provider-sdk/releases
- [ ] Release tag: v0.1.1
- [ ] Release notes generated
- [ ] Assets attached (if configured)

## Phase 5: Communication (1 hour)

### ☐ User Communication Prepared
- [ ] Migration announcement drafted
- [ ] Migration guide linked (README.md)
- [ ] Old package deprecation notice prepared
- [ ] Timeline for old package support communicated

### ☐ Documentation Updated
- [ ] Internal wiki/docs updated with new package name
- [ ] Slack/Teams announcement sent
- [ ] Email to stakeholders sent (if applicable)
- [ ] Customer support team notified

### ☐ Old Package Deprecated
- [ ] Bitbucket repository marked as archived (or deprecated)
- [ ] Bitbucket README updated with migration notice:
  ```markdown
  # ⚠️ This repository has moved!

  The package has been migrated to GitHub and renamed:
  - **Old**: @marketplace/provider-sdk
  - **New**: @mission_sciences/provider-sdk

  New repository: https://github.com/Mission-Sciences/provider-sdk
  npm package: https://www.npmjs.com/package/@mission_sciences/provider-sdk

  Please update your dependencies to use the new package name.
  ```
- [ ] Bitbucket pipeline disabled
- [ ] AWS CodeArtifact: `@marketplace/provider-sdk` marked as deprecated (if possible)

### ☐ User Migration Support
- [ ] Migration guide published
- [ ] FAQ created for common issues
- [ ] Support channels prepared for migration questions
- [ ] Monitoring set up for npm downloads

## Phase 6: Post-Migration Validation (Ongoing)

### ☐ Monitoring Setup (Day 1-7)
- [ ] npm package downloads tracked: https://npm-stat.com/charts.html?package=%40mission_sciences%2Fprovider-sdk
- [ ] GitHub Issues monitored for migration problems
- [ ] CI/CD workflow monitored for failures
- [ ] No critical issues reported

### ☐ Integration Testing (Day 1-3)
- [ ] Test installation from npm registry
- [ ] Verify TypeScript types work
- [ ] Test in vanilla JavaScript project
- [ ] Test in React project
- [ ] Test in Vue project (if applicable)
- [ ] Chrome extension integration tested (if applicable)

### ☐ Backward Compatibility (Week 1)
- [ ] No breaking changes reported
- [ ] API unchanged
- [ ] TypeScript types unchanged
- [ ] Build outputs unchanged

### ☐ Performance Validation (Week 1)
- [ ] npm CDN delivering package quickly
- [ ] CI/CD workflow completing in reasonable time (<15 min)
- [ ] No degradation in download speed vs CodeArtifact

### ☐ Security Scan (Week 1)
- [ ] GitHub Dependabot enabled
- [ ] CodeQL scanning enabled (optional)
- [ ] No high-severity vulnerabilities reported
- [ ] npm audit clean: `npm audit`

### ☐ Documentation Review (Week 2)
- [ ] All docs reflect new package name
- [ ] No broken links
- [ ] Migration guide working for users
- [ ] GitHub repository README accurate

## Phase 7: Cleanup (Week 2-4)

### ☐ Bitbucket Cleanup
- [ ] Bitbucket pipeline archived
- [ ] Bitbucket repository marked read-only (optional)
- [ ] Bitbucket secrets cleaned up
- [ ] Local Bitbucket remote removed (optional):
  ```bash
  git remote remove bitbucket
  ```

### ☐ Old Package Cleanup
- [ ] `@marketplace/provider-sdk` deprecated on CodeArtifact
- [ ] Timeline set for removing old package (e.g., 6 months)
- [ ] Final migration deadline communicated

### ☐ Process Documentation
- [ ] Migration lessons learned documented
- [ ] This checklist archived for future reference
- [ ] Runbook created for similar migrations
- [ ] Team knowledge shared

## Rollback Plan (Emergency Use Only)

### ☐ If Production Publish Fails
- [ ] **DO NOT PANIC** - GitHub Actions allows re-running jobs
- [ ] Review workflow logs for error details
- [ ] Check specific job failure:
  - terraform-apply failure → Manually fix Terraform state
  - publish-codeartifact failure → Verify AWS credentials, retry
  - publish-npm failure → Verify npm token, retry
- [ ] Fix issue and re-run workflow
- [ ] If unfixable, communicate delay to users

### ☐ If Major Issues Discovered Post-Publish
1. **Immediate**: Unpublish from npm (if critical bug):
   ```bash
   npm unpublish @mission_sciences/provider-sdk@0.1.1
   ```
2. **Communication**: Notify users immediately
3. **Fix**: Develop patch/fix locally
4. **Test**: Thoroughly test fix
5. **Republish**: Use version 0.1.2 with fix

### ☐ If Migration Needs to Revert
- [ ] Re-enable Bitbucket pipeline
- [ ] Continue publishing to CodeArtifact as `@marketplace/provider-sdk`
- [ ] Unpublish from npm (if necessary)
- [ ] Communicate reversion to users
- [ ] Analyze root cause before re-attempting migration

## Success Criteria

✅ **Migration Complete When:**
- All checkboxes above are checked
- Package published to both registries
- Users can install and use new package
- No critical issues reported
- Documentation accurate
- Old package deprecated

🎉 **Congratulations! Migration successful!**

---

## Quick Reference

**GitHub Repository**: https://github.com/Mission-Sciences/provider-sdk
**npm Package**: https://www.npmjs.com/package/@mission_sciences/provider-sdk
**Old Package (deprecated)**: @marketplace/provider-sdk on CodeArtifact

**Key Commands**:
```bash
# Install new package
npm install @mission_sciences/provider-sdk

# Verify installation
npm view @mission_sciences/provider-sdk

# Check workflow status
gh workflow list --repo Mission-Sciences/provider-sdk

# Monitor package downloads
npm-stat @mission_sciences/provider-sdk
```
