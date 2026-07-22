import { Environment } from "./environment";
import type { PurchaseResult, PurchaseError } from "./purchases";

export * from "./marketplace-search";
export * from "./purchases";

/**
 * SDK Configuration
 */
export interface SDKConfig {
  /** Target environment ('production' or 'demo'). Sets environment-specific defaults. */
  environment?: Environment;
  /** JWKS endpoint URL (default: https://api.generalwisdom.com/.well-known/jwks.json) */
  jwksUri?: string;
  /** SDK API endpoint for all backend operations. Defaults to sdk.{env}.generalwisdom.com when environment is set. */
  apiEndpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-start timer after initialization */
  autoStart?: boolean;
  /** Warning threshold in seconds (default: 300 = 5 minutes) */
  warningThresholdSeconds?: number;
  /** Custom styling for warning modal (Legacy - prefer using themeMode) */
  customStyles?: Partial<ModalStyles>;
  /** Theme mode for modal styling (default: 'light') */
  themeMode?: ThemeMode;
  /** Application ID for validation */
  applicationId?: string;
  /** Marketplace URL for redirects (default: https://d3p2yqofgy75sz.cloudfront.net/) */
  marketplaceUrl?: string;
  /** Organization API key (format: gwsk_<64hex>). When provided, used as the Bearer token for all API calls except validateWithBackend. */
  apiKey?: string;

  // Phase 2 Features
  /** Enable heartbeat system (default: false) */
  enableHeartbeat?: boolean;
  /** Heartbeat interval in seconds (default: 30) */
  heartbeatIntervalSeconds?: number;
  /** Enable multi-tab synchronization (default: false) */
  enableTabSync?: boolean;
  /** Pause timer when tab is hidden (default: false) */
  pauseOnHidden?: boolean;
  /** Use backend validation instead of JWKS (default: false) */
  useBackendValidation?: boolean;

  // Lifecycle Hooks
  /** Optional hooks for synchronizing app auth state with marketplace sessions */
  hooks?: SessionLifecycleHooks;
  /** Hook execution timeout in milliseconds (default: 5000) */
  hookTimeoutMs?: number;

  /** Configuration for the default session-controls widget (GW-5294) */
  sessionControls?: SessionControlsConfig;
}

/**
 * Viewport-anchor position for the floating session-controls widget.
 * Six possible values combining vertical and horizontal edges.
 */
export type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Timer display format for the session-controls widget.
 */
export type TimerFormat = "countdown" | "elapsed" | "both";

/**
 * A link rendered by the session-controls widget.
 * Links are href-only; onClick handlers are not supported.
 */
export interface SessionControlLink {
  /** Visible label */
  label: string;
  /** Destination URL. External URLs open in a new tab with rel="noopener". */
  href: string;
  /** Promote this link out of the overflow menu to the widget's top level.
   *  A maximum of two links may be promoted; excess promotions fall back into overflow. */
  primary?: boolean;
  /** Optional icon. Accepts an emoji (e.g. "📄") or URL; rendered before the label. */
  icon?: string;
}

/**
 * Idle-fade configuration for the floating session-controls widget.
 * Correctness invariant: fade never applies while the session is at or below its
 * warning threshold, regardless of these settings.
 */
export interface FadeConfig {
  /** Enable fade-to-idle behavior. Default: true */
  enabled?: boolean;
  /** Opacity when idle, between 0 and 1. Default: 0.7 */
  idleOpacity?: number;
  /** Milliseconds of inactivity before fading to idle opacity. Default: 5000 */
  idleDelayMs?: number;
}

/**
 * Configuration for the default session-controls widget (GW-5294).
 * When omitted from SDKConfig, the SDK auto-mounts a floating widget at bottom-right.
 */
