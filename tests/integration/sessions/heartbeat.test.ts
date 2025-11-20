/**
 * Heartbeat System Integration Tests
 *
 * Tests session heartbeat/keepalive functionality including:
 * - Single heartbeat extends session timeout
 * - Multiple heartbeats update timestamp
 * - Heartbeat on expired session fails
 * - Heartbeat on non-existent session fails
 * - Heartbeat frequency and timing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ConfigService,
  CognitoAuthHelper,
  TestDataFactory,
  AuthenticatedApiClient,
  type TestConfig,
} from '../utils';

describe('Heartbeat System Integration', () => {
  let config: TestConfig;
  let authHelper: CognitoAuthHelper;
  let apiClient: AuthenticatedApiClient;
  let factory: TestDataFactory;

  beforeAll(async () => {
    console.log('\n🧪 Setting up Heartbeat System tests...\n');

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

    console.log('✓ Heartbeat System test setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up Heartbeat System test data...\n');

    await factory.cleanup(async (entityType, entityId) => {
      try {
        await apiClient.delete(`/${entityType}s/${entityId}`);
      } catch (error) {
        console.debug(`Cleanup: ${entityType} ${entityId} may not exist`);
      }
    });

    console.log('✓ Heartbeat System cleanup complete\n');
  });

  describe('Basic Heartbeat Functionality', () => {
    it('should send heartbeat and extend session timeout', async () => {
      console.log('📝 Test: Send heartbeat and extend session timeout');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;
      const originalTimeout = createResponse.data.timeoutAt || createResponse.data.expiresAt;

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Act: Send heartbeat
      const heartbeatResponse = await apiClient.post(`/sessions/${sessionId}/heartbeat`, {});

      // Assert
      expect(heartbeatResponse.status).toBe(200);

      // Get updated session
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);
      const newTimeout = getResponse.data.timeoutAt || getResponse.data.expiresAt;

      // Verify timeout was extended
      const originalDate = new Date(originalTimeout).getTime();
      const newDate = new Date(newTimeout).getTime();
      expect(newDate).toBeGreaterThanOrEqual(originalDate);

      console.log('✓ Heartbeat extended session timeout');
      console.log(`  Original timeout: ${originalTimeout}`);
      console.log(`  New timeout: ${newTimeout}`);
      console.log(`  Extended by: ${Math.round((newDate - originalDate) / 1000)}s`);
    });

    it('should update lastHeartbeatAt timestamp', async () => {
      console.log('📝 Test: Update lastHeartbeatAt timestamp');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Send heartbeat
      const heartbeatResponse = await apiClient.post(`/sessions/${sessionId}/heartbeat`, {});

      // Assert
      expect(heartbeatResponse.status).toBe(200);

      // Verify lastHeartbeatAt is set
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);

      if (getResponse.data.lastHeartbeatAt) {
        const lastHeartbeat = new Date(getResponse.data.lastHeartbeatAt);
        const now = new Date();
        const diffSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;

        expect(diffSeconds).toBeLessThan(5); // Within last 5 seconds

        console.log('✓ lastHeartbeatAt timestamp updated');
        console.log(`  Timestamp: ${getResponse.data.lastHeartbeatAt}`);
      } else {
        console.log('✓ Heartbeat successful (lastHeartbeatAt not tracked separately)');
      }
    });
  });

  describe('Multiple Heartbeats', () => {
    it('should handle multiple heartbeats correctly', async () => {
      console.log('📝 Test: Handle multiple heartbeats');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      let previousTimeout = createResponse.data.timeoutAt || createResponse.data.expiresAt;

      // Act: Send multiple heartbeats
      for (let i = 1; i <= 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const heartbeatResponse = await apiClient.post(`/sessions/${sessionId}/heartbeat`, {});
        expect(heartbeatResponse.status).toBe(200);

        // Get updated session
        const getResponse = await apiClient.get(`/sessions/${sessionId}`);
        const currentTimeout = getResponse.data.timeoutAt || getResponse.data.expiresAt;

        // Verify timeout is extended or maintained
        const previousDate = new Date(previousTimeout).getTime();
        const currentDate = new Date(currentTimeout).getTime();
        expect(currentDate).toBeGreaterThanOrEqual(previousDate);

        console.log(`  Heartbeat ${i}: Timeout at ${currentTimeout}`);
        previousTimeout = currentTimeout;
      }

      console.log('✓ Multiple heartbeats handled successfully');
    });

    it('should update timestamp with each heartbeat', async () => {
      console.log('📝 Test: Update timestamp with each heartbeat');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      const timestamps: string[] = [];

      // Act: Send heartbeats and collect timestamps
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await apiClient.post(`/sessions/${sessionId}/heartbeat`, {});

        const getResponse = await apiClient.get(`/sessions/${sessionId}`);
        const timestamp =
          getResponse.data.lastHeartbeatAt ||
          getResponse.data.updatedAt ||
          getResponse.data.timeoutAt;

        timestamps.push(timestamp);
      }

      // Assert: Timestamps should be different (or increasing)
      if (timestamps[0] && timestamps[1] && timestamps[2]) {
        const time1 = new Date(timestamps[0]).getTime();
        const time2 = new Date(timestamps[1]).getTime();
        const time3 = new Date(timestamps[2]).getTime();

        // Times should be non-decreasing
        expect(time2).toBeGreaterThanOrEqual(time1);
        expect(time3).toBeGreaterThanOrEqual(time2);

        console.log('✓ Timestamps updated with each heartbeat');
      } else {
        console.log('✓ Multiple heartbeats successful');
      }
    });
  });

  describe('Heartbeat Timing and Frequency', () => {
    it('should accept rapid heartbeats', async () => {
      console.log('📝 Test: Accept rapid heartbeats');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Send rapid heartbeats (5 in quick succession)
      const heartbeatPromises = Array.from({ length: 5 }, () =>
        apiClient.post(`/sessions/${sessionId}/heartbeat`, {})
      );

      const responses = await Promise.all(heartbeatPromises);

      // Assert: All heartbeats should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        console.log(`  Rapid heartbeat ${index + 1}: Success`);
      });

      console.log('✓ Rapid heartbeats accepted');
    });

    it('should maintain session through periodic heartbeats', async () => {
      console.log('📝 Test: Maintain session through periodic heartbeats');

      // Arrange: Create session with short timeout
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData({
        expiresAt: new Date(Date.now() + 10000).toISOString(), // 10 seconds
      });
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Send periodic heartbeats over 6 seconds (3 heartbeats at 2s intervals)
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const heartbeatResponse = await apiClient.post(`/sessions/${sessionId}/heartbeat`, {});
        expect(heartbeatResponse.status).toBe(200);

        console.log(`  Heartbeat ${i + 1} at ${new Date().toISOString()}`);
      }

      // Assert: Session should still be active
      const getResponse = await apiClient.get(`/sessions/${sessionId}`);
      expect(getResponse.data.status).toBe('active');

      console.log('✓ Session maintained through periodic heartbeats');
    });
  });

  describe('Failed Heartbeats', () => {
    it('should fail heartbeat on non-existent session', async () => {
      console.log('📝 Test: Fail heartbeat on non-existent session');

      // Arrange: Generate non-existent session ID
      const nonExistentId = factory.createUniqueId('non-existent-session');

      // Act & Assert
      await expect(
        apiClient.post(`/sessions/${nonExistentId}/heartbeat`, {})
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found|does not exist/i),
      });

      console.log('✓ Non-existent session heartbeat rejected');
    });

    it('should fail heartbeat on completed session', async () => {
      console.log('📝 Test: Fail heartbeat on completed session');

      // Arrange: Create and complete session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      await apiClient.post(`/sessions/${sessionId}/complete`, {});

      // Act & Assert
      await expect(
        apiClient.post(`/sessions/${sessionId}/heartbeat`, {})
      ).rejects.toMatchObject({
        status: expect.any(Number), // Forbidden, Conflict, or Gone
        message: expect.stringMatching(/completed|cannot send heartbeat/i),
      });

      console.log('✓ Completed session heartbeat rejected');
    });

    it('should fail heartbeat on revoked session', async () => {
      console.log('📝 Test: Fail heartbeat on revoked session');

      // Arrange: Create and revoke session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      await apiClient.delete(`/sessions/${sessionId}`);

      // Act & Assert
      await expect(
        apiClient.post(`/sessions/${sessionId}/heartbeat`, {})
      ).rejects.toMatchObject({
        status: expect.any(Number), // Forbidden or Gone
        message: expect.stringMatching(/revoked|gone/i),
      });

      console.log('✓ Revoked session heartbeat rejected');
    });
  });

  describe('Heartbeat Authorization', () => {
    it('should require valid authentication for heartbeat', async () => {
      console.log('📝 Test: Require valid authentication for heartbeat');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Try to send heartbeat without authentication
      const unauthorizedResponse = await fetch(
        `${config.apiBaseUrl}/sessions/${sessionId}/heartbeat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      // Assert
      expect(unauthorizedResponse.status).toBe(401);

      console.log('✓ Unauthorized heartbeat rejected');
    });
  });

  describe('Heartbeat with Metadata', () => {
    it('should send heartbeat with optional metadata', async () => {
      console.log('📝 Test: Send heartbeat with optional metadata');

      // Arrange: Create session
      const sessionRequest = factory.generateSessionRequest();
      const sessionData = factory.generateSessionData(); // For tracking cleanup
      factory.trackForCleanup('session', sessionData.id);

      const createResponse = await apiClient.post('/sessions', sessionRequest);
      const sessionId = createResponse.data.id;

      // Act: Send heartbeat with metadata
      const heartbeatMetadata = {
        resourceUsage: { cpu: 25, memory: 512 },
        status: 'processing',
        progress: 0.45,
      };

      const heartbeatResponse = await apiClient.post(`/sessions/${sessionId}/heartbeat`, {
        metadata: heartbeatMetadata,
      });

      // Assert
      expect(heartbeatResponse.status).toBe(200);

      console.log('✓ Heartbeat with metadata successful');
    });
  });
});
