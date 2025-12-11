# Integration Tests Setup

Integration tests validate the SDK against a live API deployment. They are **optional** and will automatically skip if secrets are not configured.

## Current Status

✅ **Integration tests are DISABLED in CI**
- Missing required GitHub secrets
- npm publishing works without them
- Tests only run when secrets are configured

## Required GitHub Secrets

To enable integration tests in CI, configure these secrets in GitHub:

### API Configuration
- `API_BASE_URL` - API endpoint (e.g., `https://api.example.com`)

### Cognito Configuration
- `COGNITO_USER_POOL_ID` - Cognito User Pool ID (e.g., `us-east-1_XXXXX`)
- `COGNITO_CLIENT_ID` - Cognito App Client ID
- `COGNITO_REGION` - AWS region (optional, defaults to `us-east-1`)

### Test Credentials
- `TEST_USERNAME` - Test user email for authentication
- `TEST_PASSWORD` - Test user password

### AWS IAM (Already Configured)
- `AWS_ROLE_ARN` - IAM role for OIDC authentication ✅

## How to Configure Secrets

### Via GitHub Web UI
1. Go to: https://github.com/Mission-Sciences/provider-sdk/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret listed above

### Via GitHub CLI
```bash
gh secret set API_BASE_URL --body "https://your-api.example.com"
gh secret set COGNITO_USER_POOL_ID --body "us-east-1_XXXXX"
gh secret set COGNITO_CLIENT_ID --body "your-client-id"
gh secret set TEST_USERNAME --body "test@example.com"
gh secret set TEST_PASSWORD --body "YourSecurePassword123!"
```

## Running Tests Locally

Integration tests work locally without GitHub secrets:

```bash
# Copy example environment
cp tests/integration/.env.example tests/integration/.env

# Edit with your configuration
vim tests/integration/.env

# Run integration tests
npm run test:integration
```

See `tests/integration/README.md` for detailed local setup instructions.

## When Integration Tests Run

Integration tests only run when **ALL** of these conditions are met:

1. ✅ Push to `main` branch (not releases)
2. ✅ Required secrets are configured
3. ✅ Build and unit tests pass

If secrets are missing, the job is **skipped** (not failed), allowing deployment to proceed.

## Troubleshooting

### Tests Skipped in CI
**Symptom**: Integration tests job doesn't appear in workflow
**Cause**: Required secrets not configured
**Solution**: Configure secrets as described above, or leave skipped if not needed

### Tests Fail with Auth Errors
**Symptom**: "Invalid Authorization header" or 403 errors
**Cause**: API expects AWS SigV4, but client sends Bearer tokens
**Solution**: API Gateway must be configured with Cognito User Pool Authorizer

### Tests Fail with 404 Errors
**Symptom**: "Application not found"
**Cause**: Test application ID doesn't exist in target environment
**Solution**: Create test application or update ID in `tests/integration/utils/data/test-data-factory.ts`

## Architecture Notes

The integration tests expect:
- **API**: AWS API Gateway with Cognito User Pool Authorizer
- **Auth**: Cognito JWT tokens as Bearer tokens
- **Format**: `Authorization: Bearer <id_token>`

If your API uses AWS SigV4 authentication instead, the API client needs to be updated to sign requests with AWS credentials.

## Decision

**✅ Integration tests are optional for deployment**
- npm publishing works without them
- They validate against live API only
- Configure secrets when you want to enable them
- Safe to leave disabled for now
