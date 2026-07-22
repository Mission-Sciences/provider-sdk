/**
 * Unit tests for MarketplaceSDK item-fetching methods (GW-2517)
 *
 * Tests: getAvailableItems() and getItems()
 * Both return ApplicationItem arrays from session-scoped endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';
import type { ApplicationItem } from '../../src/types/purchases';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSDK(): MarketplaceSDK {
  return new MarketplaceSDK({
    apiEndpoint: 'https://api.test.example.com',
    jwksUri: 'https://api.test.example.com/.well-known/jwks.json',
    debug: false,
    autoStart: false,
  });
}

function injectSession(sdk: MarketplaceSDK): void {
  const future = Math.floor(Date.now() / 1000) + 3600;
  (sdk as any).sessionData = {
    sessionId: 'session-items-001',
    applicationId: 'app-001',
    userId: 'user-001',
    orgId: 'org-001',
    startTime: Math.floor(Date.now() / 1000),
    durationMinutes: 60,
    iat: Math.floor(Date.now() / 1000),
    exp: future,
    iss: 'generalwisdom.com',
    sub: 'user-001',
  };
  (sdk as any).jwtToken = 'test-jwt-token';
}

const MOCK_ITEMS: ApplicationItem[] = [
  {
    id: 'item-001',
    name: 'Premium Export',
    description: 'Export search results in CSV',
    baseRateUsd: 2.0,
    wholesaleTokenCost: 20,
    userTokenCost: 27,
    status: 'active',
    visibility: 'visible',
    version: 1,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'item-002',
    name: 'Deep Scan',
    description: 'Full OSINT deep scan',
    baseRateUsd: 5.0,
    wholesaleTokenCost: 50,
    userTokenCost: 68,
    status: 'active',
    visibility: 'visible',
    version: 2,
    createdAt: '2026-02-11T00:00:00Z',
    updatedAt: '2026-02-12T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// getAvailableItems()
// ---------------------------------------------------------------------------

describe('MarketplaceSDK.getAvailableItems()', () => {
  let sdk: MarketplaceSDK;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sdk = makeSDK();
    injectSession(sdk);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    sdk.destroy();
    vi.unstubAllGlobals();
  });

  it('returns an array of ApplicationItems from the API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS }),
    });

    const items = await sdk.getAvailableItems();

    expect(items).toEqual(MOCK_ITEMS);
    expect(items).toHaveLength(2);
  });

  it('calls GET /v1/sessions/{session_id}/available-items with Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS }),
    });

    await sdk.getAvailableItems();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.test.example.com/sdk/sessions/session-items-001/available-items',
    );
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-jwt-token',
    );
  });

  it('handles empty response array', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const items = await sdk.getAvailableItems();

    expect(items).toEqual([]);
    expect(items).toHaveLength(0);
  });

  it('throws SDKError with FETCH_ITEMS_ERROR on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(sdk.getAvailableItems()).rejects.toMatchObject({
      code: 'FETCH_ITEMS_ERROR',
      statusCode: 503,
    });
  });

  it('throws NOT_INITIALIZED when SDK has no active session', async () => {
    const uninit = makeSDK();

    await expect(uninit.getAvailableItems()).rejects.toMatchObject({
      code: 'NOT_INITIALIZED',
    });

    uninit.destroy();
  });
});

// ---------------------------------------------------------------------------
// getItems()
// ---------------------------------------------------------------------------

describe('MarketplaceSDK.getItems()', () => {
  let sdk: MarketplaceSDK;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sdk = makeSDK();
    injectSession(sdk);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    sdk.destroy();
    vi.unstubAllGlobals();
  });

  it('returns an array of ApplicationItems from the API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS }),
    });

    const items = await sdk.getItems();

    expect(items).toEqual(MOCK_ITEMS);
    expect(items).toHaveLength(2);
  });

  it('calls GET /v1/sessions/{session_id}/items with Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS }),
    });

    await sdk.getItems();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.test.example.com/sdk/sessions/session-items-001/items',
    );
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-jwt-token',
    );
  });

  it('handles empty items array in response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const items = await sdk.getItems();

    expect(items).toEqual([]);
  });

  it('throws SDKError with NETWORK_ERROR on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(sdk.getItems()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      statusCode: 404,
    });
  });

  it('throws NOT_INITIALIZED when SDK has no active session', async () => {
    const uninit = makeSDK();

    await expect(uninit.getItems()).rejects.toMatchObject({
      code: 'NOT_INITIALIZED',
    });

    uninit.destroy();
  });
});
