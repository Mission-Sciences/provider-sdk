// @vitest-environment jsdom

/**
 * GW-6324: endSession tries window.close() before redirecting.
 * GW-6674: extend failure from the warning modal shows an inline error and
 * never redirects/kills the app tab.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";
import { SDKError } from "../../src/types";

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function createSdk(): MarketplaceSDK {
  const sdk = new MarketplaceSDK({
    apiEndpoint: "https://sdk.test.example.com",
    jwksUri: "https://api.example.com/.well-known/jwks.json",
    applicationId: "app-6324",
    autoStart: false,
    sessionControls: { autoMount: false },
  });
  const s = sdk as unknown as Record<string, unknown>;
  s["sessionData"] = {
    sessionId: "sess-6324-001",
    applicationId: "app-6324",
    userId: "user-1",
    orgId: "org-1",
    startTime: NOW_SECONDS - 60,
    durationMinutes: 60,
    iat: NOW_SECONDS - 60,
    exp: NOW_SECONDS + 3600,
    iss: "generalwisdom.com",
    sub: "user-1",
  };
  s["jwtToken"] = "aaa.bbb.ccc";
  return sdk;
}

describe("endSession close-then-redirect (GW-6324)", () => {
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    closeSpy = vi.fn();
    vi.stubGlobal("close", closeSpy);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("tries window.close() when the ending modal completes", async () => {
    const sdk = createSdk();
    await sdk.endSession();

    // Ending modal is on screen; nothing closed yet.
    expect(document.getElementById("gw-session-ending-modal")).not.toBeNull();
    expect(closeSpy).not.toHaveBeenCalled();

    // Advance exactly to the modal-complete callback (3000ms). Do NOT advance
    // the extra 200ms fallback so the jsdom-unsupported redirect never runs.
    vi.advanceTimersByTime(3000);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("schedules the marketplace redirect only as a fallback after close()", async () => {
    const sdk = createSdk();
    await sdk.endSession();
    vi.advanceTimersByTime(3000);

    // close() was attempted first; the redirect is a pending 200ms timer,
    // i.e. it has not run at the moment close() fires.
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});

describe("warning-modal extend failure stays in-tab (GW-6674, SDK level)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("shows an inline error in the warning modal instead of redirecting", async () => {
    const sdk = createSdk();
    vi.spyOn(sdk, "extendSession").mockRejectedValue(
      new SDKError("Session extension failed", "EXTENSION_FAILED", 500),
    );

    // Open the warning modal via the private path used by the timer.
    (
      sdk as unknown as { showWarningModal(seconds: number): void }
    ).showWarningModal(120);

    const extendBtn = document.getElementById(
      "gw-extend-btn",
    ) as HTMLButtonElement;
    expect(extendBtn).not.toBeNull();

    const before = window.location.href;
    extendBtn.click();
    // Let the rejected extendSession promise settle.
    await vi.waitFor(() => {
      expect(document.getElementById("gw-extend-error")).not.toBeNull();
    });

    const errorEl = document.getElementById("gw-extend-error");
    expect(errorEl?.textContent).toContain("Could not extend");
    // Warning modal still open; app tab untouched.
    expect(document.getElementById("gw-session-warning-modal")).not.toBeNull();
    expect(document.getElementById("gw-session-ending-modal")).toBeNull();
    expect(window.location.href).toBe(before);
  });

  it("maps 402 to an insufficient-tokens message", async () => {
    const sdk = createSdk();
    vi.spyOn(sdk, "extendSession").mockRejectedValue(
      new SDKError("Session extension failed", "EXTENSION_FAILED", 402),
    );

    (
      sdk as unknown as { showWarningModal(seconds: number): void }
    ).showWarningModal(120);

    (document.getElementById("gw-extend-btn") as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(document.getElementById("gw-extend-error")).not.toBeNull();
    });
    expect(document.getElementById("gw-extend-error")?.textContent).toContain(
      "Not enough tokens",
    );
  });
});
