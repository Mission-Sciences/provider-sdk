import { JWTParser } from './JWTParser';
import { JWKSValidator } from './JWKSValidator';
import { TimerManager } from './TimerManager';
import { HeartbeatManager } from './HeartbeatManager';
import { TabSyncManager, TabSyncMessage } from './TabSyncManager';
import { WarningModal } from '../ui/WarningModal';
import { extractTokenFromURL } from '../utils/url';
import { Logger } from '../utils/logger';
import { SDKConfig, SDKEvents, SessionData, SDKError } from '../types';

/**
 * Marketplace SDK with Phase 2 Features
 * - Heartbeat system
 * - Multi-tab synchronization
 * - Visibility API integration
 * - Session extension/completion
 * - Backend validation
 */
export class MarketplaceSDK {
  private config: Required<SDKConfig>;
  private validator: JWKSValidator;
  private timer: TimerManager | null = null;
  private heartbeat: HeartbeatManager | null = null;
  private tabSync: TabSyncManager | null = null;
  private modal: WarningModal | null = null;
  private logger: Logger;
  private events: Partial<SDKEvents> = {};
  private sessionData: SessionData | null = null;
  private jwtToken: string | null = null;

  constructor(config: SDKConfig) {
    this.config = {
      jwksUri: config.jwksUri || 'https://api.generalwisdom.com/.well-known/jwks.json',
      apiEndpoint: config.apiEndpoint || 'http://localhost:3000',
      debug: config.debug ?? false,
      autoStart: config.autoStart ?? true,
      warningThresholdSeconds: config.warningThresholdSeconds ?? 300,
      customStyles: config.customStyles ?? {},
      themeMode: config.themeMode ?? 'light',
      applicationId: config.applicationId ?? '',
      marketplaceUrl: config.marketplaceUrl ?? 'https://d3p2yqofgy75sz.cloudfront.net/',
      // Phase 2 options
      enableHeartbeat: config.enableHeartbeat ?? false,
      heartbeatIntervalSeconds: config.heartbeatIntervalSeconds ?? 30,
      enableTabSync: config.enableTabSync ?? false,
      pauseOnHidden: config.pauseOnHidden ?? false,
      useBackendValidation: config.useBackendValidation ?? false,
    };

    this.validator = new JWKSValidator(this.config.jwksUri, this.config.debug);
    this.logger = new Logger(this.config.debug, '[MarketplaceSDK]');

    this.logger.info('SDK initialized with config:', {
      jwksUri: this.config.jwksUri,
      apiEndpoint: this.config.apiEndpoint,
      enableHeartbeat: this.config.enableHeartbeat,
      enableTabSync: this.config.enableTabSync,
      pauseOnHidden: this.config.pauseOnHidden,
    });
  }

  /**
   * Register event handlers
   */
  on<K extends keyof SDKEvents>(event: K, handler: SDKEvents[K]): void {
    this.events[event] = handler;
    this.logger.log('Event handler registered:', event);
  }

