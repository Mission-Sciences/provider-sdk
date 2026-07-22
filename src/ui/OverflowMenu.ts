import type { SessionControlLink } from "../types";
import { renderLinkAnchor } from "./LinkRenderer";

/**
 * Accessible dropdown menu for overflow links.
 *
 * - Trigger button with `aria-haspopup="menu"` + `aria-expanded`.
 * - Popover with `role="menu"`, items with `role="menuitem"`.
 * - Arrow-key navigation, `Home`/`End` jump to first/last, `Escape` closes,
 *   outside-click closes.
 * - Links are rendered via LinkRenderer so external URLs get
 *   `target=_blank rel=noopener`.
 *
 * Pure DOM — no focus-trap library.
 */
export class OverflowMenu {
  private trigger: HTMLButtonElement;
  private popover: HTMLElement | null = null;
  private items: SessionControlLink[] = [];
  private open = false;
  private boundOnDocClick: (ev: MouseEvent) => void;
  private boundOnDocKeydown: (ev: KeyboardEvent) => void;
  private classPrefix = "gw-session-controls";

  constructor() {
    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className = `${this.classPrefix}__overflow`;
    this.trigger.setAttribute("aria-label", "More actions");
    this.trigger.setAttribute("aria-haspopup", "menu");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.textContent = "⋯";
    this.trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.toggle();
    });
    this.trigger.addEventListener("keydown", (ev) => this.onTriggerKeydown(ev));

    this.boundOnDocClick = (ev) => this.onDocClick(ev);
    this.boundOnDocKeydown = (ev) => this.onDocKeydown(ev);
  }

  /** Root trigger button. Caller inserts it into the widget layout. */
  get element(): HTMLButtonElement {
    return this.trigger;
  }

  /** Set or replace the menu items. Closes the popover if open. */
  setItems(items: SessionControlLink[]): void {
    this.items = items;
    if (this.open) this.close();
    if (items.length === 0) {
      this.trigger.style.display = "none";
    } else {
      this.trigger.style.display = "";
    }
  }

  /** Detach document listeners and remove the popover. */
  destroy(): void {
    this.close();
  }

  private toggle(): void {
    if (this.open) this.close();
    else this.openMenu();
  }

  private openMenu(): void {
    if (this.items.length === 0) return;
    this.open = true;
    this.trigger.setAttribute("aria-expanded", "true");

    this.popover = document.createElement("div");
    this.popover.className = `${this.classPrefix}__menu`;
    this.popover.setAttribute("role", "menu");

    this.items.forEach((link, idx) => {
      const anchor = renderLinkAnchor(link, `${this.classPrefix}__menu-item`);
      anchor.setAttribute("role", "menuitem");
      anchor.setAttribute("tabindex", idx === 0 ? "0" : "-1");
      anchor.addEventListener("keydown", (ev) => this.onItemKeydown(ev, idx));
      this.popover!.appendChild(anchor);
    });

    // Position above the trigger inside a parent that has position:relative
    // (SessionHeader wraps the overflow button accordingly).
    this.trigger.insertAdjacentElement("afterend", this.popover);
    this.getItemAt(0)?.focus();

    document.addEventListener("click", this.boundOnDocClick, true);
    document.addEventListener("keydown", this.boundOnDocKeydown, true);
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    this.trigger.setAttribute("aria-expanded", "false");

    document.removeEventListener("click", this.boundOnDocClick, true);
    document.removeEventListener("keydown", this.boundOnDocKeydown, true);

    if (this.popover?.parentNode) {
      this.popover.parentNode.removeChild(this.popover);
    }
    this.popover = null;
  }

  private onTriggerKeydown(ev: KeyboardEvent): void {
    if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (!this.open) this.openMenu();
    }
  }

  private onDocClick(ev: MouseEvent): void {
    const t = ev.target as Node | null;
    if (!t) return;
    if (this.trigger.contains(t)) return;
    if (this.popover?.contains(t)) return;
    this.close();
  }

  private onDocKeydown(ev: KeyboardEvent): void {
    if (ev.key === "Escape") {
      ev.preventDefault();
      this.close();
      this.trigger.focus();
    }
  }

  private onItemKeydown(ev: KeyboardEvent, idx: number): void {
    const items = this.items;
    if (items.length === 0) return;

    switch (ev.key) {
      case "ArrowDown":
        ev.preventDefault();
        this.moveFocus((idx + 1) % items.length);
        break;
      case "ArrowUp":
        ev.preventDefault();
        this.moveFocus((idx - 1 + items.length) % items.length);
        break;
      case "Home":
        ev.preventDefault();
        this.moveFocus(0);
        break;
      case "End":
        ev.preventDefault();
        this.moveFocus(items.length - 1);
        break;
      case "Escape":
        ev.preventDefault();
        this.close();
        this.trigger.focus();
        break;
      case "Tab":
        // Allow natural Tab navigation to close the menu.
        this.close();
        break;
    }
  }

  private moveFocus(next: number): void {
    const all =
      this.popover?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!all) return;
    all.forEach((el, i) =>
      el.setAttribute("tabindex", i === next ? "0" : "-1"),
    );
    this.getItemAt(next)?.focus();
  }

  private getItemAt(idx: number): HTMLElement | null {
    return (
      this.popover?.querySelectorAll<HTMLElement>('[role="menuitem"]')[idx] ??
      null
    );
  }
}
