/**
 * Global Setup for Integration Tests
 *
 * Runs once before all integration tests.
 * - Validates environment configuration
 * - Tests authentication
 * - Ensures API is reachable
 */

import { ConfigService } from './utils/config';
import { CognitoAuthHelper } from './utils/auth';

export async function setup() {
  console.log('\n🔧 Setting up integration test environment...\n');

  try {
    // 1. Load and validate configuration
    console.log('📋 Loading configuration...');
    const configService = new ConfigService();
    await configService.validateConfiguration();
    const config = await configService.getConfig();
    console.log('✓ Configuration loaded successfully');
    console.log(`  - API Base URL: ${config.apiBaseUrl}`);
    console.log(`  - AWS Region: ${config.awsRegion}`);
    console.log(`  - Test Environment: ${config.testEnv}`);

    // 2. Test authentication
    console.log('\n🔐 Testing Cognito authentication...');
    const authHelper = new CognitoAuthHelper({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      region: config.cognitoRegion,
      username: config.testUsername,
      password: config.testPassword,
    });

    const tokens = await authHelper.authenticate();
    console.log('✓ Authentication successful');
    console.log(`  - Token expires in: ${tokens.expiresIn}s`);

    // 3. Test API connectivity
    console.log('\n🌐 Testing API connectivity...');
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      console.log('✓ API is reachable');
      console.log(`  - Status: ${response.status}`);
    } else {
      console.warn(`⚠ API health check returned ${response.status}`);
    }

    console.log('\n✅ Integration test environment ready!\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error('\nPlease check:');
    console.error('  1. Environment variables are set correctly');
    console.error('  2. AWS credentials are configured');
    console.error('  3. Test user exists in Cognito');
    console.error('  4. API is running and accessible');
    console.error('\nRefer to tests/integration/README.md for setup instructions.\n');
    throw error;
  }
}

export async function teardown() {
  console.log('\n🧹 Integration test teardown complete.\n');
}
