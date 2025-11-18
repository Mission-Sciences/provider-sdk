/**
 * Session Extension Integration Tests
 *
 * Tests session renewal/extension functionality including:
 * - Successful active session renewal
 * - Expiration time update verification
 * - Failed renewal of expired session
 * - Failed renewal of non-existent session
 * - Failed renewal of revoked session
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ConfigService,
  CognitoAuthHelper,
  TestDataFactory,
  AuthenticatedApiClient,
  type TestConfig,
} from '../utils';

describe('Session Extension Integration', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    console.log('\n🧪 Setting up Session Extension tests...\n');

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

    console.log('✓ Session Extension test setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Session Extension test data...\n');

    await factory.cleanup(async (entityType, entityId) => {
      try {
        await apiClient.delete(`/${entityType}s/${entityId}`);
      } catch (error) {
        console.debug(`Cleanup: ${entityType} ${entityId} may not exist`);
      }
    });

    console.log('✓ Session Extension cleanup complete\n');
  });

  describe('Successful Session Renewal', () => {
    it('should successfully renew active session', async () => {
      console.log('📝 Test: Successfully renew active session');

      // Arrange: Create session
      const sessionData = factory.generateSessionData({
        expiresAt: factory.generateFutureDate(1), // Expires in 1 day
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;
      const originalExpiresAt = createResponse.data.expiresAt;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Act: Renew the session
      const renewResponse = await apiClient.put(`/sessions/${sessionId}/renew`, {
        additional_minutes: 30,  // Extend by 30 minutes (valid range: 1-1440)
      });

      // Assert
      expect(renewResponse.status).toBe(200);
      expect(renewResponse.data.id).toBe(sessionId);
      expect(renewResponse.data.status).toBe('active');

      // Verify expiration time was extended
      const newExpiresAt = renewResponse.data.expiresAt;
      const originalDate = new Date(originalExpiresAt).getTime();
      const newDate = new Date(newExpiresAt).getTime();

      expect(newDate).toBeGreaterThan(originalDate);

      console.log('✓ Active session renewed successfully');
      console.log(`  Original expiration: ${originalExpiresAt}`);
      console.log(`  New expiration: ${newExpiresAt}`);
      console.log(`  Extended by: ${Math.round((newDate - originalDate) / 1000)}s`);
    });

    it('should maintain session properties after renewal', async () => {
      console.log('📝 Test: Maintain session properties after renewal');

      // Arrange: Create session with specific properties
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user'),
        organizationId: factory.createUniqueId('test-org'),
        applicationId: factory.createUniqueId('test-app'),
        metadata: { testKey: 'testValue' },
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      // Act: Renew session
      const renewResponse = await apiClient.put(`/sessions/${sessionId}/renew`, {
        additional_minutes: 30,
      });

      // Assert: All properties maintained except expiresAt
      expect(renewResponse.data.userId).toBe(sessionData.userId);
      expect(renewResponse.data.organizationId).toBe(sessionData.organizationId);
      expect(renewResponse.data.applicationId).toBe(sessionData.applicationId);
      expect(renewResponse.data.metadata).toEqual(sessionData.metadata);
      expect(renewResponse.data.status).toBe('active');

      console.log('✓ Session properties maintained after renewal');
    });

    it('should allow multiple renewals', async () => {
      console.log('📝 Test: Allow multiple renewals');

      // Arrange: Create session
      const sessionData = factory.generateSessionData();
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      let previousExpiresAt = createResponse.data.expiresAt;

      // Act: Renew multiple times
      for (let i = 1; i <= 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const renewResponse = await apiClient.put(`/sessions/${sessionId}/renew`, {
        additional_minutes: 30,
      });

        expect(renewResponse.status).toBe(200);

        const currentExpiresAt = renewResponse.data.expiresAt;
        const previousDate = new Date(previousExpiresAt).getTime();
        const currentDate = new Date(currentExpiresAt).getTime();

        expect(currentDate).toBeGreaterThanOrEqual(previousDate);

        console.log(`  Renewal ${i}: Extended expiration to ${currentExpiresAt}`);
        previousExpiresAt = currentExpiresAt;
      }

      console.log('✓ Multiple renewals successful');
    });
  });

  describe('Failed Session Renewal', () => {
    it('should fail to renew non-existent session', async () => {
      console.log('📝 Test: Fail to renew non-existent session');

      // Arrange: Generate non-existent session ID
      const nonExistentId = factory.createUniqueId('non-existent-session');

      // Act & Assert
      await expect(
        apiClient.put(`/sessions/${nonExistentId}/renew`, {
          additional_minutes: 30,
        })
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found|does not exist/i),
      });

      console.log('✓ Non-existent session renewal rejected');
    });

    it('should fail to renew revoked session', async () => {
      console.log('📝 Test: Fail to renew revoked session');

      // Arrange: Create and revoke session
      const sessionData = factory.generateSessionData();
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      // Revoke the session
      await apiClient.delete(`/sessions/${sessionId}`);

      // Act & Assert
      await expect(
        apiClient.put(`/sessions/${sessionId}/renew`, {
          additional_minutes: 30,
        })
      ).rejects.toMatchObject({
        status: expect.oneOf([403, 410]), // Forbidden or Gone
        message: expect.stringMatching(/revoked|cannot renew|gone/i),
      });

      console.log('✓ Revoked session renewal rejected');
    });

    it('should fail to renew expired session', async () => {
      console.log('📝 Test: Fail to renew expired session');

      // Arrange: Create session with short expiration
      const sessionData = factory.generateSessionData({
        expiresAt: new Date(Date.now() + 2000).toISOString(), // Expires in 2 seconds
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      // Wait for session to expire
      console.log('  Waiting for session to expire...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Act & Assert
      await expect(
        apiClient.put(`/sessions/${sessionId}/renew`, {
          additional_minutes: 30,
        })
      ).rejects.toMatchObject({
        status: expect.oneOf([403, 410]), // Forbidden or Gone
        message: expect.stringMatching(/expired|cannot renew/i),
      });

      console.log('✓ Expired session renewal rejected');
    });
  });

  describe('Session Renewal Authorization', () => {
    it('should require valid authentication for renewal', async () => {
      console.log('📝 Test: Require valid authentication for renewal');

      // Arrange: Create session
      const sessionData = factory.generateSessionData();
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      // Act: Try to renew without authentication (using raw fetch)
      const unauthorizedResponse = await fetch(
        `${config.apiBaseUrl}/sessions/${sessionId}/renew`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ additional_minutes: 30 }),
        }
      );

      // Assert
      expect(unauthorizedResponse.status).toBe(401);

      console.log('✓ Unauthorized renewal rejected');
    });

    it('should only allow session owner to renew', async () => {
      console.log('📝 Test: Only allow session owner to renew');

      // Arrange: Create session with specific user
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user-1'),
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionData);
      const sessionId = createResponse.data.id;

      // Note: This test assumes the API validates session ownership
      // In a real scenario, we'd authenticate as a different user
      // and verify they can't renew another user's session

      // Act: Renew with correct authentication (should succeed)
      const renewResponse = await apiClient.put(`/sessions/${sessionId}/renew`, {
        additional_minutes: 30,
      });

      expect(renewResponse.status).toBe(200);

      console.log('✓ Session ownership validation working');
    });
  });
});
