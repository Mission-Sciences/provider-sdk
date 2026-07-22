// @vitest-environment jsdom

/**
 * Unit tests for initialize() session-token handling (GW-8643).
 *
 * Covers:
 * - waiting-for-session state when no token is present (resolves null,
 *   no JWKS/"Invalid Compact JWS" error, onWaitingForSession fires)
 * - phone-home fires even without a session JWT
 * - sessionStorage guard: literal "undefined"/"null"/empty/non-JWT values
 *   are treated as absent and evicted
 * - valid stored token still initializes a session
 * - malformed gwSession URL parameter is ignored (and never persisted)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";
import { JWKSValidator } from "../../src/core/JWKSValidator";

const JWT_STORAGE_KEY = "gw_marketplace_jwt";
const APP_ID = "app-8643";
const API_ENDPOINT = "https://sdk.test.example.com";

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const VALID_JWT =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleTEifQ." +
  "eyJzZXNzaW9uSWQiOiJzZXNzLTEifQ." +
  "c2lnbmF0dXJl";

const VERIFIED_CLAIMS = {
  sessionId: "sess-8643-001",
  applicationId: APP_ID,
  userId: "user-1",
  orgId: "org-1",
  startTime: NOW_SECONDS - 60,
  durationMinutes: 60,
  iat: NOW_SECONDS - 60,
  exp: NOW_SECONDS + 3600,
  iss: "generalwisdom.com",
  sub: "user-1",
};

function createSdk(): MarketplaceSDK {
  return new MarketplaceSDK({
    apiEndpoint: API_ENDPOINT,
    jwksUri: "https://api.example.com/.well-known/jwks.json",
    applicationId: APP_ID,
    autoStart: false,
    sessionControls: { autoMount: false },
  });
}

describe("initialize() without a session token (GW-8643)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("resolves null instead of throwing when no token exists", async () => {
    const sdk = createSdk();
    await expect(sdk.initialize()).resolves.toBeNull();
    expect(sdk.getSessionData()).toBeNull();
  });

  it("does not fire onError in the waiting state", async () => {
    const sdk = createSdk();
    const onError = vi.fn();
    sdk.on("onError", onError);
    await sdk.initialize();
    expect(onError).not.toHaveBeenCalled();
  });

  it("fires onWaitingForSession when no token exists", async () => {
    const sdk = createSdk();
    const onWaiting = vi.fn();
    sdk.on("onWaitingForSession", onWaiting);
    await sdk.initialize();
    expect(onWaiting).toHaveBeenCalledTimes(1);
  });

  it("phones home (POST /sdk/initialized) even without a session", async () => {
    const sdk = createSdk();
    await sdk.initialize();
    // Allow the fire-and-forget promise to settle.
    await Promise.resolve();

    const phoneHomeCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/sdk/initialized"),
    );
    expect(phoneHomeCall).toBeDefined();
    const [url, init] = phoneHomeCall!;
    expect(url).toBe(`${API_ENDPOINT}/sdk/initialized`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.applicationId).toBe(APP_ID);
    // jsdom origin is localhost — the WAF workaround must omit body.origin.
    expect(body.origin).toBeUndefined();
  });

  it("skips phone-home when no applicationId is configured", async () => {
    const sdk = new MarketplaceSDK({
      apiEndpoint: API_ENDPOINT,
      jwksUri: "https://api.example.com/.well-known/jwks.json",
      autoStart: false,
      sessionControls: { autoMount: false },
    });
    await sdk.initialize();
    await Promise.resolve();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/sdk/initialized"),
      ),
    ).toBe(false);
  });

  it("phone-home failure is non-fatal", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const sdk = createSdk();
    await expect(sdk.initialize()).resolves.toBeNull();
  });
});

describe("sessionStorage JWT guard (GW-8643)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it.each(["undefined", "null", "", "   ", "not-a-jwt", "a.b"])(
    "treats stored %j as absent and evicts it",
    async (badValue) => {
      sessionStorage.setItem(JWT_STORAGE_KEY, badValue);
      const verifySpy = vi.spyOn(JWKSValidator.prototype, "verify");

      const sdk = createSdk();
      await expect(sdk.initialize()).resolves.toBeNull();

      // The corrupted value must be evicted and never reach verification.
      expect(sessionStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
      expect(verifySpy).not.toHaveBeenCalled();
    },
  );

  it("uses a valid stored JWT and returns session data", async () => {
    sessionStorage.setItem(JWT_STORAGE_KEY, VALID_JWT);
    vi.spyOn(JWKSValidator.prototype, "verify").mockResolvedValue(
      VERIFIED_CLAIMS,
    );

    const sdk = createSdk();
    const result = await sdk.initialize();

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(VERIFIED_CLAIMS.sessionId);
    expect(sessionStorage.getItem(JWT_STORAGE_KEY)).toBe(VALID_JWT);
    sdk.destroy();
  });

  it("persists a valid JWT taken from the URL", async () => {
    window.history.replaceState({}, "", `/?gwSession=${VALID_JWT}`);
    vi.spyOn(JWKSValidator.prototype, "verify").mockResolvedValue(
      VERIFIED_CLAIMS,
    );

    const sdk = createSdk();
    const result = await sdk.initialize();

    expect(result).not.toBeNull();
    expect(sessionStorage.getItem(JWT_STORAGE_KEY)).toBe(VALID_JWT);
    sdk.destroy();
  });

  it("ignores a malformed gwSession URL parameter and never persists it", async () => {
    window.history.replaceState({}, "", "/?gwSession=undefined");
    const verifySpy = vi.spyOn(JWKSValidator.prototype, "verify");

    const sdk = createSdk();
    await expect(sdk.initialize()).resolves.toBeNull();

    expect(sessionStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("never surfaces a JWT-verification error for missing tokens", async () => {
    sessionStorage.setItem(JWT_STORAGE_KEY, "undefined");
    const sdk = createSdk();
    const onError = vi.fn();
    sdk.on("onError", onError);

    await expect(sdk.initialize()).resolves.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});
