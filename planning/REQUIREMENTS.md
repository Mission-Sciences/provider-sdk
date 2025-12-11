# Requirements Document: gw-sdk GitHub Migration & Dual Publishing

## Project Overview

**Project**: Migration of `@marketplace/provider-sdk` to GitHub with dual-publishing setup
**Type**: Brownfield Enhancement
**Duration**: 12-16 hours (across 1-2 weeks for validation)

## Business Requirements

### BR-1: Package Rebranding
**Priority**: High
- Change package scope from `@marketplace` to `@mission_sciences`
- Maintain version 0.1.1 for initial migration
- Provide migration path for existing users

### BR-2: Public Distribution
**Priority**: High
- Publish to npm registry for public consumption
- Maintain private distribution on AWS CodeArtifact
- GitHub repository at https://github.com/Mission-Sciences

### BR-3: CI/CD Modernization
**Priority**: High
- Migrate from Bitbucket Pipelines to GitHub Actions
- One-time migration (deprecate Bitbucket)
- Maintain existing test coverage

## Functional Requirements

### FR-1: Package Configuration
**Status**: Required
**Dependencies**: None

**Specifications**:
1. Update `package.json`:
   - Name: `@mission_sciences/provider-sdk`
   - Scope: `@mission_sciences`
   - Version: `0.1.1` (maintain)
2. Update package exports and build outputs
3. Preserve existing functionality
4. Maintain TypeScript types

**Acceptance Criteria**:
- ✅ Package builds successfully with new name
- ✅ All tests pass with updated configuration
- ✅ TypeScript definitions generated correctly
- ✅ UMD and ES modules both work

### FR-2: GitHub Repository Setup
**Status**: Required
**Dependencies**: None

**Specifications**:
1. Create public repository at `Mission-Sciences/provider-sdk`
2. Configure repository settings:
   - Public visibility
   - Issue tracking enabled
   - Branch protection on `main`
   - Require PR reviews
3. Set up GitHub secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `NPM_TOKEN`
   - Test credentials (from existing workflow)
4. Transfer code from Bitbucket

**Acceptance Criteria**:
- ✅ Repository accessible at correct URL
- ✅ All code transferred with commit history
- ✅ Secrets configured and verified
- ✅ Branch protection rules active

### FR-3: Dual Publishing Workflow
**Status**: Required
**Dependencies**: FR-2

**Specifications**:
1. GitHub Actions workflow for publishing:
   - Trigger on push to `main` and release tags
   - Manual dispatch option
   - Skip options for individual registries
2. Publishing sequence:
   - Build and test
   - Terraform plan/apply (CodeArtifact)
   - Publish to CodeArtifact (private)
   - Publish to npm registry (public)
   - Create GitHub release
3. Error handling and rollback
4. Version verification

**Acceptance Criteria**:
- ✅ Workflow triggers correctly
- ✅ Publishes to CodeArtifact successfully
- ✅ Publishes to npm registry successfully
- ✅ Creates GitHub release with notes
- ✅ Handles failures gracefully

### FR-4: Authentication Management
**Status**: Required
**Dependencies**: FR-2, FR-3

**Specifications**:
1. AWS authentication:
   - IAM user with CodeArtifact permissions
   - S3 access for Terraform state (if used)
   - Systems Manager Parameter Store access
2. npm authentication:
   - Automation token with publish rights
   - Scoped to `@mission_sciences` org
3. Secure secret storage in GitHub

**Acceptance Criteria**:
- ✅ AWS credentials work for CodeArtifact
- ✅ npm token has correct permissions
- ✅ Secrets stored securely
- ✅ No hardcoded credentials

### FR-5: Documentation Updates
**Status**: Required
**Dependencies**: FR-1

**Specifications**:
1. Update all documentation files:
   - README.md
   - INTEGRATION_GUIDE.md
   - QUICKSTART.md
   - All other .md files
2. Update installation instructions
3. Add migration guide for existing users
4. Update package name references

**Acceptance Criteria**:
- ✅ All npm install commands use new name
- ✅ Migration guide provided
- ✅ GitHub repository links updated
- ✅ No references to old package name

### FR-6: Backward Compatibility
**Status**: Required
**Dependencies**: All FRs

**Specifications**:
1. Existing functionality preserved
2. API unchanged
3. No breaking changes in this version
4. Clear deprecation notice for old package

**Acceptance Criteria**:
- ✅ All existing tests pass
- ✅ Integration examples work unchanged
- ✅ TypeScript types unchanged
- ✅ Deprecation notice published

## Technical Requirements

### TR-1: Build System
**Status**: Required

**Specifications**:
- TypeScript 5.3+ compilation
- Vite bundling (UMD + ES modules)
- Type definitions generation
- Terser optimization
- Node 20 compatibility

**Constraints**:
- Bundle size < 10KB gzipped
- No additional dependencies
- ESM and CommonJS support

### TR-2: Testing Infrastructure
**Status**: Required

**Specifications**:
1. Unit tests (Vitest)
   - SDK core functionality
   - JWT validation
   - Session management
2. Integration tests
   - AWS Cognito integration
   - Live API validation
3. Coverage requirements
   - Minimum 80% coverage
   - Critical paths 100% covered

**Constraints**:
- Tests run in CI/CD
- Integration tests require AWS credentials
- No flaky tests allowed

