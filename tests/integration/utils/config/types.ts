/**
 * Configuration Types
 *
 * TypeScript interfaces for test configuration.
 */

export interface TestConfig {
  // API Configuration
  apiBaseUrl: string;
  apiTimeout: number;

  // AWS Configuration
  awsRegion: string;
  awsProfile?: string;

  // Cognito Configuration
  cognitoUserPoolId: string;
  cognitoClientId: string;
  cognitoRegion: string;

  // Test Credentials
  testUsername: string;
  testPassword: string;

  // Environment
  testEnv: string;
}

export interface SSMParameters {
  '/gateway/test/cognito/user-pool-id'?: string;
  '/gateway/test/cognito/client-id'?: string;
  '/gateway/test/cognito/region'?: string;
  '/gateway/test/cognito/username'?: string;
  '/gateway/test/cognito/password'?: string;
  '/gateway/test/api/endpoint'?: string;
  '/gateway/test/api/timeout'?: string;
}

export interface ConfigCache {
  config: TestConfig;
  loadedAt: number;
  source: 'env' | 'ssm' | 'default';
}
