/**
 * Environment Configuration Tests
 *
 * Tests for demo environment configuration functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  Environment,
  ENVIRONMENT_CONFIGS,
  getEnvironmentConfig,
  createSDKConfig,
} from '../../src';

describe('Environment Configuration', () => {
  describe('ENVIRONMENT_CONFIGS', () => {
    it('should have production configuration', () => {
      expect(ENVIRONMENT_CONFIGS.production).toBeDefined();
      expect(ENVIRONMENT_CONFIGS.production.jwksUri).toBe('https://api.generalwisdom.com/.well-known/jwks.json');
      expect(ENVIRONMENT_CONFIGS.production.apiEndpoint).toBe('https://sdk.platform.generalwisdom.com/v1');
      expect(ENVIRONMENT_CONFIGS.production.marketplaceUrl).toBe('https://d3p2yqofgy75sz.cloudfront.net/');
      expect(ENVIRONMENT_CONFIGS.production.issuer).toBe('generalwisdom.com');
    });

    it('should have demo configuration', () => {
      expect(ENVIRONMENT_CONFIGS.demo).toBeDefined();
      expect(ENVIRONMENT_CONFIGS.demo.jwksUri).toBe('https://demo-api.generalwisdom.com/.well-known/jwks.json');
      expect(ENVIRONMENT_CONFIGS.demo.apiEndpoint).toBe('https://sdk.demo.generalwisdom.com/v1');
      expect(ENVIRONMENT_CONFIGS.demo.marketplaceUrl).toBe('https://demo.generalwisdom.com/');
      expect(ENVIRONMENT_CONFIGS.demo.issuer).toBe('demo.generalwisdom.com');
    });

    it('should have dev configuration', () => {
      expect(ENVIRONMENT_CONFIGS.dev).toBeDefined();
      expect(ENVIRONMENT_CONFIGS.dev.jwksUri).toBe('https://api.dev.generalwisdom.com/.well-known/jwks.json');
      expect(ENVIRONMENT_CONFIGS.dev.apiEndpoint).toBe('https://sdk.dev.generalwisdom.com/v1');
      expect(ENVIRONMENT_CONFIGS.dev.marketplaceUrl).toBe('https://dev.generalwisdom.com/');
      expect(ENVIRONMENT_CONFIGS.dev.issuer).toBe('generalwisdom.com');
    });

    it('should have /v1 suffix on all apiEndpoint URLs', () => {
      const environments: Array<'production' | 'demo' | 'dev'> = ['production', 'demo', 'dev'];

      environments.forEach((env) => {
        const config = ENVIRONMENT_CONFIGS[env];
        expect(config.apiEndpoint).toMatch(/^https:\/\/sdk\.[a-z.]*generalwisdom\.com\/v1$/);
        expect(config.apiEndpoint.endsWith('/v1')).toBe(true);
      });
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return production config for production environment', () => {
      const config = getEnvironmentConfig('production');
      expect(config).toEqual(ENVIRONMENT_CONFIGS.production);
    });

    it('should return demo config for demo environment', () => {
      const config = getEnvironmentConfig('demo');
      expect(config).toEqual(ENVIRONMENT_CONFIGS.demo);
    });

    it('should return dev config for dev environment', () => {
      const config = getEnvironmentConfig('dev');
      expect(config).toEqual(ENVIRONMENT_CONFIGS.dev);
    });
  });

  describe('createSDKConfig', () => {
    it('should create SDK config for production environment', () => {
      const config = createSDKConfig('production', { applicationId: 'test-app' });

      expect(config.environment).toBe('production');
      expect(config.jwksUri).toBe('https://api.generalwisdom.com/.well-known/jwks.json');
      expect(config.apiEndpoint).toBe('https://sdk.platform.generalwisdom.com/v1');
      expect(config.marketplaceUrl).toBe('https://d3p2yqofgy75sz.cloudfront.net/');
      expect(config.applicationId).toBe('test-app');
    });

    it('should create SDK config for demo environment', () => {
      const config = createSDKConfig('demo', { applicationId: 'test-app' });

      expect(config.environment).toBe('demo');
      expect(config.jwksUri).toBe('https://demo-api.generalwisdom.com/.well-known/jwks.json');
      expect(config.apiEndpoint).toBe('https://sdk.demo.generalwisdom.com/v1');
      expect(config.marketplaceUrl).toBe('https://demo.generalwisdom.com/');
      expect(config.applicationId).toBe('test-app');
    });

    it('should create SDK config for dev environment', () => {
      const config = createSDKConfig('dev', { applicationId: 'test-app' });

      expect(config.environment).toBe('dev');
      expect(config.jwksUri).toBe('https://api.dev.generalwisdom.com/.well-known/jwks.json');
      expect(config.apiEndpoint).toBe('https://sdk.dev.generalwisdom.com/v1');
      expect(config.marketplaceUrl).toBe('https://dev.generalwisdom.com/');
      expect(config.applicationId).toBe('test-app');
    });

    it('should allow overriding environment defaults', () => {
      const config = createSDKConfig('demo', {
        applicationId: 'test-app',
        jwksUri: 'https://custom-jwks.example.com/.well-known/jwks.json',
      });

      expect(config.environment).toBe('demo');
      expect(config.jwksUri).toBe('https://custom-jwks.example.com/.well-known/jwks.json');
      expect(config.apiEndpoint).toBe('https://sdk.demo.generalwisdom.com/v1');
    });

    it('should preserve other SDK config options', () => {
      const config = createSDKConfig('demo', {
        applicationId: 'test-app',
        debug: true,
        warningThresholdSeconds: 120,
        enableHeartbeat: true,
      });

      expect(config.debug).toBe(true);
      expect(config.warningThresholdSeconds).toBe(120);
      expect(config.enableHeartbeat).toBe(true);
    });
  });
});

describe('Environment Type', () => {
  it('should accept valid environment values', () => {
    const prodEnv: Environment = 'production';
    const demoEnv: Environment = 'demo';
    const devEnv: Environment = 'dev';

    expect(prodEnv).toBe('production');
    expect(demoEnv).toBe('demo');
    expect(devEnv).toBe('dev');
  });
});
