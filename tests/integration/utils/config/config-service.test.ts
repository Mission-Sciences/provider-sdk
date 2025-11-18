/**
 * Configuration Service Tests
 *
 * Unit tests for ConfigService with mocked AWS SDK and environment variables.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from './config-service';

// Mock AWS SDK
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetParameterCommand: vi.fn(),
}));

describe('ConfigService', () => {
  let configService: ConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment variables
    process.env.API_BASE_URL = 'https://api.test.com';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST123';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_REGION = 'us-east-1';
    process.env.TEST_USERNAME = 'test@example.com';
    process.env.TEST_PASSWORD = 'TestPassword123!';
    process.env.AWS_REGION = 'us-east-1';

    configService = new ConfigService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(configService).toBeInstanceOf(ConfigService);
    });
  });

  describe('getTestEnvironment', () => {
    it('should return TEST_ENV when set', () => {
      process.env.TEST_ENV = 'integration';
      const result = configService.getTestEnvironment();
      expect(result).toBe('integration');
    });

    it('should default to NODE_ENV when TEST_ENV not set', () => {
      delete process.env.TEST_ENV;
      process.env.NODE_ENV = 'test';
      const result = configService.getTestEnvironment();
      expect(result).toBe('test');
    });

    it('should default to "test" when both TEST_ENV and NODE_ENV not set', () => {
      delete process.env.TEST_ENV;
      delete process.env.NODE_ENV;
      const result = configService.getTestEnvironment();
      expect(result).toBe('test');
    });
  });

  describe('getAwsRegion', () => {
    it('should return AWS_REGION when set', () => {
      process.env.AWS_REGION = 'us-west-2';
      const result = configService.getAwsRegion();
      expect(result).toBe('us-west-2');
    });

    it('should return AWS_DEFAULT_REGION when AWS_REGION not set', () => {
      delete process.env.AWS_REGION;
      process.env.AWS_DEFAULT_REGION = 'eu-west-1';
      const result = configService.getAwsRegion();
      expect(result).toBe('eu-west-1');
    });

    it('should default to us-east-1 when no AWS region set', () => {
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;
      const result = configService.getAwsRegion();
      expect(result).toBe('us-east-1');
    });
  });

  describe('clearCache', () => {
    it('should clear configuration cache', () => {
      configService.clearCache();
      // Cache clearing should not throw
      expect(true).toBe(true);
    });
  });

  describe('getConfig - environment variables', () => {
    it('should load config from environment variables', async () => {
      const config = await configService.getConfig();

      expect(config.apiBaseUrl).toBe('https://api.test.com');
      expect(config.cognitoUserPoolId).toBe('us-east-1_TEST123');
      expect(config.cognitoClientId).toBe('test-client-id');
      expect(config.cognitoRegion).toBe('us-east-1');
      expect(config.testUsername).toBe('test@example.com');
      expect(config.testPassword).toBe('TestPassword123!');
      expect(config.awsRegion).toBe('us-east-1');
    });

    it('should use cached config on subsequent calls', async () => {
      const config1 = await configService.getConfig();
      const config2 = await configService.getConfig();

      expect(config1).toBe(config2); // Same object reference
    });

    it('should reload config after cache is cleared', async () => {
      const config1 = await configService.getConfig();
      configService.clearCache();
      const config2 = await configService.getConfig();

      expect(config1).not.toBe(config2); // Different object references
      expect(config1.apiBaseUrl).toBe(config2.apiBaseUrl); // Same values
    });
  });
});
