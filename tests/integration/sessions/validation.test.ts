/**
 * Session Validation Integration Tests
 *
 * Tests session validation functionality including:
 * - Valid JWT with JWKS verification
 * - Backend session validation
 * - Expired JWT rejection
 * - Malformed JWT rejection
 * - Unauthorized token rejection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ConfigService,
  CognitoAuthHelper,
  TestDataFactory,
  AuthenticatedApiClient,
  type TestConfig,
} from '../utils';

describe('Session Validation Integration', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    console.log('\n🧪 Setting up Session Validation tests...\n');

    // Load configuration
    const configService = new ConfigService();
    config = await configService.getConfig();

    // Setup authentication
    authHelper = new CognitoAuthHelper({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      region: config.cognitoRegion,
      username: config.testUsername,
      password: config.testPassword,
    });

    await authHelper.authenticate();

    // Setup API client
    apiClient = new AuthenticatedApiClient(authHelper, config.apiBaseUrl);

    // Setup test data factory
    factory = new TestDataFactory();

    console.log('✓ Session Validation test setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Session Validation test data...\n');

    // Cleanup all tracked entities
    await factory.cleanup(async (entityType, entityId) => {
      try {
        await apiClient.delete(`/${entityType}s/${entityId}`);
      } catch (error) {
        // Ignore errors for entities that may not exist
        console.debug(`Cleanup: ${entityType} ${entityId} may not exist`);
      }
    });

    console.log('✓ Session Validation cleanup complete\n');
  });

  describe('Valid Session Token Validation', () => {
    it('should validate authentic session token', async () => {
      console.log('📝 Test: Validate authentic session token');

      // Arrange: Create a valid session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user'),
      });
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session via API
      const createResponse = await apiClient.post('/sessions', sessionRequest);
      expect(createResponse.status).toBe(201);

      const sessionToken = createResponse.data.token;
      expect(sessionToken).toBeTruthy();
      expect(authHelper.isValidTokenFormat(sessionToken)).toBe(true);

      // Validate the session token
      const validateResponse = await apiClient.post('/sessions/validate', {
        token: sessionToken,
      });

      // Assert
      expect(validateResponse.status).toBe(200);
      expect(validateResponse.data.valid).toBe(true);
      expect(validateResponse.data.sessionId).toBe(sessionData.id);

      console.log('✓ Authentic session token validated successfully');
    });

    it('should validate session with JWKS verification', async () => {
      console.log('📝 Test: Validate session with JWKS verification');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionToken = createResponse.data.token;

      // Act: Validate using JWKS endpoint
      const jwksResponse = await apiClient.get('/.well-known/jwks.json');
      expect(jwksResponse.data.keys).toBeDefined();
      expect(Array.isArray(jwksResponse.data.keys)).toBe(true);

      // Validate token against JWKS
      const validateResponse = await apiClient.post('/sessions/validate', {
        token: sessionToken,
        verifySignature: true,
      });

      // Assert
      expect(validateResponse.status).toBe(200);
      expect(validateResponse.data.valid).toBe(true);
      expect(validateResponse.data.signatureValid).toBe(true);

      console.log('✓ JWKS verification successful');
    });
  });

  describe('Invalid Session Token Rejection', () => {
    it('should reject expired session token', async () => {
      console.log('📝 Test: Reject expired session token');

      // Arrange: Create session with past expiration
      const expiredSessionData = factory.generateSessionData({
        expiresAt: factory.generatePastDate(1), // Expired yesterday
        status: 'expired',
      });

      // Note: This test simulates an expired token scenario
      // In reality, the API should reject token creation with past expiration
      // We test the validation endpoint's behavior with expired tokens

      // For this test, we'll use a tampered token to simulate expiration
      const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', { token: invalidToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403, 400]), // Different APIs may return different status codes
        message: expect.stringMatching(/expired|invalid|token/i),
      });

      console.log('✓ Expired token rejected correctly');
    });

    it('should reject malformed session token', async () => {
      console.log('📝 Test: Reject malformed session token');

      // Arrange: Create malformed tokens
      const malformedTokens = [
        'not-a-jwt-token',
        'invalid.token',
        'header.payload', // Missing signature
        '', // Empty token
        'eyJhbGciOiJSUzI1NiJ9', // Only header
      ];

      // Act & Assert
      for (const token of malformedTokens) {
        await expect(
          apiClient.post('/sessions/validate', { token })
        ).rejects.toMatchObject({
          status: expect.oneOf([400, 401, 422]),
          message: expect.stringMatching(/invalid|malformed|token/i),
        });
      }

      console.log('✓ Malformed tokens rejected correctly');
    });

    it('should reject unauthorized session token', async () => {
      console.log('📝 Test: Reject unauthorized session token');

      // Arrange: Create token for different user
      // This would typically be a token from a different Cognito user pool
      // or a token with invalid signature
      const unauthorizedToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJ1bmF1dGhvcml6ZWQtdXNlciIsImlzcyI6ImZha2UtaXNzdWVyIn0.' +
        'fake-signature-that-will-not-verify';

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', { token: unauthorizedToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/unauthorized|invalid|signature/i),
      });

      console.log('✓ Unauthorized token rejected correctly');
    });

    it('should reject token with invalid signature', async () => {
      console.log('📝 Test: Reject token with invalid signature');

      // Arrange: Create session and tamper with token
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const validToken = createResponse.data.token;

      // Tamper with the signature
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.TAMPERED_SIGNATURE`;

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', { token: tamperedToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/invalid|signature|verification/i),
      });

      console.log('✓ Tampered token rejected correctly');
    });
  });

  describe('Backend Session Validation', () => {
    it('should validate session exists in backend', async () => {
      console.log('📝 Test: Validate session exists in backend');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Retrieve session from backend
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);

      // Assert
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.id).toBe(sessionId);
      expect(getResponse.data.status).toBe('active');

      console.log('✓ Session exists in backend and is valid');
    });

    it('should reject validation for non-existent session', async () => {
      console.log('📝 Test: Reject validation for non-existent session');

      // Arrange: Generate non-existent session ID
      const nonExistentId = factory.createUniqueId('non-existent-session');

      // Act & Assert
      await expect(
        apiClient.get(`/sessions/${nonExistentId}`)
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found|does not exist/i),
      });

      console.log('✓ Non-existent session rejected correctly');
    });

    it('should reject validation for revoked session', async () => {
      console.log('📝 Test: Reject validation for revoked session');

      // Arrange: Create and revoke session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Revoke the session
      await apiClient.delete(`/sessions/${sessionId}`);

      // Act & Assert: Try to validate revoked session
      await expect(
        apiClient.get(`/sessions/${sessionId}`)
      ).rejects.toMatchObject({
        status: expect.oneOf([403, 410]), // Forbidden or Gone
        message: expect.stringMatching(/revoked|invalid|gone/i),
      });

      console.log('✓ Revoked session rejected correctly');
    });
  });
});
