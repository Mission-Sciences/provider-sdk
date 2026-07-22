/**
 * Test Data Factory
 *
 * Generates unique test data and manages cleanup.
 * Ensures test isolation and prevents data leakage between tests.
 *
 * Features:
 * - Unique ID generation with timestamp and random suffix
 * - Test data generators for common entities
 * - Cleanup registry to track created entities
 * - Automatic cleanup in reverse creation order
 * - Graceful error handling for cleanup failures
 */

import type {
  SessionTestData,
  UserTestData,
  OrganizationTestData,
  ApplicationTestData,
  CleanupEntry,
  CleanupRegistry,
} from './types';

export class TestDataFactory {
  private cleanupRegistry: CleanupRegistry = {
    entries: [],
    failedCleanups: [],
  };

  /**
   * Generate unique ID with prefix, timestamp, and random suffix
   * Format: prefix-timestamp-random
   * Example: test-session-1699564800000-a1b2c3
   */
  createUniqueId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Generate realistic session test data (full session object for tracking/assertions)
   */
  generateSessionData(overrides?: Partial<SessionTestData>): SessionTestData {
    const id = this.createUniqueId('test-session');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    return {
      id,
      userId: this.createUniqueId('test-user'),
      organizationId: this.createUniqueId('test-org'),
      applicationId: '95988366-c450-434d-a53c-543280aae782',  // Integration Test App (exists in gw-marketplace-applications-dev)
      status: 'active',
      duration_minutes: 60,  // Default to 1 hour (valid range: 1-1440) - snake_case to match API
      expiresAt,
      metadata: {
        testRun: true,
        createdBy: 'test-data-factory',
      },
      ...overrides,
    };
  }

  /**
   * Generate minimal session creation request (only fields API accepts)
   * Use this when calling POST /sessions endpoint
   */
  generateSessionRequest(overrides?: { application_id?: string; duration_minutes?: number }): {
    application_id: string;
    duration_minutes: number;
  } {
    return {
      application_id: overrides?.application_id || '95988366-c450-434d-a53c-543280aae782',  // Integration Test App
      duration_minutes: overrides?.duration_minutes || 60,  // Default 1 hour (range: 1-1440)
    };
  }

  /**
   * Generate realistic user test data
   */
  generateUserData(overrides?: Partial<UserTestData>): UserTestData {
    const id = this.createUniqueId('test-user');
    const username = this.createUniqueId('user');

    return {
      id,
      email: `${username}@test.example.com`,
      name: `Test User ${username}`,
      organizationId: this.createUniqueId('test-org'),
      ...overrides,
    };
  }

  /**
   * Generate realistic organization test data
   */
  generateOrganizationData(overrides?: Partial<OrganizationTestData>): OrganizationTestData {
    const id = this.createUniqueId('test-org');

    return {
      id,
      name: `Test Organization ${id}`,
      type: 'team',
      ...overrides,
    };
  }

  /**
   * Generate realistic application test data
   */
  generateApplicationData(overrides?: Partial<ApplicationTestData>): ApplicationTestData {
    const id = this.createUniqueId('test-app');

    return {
      id,
      name: `Test Application ${id}`,
      description: `Test application created by test data factory`,
      providerId: this.createUniqueId('test-provider'),
      ...overrides,
    };
  }

  /**
   * Track entity for cleanup
   * Entities are cleaned up in reverse order of creation
   */
  trackForCleanup(
    entityType: CleanupEntry['entityType'],
    entityId: string
  ): void {
    this.cleanupRegistry.entries.push({
      entityType,
      entityId,
      createdAt: Date.now(),
    });

    console.debug(
      `[TestDataFactory] Tracking ${entityType} for cleanup: ${entityId}`
    );
  }

  /**
   * Execute cleanup for all tracked entities
   * Cleanup happens in reverse order (LIFO - Last In First Out)
   *
   * @param cleanupFn - Function to delete an entity, receives (entityType, entityId)
   */
  async cleanup(
    cleanupFn?: (entityType: string, entityId: string) => Promise<void>
  ): Promise<void> {
    if (this.cleanupRegistry.entries.length === 0) {
      console.debug('[TestDataFactory] No entities to clean up');
      return;
    }

    console.debug(
      `[TestDataFactory] Cleaning up ${this.cleanupRegistry.entries.length} entities...`
    );

    // Reverse order cleanup (LIFO)
    const entriesToClean = [...this.cleanupRegistry.entries].reverse();

    for (const entry of entriesToClean) {
      try {
        if (cleanupFn) {
          await cleanupFn(entry.entityType, entry.entityId);
        }
        console.debug(
          `[TestDataFactory] ✓ Cleaned up ${entry.entityType}: ${entry.entityId}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          `[TestDataFactory] Failed to clean up ${entry.entityType}: ${entry.entityId}`,
          errorMessage
        );

        this.cleanupRegistry.failedCleanups.push({
          entry,
          error: errorMessage,
        });
      }
    }

    // Report cleanup results
    const successCount =
      entriesToClean.length - this.cleanupRegistry.failedCleanups.length;
    const failureCount = this.cleanupRegistry.failedCleanups.length;

    console.debug(
      `[TestDataFactory] Cleanup complete: ${successCount} succeeded, ${failureCount} failed`
    );

    // Clear registry
    this.cleanupRegistry.entries = [];
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): {
    tracked: number;
    failed: number;
    failedEntries: Array<{ entry: CleanupEntry; error: string }>;
  } {
    return {
      tracked: this.cleanupRegistry.entries.length,
      failed: this.cleanupRegistry.failedCleanups.length,
      failedEntries: [...this.cleanupRegistry.failedCleanups],
    };
  }

  /**
   * Clear cleanup registry without executing cleanup
   * Use with caution - entities will not be cleaned up
   */
  clearRegistry(): void {
    this.cleanupRegistry.entries = [];
    this.cleanupRegistry.failedCleanups = [];
    console.debug('[TestDataFactory] Cleanup registry cleared');
  }

  /**
   * Generate random email address
   */
  generateEmail(prefix = 'test'): string {
    const unique = this.createUniqueId(prefix);
    return `${unique}@test.example.com`;
  }

  /**
   * Generate random phone number
   */
  generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const subscriber = Math.floor(Math.random() * 9000) + 1000;
    return `+1${areaCode}${exchange}${subscriber}`;
  }

  /**
   * Generate random future date
   */
  generateFutureDate(daysFromNow: number = 1): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  /**
   * Generate random past date
   */
  generatePastDate(daysAgo: number = 1): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }
}
