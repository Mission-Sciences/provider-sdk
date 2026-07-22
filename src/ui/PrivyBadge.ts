import type { ThemeMode, ModalStyles } from "../types";
import { getTheme, Theme } from "../styles/theme";

/**
 * PrivyBadge renders an inline "Privy 1" badge to indicate that an item
 * requires Privy 1 verification before it can be purchased.
 *
 * DOM-based (no React dependency) for maximum compatibility.
 * Use `render()` to get an HTMLElement suitable for embedding in item cards,
 * or `renderHTML()` to get a raw HTML string for innerHTML injection.
 *
 * @example
 * ```ts
 * const badge = new PrivyBadge('light');
 * itemCardEl.appendChild(badge.render());
 * ```
 */
export class PrivyBadge {
  private theme: Theme;

  constructor(
    themeMode: ThemeMode = "light",
    customStyles?: Partial<ModalStyles>,
  ) {
    const prefersDark =
      themeMode === "dark" || (themeMode === "auto" && this.detectDarkMode());
    this.theme = getTheme(prefersDark);

    // customStyles parameter reserved for future colour overrides; currently unused
    void customStyles;
  }

  private detectDarkMode(): boolean {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }

  /**
   * Returns an HTMLSpanElement styled as the Privy 1 badge.
   */
  render(): HTMLSpanElement {
    const badge = document.createElement("span");
    badge.className = "gw-privy-badge";
    badge.setAttribute("data-testid", "sdk-privy-badge");
    badge.setAttribute("aria-label", "Requires Privy 1 verification");
    badge.setAttribute("title", "This item requires Privy 1 verification");
    badge.style.cssText = this.badgeCss();
    badge.textContent = "Privy 1";
    return badge;
  }

  /**
   * Returns a self-contained HTML string for use with innerHTML.
   */
  renderHTML(): string {
    return `<span class="gw-privy-badge" aria-label="Requires Privy 1 verification" title="This item requires Privy 1 verification" style="${this.badgeCss()}">Privy 1</span>`;
  }

  private badgeCss(): string {
    return [
      `display: inline-flex`,
      `align-items: center`,
      `gap: 4px`,
      `padding: 2px 8px`,
      `background-color: ${this.theme.colors.primary}`,
      `color: ${this.theme.colors.primaryForeground}`,
      `border-radius: 9999px`,
      `font-size: ${this.theme.typography.fontSize.xs}`,
      `font-weight: ${this.theme.typography.fontWeight.semibold}`,
      `font-family: ${this.theme.typography.fontFamily}`,
      `line-height: ${this.theme.typography.lineHeight.tight}`,
      `white-space: nowrap`,
      `user-select: none`,
      `vertical-align: middle`,
    ].join("; ");
  }
}
