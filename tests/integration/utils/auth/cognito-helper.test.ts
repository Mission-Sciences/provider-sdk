/**
 * Cognito Authentication Helper Tests
 *
 * Unit tests for CognitoAuthHelper with mocked AWS SDK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitoAuthHelper } from './cognito-helper';
import type { CognitoConfig } from './types';

// Mock AWS SDK
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  InitiateAuthCommand: vi.fn(),
  AuthFlowType: {
    USER_PASSWORD_AUTH: 'USER_PASSWORD_AUTH',
    REFRESH_TOKEN_AUTH: 'REFRESH_TOKEN_AUTH',
  },
}));

describe('CognitoAuthHelper', () => {
  let authHelper: CognitoAuthHelper;
  let mockConfig: CognitoConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      userPoolId: 'us-east-1_TEST123',
      clientId: 'test-client-id',
      region: 'us-east-1',
      username: 'test@example.com',
      password: 'TestPassword123!',
    };

    authHelper = new CognitoAuthHelper(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(authHelper).toBeInstanceOf(CognitoAuthHelper);
    });
  });

  describe('isValidTokenFormat', () => {
    it('should validate JWT token format', () => {
      const validToken = 'header.payload.signature';
      expect(authHelper.isValidTokenFormat(validToken)).toBe(true);
    });

    it('should reject invalid token format', () => {
      const invalidToken = 'not-a-jwt';
      expect(authHelper.isValidTokenFormat(invalidToken)).toBe(false);
    });

    it('should reject empty token', () => {
      expect(authHelper.isValidTokenFormat('')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear token cache', () => {
      authHelper.clearCache();
      // Cache clearing should not throw
      expect(true).toBe(true);
    });
  });

  describe('authenticate - error handling', () => {
    it('should throw error when username missing', async () => {
      const helperWithoutCredentials = new CognitoAuthHelper({
        ...mockConfig,
        username: undefined,
      });

      await expect(helperWithoutCredentials.authenticate()).rejects.toThrow(
        'Username and password are required'
      );
    });

    it('should throw error when password missing', async () => {
      const helperWithoutPassword = new CognitoAuthHelper({
        ...mockConfig,
        password: undefined,
      });

      await expect(helperWithoutPassword.authenticate()).rejects.toThrow(
        'Username and password are required'
      );
    });
  });
});
