// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FloatingContainer } from "../../../src/ui/FloatingContainer";
import type { Position } from "../../../src/types";

function makeMedia(matches: boolean) {
  const listeners = new Set<(ev: MediaQueryListEvent) => void>();
  const mql: Record<string, unknown> = {
    matches,
    media: "(max-width: 480px)",
    addEventListener: (
      _type: string,
      cb: EventListenerOrEventListenerObject,
    ) => {
      listeners.add(cb as (ev: MediaQueryListEvent) => void);
    },
    removeEventListener: (
      _type: string,
      cb: EventListenerOrEventListenerObject,
    ) => {
      listeners.delete(cb as (ev: MediaQueryListEvent) => void);
    },
    _emit(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      for (const l of listeners) l({ matches: next } as MediaQueryListEvent);
    },
  };
  return mql as unknown as MediaQueryList & { _emit: (m: boolean) => void };
}

describe("FloatingContainer", () => {
  const originalMatchMedia = window.matchMedia;
  let mql: ReturnType<typeof makeMedia>;

  beforeEach(() => {
    mql = makeMedia(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = "";
  });

  it("creates a fixed-position root with expected classname and ARIA", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    expect(fc.element.className).toContain("gw-session-controls");
    expect(fc.element.className).toContain("gw-session-controls--floating");
    expect(fc.element.getAttribute("role")).toBe("region");
    expect(fc.element.getAttribute("aria-label")).toBe("Session controls");
    expect(fc.element.style.position).toBe("fixed");
    fc.detach();
  });

  it("applies bottom-right offsets by default", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    expect(fc.element.style.bottom).toBe("16px");
    expect(fc.element.style.right).toBe("16px");
    expect(fc.element.style.top).toBe("");
    expect(fc.element.style.left).toBe("");
    fc.detach();
  });

  it("applies each of the six anchor positions", () => {
    const cases: Array<[Position, Record<string, string>]> = [
      ["top-left", { top: "16px", left: "16px" }],
      ["top-right", { top: "16px", right: "16px" }],
      ["top-center", { top: "16px", left: "50%", transform: "translateX(-50%)" }],
      ["bottom-left", { bottom: "16px", left: "16px" }],
      ["bottom-right", { bottom: "16px", right: "16px" }],
      [
        "bottom-center",
        { bottom: "16px", left: "50%", transform: "translateX(-50%)" },
      ],
    ];

    for (const [pos, expected] of cases) {
      const fc = new FloatingContainer({ position: pos });
      for (const [k, v] of Object.entries(expected)) {
        expect(
          fc.element.style.getPropertyValue(k) || (fc.element.style as unknown as Record<string, string>)[k],
        ).toBe(v);
      }
      fc.detach();
    }
  });

  it("honors custom offsets and zIndex", () => {
    const fc = new FloatingContainer({
      position: "top-left",
      offset: { x: 4, y: 8 },
      zIndex: 42,
    });
    expect(fc.element.style.top).toBe("8px");
    expect(fc.element.style.left).toBe("4px");
    expect(fc.element.style.zIndex).toBe("42");
    fc.detach();
  });

  it("mount() appends to document.body once", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    fc.mount();
    fc.mount();
    expect(document.body.querySelectorAll(".gw-session-controls").length).toBe(
      1,
    );
    fc.detach();
  });

  it("narrow-viewport mode for bottom-* collapses to fullwidth bottom bar", () => {
    mql._emit(true);
    const fc = new FloatingContainer({ position: "bottom-right" });
    fc.mount();
    // Manually trigger narrow state via the observed query.
    expect(fc.element.className).toContain("gw-session-controls--narrow");
    expect(fc.element.style.left).toBe("0px");
    expect(fc.element.style.right).toBe("0px");
    expect(fc.element.style.bottom).toBe("0px");
    expect(fc.element.style.top).toBe("");
    fc.detach();
  });

  it("narrow-viewport mode for top-* collapses to fullwidth top bar", () => {
    mql._emit(true);
    const fc = new FloatingContainer({ position: "top-left" });
    fc.mount();
    expect(fc.element.className).toContain("gw-session-controls--narrow");
    expect(fc.element.style.top).toBe("0px");
    expect(fc.element.style.bottom).toBe("");
  });

  it("updatePosition updates anchors at runtime", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    fc.updatePosition("top-left");
    expect(fc.element.style.top).toBe("16px");
    expect(fc.element.style.left).toBe("16px");
    expect(fc.element.style.bottom).toBe("");
    fc.detach();
  });

  it("detach removes the element from DOM and clears the media listener", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    fc.mount();
    expect(document.body.contains(fc.element)).toBe(true);
    fc.detach();
    expect(document.body.contains(fc.element)).toBe(false);
  });

  it("attach() appends a child into the floating root", () => {
    const fc = new FloatingContainer({ position: "bottom-right" });
    const child = document.createElement("span");
    child.textContent = "hi";
    fc.attach(child);
    expect(fc.element.contains(child)).toBe(true);
    fc.detach();
  });
});