### TR-3: Infrastructure as Code
**Status**: Required

**Specifications**:
1. Terraform configuration for CodeArtifact:
   - Domain: `ghostdogbase`
   - Repository: `sdk-packages`
   - Region: `us-east-1`
2. State management (S3 or local)
3. Plan/apply in CI/CD pipeline

**Constraints**:
- No manual AWS changes
- Terraform version 1.6+
- State backup before changes

### TR-4: Security Requirements
**Status**: Required

**Specifications**:
1. No secrets in code or commits
2. GitHub secrets for sensitive data
3. Least privilege IAM permissions
4. Dependency vulnerability scanning
5. Code scanning with CodeQL (optional)

**Constraints**:
- Pass security audit
- No high-severity vulnerabilities
- Regular secret rotation policy

## Non-Functional Requirements

### NFR-1: Performance
- CI/CD pipeline < 10 minutes
- Build time < 2 minutes
- Test execution < 5 minutes
- npm download speed (CDN)

### NFR-2: Reliability
- 99.9% workflow success rate
- Automatic retry on transient failures
- Rollback capability
- Monitoring and alerting

### NFR-3: Maintainability
- Clear workflow structure
- Comprehensive error messages
- Documentation for all workflows
- Runbook for common issues

### NFR-4: Accessibility
- Public npm registry (worldwide CDN)
- GitHub repository (open source)
- Clear documentation
- Examples and quickstart guides

## Success Criteria

### Phase 1: Setup (Complete)
- ✅ Planning documents created
- ✅ Requirements clarified
- ✅ Architecture designed
- ✅ Task list created

### Phase 2: Implementation (Pending)
- [ ] Package configuration updated
- [ ] GitHub repository created
- [ ] Workflows implemented
- [ ] Documentation updated

### Phase 3: Testing (Pending)
- [ ] Local builds passing
- [ ] Dry-run publishes successful
- [ ] CI/CD workflows tested
- [ ] Integration tests passing

### Phase 4: Production (Pending)
- [ ] Published to npm registry
- [ ] Published to CodeArtifact
- [ ] GitHub release created
- [ ] Users notified

### Phase 5: Validation (Pending)
- [ ] Package downloadable from npm
- [ ] Installation works correctly
- [ ] No breaking changes confirmed
- [ ] Monitoring established

## Risk Management

### High-Priority Risks
1. **Package Name Collision**
   - Risk: `@mission_sciences/provider-sdk` already exists
   - Mitigation: Verify availability before migration
   - Contingency: Use alternative name

2. **Authentication Failures**
   - Risk: GitHub secrets don't work
   - Mitigation: Test in feature branch first
   - Contingency: Rollback to Bitbucket temporarily

3. **Broken Existing Users**
   - Risk: Users can't find new package
   - Mitigation: Deprecation notice + migration guide
   - Contingency: Keep old package published temporarily

### Medium-Priority Risks
1. **CI/CD Pipeline Failures**
   - Risk: GitHub Actions workflow errors
   - Mitigation: Comprehensive testing phase
   - Contingency: Manual publishing

2. **AWS CodeArtifact Issues**
   - Risk: Terraform or publishing fails
   - Mitigation: Validate Terraform plan carefully
   - Contingency: Use existing Bitbucket pipeline

## Constraints

### Technical Constraints
- Must maintain Node 20+ compatibility
- Cannot break existing API
- Must support both UMD and ES modules
- TypeScript strict mode required

### Business Constraints
- Migration within 2 weeks
- No service interruption
- Public transparency (open source)
- Mission-Sciences branding

### Resource Constraints
- Single engineer for implementation
- Limited AWS budget
- npm org account required
- GitHub org permissions needed

## Assumptions

1. Mission-Sciences GitHub org exists and accessible
2. Mission-Sciences npm org exists and accessible
3. AWS account has CodeArtifact permissions
4. Existing Bitbucket pipeline can be deprecated
5. Users willing to update package name
6. No urgent releases during migration

## Dependencies

### External Dependencies
1. GitHub org access (Mission-Sciences)
2. npm org access (mission_sciences)
3. AWS account with IAM permissions
4. Bitbucket export capability

### Internal Dependencies
1. Terraform configuration (existing)
2. Test suite (existing)
3. Documentation (existing)
4. Build system (existing)

## Timeline

**Total Duration**: 12-16 hours (across 1-2 weeks)

**Week 1**: Setup + Implementation (8-10 hours)
- Day 1-2: Repository + configuration (4 hours)
- Day 3-4: Workflows + testing (4-6 hours)

**Week 2**: Testing + Production (4-6 hours)
- Day 1-2: Validation + fixes (2-3 hours)
- Day 3: Production deployment (1-2 hours)
- Day 4-5: Monitoring + cleanup (1 hour)

## Approval

**Stakeholders**: Mission Sciences team
**Approval Required**: Before Phase 4 (Production)
**Review Points**: After each phase completion

## Appendices

### Appendix A: IAM Permissions Template
See CI_CD_ARCHITECTURE.md, Section 4

### Appendix B: GitHub Secrets Checklist
See TASKS.md, Phase 1

### Appendix C: Migration Communication Template
See TASKS.md, Appendix D

### Appendix D: Rollback Procedures
See TASKS.md, Appendix A
