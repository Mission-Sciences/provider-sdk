import type {
  ThemeMode,
  TokenBalance,
  ApplicationItem,
  Position,
  SessionControlLink,
  FadeConfig,
  TimerFormat,
  ThemeTokens,
} from "../types";
import {
  getTheme,
  Theme,
  generateSessionControlsVars,
  mergeThemeTokens,
} from "../styles/theme";
import { PurchaseModal } from "./PurchaseModal";
import { MarketplaceSDK } from "../core/MarketplaceSDK";
import { Logger } from "../utils/logger";
import { FloatingContainer } from "./FloatingContainer";
import { IdleFadeController } from "./IdleFadeController";
import { OverflowMenu } from "./OverflowMenu";
import { partitionLinks, renderLinkAnchor } from "./LinkRenderer";

/**
 * Session Header Component
 *
 * Two render modes:
 *
 * 1. **Legacy inline** (unchanged backward-compat path):
 *    `sessionHeader.mount(element | selector, { getTime, sdk?, onEnd?, position? })`
 *    Renders the existing inline DOM with timer, balance, extend, Add-ons,
 *    and end controls. Preserved to avoid breaking existing consumers.
 *
 * 2. **Floating widget** (new GW-5294 path used by SDK auto-mount):
 *    `sessionHeader.mount({ mode: 'floating', ... })`
 *    Renders the redesigned widget — viewport-positioned pill with timer,
 *    threshold color shifts, extend button, developer-configured links in
 *    an overflow menu, and idle-fade behavior.
 *
 * The `mount()` method detects which form is in use by whether the first
 * argument is a DOM element / selector (legacy) or an options object (new).
 * This keeps existing callers working without code changes.
 */

/**
 * Options for the new floating/inline mount path (GW-5294).
 * Accepts `mode: 'floating'` | `mode: 'inline'`. Inline mode in this path
 * delegates to the legacy renderer so there's one inline implementation.
 */
export interface SessionHeaderMountOptions {
  mode?: "floating" | "inline";
  /** Required when mode === 'inline'. */
  target?: HTMLElement | string;
  getTime: () => string;
  sdk?: MarketplaceSDK;
  onEnd?: () => void;
  /** Floating mode: viewport anchor. Inline mode: horizontal alignment. */
  position?: Position | "left" | "center" | "right";
  offset?: { x?: number; y?: number };
  fade?: FadeConfig;
  links?: SessionControlLink[];
  timerFormat?: TimerFormat;
  showExtendButton?: boolean;
  theme?: ThemeTokens;
  zIndex?: number;
  /** Warning threshold in seconds (from SDKConfig). Default 300. */
  warningThresholdSeconds?: number;
}

/** Legacy options — unchanged from the original API. */
export interface LegacySessionHeaderOptions {
  getTime: () => string;
  sdk?: MarketplaceSDK;
  onEnd?: () => void;
  position?: "left" | "center" | "right";
}

const moduleLogger = new Logger(false, "[gw-sdk]");

