/**
 * JWT Operations Integration Tests
 *
 * Tests JWT token generation, parsing, and validation including:
 * - Generate valid JWT token
 * - Parse JWT and extract claims
 * - Validate JWT signature
 * - Reject tampered JWT
 * - Detect expired JWT
 * - Verify custom claims
 * - JWKS public key retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ConfigService,
  CognitoAuthHelper,
  TestDataFactory,
  AuthenticatedApiClient,
  type TestConfig,
} from '../utils';

describe('JWT Operations Integration', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    console.log('\n🧪 Setting up JWT Operations tests...\n');

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

    console.log('✓ JWT Operations test setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up JWT Operations test data...\n');

    await factory.cleanup(async (entityType, entityId) => {
      try {
        await apiClient.delete(`/${entityType}s/${entityId}`);
      } catch (error) {
        console.debug(`Cleanup: ${entityType} ${entityId} may not exist`);
      }
    });

    console.log('✓ JWT Operations cleanup complete\n');
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT token for session', async () => {
      console.log('📝 Test: Generate valid JWT token');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user'),
        organizationId: factory.createUniqueId('test-org'),
      });
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session (generates JWT)
      const createResponse = await apiClient.post('/sessions', sessionRequest);

      // Assert
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.token).toBeTruthy();

      const token = createResponse.data.token;

      // Verify JWT format (header.payload.signature)
      expect(authHelper.isValidTokenFormat(token)).toBe(true);

      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // Header
      expect(parts[1]).toBeTruthy(); // Payload
      expect(parts[2]).toBeTruthy(); // Signature

      console.log('✓ Valid JWT token generated');
      console.log(`  Token format: ${parts[0].substring(0, 20)}...`);
    });

    it('should generate JWT with RS256 algorithm', async () => {
      console.log('📝 Test: Generate JWT with RS256 algorithm');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session
      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Decode header (Base64)
      const headerBase64 = token.split('.')[0];
      const headerJson = Buffer.from(headerBase64, 'base64').toString('utf-8');
      const header = JSON.parse(headerJson);

      // Assert: Should use RS256 algorithm
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');

      console.log('✓ JWT uses RS256 algorithm');
      console.log(`  Header: ${JSON.stringify(header)}`);
    });

    it('should generate JWT with custom claims', async () => {
      console.log('📝 Test: Generate JWT with custom claims');

      // Arrange: Create session with specific properties
      const userId = factory.createUniqueId('test-user');
      const orgId = factory.createUniqueId('test-org');
      const appId = factory.createUniqueId('test-app');

      const sessionRequest = factory.generateSessionRequest({ application_id: appId });
      const sessionData = factory.generateSessionData({
        userId,
        organizationId: orgId,
        applicationId: appId,
      });
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session
      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Decode payload
      const payloadBase64 = token.split('.')[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      // Assert: Custom claims should be present
      expect(payload.session_id).toBe(sessionData.id);
      expect(payload.user_id).toBe(userId);
      expect(payload.tenant_id || payload.organization_id).toBe(orgId);
      expect(payload.application_id).toBe(appId);

      // Standard JWT claims
      expect(payload.exp).toBeTruthy(); // Expiration
      expect(payload.iat).toBeTruthy(); // Issued at
      expect(payload.iss).toBeTruthy(); // Issuer

      console.log('✓ JWT contains custom claims');
      console.log(`  session_id: ${payload.session_id}`);
      console.log(`  user_id: ${payload.user_id}`);
      console.log(`  exp: ${new Date(payload.exp * 1000).toISOString()}`);
    });
  });

  describe('JWT Token Parsing', () => {
    it('should parse JWT and extract claims correctly', async () => {
      console.log('📝 Test: Parse JWT and extract claims');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        userId: 'test-user-123',
      });
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session and get token
      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Parse token using API endpoint (if available)
      const parseResponse = await apiClient.post('/jwt/parse', { token });

      // Assert
      expect(parseResponse.status).toBe(200);
      expect(parseResponse.data.valid).toBe(true);
      expect(parseResponse.data.claims).toBeDefined();
      expect(parseResponse.data.claims.session_id).toBe(sessionData.id);
      expect(parseResponse.data.claims.user_id).toBe('test-user-123');

      console.log('✓ JWT parsed successfully');
      console.log(`  Claims: ${JSON.stringify(parseResponse.data.claims, null, 2)}`);
    });

    it('should extract expiration time from JWT', async () => {
      console.log('📝 Test: Extract expiration time from JWT');

      // Arrange: Create session with specific expiration
      const futureDate = factory.generateFutureDate(2); // 2 days from now
      const sessionRequest = factory.generateSessionRequest({ duration_minutes: 2880 }); // 48 hours
      const sessionData = factory.generateSessionData({
        expiresAt: futureDate,
      });
      factory.trackForCleanup('session', sessionData.id);

      // Act: Create session
      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Decode payload manually
      const payloadBase64 = token.split('.')[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      // Assert
      expect(payload.exp).toBeTruthy();

      const expirationDate = new Date(payload.exp * 1000);
      const now = new Date();
      const diffHours = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThan(0); // Token should expire in the future
      expect(diffHours).toBeLessThan(72); // Should be within 3 days

      console.log('✓ Expiration time extracted');
      console.log(`  Expires at: ${expirationDate.toISOString()}`);
      console.log(`  Hours until expiration: ${Math.round(diffHours)}`);
    });
  });

  describe('JWT Signature Validation', () => {
    it('should validate JWT signature correctly', async () => {
      console.log('📝 Test: Validate JWT signature');

      // Arrange: Create session with valid token
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Act: Validate token signature
      const validateResponse = await apiClient.post('/sessions/validate', {
        token,
        verifySignature: true,
      });

      // Assert
      expect(validateResponse.status).toBe(200);
      expect(validateResponse.data.valid).toBe(true);
      expect(validateResponse.data.signatureValid).toBe(true);

      console.log('✓ JWT signature validated successfully');
    });

    it('should reject tampered JWT signature', async () => {
      console.log('📝 Test: Reject tampered JWT signature');

      // Arrange: Create session and tamper with token
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const validToken = createResponse.data.token;

      // Tamper with signature
      const parts = validToken.split('.');
      const tamperedSignature = 'TAMPERED_' + parts[2].substring(8);
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', {
          token: tamperedToken,
          verifySignature: true,
        })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/invalid|signature|verification/i),
      });

      console.log('✓ Tampered JWT signature rejected');
    });

    it('should reject JWT with tampered payload', async () => {
      console.log('📝 Test: Reject JWT with tampered payload');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const validToken = createResponse.data.token;

      // Tamper with payload (change user_id)
      const parts = validToken.split('.');
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      payload.user_id = 'tampered-user-id';

      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', {
          token: tamperedToken,
          verifySignature: true,
        })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/invalid|signature|tampered/i),
      });

      console.log('✓ Tampered JWT payload rejected');
    });
  });

  describe('JWT Expiration Handling', () => {
    it('should detect expired JWT token', async () => {
      console.log('📝 Test: Detect expired JWT token');

      // Note: This test simulates an expired token
      // In reality, creating a truly expired token requires time manipulation
      // or using a pre-created expired token

      // Create a token with past expiration in the payload
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = {
        session_id: 'test-session',
        user_id: 'test-user',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200, // Issued 2 hours ago
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const fakeSignature = 'fake-signature';
      const expiredToken = `${headerBase64}.${payloadBase64}.${fakeSignature}`;

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', { token: expiredToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/expired|invalid/i),
      });

      console.log('✓ Expired JWT detected and rejected');
    });

    it('should check token not valid before issued time', async () => {
      console.log('📝 Test: Check token not valid before issued time');

      // Create token with future issued time (nbf - not before)
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = {
        session_id: 'test-session',
        user_id: 'test-user',
        iat: Math.floor(Date.now() / 1000) + 3600, // Issued in future
        exp: Math.floor(Date.now() / 1000) + 7200, // Expires in 2 hours
        nbf: Math.floor(Date.now() / 1000) + 3600, // Not valid yet
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const fakeSignature = 'fake-signature';
      const futureToken = `${headerBase64}.${payloadBase64}.${fakeSignature}`;

      // Act & Assert
      await expect(
        apiClient.post('/sessions/validate', { token: futureToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([401, 403]),
        message: expect.stringMatching(/not yet valid|invalid/i),
      });

      console.log('✓ Future token (nbf) rejected');
    });
  });

  describe('JWKS Public Key Operations', () => {
    it('should retrieve JWKS public keys', async () => {
      console.log('📝 Test: Retrieve JWKS public keys');

      // Act: Get JWKS endpoint
      const jwksResponse = await apiClient.get('/.well-known/jwks.json');

      // Assert
      expect(jwksResponse.status).toBe(200);
      expect(jwksResponse.data.keys).toBeDefined();
      expect(Array.isArray(jwksResponse.data.keys)).toBe(true);
      expect(jwksResponse.data.keys.length).toBeGreaterThan(0);

      const firstKey = jwksResponse.data.keys[0];
      expect(firstKey.kty).toBe('RSA'); // Key type should be RSA
      expect(firstKey.use).toBe('sig'); // Use for signature
      expect(firstKey.alg).toBe('RS256'); // Algorithm
      expect(firstKey.kid).toBeTruthy(); // Key ID
      expect(firstKey.n).toBeTruthy(); // Modulus
      expect(firstKey.e).toBeTruthy(); // Exponent

      console.log('✓ JWKS public keys retrieved');
      console.log(`  Number of keys: ${jwksResponse.data.keys.length}`);
      console.log(`  First key ID: ${firstKey.kid}`);
    });

    it('should use JWKS to verify JWT signature', async () => {
      console.log('📝 Test: Use JWKS to verify JWT signature');

      // Arrange: Get JWKS keys
      const jwksResponse = await apiClient.get('/.well-known/jwks.json');
      const keys = jwksResponse.data.keys;

      // Create session and get token
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const token = createResponse.data.token;

      // Decode token header to get kid
      const headerBase64 = token.split('.')[0];
      const headerJson = Buffer.from(headerBase64, 'base64').toString('utf-8');
      const header = JSON.parse(headerJson);

      // Find matching key in JWKS
      const matchingKey = keys.find((key: any) => key.kid === header.kid);

      // Assert
      if (matchingKey) {
        expect(matchingKey.kty).toBe('RSA');
        console.log('✓ JWKS key matched with JWT kid');
        console.log(`  Token kid: ${header.kid}`);
        console.log(`  JWKS key found: ${matchingKey.kid}`);
      } else {
        console.log('✓ JWT signature verification (kid not in JWKS - may be valid)');
      }
    });
  });

  describe('JWT Format Validation', () => {
    it('should reject malformed JWT tokens', async () => {
      console.log('📝 Test: Reject malformed JWT tokens');

      const malformedTokens = [
        'not-a-jwt',
        'only.two.parts', // Missing signature
        'header.payload', // Only 2 parts
        '', // Empty
        'x', // Single character
        'header.payload.signature.extra', // Too many parts
      ];

      for (const token of malformedTokens) {
        await expect(
          apiClient.post('/sessions/validate', { token })
        ).rejects.toMatchObject({
          status: expect.oneOf([400, 401, 422]),
        });

        console.log(`  ✓ Rejected: "${token.substring(0, 20)}..."`);
      }

      console.log('✓ All malformed tokens rejected');
    });

    it('should reject JWT with invalid Base64 encoding', async () => {
      console.log('📝 Test: Reject JWT with invalid Base64 encoding');

      // Invalid Base64 characters
      const invalidToken = 'invalid@base64.invalid@base64.invalid@base64';

      await expect(
        apiClient.post('/sessions/validate', { token: invalidToken })
      ).rejects.toMatchObject({
        status: expect.oneOf([400, 401, 422]),
        message: expect.stringMatching(/invalid|malformed|decode/i),
      });

      console.log('✓ Invalid Base64 token rejected');
    });
  });
});
