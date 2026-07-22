/**
 * Unit tests for X-Application-Id header behavior (GW-5375)
 *
 * Verifies that:
 * - X-Application-Id is sent on all API calls when apiKey + applicationId are set
 * - X-Application-Id is NOT sent when apiKey is absent (JWT-only mode)
 * - HeartbeatManager receives and forwards the applicationId
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";
import { HeartbeatManager } from "../../src/core/HeartbeatManager";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOCK_API_ENDPOINT = "https://sdk.test.example.com";
const MOCK_APP_ID = "app-test-5375";
const MOCK_API_KEY = "gwsk_testmockkey";
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const EXP_SECONDS = NOW_SECONDS + 3600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an SDK configured with apiKey + applicationId (API-key auth mode). */
function createApiKeySdk(): MarketplaceSDK {
  const sdk = new MarketplaceSDK({
    apiEndpoint: MOCK_API_ENDPOINT,
    jwksUri: "https://api.example.com/.well-known/jwks.json",
    applicationId: MOCK_APP_ID,
    apiKey: MOCK_API_KEY,
    debug: false,
    autoStart: false,
  });
  injectSession(sdk);
  return sdk;
}

/** Create an SDK configured with JWT-only auth (no apiKey). */
function createJwtOnlySdk(): MarketplaceSDK {
  const sdk = new MarketplaceSDK({
    apiEndpoint: MOCK_API_ENDPOINT,
    jwksUri: "https://api.example.com/.well-known/jwks.json",
    applicationId: MOCK_APP_ID,
    debug: false,
    autoStart: false,
  });
  injectSession(sdk);
  return sdk;
}

function injectSession(sdk: MarketplaceSDK): void {
  const s = sdk as unknown as Record<string, unknown>;
  s["sessionData"] = {
    sessionId: "sess-5375-001",
    applicationId: MOCK_APP_ID,
    userId: "user-1",
    orgId: "org-1",
    startTime: NOW_SECONDS - 600,
    durationMinutes: 60,
    iat: NOW_SECONDS - 600,
    exp: EXP_SECONDS,
    iss: "generalwisdom.com",
    sub: "user-1",
  };
  s["jwtToken"] = "mock.jwt.token";
}

// ---------------------------------------------------------------------------
// MarketplaceSDK — X-Application-Id header tests
// ---------------------------------------------------------------------------

describe("X-Application-Id header (GW-5375)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        balance: 100,
        purchases: [],
        total: 0,
        extensionMinutes: 30,
        tokenCost: 10,
        newExpiresAt: new Date(EXP_SECONDS * 1000).toISOString(),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("when apiKey is set", () => {
    it("sends X-Application-Id on getAvailableItems()", async () => {
      const sdk = createApiKeySdk();
      await sdk.getAvailableItems();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      expect(headers["Authorization"]).toBe(`Bearer ${MOCK_API_KEY}`);
      sdk.destroy();
    });

    it("sends X-Application-Id on getTokenBalance()", async () => {
      const sdk = createApiKeySdk();
      await sdk.getTokenBalance();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on getItems()", async () => {
      const sdk = createApiKeySdk();
      await sdk.getItems();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on validatePurchase()", async () => {
      const sdk = createApiKeySdk();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canPurchase: true,
          currentBalance: 500,
          itemCost: 10,
          nearExpiry: false,
        }),
      });
      await sdk.validatePurchase("item-1", 1);

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on purchase()", async () => {
      const sdk = createApiKeySdk();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          purchaseId: "p-1",
          itemId: "item-1",
          itemName: "Item",
          quantity: 1,
          totalTokenCost: 10,
          remainingBalance: 90,
          purchasedAt: new Date().toISOString(),
          status: "completed",
        }),
      });
      await sdk.purchase({
        itemId: "item-1",
        quantity: 1,
        idempotencyKey: "idem-1",
        expectedUnitPrice: 10,
      });

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on getPurchaseHistory()", async () => {
      const sdk = createApiKeySdk();
      await sdk.getPurchaseHistory();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on getExtensionCost()", async () => {
      const sdk = createApiKeySdk();
      await sdk.getExtensionCost();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });

    it("sends X-Application-Id on completeSession()", async () => {
      const sdk = createApiKeySdk();
      // Prevent endSession from trying to create DOM elements
      const s = sdk as unknown as Record<string, unknown>;
      s["endSession"] = vi.fn();

      await sdk.completeSession();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
      sdk.destroy();
    });
  });

  describe("when apiKey is NOT set (JWT-only mode)", () => {
    it("does NOT send X-Application-Id on getAvailableItems()", async () => {
      const sdk = createJwtOnlySdk();
      await sdk.getAvailableItems();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBeUndefined();
      expect(headers["Authorization"]).toBe("Bearer mock.jwt.token");
      sdk.destroy();
    });

    it("does NOT send X-Application-Id on getTokenBalance()", async () => {
      const sdk = createJwtOnlySdk();
      await sdk.getTokenBalance();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBeUndefined();
      sdk.destroy();
    });

    it("does NOT send X-Application-Id on getItems()", async () => {
      const sdk = createJwtOnlySdk();
      await sdk.getItems();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBeUndefined();
      sdk.destroy();
    });

    it("does NOT send X-Application-Id on getPurchaseHistory()", async () => {
      const sdk = createJwtOnlySdk();
      await sdk.getPurchaseHistory();

      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Application-Id"]).toBeUndefined();
      sdk.destroy();
    });
  });
});

// ---------------------------------------------------------------------------
// HeartbeatManager — X-Application-Id tests
// ---------------------------------------------------------------------------

describe("HeartbeatManager X-Application-Id (GW-5375)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ remaining_seconds: 3000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends X-Application-Id when applicationId is provided", () => {
    const hb = new HeartbeatManager(
      "sess-1",
      MOCK_API_ENDPOINT,
      "token-123",
      MOCK_APP_ID,
      undefined,
      undefined,
      30,
      false,
    );

    // Trigger a heartbeat by calling start (which calls sendHeartbeat immediately)
    // We need window.setInterval to exist
    const setIntervalSpy = vi.fn().mockReturnValue(1);
    vi.stubGlobal("setInterval", setIntervalSpy);

    hb.start();

    // sendHeartbeat is called immediately on start
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers["X-Application-Id"]).toBe(MOCK_APP_ID);
    expect(headers["Authorization"]).toBe("Bearer token-123");

    hb.stop();
  });

  it("does NOT send X-Application-Id when applicationId is null", () => {
    const hb = new HeartbeatManager(
      "sess-1",
      MOCK_API_ENDPOINT,
      "token-123",
      null,
      undefined,
      undefined,
      30,
      false,
    );

    const setIntervalSpy = vi.fn().mockReturnValue(1);
    vi.stubGlobal("setInterval", setIntervalSpy);

    hb.start();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers["X-Application-Id"]).toBeUndefined();

    hb.stop();
  });
});