export interface SessionControlsConfig {
  /** Auto-mount the widget on sdk.initialize(). Default: true */
  autoMount?: boolean;
  /** Rendering mode. Default: 'floating' */
  mode?: "floating" | "inline";
  /** Required when mode is 'inline'. CSS selector or HTMLElement to mount into. */
  target?: string | HTMLElement;
  /** Viewport position (floating mode only). Default: 'bottom-right' */
  position?: Position;
  /** Pixel offset from the anchored viewport edge (floating mode only). Default: { x: 16, y: 16 } */
  offset?: { x?: number; y?: number };
  /** Idle-fade behavior. Default: { enabled: true, idleOpacity: 0.7, idleDelayMs: 5000 } */
  fade?: FadeConfig;
  /** Developer-supplied links. Rendered in an overflow menu; up to two with primary:true are promoted. */
  links?: SessionControlLink[];
  /** Timer display format. Default: 'countdown' */
  timerFormat?: TimerFormat;
  /** Render the Extend button. Default: true */
  showExtendButton?: boolean;
  /** Partial theme-token override merged on top of the resolved light/dark theme. */
  theme?: Partial<ThemeTokens>;
  /** Stacking context override. Default: 2147483000 */
  zIndex?: number;
}

/**
 * Subset of theme tokens that may be overridden via SessionControlsConfig.theme.
 * Matches the shape of the Theme interface in src/styles/theme.ts but with all
 * fields optional so partial overrides are type-safe.
 */
export interface ThemeTokens {
  colors?: Partial<{
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    success: string;
    successForeground: string;
    border: string;
    input: string;
    ring: string;
  }>;
  borderRadius?: string | number;
  shadow?: string;
}

/**
 * Session Data extracted from JWT
 */
export interface SessionData {
  /** Unique session UUID */
  sessionId: string;
  /** Application ID */
  applicationId: string;
  /** User ID */
  userId: string;
  /** Organization ID */
  orgId: string;
  /** Session start time (Unix timestamp seconds) */
  startTime: number;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Issued at timestamp (Unix seconds) */
  iat: number;
  /** Expiration timestamp (Unix seconds) */
  exp: number;
  /** Issuer */
  iss: string;
  /** Subject (user ID) */
  sub: string;
}

/**
 * Modal styling options (Legacy - prefer using theme)
 * @deprecated Use theme configuration from src/styles/theme.ts instead
 */
export interface ModalStyles {
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  borderRadius: string;
  fontFamily: string;
}

/**
 * Theme mode for modal styling
 */
export type ThemeMode = "light" | "dark" | "auto";

/**
 * SMART token balance information
 */
export interface TokenBalance {
  /** Current SMART token balance */
  balance: number;
  /** Currency unit label */
  unit: string;
}

/**
 * Session extension cost information
 */
export interface ExtensionCost {
  /** Token cost for the extension */
  cost: number;
  /** Number of minutes to be added */
  durationMinutes: number;
  /** Currency unit label */
  unit: string;
}

/**
 * SDK Event Handlers
 */
export interface SDKEvents {
  /** Called when session successfully initialized */
  onSessionStart: (data: SessionData) => void;
  /**
   * Called when initialize() completes without a session token (GW-8643).
   * The SDK is connected (it has phoned home) but no marketplace session is
   * active yet — e.g. the app was opened directly rather than launched from
   * the marketplace. initialize() resolves with null in this state.
   */
  onWaitingForSession: () => void;
  /** Called when warning threshold reached */
  onSessionWarning: (data: { remainingSeconds: number }) => void;
  /** Called when session expires or is ended */
  onSessionEnd: () => void;
  /** Called on any error */
  onError: (error: Error) => void;
  /** Called when the user's SMART token balance changes */
  onBalanceChange: (balance: TokenBalance) => void;
  /** Called when a session extension completes successfully */
  onSessionExtended: (data: {
    additionalMinutes: number;
    newExpiresAt: number;
  }) => void;
  /** Called when a purchase is initiated (including requestPurchase) */
  onPurchaseStart: (data: { itemId: string; quantity: number }) => void;
  /** Called when a purchase API call completes successfully */
  onPurchaseSuccess: (result: PurchaseResult) => void;
  /** Called when a purchase API call fails */
  onPurchaseError: (error: PurchaseError) => void;
  /** Called when a requestPurchase completes successfully (after modal confirm) */
  onPurchaseComplete: (itemId: string) => void;
  /** Called when a requestPurchase is cancelled (user dismisses modal) */
  onPurchaseCancelled: (itemId: string) => void;
  /** Called when balance changes (after any balance-changing operation) */
  onBalanceUpdate: (balance: number) => void;
}

