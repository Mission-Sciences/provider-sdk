/**
 * Configuration Service
 *
 * Centralized test configuration management with multiple sources:
 * 1. Environment variables (highest priority)
 * 2. AWS SSM Parameter Store (fallback)
 * 3. Default values (last resort)
 *
 * Replicates the pattern from gw-api/scripts/test_config.py
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { TestConfig, SSMParameters, ConfigCache } from './types';

export class ConfigService {
  private ssmClient: SSMClient | null = null;
  private configCache: ConfigCache | null = null;
  private readonly cacheTTL = 300000; // 5 minutes

  constructor(awsProfile?: string) {
    // Initialize SSM client if AWS profile is available
    const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

    this.ssmClient = new SSMClient({
      region: awsRegion,
      credentials: awsProfile ? undefined : undefined, // Use default credential chain
    });
  }

  /**
   * Get complete test configuration
   * Uses cache if available and not expired
   */
  async getConfig(): Promise<TestConfig> {
    // Return cached config if valid
    if (this.configCache && this.isCacheValid(this.configCache)) {
      console.debug('[ConfigService] Using cached configuration');
      return this.configCache.config;
    }

    console.debug('[ConfigService] Loading configuration...');

    const config: TestConfig = {
      // API Configuration
      apiBaseUrl: await this.getApiBaseUrl(),
      apiTimeout: await this.getRequestTimeout(),

      // AWS Configuration
      awsRegion: this.getAwsRegion(),
      awsProfile: process.env.AWS_PROFILE,

      // Cognito Configuration
      cognitoUserPoolId: await this.getCognitoUserPoolId(),
      cognitoClientId: await this.getCognitoClientId(),
      cognitoRegion: await this.getCognitoRegion(),

      // Test Credentials
      testUsername: await this.getTestUsername(),
      testPassword: await this.getTestPassword(),

      // Environment
      testEnv: this.getTestEnvironment(),
    };

    // Cache the configuration
    this.configCache = {
      config,
      loadedAt: Date.now(),
      source: 'env', // Simplified - could track actual source per field
    };

    console.debug('[ConfigService] ✓ Configuration loaded successfully');
    return config;
  }

  /**
   * Get API base URL
   * Priority: ENV -> SSM -> Error
   */
  async getApiBaseUrl(): Promise<string> {
    const envValue = process.env.API_BASE_URL || process.env.API_ENDPOINT;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-api/api-endpoint');
    if (ssmValue) {
      return ssmValue;
    }

    throw new Error(
      'API_BASE_URL not configured. Set environment variable or SSM parameter /gw-api/api-endpoint'
    );
  }

  /**
   * Get Cognito configuration
   */
  async getCognitoUserPoolId(): Promise<string> {
    const envValue = process.env.COGNITO_USER_POOL_ID;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-auth/cognito/user-pool-id');
    if (ssmValue) {
      return ssmValue;
    }

    throw new Error(
      'COGNITO_USER_POOL_ID not configured. Set environment variable or SSM parameter /gw-auth/cognito/user-pool-id'
    );
  }

  async getCognitoClientId(): Promise<string> {
    const envValue = process.env.COGNITO_CLIENT_ID;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-auth/cognito/client-id');
    if (ssmValue) {
      return ssmValue;
    }

    throw new Error('COGNITO_CLIENT_ID not configured. Set environment variable or SSM parameter /gw-auth/cognito/client-id');
  }

  async getCognitoRegion(): Promise<string> {
    const envValue = process.env.COGNITO_REGION;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-auth/cognito/region');
    if (ssmValue) {
      return ssmValue;
    }

    // Default to AWS region
    return this.getAwsRegion();
  }

  /**
   * Get test credentials
   */
  async getTestUsername(): Promise<string> {
    const envValue = process.env.TEST_USERNAME || process.env.TEST_USER_EMAIL;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-api/integration-tests/username');
    if (ssmValue) {
      return ssmValue;
    }

    throw new Error('TEST_USERNAME not configured. Set environment variable or SSM parameter /gw-api/integration-tests/username');
  }

  async getTestPassword(): Promise<string> {
    const envValue = process.env.TEST_PASSWORD || process.env.TEST_USER_PASSWORD;
    if (envValue) {
      return envValue;
    }

    const ssmValue = await this.getSSMParameter('/gw-api/integration-tests/password', true);
    if (ssmValue) {
      return ssmValue;
    }

    throw new Error('TEST_PASSWORD not configured. Set environment variable or SSM parameter /gw-api/integration-tests/password');
  }

  /**
   * Get environment configuration
   */
  getTestEnvironment(): string {
    return process.env.TEST_ENV || process.env.NODE_ENV || 'test';
  }

  getAwsRegion(): string {
    return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  }

  async getRequestTimeout(): Promise<number> {
    const envValue = process.env.API_TIMEOUT || process.env.REQUEST_TIMEOUT;
    if (envValue) {
      return parseInt(envValue, 10);
    }

    const ssmValue = await this.getSSMParameter('/gateway/test/api/timeout');
    if (ssmValue) {
      return parseInt(ssmValue, 10);
    }

    // Default: 30 seconds
    return 30000;
  }

  /**
   * Validate that all required configuration is present
   */
  async validateConfiguration(): Promise<void> {
    console.debug('[ConfigService] Validating configuration...');

    try {
      const config = await this.getConfig();

      const required = [
        'apiBaseUrl',
        'cognitoUserPoolId',
        'cognitoClientId',
        'testUsername',
        'testPassword',
      ];

      for (const field of required) {
        if (!config[field as keyof TestConfig]) {
          throw new Error(`Required configuration missing: ${field}`);
        }
      }

      console.debug('[ConfigService] ✓ Configuration validation passed');
    } catch (error) {
      console.error('[ConfigService] Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Get parameter from AWS SSM Parameter Store
   */
  private async getSSMParameter(
    parameterName: string,
    withDecryption = false
  ): Promise<string | null> {
    if (!this.ssmClient) {
      return null;
    }

    try {
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: withDecryption,
      });

      const response = await this.ssmClient.send(command);
      return response.Parameter?.Value || null;
    } catch (error) {
      // Parameter not found is expected - return null to try next source
      if ((error as any).name === 'ParameterNotFound') {
        return null;
      }

      console.warn(`[ConfigService] Failed to get SSM parameter ${parameterName}:`, error);
      return null;
    }
  }

  /**
   * Check if cached configuration is still valid
   */
  private isCacheValid(cache: ConfigCache): boolean {
    return Date.now() - cache.loadedAt < this.cacheTTL;
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache = null;
    console.debug('[ConfigService] Configuration cache cleared');
  }
}
