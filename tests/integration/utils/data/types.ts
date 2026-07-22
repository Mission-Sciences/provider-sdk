/**
 * Test Data Types
 *
 * TypeScript interfaces for test data generation and cleanup.
 */

export interface SessionTestData {
  id: string;
  userId: string;
  organizationId: string;
  applicationId: string;
  status: 'active' | 'expired' | 'revoked';
  duration_minutes?: number;  // Required by API: 1-1440 (1 minute to 24 hours) - snake_case to match API
  expiresAt: string;
  metadata?: Record<string, any>;
}

export interface UserTestData {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export interface OrganizationTestData {
  id: string;
  name: string;
  type: 'individual' | 'team' | 'enterprise';
}

export interface ApplicationTestData {
  id: string;
  name: string;
  description: string;
  providerId: string;
}

export interface CleanupEntry {
  entityType: 'session' | 'user' | 'organization' | 'application' | 'transaction';
  entityId: string;
  createdAt: number;
}

export interface CleanupRegistry {
  entries: CleanupEntry[];
  failedCleanups: Array<{ entry: CleanupEntry; error: string }>;
}
