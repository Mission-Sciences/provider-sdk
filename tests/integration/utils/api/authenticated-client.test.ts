/**
 * Authenticated API Client Tests
 *
 * Unit tests for AuthenticatedApiClient with mocked fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticatedApiClient } from './authenticated-client';
import type { CognitoAuthHelper } from '../auth';

// Mock fetch
global.fetch = vi.fn();

describe('AuthenticatedApiClient', () => {
  let client: AuthenticatedApiClient;
  let mockAuthHelper: CognitoAuthHelper;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth helper
    mockAuthHelper = {
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
      getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    } as any;

    client = new AuthenticatedApiClient(mockAuthHelper, 'https://api.test.com');
  });

  describe('constructor', () => {
    it('should create instance with auth helper and base URL', () => {
      expect(client).toBeInstanceOf(AuthenticatedApiClient);
    });

    it('should remove trailing slash from base URL', () => {
      const clientWithSlash = new AuthenticatedApiClient(
        mockAuthHelper,
        'https://api.test.com/'
      );
      expect(clientWithSlash).toBeInstanceOf(AuthenticatedApiClient);
    });

    it('should accept custom timeout', () => {
      const clientWithTimeout = new AuthenticatedApiClient(
        mockAuthHelper,
        'https://api.test.com',
        { timeout: 5000 }
      );
      expect(clientWithTimeout).toBeInstanceOf(AuthenticatedApiClient);
    });
  });

  describe('get', () => {
    it('should make GET request with auth token', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      });

      const response = await client.get('/test');

      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(200);
      expect(mockAuthHelper.getIdToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-id-token',
          }),
        })
      );
    });

    it('should append query parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      });

      await client.get('/test', { page: 1, limit: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test?page=1&limit=10',
        expect.any(Object)
      );
    });
  });

  describe('post', () => {
    it('should make POST request with body', async () => {
      const mockResponse = { id: '123' };
      const postData = { name: 'test' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
      });

      const response = await client.post('/test', postData);

      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      );
    });
  });

  describe('put', () => {
    it('should make PUT request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ updated: true }),
      });

      const response = await client.put('/test/123', { name: 'updated' });

      expect(response.data).toEqual({ updated: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test/123',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map(),
        text: async () => '',
      });

      const response = await client.delete('/test/123');

      expect(response.status).toBe(204);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test/123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('error handling', () => {
    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Resource not found' }),
      });

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'Resource not found',
        status: 404,
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/test')).rejects.toThrow('Network error');
    });
  });

  describe('retry configuration', () => {
    it('should get current retry config', () => {
      const config = client.getRetryConfig();

      expect(config.maxAttempts).toBe(3);
      expect(config.retryableStatuses).toContain(503);
    });

    it('should update retry config', () => {
      client.setRetryConfig({ maxAttempts: 5 });

      const config = client.getRetryConfig();
      expect(config.maxAttempts).toBe(5);
    });
  });
});
