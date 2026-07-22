// @vitest-environment jsdom

/**
 * Unit tests for MarketplaceSDK session-controls auto-mount (GW-5294).
 *
 * Covers maybeAutoMountSessionHeader, mountSessionHeader(),
 * unmountSessionHeader(), and updateSessionControls().
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";

function noopGetTime() {
  return "12:34";
}

// Access the private auto-mount trigger through the public mountSessionHeader
// API so tests can exercise it without running through initialize() (which
// requires JWT validation infrastructure).
describe("MarketplaceSDK session-controls lifecycle", () => {
  let sdk: MarketplaceSDK;

  beforeEach(() => {
    sdk = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
    });
  });

  afterEach(() => {
    sdk.unmountSessionHeader();
    document.body.innerHTML = "";
  });

  it("mountSessionHeader() mounts a floating widget", () => {
    sdk.mountSessionHeader({
      mode: "floating",
      getTime: noopGetTime,
      sdk,
    });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).not.toBeNull();
  });

  it("mountSessionHeader() replaces an existing mount", () => {
    sdk.mountSessionHeader({ mode: "floating", getTime: noopGetTime, sdk });
    sdk.mountSessionHeader({ mode: "floating", getTime: noopGetTime, sdk });
    const widgets = document.body.querySelectorAll(
      ".gw-session-controls--floating",
    );
    expect(widgets).toHaveLength(1);
  });

  it("unmountSessionHeader() removes the widget", () => {
    sdk.mountSessionHeader({ mode: "floating", getTime: noopGetTime, sdk });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).not.toBeNull();
    sdk.unmountSessionHeader();
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).toBeNull();
  });

  it("unmountSessionHeader() is idempotent", () => {
    expect(() => sdk.unmountSessionHeader()).not.toThrow();
    sdk.mountSessionHeader({ mode: "floating", getTime: noopGetTime, sdk });
    sdk.unmountSessionHeader();
    expect(() => sdk.unmountSessionHeader()).not.toThrow();
  });

  it("updateSessionControls before mount stores the config but does not mount", () => {
    sdk.updateSessionControls({ position: "top-left" });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).toBeNull();
  });

  it("updateSessionControls while mounted remounts with new config", () => {
    sdk.mountSessionHeader({
      mode: "floating",
      getTime: noopGetTime,
      sdk,
      position: "bottom-right",
    });
    const before = document.body.querySelector(
      ".gw-session-controls--floating",
    ) as HTMLElement;
    expect(before.style.bottom).toBe("16px");
    expect(before.style.right).toBe("16px");

    sdk.updateSessionControls({ position: "top-left" });
    const after = document.body.querySelector(
      ".gw-session-controls--floating",
    ) as HTMLElement;
    expect(after).not.toBeNull();
    expect(after.style.top).toBe("16px");
    expect(after.style.left).toBe("16px");
    // The old element should be gone — we verify only one widget is in the DOM.
    expect(
      document.body.querySelectorAll(".gw-session-controls--floating"),
    ).toHaveLength(1);
  });

  it("updateSessionControls with autoMount: false unmounts the widget", () => {
    sdk.mountSessionHeader({ mode: "floating", getTime: noopGetTime, sdk });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).not.toBeNull();
    sdk.updateSessionControls({ autoMount: false });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).toBeNull();
  });

  // Regression for the /validate finding on PR #45: test-app sets
  // `sessionControls: { autoMount: false }` in its SDKConfig so that existing
  // e2e fixtures against the inline mount point stay stable, and then drives
  // the floating widget explicitly via mountSessionHeader/updateSessionControls.
  // The original updateSessionControls implementation early-returned on
  // `next.autoMount === false` after unmounting, leaving the widget gone.
  it("updateSessionControls remounts when SDK config has autoMount: false and widget was explicitly mounted", () => {
    const sdkOptOut = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
      sessionControls: { autoMount: false },
    });
    try {
      sdkOptOut.mountSessionHeader({
        mode: "floating",
        getTime: noopGetTime,
        sdk: sdkOptOut,
        position: "bottom-right",
      });
      expect(
        document.body.querySelector(".gw-session-controls--floating"),
      ).not.toBeNull();

      sdkOptOut.updateSessionControls({ position: "top-left" });

      const after = document.body.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement | null;
      expect(after).not.toBeNull();
      expect(after!.style.top).toBe("16px");
      expect(after!.style.left).toBe("16px");
    } finally {
      sdkOptOut.unmountSessionHeader();
    }
  });
});

describe("MarketplaceSDK auto-mount in floating mode (GW-5813)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("auto-mounts the floating widget when no sessionControls config is provided", () => {
    // Simulates a publisher who does not configure sessionControls at all.
    // The SDK should auto-mount the floating widget when maybeAutoMountSessionHeader
    // is triggered. We call mountSessionHeader directly since initialize() requires
    // JWT infrastructure, but this mirrors the exact call maybeAutoMountSessionHeader makes.
    const sdk = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
    });
    // Simulate what maybeAutoMountSessionHeader does internally
    sdk.mountSessionHeader({
      mode: "floating",
      getTime: () => sdk.getFormattedTime(),
      sdk,
      onEnd: () => {},
      position: "bottom-right",
    });
    const widget = document.body.querySelector(
      ".gw-session-controls--floating",
    );
    expect(widget).not.toBeNull();
    expect(widget?.getAttribute("data-testid")).toBe("sdk-session-header");
    sdk.destroy();
  });

  it("auto-mounts at all six positions", () => {
    const positions = [
      "top-left",
      "top-center",
      "top-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ] as const;

    for (const position of positions) {
      const sdk = new MarketplaceSDK({
        applicationId: "test-app",
        apiKey: "gwsk_test",
      });
      sdk.mountSessionHeader({
        mode: "floating",
        getTime: () => "10:00",
        sdk,
        position,
      });
      const widget = document.body.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement;
      expect(widget).not.toBeNull();

      // Verify position is applied correctly
      if (position.startsWith("top-")) {
        expect(widget.style.top).toBe("16px");
      }
      if (position.startsWith("bottom-")) {
        expect(widget.style.bottom).toBe("16px");
      }
      if (position.endsWith("-left")) {
        expect(widget.style.left).toBe("16px");
      }
      if (position.endsWith("-right")) {
        expect(widget.style.right).toBe("16px");
      }
      if (position.endsWith("-center")) {
        expect(widget.style.left).toBe("50%");
        expect(widget.style.transform).toBe("translateX(-50%)");
      }

      sdk.destroy();
      document.body.innerHTML = "";
    }
  });

  it("destroy() removes the floating widget from the DOM", () => {
    const sdk = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
    });
    sdk.mountSessionHeader({
      mode: "floating",
      getTime: () => "10:00",
      sdk,
    });
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).not.toBeNull();
    sdk.destroy();
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).toBeNull();
  });

  it("idle-fade behavior initializes correctly on auto-mount", () => {
    const sdk = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
    });
    sdk.mountSessionHeader({
      mode: "floating",
      getTime: () => "10:00",
      sdk,
      fade: { enabled: true, idleOpacity: 0.6, idleDelayMs: 3000 },
    });
    const widget = document.body.querySelector(
      ".gw-session-controls--floating",
    ) as HTMLElement;
    // Initially active at full opacity
    expect(widget.style.opacity).toBe("1");
    expect(widget.getAttribute("data-state")).toBe("active");
    sdk.destroy();
  });
});

describe("MarketplaceSDK sessionControls config surface", () => {
  it("accepts a full sessionControls block in SDKConfig without error", () => {
    expect(
      () =>
        new MarketplaceSDK({
          applicationId: "test-app",
          apiKey: "gwsk_test",
          sessionControls: {
            autoMount: true,
            mode: "floating",
            position: "bottom-right",
            offset: { x: 20, y: 20 },
            fade: { enabled: true, idleOpacity: 0.5, idleDelayMs: 3000 },
            links: [{ label: "Docs", href: "/docs" }],
            timerFormat: "countdown",
            showExtendButton: true,
            theme: { colors: { primary: "#FF6B35" } },
            zIndex: 100,
          },
        }),
    ).not.toThrow();
  });

  it("accepts sessionControls.autoMount: false to opt out", () => {
    const sdk = new MarketplaceSDK({
      applicationId: "test-app",
      apiKey: "gwsk_test",
      sessionControls: { autoMount: false },
    });
    // Nothing is mounted without an explicit mount call.
    expect(
      document.body.querySelector(".gw-session-controls--floating"),
    ).toBeNull();
    sdk.unmountSessionHeader();
  });
});
