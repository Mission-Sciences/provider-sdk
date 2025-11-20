/**
 * Test Data Factory Tests
 *
 * Unit tests for TestDataFactory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestDataFactory } from './test-data-factory';

describe('TestDataFactory', () => {
  let factory: TestDataFactory;

  beforeEach(() => {
    factory = new TestDataFactory();
  });

  describe('createUniqueId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = factory.createUniqueId('test');
      const id2 = factory.createUniqueId('test');

      expect(id1).toMatch(/^test-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^test-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with different prefixes', () => {
      const sessionId = factory.createUniqueId('session');
      const userId = factory.createUniqueId('user');

      expect(sessionId).toMatch(/^session-/);
      expect(userId).toMatch(/^user-/);
    });
  });

  describe('generateSessionData', () => {
    it('should generate session test data', () => {
      const session = factory.generateSessionData();

      expect(session.id).toMatch(/^test-session-/);
      expect(session.userId).toMatch(/^test-user-/);
      expect(session.organizationId).toMatch(/^test-org-/);
      expect(session.applicationId).toBeTruthy(); // Uses real app ID from DynamoDB
      expect(session.status).toBe('active');
      expect(session.expiresAt).toBeTruthy();
      expect(session.metadata).toBeDefined();
    });

    it('should apply overrides', () => {
      const session = factory.generateSessionData({
        status: 'expired',
        userId: 'custom-user-id',
      });

      expect(session.status).toBe('expired');
      expect(session.userId).toBe('custom-user-id');
    });
  });

  describe('generateUserData', () => {
    it('should generate user test data', () => {
      const user = factory.generateUserData();

      expect(user.id).toMatch(/^test-user-/);
      expect(user.email).toMatch(/@test\.example\.com$/);
      expect(user.name).toMatch(/^Test User/);
      expect(user.organizationId).toMatch(/^test-org-/);
    });

    it('should apply overrides', () => {
      const user = factory.generateUserData({
        email: 'custom@example.com',
        name: 'Custom User',
      });

      expect(user.email).toBe('custom@example.com');
      expect(user.name).toBe('Custom User');
    });
  });

  describe('generateOrganizationData', () => {
    it('should generate organization test data', () => {
      const org = factory.generateOrganizationData();

      expect(org.id).toMatch(/^test-org-/);
      expect(org.name).toMatch(/^Test Organization/);
      expect(org.type).toBe('team');
    });

    it('should apply overrides', () => {
      const org = factory.generateOrganizationData({
        type: 'enterprise',
        name: 'Custom Org',
      });

      expect(org.type).toBe('enterprise');
      expect(org.name).toBe('Custom Org');
    });
  });

  describe('generateApplicationData', () => {
    it('should generate application test data', () => {
      const app = factory.generateApplicationData();

      expect(app.id).toMatch(/^test-app-/);
      expect(app.name).toMatch(/^Test Application/);
      expect(app.description).toBeTruthy();
      expect(app.providerId).toMatch(/^test-provider-/);
    });
  });

  describe('trackForCleanup and cleanup', () => {
    it('should track entities for cleanup', () => {
      factory.trackForCleanup('session', 'session-123');
      factory.trackForCleanup('user', 'user-456');

      const stats = factory.getCleanupStats();
      expect(stats.tracked).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it('should cleanup entities in reverse order', async () => {
      const cleanedEntities: string[] = [];
      const cleanupFn = vi.fn(async (type: string, id: string) => {
        cleanedEntities.push(`${type}:${id}`);
      });

      factory.trackForCleanup('session', 'session-1');
      factory.trackForCleanup('user', 'user-2');
      factory.trackForCleanup('org', 'org-3');

      await factory.cleanup(cleanupFn);

      expect(cleanedEntities).toEqual([
        'org:org-3',
        'user:user-2',
        'session:session-1',
      ]);
      expect(cleanupFn).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup failures gracefully', async () => {
      const cleanupFn = vi.fn(async (type: string, id: string) => {
        if (id === 'user-fail') {
          throw new Error('Cleanup failed');
        }
      });

      factory.trackForCleanup('session', 'session-1');
      factory.trackForCleanup('user', 'user-fail');
      factory.trackForCleanup('org', 'org-3');

      await factory.cleanup(cleanupFn);

      const stats = factory.getCleanupStats();
      expect(stats.failed).toBe(1);
      expect(stats.failedEntries[0].entry.entityId).toBe('user-fail');
    });

    it('should clear registry after cleanup', async () => {
      factory.trackForCleanup('session', 'session-1');
      await factory.cleanup();

      const stats = factory.getCleanupStats();
      expect(stats.tracked).toBe(0);
    });
  });

  describe('clearRegistry', () => {
    it('should clear registry without cleanup', () => {
      factory.trackForCleanup('session', 'session-1');
      factory.clearRegistry();

      const stats = factory.getCleanupStats();
      expect(stats.tracked).toBe(0);
    });
  });

  describe('utility generators', () => {
    it('should generate valid email addresses', () => {
      const email = factory.generateEmail('test');
      expect(email).toMatch(/^test-\d+-[a-z0-9]+@test\.example\.com$/);
    });

    it('should generate valid phone numbers', () => {
      const phone = factory.generatePhoneNumber();
      expect(phone).toMatch(/^\+1\d{10}$/);
    });

    it('should generate future dates', () => {
      const futureDate = factory.generateFutureDate(7);
      const date = new Date(futureDate);
      const now = new Date();

      expect(date.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should generate past dates', () => {
      const pastDate = factory.generatePastDate(7);
      const date = new Date(pastDate);
      const now = new Date();

      expect(date.getTime()).toBeLessThan(now.getTime());
    });
  });
});
