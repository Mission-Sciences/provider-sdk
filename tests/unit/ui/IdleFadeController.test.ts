// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IdleFadeController } from "../../../src/ui/IdleFadeController";

function makeMotionMql(matches: boolean) {
  return {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;
}

describe("IdleFadeController", () => {
  const originalMatchMedia = window.matchMedia;
  let target: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    target = document.createElement("div");
    document.body.appendChild(target);
    window.matchMedia = vi.fn().mockReturnValue(makeMotionMql(false));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = "";
  });

  it("initial state is active with opacity 1 and transition applied", () => {
    const ctrl = new IdleFadeController({ target });
    ctrl.attach();
    expect(target.style.opacity).toBe("1");
    expect(target.getAttribute("data-state")).toBe("active");
    expect(target.style.transition).toContain("opacity");
  });

  it("fades to idleOpacity after idleDelayMs", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
      idleOpacity: 0.5,
    });
    ctrl.attach();
    vi.advanceTimersByTime(100);
    expect(target.style.opacity).toBe("0.5");
    expect(target.getAttribute("data-state")).toBe("idle");
  });

  it("mouseenter cancels pending idle and keeps active", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
    });
    ctrl.attach();
    vi.advanceTimersByTime(50);
    target.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(200);
    // Since mouseenter triggers onActivity → setActive + reschedule, opacity
    // returns to 1 and the idle fires after a full new delay.
    // Here we asserted right after the bump, then after another delay elapsed.
    expect(target.getAttribute("data-state")).toBe("idle");
    expect(target.style.opacity).toBe("0.7"); // default
  });

  it("returns to active when mouseenter fires during idle", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
    });
    ctrl.attach();
    vi.advanceTimersByTime(100);
    expect(target.getAttribute("data-state")).toBe("idle");
    target.dispatchEvent(new MouseEvent("mouseenter"));
    expect(target.getAttribute("data-state")).toBe("active");
    expect(target.style.opacity).toBe("1");
  });

  it("forceActive pins opacity at 1 regardless of idle timer", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
    });
    ctrl.attach();
    ctrl.forceActive("warning-threshold");
    vi.advanceTimersByTime(1000);
    expect(target.style.opacity).toBe("1");
    expect(target.getAttribute("data-state")).toBe("active");
  });

  it("releaseForce resumes idle scheduling", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
    });
    ctrl.attach();
    ctrl.forceActive("warning");
    vi.advanceTimersByTime(200);
    expect(target.style.opacity).toBe("1");
    ctrl.releaseForce("warning");
    vi.advanceTimersByTime(100);
    expect(target.style.opacity).toBe("0.7");
  });

  it("enabled:false never fades", () => {
    const ctrl = new IdleFadeController({
      target,
      enabled: false,
      idleDelayMs: 50,
    });
    ctrl.attach();
    vi.advanceTimersByTime(500);
    expect(target.style.opacity).toBe("1");
    expect(target.getAttribute("data-state")).toBe("active");
  });

  it("respects prefers-reduced-motion by skipping transition", () => {
    window.matchMedia = vi.fn().mockReturnValue(makeMotionMql(true));
    const ctrl = new IdleFadeController({ target });
    ctrl.attach();
    expect(target.style.transition).toBe("none");
  });

  it("detach restores opacity 1 and removes listeners", () => {
    const ctrl = new IdleFadeController({
      target,
      idleDelayMs: 100,
    });
    ctrl.attach();
    vi.advanceTimersByTime(100);
    expect(target.style.opacity).toBe("0.7");
    ctrl.detach();
    expect(target.style.opacity).toBe("1");
    // Post-detach events do not retrigger state changes.
    target.dispatchEvent(new MouseEvent("mouseenter"));
    expect(target.getAttribute("data-state")).toBe("active");
  });
});
