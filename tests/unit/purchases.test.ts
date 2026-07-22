/**
 * Unit tests for MarketplaceSDK purchase methods (GW-2504)
 *
 * Tests: getAvailableItems, getTokenBalance, validatePurchase,
 *        purchase, getPurchaseHistory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';
import type {
  ApplicationItem,
  PurchaseRequest,
  PurchaseResult,
  ValidationResult,
  SessionPurchase,
} from '../../src/types/purchases';

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

/** Inject a minimal initialized session into the SDK via private fields */
function injectSession(sdk: MarketplaceSDK): void {
  const future = Math.floor(Date.now() / 1000) + 3600;
  (sdk as any).sessionData = {
    sessionId: 'session-test-001',
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
];

const MOCK_PURCHASE_RESULT: PurchaseResult = {
  purchaseId: 'purchase-abc-001',
  itemId: 'item-001',
  itemName: 'Premium Export',
  quantity: 1,
  totalTokenCost: 27,
  remainingBalance: 473,
  purchasedAt: '2026-02-10T15:30:00Z',
  status: 'completed',
};

// gw-sdk-api ValidatePurchaseResponse (what the deployed API returns)
const MOCK_BACKEND_VALIDATION = {
  valid: true,
  totalCost: 27,
  remainingBalance: 500,
};

// SDK ValidationResult (what validatePurchase returns after mapping)
const MOCK_VALIDATION: ValidationResult = {
  canPurchase: true,
  currentBalance: 500,
  itemCost: 27,
};

const MOCK_HISTORY: SessionPurchase[] = [
  {
    purchaseId: 'purchase-abc-001',
    sessionId: 'session-test-001',
    itemId: 'item-001',
    itemName: 'Premium Export',
    itemDescription: 'Export search results in CSV',
    quantity: 1,
    unitPrice: 27,
    totalTokens: 27,
    status: 'completed',
    createdAt: '2026-02-10T15:30:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketplaceSDK — purchase methods', () => {
  let sdk: MarketplaceSDK;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sdk = makeSDK();
    injectSession(sdk);

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // getAvailableItems
  // -------------------------------------------------------------------------
  describe('getAvailableItems()', () => {
    it('fetches available items from the correct endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: MOCK_ITEMS }),
      });

      const items = await sdk.getAvailableItems();

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.example.com/sdk/sessions/session-test-001/available-items');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt-token');
      expect(items).toEqual(MOCK_ITEMS);
    });

    it('throws SDKError on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(sdk.getAvailableItems()).rejects.toMatchObject({
        code: 'FETCH_ITEMS_ERROR',
        statusCode: 503,
      });
    });

    it('throws NOT_INITIALIZED when SDK has no session', async () => {
      const uninit = makeSDK();
      await expect(uninit.getAvailableItems()).rejects.toMatchObject({
        code: 'NOT_INITIALIZED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // getTokenBalance
  // -------------------------------------------------------------------------
  describe('getTokenBalance()', () => {
    it('returns TokenBalance from API response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 500 }),
      });

      const balance = await sdk.getTokenBalance();

      expect(balance).toEqual({ balance: 500, unit: 'SMART' });
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.example.com/sdk/sessions/session-test-001/balance');
    });

    it('throws SDKError on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(sdk.getTokenBalance()).rejects.toMatchObject({
        code: 'FETCH_BALANCE_ERROR',
        statusCode: 401,
      });
    });

    it('throws NOT_INITIALIZED when SDK has no session', async () => {
      const uninit = makeSDK();
      await expect(uninit.getTokenBalance()).rejects.toMatchObject({
        code: 'NOT_INITIALIZED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // validatePurchase
  // -------------------------------------------------------------------------
  describe('validatePurchase()', () => {
    it('posts to validate endpoint and returns ValidationResult', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_BACKEND_VALIDATION,
      });

      const result = await sdk.validatePurchase('item-001', 1);

      expect(result).toEqual(MOCK_VALIDATION);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.test.example.com/sdk/sessions/session-test-001/purchases/validate',
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ itemId: 'item-001', quantity: 1 });
    });

    it('defaults quantity to 1 when not provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_BACKEND_VALIDATION,
      });

      await sdk.validatePurchase('item-001');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string).quantity).toBe(1);
    });

    it('throws SDKError on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 429 });

      await expect(sdk.validatePurchase('item-001')).rejects.toMatchObject({
        code: 'VALIDATE_PURCHASE_ERROR',
        statusCode: 429,
      });
    });

    it('throws NOT_INITIALIZED when SDK has no session', async () => {
      const uninit = makeSDK();
      await expect(uninit.validatePurchase('item-001')).rejects.toMatchObject({
        code: 'NOT_INITIALIZED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // purchase
  // -------------------------------------------------------------------------
  describe('purchase()', () => {
    const REQ: PurchaseRequest = {
      itemId: 'item-001',
      quantity: 1,
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      expectedUnitPrice: 27,
    };

    it('posts purchase request and returns PurchaseResult', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PURCHASE_RESULT,
      });

      const result = await sdk.purchase(REQ);

      expect(result).toEqual(MOCK_PURCHASE_RESULT);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.example.com/sdk/sessions/session-test-001/purchases');
      expect(init.method).toBe('POST');

      const body = JSON.parse(init.body as string);
      expect(body.itemId).toBe('item-001');
      expect(body.quantity).toBe(1);
      expect(body.idempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(body.expectedUnitPrice).toBe(27);
    });

    it('defaults quantity to 1 when omitted from request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PURCHASE_RESULT,
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

    it('throws SDKError with server error code on 402', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient tokens for purchase',
        }),
      });

      await expect(sdk.purchase(REQ)).rejects.toMatchObject({
        code: 'INSUFFICIENT_BALANCE',
        statusCode: 402,
      });
    });

    it('throws SDKError with PURCHASE_ERROR fallback on unparseable error body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('not json'); },
      });

      await expect(sdk.purchase(REQ)).rejects.toMatchObject({
        code: 'PURCHASE_ERROR',
        statusCode: 500,
      });
    });

    it('throws NOT_INITIALIZED when SDK has no session', async () => {
      const uninit = makeSDK();
      await expect(uninit.purchase(REQ)).rejects.toMatchObject({
        code: 'NOT_INITIALIZED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // getPurchaseHistory
  // -------------------------------------------------------------------------
  describe('getPurchaseHistory()', () => {
    it('fetches purchase history from the correct endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ purchases: MOCK_HISTORY, total: MOCK_HISTORY.length }),
      });

      const history = await sdk.getPurchaseHistory();

      expect(history).toEqual(MOCK_HISTORY);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.example.com/sdk/sessions/session-test-001/purchases');
      expect(init.method).toBe('GET');
    });

    it('throws SDKError on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(sdk.getPurchaseHistory()).rejects.toMatchObject({
        code: 'FETCH_PURCHASES_ERROR',
        statusCode: 404,
      });
    });

    it('throws NOT_INITIALIZED when SDK has no session', async () => {
      const uninit = makeSDK();
      await expect(uninit.getPurchaseHistory()).rejects.toMatchObject({
        code: 'NOT_INITIALIZED',
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Type shape tests (compile-time contracts verified at runtime)
// ---------------------------------------------------------------------------
describe('purchases type shapes', () => {
  it('ApplicationItem has all required fields', () => {
    const item: ApplicationItem = MOCK_ITEMS[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.description).toBeDefined();
    expect(typeof item.baseRateUsd).toBe('number');
    expect(typeof item.wholesaleTokenCost).toBe('number');
    expect(typeof item.userTokenCost).toBe('number');
    expect(['active', 'inactive', 'deleted']).toContain(item.status);
    expect(['visible', 'hidden']).toContain(item.visibility);
    expect(typeof item.version).toBe('number');
    expect(item.createdAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
  });

  it('PurchaseResult has all required fields', () => {
    const result: PurchaseResult = MOCK_PURCHASE_RESULT;
    expect(result.purchaseId).toBeDefined();
    expect(result.itemId).toBeDefined();
    expect(result.itemName).toBeDefined();
    expect(typeof result.quantity).toBe('number');
    expect(typeof result.totalTokenCost).toBe('number');
    expect(typeof result.remainingBalance).toBe('number');
    expect(result.purchasedAt).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('ValidationResult has all required fields', () => {
    const v: ValidationResult = MOCK_VALIDATION;
    expect(typeof v.canPurchase).toBe('boolean');
    expect(typeof v.currentBalance).toBe('number');
    expect(typeof v.itemCost).toBe('number');
  });

  it('SessionPurchase has all required fields', () => {
    const sp: SessionPurchase = MOCK_HISTORY[0];
    expect(sp.purchaseId).toBeDefined();
    expect(sp.sessionId).toBeDefined();
    expect(sp.itemId).toBeDefined();
    expect(sp.itemName).toBeDefined();
    expect(sp.itemDescription).toBeDefined();
    expect(typeof sp.quantity).toBe('number');
    expect(typeof sp.unitPrice).toBe('number');
    expect(typeof sp.totalTokens).toBe('number');
    expect(['completed', 'failed']).toContain(sp.status);
    expect(sp.createdAt).toBeDefined();
  });
});
