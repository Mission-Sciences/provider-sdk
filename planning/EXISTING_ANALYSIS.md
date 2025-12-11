# Existing Codebase Analysis: gw-sdk

## Repository Structure

```
gw-sdk/
├── src/                          # Source code (TypeScript)
├── tests/                        # Test suites
│   └── integration/             # Integration tests (AWS Cognito)
├── examples/                     # Example implementations
├── scripts/                      # Utility scripts
│   ├── generate-test-keys.js
│   ├── generate-test-jwt.js
│   ├── test-server.js
│   └── test-server-phase2.js
├── terraform/                    # Infrastructure as Code
│   └── (CodeArtifact setup)
├── keys/                         # Dev keys (not in git)
├── dist/                         # Build output
├── docs/                         # Documentation
│   ├── INTEGRATION_GUIDE.md
│   ├── QUICKSTART.md
│   ├── TESTING_GUIDE.md
│   └── VALIDATION.md
├── package.json                  # Package config
├── tsconfig.json                 # TypeScript config
├── vite.config.ts               # Build config
├── vitest.config.ts             # Test config
├── bitbucket-pipelines.yml      # Current CI/CD (to migrate)
└── .github/
    └── workflows/
        └── test-integration.yml # Existing GitHub Actions (tests only)
```

## Current CI/CD Pipeline

### Bitbucket Pipeline (bitbucket-pipelines.yml)
**Triggers**: Push to `main` branch
**Steps**:
1. **Test** - Run linter and unit tests
2. **Build** - Compile TypeScript and bundle with Vite
3. **Terraform Plan** - Plan CodeArtifact infrastructure
4. **Terraform Apply** - Deploy/update CodeArtifact
5. **Publish** - Publish to AWS CodeArtifact

**Authentication**:
- Uses OIDC (OpenID Connect) for AWS authentication
- Required variables: `OIDC_ROLE_ARN`, `AWS_DEFAULT_REGION`

### GitHub Actions (test-integration.yml)
**Current Scope**: Tests only, no publishing
**Triggers**: Push/PR to `main` or `develop`
**Steps**:
1. Unit tests
2. Integration tests (requires AWS credentials)
3. Test summary

**AWS Secrets Required**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `API_BASE_URL`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `TEST_USERNAME`
- `TEST_PASSWORD`

## Package Configuration

### Current package.json
- **Name**: `@marketplace/provider-sdk`
- **Version**: 0.1.1
- **Type**: module (ESM)
- **Main**: `./dist/marketplace-sdk.umd.js`
- **Module**: `./dist/marketplace-sdk.es.js`
- **Types**: `./dist/index.d.ts`

### Build Configuration
- **Entry Points**: Both UMD and ES modules
- **TypeScript**: Strict mode enabled
- **Bundle Tool**: Vite with terser optimization
- **Type Generation**: vite-plugin-dts

### Dependencies
- **Runtime**: `jose` (JWT library)
- **Peer**: `react` (optional)
- **Dev**: AWS SDK, Cognito, TypeScript, Vite, Vitest

### Scripts
```json
{
  "build": "tsc && vite build",
  "test": "vitest run",
  "test:integration": "vitest run --config tests/integration/vitest.config.ts",
  "lint": "eslint src --ext .ts,.tsx",
  "prepublishOnly": "npm run build"
}
```

## AWS Infrastructure

### CodeArtifact Resources (Terraform)
- **Domain**: `ghostdogbase`
- **Repository**: `sdk-packages`
- **Region**: `us-east-1`

### Authentication Flow
1. OIDC token from Bitbucket
2. Assume IAM role via `sts assume-role-with-web-identity`
3. Configure npm with CodeArtifact credentials
4. Publish package

## Testing Infrastructure

### Unit Tests
- Framework: Vitest
- Coverage tool: @vitest/coverage-v8
- DOM simulation: jsdom

### Integration Tests
- AWS Cognito integration testing
- Requires live AWS resources
- Uses SSM Parameter Store for config
- Test credentials managed via secrets

## Documentation Structure
- **README.md** - Main project documentation
- **INTEGRATION_GUIDE.md** - Framework integration examples
- **QUICKSTART.md** - 3-minute getting started guide
- **TESTING_GUIDE.md** - Testing strategies
- **VALIDATION.md** - Validation procedures
- **jwt-specification.md** - JWT token format details

## Code Quality Tools
- **Linter**: ESLint with TypeScript plugin
- **Formatter**: Prettier
- **Type Checking**: TypeScript compiler

## Migration Considerations

### Files to Update
1. **package.json** - Change package name
2. **README.md** - Update installation instructions
3. **Documentation** - Update all npm install commands
4. **CI/CD** - Migrate from Bitbucket to GitHub Actions
5. **.github/workflows/** - Add publishing workflow

### Files to Create
1. **GitHub Actions workflow** - Dual-publish to CodeArtifact + npm
2. **GitHub repository** - Create at Mission-Sciences org
3. **.npmrc** (optional) - npm registry configuration

### Files to Preserve
1. **Terraform** - Keep for CodeArtifact management
2. **Tests** - All test suites remain unchanged
3. **Build config** - vite.config.ts, tsconfig.json
4. **Examples** - Keep for reference

### Deprecation Plan
1. Archive `bitbucket-pipelines.yml` (keep for reference)
2. Add note to Bitbucket README directing to GitHub
3. Update links in all documentation
4. Notify existing users of package name change

## Security Considerations

### Secrets Management
**Current (Bitbucket)**:
- OIDC_ROLE_ARN (secured variable)
- AWS credentials managed via OIDC

**New (GitHub)**:
- AWS_ACCESS_KEY_ID (GitHub secret)
- AWS_SECRET_ACCESS_KEY (GitHub secret)
- NPM_TOKEN (GitHub secret, new)
- Keep existing integration test secrets

### Access Control
- GitHub repository: Public
- npm package: Public
- AWS CodeArtifact: Private (organization only)

## Backwards Compatibility

### Package Name Change Impact
- **Breaking Change**: Users must update imports
- **Migration Path**:
  1. Publish both packages initially
  2. Deprecate old package on CodeArtifact
  3. Provide migration guide

### Version Strategy
- Keep version 0.1.1 for consistency
- Major bump (1.0.0) for stable release later
- Document package name change in CHANGELOG

## Performance Considerations
- No performance impact expected
- CI/CD may be faster on GitHub Actions
- npm CDN provides better public distribution