/**
 * Session Lifecycle Hook Contexts
 */
export interface SessionStartContext {
  /** Unique session UUID */
  sessionId: string;
  /** User ID from JWT */
  userId: string;
  /** User email (if available in JWT) */
  email?: string;
  /** Organization ID */
  orgId: string;
  /** Application ID */
  applicationId: string;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Expiration timestamp (Unix seconds) */
  expiresAt: number;
  /** Full JWT token for app use */
  jwt: string;
}

export interface SessionEndContext {
  /** Unique session UUID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Reason for session end */
  reason: "expired" | "manual" | "error";
  /** Actual session duration in minutes (if available) */
  actualDurationMinutes?: number;
}

export interface SessionExtendContext {
  /** Unique session UUID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Additional minutes added to session */
  additionalMinutes: number;
  /** New expiration timestamp (Unix seconds) */
  newExpiresAt: number;
}

/**
 * Extension cost response from GET /sdk/sessions/{session_id}/extension-cost
 */
export interface ExtensionCostResult {
  /** Number of minutes the session will be extended by */
  extensionMinutes: number;
  /** Token cost for the extension */
  tokenCost: number;
  /** ISO 8601 timestamp of the new expiry if extended */
  newExpiresAt: string;
  /** Minimum allowed extension minutes (default: 15) */
  minExtensionMinutes: number;
  /** Maximum allowed extension minutes (default: 480) */
  maxExtensionMinutes: number;
}

/**
 * Options for extendSession()
 */
export interface ExtendSessionOptions {
  /**
   * If true, skip PurchaseModal and call the extend API directly.
   * Default: false (shows PurchaseModal or falls back to onExtend)
   */
  skipConfirmation?: boolean;
  /**
   * Desired extension duration in minutes.
   * Must be between minExtensionMinutes and maxExtensionMinutes from getExtensionCost().
   * If omitted, uses the default extension duration from the application.
   */
  extensionMinutes?: number;
}

export interface SessionWarningContext {
  /** Unique session UUID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Remaining seconds until expiration */
  remainingSeconds: number;
}

/**
 * Session Lifecycle Hooks
 * Optional callbacks that allow applications to synchronize their auth state with marketplace sessions
 */
export interface SessionLifecycleHooks {
  /**
   * Called after JWT validation succeeds but before session timer starts
   * Use to: Auto-login user to your app's auth system
   * Note: Hook failure will prevent session from starting
   */
  onSessionStart?: (context: SessionStartContext) => Promise<void> | void;

  /**
   * Called when session expires or is manually ended, before redirect
   * Use to: Force logout user from your app's auth system
   * Note: Hook failure will be logged but won't prevent session end
   */
  onSessionEnd?: (context: SessionEndContext) => Promise<void> | void;

  /**
   * Called when session extension succeeds
   * Use to: Refresh app auth tokens if needed
   */
  onSessionExtend?: (context: SessionExtendContext) => Promise<void> | void;

  /**
   * Called before session warning modal is shown
   * Use to: Prepare user for session expiration
   */
  onSessionWarning?: (context: SessionWarningContext) => Promise<void> | void;
}

/**
 * Custom SDK Error
 */
export class SDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "SDKError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }
}

/**
 * JWT Header
 */
export interface JWTHeader {
  alg: string;
  typ: string;
  kid: string;
}

/**
 * JWT Claims (raw payload from token)
 */
export interface JWTClaims {
  sessionId: string;
  applicationId: string;
  userId: string;
  orgId: string;
  startTime: number;
  durationMinutes: number;
  iat: number;
  exp: number;
  iss: string;
  sub: string;
}

/**
 * JWKS Key
 */
export interface JWKSKey {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

/**
 * JWKS Response
 */
export interface JWKSResponse {
  keys: JWKSKey[];
}

/**
 * Configuration options for the SessionHeader items panel
 */
export interface ItemsPanelOptions {
  /** Position of the panel relative to the button */
  position?: "left" | "right";
  /** Maximum number of items to display */
  maxItems?: number;
  /** Custom styling for the panel */
  customStyles?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
  };
}
