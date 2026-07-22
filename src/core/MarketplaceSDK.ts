import { JWTParser } from "./JWTParser";
import { JWKSValidator } from "./JWKSValidator";
import { TimerManager } from "./TimerManager";
import { HeartbeatManager } from "./HeartbeatManager";
import { TabSyncManager, TabSyncMessage } from "./TabSyncManager";
import { WarningModal } from "../ui/WarningModal";
import { PurchaseModal } from "../ui/PurchaseModal";
import {
  SessionHeader,
  type SessionHeaderMountOptions,
} from "../ui/SessionHeader";
import { extractTokenFromURL } from "../utils/url";
import { isLikelyJwt } from "../utils/token";
import { normalizeExpiryToSeconds } from "../utils/time";
import { Logger } from "../utils/logger";
import {
  SDKConfig,
  SDKEvents,
  SessionData,
  SDKError,
  JWTClaims,
  SessionStartContext,
  SessionEndContext,
  SessionExtendContext,
  SessionWarningContext,
  TokenBalance,
  ExtensionCostResult,
  ExtendSessionOptions,
  ApplicationItem,
  PurchaseRequest,
  PurchaseResult,
  PurchaseError,
  ValidationResult,
  SessionPurchase,
  SessionControlsConfig,
} from "../types";
import { ENVIRONMENT_CONFIGS, Environment } from "../types/environment";

/**
 * Internal resolved SDK configuration with all required fields
 * Environment is optional since it's only used during initialization
 */
type ResolvedSDKConfig = Omit<Required<SDKConfig>, "environment"> & {
  environment?: Environment;
};

/**
 * Marketplace SDK with Phase 2 Features
 * - Heartbeat system
 * - Multi-tab synchronization
 * - Visibility API integration
 * - Session extension/completion
 * - Backend validation
 */
export class MarketplaceSDK {
  /** sessionStorage key used to persist the session JWT across navigations */
  private static readonly JWT_STORAGE_KEY = "gw_marketplace_jwt";

  /** Singleton instance used by React hooks */
  private static _instance: MarketplaceSDK | null = null;

  /**
   * Return the current singleton SDK instance.
   * Throws if no instance has been created yet — callers must call
   * `new MarketplaceSDK(config)` before using hooks.
   */
  static getInstance(): MarketplaceSDK {
    if (!MarketplaceSDK._instance) {
      throw new SDKError(
        "MarketplaceSDK has not been initialized. Call new MarketplaceSDK(config) first.",
        "NOT_INITIALIZED",
      );
    }
    return MarketplaceSDK._instance;
  }

  private config: ResolvedSDKConfig;
  private validator: JWKSValidator;
  private timer: TimerManager | null = null;
  private heartbeat: HeartbeatManager | null = null;
  private tabSync: TabSyncManager | null = null;
  private modal: WarningModal | null = null;
  private purchaseModal: PurchaseModal | null = null;
  private logger: Logger;
  private events: Partial<SDKEvents> = {};
  private sessionData: SessionData | null = null;
  private jwtToken: string | null = null;
  private apiKey: string | null = null;
  private endReason: "expired" | "manual" | "error" = "manual";
  /** Auto-mounted session-controls widget (GW-5294). Null when not mounted. */
  private sessionHeaderInstance: SessionHeader | null = null;

  constructor(config: SDKConfig) {
    // Get environment-specific defaults if environment is specified
    const envConfig = config.environment
      ? ENVIRONMENT_CONFIGS[config.environment]
      : null;

    // Production defaults (used when no environment specified)
    const defaultJwksUri =
      "https://api.generalwisdom.com/.well-known/jwks.json";
    const defaultApiEndpoint = "http://localhost:3000";
    const defaultMarketplaceUrl = "https://d3p2yqofgy75sz.cloudfront.net/";

    this.config = {
      // Environment config takes precedence over defaults, explicit config takes precedence over environment
      environment: config.environment,
      jwksUri: config.jwksUri || envConfig?.jwksUri || defaultJwksUri,
      apiEndpoint:
        config.apiEndpoint || envConfig?.apiEndpoint || defaultApiEndpoint,
      debug: config.debug ?? false,
      autoStart: config.autoStart ?? true,
      warningThresholdSeconds: config.warningThresholdSeconds ?? 300,
      customStyles: config.customStyles ?? {},
      themeMode: config.themeMode ?? "light",
      applicationId: config.applicationId ?? "",
      marketplaceUrl:
        config.marketplaceUrl ||
        envConfig?.marketplaceUrl ||
        defaultMarketplaceUrl,
      // Phase 2 options
      enableHeartbeat: config.enableHeartbeat ?? false,
      heartbeatIntervalSeconds: config.heartbeatIntervalSeconds ?? 30,
      enableTabSync: config.enableTabSync ?? false,
      pauseOnHidden: config.pauseOnHidden ?? false,
      useBackendValidation: config.useBackendValidation ?? false,
      // Lifecycle hooks
      hooks: config.hooks ?? {},
      hookTimeoutMs: config.hookTimeoutMs ?? 5000,
      apiKey: config.apiKey ?? "",
      // Session controls widget (GW-5294) — stored verbatim; defaults resolved at mount time
      sessionControls: config.sessionControls ?? {},
    };

    this.apiKey = config.apiKey ?? null;

    this.validator = new JWKSValidator(this.config.jwksUri, this.config.debug);
    this.logger = new Logger(this.config.debug, "[MarketplaceSDK]");

    this.logger.info("SDK initialized with config:", {
      environment: config.environment || "default (production)",
      jwksUri: this.config.jwksUri,
      apiEndpoint: this.config.apiEndpoint,
      marketplaceUrl: this.config.marketplaceUrl,
      enableHeartbeat: this.config.enableHeartbeat,
      enableTabSync: this.config.enableTabSync,
      pauseOnHidden: this.config.pauseOnHidden,
    });

    // Register as the singleton instance so React hooks can find it.
    MarketplaceSDK._instance = this;
  }