const FLOATING_POSITIONS: ReadonlySet<string> = new Set<Position>([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export class SessionHeader {
  private theme: Theme;

  // Legacy inline rendering state (unchanged from pre-GW-5294).
  private container: HTMLDivElement | null = null;
  private updateInterval: number | null = null;
  private timeDisplay: HTMLElement | null = null;
  private balanceDisplay: HTMLElement | null = null;
  private getTimeCallback: (() => string) | undefined;
  private onEndCallback: (() => void) | undefined;
  private sdk: MarketplaceSDK | undefined;
  private purchaseModal: PurchaseModal | null = null;
  private mounted: boolean = false;
  private itemsPanel: HTMLElement | null = null;
  private availableItems: ApplicationItem[] = [];
  private balanceChangeHandler: ((balance: TokenBalance) => void) | null = null;
  private sessionExtendedHandler:
    | ((data: { additionalMinutes: number; newExpiresAt: number }) => void)
    | null = null;

  // Floating-mode rendering state (GW-5294).
  private floatingContainer: FloatingContainer | null = null;
  private floatingRoot: HTMLElement | null = null;
  private floatingTimer: HTMLElement | null = null;
  private floatingFade: IdleFadeController | null = null;
  private floatingOverflow: OverflowMenu | null = null;
  private floatingWarningThresholdSeconds = 300;
  private floatingCurrentThreshold: "neutral" | "warning" | "critical" =
    "neutral";
  private floatingSessionWarningHandler: (() => void) | null = null;
  private floatingSessionExtendedHandler:
    | ((data: { additionalMinutes: number; newExpiresAt: number }) => void)
    | null = null;

  constructor(themeMode: ThemeMode = "auto") {
    const prefersDark =
      themeMode === "dark" || (themeMode === "auto" && this.detectDarkMode());
    this.theme = getTheme(prefersDark);
  }

  private detectDarkMode(): boolean {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }

  /**
   * Mount the session header.
   *
   * Two call signatures:
   *
   *   // Legacy — renders inline into the developer's container.
   *   mount(targetElement, { getTime, sdk?, onEnd?, position? })
   *
   *   // New — renders as a floating viewport widget or inline by mode.
   *   mount({ mode, target?, getTime, sdk?, onEnd?, position?, fade?, links?, ... })
   *
   * Backward compatibility is preserved by runtime detection: if the first
   * argument is an `HTMLElement` or `string`, we dispatch to the legacy
   * renderer with the existing API. Otherwise we treat it as the new options
   * object.
   */
  mount(
    target: HTMLElement | string,
    options: LegacySessionHeaderOptions,
  ): void;
  mount(options: SessionHeaderMountOptions): void;
  mount(
    arg1: HTMLElement | string | SessionHeaderMountOptions,
    arg2?: LegacySessionHeaderOptions,
  ): void {
    if (this.isLegacyCall(arg1)) {
      this.mountLegacy(arg1, arg2!);
      return;
    }
    this.mountNew(arg1 as SessionHeaderMountOptions);
  }

  private isLegacyCall(
    arg: HTMLElement | string | SessionHeaderMountOptions,
  ): arg is HTMLElement | string {
    if (typeof arg === "string") return true;
    if (typeof HTMLElement !== "undefined" && arg instanceof HTMLElement)
      return true;
    return false;
  }

  /**
   * New (GW-5294) mount path. Branches to floating or inline based on `mode`.
   */
  private mountNew(options: SessionHeaderMountOptions): void {
    const mode = options.mode ?? "floating";

    if (mode === "inline") {
      const target = options.target;
      if (!target) {
        moduleLogger.warn(
          "SessionHeader.mount: mode 'inline' requires a target",
        );
        return;
      }
      const position =
        options.position === "left" ||
        options.position === "center" ||
        options.position === "right"
          ? options.position
          : undefined;
      this.mountLegacy(target, {
        getTime: options.getTime,
        sdk: options.sdk,
        onEnd: options.onEnd,
        position,
      });
      return;
    }

    // Floating mode.
    if (this.mounted) this.unmount();

    this.getTimeCallback = options.getTime;
    this.onEndCallback = options.onEnd;
    this.sdk = options.sdk;
    this.floatingWarningThresholdSeconds =
      options.warningThresholdSeconds ?? 300;

    // Apply theme-token overrides if provided.
    if (options.theme) {
      this.theme = mergeThemeTokens(this.theme, options.theme);
    }

    const position = this.resolveFloatingPosition(options.position);

    this.floatingContainer = new FloatingContainer({
      position,
      offset: options.offset,
      zIndex: options.zIndex,
    });
    this.floatingRoot = this.floatingContainer.element;
    this.floatingRoot.setAttribute("data-testid", "sdk-session-header");
    this.applyFloatingCssVars();

    this.renderFloatingContents(options);
    this.floatingContainer.mount();

    this.floatingFade = new IdleFadeController({
      target: this.floatingRoot,
      enabled: options.fade?.enabled ?? true,
      idleOpacity: options.fade?.idleOpacity ?? 0.7,
      idleDelayMs: options.fade?.idleDelayMs ?? 5000,
    });
    this.floatingFade.attach();

    this.registerFloatingSdkEvents();
    this.mounted = true;
    this.startUpdating();
  }

  private resolveFloatingPosition(
    position: SessionHeaderMountOptions["position"],
  ): Position {
    if (position && FLOATING_POSITIONS.has(position)) {
      return position as Position;
    }
    return "bottom-right";
  }

  private applyFloatingCssVars(): void {
    if (!this.floatingRoot) return;
    const vars = generateSessionControlsVars(this.theme);
    for (const [k, v] of Object.entries(vars)) {
      this.floatingRoot.style.setProperty(k, v);
    }

    // Base visual styles keyed off CSS vars. Overridable by host CSS via
    // classnames — stable public API.
    this.floatingRoot.style.display = "inline-flex";
    this.floatingRoot.style.alignItems = "center";
    this.floatingRoot.style.gap = "var(--gw-sc-gap)";
    this.floatingRoot.style.padding =
      "var(--gw-sc-padding-y) var(--gw-sc-padding-x)";
    this.floatingRoot.style.background = "var(--gw-sc-bg)";
    this.floatingRoot.style.color = "var(--gw-sc-fg)";
    this.floatingRoot.style.border = "1px solid var(--gw-sc-border)";
    this.floatingRoot.style.borderRadius = "var(--gw-sc-radius)";
    this.floatingRoot.style.boxShadow = "var(--gw-sc-shadow)";
    this.floatingRoot.style.font = "inherit";
    this.floatingRoot.style.fontFamily = "var(--gw-sc-font)";
    this.floatingRoot.style.fontSize = "var(--gw-sc-font-size)";
    this.floatingRoot.style.lineHeight = "1";
    this.floatingRoot.style.whiteSpace = "nowrap";
  }

  private renderFloatingContents(options: SessionHeaderMountOptions): void {
    if (!this.floatingRoot) return;

    // Timer
    this.floatingTimer = document.createElement("span");
    this.floatingTimer.className = "gw-session-controls__timer";
    this.floatingTimer.setAttribute("role", "status");
    this.floatingTimer.setAttribute("aria-live", "polite");
    this.floatingTimer.setAttribute("data-threshold", "neutral");
    this.floatingTimer.style.fontVariantNumeric = "tabular-nums";
    this.floatingTimer.style.fontWeight = "600";
    this.floatingTimer.textContent = this.getTimeCallback?.() ?? "--:--";
    this.floatingRoot.appendChild(this.floatingTimer);

    // Extend button (opt-out via showExtendButton: false)
    const showExtend = options.showExtendButton ?? true;
    if (showExtend && this.sdk) {
      const divider = this.createDivider();
      this.floatingRoot.appendChild(divider);

      const extendBtn = document.createElement("button");
      extendBtn.type = "button";
      extendBtn.className = "gw-session-controls__extend";
      extendBtn.textContent = "Extend";
      extendBtn.style.border = "0";
      extendBtn.style.cursor = "pointer";
      extendBtn.style.font = "inherit";
      extendBtn.style.fontWeight = "600";
      extendBtn.style.padding = "6px 12px";
      extendBtn.style.borderRadius = "calc(var(--gw-sc-radius) - 4px)";
      extendBtn.style.background = "var(--gw-sc-primary)";
      extendBtn.style.color = "var(--gw-sc-primary-fg)";
      extendBtn.addEventListener("click", () => this.openExtensionModal());
      this.floatingRoot.appendChild(extendBtn);
    }

    // Links (primary promoted + overflow menu)
    const { primary, overflow } = partitionLinks(options.links);
    if (primary.length > 0 || overflow.length > 0) {
      for (const link of primary) {
        const anchor = renderLinkAnchor(link, "gw-session-controls__link");
        anchor.style.color = "var(--gw-sc-primary)";
        anchor.style.textDecoration = "none";
        anchor.style.fontWeight = "500";
        anchor.style.padding = "4px 6px";
        anchor.style.borderRadius = "6px";
        this.floatingRoot.appendChild(anchor);
      }

      // Overflow wrapper with position:relative so the menu popover
      // anchors to the trigger.
      const overflowWrap = document.createElement("span");
      overflowWrap.style.position = "relative";
      overflowWrap.style.display = "inline-flex";
      this.floatingOverflow = new OverflowMenu();
      overflowWrap.appendChild(this.floatingOverflow.element);
      this.floatingOverflow.setItems(overflow);
      this.floatingRoot.appendChild(overflowWrap);
    }
  }

  private createDivider(): HTMLElement {
    const d = document.createElement("span");
    d.className = "gw-session-controls__divider";
    d.setAttribute("aria-hidden", "true");
    d.style.width = "1px";
    d.style.height = "18px";
    d.style.background = "var(--gw-sc-border)";
    return d;
  }

  private registerFloatingSdkEvents(): void {
    if (!this.sdk) return;

    this.floatingSessionWarningHandler = () => {
      // Warning threshold reached — force active and apply 'warning' style.
      this.floatingFade?.forceActive("warning-threshold");
      this.applyThresholdState("warning");
    };

    this.floatingSessionExtendedHandler = () => {
      if (this.floatingTimer && this.getTimeCallback) {
        this.floatingTimer.textContent = this.getTimeCallback();
      }
      // Recovered beyond warning — release force and recompute state.
      this.floatingFade?.releaseForce("warning-threshold");
      this.applyThresholdState(this.computeThresholdFromTimer());
    };

    this.sdk.on("onSessionWarning", this.floatingSessionWarningHandler);
    this.sdk.on("onSessionExtended", this.floatingSessionExtendedHandler);
  }

  /**
   * Parse the formatted time ("MM:SS" or "H:MM:SS") and compute the
   * current threshold state. Falls back to 'neutral' on parse failure.
   */
  private computeThresholdFromTimer(): "neutral" | "warning" | "critical" {
    if (!this.floatingTimer) return "neutral";
    const text = this.floatingTimer.textContent ?? "";
    const parts = text.split(":").map((p) => Number(p.trim()));
    if (parts.some((n) => Number.isNaN(n))) return "neutral";

    let totalSeconds: number;
    if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      return "neutral";
    }

    if (totalSeconds <= 60) return "critical";
    if (totalSeconds <= this.floatingWarningThresholdSeconds) return "warning";
    return "neutral";
  }

  private applyThresholdState(next: "neutral" | "warning" | "critical"): void {
    if (next === this.floatingCurrentThreshold) return;
    this.floatingCurrentThreshold = next;
    if (!this.floatingTimer || !this.floatingRoot) return;

    this.floatingTimer.setAttribute("data-threshold", next);
    this.floatingRoot.classList.remove(
      "gw-session-controls--warning",
      "gw-session-controls--critical",
    );

    if (next === "warning") {
      this.floatingRoot.classList.add("gw-session-controls--warning");
      this.floatingTimer.style.color = "var(--gw-sc-warning)";
      this.floatingFade?.forceActive("warning-threshold");
    } else if (next === "critical") {
      this.floatingRoot.classList.add("gw-session-controls--critical");
      this.floatingTimer.style.color = "var(--gw-sc-warning)";
      this.floatingFade?.forceActive("warning-threshold");
    } else {
      this.floatingTimer.style.color = "";
      this.floatingFade?.releaseForce("warning-threshold");
    }
  }

  // =========================================================================
  // LEGACY inline rendering path — behavior preserved from pre-GW-5294.
  // =========================================================================

  /**
   * Legacy inline mount. Do not change behavior here without updating the
   * SessionHeader unit tests, which assert specific DOM output.
   */
  private mountLegacy(
    targetElement: HTMLElement | string,
    options: LegacySessionHeaderOptions,
  ): void {
    // Unmount if already mounted
    if (this.mounted) {
      this.unmount();
    }

    // Get target element
    const target =
      typeof targetElement === "string"
        ? document.querySelector<HTMLElement>(targetElement)
        : targetElement;

    if (!target) {
      return;
    }

    this.getTimeCallback = options.getTime;
    this.onEndCallback = options.onEnd;
    this.sdk = options.sdk;

    // Create container
    this.container = document.createElement("div");
    this.container.id = "gw-session-header";
    this.container.setAttribute("data-testid", "sdk-session-header");

    const position = options.position || "right";
    const justifyContent =
      position === "left"
        ? "flex-start"
        : position === "center"
          ? "center"
          : "flex-end";

    this.container.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: ${justifyContent};
      gap: ${this.theme.spacing.gap.md};
      padding: ${this.theme.spacing.padding.sm} ${this.theme.spacing.padding.md};
      background-color: ${this.theme.colors.card};
      border: 1px solid ${this.theme.colors.border};
      border-radius: ${this.theme.spacing.borderRadius.md};
      font-family: ${this.theme.typography.fontFamily};
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    `;

    // Create timer display
    const timerWrapper = document.createElement("div");
    timerWrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${this.theme.spacing.gap.sm};
      color: ${this.theme.colors.foreground};
      font-size: ${this.theme.typography.fontSize.sm};
      font-weight: ${this.theme.typography.fontWeight.medium};
    `;

    const clockIcon = document.createElement("span");
    clockIcon.textContent = "⏱️";
    clockIcon.style.fontSize = this.theme.typography.fontSize.base;

    this.timeDisplay = document.createElement("span");
    this.timeDisplay.id = "gw-session-time";
    this.timeDisplay.setAttribute("data-testid", "sdk-session-timer");
    this.timeDisplay.textContent = this.getTimeCallback?.() || "--:--";
    this.timeDisplay.style.cssText = `
      font-variant-numeric: tabular-nums;
      min-width: 50px;
      text-align: center;
    `;

    timerWrapper.appendChild(clockIcon);
    timerWrapper.appendChild(this.timeDisplay);
    this.container.appendChild(timerWrapper);

    // Create balance display
    this.balanceDisplay = document.createElement("span");
    this.balanceDisplay.className = "gw-header-balance";
    this.balanceDisplay.style.cssText = `
      font-size: ${this.theme.typography.fontSize.sm};
      color: ${this.theme.colors.mutedForeground};
      font-weight: ${this.theme.typography.fontWeight.medium};
      white-space: nowrap;
    `;
    this.balanceDisplay.textContent = "Balance: -- SMART";
    this.container.appendChild(this.balanceDisplay);

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: ${this.theme.spacing.gap.sm};
    `;

    if (this.sdk) {
      const extendBtn = document.createElement("button");
      extendBtn.textContent = "Extend";
      extendBtn.style.cssText = `
        padding: ${this.theme.spacing.padding.sm};
        background-color: ${this.theme.colors.success};
        color: ${this.theme.colors.successForeground};
        border: none;
        border-radius: ${this.theme.spacing.borderRadius.sm};
        font-size: ${this.theme.typography.fontSize.sm};
        font-weight: ${this.theme.typography.fontWeight.medium};
        font-family: ${this.theme.typography.fontFamily};
        cursor: pointer;
        transition: opacity 0.2s;
      `;
      extendBtn.addEventListener("mouseenter", () => {
        extendBtn.style.opacity = "0.9";
      });
      extendBtn.addEventListener("mouseleave", () => {
        extendBtn.style.opacity = "1";
      });
      extendBtn.addEventListener("click", () => {
        this.openExtensionModal();
      });
      buttonContainer.appendChild(extendBtn);

      this.createAddonsButton(buttonContainer);
    }

    if (this.onEndCallback) {
      const endBtn = document.createElement("button");
      endBtn.textContent = "End";
      endBtn.style.cssText = `
        padding: ${this.theme.spacing.padding.sm};
        background-color: ${this.theme.colors.secondary};
        color: ${this.theme.colors.secondaryForeground};
        border: 1px solid ${this.theme.colors.border};
        border-radius: ${this.theme.spacing.borderRadius.sm};
        font-size: ${this.theme.typography.fontSize.sm};
        font-weight: ${this.theme.typography.fontWeight.medium};
        font-family: ${this.theme.typography.fontFamily};
        cursor: pointer;
        transition: opacity 0.2s;
      `;
      endBtn.addEventListener("mouseenter", () => {
        endBtn.style.opacity = "0.9";
      });
      endBtn.addEventListener("mouseleave", () => {
        endBtn.style.opacity = "1";
      });
      endBtn.addEventListener("click", () => {
        this.onEndCallback?.();
      });
      buttonContainer.appendChild(endBtn);
    }

    if (buttonContainer.children.length > 0) {
      this.container.appendChild(buttonContainer);
    }

    target.appendChild(this.container);
    this.mounted = true;

    if (this.sdk) {
      this.balanceChangeHandler = (balance: TokenBalance) => {
        this.updateBalanceDisplay(balance.balance, balance.unit);
      };

      this.sessionExtendedHandler = () => {
        if (this.timeDisplay && this.getTimeCallback) {
          this.timeDisplay.textContent = this.getTimeCallback();
        }
      };

      this.sdk.on("onBalanceChange", this.balanceChangeHandler);
      this.sdk.on("onSessionExtended", this.sessionExtendedHandler);

      this.refreshBalance();
    }

    this.startUpdating();
  }

  private async openExtensionModal(): Promise<void> {
    if (!this.sdk) return;

    try {
      const [costResult, balance] = await Promise.all([
        this.sdk.getExtensionCost(),
        this.sdk.getTokenBalance(),
      ]);

      if (!this.purchaseModal) {
        this.purchaseModal = new PurchaseModal();
      }

      this.purchaseModal.show({
        item: {
          id: "session-extension",
          name: `Extend Session (+${costResult.extensionMinutes} min)`,
          tokenCost: costResult.tokenCost,
        },
        currentBalance: balance.balance,
        onConfirm: async () => {
          await this.sdk!.extendSession({ skipConfirmation: true });
        },
        onCancel: () => {
          // no-op
        },
      });
    } catch {
      // silently skip
    }
  }

  private async refreshBalance(): Promise<void> {
    if (!this.sdk) return;
    try {
      const balance = await this.sdk.getTokenBalance();
      this.updateBalanceDisplay(balance.balance, balance.unit);
    } catch {
      // silent
    }
  }

  private async createAddonsButton(
    buttonContainer: HTMLElement,
  ): Promise<void> {
    if (!this.sdk) return;

    try {
      this.availableItems = await this.sdk.getAvailableItems();

      if (this.availableItems.length > 0) {
        const addonsBtn = document.createElement("button");
        addonsBtn.textContent = "Add-ons";
        addonsBtn.style.cssText = `
          padding: ${this.theme.spacing.padding.sm};
          background-color: ${this.theme.colors.primary};
          color: ${this.theme.colors.primaryForeground};
          border: none;
          border-radius: ${this.theme.spacing.borderRadius.sm};
          font-size: ${this.theme.typography.fontSize.sm};
          font-weight: ${this.theme.typography.fontWeight.medium};
          font-family: ${this.theme.typography.fontFamily};
          cursor: pointer;
          transition: opacity 0.2s;
        `;
        addonsBtn.addEventListener("mouseenter", () => {
          addonsBtn.style.opacity = "0.9";
        });
        addonsBtn.addEventListener("mouseleave", () => {
          addonsBtn.style.opacity = "1";
        });
        addonsBtn.addEventListener("click", () => {
          this.toggleItemsPanel();
        });
        buttonContainer.appendChild(addonsBtn);
      }
    } catch {
      // silent
    }
  }

  private toggleItemsPanel(): void {
    if (this.itemsPanel) {
      this.itemsPanel.remove();
      this.itemsPanel = null;
    } else {
      this.createItemsPanel();
    }
  }

  private async createItemsPanel(): Promise<void> {
    if (!this.container || !this.sdk) return;

    this.itemsPanel = document.createElement("div");
    this.itemsPanel.className = "gw-items-panel";
    this.itemsPanel.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: ${this.theme.spacing.gap.sm};
      background-color: ${this.theme.colors.card};
      border: 1px solid ${this.theme.colors.border};
      border-radius: ${this.theme.spacing.borderRadius.md};
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      min-width: 280px;
      max-width: 320px;
      z-index: 1000;
      font-family: ${this.theme.typography.fontFamily};
    `;

    for (const item of this.availableItems) {
      const itemElement = document.createElement("div");
      itemElement.className = "gw-item";
      itemElement.style.cssText = `
        padding: ${this.theme.spacing.padding.md};
        border-bottom: 1px solid ${this.theme.colors.border};
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      itemElement.addEventListener("mouseenter", () => {
        itemElement.style.backgroundColor = this.theme.colors.accent;
      });
      itemElement.addEventListener("mouseleave", () => {
        itemElement.style.backgroundColor = "transparent";
      });

      itemElement.innerHTML = `
        <div style="font-weight: ${this.theme.typography.fontWeight.medium}; color: ${this.theme.colors.foreground};">
          ${item.name}
        </div>
        <div style="font-size: ${this.theme.typography.fontSize.sm}; color: ${this.theme.colors.mutedForeground}; margin-top: ${this.theme.spacing.gap.sm};">
          ${item.description}
        </div>
        <div style="font-weight: ${this.theme.typography.fontWeight.medium}; color: ${this.theme.colors.primary}; margin-top: ${this.theme.spacing.gap.sm};">
          ${item.userTokenCost} SMART
        </div>
      `;

      itemElement.addEventListener("click", () => {
        this.openItemPurchaseModal(item);
      });

      this.itemsPanel.appendChild(itemElement);
    }

    this.container.style.position = "relative";
    this.container.appendChild(this.itemsPanel);
  }

  private async openItemPurchaseModal(item: ApplicationItem): Promise<void> {
    if (!this.sdk) return;

    try {
      const balance = await this.sdk.getTokenBalance();

      if (!this.purchaseModal) {
        this.purchaseModal = new PurchaseModal();
      }

      this.purchaseModal.show({
        item: {
          id: item.id,
          name: item.name,
          tokenCost: item.userTokenCost,
        },
        currentBalance: balance.balance,
        onConfirm: async () => {
          if (this.itemsPanel) {
            this.itemsPanel.remove();
            this.itemsPanel = null;
          }
        },
        onCancel: () => {
          // no-op
        },
      });
    } catch {
      // silent
    }
  }

  private updateBalanceDisplay(balance: number, unit: string = "SMART"): void {
    if (this.balanceDisplay) {
      this.balanceDisplay.textContent = `Balance: ${balance} ${unit}`;
    }
  }

  private startUpdating(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = window.setInterval(() => {
      // Legacy inline timer update.
      if (this.timeDisplay && this.getTimeCallback) {
        const newTime = this.getTimeCallback();
        this.timeDisplay.textContent = newTime;

        // Legacy color shift — kept unchanged.
        const [minutes] = newTime.split(":").map(Number);
        if (!isNaN(minutes) && minutes < 5) {
          this.timeDisplay.style.color = this.theme.colors.destructive;
          this.timeDisplay.style.fontWeight =
            this.theme.typography.fontWeight.bold;
        } else {
          this.timeDisplay.style.color = this.theme.colors.foreground;
          this.timeDisplay.style.fontWeight =
            this.theme.typography.fontWeight.medium;
        }
      }

      // Floating-mode timer update.
      if (this.floatingTimer && this.getTimeCallback) {
        this.floatingTimer.textContent = this.getTimeCallback();
        this.applyThresholdState(this.computeThresholdFromTimer());
      }
    }, 1000);
  }

  unmount(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.purchaseModal?.hide();
    this.purchaseModal = null;

    if (this.itemsPanel) {
      this.itemsPanel.remove();
      this.itemsPanel = null;
    }

    // Legacy
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.timeDisplay = null;
    this.balanceDisplay = null;

    // Floating
    if (this.floatingFade) {
      this.floatingFade.detach();
      this.floatingFade = null;
    }
    if (this.floatingOverflow) {
      this.floatingOverflow.destroy();
      this.floatingOverflow = null;
    }
    if (this.floatingContainer) {
      this.floatingContainer.detach();
      this.floatingContainer = null;
    }
    this.floatingRoot = null;
    this.floatingTimer = null;

    this.mounted = false;
  }

  destroy(): void {
    this.unmount();
    this.sdk = undefined;
    this.balanceChangeHandler = null;
    this.sessionExtendedHandler = null;
    this.floatingSessionWarningHandler = null;
    this.floatingSessionExtendedHandler = null;
  }

  isMounted(): boolean {
    return this.mounted;
  }

  updateTheme(themeMode: ThemeMode): void {
    const prefersDark =
      themeMode === "dark" || (themeMode === "auto" && this.detectDarkMode());
    this.theme = getTheme(prefersDark);

    if (this.mounted && this.container && this.container.parentElement) {
      const parent = this.container.parentElement;
      const options = {
        getTime: this.getTimeCallback!,
        sdk: this.sdk,
        onEnd: this.onEndCallback,
      };
      this.unmount();
      this.mountLegacy(parent, options);
    }
  }
}
