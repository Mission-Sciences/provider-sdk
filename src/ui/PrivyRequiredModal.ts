import type { ThemeMode, ModalStyles } from "../types";
import { getTheme, Theme } from "../styles/theme";

export interface PrivyRequiredModalOptions {
  /**
   * The minimum Privy level required (typically 1).
   */
  requiredLevel: number;
  /**
   * The user's current Privy level (typically 0 when this modal is shown).
   */
  currentLevel: number;
  /**
   * Base URL of the GW platform.
   * Upgrade deep-link is constructed as `${gwBaseUrl}/settings?privy=upgrade`.
   * Defaults to `https://platform.generalwisdom.com`.
   */
  gwBaseUrl?: string;
  /**
   * Called when the user clicks "Upgrade to Privy 1".
   * If omitted the modal opens the deep-link in a new tab and closes itself.
   */
  onUpgrade?: (upgradeUrl: string) => void;
  /**
   * Called when the user dismisses the modal without upgrading.
   */
  onCancel?: () => void;
}

const DEFAULT_GW_BASE_URL = "https://platform.generalwisdom.com";

/**
 * PrivyRequiredModal is shown when a purchase attempt is blocked because
 * the user's Privy level is insufficient.
 *
 * It shows a clear explanation and a deep-link button to the GW Privy upgrade
 * flow.  The raw `privyEligibility` payload from the API is intentionally NOT
 * forwarded to publishers — only `requiredLevel` and `currentLevel` are used
 * here.
 *
 * DOM-based (no React dependency) for maximum compatibility.
 */
export class PrivyRequiredModal {
  private modal: HTMLDivElement | null = null;
  private theme: Theme;
  private legacyStyles: ModalStyles | null = null;

  constructor(
    themeMode: ThemeMode = "light",
    customStyles?: Partial<ModalStyles>,
  ) {
    const prefersDark =
      themeMode === "dark" || (themeMode === "auto" && this.detectDarkMode());
    this.theme = getTheme(prefersDark);

    if (customStyles) {
      this.legacyStyles = {
        backgroundColor: customStyles.backgroundColor || "#ffffff",
        textColor: customStyles.textColor || "#333333",
        primaryColor: customStyles.primaryColor || "#007bff",
        borderRadius: customStyles.borderRadius || "8px",
        fontFamily:
          customStyles.fontFamily ||
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      };
    }
  }

  private detectDarkMode(): boolean {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }

  /**
   * Build the upgrade deep-link URL.
   */
  static buildUpgradeUrl(gwBaseUrl?: string): string {
    const base = (gwBaseUrl ?? DEFAULT_GW_BASE_URL).replace(/\/$/, "");
    return `${base}/settings?privy=upgrade`;
  }

