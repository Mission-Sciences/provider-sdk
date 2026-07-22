import type { ModalStyles, ThemeMode, ExtensionCostResult } from "../types";
import { getTheme, Theme } from "../styles/theme";
import { DurationSlider } from "./DurationSlider";

export interface ExtensionModalOptions {
  /** Current token balance */
  currentBalance: number;
  /** Initial extension cost result (includes min/max) */
  initialCost: ExtensionCostResult;
  /** Callback to fetch updated cost when slider changes */
  onCostUpdate: (minutes: number) => Promise<ExtensionCostResult>;
  /** Called when the user confirms the extension */
  onConfirm: (extensionMinutes: number) => Promise<void>;
  /** Called when the user cancels */
  onCancel?: () => void;
}

/**
 * Extension Modal with duration slider for selecting extension time.
 * DOM-based component (no React dependency) for maximum compatibility.
 */
export class ExtensionModal {
  private modal: HTMLDivElement | null = null;
  private theme: Theme;
  private themeMode: ThemeMode;
  private legacyStyles: ModalStyles | null = null;
  private slider: DurationSlider | null = null;
  private currentCost: ExtensionCostResult | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private previousActiveElement: Element | null = null;

  constructor(
    themeMode: ThemeMode = "light",
    customStyles?: Partial<ModalStyles>,
  ) {
    this.themeMode = themeMode;
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
   * Show the extension modal with duration slider.
   */
  show(options: ExtensionModalOptions): void {
    this.hide();
    this.currentCost = options.initialCost;

    const canAfford = options.currentBalance >= options.initialCost.tokenCost;

    const bgColor =
      this.legacyStyles?.backgroundColor || this.theme.colors.card;
    const textColor =
      this.legacyStyles?.textColor || this.theme.colors.cardForeground;
    const borderRadius =
      this.legacyStyles?.borderRadius || this.theme.spacing.borderRadius.lg;
    const fontFamily =
      this.legacyStyles?.fontFamily || this.theme.typography.fontFamily;

    this.modal = document.createElement("div");
    this.modal.id = "gw-extension-modal";
    this.modal.setAttribute("data-testid", "sdk-extension-modal");
    this.modal.setAttribute("role", "dialog");
    this.modal.setAttribute("aria-modal", "true");
    this.modal.setAttribute("aria-labelledby", "gw-extension-modal-title");
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
      <h2 id="gw-extension-modal-title" style="margin: 0 0 ${this.theme.spacing.padding.md} 0; font-size: ${this.theme.typography.fontSize.xl}; font-weight: ${this.theme.typography.fontWeight.semibold}; color: ${textColor};">
        Extend Session
      </h2>
      <div id="gw-extension-slider-container"></div>
      <div id="gw-extension-cost-details" style="margin-bottom: ${this.theme.spacing.padding.lg}; font-size: ${this.theme.typography.fontSize.base}; line-height: ${this.theme.typography.lineHeight.normal}; color: ${this.theme.colors.mutedForeground};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Token Cost</span>
          <strong data-testid="sdk-extension-token-cost" style="color: ${textColor};">${options.initialCost.tokenCost} SMART tokens</strong>
        </div>
        <div style="border-top: 1px solid ${this.theme.colors.border}; padding-top: 8px; display: flex; justify-content: space-between;">
          <span>Your balance</span>
          <strong data-testid="sdk-extension-balance" style="color: ${canAfford ? this.theme.colors.success : this.theme.colors.destructive};">
            ${options.currentBalance} SMART tokens
          </strong>
        </div>
        <div id="gw-extension-insufficient" style="display: ${canAfford ? "none" : "block"}; margin-top: 8px; color: ${this.theme.colors.destructive}; font-size: ${this.theme.typography.fontSize.sm};">
          Insufficient balance. You need <span data-testid="sdk-extension-deficit">${options.initialCost.tokenCost - options.currentBalance}</span> more SMART tokens.
        </div>
      </div>
      <div id="gw-extension-error" style="display: none; margin-bottom: ${this.theme.spacing.padding.md}; color: ${this.theme.colors.destructive}; font-size: ${this.theme.typography.fontSize.sm};"></div>
      <div style="display: flex; gap: ${this.theme.spacing.gap.md}; justify-content: flex-end;">
        <button id="gw-extension-cancel-btn" data-testid="sdk-extension-cancel" style="
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
        <button id="gw-extension-confirm-btn" data-testid="sdk-extension-confirm" ${!canAfford ? "disabled" : ""} style="
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
          Extend Session
        </button>
      </div>
    `;

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    // Initialize the duration slider
    const sliderContainer = document.getElementById(
      "gw-extension-slider-container",
    );
    if (sliderContainer) {
      this.slider = new DurationSlider(this.themeMode);
      this.slider.render(sliderContainer, {
        min: options.initialCost.minExtensionMinutes,
        max: options.initialCost.maxExtensionMinutes,
        value: options.initialCost.extensionMinutes,
        step: 15,
        onChange: (minutes) => this.handleSliderChange(minutes, options),
      });
    }

    this.attachButtonListeners(options, content, fontFamily);

    // Store previously focused element for restoration
    this.previousActiveElement = document.activeElement;

    // Set up keyboard handler for Escape key
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
        options.onCancel?.();
      }
      // Focus trap: Tab and Shift+Tab cycle within modal
      if (e.key === "Tab") {
        const focusableElements = content.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener("keydown", this.keydownHandler);

    // Focus the first focusable element (cancel button) for accessibility
    const cancelBtn = document.getElementById("gw-extension-cancel-btn");
    cancelBtn?.focus();
  }

  /**
   * Handle slider value changes with debounced cost updates.
   */
  private async handleSliderChange(
    minutes: number,
    options: ExtensionModalOptions,
  ): Promise<void> {
    // Clear existing debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the cost update to avoid excessive API calls
    this.debounceTimer = setTimeout(async () => {
      try {
        const newCost = await options.onCostUpdate(minutes);
        this.currentCost = newCost;
        this.updateCostDisplay(newCost, options.currentBalance);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to update extension cost:", error);
      }
    }, 300);
  }

  /**
   * Update the cost display in the modal.
   */
  private updateCostDisplay(
    cost: ExtensionCostResult,
    currentBalance: number,
  ): void {
    const canAfford = currentBalance >= cost.tokenCost;

    const costEl = document.querySelector(
      '[data-testid="sdk-extension-token-cost"]',
    );
    if (costEl) {
      costEl.textContent = `${cost.tokenCost} SMART tokens`;
    }

    // Update balance color dynamically based on affordability
    const balanceEl = document.querySelector(
      '[data-testid="sdk-extension-balance"]',
    ) as HTMLElement | null;
    if (balanceEl) {
      balanceEl.style.color = canAfford
        ? this.theme.colors.success
        : this.theme.colors.destructive;
    }

    const insufficientEl = document.getElementById("gw-extension-insufficient");
    if (insufficientEl) {
      insufficientEl.style.display = canAfford ? "none" : "block";
      const deficitEl = insufficientEl.querySelector(
        '[data-testid="sdk-extension-deficit"]',
      );
      if (deficitEl) {
        deficitEl.textContent = String(cost.tokenCost - currentBalance);
      }
    }

    const confirmBtn = document.getElementById(
      "gw-extension-confirm-btn",
    ) as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.disabled = !canAfford;
      confirmBtn.style.backgroundColor = canAfford
        ? this.theme.colors.primary
        : this.theme.colors.muted;
      confirmBtn.style.color = canAfford
        ? this.theme.colors.primaryForeground
        : this.theme.colors.mutedForeground;
      confirmBtn.style.cursor = canAfford ? "pointer" : "not-allowed";
    }
  }

  private attachButtonListeners(
    options: ExtensionModalOptions,
    content: HTMLDivElement,
    fontFamily: string,
  ): void {
    const cancelBtn = document.getElementById(
      "gw-extension-cancel-btn",
    ) as HTMLButtonElement | null;
    const confirmBtn = document.getElementById(
      "gw-extension-confirm-btn",
    ) as HTMLButtonElement | null;
    const errorEl = document.getElementById(
      "gw-extension-error",
    ) as HTMLDivElement | null;

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.hide();
        options.onCancel?.();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        if (!this.currentCost || !this.slider) return;

        const extensionMinutes = this.slider.getValue();
        const canAfford = options.currentBalance >= this.currentCost.tokenCost;

        if (!canAfford) return;

        this.setLoadingState(confirmBtn, cancelBtn, true, fontFamily);
        if (errorEl) {
          errorEl.style.display = "none";
        }

        try {
          await options.onConfirm(extensionMinutes);
          this.hide();
        } catch (err) {
          this.setLoadingState(confirmBtn, cancelBtn, false, fontFamily);
          const message =
            err instanceof Error
              ? err.message
              : "Extension failed. Please try again.";
          if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = "block";
          }
        }
      });
    }

    // Add hover/focus effects
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
    confirmBtn.textContent = loading ? "Extending..." : "Extend Session";
    confirmBtn.style.cursor = loading ? "not-allowed" : "pointer";
    confirmBtn.style.opacity = loading ? "0.7" : "1";
    confirmBtn.style.fontFamily = fontFamily;

    if (cancelBtn) {
      cancelBtn.disabled = loading;
      cancelBtn.style.opacity = loading ? "0.5" : "1";
    }
  }

  /**
   * Hide and remove the modal from the DOM.
   */
  hide(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Remove keyboard handler
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.slider) {
      this.slider.destroy();
      this.slider = null;
    }

    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }

    // Restore focus to previously active element
    if (
      this.previousActiveElement &&
      this.previousActiveElement instanceof HTMLElement
    ) {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }

    this.currentCost = null;
  }

  /**
   * Check if the modal is currently shown.
   */
  isShown(): boolean {
    return this.modal !== null;
  }
}
