# Project Context: gw-sdk Enhancement

## Project Type
**Type**: Library/SDK (npm package)
**Context**: **Brownfield Enhancement**

## Project Classification
- **Existing Project**: Yes
- **Enhancement Type**: Repository migration + Dual-publishing setup
- **Complexity**: Medium (CI/CD changes, repository setup, package name migration)

## Current State
- **Package Name**: `@marketplace/provider-sdk`
- **Version**: 0.1.1
- **Repository**: Bitbucket (private)
- **CI/CD**: Bitbucket Pipelines
- **Deployment Target**: AWS CodeArtifact only

## Desired State
- **Package Name**: `@mission_sciences/provider-sdk`
- **Version**: 0.1.1 (same, just re-publish)
- **Repository**: GitHub at https://github.com/Mission-Sciences (public)
- **CI/CD**: GitHub Actions
- **Deployment Targets**: AWS CodeArtifact + npm registry (dual-publish)

## Migration Strategy
**One-time Migration**:
- Move entirely from Bitbucket to GitHub
- Deprecate Bitbucket pipeline after verification
- Maintain backwards compatibility during transition

## Key Requirements
1. Change package name to `@mission_sciences/provider-sdk`
2. Create public GitHub repository at Mission-Sciences org
3. Set up GitHub Actions workflow for dual-publishing
4. Publish to npm registry: https://www.npmjs.com/settings/mission_sciences/packages
5. Maintain AWS CodeArtifact publishing capability
6. Preserve existing functionality and tests
7. Update documentation for new package name

## Technology Stack
- **Language**: TypeScript 5.3
- **Build Tool**: Vite
- **Testing**: Vitest
- **Runtime**: Node 20
- **Package Manager**: npm
- **Cloud**: AWS (CodeArtifact, Cognito, SSM)
- **IaC**: Terraform (CodeArtifact infrastructure)

## Success Criteria
- ✅ GitHub repository created and accessible
- ✅ Package published to npm as `@mission_sciences/provider-sdk`
- ✅ Package published to AWS CodeArtifact (maintained)
- ✅ GitHub Actions workflow working for dual-publish
- ✅ Tests passing in new repository
- ✅ Documentation updated
- ✅ Existing integrations not broken
