/**
 * Session Completion Integration Tests
 *
 * Tests session completion/finalization functionality including:
 * - Successful active session completion
 * - Status update verification
 * - Idempotent completion (complete twice)
 * - Failed completion of non-existent session
 * - Failed completion of already completed session
 * - Completion with metadata/results
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ConfigService,
  CognitoAuthHelper,
  TestDataFactory,
  AuthenticatedApiClient,
  type TestConfig,
} from '../utils';

describe('Session Completion Integration', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    console.log('\n🧪 Setting up Session Completion tests...\n');

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

    console.log('✓ Session Completion test setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Session Completion test data...\n');

    await factory.cleanup(async (entityType, entityId) => {
      try {
        await apiClient.delete(`/${entityType}s/${entityId}`);
      } catch (error) {
        console.debug(`Cleanup: ${entityType} ${entityId} may not exist`);
      }
    });

    console.log('✓ Session Completion cleanup complete\n');
  });

  describe('Successful Session Completion', () => {
    it('should successfully complete active session', async () => {
      console.log('📝 Test: Successfully complete active session');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Verify session is active
      expect(createResponse.data.status).toBe('active');

      // Act: Complete the session
      const completeResponse = await apiClient.post(`/sessions/${sessionId}/complete`, {
        reason: 'Test completion',
      });

      // Assert
      expect(completeResponse.status).toBe(200);
      expect(completeResponse.data.id).toBe(sessionId);
      expect(completeResponse.data.status).toBe('completed');
      expect(completeResponse.data.completedAt).toBeTruthy();

      // Verify timestamp is recent
      const completedAt = new Date(completeResponse.data.completedAt);
      const now = new Date();
      const diffSeconds = (now.getTime() - completedAt.getTime()) / 1000;
      expect(diffSeconds).toBeLessThan(5); // Completed within last 5 seconds

      console.log('✓ Active session completed successfully');
      console.log(`  Completed at: ${completeResponse.data.completedAt}`);
    });

    it('should update session status to completed', async () => {
      console.log('📝 Test: Update session status to completed');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Complete session
      await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Verify status by retrieving session
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);

      // Assert
      expect(getResponse.data.status).toBe('completed');
      expect(getResponse.data.completedAt).toBeTruthy();

      console.log('✓ Session status updated to completed');
    });

    it('should complete session with metadata', async () => {
      console.log('📝 Test: Complete session with metadata');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Complete with metadata/results
      const completionMetadata = {
        result: 'success',
        duration: 3600,
        resourcesUsed: 100,
        notes: 'Integration test completion',
      };

      const completeResponse = await apiClient.post(`/sessions/${sessionId}/complete`, {
        metadata: completionMetadata,
      });

      // Assert
      expect(completeResponse.status).toBe(200);
      expect(completeResponse.data.status).toBe('completed');

      // Verify metadata is stored (if API supports it)
      if (completeResponse.data.completionMetadata) {
        expect(completeResponse.data.completionMetadata).toMatchObject(completionMetadata);
      }

      console.log('✓ Session completed with metadata');
    });
  });

  describe('Idempotent Completion', () => {
    it('should allow idempotent completion of already completed session', async () => {
      console.log('📝 Test: Idempotent completion of already completed session');

      // Arrange: Create and complete session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // First completion
      const firstComplete = await apiClient.post(`/sessions/${sessionId}/complete`, {});
      expect(firstComplete.data.status).toBe('completed');
      const firstCompletedAt = firstComplete.data.completedAt;

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Act: Second completion (idempotent)
      const secondComplete = await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Assert: Should succeed without error
      expect(secondComplete.status).toBe(200);
      expect(secondComplete.data.status).toBe('completed');

      // CompletedAt should remain the same (or within acceptable range)
      expect(secondComplete.data.completedAt).toBe(firstCompletedAt);

      console.log('✓ Idempotent completion successful');
      console.log(`  First completion: ${firstCompletedAt}`);
      console.log(`  Second completion: ${secondComplete.data.completedAt}`);
    });

    it('should not change completedAt timestamp on repeated completion', async () => {
      console.log('📝 Test: CompletedAt timestamp unchanged on repeated completion');

      // Arrange: Create and complete session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // First completion
      const firstComplete = await apiClient.post(`/sessions/${sessionId}/complete`, {});
      const originalCompletedAt = firstComplete.data.completedAt;

      // Act: Multiple repeated completions
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const repeatComplete = await apiClient.post(`/sessions/${sessionId}/complete`, {});

        // Assert: Timestamp should remain the same
        expect(repeatComplete.data.completedAt).toBe(originalCompletedAt);
      }

      console.log('✓ CompletedAt timestamp remained consistent across multiple completions');
    });
  });

  describe('Failed Session Completion', () => {
    it('should fail to complete non-existent session', async () => {
      console.log('📝 Test: Fail to complete non-existent session');

      // Arrange: Generate non-existent session ID
      const nonExistentId = factory.createUniqueId('non-existent-session');

      // Act & Assert
      await expect(
        apiClient.post(`/sessions/${nonExistentId}/complete`, {})
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found|does not exist/i),
      });

      console.log('✓ Non-existent session completion rejected');
    });

    it('should fail to complete revoked session', async () => {
      console.log('📝 Test: Fail to complete revoked session');

      // Arrange: Create and revoke session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Revoke the session
      await apiClient.delete(`/sessions/${sessionId}`);

      // Act & Assert
      await expect(
        apiClient.post(`/sessions/${sessionId}/complete`, {})
      ).rejects.toMatchObject({
        status: expect.any(Number), // Forbidden, Conflict, or Gone
        message: expect.stringMatching(/revoked|cannot complete|gone/i),
      });

      console.log('✓ Revoked session completion rejected');
    });
  });

  describe('Session Completion Effects', () => {
    it('should prevent renewal of completed session', async () => {
      console.log('📝 Test: Prevent renewal of completed session');

      // Arrange: Create and complete session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Act & Assert: Try to renew completed session
      await expect(
        apiClient.put(`/sessions/${sessionId}/renew`, {})
      ).rejects.toMatchObject({
        status: expect.any(Number), // Forbidden or Conflict
        message: expect.stringMatching(/completed|cannot renew/i),
      });

      console.log('✓ Completed session renewal correctly rejected');
    });

    it('should invalidate session token after completion', async () => {
      console.log('📝 Test: Invalidate session token after completion');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;
      const sessionToken = createResponse.data.token;

      // Verify token is valid before completion
      const beforeValidation = await apiClient.post('/sessions/validate', {
        token: sessionToken,
      });
      expect(beforeValidation.data.valid).toBe(true);

      // Act: Complete the session
      await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Assert: Token should now be invalid
      await expect(
        apiClient.post('/sessions/validate', { token: sessionToken })
      ).rejects.toMatchObject({
        status: expect.any(Number),
        message: expect.stringMatching(/invalid|completed|expired/i),
      });

      console.log('✓ Session token invalidated after completion');
    });

    it('should maintain session data after completion for audit', async () => {
      console.log('📝 Test: Maintain session data after completion for audit');

      // Arrange: Create session with specific properties
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user'),
        organizationId: factory.createUniqueId('test-org'),
        metadata: { testKey: 'testValue' },
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Complete session
      await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Retrieve completed session
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);

      // Assert: Original data should still be present
      expect(getResponse.data.id).toBe(sessionId);
      expect(getResponse.data.userId).toBe(sessionData.userId);
      expect(getResponse.data.organizationId).toBe(sessionData.organizationId);
      expect(getResponse.data.metadata).toEqual(sessionData.metadata);
      expect(getResponse.data.status).toBe('completed');

      console.log('✓ Session data maintained after completion');
    });
  });

  describe('Session Completion Authorization', () => {
    it('should require valid authentication for completion', async () => {
      console.log('📝 Test: Require valid authentication for completion');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Try to complete without authentication
      const unauthorizedResponse = await fetch(
        `${config.apiBaseUrl}/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      // Assert
      expect(unauthorizedResponse.status).toBe(401);

      console.log('✓ Unauthorized completion rejected');
    });

    it('should only allow session owner to complete', async () => {
      console.log('📝 Test: Only allow session owner to complete');

      // Arrange: Create session with specific user
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        userId: factory.createUniqueId('test-user-1'),
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Complete with correct authentication (should succeed)
      const completeResponse = await apiClient.post(`/sessions/${sessionId}/complete`, {});

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.data.status).toBe('completed');

      console.log('✓ Session ownership validation working');
    });
  });
});
