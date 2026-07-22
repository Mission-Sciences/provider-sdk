/**
 * Unit tests for MarketplaceSDK session extension methods:
 * - getExtensionCost()
 * - extendSession(options?)
 * - generateIdempotencyKey() (via extendSession side-effects)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';
import { TimerManager } from '../../src/core/TimerManager';
import { SDKError } from '../../src/types';

// ---------------------------------------------------------------------------
// Minimal session data / JWT fixture
// ---------------------------------------------------------------------------
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const EXP_SECONDS = NOW_SECONDS + 3600; // 1 hour from now

const MOCK_SESSION_ID = 'sess-abc-123';
const MOCK_API_ENDPOINT = 'https://api.example.com';

// ---------------------------------------------------------------------------
// Helper: create an SDK instance with sessionData + jwtToken pre-populated
// using direct property access (workaround for private fields in tests)
// ---------------------------------------------------------------------------
function createSdkWithSession(): MarketplaceSDK {
  const sdk = new MarketplaceSDK({
    apiEndpoint: MOCK_API_ENDPOINT,
    jwksUri: 'https://api.example.com/.well-known/jwks.json',
    debug: false,
    autoStart: false,
  });

  // Inject private state directly for unit testing
  const s = sdk as unknown as Record<string, unknown>;
  s['sessionData'] = {
    sessionId: MOCK_SESSION_ID,
    applicationId: 'app-1',
    userId: 'user-1',
    orgId: 'org-1',
    startTime: NOW_SECONDS - 600,
    durationMinutes: 60,
    iat: NOW_SECONDS - 600,
    exp: EXP_SECONDS,
    iss: 'generalwisdom.com',
    sub: 'user-1',
  };
  s['jwtToken'] = 'mock.jwt.token';

  return sdk;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketplaceSDK.getExtensionCost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns extension cost from the API', async () => {
    const sdk = createSdkWithSession();

    const mockResponse = {
      extensionMinutes: 30,
      tokenCost: 15,
      newExpiresAt: new Date((EXP_SECONDS + 1800) * 1000).toISOString(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    }));

    const result = await sdk.getExtensionCost();

    expect(result.extensionMinutes).toBe(30);
    expect(result.tokenCost).toBe(15);
    expect(result.newExpiresAt).toBe(mockResponse.newExpiresAt);
  });

  it('calls the correct endpoint', async () => {
    const sdk = createSdkWithSession();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extensionMinutes: 30, tokenCost: 10, newExpiresAt: new Date().toISOString() }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sdk.getExtensionCost();

    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_API_ENDPOINT}/sdk/sessions/${MOCK_SESSION_ID}/extension-cost`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('includes Authorization header with JWT', async () => {
    const sdk = createSdkWithSession();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extensionMinutes: 30, tokenCost: 10, newExpiresAt: new Date().toISOString() }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sdk.getExtensionCost();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock.jwt.token' }),
      })
    );
  });

  it('throws EXTENSION_COST_FAILED when API returns non-ok status', async () => {
    const sdk = createSdkWithSession();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 402,
    }));

    await expect(sdk.getExtensionCost()).rejects.toMatchObject({
      code: 'EXTENSION_COST_FAILED',
      statusCode: 402,
    });
  });

  it('throws EXTENSION_COST_ERROR when fetch rejects', async () => {
    const sdk = createSdkWithSession();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network failure')));

    await expect(sdk.getExtensionCost()).rejects.toMatchObject({
      code: 'EXTENSION_COST_ERROR',
    });
  });

  it('throws NO_SESSION when called without an active session', async () => {
    const sdk = new MarketplaceSDK({
      apiEndpoint: MOCK_API_ENDPOINT,
      jwksUri: 'https://api.example.com/.well-known/jwks.json',
      autoStart: false,
    });

    await expect(sdk.getExtensionCost()).rejects.toMatchObject({
      code: 'NO_SESSION',
    });
  });
});

describe('MarketplaceSDK.extendSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('skipConfirmation: false (default)', () => {
    it('shows the warning modal instead of calling the API', async () => {
      const sdk = createSdkWithSession();

      // Replace the private showWarningModal with a no-op spy to avoid DOM access
      const s = sdk as unknown as Record<string, unknown>;
      const showModalSpy = vi.fn();
      s['showWarningModal'] = showModalSpy;

      // No fetch should be called
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await sdk.extendSession();

      expect(showModalSpy).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts undefined options and defaults to showing modal', async () => {
      const sdk = createSdkWithSession();
      const s = sdk as unknown as Record<string, unknown>;
      const showModalSpy = vi.fn();
      s['showWarningModal'] = showModalSpy;
      vi.stubGlobal('fetch', vi.fn());

      await sdk.extendSession(undefined);

      expect(showModalSpy).toHaveBeenCalled();
    });
  });

  describe('skipConfirmation: true', () => {
    function setupExtensionFetch(extensionMinutes = 30, tokenCost = 10) {
      const newExpiresAt = new Date((EXP_SECONDS + extensionMinutes * 60) * 1000).toISOString();

      // First call: getExtensionCost
      // Second call: POST /extend
      // Third call: getTokenBalance (balance refresh after extension)
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ extensionMinutes, tokenCost, newExpiresAt }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ newExpiresAt }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: 90 }),
        });

      vi.stubGlobal('fetch', fetchMock);
      return { fetchMock, newExpiresAt };
    }

    it('calls POST /v1/sessions/{id}/extend with extensionMinutes and idempotencyKey', async () => {
      const sdk = createSdkWithSession();
      const { fetchMock } = setupExtensionFetch(30);

      await sdk.extendSession({ skipConfirmation: true });

      const extendCall = fetchMock.mock.calls[1];
      expect(extendCall[0]).toBe(`${MOCK_API_ENDPOINT}/sdk/sessions/${MOCK_SESSION_ID}/extend`);
      expect(extendCall[1].method).toBe('POST');

      const body = JSON.parse(extendCall[1].body);
      expect(body.extensionMinutes).toBe(30);
      expect(typeof body.idempotencyKey).toBe('string');
      expect(body.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates a unique idempotency key on each call', async () => {
      const sdk = createSdkWithSession();

      const keys: string[] = [];

      // Need two full round-trips (each: getExtensionCost + extend + getTokenBalance)
      const newExpiresAt = new Date((EXP_SECONDS + 30 * 60) * 1000).toISOString();
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ extensionMinutes: 30, tokenCost: 10, newExpiresAt, balance: 90 }),
        })
      );

      const captureKey = async () => {
        const fetchMock = (global.fetch as ReturnType<typeof vi.fn>);
        const callsBefore = fetchMock.mock.calls.length;
        await sdk.extendSession({ skipConfirmation: true });
        // Extend call is the 2nd call in each round-trip (index callsBefore+1)
        const extendCallBody = JSON.parse(fetchMock.mock.calls[callsBefore + 1][1].body);
        keys.push(extendCallBody.idempotencyKey);
      };

      await captureKey();
      await captureKey();

      expect(keys[0]).not.toBe(keys[1]);
    });

    it('emits onPurchaseStart then onPurchaseSuccess on success', async () => {
      const sdk = createSdkWithSession();
      setupExtensionFetch();

      const onPurchaseStart = vi.fn();
      const onPurchaseSuccess = vi.fn();
      const onPurchaseError = vi.fn();
      sdk.on('onPurchaseStart', onPurchaseStart);
      sdk.on('onPurchaseSuccess', onPurchaseSuccess);
      sdk.on('onPurchaseError', onPurchaseError);

      await sdk.extendSession({ skipConfirmation: true });

      expect(onPurchaseStart).toHaveBeenCalledTimes(1);
      expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
      expect(onPurchaseError).not.toHaveBeenCalled();
    });

    it('emits onPurchaseError when extension API returns non-ok status', async () => {
      const sdk = createSdkWithSession();

      const newExpiresAt = new Date((EXP_SECONDS + 30 * 60) * 1000).toISOString();
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ extensionMinutes: 30, tokenCost: 10, newExpiresAt }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
        })
      );

      const onPurchaseStart = vi.fn();
      const onPurchaseError = vi.fn();
      const onPurchaseSuccess = vi.fn();
      sdk.on('onPurchaseStart', onPurchaseStart);
      sdk.on('onPurchaseError', onPurchaseError);
      sdk.on('onPurchaseSuccess', onPurchaseSuccess);

      await expect(sdk.extendSession({ skipConfirmation: true })).rejects.toMatchObject({
        code: 'EXTENSION_FAILED',
        statusCode: 402,
      });

      expect(onPurchaseStart).toHaveBeenCalledTimes(1);
      expect(onPurchaseError).toHaveBeenCalledTimes(1);
      expect(onPurchaseSuccess).not.toHaveBeenCalled();
    });

    it('throws NO_SESSION when there is no active session', async () => {
      const sdk = new MarketplaceSDK({
        apiEndpoint: MOCK_API_ENDPOINT,
        jwksUri: 'https://api.example.com/.well-known/jwks.json',
        autoStart: false,
      });

      await expect(sdk.extendSession({ skipConfirmation: true })).rejects.toMatchObject({
        code: 'NO_SESSION',
      });
    });

    it('throws SDKError when getExtensionCost fails', async () => {
      const sdk = createSdkWithSession();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      }));

      await expect(sdk.extendSession({ skipConfirmation: true })).rejects.toBeInstanceOf(SDKError);
    });

    // ─── GW-8308: timer recompute after extension ──────────────────────────
    // The POST /extend response returns newExpiresAt as a Unix-SECONDS number
    // (see pact/consumers/sessions.pact.spec.ts: `newExpiresAt: like(1717203600)`
    // and the `onSessionExtended` / `SessionExtendContext` types which document
    // newExpiresAt as "Unix seconds"). The recompute in extendSession() must
    // treat it as seconds, not pass it through `new Date(number)` (which reads
    // the value as milliseconds → a ~1970 date → a large negative remaining time
    // and a spurious "session expired"). Regression for GW-8308.
    describe('timer recompute (GW-8308)', () => {
      // POST /extend returns newExpiresAt as Unix SECONDS (per Pact contract),
      // NOT an ISO string. This is the shape the real dev API returns.
      function setupExtensionFetchSecondsNumber(
        extensionMinutes = 30,
        tokenCost = 10,
      ) {
        const newExpiresAtSeconds = EXP_SECONDS + extensionMinutes * 60;
        const fetchMock = vi.fn()
          // getExtensionCost — cost API returns ISO string for its own field
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              extensionMinutes,
              tokenCost,
              newExpiresAt: new Date(newExpiresAtSeconds * 1000).toISOString(),
            }),
          })
          // POST /extend — returns Unix seconds number
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ newExpiresAt: newExpiresAtSeconds }),
          })
          // getTokenBalance refresh
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ balance: 90 }),
          });
        vi.stubGlobal('fetch', fetchMock);
        return { fetchMock, newExpiresAtSeconds };
      }

      it('sets a positive remaining time when /extend returns Unix seconds', async () => {
        const sdk = createSdkWithSession();
        const s = sdk as unknown as Record<string, unknown>;
        // Attach a real timer so we can observe the recomputed remaining time.
        s['timer'] = new TimerManager(3600, 300, {}, false);

        const { newExpiresAtSeconds } = setupExtensionFetchSecondsNumber(30);

        await sdk.extendSession({ skipConfirmation: true });

        const timer = s['timer'] as TimerManager;
        const remaining = timer.getRemainingSeconds();

        // Original session had ~1h left; extending by 30m → ~90m remaining.
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(90 * 60 + 5);
        expect(remaining).toBeGreaterThanOrEqual(90 * 60 - 60);

        // sessionData.exp must remain a Unix-seconds value, unchanged in magnitude.
        const sessionData = s['sessionData'] as { exp: number };
        expect(sessionData.exp).toBe(newExpiresAtSeconds);
      });

      it('fires onSessionExtended with newExpiresAt in Unix seconds', async () => {
        const sdk = createSdkWithSession();
        const s = sdk as unknown as Record<string, unknown>;
        s['timer'] = new TimerManager(3600, 300, {}, false);

        const { newExpiresAtSeconds } = setupExtensionFetchSecondsNumber(30);

        const onSessionExtended = vi.fn();
        sdk.on('onSessionExtended', onSessionExtended);

        await sdk.extendSession({ skipConfirmation: true });

        expect(onSessionExtended).toHaveBeenCalledWith(
          expect.objectContaining({ newExpiresAt: newExpiresAtSeconds }),
        );
      });
    });
  });
});