  /**
   * Show the PRIVY_REQUIRED modal.
   */
  show(options: PrivyRequiredModalOptions): void {
    this.hide();

    const upgradeUrl = PrivyRequiredModal.buildUpgradeUrl(options.gwBaseUrl);

    const bgColor =
      this.legacyStyles?.backgroundColor || this.theme.colors.card;
    const textColor =
      this.legacyStyles?.textColor || this.theme.colors.cardForeground;
    const borderRadius =
      this.legacyStyles?.borderRadius || this.theme.spacing.borderRadius.lg;
    const fontFamily =
      this.legacyStyles?.fontFamily || this.theme.typography.fontFamily;

    this.modal = document.createElement("div");
    this.modal.id = "gw-privy-required-modal";
    this.modal.setAttribute("data-testid", "sdk-privy-required-modal");
    this.modal.setAttribute("role", "dialog");
    this.modal.setAttribute("aria-modal", "true");
    this.modal.setAttribute("aria-labelledby", "gw-privy-required-title");
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: ${fontFamily};
    `;

    const content = document.createElement("div");
    content.style.cssText = `
      background-color: ${bgColor};
      color: ${textColor};
      border-radius: ${borderRadius};
      padding: ${this.theme.spacing.padding.lg};
      max-width: 440px;
      width: 90%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid ${this.theme.colors.border};
    `;

    content.innerHTML = `
      <div style="text-align: center; margin-bottom: ${this.theme.spacing.padding.md};">
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: ${this.theme.colors.primary};
          color: ${this.theme.colors.primaryForeground};
          font-size: 24px;
          margin-bottom: ${this.theme.spacing.padding.sm};
        ">&#128274;</div>
        <h2 id="gw-privy-required-title" style="
          margin: 0 0 ${this.theme.spacing.padding.sm} 0;
          font-size: ${this.theme.typography.fontSize.xl};
          font-weight: ${this.theme.typography.fontWeight.semibold};
          color: ${textColor};
        ">
          Privy ${options.requiredLevel} Required
        </h2>
        <p style="
          margin: 0 0 ${this.theme.spacing.padding.md} 0;
          font-size: ${this.theme.typography.fontSize.base};
          line-height: ${this.theme.typography.lineHeight.normal};
          color: ${this.theme.colors.mutedForeground};
        ">
          This item requires <strong style="color: ${textColor};">Privy ${options.requiredLevel}</strong> verification.
          Complete your Privy verification to unlock this purchase.
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: ${this.theme.spacing.gap.sm};">
        <a
          id="gw-privy-upgrade-btn"
          data-testid="sdk-privy-upgrade-btn"
          href="${upgradeUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display: block;
            padding: 10px 20px;
            background-color: ${this.theme.colors.primary};
            color: ${this.theme.colors.primaryForeground};
            border: none;
            border-radius: ${this.theme.spacing.borderRadius.sm};
            font-size: ${this.theme.typography.fontSize.sm};
            font-weight: ${this.theme.typography.fontWeight.semibold};
            cursor: pointer;
            font-family: ${fontFamily};
            text-align: center;
            text-decoration: none;
          "
        >
          Upgrade to Privy ${options.requiredLevel}
        </a>
        <button
          id="gw-privy-cancel-btn"
          data-testid="sdk-privy-cancel-btn"
          style="
            display: block;
            padding: 10px 20px;
            background-color: ${this.theme.colors.secondary};
            color: ${this.theme.colors.secondaryForeground};
            border: 1px solid ${this.theme.colors.border};
            border-radius: ${this.theme.spacing.borderRadius.sm};
            font-size: ${this.theme.typography.fontSize.sm};
            font-weight: ${this.theme.typography.fontWeight.medium};
            cursor: pointer;
            font-family: ${fontFamily};
            width: 100%;
          "
        >
          Cancel
        </button>
      </div>
    `;

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    this.attachListeners(options, upgradeUrl);
  }

  private attachListeners(
    options: PrivyRequiredModalOptions,
    upgradeUrl: string,
  ): void {
    const upgradeBtn = document.getElementById(
      "gw-privy-upgrade-btn",
    ) as HTMLAnchorElement | null;
    const cancelBtn = document.getElementById(
      "gw-privy-cancel-btn",
    ) as HTMLButtonElement | null;

    if (upgradeBtn && options.onUpgrade) {
      upgradeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.hide();
        options.onUpgrade!(upgradeUrl);
      });
    } else if (upgradeBtn) {
      // Default: open in new tab and close modal
      upgradeBtn.addEventListener("click", () => {
        this.hide();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.hide();
        options.onCancel?.();
      });
    }

    // Hover / focus styles
    const buttons = this.modal?.querySelectorAll("button, a") ?? [];
    buttons.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.addEventListener("mouseenter", () => {
        htmlEl.style.opacity = "0.9";
      });
      htmlEl.addEventListener("mouseleave", () => {
        htmlEl.style.opacity = "1";
      });
      htmlEl.addEventListener("focus", () => {
        htmlEl.style.outline = `2px solid ${this.theme.colors.ring}`;
        htmlEl.style.outlineOffset = "2px";
      });
      htmlEl.addEventListener("blur", () => {
        htmlEl.style.outline = "none";
      });
    });
  }

  /**
   * Hide and remove the modal from the DOM.
   */
  hide(): void {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
  }

  /**
   * Check if the modal is currently shown.
   */
  isShown(): boolean {
    return this.modal !== null;
  }
}
