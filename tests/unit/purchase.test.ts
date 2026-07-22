/**
 * Unit tests for MarketplaceSDK.purchase() (GW-2517)
 *
 * purchase() executes an in-session purchase atomically via POST
 * /v1/sessions/{session_id}/purchases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';
import type { PurchaseRequest, PurchaseResult } from '../../src/types/purchases';

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
    sessionId: 'session-purchase-001',
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

const PURCHASE_REQUEST: PurchaseRequest = {
  itemId: 'item-001',
  quantity: 1,
  idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
  expectedUnitPrice: 27,
};

const PURCHASE_RESULT: PurchaseResult = {
  purchaseId: 'purchase-xyz-001',
  itemId: 'item-001',
  itemName: 'Premium Export',
  quantity: 1,
  totalTokenCost: 27,
  remainingBalance: 473,
  purchasedAt: '2026-02-10T15:30:00Z',
  status: 'completed',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketplaceSDK.purchase()', () => {
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

  it('returns PurchaseResult on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => PURCHASE_RESULT,
    });

    const result = await sdk.purchase(PURCHASE_REQUEST);

    expect(result).toEqual(PURCHASE_RESULT);
    expect(result.status).toBe('completed');
  });

  it('posts to the correct session-scoped purchases endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => PURCHASE_RESULT,
    });

    await sdk.purchase(PURCHASE_REQUEST);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.test.example.com/sdk/sessions/session-purchase-001/purchases',
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-jwt-token',
    );
  });

  it('serialises request body with snake_case field names', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => PURCHASE_RESULT,
    });

    await sdk.purchase(PURCHASE_REQUEST);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.itemId).toBe('item-001');
    expect(body.quantity).toBe(1);
    expect(body.idempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(body.expectedUnitPrice).toBe(27);
  });

  it('throws SDKError with server error code on insufficient balance (402)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({
        code: 'insufficient_balance',
        message: 'Not enough tokens',
      }),
    });

    await expect(sdk.purchase(PURCHASE_REQUEST)).rejects.toMatchObject({
      code: 'insufficient_balance',
      statusCode: 402,
    });
  });

  it('throws SDKError with server error code on price changed (409)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'price_changed',
        message: 'Item price has changed since validation',
      }),
    });

    await expect(sdk.purchase(PURCHASE_REQUEST)).rejects.toMatchObject({
      code: 'price_changed',
      statusCode: 409,
    });
  });

  it('falls back to PURCHASE_ERROR code when server returns no code', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal server error' }),
    });

    await expect(sdk.purchase(PURCHASE_REQUEST)).rejects.toMatchObject({
      code: 'PURCHASE_ERROR',
      statusCode: 500,
    });
  });

  it('falls back to PURCHASE_ERROR when error body cannot be parsed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(sdk.purchase(PURCHASE_REQUEST)).rejects.toMatchObject({
      code: 'PURCHASE_ERROR',
      statusCode: 500,
    });
  });

  it('validates response shape: all PurchaseResult fields are present', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => PURCHASE_RESULT,
    });

    const result = await sdk.purchase(PURCHASE_REQUEST);

    expect(result.purchaseId).toBeDefined();
    expect(result.itemId).toBeDefined();
    expect(result.itemName).toBeDefined();
    expect(typeof result.quantity).toBe('number');
    expect(typeof result.totalTokenCost).toBe('number');
    expect(typeof result.remainingBalance).toBe('number');
    expect(result.purchasedAt).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('throws NOT_INITIALIZED when SDK has no active session', async () => {
    const uninit = makeSDK();

    await expect(uninit.purchase(PURCHASE_REQUEST)).rejects.toMatchObject({
      code: 'NOT_INITIALIZED',
    });

    uninit.destroy();
  });

  it('defaults quantity to 1 when not provided in the request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => PURCHASE_RESULT,
    });

    const reqWithoutQty: PurchaseRequest = {
      itemId: 'item-001',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
      expectedUnitPrice: 27,
    };

    await sdk.purchase(reqWithoutQty);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).quantity).toBe(1);
  });
});
