import type { ModalStyles, ThemeMode, PurchaseResult } from "../types";
import { getTheme, Theme } from "../styles/theme";

export interface PurchaseItem {
  /** Item identifier */
  id: string;
  /** Display name for the item */
  name: string;
  /** Token cost per unit */
  tokenCost: number;
}

export interface PurchaseModalOptions {
  /** Item to purchase */
  item: PurchaseItem;
  /** Quantity to purchase (default: 1) */
  quantity?: number;
  /** Current token balance to display */
  currentBalance: number;
  /** Called when the user confirms the purchase */
  onConfirm: (quantity: number) => Promise<void>;
  /** Called when the user cancels */
  onCancel?: () => void;
}

/**
 * Purchase Modal for publisher-triggered in-session purchases.
 * DOM-based component (no React dependency) for maximum compatibility.
 */
export class PurchaseModal {
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
   * Show the purchase confirmation modal.
   */
  show(options: PurchaseModalOptions): void {
    this.hide();

    const quantity = options.quantity ?? 1;
    const totalCost = options.item.tokenCost * quantity;
    const canAfford = options.currentBalance >= totalCost;

    const bgColor =
      this.legacyStyles?.backgroundColor || this.theme.colors.card;
    const textColor =
      this.legacyStyles?.textColor || this.theme.colors.cardForeground;
    const borderRadius =
      this.legacyStyles?.borderRadius || this.theme.spacing.borderRadius.lg;
    const fontFamily =
      this.legacyStyles?.fontFamily || this.theme.typography.fontFamily;

    this.modal = document.createElement("div");
    this.modal.id = "gw-purchase-modal";
    this.modal.setAttribute("data-testid", "sdk-purchase-modal");
    this.modal.setAttribute("role", "dialog");
    this.modal.setAttribute("aria-modal", "true");
    this.modal.setAttribute("aria-labelledby", "gw-purchase-modal-title");
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
      max-width: 420px;
      width: 90%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid ${this.theme.colors.border};
    `;

    content.innerHTML = `
      <h2 id="gw-purchase-modal-title" style="margin: 0 0 ${this.theme.spacing.padding.md} 0; font-size: ${this.theme.typography.fontSize.xl}; font-weight: ${this.theme.typography.fontWeight.semibold}; color: ${textColor};">
        Confirm Purchase
      </h2>
      <div style="margin-bottom: ${this.theme.spacing.padding.lg}; font-size: ${this.theme.typography.fontSize.base}; line-height: ${this.theme.typography.lineHeight.normal}; color: ${this.theme.colors.mutedForeground};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Item</span>
          <strong data-testid="sdk-purchase-item-name" style="color: ${textColor};">${this.escapeHtml(options.item.name)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Quantity</span>
          <strong style="color: ${textColor};">${quantity}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Cost</span>
          <strong data-testid="sdk-purchase-token-cost" style="color: ${textColor};">${totalCost} SMART tokens</strong>
        </div>
        <div style="border-top: 1px solid ${this.theme.colors.border}; padding-top: 8px; display: flex; justify-content: space-between;">
          <span>Your balance</span>
          <strong data-testid="sdk-purchase-balance" style="color: ${canAfford ? this.theme.colors.success : this.theme.colors.destructive};">
            ${options.currentBalance} SMART tokens
          </strong>
        </div>
        ${
          !canAfford
            ? `<div style="margin-top: 8px; color: ${this.theme.colors.destructive}; font-size: ${this.theme.typography.fontSize.sm};">
                Insufficient balance. You need ${totalCost - options.currentBalance} more SMART tokens.
               </div>`
            : ""
        }
      </div>
      <div id="gw-purchase-error" style="display: none; margin-bottom: ${this.theme.spacing.padding.md}; color: ${this.theme.colors.destructive}; font-size: ${this.theme.typography.fontSize.sm};"></div>
      <div style="display: flex; gap: ${this.theme.spacing.gap.md}; justify-content: flex-end;">
        <button id="gw-purchase-cancel-btn" data-testid="sdk-purchase-cancel" style="
          padding: 10px 20px;
          background-color: ${this.theme.colors.secondary};
          color: ${this.theme.colors.secondaryForeground};
          border: 1px solid ${this.theme.colors.border};
          border-radius: ${this.theme.spacing.borderRadius.sm};
          font-size: ${this.theme.typography.fontSize.sm};
          font-weight: ${this.theme.typography.fontWeight.medium};
          cursor: pointer;
          font-family: ${fontFamily};
        ">
          Cancel
        </button>
        <button id="gw-purchase-confirm-btn" data-testid="sdk-purchase-confirm" ${!canAfford ? "disabled" : ""} style="
          padding: 10px 20px;
          background-color: ${canAfford ? this.theme.colors.primary : this.theme.colors.muted};
          color: ${canAfford ? this.theme.colors.primaryForeground : this.theme.colors.mutedForeground};
          border: none;
          border-radius: ${this.theme.spacing.borderRadius.sm};
          font-size: ${this.theme.typography.fontSize.sm};
          font-weight: ${this.theme.typography.fontWeight.medium};
          cursor: ${canAfford ? "pointer" : "not-allowed"};
          font-family: ${fontFamily};
        ">
          Confirm Purchase
        </button>
      </div>
    `;

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    this.attachButtonListeners(options, quantity, content, fontFamily);
  }

  private attachButtonListeners(
    options: PurchaseModalOptions,
    quantity: number,
    content: HTMLDivElement,
    fontFamily: string,
  ): void {
    const cancelBtn = document.getElementById(
      "gw-purchase-cancel-btn",
    ) as HTMLButtonElement | null;
    const confirmBtn = document.getElementById(
      "gw-purchase-confirm-btn",
    ) as HTMLButtonElement | null;
    const errorEl = document.getElementById(
      "gw-purchase-error",
    ) as HTMLDivElement | null;

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.hide();
        options.onCancel?.();
      });
    }

    if (
      confirmBtn &&
      options.item.tokenCost * quantity <= options.currentBalance
    ) {
      confirmBtn.addEventListener("click", async () => {
        this.setLoadingState(confirmBtn, cancelBtn, true, fontFamily);
        if (errorEl) {
          errorEl.style.display = "none";
        }

        try {
          await options.onConfirm(quantity);
          this.hide();
        } catch (err) {
          this.setLoadingState(confirmBtn, cancelBtn, false, fontFamily);
          const message =
            err instanceof Error
              ? err.message
              : "Purchase failed. Please try again.";
          if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = "block";
          }
        }
      });
    }

    const buttons = content.querySelectorAll("button");
    buttons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        if (!(button as HTMLButtonElement).disabled) {
          (button as HTMLElement).style.opacity = "0.9";
        }
      });
      button.addEventListener("mouseleave", () => {
        (button as HTMLElement).style.opacity = "1";
      });
      button.addEventListener("focus", () => {
        (button as HTMLElement).style.outline =
          `2px solid ${this.theme.colors.ring}`;
        (button as HTMLElement).style.outlineOffset = "2px";
      });
      button.addEventListener("blur", () => {
        (button as HTMLElement).style.outline = "none";
      });
    });
  }

  private setLoadingState(
    confirmBtn: HTMLButtonElement,
    cancelBtn: HTMLButtonElement | null,
    loading: boolean,
    fontFamily: string,
  ): void {
    confirmBtn.disabled = loading;
    confirmBtn.textContent = loading ? "Processing..." : "Confirm Purchase";
    confirmBtn.style.cursor = loading ? "not-allowed" : "pointer";
    confirmBtn.style.opacity = loading ? "0.7" : "1";
    confirmBtn.style.fontFamily = fontFamily;

    if (cancelBtn) {
      cancelBtn.disabled = loading;
      cancelBtn.style.opacity = loading ? "0.5" : "1";
    }
  }

  /**
   * Show a purchase success notification briefly before hiding.
   */
  showSuccess(result: PurchaseResult, durationMs: number = 2000): void {
    this.hide();

    const bgColor =
      this.legacyStyles?.backgroundColor || this.theme.colors.card;
    const textColor =
      this.legacyStyles?.textColor || this.theme.colors.cardForeground;
    const borderRadius =
      this.legacyStyles?.borderRadius || this.theme.spacing.borderRadius.lg;
    const fontFamily =
      this.legacyStyles?.fontFamily || this.theme.typography.fontFamily;

    this.modal = document.createElement("div");
    this.modal.id = "gw-purchase-success-modal";
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
      max-width: 420px;
      width: 90%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid ${this.theme.colors.border};
      text-align: center;
    `;

    content.innerHTML = `
      <div style="font-size: 48px; margin-bottom: ${this.theme.spacing.padding.md};">✓</div>
      <h2 style="margin: 0 0 ${this.theme.spacing.padding.md} 0; font-size: ${this.theme.typography.fontSize.xl}; font-weight: ${this.theme.typography.fontWeight.semibold}; color: ${this.theme.colors.success};">
        Purchase Complete
      </h2>
      <p style="margin: 0; font-size: ${this.theme.typography.fontSize.base}; color: ${this.theme.colors.mutedForeground};">
        New balance: <strong style="color: ${textColor};">${result.remainingBalance} SMART tokens</strong>
      </p>
    `;

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    setTimeout(() => {
      this.hide();
    }, durationMs);
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

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}
