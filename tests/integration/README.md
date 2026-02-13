# SDK Integration Tests

Integration tests for the Gateway SDK that validate real API interactions.

## Overview

These tests call actual deployed API endpoints with real Cognito authentication. They verify that the SDK correctly interacts with the Gateway API for session management, JWT operations, and heartbeat functionality.

## Prerequisites

### 1. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# API Configuration
API_BASE_URL=https://api.dev.generalwisdom.com

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=ghostdog-dev

# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_YourPoolId
COGNITO_CLIENT_ID=your-client-id
COGNITO_REGION=us-east-1

# Test Credentials
TEST_USERNAME=integration-test@example.com
TEST_PASSWORD=YourSecureTestPassword123!
```

### 2. AWS Credentials

Ensure your AWS credentials are configured:

```bash
aws configure --profile ghostdog-dev
```

Or use environment variables:

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 3. Test User Setup

Create a test user in Cognito User Pool:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_YourPoolId \
  --username integration-test@example.com \
  --user-attributes Name=email,Value=integration-test@example.com \
  --temporary-password TempPassword123! \
  --profile ghostdog-dev

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_YourPoolId \
  --username integration-test@example.com \
  --password YourSecureTestPassword123! \
  --permanent \
  --profile ghostdog-dev
```

### 4. API Availability

Ensure the Gateway API is deployed and accessible:

```bash
curl https://api.dev.generalwisdom.com/health
```

## Running Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test Suite

```bash
# Session validation tests
npm run test:integration -- sessions/validation.test.ts

# Session extension tests
npm run test:integration -- sessions/extension.test.ts

# All session tests
npm run test:integration -- sessions/
```

### Run with Debug Output

```bash
DEBUG=* npm run test:integration
```

### Run Single Test

```bash
npm run test:integration -- sessions/validation.test.ts -t "validates authentic session token"
```

## Test Structure

```
tests/integration/
├── vitest.config.ts          # Vitest configuration
├── setup.ts                  # Global setup/teardown
├── .env.example              # Environment template
├── README.md                 # This file
├── utils/                    # Shared test utilities
│   ├── auth/                 # Cognito authentication
│   ├── config/               # Configuration management
│   ├── data/                 # Test data factory
│   └── api/                  # Authenticated API client
└── sessions/                 # Session integration tests
    ├── validation.test.ts    # Session validation tests
    ├── extension.test.ts     # Session extension tests
    ├── completion.test.ts    # Session completion tests
    └── heartbeat.test.ts     # Heartbeat system tests
```

## Test Utilities

### CognitoAuthHelper

Handles Cognito authentication with token caching:

```typescript
import { CognitoAuthHelper } from './utils/auth';

const authHelper = new CognitoAuthHelper({
  userPoolId: 'us-east-1_XXX',
  clientId: 'xxx',
  region: 'us-east-1',
  username: 'test@example.com',
  password: 'password',
});

const tokens = await authHelper.authenticate();
const idToken = await authHelper.getIdToken();
```

### ConfigService

Loads configuration from environment or SSM:

```typescript
import { ConfigService } from './utils/config';

const configService = new ConfigService();
const config = await configService.getConfig();

console.log(config.apiBaseUrl);
console.log(config.testUsername);
```

### TestDataFactory

Generates unique test data and manages cleanup:

```typescript
import { TestDataFactory } from './utils/data';

const factory = new TestDataFactory();

// Generate test data
const session = factory.generateSessionData();
const user = factory.generateUserData();

// Track for cleanup
factory.trackForCleanup('session', session.id);

// Cleanup after tests
await factory.cleanup(async (type, id) => {
  await deleteEntity(type, id);
});
```

### AuthenticatedApiClient

Makes authenticated API requests with retry logic:

```typescript
import { AuthenticatedApiClient } from './utils/api';

const client = new AuthenticatedApiClient(authHelper, 'https://api.example.com');

// GET request
const response = await client.get('/sessions', { userId: '123' });

// POST request
const created = await client.post('/sessions', sessionData);

// Automatic retry on transient failures
// Automatic token refresh on expiration
```

## Writing New Tests

### Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService, CognitoAuthHelper, TestDataFactory, AuthenticatedApiClient } from '../utils';

describe('Feature Integration Tests', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    // Setup
    const configService = new ConfigService();
    config = await configService.getConfig();

    authHelper = new CognitoAuthHelper({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      region: config.cognitoRegion,
      username: config.testUsername,
      password: config.testPassword,
    });

    await authHelper.authenticate();

    apiClient = new AuthenticatedApiClient(authHelper, config.apiBaseUrl);
    factory = new TestDataFactory();
  });

  afterAll(async () => {
    // Cleanup test data
    await factory.cleanup(async (entityType, entityId) => {
      await apiClient.delete(`/${entityType}s/${entityId}`);
    });
  });

  it('should test feature', async () => {
    // Arrange
    const testData = factory.generateSessionData();
    factory.trackForCleanup('session', testData.id);

    // Act
    const response = await apiClient.post('/sessions', testData);

    // Assert
    expect(response.status).toBe(201);
    expect(response.data.id).toBe(testData.id);
  });
});
```

## Troubleshooting

### Authentication Errors

**Error**: `Cognito authentication failed`

**Solutions**:
- Verify test user exists: `aws cognito-idp admin-get-user ...`
- Check credentials in `.env`
- Ensure user status is CONFIRMED
- Verify user pool ID and client ID

### API Connection Errors

**Error**: `API is not reachable`

**Solutions**:
- Check API_BASE_URL is correct
- Verify API is deployed and running
- Test with curl: `curl $API_BASE_URL/health`
- Check network/VPN connectivity

### Configuration Errors

**Error**: `Required configuration missing`

**Solutions**:
- Copy `.env.example` to `.env`
- Fill in all required variables
- Check AWS credentials: `aws sts get-caller-identity`
- Verify SSM parameters exist

### Test Timeouts

**Error**: `Test timeout exceeded`

**Solutions**:
- Increase timeout in vitest.config.ts
- Check API response times
- Verify network latency
- Reduce test parallelism

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run Integration Tests
        run: npm run test:integration
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_USER_POOL_ID }}
          COGNITO_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## Best Practices

1. **Test Isolation**: Each test creates and cleans up its own data
2. **Unique IDs**: Use TestDataFactory to generate unique identifiers
3. **Cleanup**: Always track entities for cleanup with `trackForCleanup()`
4. **Assertions**: Use specific assertions, avoid generic `toBeTruthy()`
5. **Error Handling**: Test both success and error scenarios
6. **Timeouts**: Set appropriate timeouts for API operations
7. **Logging**: Use console.debug for detailed test execution logs

## Support

For issues or questions:
- Check existing test patterns in `sessions/`
- Review utility documentation in `utils/*/README.md`
- Refer to API documentation in `gw-api/CLAUDE.md`
