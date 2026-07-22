// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OverflowMenu } from "../../../src/ui/OverflowMenu";

describe("OverflowMenu", () => {
  let host: HTMLElement;
  let menu: OverflowMenu;

  beforeEach(() => {
    host = document.createElement("div");
    host.style.position = "relative";
    document.body.appendChild(host);

    menu = new OverflowMenu();
    host.appendChild(menu.element);
  });

  afterEach(() => {
    menu.destroy();
    document.body.innerHTML = "";
  });

  function queryMenuItems(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        '.gw-session-controls__menu [role="menuitem"]',
      ),
    );
  }

  it("renders a trigger button with correct ARIA attributes", () => {
    expect(menu.element.tagName).toBe("BUTTON");
    expect(menu.element.getAttribute("aria-haspopup")).toBe("menu");
    expect(menu.element.getAttribute("aria-expanded")).toBe("false");
    expect(menu.element.textContent).toBe("⋯");
  });

  it("hides itself when there are no items", () => {
    menu.setItems([]);
    expect(menu.element.style.display).toBe("none");
  });

  it("shows itself when items are set", () => {
    menu.setItems([{ label: "Docs", href: "/docs" }]);
    expect(menu.element.style.display).toBe("");
  });

  it("click opens the menu and renders items with role=menuitem", () => {
    menu.setItems([
      { label: "Docs", href: "/docs" },
      { label: "Terms", href: "/terms" },
    ]);
    menu.element.click();
    const items = queryMenuItems();
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute("role")).toBe("menuitem");
    expect(menu.element.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape key closes the menu", () => {
    menu.setItems([{ label: "Docs", href: "/docs" }]);
    menu.element.click();
    expect(queryMenuItems()).toHaveLength(1);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(queryMenuItems()).toHaveLength(0);
    expect(menu.element.getAttribute("aria-expanded")).toBe("false");
  });

  it("outside click closes the menu", () => {
    menu.setItems([{ label: "Docs", href: "/docs" }]);
    menu.element.click();
    expect(queryMenuItems()).toHaveLength(1);
    document.body.click();
    expect(queryMenuItems()).toHaveLength(0);
  });

  it("ArrowDown from trigger opens the menu and focuses first item", () => {
    menu.setItems([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
    ]);
    menu.element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    const items = queryMenuItems();
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);
  });

  it("ArrowDown on an item cycles to the next; ArrowUp cycles back", () => {
    menu.setItems([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C", href: "/c" },
    ]);
    menu.element.click();
    const items = queryMenuItems();
    items[0].focus();
    items[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[0]);
  });

  it("Home/End jump to first/last items", () => {
    menu.setItems([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C", href: "/c" },
    ]);
    menu.element.click();
    const items = queryMenuItems();
    items[1].focus();
    items[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[2]);
    items[2].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[0]);
  });

  it("setItems with open menu closes the menu", () => {
    menu.setItems([{ label: "A", href: "/a" }]);
    menu.element.click();
    expect(queryMenuItems()).toHaveLength(1);
    menu.setItems([{ label: "B", href: "/b" }]);
    expect(queryMenuItems()).toHaveLength(0);
  });
});