  /**
   * Register event handlers
   */
  on<K extends keyof SDKEvents>(event: K, handler: SDKEvents[K]): void {
    const prev = this.events[event];
    if (prev) {
      // Chain: invoke existing handler(s) then the new one
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.events[event] = ((...args: any[]) => {
        (prev as (...a: unknown[]) => void)(...args);
        (handler as (...a: unknown[]) => void)(...args);
      }) as SDKEvents[K];
    } else {
      this.events[event] = handler;
    }
    this.logger.log("Event handler registered:", event);
  }

  /**
   * Execute a lifecycle hook with timeout
   */
  private async executeHook<T>(
    hookName: string,
    hook: ((context: T) => Promise<void> | void) | undefined,
    context: T,
    isStrict: boolean = true,
  ): Promise<void> {
    if (!hook) return;

    this.logger.log(`Calling ${hookName} hook`);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new SDKError(
              `${hookName} hook timeout after ${this.config.hookTimeoutMs}ms`,
              "HOOK_TIMEOUT",
            ),
          ),
        this.config.hookTimeoutMs,
      ),
    );

    try {
      await Promise.race([Promise.resolve(hook(context)), timeout]);
      this.logger.log(`${hookName} hook completed successfully`);
    } catch (error) {
      this.logger.error(`${hookName} hook failed:`, error);

      if (isStrict) {
        // Strict mode: throw error to prevent session operation
        throw new SDKError(
          `${hookName} hook failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "HOOK_ERROR",
        );
      } else {
        // Lenient mode: log but don't throw
        this.logger.warn(
          `${hookName} hook failed but continuing (lenient mode)`,
        );
      }
    }
  }

  /**
   * Calculate actual session duration in minutes
   */
  private calculateActualDuration(): number | undefined {
    if (!this.sessionData) return undefined;
    const now = Math.floor(Date.now() / 1000);
    const durationSeconds = now - this.sessionData.startTime;
    return Math.ceil(durationSeconds / 60);
  }

  /**
   * Retrieve the session JWT from the URL or sessionStorage, guarding
   * against corrupted storage values (GW-8643).
   *
   * A prior page load may have persisted the literal string "undefined"
   * (or "null", or an empty/non-JWT string) under the storage key. Such
   * values are treated as absent and evicted so they can never reach
   * JWKS verification and fail with a cryptic "Invalid Compact JWS".
   */
  private resolveSessionToken(): string | null {
    // First try URL parameter
    const urlToken = extractTokenFromURL("gwSession");
    if (isLikelyJwt(urlToken)) {
      this.logger.log("JWT token extracted from URL");
      return urlToken;
    }
    if (urlToken) {
      this.logger.warn(
        "Ignoring malformed gwSession URL parameter (not a JWT):",
        urlToken,
      );
    }

    // If not in URL, try storage (for persistence through OAuth redirects)
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    const stored = sessionStorage.getItem(MarketplaceSDK.JWT_STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    if (!isLikelyJwt(stored)) {
      // Corrupted value (e.g. the literal string "undefined") — evict it.
      sessionStorage.removeItem(MarketplaceSDK.JWT_STORAGE_KEY);
      this.logger.warn(
        "Removed invalid JWT value from sessionStorage (was:",
        JSON.stringify(stored),
        ")",
      );
      return null;
    }
    this.logger.log("JWT token retrieved from storage");
    return stored;
  }

  /**
   * Persist the session JWT for navigation/OAuth-redirect persistence.
   * Never writes nullish or non-JWT values (GW-8643).
   */
  private persistSessionToken(token: string): void {
    if (typeof sessionStorage === "undefined") return;
    if (!isLikelyJwt(token)) {
      this.logger.warn("Refusing to store invalid JWT value in sessionStorage");
      return;
    }
    sessionStorage.setItem(MarketplaceSDK.JWT_STORAGE_KEY, token);
    this.logger.log("JWT token stored in sessionStorage");
  }

  /**
   * Initialize SDK and validate session.
   *
   * Returns the validated {@link SessionData} when a session JWT is present.
   *
   * When no session token exists (no `?gwSession=` URL parameter and nothing
   * valid in sessionStorage) the SDK enters a "waiting for session" state
   * instead of throwing: it phones home so the platform setup page can show
   * "Connected", fires the optional `onWaitingForSession` event, and
   * resolves with `null`. It does NOT surface a JWT-verification error
   * (GW-8643).
   */
  async initialize(): Promise<SessionData | null> {
    this.logger.info("Initializing session...");

    try {
      // Extract JWT from URL or retrieve from storage (guarded — corrupted
      // storage values like the literal string "undefined" are treated as
      // absent and evicted).
      this.jwtToken = this.resolveSessionToken();

      // No token? Enter the waiting-for-session state instead of failing.
      if (!this.jwtToken) {
        this.logger.info(
          "No gwSession token found in URL or storage — waiting for a session. " +
            "The SDK is connected but no marketplace session is active yet " +
            "(code: MISSING_TOKEN).",
        );

        // Phone home even without a session so the platform setup page can
        // show "Connected" before the first session is ever launched.
        this.phoneHome(this.config.applicationId).catch((err: unknown) =>
          this.logger.warn("Phone-home ping failed (non-fatal):", err),
        );

        this.events.onWaitingForSession?.();
        return null;
      }

      // Store JWT for persistence through navigation
      this.persistSessionToken(this.jwtToken);

      // Validate JWT
      let verifiedClaims: JWTClaims & { email?: string };
      if (this.config.useBackendValidation) {
        // Phase 2: Backend validation
        this.logger.log("Using backend validation");
        verifiedClaims = await this.validateWithBackend(this.jwtToken);
      } else {
        // Phase 1: JWKS validation
        this.logger.log("Using JWKS validation");
        verifiedClaims = await this.validator.verify(
          this.jwtToken,
          "generalwisdom.com",
          this.config.applicationId || undefined,
        );
      }

      this.logger.log("JWT verified successfully");

      // Map to SessionData
      const sessionData: SessionData = {
        sessionId: verifiedClaims.sessionId,
        applicationId: verifiedClaims.applicationId,
        userId: verifiedClaims.userId,
        orgId: verifiedClaims.orgId,
        startTime: verifiedClaims.startTime,
        durationMinutes: verifiedClaims.durationMinutes,
        iat: verifiedClaims.iat,
        exp: verifiedClaims.exp,
        iss: verifiedClaims.iss,
        sub: verifiedClaims.sub,
      };
      this.sessionData = sessionData;

      // Calculate remaining time
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = Math.max(0, sessionData.exp - now);

      if (remainingSeconds <= 0) {
        throw new SDKError("Session has already expired", "SESSION_EXPIRED");
      }

      this.logger.log("Remaining time:", remainingSeconds, "seconds");

      // Call onSessionStart hook if provided (STRICT - failure prevents session start)
      if (this.config.hooks?.onSessionStart) {
        const startContext: SessionStartContext = {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          email: verifiedClaims.email,
          orgId: sessionData.orgId,
          applicationId: sessionData.applicationId,
          durationMinutes: sessionData.durationMinutes,
          expiresAt: sessionData.exp,
          jwt: this.jwtToken!,
        };

        await this.executeHook(
          "onSessionStart",
          this.config.hooks.onSessionStart,
          startContext,
          true,
        );
        this.logger.log(
          "Application auth synchronized with marketplace session",
        );
      }

      // Initialize timer
      this.timer = new TimerManager(
        remainingSeconds,
        this.config.warningThresholdSeconds,
        {
          onSessionWarning: (data) => {
            // Call warning hook if provided (lenient)
            if (this.config.hooks?.onSessionWarning) {
              const warningContext: SessionWarningContext = {
                sessionId: this.sessionData!.sessionId,
                userId: this.sessionData!.userId,
                remainingSeconds: data.remainingSeconds,
              };
              this.executeHook(
                "onSessionWarning",
                this.config.hooks.onSessionWarning,
                warningContext,
                false,
              ).catch((error) =>
                this.logger.error("onSessionWarning hook failed:", error),
              );
            }

            this.showWarningModal(data.remainingSeconds);
            this.events.onSessionWarning?.(data);
          },
          onSessionEnd: () => {
            this.endReason = "expired"; // Track that this was an expiration
            this.endSession();
          },
        },
        this.config.debug,
      );

      // Phase 2: Initialize heartbeat if enabled
      if (this.config.enableHeartbeat && this.jwtToken) {
        this.heartbeat = new HeartbeatManager(
          sessionData.sessionId,
          this.config.apiEndpoint,
          this.jwtToken,
          this.apiKey && this.config.applicationId
            ? this.config.applicationId
            : null,
          (remainingSeconds) => {
            // Sync timer with server
            this.timer?.updateRemainingTime(remainingSeconds);
          },
          (error) => {
            this.logger.error("Heartbeat error:", error);
            this.events.onError?.(error);
          },
          this.config.heartbeatIntervalSeconds,
          this.config.debug,
        );
      }

      // Phase 2: Initialize tab sync if enabled
      if (this.config.enableTabSync) {
        this.tabSync = new TabSyncManager(
          sessionData.sessionId,
          (message) => this.handleTabSyncMessage(message),
          this.config.debug,
        );
      }

      // Phase 2: Set up Visibility API if enabled
      if (this.config.pauseOnHidden) {
        this.initializeVisibilityHandling();
      }

      // Start timer if autoStart enabled
      if (this.config.autoStart) {
        this.timer.start();
        this.logger.log("Timer started automatically");

        // Start heartbeat only if this is the master tab
        if (this.config.enableHeartbeat && this.heartbeat) {
          const isMaster = !this.tabSync || this.tabSync.isMasterTab();
          if (isMaster) {
            this.heartbeat.start();
            this.logger.log("Heartbeat started (master tab)");
          } else {
            this.logger.log("Heartbeat not started (slave tab)");
          }
        }
      }

      // Trigger session start event
      this.events.onSessionStart?.(sessionData);

      // Auto-mount the default session-controls widget (GW-5294) unless the
      // caller explicitly opts out via sessionControls.autoMount: false.
      this.maybeAutoMountSessionHeader();

      // Fire-and-forget: notify the platform that the SDK has initialized.
      // This is what makes the setup page show "Connected" — it writes a
      // telemetry record that GET /sdk/connections/:appId reads back.
      this.phoneHome(sessionData.applicationId).catch((err: unknown) =>
        this.logger.warn("Phone-home ping failed (non-fatal):", err),
      );

      this.logger.info("Session initialized successfully");
      return sessionData;
    } catch (error) {
      this.logger.error("Initialization failed:", error);
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError(
              error instanceof Error ? error.message : "Unknown error",
              "INITIALIZATION_ERROR",
            );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * Phase 2: Validate JWT with backend
   */
  private async validateWithBackend(
    token: string,
  ): Promise<JWTClaims & { email?: string }> {
    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/validate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jwt: token }),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Backend validation failed",
        "BACKEND_VALIDATION_FAILED",
        response.status,
      );
    }

    const data = await response.json();
    if (!data.valid) {
      throw new SDKError(
        data.error || "Session validation failed",
        "SESSION_INVALID",
      );
    }

    // Return decoded claims from backend
    const decoded = JWTParser.decode(token);
    return decoded;
  }

  /**
   * Phase 2: Handle tab sync messages
   */
  private handleTabSyncMessage(message: TabSyncMessage): void {
    this.logger.log("Tab sync message:", message.type);

    switch (message.type) {
      case "pause":
        this.timer?.pause();
        break;
      case "resume":
        this.timer?.resume();
        break;
      case "end":
        this.endSession();
        break;
      case "timer_update":
        if (message.remainingSeconds !== undefined) {
          this.timer?.updateRemainingTime(message.remainingSeconds);
        }
        break;
    }
  }

  /**
   * Phase 2: Initialize Visibility API handling
   */
  private initializeVisibilityHandling(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.logger.log("Tab hidden, pausing timer");
        this.pauseTimer();
      } else {
        this.logger.log("Tab visible, resuming timer");
        this.resumeTimer();
      }
    });
    this.logger.log("Visibility API handler initialized");
  }

  /**
   * Start session timer manually
   */
  startTimer(): void {
    if (!this.timer) {
      throw new SDKError(
        "SDK not initialized. Call initialize() first.",
        "NOT_INITIALIZED",
      );
    }
    this.timer.start();
    this.tabSync?.broadcast("resume");
    this.logger.info("Timer started manually");
  }

  /**
   * Pause session timer
   */
  pauseTimer(): void {
    this.timer?.pause();
    this.tabSync?.broadcast("pause");
    this.logger.info("Timer paused");
  }

  /**
   * Resume session timer
   */
  resumeTimer(): void {
    this.timer?.resume();
    this.tabSync?.broadcast("resume");
    this.logger.info("Timer resumed");
  }

  /**
   * Get the cost and preview for extending the current session.
   * Calls GET /sdk/sessions/{session_id}/extension-cost
   *
   * @param extensionMinutes - Optional desired extension duration to preview cost for
   */
  async getExtensionCost(
    extensionMinutes?: number,
  ): Promise<ExtensionCostResult> {
    if (!this.sessionData || !this.jwtToken) {
      throw new SDKError("No active session", "NO_SESSION");
    }

    this.logger.info(
      "Fetching extension cost for session",
      this.sessionData.sessionId,
      extensionMinutes ? `(${extensionMinutes} minutes)` : "",
    );

    try {
      let url = `${this.config.apiEndpoint}/sdk/sessions/${this.sessionData.sessionId}/extension-cost`;
      if (extensionMinutes !== undefined) {
        url += `?extensionMinutes=${extensionMinutes}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new SDKError(
          "Failed to fetch extension cost",
          "EXTENSION_COST_FAILED",
          response.status,
        );
      }

      const data = await response.json();
      this.logger.info("Extension cost fetched:", data);

      return {
        extensionMinutes: data.extensionMinutes,
        tokenCost: data.tokenCost,
        newExpiresAt: data.newExpiresAt,
        minExtensionMinutes: data.minExtensionMinutes ?? 15,
        maxExtensionMinutes: data.maxExtensionMinutes ?? 480,
      };
    } catch (error) {
      this.logger.error("Failed to fetch extension cost:", error);
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError(
              error instanceof Error
                ? error.message
                : "Failed to fetch extension cost",
              "EXTENSION_COST_ERROR",
            );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * Extend the current session.
   *
   * Without skipConfirmation (default): shows PurchaseModal if available,
   * otherwise falls back to the onExtend callback.
   *
   * With skipConfirmation: calls POST /sdk/sessions/{session_id}/extend directly
   * and emits onPurchaseStart / onPurchaseSuccess or onPurchaseError events.
   */
  async extendSession(options?: ExtendSessionOptions): Promise<void> {
    if (!this.sessionData || !this.jwtToken) {
      throw new SDKError("No active session", "NO_SESSION");
    }

    const skipConfirmation = options?.skipConfirmation ?? false;

    if (!skipConfirmation) {
      // Show the warning modal which includes the extend flow, or fall back to
      // showing the modal with the onExtend callback if modal is unavailable.
      this.logger.info("extendSession: showing PurchaseModal for confirmation");
      this.showWarningModal(this.timer?.getRemainingSeconds() ?? 0);
      return;
    }

    // skipConfirmation=true: call the extend API directly
    this.logger.info(
      "extendSession: skipping confirmation, calling extend API directly",
    );

    this.events.onPurchaseStart?.({ itemId: "session-extension", quantity: 1 });

    try {
      const idempotencyKey = this.generateIdempotencyKey();

      // Use provided extensionMinutes or fetch the default from extension-cost API
      const requestedMinutes = options?.extensionMinutes;
      const costResult = await this.getExtensionCost(requestedMinutes);
      const extensionMinutes = requestedMinutes ?? costResult.extensionMinutes;

      // The server returns 409 when the same idempotency key is in-flight
      // (gw-go-common ErrExtensionIdempotencyConflict). Retry with
      // exponential backoff so the caller doesn't see a transient conflict
      // while the original request is still completing.
      const extendOnce = async (): Promise<Response> => {
        return fetch(
          `${this.config.apiEndpoint}/sdk/sessions/${this.sessionData!.sessionId}/extend`,
          {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify({
              extensionMinutes,
              idempotencyKey,
            }),
          },
        );
      };

      const backoffMs = [500, 1000, 2000];
      let response = await extendOnce();
      for (let i = 0; i < backoffMs.length && response.status === 409; i++) {
        this.logger.warn(
          `extendSession: 409 idempotency conflict, retrying after ${backoffMs[i]}ms (attempt ${i + 1}/${backoffMs.length})`,
        );
        await new Promise((r) => setTimeout(r, backoffMs[i]));
        response = await extendOnce();
      }

      if (!response.ok) {
        throw new SDKError(
          "Session extension failed",
          "EXTENSION_FAILED",
          response.status,
        );
      }

      const data = await response.json();

      // Update session expiry from the response.
      // POST /extend returns newExpiresAt as a Unix-SECONDS number (see the
      // Pact contract in pact/consumers/sessions.pact.spec.ts and the
      // onSessionExtended / SessionExtendContext types). The extension-cost
      // fallback (costResult.newExpiresAt) is an ISO 8601 string. Passing a
      // seconds number to `new Date(...)` misreads it as milliseconds (→ a
      // ~1970 date → a large negative remaining time), so normalise based on
      // the value's runtime type instead. (GW-8308)
      const newExpiresAtSeconds = normalizeExpiryToSeconds(
        data.newExpiresAt ?? costResult.newExpiresAt,
      );
      this.sessionData.exp = newExpiresAtSeconds;

      // Sync timer (clamp at 0, mirroring the initial-session path at :296)
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = Math.max(0, newExpiresAtSeconds - now);
      this.timer?.updateRemainingTime(remainingSeconds);

      // Broadcast to other tabs
      this.tabSync?.broadcast("timer_update", { remainingSeconds });

      // Call onSessionExtend lifecycle hook if provided (lenient)
      if (this.config.hooks?.onSessionExtend) {
        const extendContext: SessionExtendContext = {
          sessionId: this.sessionData.sessionId,
          userId: this.sessionData.userId,
          additionalMinutes: costResult.extensionMinutes,
          newExpiresAt: newExpiresAtSeconds,
        };
        await this.executeHook(
          "onSessionExtend",
          this.config.hooks.onSessionExtend,
          extendContext,
          false,
        );
      }

      // Fire onSessionExtended event
      this.events.onSessionExtended?.({
        additionalMinutes: costResult.extensionMinutes,
        newExpiresAt: newExpiresAtSeconds,
      });

      // Create a synthetic PurchaseResult for session extension
      const extensionResult: PurchaseResult = {
        purchaseId: `extension-${Date.now()}`,
        itemId: "session-extension",
        itemName: "Session Extension",
        quantity: 1,
        totalTokenCost: costResult.tokenCost,
        remainingBalance: 0, // Will be updated by balance fetch below
        purchasedAt: new Date().toISOString(),
        status: "completed",
      };
      this.events.onPurchaseSuccess?.(extensionResult);

      // Refresh and broadcast balance change after extension
      try {
        const balance = await this.getTokenBalance();
        this.events.onBalanceChange?.(balance);
      } catch (balanceError) {
        this.logger.warn(
          "Failed to refresh balance after extension:",
          balanceError,
        );
      }

      this.logger.info("Session extended successfully");
    } catch (error) {
      this.logger.error("Failed to extend session:", error);
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError(
              error instanceof Error ? error.message : "Extension failed",
              "EXTENSION_ERROR",
            );

      // Create PurchaseError for the event
      const purchaseError: PurchaseError = {
        message: sdkError.message,
        code: "validation_failed",
        itemId: "session-extension",
      };
      this.events.onPurchaseError?.(purchaseError);
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * Generate a UUID v4 idempotency key using the Web Crypto API (or Node crypto).
   */
  private generateIdempotencyKey(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    // Fallback: RFC 4122 v4 UUID using Math.random()
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Phase 2: Complete session
   */
  async completeSession(_actualUsageMinutes?: number): Promise<void> {
    if (!this.sessionData || !this.jwtToken) {
      throw new SDKError("No active session", "NO_SESSION");
    }

    this.logger.info("Completing session...");

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/sdk/sessions/${this.sessionData.sessionId}`,
        {
          method: "DELETE",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        throw new SDKError(
          "Session completion failed",
          "COMPLETION_FAILED",
          response.status,
        );
      }

      const data = await response.json();
      this.logger.info("Session completed:", data);

      // End the session
      this.endSession();
    } catch (error) {
      this.logger.error("Failed to complete session:", error);
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError(
              error instanceof Error ? error.message : "Completion failed",
              "COMPLETION_ERROR",
            );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * End session
   */
  async endSession(): Promise<void> {
    this.logger.info("Ending session...");

    // Build session end context
    const endContext: SessionEndContext = {
      sessionId: this.sessionData?.sessionId || "",
      userId: this.sessionData?.userId || "",
      reason: this.endReason,
      actualDurationMinutes: this.calculateActualDuration(),
    };

    // Call onSessionEnd hook if provided (LENIENT - errors logged but don't block)
    if (this.config.hooks?.onSessionEnd) {
      try {
        await this.executeHook(
          "onSessionEnd",
          this.config.hooks.onSessionEnd,
          endContext,
          false,
        );
        this.logger.log("Application auth cleanup completed");
      } catch (error) {
        // This shouldn't throw due to lenient mode, but catch anyway
        this.logger.error(
          "onSessionEnd hook error (continuing anyway):",
          error,
        );
      }
    }

    // Stop timer
    this.timer?.stop();

    // Stop heartbeat
    this.heartbeat?.stop();

    // Unmount the auto-mounted session-controls widget (GW-5294).
    this.unmountSessionHeader();

    // Broadcast to other tabs
    this.tabSync?.broadcast("end");

    // Clear JWT from storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(MarketplaceSDK.JWT_STORAGE_KEY);
      this.logger.log("JWT token cleared from storage");
    }

    // Trigger end event
    this.events.onSessionEnd?.();

    this.logger.info("Session ended");

    // Show "Session Ending" modal, then close-or-redirect after 3 seconds.
    //
    // GW-6324: prefer window.close() since marketplace tabs are typically
    // script-opened (target="_blank" from the marketplace SPA), and browsers
    // allow scripts to close the window they were opened by. window.close()
    // is silently no-op'd when the browser refuses (e.g. for tabs the user
    // navigated to directly), so we fall back to redirecting after a short
    // delay. Net behavior:
    //   - Tab opened from marketplace SPA → tab closes.
    //   - Tab opened directly via URL paste → redirects to marketplaceUrl.
    if (typeof window !== "undefined") {
      // Create modal if it doesn't exist
      if (!this.modal) {
        this.modal = new WarningModal(
          this.config.themeMode || "light",
          this.config.customStyles,
        );
      }

      // Show ending message; on dismiss, try close-then-redirect.
      this.modal.showEndingMessage(() => {
        try {
          window.close();
        } catch {
          // Some browsers throw rather than silently no-op; either way,
          // fall through to the redirect.
        }
        // If close() succeeded, the script never reaches this; if it didn't,
        // redirect after a tiny delay so any pending close completes first.
        setTimeout(() => {
          window.location.href = this.config.marketplaceUrl;
        }, 200);
      }, 3000); // 3 second delay
    }
  }

  /**
   * Show warning modal
   */
  private showWarningModal(remainingSeconds: number): void {
    if (!this.modal) {
      this.modal = new WarningModal(
        this.config.themeMode || "light",
        this.config.customStyles,
      );
    }

    this.modal.show({
      remainingSeconds,
      onExtend: async () => {
        // User confirmed via modal — extend directly (skipConfirmation=true avoids re-showing modal)
        try {
          await this.extendSession({ skipConfirmation: true });
          this.modal?.hide();
          this.logger.log("Session extended successfully from modal");
        } catch (error) {
          // GW-6674: Extension failed. Previously this redirected the whole app
          // tab to the marketplace (window.location.href), destroying the user's
          // in-progress work on ANY extend failure — including transient errors
          // for sessions that were still perfectly usable. Instead, keep the app
          // tab intact and surface an inline, retryable error inside the warning
          // modal. The session keeps running until it actually expires (onEnd).
          this.logger.error("Extension failed:", error);
          const message =
            error instanceof SDKError && error.statusCode === 402
              ? "Not enough tokens to extend. Purchase more from the marketplace, then try again."
              : "Could not extend the session. Please try again.";
          if (this.modal?.isShown()) {
            this.modal.showError(message);
          }
        }
      },
      onEnd: () => {
        // endSession() handles cleanup and redirect
        this.endSession();
      },
    });
  }

  /**
   * Get current session data
   */
  getSessionData(): SessionData | null {
    return this.sessionData;
  }

  /**
   * Get remaining time
   */
  getRemainingTime(): number {
    return this.timer?.getRemainingSeconds() ?? 0;
  }

  /**
   * Get formatted time (MM:SS)
   */
  getFormattedTime(): string {
    return this.timer?.getFormattedTime() ?? "0:00";
  }

  /**
   * Get formatted time with hours (HH:MM:SS)
   */
  getFormattedTimeWithHours(): string {
    return this.timer?.getFormattedTimeWithHours() ?? "0:00:00";
  }

  /**
   * Check if timer is running
   */
  isTimerRunning(): boolean {
    return this.timer?.isRunning() ?? false;
  }

  // =========================================================================
  // Session-controls widget lifecycle (GW-5294)
  // =========================================================================

  /**
   * Auto-mount the default session-controls widget when the developer has
   * not opted out. Called from `initialize()` after a successful session
   * start. Inline mode is mounted as well if explicitly requested.
   */
  private maybeAutoMountSessionHeader(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return; // SSR / non-browser
    }

    const cfg: SessionControlsConfig = this.config.sessionControls ?? {};
    if (cfg.autoMount === false) {
      return;
    }

    // Resolve the mount options by combining resolved defaults with the
    // developer config. Floating is the default mode.
    const mode = cfg.mode ?? "floating";

    // Inline mode requires a target — skip auto-mount if missing.
    if (mode === "inline" && !cfg.target) {
      this.logger.warn(
        "sessionControls.mode is 'inline' but no target provided — skipping auto-mount",
      );
      return;
    }

    this.mountSessionHeader({
      mode,
      target: cfg.target,
      getTime: () => this.getFormattedTime(),
      sdk: this,
      onEnd: () => {
        this.endSession();
      },
      position: cfg.position,
      offset: cfg.offset,
      fade: cfg.fade,
      links: cfg.links,
      timerFormat: cfg.timerFormat,
      showExtendButton: cfg.showExtendButton,
      theme: cfg.theme,
      zIndex: cfg.zIndex,
      warningThresholdSeconds: this.config.warningThresholdSeconds,
    });
  }

  /**
   * Manually mount the session-controls widget. Useful when `autoMount` is
   * false and the developer wants to control mount timing.
   */
  mountSessionHeader(opts: SessionHeaderMountOptions): void {
    if (this.sessionHeaderInstance) {
      this.sessionHeaderInstance.unmount();
    } else {
      this.sessionHeaderInstance = new SessionHeader(
        this.config.themeMode ?? "auto",
      );
    }
    this.sessionHeaderInstance.mount(opts);
  }

  /** Unmount and drop the auto-mounted session-controls widget, if any. */
  unmountSessionHeader(): void {
    if (!this.sessionHeaderInstance) return;
    this.sessionHeaderInstance.destroy();
    this.sessionHeaderInstance = null;
  }

  /**
   * Replace the mounted widget with new config. Unmounts the current
   * instance and remounts using the same runtime hooks (getTime, sdk,
   * onEnd). Intended for runtime updates to position, fade, links, etc.
   *
   * Remount is driven by whether the widget is currently mounted, not by
   * the resolved `autoMount` flag. `autoMount: false` means "don't mount
   * me during initialize()" — it doesn't mean "refuse to remount after
   * an explicit mountSessionHeader() call". Publishers who set
   * `autoMount: false` and drive the widget themselves must still be
   * able to update its config without it vanishing.
   *
   * The exception: if the caller passes `autoMount: false` in the
   * `partial` argument, treat that as an explicit unmount request.
   */
  updateSessionControls(partial: Partial<SessionControlsConfig>): void {
    const current: SessionControlsConfig = this.config.sessionControls ?? {};
    const next: SessionControlsConfig = { ...current, ...partial };
    this.config.sessionControls = next;

    const wasMounted = !!this.sessionHeaderInstance;
    if (!wasMounted) {
      // Not mounted — just store the new config; next mount() uses it.
      return;
    }

    this.unmountSessionHeader();

    // Explicit opt-out via this call: leave unmounted.
    if (partial.autoMount === false) return;

    // Widget was mounted before the update — remount with the new config,
    // regardless of the resolved autoMount flag.
    this.mountSessionHeader({
      mode: next.mode ?? "floating",
      target: next.target,
      getTime: () => this.getFormattedTime(),
      sdk: this,
      onEnd: () => {
        this.endSession();
      },
      position: next.position,
      offset: next.offset,
      fade: next.fade,
      links: next.links,
      timerFormat: next.timerFormat,
      showExtendButton: next.showExtendButton,
      theme: next.theme,
      zIndex: next.zIndex,
      warningThresholdSeconds: this.config.warningThresholdSeconds,
    });
  }

  /**
   * Returns the Authorization header value for authenticated API calls.
   * Uses the API key when available, otherwise falls back to the session JWT.
   * Throws if neither is available (SDK not initialized).
   */
  private requireAuthHeader(): string {
    if (this.apiKey) {
      return `Bearer ${this.apiKey}`;
    }
    if (!this.jwtToken) {
      throw new SDKError(
        "SDK not initialized. Call initialize() first.",
        "NOT_INITIALIZED",
      );
    }
    return `Bearer ${this.jwtToken}`;
  }

  /**
   * Build the standard headers object for all authenticated API calls.
   * Includes Authorization and Content-Type. When API-key authentication is
   * active and an applicationId is configured, adds the X-Application-Id header
   * so the backend authorizer can verify application ownership.
   */
  /**
   * Notifies the platform that the SDK has successfully initialized.
   * Writes a telemetry record that the setup page connection poller reads.
   * Fires both after session validation AND when initialize() runs without
   * a session (waiting-for-session state), so the setup page can show
   * "Connected" before the first session (GW-8643).
   * Fire-and-forget — never blocks or throws to the caller.
   */
  private async phoneHome(applicationId: string | undefined): Promise<void> {
    const endpoint = this.config.apiEndpoint;
    if (!endpoint || !applicationId) return;

    const body: Record<string, string> = {
      applicationId,
    };
    // Send origin only for non-local origins — the WAF SSRF rule (EC2MetaDataSSRF_BODY)
    // blocks request bodies containing "localhost" or "127.0.0.1". The Lambda reads
    // origin from the HTTP Origin header anyway, so omitting it from the body is fine.
    if (
      typeof window !== "undefined" &&
      window.location?.origin &&
      !window.location.origin.includes("localhost") &&
      !window.location.origin.includes("127.0.0.1")
    ) {
      body.origin = window.location.origin;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    await fetch(`${endpoint}/sdk/initialized`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: this.requireAuthHeader(),
      "Content-Type": "application/json",
    };
    if (this.apiKey && this.config.applicationId) {
      headers["X-Application-Id"] = this.config.applicationId;
    }
    return headers;
  }

  /**
   * Returns the active session ID.
   * Throws if no session is active (SDK not initialized).
   */
  private get sessionId(): string {
    if (!this.sessionData) {
      throw new SDKError(
        "SDK not initialized. Call initialize() first.",
        "NOT_INITIALIZED",
      );
    }
    return this.sessionData.sessionId;
  }

  /**
   * Fetch purchasable items for the active session.
   * Returns only items where status=active AND visibility=visible.
   *
   * GET /sdk/sessions/{session_id}/available-items
   */
  async getAvailableItems(): Promise<ApplicationItem[]> {
    const sessionId = this.sessionId;
    this.logger.log("Fetching available items for session:", sessionId);

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/available-items`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Failed to fetch available items",
        "FETCH_ITEMS_ERROR",
        response.status,
      );
    }

    const data = await response.json();
    const items = (data as { items: Array<Record<string, unknown>> }).items;
    return items.map((raw) => ({
      ...raw,
      id: (raw.itemId as string) ?? (raw.id as string),
    })) as ApplicationItem[];
  }

  /**
   * Get the current SMART token balance for the active session user.
   *
   * GET /sdk/sessions/{session_id}/balance
   */
  async getTokenBalance(): Promise<TokenBalance> {
    const sessionId = this.sessionId;
    this.logger.log("Fetching token balance for session:", sessionId);

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/balance`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Failed to fetch token balance",
        "FETCH_BALANCE_ERROR",
        response.status,
      );
    }

    const data = (await response.json()) as { balance: number; unit?: string };
    return {
      balance: data.balance ?? 0,
      unit: data.unit ?? "SMART",
    };
  }

  /**
   * Map backend response to SDK ValidationResult.
   * Backend response shape from gw-sdk-api ValidatePurchaseResponse (main.go:406-411).
   * Returns { valid, reason, totalCost, remainingBalance } (already camelCase).
   */
  private mapValidationResult(backendResponse: {
    valid: boolean;
    reason?: string;
    totalCost: number;
    remainingBalance: number;
  }): ValidationResult {
    const canPurchase = Boolean(backendResponse.valid);
    const reason = backendResponse.reason;

    return {
      canPurchase,
      reason,
      currentBalance: backendResponse.remainingBalance,
      itemCost: backendResponse.totalCost,
      // nearExpiry not returned by gw-sdk-api; omit (ValidationResult.nearExpiry is optional)
    };
  }

  /**
   * Pre-validate a proposed purchase without committing it.
   * Surfaces balance, item status, and near-expiry warnings before showing a confirm UI.
   *
   * POST /sdk/sessions/{session_id}/purchases/validate
   */
  async validatePurchase(
    itemId: string,
    quantity: number = 1,
  ): Promise<ValidationResult> {
    const sessionId = this.sessionId;
    this.logger.log("Validating purchase:", { sessionId, itemId, quantity });

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/purchases/validate`,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({ itemId, quantity }),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Purchase validation request failed",
        "VALIDATE_PURCHASE_ERROR",
        response.status,
      );
    }

    const backendResponse = await response.json();
    return this.mapValidationResult(backendResponse);
  }

  /**
   * Execute an in-session purchase atomically.
   * Deducts tokens and records the purchase in a single DynamoDB transaction.
   * Use the idempotencyKey to safely retry failed requests.
   *
   * POST /sdk/sessions/{session_id}/purchases
   */
  async purchase(request: PurchaseRequest): Promise<PurchaseResult> {
    const sessionId = this.sessionId;
    this.logger.log("Creating purchase:", {
      sessionId,
      itemId: request.itemId,
    });

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/purchases`,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          itemId: request.itemId,
          quantity: request.quantity ?? 1,
          idempotencyKey: request.idempotencyKey,
          expectedUnitPrice: request.expectedUnitPrice,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new SDKError(
        (errorBody as { message?: string }).message || "Purchase failed",
        (errorBody as { code?: string }).code || "PURCHASE_ERROR",
        response.status,
      );
    }

    return (await response.json()) as PurchaseResult;
  }

  /**
   * Trigger a purchase modal for any active item (including hidden items).
   * This method bypasses the add-ons panel and opens the PurchaseModal directly.
   * Used by publishers to trigger purchases from their own UI elements.
   *
   * @param itemId - The ID of the item to purchase
   * @throws {SDKError} If no active session exists
   */
  async requestPurchase(itemId: string): Promise<void> {
    const sessionData = this.getSessionData();
    if (!sessionData) {
      throw new SDKError(
        "No active session. Cannot request purchase.",
        "NO_ACTIVE_SESSION",
      );
    }

    this.logger.log("Requesting purchase for item:", itemId);

    // Fire onPurchaseStart event
    this.events.onPurchaseStart?.({ itemId, quantity: 1 });

    // Fetch item details and balance concurrently
    let itemName = itemId;
    let tokenCost = 0;
    let currentBalance = 0;
    let expectedUnitPrice = 0;

    try {
      const [items, balance] = await Promise.all([
        this.getItems(),
        this.getTokenBalance(),
      ]);

      const item = items.find((i) => i.id === itemId);
      if (item) {
        if (item.status === "inactive" || item.status === "deleted") {
          const purchaseError: PurchaseError = {
            message: "Item is not available for purchase",
            code: "item_inactive",
            itemId,
          };
          this.events.onPurchaseError?.(purchaseError);
          return;
        }
        itemName = item.name;
        tokenCost = item.userTokenCost;
        expectedUnitPrice = item.userTokenCost;
      }
      currentBalance = balance.balance;
    } catch (fetchError) {
      this.logger.warn("Could not fetch item/balance data:", fetchError);
      // Continue with defaults — modal will show and API will validate
    }

    // Pre-modal balance check: fire immediately if funds are insufficient
    if (tokenCost > 0 && currentBalance < tokenCost) {
      const purchaseError: PurchaseError = {
        message: "Insufficient token balance",
        code: "insufficient_balance",
        itemId,
      };
      this.events.onPurchaseError?.(purchaseError);
      return;
    }

    // Lazy-initialize PurchaseModal
    if (!this.purchaseModal) {
      this.purchaseModal = new PurchaseModal(
        this.config.themeMode,
        this.config.customStyles,
      );
    }

    // Show the purchase modal with real data
    this.purchaseModal.show({
      item: {
        id: itemId,
        name: itemName,
        tokenCost,
      },
      quantity: 1,
      currentBalance,
      onConfirm: async (quantity: number) => {
        try {
          this.logger.log(
            "Purchase confirmed for item:",
            itemId,
            "quantity:",
            quantity,
          );

          const purchaseRequest: PurchaseRequest = {
            itemId,
            quantity,
            idempotencyKey: this.generateIdempotencyKey(),
            expectedUnitPrice,
          };

          const result = await this.purchase(purchaseRequest);

          // Fire success events
          this.events.onPurchaseSuccess?.(result);
          this.events.onPurchaseComplete?.(itemId);
          this.events.onBalanceUpdate?.(result.remainingBalance);

          this.logger.log("Purchase completed successfully for item:", itemId);
        } catch (error) {
          this.logger.error("Purchase failed for item:", itemId, error);

          const purchaseError: PurchaseError = {
            message: error instanceof Error ? error.message : "Purchase failed",
            code: "validation_failed",
            itemId,
          };

          this.events.onPurchaseError?.(purchaseError);
          throw error;
        }
      },
      onCancel: () => {
        this.logger.log("Purchase cancelled for item:", itemId);
        this.events.onPurchaseCancelled?.(itemId);
      },
    });
  }

  // -------------------------------------------------------------------------
  // Item APIs — used by React hooks (useGWItems)
  // -------------------------------------------------------------------------

  /**
   * Fetch the list of purchasable items for the current session.
   *
   * GET /sdk/sessions/{session_id}/items
   */
  async getItems(): Promise<ApplicationItem[]> {
    const sessionId = this.sessionId;
    this.logger.log("Fetching items for session:", sessionId);

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/items`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Failed to fetch session items",
        "NETWORK_ERROR",
        response.status,
      );
    }

    const data = (await response.json()) as {
      items: Array<Record<string, unknown>>;
    };
    return data.items.map((raw) => ({
      ...raw,
      id: (raw.itemId as string) ?? (raw.id as string),
    })) as ApplicationItem[];
  }

  /**
   * Retrieve the purchase history for the active session.
   *
   * GET /sdk/sessions/{session_id}/purchases
   */
  async getPurchaseHistory(): Promise<SessionPurchase[]> {
    const sessionId = this.sessionId;
    this.logger.log("Fetching purchase history for session:", sessionId);

    const response = await fetch(
      `${this.config.apiEndpoint}/sdk/sessions/${sessionId}/purchases`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok) {
      throw new SDKError(
        "Failed to fetch purchase history",
        "FETCH_PURCHASES_ERROR",
        response.status,
      );
    }

    const data = (await response.json()) as {
      purchases: SessionPurchase[];
      total: number;
      nextCursor?: string;
    };
    return data.purchases;
  }

  /**
   * Cleanup and destroy SDK instance
   */
  destroy(): void {
    this.logger.info("Destroying SDK instance...");
    this.timer?.stop();
    this.heartbeat?.stop();
    this.tabSync?.destroy();
    this.modal?.hide();

    // Remove the floating session-controls widget from the DOM so it
    // does not remain orphaned when the SDK instance is discarded.
    this.unmountSessionHeader();

    // Clear JWT from storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(MarketplaceSDK.JWT_STORAGE_KEY);
      this.logger.log("JWT token cleared from storage");
    }

    this.sessionData = null;
    this.jwtToken = null;

    // Clear singleton reference so a subsequent new MarketplaceSDK() works.
    if (MarketplaceSDK._instance === this) {
      MarketplaceSDK._instance = null;
    }
  }
}
