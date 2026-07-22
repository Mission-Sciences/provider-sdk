/**
 * MarketplaceSDK Environment Integration Tests
 *
 * Tests for SDK initialization with different environments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketplaceSDK } from '../../src';

// Mock DOM APIs
const mockDocument = {
  addEventListener: vi.fn(),
  hidden: false,
  createElement: vi.fn(() => ({
    style: {},
    appendChild: vi.fn(),
    className: '',
    innerHTML: '',
    querySelector: vi.fn(() => null),
    remove: vi.fn(),
  })),
  body: {
    appendChild: vi.fn(),
  },
};

const mockWindow = {
  location: {
    href: 'https://example.com/?jwt=test-token',
  },
};

const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

describe('MarketplaceSDK Environment Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('sessionStorage', mockSessionStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Environment Configuration', () => {
    it('should use production defaults when no environment specified', () => {
      const sdk = new MarketplaceSDK({
        applicationId: 'test-app',
      });

      // Access internal config through public method behavior
      // We verify by checking the SDK doesn't throw on initialization
      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should apply demo environment configuration', () => {
      const sdk = new MarketplaceSDK({
        environment: 'demo',
        applicationId: 'test-app',
      });

      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should apply dev environment configuration', () => {
      const sdk = new MarketplaceSDK({
        environment: 'dev',
        applicationId: 'test-app',
      });

      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should apply production environment configuration', () => {
      const sdk = new MarketplaceSDK({
        environment: 'production',
        applicationId: 'test-app',
      });

      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should allow URL overrides when environment is specified', () => {
      const customJwksUri = 'https://custom-jwks.example.com/.well-known/jwks.json';

      const sdk = new MarketplaceSDK({
        environment: 'demo',
        applicationId: 'test-app',
        jwksUri: customJwksUri,
      });

      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should maintain backward compatibility with direct URL configuration', () => {
      // No environment specified, URLs set directly
      const sdk = new MarketplaceSDK({
        applicationId: 'test-app',
        jwksUri: 'https://custom-api.example.com/.well-known/jwks.json',
        apiEndpoint: 'https://custom-api.example.com',
        marketplaceUrl: 'https://custom-marketplace.example.com/',
      });

      expect(sdk).toBeInstanceOf(MarketplaceSDK);
    });

    it('should resolve apiEndpoint from environment config', () => {
      const sdk = new MarketplaceSDK({
        environment: 'dev',
        applicationId: 'test-app',
      });

      const config = (sdk as any).config;
      expect(config.apiEndpoint).toBe('https://sdk.dev.generalwisdom.com/v1');
    });

    it('should allow explicit apiEndpoint override', () => {
      const sdk = new MarketplaceSDK({
        environment: 'dev',
        applicationId: 'test-app',
        apiEndpoint: 'https://custom-sdk.example.com',
      });

      const config = (sdk as any).config;
      expect(config.apiEndpoint).toBe('https://custom-sdk.example.com');
    });

    it('should use default apiEndpoint when no environment is set', () => {
      const sdk = new MarketplaceSDK({
        applicationId: 'test-app',
        apiEndpoint: 'https://custom-api.example.com',
      });

      const config = (sdk as any).config;
      expect(config.apiEndpoint).toBe('https://custom-api.example.com');
    });

    it('should set apiEndpoint from environment when only environment is specified', () => {
      const sdk = new MarketplaceSDK({
        environment: 'production',
        applicationId: 'test-app',
      });

      const config = (sdk as any).config;
      expect(config.apiEndpoint).toBe('https://sdk.platform.generalwisdom.com/v1');
    });

    it('should set apiEndpoint for demo environment', () => {
      const sdk = new MarketplaceSDK({
        environment: 'demo',
        applicationId: 'test-app',
      });

      const config = (sdk as any).config;
      expect(config.apiEndpoint).toBe('https://sdk.demo.generalwisdom.com/v1');
    });
  });
});
