// @vitest-environment jsdom

/**
 * Unit tests for SessionHeader floating mode (GW-5294).
 *
 * Covers the new mount({ mode, ... }) path: floating widget assembly,
 * threshold transitions, fade integration, link rendering, and
 * backward-compat legacy detection on the same class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionHeader } from "../../src/ui/SessionHeader";

function makeMockSDK() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    getTokenBalance: vi
      .fn()
      .mockResolvedValue({ balance: 100, unit: "SMART" }),
    getExtensionCost: vi.fn().mockResolvedValue({
      extensionMinutes: 15,
      tokenCost: 10,
      newExpiresAt: new Date(Date.now() + 900000).toISOString(),
      minExtensionMinutes: 15,
      maxExtensionMinutes: 480,
    }),
    extendSession: vi.fn().mockResolvedValue(undefined),
    getAvailableItems: vi.fn().mockResolvedValue([]),
    _emit(event: string, payload: unknown) {
      (handlers[event] ?? []).forEach((h) => h(payload));
    },
  };
}

describe("SessionHeader — floating mode (GW-5294)", () => {
  let header: SessionHeader;
  let sdk: ReturnType<typeof makeMockSDK>;

  beforeEach(() => {
    header = new SessionHeader("light");
    sdk = makeMockSDK();
  });

  afterEach(() => {
    header.destroy();
    document.body.innerHTML = "";
  });

  describe("assembly", () => {
    it("mounts a floating widget to document.body by default", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      const widget = document.body.querySelector(
        ".gw-session-controls.gw-session-controls--floating",
      );
      expect(widget).not.toBeNull();
      expect(widget?.getAttribute("role")).toBe("region");
      expect(widget?.getAttribute("aria-label")).toBe("Session controls");
    });

    it("renders the timer with tabular-nums and the given text", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      const timer = document.querySelector(
        ".gw-session-controls__timer",
      ) as HTMLElement;
      expect(timer?.textContent).toBe("12:34");
      expect(timer?.style.fontVariantNumeric).toBe("tabular-nums");
      expect(timer?.getAttribute("data-threshold")).toBe("neutral");
      expect(timer?.getAttribute("role")).toBe("status");
    });

    it("renders the Extend button by default when an SDK is provided", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      const btn = document.querySelector(
        ".gw-session-controls__extend",
      ) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Extend");
    });

    it("omits the Extend button when showExtendButton: false", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
        showExtendButton: false,
      });
      const btn = document.querySelector(".gw-session-controls__extend");
      expect(btn).toBeNull();
    });

    it("omits the Extend button when no SDK is provided", () => {
      header.mount({ mode: "floating", getTime: () => "12:34" });
      const btn = document.querySelector(".gw-session-controls__extend");
      expect(btn).toBeNull();
    });

    it("renders promoted primary links inline", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
        links: [
          { label: "Support", href: "https://example.com/support", primary: true },
          { label: "Docs", href: "https://example.com/docs" },
        ],
      });
      const links = document.querySelectorAll(
        "a.gw-session-controls__link",
      ) as NodeListOf<HTMLAnchorElement>;
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toBe("Support");
    });

    it("places non-primary links into an overflow menu", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
        links: [
          { label: "Docs", href: "/docs" },
          { label: "Terms", href: "/terms" },
        ],
      });
      const overflow = document.querySelector(
        ".gw-session-controls__overflow",
      ) as HTMLButtonElement;
      expect(overflow).not.toBeNull();
      overflow.click();
      const items = document.querySelectorAll(
        '.gw-session-controls__menu [role="menuitem"]',
      );
      expect(items).toHaveLength(2);
    });

    it("emits --gw-sc-* CSS variables on the root", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      const root = document.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement;
      expect(root.style.getPropertyValue("--gw-sc-bg")).not.toBe("");
      expect(root.style.getPropertyValue("--gw-sc-primary")).not.toBe("");
      expect(root.style.getPropertyValue("--gw-sc-radius")).not.toBe("");
    });
  });

  describe("threshold transitions", () => {
    it("neutral timer state when remaining > warningThreshold", () => {
      header.mount({
        mode: "floating",
        getTime: () => "15:00",
        sdk: sdk as never,
        warningThresholdSeconds: 300,
      });
      const timer = document.querySelector(
        ".gw-session-controls__timer",
      ) as HTMLElement;
      expect(timer.getAttribute("data-threshold")).toBe("neutral");
    });

    it("applies warning state on onSessionWarning event", () => {
      header.mount({
        mode: "floating",
        getTime: () => "04:30",
        sdk: sdk as never,
        warningThresholdSeconds: 300,
      });
      sdk._emit("onSessionWarning", { remainingSeconds: 270 });
      const root = document.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement;
      expect(root.classList.contains("gw-session-controls--warning")).toBe(
        true,
      );
    });

    it("applies critical state when timer shows ≤60s", () => {
      vi.useFakeTimers();
      try {
        let text = "01:30";
        header.mount({
          mode: "floating",
          getTime: () => text,
          sdk: sdk as never,
          warningThresholdSeconds: 300,
        });
        // After first tick (1s), state should be warning (since 90s > 60).
        text = "00:45";
        vi.advanceTimersByTime(1000);
        const timer = document.querySelector(
          ".gw-session-controls__timer",
        ) as HTMLElement;
        expect(timer.getAttribute("data-threshold")).toBe("critical");
      } finally {
        vi.useRealTimers();
      }
    });

    it("restores neutral state when session is extended past threshold", () => {
      vi.useFakeTimers();
      try {
        let text = "01:30";
        header.mount({
          mode: "floating",
          getTime: () => text,
          sdk: sdk as never,
          warningThresholdSeconds: 300,
        });
        // Drop into warning via timer tick.
        text = "02:00";
        vi.advanceTimersByTime(1000);
        // Then extension bumps time past threshold.
        text = "15:00";
        sdk._emit("onSessionExtended", {
          additionalMinutes: 15,
          newExpiresAt: 0,
        });
        const timer = document.querySelector(
          ".gw-session-controls__timer",
        ) as HTMLElement;
        expect(timer.getAttribute("data-threshold")).toBe("neutral");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("fade", () => {
    it("initial opacity is 1 and data-state is active", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      const root = document.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement;
      expect(root.style.opacity).toBe("1");
      expect(root.getAttribute("data-state")).toBe("active");
    });

    it("fade.enabled: false keeps the widget at full opacity after idle", () => {
      vi.useFakeTimers();
      try {
        header.mount({
          mode: "floating",
          getTime: () => "12:34",
          sdk: sdk as never,
          fade: { enabled: false, idleDelayMs: 50 },
        });
        vi.advanceTimersByTime(200);
        const root = document.querySelector(
          ".gw-session-controls--floating",
        ) as HTMLElement;
        expect(root.style.opacity).toBe("1");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("backward compat", () => {
    it("legacy positional mount(element, opts) still renders inline DOM", () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      header.mount(host, { getTime: () => "10:00", sdk: sdk as never });
      expect(host.querySelector("#gw-session-header")).not.toBeNull();
      expect(host.querySelector(".gw-header-balance")).not.toBeNull();
      expect(host.querySelector(".gw-session-controls--floating")).toBeNull();
    });

    it("mode: 'inline' with target routes through the legacy inline path", () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      header.mount({
        mode: "inline",
        target: host,
        getTime: () => "10:00",
        sdk: sdk as never,
      });
      expect(host.querySelector("#gw-session-header")).not.toBeNull();
    });

    it("unmount removes the floating widget from document.body", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
      });
      expect(
        document.body.querySelector(".gw-session-controls--floating"),
      ).not.toBeNull();
      header.unmount();
      expect(
        document.body.querySelector(".gw-session-controls--floating"),
      ).toBeNull();
      expect(header.isMounted()).toBe(false);
    });
  });

  describe("theme overrides", () => {
    it("applies a partial theme color override via mergeThemeTokens", () => {
      header.mount({
        mode: "floating",
        getTime: () => "12:34",
        sdk: sdk as never,
        theme: { colors: { primary: "rgb(255, 107, 53)" } },
      });
      const root = document.querySelector(
        ".gw-session-controls--floating",
      ) as HTMLElement;
      expect(root.style.getPropertyValue("--gw-sc-primary")).toBe(
        "rgb(255, 107, 53)",
      );
    });
  });
});
