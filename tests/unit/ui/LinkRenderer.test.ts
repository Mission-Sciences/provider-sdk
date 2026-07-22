// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  partitionLinks,
  renderLinkAnchor,
} from "../../../src/ui/LinkRenderer";

describe("partitionLinks", () => {
  it("returns empty arrays for undefined or empty input", () => {
    expect(partitionLinks(undefined)).toEqual({ primary: [], overflow: [] });
    expect(partitionLinks([])).toEqual({ primary: [], overflow: [] });
  });

  it("puts primary links up to the cap of 2, overflow otherwise", () => {
    const out = partitionLinks([
      { label: "Docs", href: "/docs" },
      { label: "Support", href: "/support", primary: true },
      { label: "Terms", href: "/terms" },
      { label: "Console", href: "/console", primary: true },
    ]);
    expect(out.primary.map((l) => l.label)).toEqual(["Support", "Console"]);
    expect(out.overflow.map((l) => l.label)).toEqual(["Docs", "Terms"]);
  });

  it("spills excess primary links into overflow and emits a console warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = partitionLinks([
      { label: "A", href: "/a", primary: true },
      { label: "B", href: "/b", primary: true },
      { label: "C", href: "/c", primary: true },
    ]);
    expect(out.primary.map((l) => l.label)).toEqual(["A", "B"]);
    expect(out.overflow.map((l) => l.label)).toEqual(["C"]);
    expect(out.overflow[0].primary).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("preserves link order within each bucket", () => {
    const out = partitionLinks([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C", href: "/c" },
    ]);
    expect(out.overflow.map((l) => l.label)).toEqual(["A", "B", "C"]);
  });
});

describe("renderLinkAnchor", () => {
  beforeEach(() => {
    // Make location.origin predictable.
    vi.stubGlobal("location", {
      ...window.location,
      href: "https://publisher.example.com/app",
      origin: "https://publisher.example.com",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an <a> with href, label, and the given class", () => {
    const a = renderLinkAnchor(
      { label: "Docs", href: "https://publisher.example.com/docs" },
      "gw-session-controls__link",
    );
    expect(a.tagName).toBe("A");
    expect(a.href).toBe("https://publisher.example.com/docs");
    expect(a.textContent).toBe("Docs");
    expect(a.className).toBe("gw-session-controls__link");
    expect(a.target).toBe("");
    expect(a.rel).toBe("");
  });

  it("adds target=_blank + rel=noopener for cross-origin URLs", () => {
    const a = renderLinkAnchor(
      { label: "External", href: "https://other.example.com/" },
      "x",
    );
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
    expect(a.rel).toContain("noreferrer");
  });

  it("prepends an icon element when provided", () => {
    const a = renderLinkAnchor(
      { label: "Docs", href: "/docs", icon: "📄" },
      "x",
    );
    const firstChild = a.firstChild as HTMLElement | null;
    expect(firstChild?.tagName).toBe("SPAN");
    expect(firstChild?.textContent).toBe("📄");
    expect(firstChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