  /**
   * Initialize SDK and validate session
   */
  async initialize(): Promise<SessionData> {
    this.logger.info('Initializing session...');

    try {
      // Extract JWT from URL
      this.jwtToken = extractTokenFromURL('gwSession');
      if (!this.jwtToken) {
        throw new SDKError(
          'No gwSession token found in URL',
          'MISSING_TOKEN'
        );
      }

      this.logger.log('JWT token extracted from URL');

      // Validate JWT
      let verifiedClaims;
      if (this.config.useBackendValidation) {
        // Phase 2: Backend validation
        this.logger.log('Using backend validation');
        verifiedClaims = await this.validateWithBackend(this.jwtToken);
      } else {
        // Phase 1: JWKS validation
        this.logger.log('Using JWKS validation');
        verifiedClaims = await this.validator.verify(
          this.jwtToken,
          'generalwisdom.com',
          this.config.applicationId || undefined
        );
      }

      this.logger.log('JWT verified successfully');

      // Map to SessionData
      this.sessionData = {
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

      // Calculate remaining time
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = Math.max(0, this.sessionData.exp - now);

      if (remainingSeconds <= 0) {
        throw new SDKError(
          'Session has already expired',
          'SESSION_EXPIRED'
        );
      }

      this.logger.log('Remaining time:', remainingSeconds, 'seconds');

      // Initialize timer
      this.timer = new TimerManager(
        remainingSeconds,
        this.config.warningThresholdSeconds,
        {
          onSessionWarning: (data) => {
            this.showWarningModal(data.remainingSeconds);
            this.events.onSessionWarning?.(data);
          },
          onSessionEnd: () => {
            this.endSession();
          },
        },
        this.config.debug
      );

      // Phase 2: Initialize heartbeat if enabled
      if (this.config.enableHeartbeat && this.jwtToken) {
        this.heartbeat = new HeartbeatManager(
          this.sessionData.sessionId,
          this.config.apiEndpoint,
          this.jwtToken,
          (remainingSeconds) => {
            // Sync timer with server
            this.timer?.updateRemainingTime(remainingSeconds);
          },
          (error) => {
            this.logger.error('Heartbeat error:', error);
            this.events.onError?.(error);
          },
          this.config.heartbeatIntervalSeconds,
          this.config.debug
        );
      }

      // Phase 2: Initialize tab sync if enabled
      if (this.config.enableTabSync) {
        this.tabSync = new TabSyncManager(
          this.sessionData.sessionId,
          (message) => this.handleTabSyncMessage(message),
          this.config.debug
        );
      }

      // Phase 2: Set up Visibility API if enabled
      if (this.config.pauseOnHidden) {
        this.initializeVisibilityHandling();
      }

      // Start timer if autoStart enabled
      if (this.config.autoStart) {
        this.timer.start();
        this.logger.log('Timer started automatically');

        // Start heartbeat only if this is the master tab
        if (this.config.enableHeartbeat && this.heartbeat) {
          const isMaster = !this.tabSync || this.tabSync.isMasterTab();
          if (isMaster) {
            this.heartbeat.start();
            this.logger.log('Heartbeat started (master tab)');
          } else {
            this.logger.log('Heartbeat not started (slave tab)');
          }
        }
      }

      // Trigger session start event
      this.events.onSessionStart?.(this.sessionData);

      this.logger.info('Session initialized successfully');
      return this.sessionData;

    } catch (error) {
      this.logger.error('Initialization failed:', error);
      const sdkError = error instanceof SDKError ? error : new SDKError(
        error instanceof Error ? error.message : 'Unknown error',
        'INITIALIZATION_ERROR'
      );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * Phase 2: Validate JWT with backend
   */
  private async validateWithBackend(token: string): Promise<any> {
    const response = await fetch(
      `${this.config.apiEndpoint}/sessions/validate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_jwt: token }),
      }
    );

    if (!response.ok) {
      throw new SDKError(
        'Backend validation failed',
        'BACKEND_VALIDATION_FAILED',
        response.status
      );
    }

    const data = await response.json();
    if (!data.valid) {
      throw new SDKError(
        data.error || 'Session validation failed',
        'SESSION_INVALID'
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
    this.logger.log('Tab sync message:', message.type);

    switch (message.type) {
      case 'pause':
        this.timer?.pause();
        break;
      case 'resume':
        this.timer?.resume();
        break;
      case 'end':
        this.endSession();
        break;
      case 'timer_update':
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
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logger.log('Tab hidden, pausing timer');
        this.pauseTimer();
      } else {
        this.logger.log('Tab visible, resuming timer');
        this.resumeTimer();
      }
    });
    this.logger.log('Visibility API handler initialized');
  }

  /**
   * Start session timer manually
   */
  startTimer(): void {
    if (!this.timer) {
      throw new SDKError(
        'SDK not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }
    this.timer.start();
    this.tabSync?.broadcast('resume');
    this.logger.info('Timer started manually');
  }

  /**
   * Pause session timer
   */
  pauseTimer(): void {
    this.timer?.pause();
    this.tabSync?.broadcast('pause');
    this.logger.info('Timer paused');
  }

  /**
   * Resume session timer
   */
  resumeTimer(): void {
    this.timer?.resume();
    this.tabSync?.broadcast('resume');
    this.logger.info('Timer resumed');
  }

  /**
   * Phase 2: Extend session
   */
  async extendSession(additionalMinutes: number): Promise<void> {
    if (!this.sessionData || !this.jwtToken) {
      throw new SDKError('No active session', 'NO_SESSION');
    }

    this.logger.info('Extending session by', additionalMinutes, 'minutes');

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/sessions/${this.sessionData.sessionId}/renew`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            additional_minutes: additionalMinutes,
          }),
        }
      );

      if (!response.ok) {
        throw new SDKError(
          'Session extension failed',
          'EXTENSION_FAILED',
          response.status
        );
      }

      const data = await response.json();

      // Update session data
      this.sessionData.exp = data.new_expires_at;

      // Update timer
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = data.new_expires_at - now;
      this.timer?.updateRemainingTime(remainingSeconds);

      // Broadcast to other tabs
      this.tabSync?.broadcast('timer_update', { remainingSeconds });

      this.logger.info('Session extended successfully');

    } catch (error) {
      this.logger.error('Failed to extend session:', error);
      const sdkError = error instanceof SDKError ? error : new SDKError(
        error instanceof Error ? error.message : 'Extension failed',
        'EXTENSION_ERROR'
      );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * Phase 2: Complete session
   */
  async completeSession(actualUsageMinutes?: number): Promise<void> {
    if (!this.sessionData || !this.jwtToken) {
      throw new SDKError('No active session', 'NO_SESSION');
    }

    this.logger.info('Completing session...');

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/sessions/${this.sessionData.sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actual_usage_minutes: actualUsageMinutes,
            metadata: {},
          }),
        }
      );

      if (!response.ok) {
        throw new SDKError(
          'Session completion failed',
          'COMPLETION_FAILED',
          response.status
        );
      }

      const data = await response.json();
      this.logger.info('Session completed:', data);

      // End the session
      this.endSession();

    } catch (error) {
      this.logger.error('Failed to complete session:', error);
      const sdkError = error instanceof SDKError ? error : new SDKError(
        error instanceof Error ? error.message : 'Completion failed',
        'COMPLETION_ERROR'
      );
      this.events.onError?.(sdkError);
      throw sdkError;
    }
  }

  /**
   * End session
   */
  endSession(): void {
    this.logger.info('Ending session...');

    // Stop timer
    this.timer?.stop();

    // Stop heartbeat
    this.heartbeat?.stop();

    // Broadcast to other tabs
    this.tabSync?.broadcast('end');

    // Trigger end event
    this.events.onSessionEnd?.();

    this.logger.info('Session ended');

    // Show "Session Ending" modal, then redirect after 3 seconds
    if (typeof window !== 'undefined') {
      // Create modal if it doesn't exist
      if (!this.modal) {
        this.modal = new WarningModal(
          this.config.themeMode || 'light',
          this.config.customStyles
        );
      }

      // Show ending message with redirect callback
      this.modal.showEndingMessage(() => {
        window.location.href = this.config.marketplaceUrl;
      }, 3000); // 3 second delay
    }
  }

  /**
   * Show warning modal
   */
  private showWarningModal(remainingSeconds: number): void {
    if (!this.modal) {
      this.modal = new WarningModal(
        this.config.themeMode || 'light',
        this.config.customStyles
      );
    }

    this.modal.show({
      remainingSeconds,
      onExtend: async () => {
        // Try to extend session via API
        try {
          await this.extendSession(15); // Extend by 15 minutes
          this.modal?.hide();
          this.logger.log('Session extended successfully from modal');
        } catch (error) {
          // If extension fails (likely insufficient tokens), show ending modal then redirect to marketplace
          this.logger.error('Extension failed, redirecting to marketplace:', error);
          const marketplaceUrl = `${this.config.marketplaceUrl}extend-session?sessionId=${this.sessionData?.sessionId}`;

          // Show ending modal before redirect
          if (typeof window !== 'undefined') {
            if (!this.modal) {
              this.modal = new WarningModal(
                this.config.themeMode || 'light',
                this.config.customStyles
              );
            }
            this.modal.showEndingMessage(() => {
              window.location.href = marketplaceUrl;
            }, 3000);
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
    return this.timer?.getFormattedTime() ?? '0:00';
  }

  /**
   * Get formatted time with hours (HH:MM:SS)
   */
  getFormattedTimeWithHours(): string {
    return this.timer?.getFormattedTimeWithHours() ?? '0:00:00';
  }

  /**
   * Check if timer is running
   */
  isTimerRunning(): boolean {
    return this.timer?.isRunning() ?? false;
  }

  /**
   * Cleanup and destroy SDK instance
   */
  destroy(): void {
    this.logger.info('Destroying SDK instance...');
    this.timer?.stop();
    this.heartbeat?.stop();
    this.tabSync?.destroy();
    this.modal?.hide();
    this.sessionData = null;
    this.jwtToken = null;
  }
}
