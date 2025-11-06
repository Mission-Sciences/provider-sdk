# Token Marketplace Platform
## Technical Documentation: Provider SDK Implementation

**Focus**: Building the JavaScript/TypeScript Provider SDK with Vite
**Backend**: Go API (separate repository)
**Audience**: SDK developers and app providers

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SDK Project Structure](#sdk-project-structure)
3. [Vite Build Configuration](#vite-build-configuration)
4. [Core SDK Implementation](#core-sdk-implementation)
5. [Go Backend Integration](#go-backend-integration)
6. [Testing Strategy](#testing-strategy)
7. [NPM Publishing & Distribution](#npm-publishing--distribution)
8. [Provider Integration Examples](#provider-integration-examples)
9. [Two-Week Implementation Plan](#two-week-implementation-plan)

---

## Architecture Overview

### System Components

```
┌────────────────────────────────────────────────────────────────┐
│                      Marketplace PWA                            │
│  (Separate team - consumes Go backend API)                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ JWT Token
                         │
┌────────────────────────▼───────────────────────────────────────┐
│                    Go Backend API                               │
│  • User authentication                                          │
│  • Token management                                             │
│  • Session creation (generates JWT)                             │
│  • Session validation                                           │
│  • Token deduction                                              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ REST API
                         │
┌────────────────────────▼───────────────────────────────────────┐
│                   Provider SDK (Our Focus)                      │
│  • JWT parsing & validation                                     │
│  • Session timer management                                     │
│  • Backend API client                                           │
│  • Warning modals & UI                                          │
│  • Auto-redirect logic                                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ NPM Package
                         │
┌────────────────────────▼───────────────────────────────────────┐
│               Provider Applications                             │
│  (Third-party apps integrate our SDK)                           │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Session Flow

```
1. User clicks "Start Session" in Marketplace PWA
   ↓
2. Marketplace calls Go backend: POST /sessions
   ↓
3. Go backend creates session record and generates JWT
   JWT contains: {
     jti: "unique-session-id",
     sub: "user-id",
     provider_id: "app-provider-id",
     exp: timestamp + duration,
     iat: timestamp,
     tokens_allocated: 500,
     return_url: "https://marketplace.com/session/complete"
   }
   ↓
4. Marketplace redirects to provider app:
   https://provider-app.com/?session=<JWT_TOKEN>
   ↓
5. Provider app SDK:
   - Extracts JWT from URL
   - Calls Go backend: POST /sessions/validate
   - Starts countdown timer
   - Shows warning at 5 minutes remaining
   - Auto-redirects when time expires
   ↓
6. User redirected back to marketplace:
   https://marketplace.com/session/complete?session_id=<ID>
   ↓
7. Marketplace calls Go backend: POST /sessions/{id}/complete
   ↓
8. Go backend deducts tokens and marks session complete
```

---

## SDK Project Structure

```
marketplace-provider-sdk/
├── src/
│   ├── core/
│   │   ├── MarketplaceSDK.ts          # Main SDK class
│   │   ├── JWTParser.ts               # JWT decoding (no verification)
│   │   ├── SessionValidator.ts        # Backend API integration
│   │   ├── TimerManager.ts            # Countdown and expiration logic
│   │   └── StorageManager.ts          # LocalStorage wrapper
│   ├── ui/
│   │   ├── WarningModal.ts            # Expiration warning component
│   │   ├── TimerDisplay.ts            # Optional countdown UI
│   │   └── styles.ts                  # Inline CSS styles
│   ├── utils/
│   │   ├── http.ts                    # Fetch wrapper with retries
│   │   ├── url.ts                     # URL parameter parsing
│   │   ├── logger.ts                  # Debug logging
│   │   └── errors.ts                  # Custom error classes
│   ├── types/
│   │   └── index.ts                   # TypeScript definitions
│   └── index.ts                       # Public API exports
├── examples/
│   ├── vanilla-js/
│   │   ├── index.html                 # Basic integration
│   │   └── package.json
│   ├── react/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useMarketplaceSession.ts
│   │   │   └── components/
│   │   │       └── SessionTimer.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── vue/
│   │   ├── src/
│   │   │   ├── App.vue
│   │   │   ├── composables/
│   │   │   │   └── useMarketplaceSession.ts
│   │   │   └── components/
│   │   │       └── SessionTimer.vue
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── nextjs/
│       ├── pages/
│       ├── components/
│       └── package.json
├── tests/
│   ├── unit/
│   │   ├── jwt-parser.test.ts
│   │   ├── session-validator.test.ts
│   │   ├── timer-manager.test.ts
│   │   └── storage-manager.test.ts
│   ├── integration/
│   │   ├── sdk-initialization.test.ts
│   │   ├── session-flow.test.ts
│   │   └── error-handling.test.ts
│   └── e2e/
│       ├── playwright.config.ts
│       └── session-lifecycle.spec.ts
├── docs/
│   ├── README.md                      # Quick start guide
│   ├── API.md                         # Complete API reference
│   ├── INTEGRATION.md                 # Step-by-step integration
│   ├── BACKEND.md                     # Go backend requirements
│   └── TROUBLESHOOTING.md             # Common issues
├── vite.config.ts                     # Vite library build config
├── vitest.config.ts                   # Test configuration
├── tsconfig.json                      # TypeScript configuration
├── package.json                       # NPM package metadata
├── .npmignore                         # Files to exclude from NPM
└── README.md                          # NPM package README
```

---

## Vite Build Configuration

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MarketplaceSDK',
      formats: ['es', 'umd'],
      fileName: (format) => `marketplace-sdk.${format}.js`,
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: [],
      output: {
        // Provide global variables for UMD build
        globals: {},
      },
    },
    sourcemap: true,
    // Target modern browsers
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'examples/',
        'dist/',
      ],
    },
  },
});
```

### package.json

```json
{
  "name": "@marketplace/provider-sdk",
  "version": "1.0.0",
  "description": "Provider SDK for token-based marketplace platform",
  "type": "module",
  "main": "./dist/marketplace-sdk.umd.js",
  "module": "./dist/marketplace-sdk.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/marketplace-sdk.es.js",
      "require": "./dist/marketplace-sdk.umd.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "marketplace",
    "session-management",
    "token-based-billing",
    "provider-sdk",
    "jwt-validation"
  ],
  "author": "Your Team",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.54.0",
    "jsdom": "^23.0.0",
    "prettier": "^3.1.0",
    "terser": "^5.25.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-dts": "^3.6.0",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "vue": "^3.0.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "examples"]
}
```

---

## Core SDK Implementation

### src/types/index.ts

```typescript
export interface SDKConfig {
  apiEndpoint: string;
  callbackDomain?: string;
  debug?: boolean;
  autoStart?: boolean;
  warningThresholdSeconds?: number;
  customStyles?: Partial<ModalStyles>;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  providerId: string;
  tokensAllocated: number;
  durationSeconds: number;
  expiresAt: number;
  returnUrl: string;
}

export interface ModalStyles {
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  borderRadius: string;
  fontFamily: string;
}

export interface SDKEvents {
  onSessionStart: (data: SessionData) => void;
  onSessionWarning: (data: { remainingSeconds: number }) => void;
  onSessionEnd: () => void;
  onError: (error: Error) => void;
}

export class SDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SDKError';
  }
}
```

### src/core/JWTParser.ts

```typescript
import { SDKError } from '../types';

export class JWTParser {
  /**
   * Decode JWT payload without verification
   * Backend handles signature verification
   */
  static decode(token: string): Record<string, any> {
    if (!token || typeof token !== 'string') {
      throw new SDKError('Invalid JWT token format', 'INVALID_TOKEN');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new SDKError('Malformed JWT token', 'MALFORMED_TOKEN');
    }

    try {
      const payload = parts[1];
      const decoded = this.base64UrlDecode(payload);
      return JSON.parse(decoded);
    } catch (error) {
      throw new SDKError(
        'Failed to decode JWT payload',
        'DECODE_ERROR',
        error
      );
    }
  }

  /**
   * Extract specific claim from JWT
   */
  static extractClaim(token: string, claim: string): any {
    const payload = this.decode(token);
    return payload[claim];
  }

  /**
   * Check if JWT is expired (client-side only, not authoritative)
   */
  static isExpired(token: string): boolean {
    const payload = this.decode(token);
    const exp = payload.exp;
    
    if (!exp) {
      return false;
    }

    return Date.now() >= exp * 1000;
  }

  /**
   * Base64 URL decode
   */
  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    try {
      return atob(base64);
    } catch (error) {
      throw new SDKError('Invalid base64 encoding', 'ENCODING_ERROR');
    }
  }
}
```

### src/core/SessionValidator.ts

```typescript
import { httpClient } from '../utils/http';
import { SessionData, SDKError } from '../types';
import { Logger } from '../utils/logger';

export class SessionValidator {
  private apiEndpoint: string;
  private logger: Logger;

  constructor(apiEndpoint: string, debug: boolean = false) {
    this.apiEndpoint = apiEndpoint;
    this.logger = new Logger(debug);
  }

  /**
   * Validate session with Go backend
   */
  async validate(jti: string, token: string): Promise<SessionData> {
    this.logger.debug('Validating session:', jti);

    try {
      const response = await httpClient.post(
        `${this.apiEndpoint}/api/v1/sessions/validate`,
        { jti },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.valid) {
        throw new SDKError(
          response.error || 'Session validation failed',
          'VALIDATION_FAILED',
          response.statusCode
        );
      }

      this.logger.debug('Session validated:', response.session);
      return this.mapSessionData(response.session);
    } catch (error) {
      this.logger.error('Validation error:', error);
      throw error;
    }
  }

  /**
   * Send heartbeat to backend
   */
  async heartbeat(sessionId: string, token: string): Promise<number> {
    this.logger.debug('Sending heartbeat:', sessionId);

    try {
      const response = await httpClient.post(
        `${this.apiEndpoint}/api/v1/sessions/${sessionId}/heartbeat`,
        {
          timestamp: Date.now(),
          active: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.remaining_seconds;
    } catch (error) {
      this.logger.warn('Heartbeat failed:', error);
      // Don't throw - heartbeat failures shouldn't break the session
      return -1;
    }
  }

  /**
   * Map backend response to SessionData
   */
  private mapSessionData(data: any): SessionData {
    return {
      sessionId: data.id,
      userId: data.user_id,
      providerId: data.provider_id,
      tokensAllocated: data.tokens_allocated,
      durationSeconds: data.duration_limit_seconds,
      expiresAt: data.expires_at,
      returnUrl: data.return_url || this.getDefaultReturnUrl(),
    };
  }

  /**
   * Get default return URL from current domain
   */
  private getDefaultReturnUrl(): string {
    return `${window.location.protocol}//${window.location.host}/session/complete`;
  }
}
```

### src/core/TimerManager.ts

```typescript
import { Logger } from '../utils/logger';
import { SDKEvents } from '../types';

export class TimerManager {
  private remainingSeconds: number;
  private intervalId: number | null = null;
  private warningThreshold: number;
  private warningShown: boolean = false;
  private logger: Logger;
  private events: Partial<SDKEvents>;

  constructor(
    durationSeconds: number,
    warningThresholdSeconds: number = 300,
    events: Partial<SDKEvents> = {},
    debug: boolean = false
  ) {
    this.remainingSeconds = durationSeconds;
    this.warningThreshold = warningThresholdSeconds;
    this.events = events;
    this.logger = new Logger(debug);
  }

  /**
   * Start countdown timer
   */
  start(): void {
    this.logger.debug('Starting timer:', this.remainingSeconds, 'seconds');

    this.intervalId = window.setInterval(() => {
      this.remainingSeconds--;

      this.logger.debug('Time remaining:', this.remainingSeconds);

      // Check for warning threshold
      if (
        !this.warningShown &&
        this.remainingSeconds <= this.warningThreshold
      ) {
        this.warningShown = true;
        this.logger.warn('Warning threshold reached');
        this.events.onSessionWarning?.({
          remainingSeconds: this.remainingSeconds,
        });
      }

      // Check for expiration
      if (this.remainingSeconds <= 0) {
        this.logger.warn('Session expired');
        this.stop();
        this.events.onSessionEnd?.();
      }
    }, 1000);
  }

  /**
   * Stop timer
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.debug('Timer stopped');
    }
  }

  /**
   * Pause timer
   */
  pause(): void {
    this.stop();
    this.logger.debug('Timer paused at:', this.remainingSeconds);
  }

  /**
   * Resume timer
   */
  resume(): void {
    if (this.intervalId === null && this.remainingSeconds > 0) {
      this.start();
      this.logger.debug('Timer resumed at:', this.remainingSeconds);
    }
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  /**
   * Get formatted time string (MM:SS)
   */
  getFormattedTime(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Check if timer is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
```

### src/core/MarketplaceSDK.ts

```typescript
import { JWTParser } from './JWTParser';
import { SessionValidator } from './SessionValidator';
import { TimerManager } from './TimerManager';
import { WarningModal } from '../ui/WarningModal';
import { StorageManager } from './StorageManager';
import { extractTokenFromURL } from '../utils/url';
import { Logger } from '../utils/logger';
import { SDKConfig, SDKEvents, SessionData, SDKError } from '../types';

export class MarketplaceSDK {
  private config: Required<SDKConfig>;
  private validator: SessionValidator;
  private timer: TimerManager | null = null;
  private modal: WarningModal | null = null;
  private storage: StorageManager;
  private logger: Logger;
  private events: Partial<SDKEvents> = {};
  private sessionData: SessionData | null = null;
  private jwtToken: string | null = null;

  constructor(config: SDKConfig) {
    this.config = {
      apiEndpoint: config.apiEndpoint,
      callbackDomain: config.callbackDomain || window.location.hostname,
      debug: config.debug ?? false,
      autoStart: config.autoStart ?? true,
      warningThresholdSeconds: config.warningThresholdSeconds ?? 300,
      customStyles: config.customStyles ?? {},
    };

    this.validator = new SessionValidator(
      this.config.apiEndpoint,
      this.config.debug
    );
    this.storage = new StorageManager();
    this.logger = new Logger(this.config.debug);

    this.logger.info('SDK initialized with config:', this.config);
  }

  /**
   * Register event handlers
   */
  on(event: keyof SDKEvents, handler: Function): void {
    this.events[event] = handler as any;
    this.logger.debug('Event handler registered:', event);
  }

  /**
   * Initialize SDK and validate session
   */
  async initialize(): Promise<SessionData> {
    this.logger.info('Initializing session...');

    try {
      // Extract JWT from URL
      this.jwtToken = extractTokenFromURL('session');
      if (!this.jwtToken) {
        throw new SDKError(
          'No session token found in URL',
          'MISSING_TOKEN'
        );
      }

      // Decode JWT to get session ID
      const payload = JWTParser.decode(this.jwtToken);
      const jti = payload.jti;

      if (!jti) {
        throw new SDKError(
          'JWT missing JTI claim',
          'INVALID_JWT'
        );
      }

      // Validate session with backend
      this.sessionData = await this.validator.validate(jti, this.jwtToken);

      // Calculate remaining time
      const now = Date.now();
      const expiresAt = this.sessionData.expiresAt * 1000;
      const remainingSeconds = Math.floor((expiresAt - now) / 1000);

      if (remainingSeconds <= 0) {
        throw new SDKError(
          'Session has already expired',
          'SESSION_EXPIRED'
        );
      }

      // Store session data
      this.storage.setSession(this.sessionData);

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

      // Start timer if autoStart enabled
      if (this.config.autoStart) {
        this.timer.start();
      }

      // Trigger session start event
      this.events.onSessionStart?.(this.sessionData);

      this.logger.info('Session initialized successfully');
      return this.sessionData;

    } catch (error) {
      this.logger.error('Initialization failed:', error);
      this.events.onError?.(error as Error);
      throw error;
    }
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
    this.logger.info('Timer started manually');
  }

  /**
   * Pause session timer
   */
  pauseTimer(): void {
    this.timer?.pause();
    this.logger.info('Timer paused');
  }

  /**
   * Resume session timer
   */
  resumeTimer(): void {
    this.timer?.resume();
    this.logger.info('Timer resumed');
  }

  /**
   * End session and redirect
   */
  endSession(): void {
    this.logger.info('Ending session...');

    // Stop timer
    this.timer?.stop();

    // Clear storage
    this.storage.clearSession();

    // Trigger end event
    this.events.onSessionEnd?.();

    // Redirect to marketplace
    if (this.sessionData?.returnUrl) {
      window.location.href = `${this.sessionData.returnUrl}?session_id=${this.sessionData.sessionId}`;
    }
  }

  /**
   * Show warning modal
   */
  private showWarningModal(remainingSeconds: number): void {
    if (!this.modal) {
      this.modal = new WarningModal(this.config.customStyles);
    }

    this.modal.show({
      remainingSeconds,
      onExtend: () => {
        // Could call backend to extend session
        this.logger.info('User requested session extension');
      },
      onEnd: () => {
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
   * Get formatted time
   */
  getFormattedTime(): string {
    return this.timer?.getFormattedTime() ?? '0:00';
  }

  /**
   * Cleanup and destroy SDK instance
   */
  destroy(): void {
    this.logger.info('Destroying SDK instance...');
    this.timer?.stop();
    this.modal?.hide();
    this.storage.clearSession();
  }
}
```

---

## Go Backend Integration

### Required Backend Endpoints

The SDK requires these endpoints from the Go backend:

#### 1. Session Validation

```go
// POST /api/v1/sessions/validate
type ValidateRequest struct {
    JTI string `json:"jti" binding:"required"`
}

type ValidateResponse struct {
    Valid   bool          `json:"valid"`
    Session *SessionData  `json:"session,omitempty"`
    Error   string        `json:"error,omitempty"`
}

type SessionData struct {
    ID                    string    `json:"id"`
    UserID                string    `json:"user_id"`
    ProviderID            string    `json:"provider_id"`
    TokensAllocated       int       `json:"tokens_allocated"`
    DurationLimitSeconds  int       `json:"duration_limit_seconds"`
    ExpiresAt             int64     `json:"expires_at"`
    ReturnURL             string    `json:"return_url"`
    Status                string    `json:"status"`
}

func ValidateSession(c *gin.Context) {
    var req ValidateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, ValidateResponse{
            Valid: false,
            Error: "Invalid request",
        })
        return
    }

    // Extract JWT from Authorization header
    token := c.GetHeader("Authorization")
    if token == "" {
        c.JSON(401, ValidateResponse{
            Valid: false,
            Error: "Missing authorization token",
        })
        return
    }

    // Verify JWT signature and claims
    claims, err := verifyJWT(token)
    if err != nil {
        c.JSON(401, ValidateResponse{
            Valid: false,
            Error: "Invalid or expired token",
        })
        return
    }

    // Verify JTI matches
    if claims.JTI != req.JTI {
        c.JSON(401, ValidateResponse{
            Valid: false,
            Error: "JTI mismatch",
        })
        return
    }

    // Fetch session from database
    session, err := db.GetSession(req.JTI)
    if err != nil {
        c.JSON(404, ValidateResponse{
            Valid: false,
            Error: "Session not found",
        })
        return
    }

    // Check session status
    if session.Status != "active" {
        c.JSON(400, ValidateResponse{
            Valid: false,
            Error: "Session is not active",
        })
        return
    }

    c.JSON(200, ValidateResponse{
        Valid:   true,
        Session: session,
    })
}
```

#### 2. Session Heartbeat

```go
// POST /api/v1/sessions/{id}/heartbeat
type HeartbeatRequest struct {
    Timestamp int64 `json:"timestamp"`
    Active    bool  `json:"active"`
}

type HeartbeatResponse struct {
    Acknowledged      bool `json:"acknowledged"`
    RemainingSeconds  int  `json:"remaining_seconds"`
}

func SessionHeartbeat(c *gin.Context) {
    sessionID := c.Param("id")
    
    var req HeartbeatRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "Invalid request"})
        return
    }

    // Update session last_heartbeat timestamp
    session, err := db.UpdateSessionHeartbeat(sessionID, req.Timestamp)
    if err != nil {
        c.JSON(404, gin.H{"error": "Session not found"})
        return
    }

    // Calculate remaining time
    remaining := session.ExpiresAt - time.Now().Unix()

    c.JSON(200, HeartbeatResponse{
        Acknowledged:     true,
        RemainingSeconds: int(remaining),
    })
}
```

#### 3. Public Key Endpoint

```go
// GET /api/v1/keys/public
type PublicKeyResponse struct {
    Key       string `json:"key"`
    Algorithm string `json:"algorithm"`
    KID       string `json:"kid"`
}

func GetPublicKey(c *gin.Context) {
    // Return ES256 public key for JWT verification
    c.JSON(200, PublicKeyResponse{
        Key:       config.JWTPublicKey,
        Algorithm: "ES256",
        KID:       "marketplace-key-1",
    })
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// tests/unit/jwt-parser.test.ts
import { describe, it, expect } from 'vitest';
import { JWTParser } from '../../src/core/JWTParser';

describe('JWTParser', () => {
  const validJWT = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMjMiLCJzdWIiOiJ1c2VyLTEiLCJleHAiOjE3MDAwMDAwMDB9.signature';

  it('should decode valid JWT', () => {
    const payload = JWTParser.decode(validJWT);
    expect(payload.jti).toBe('123');
    expect(payload.sub).toBe('user-1');
  });

  it('should throw on invalid JWT format', () => {
    expect(() => JWTParser.decode('invalid')).toThrow();
  });

  it('should extract specific claim', () => {
    const jti = JWTParser.extractClaim(validJWT, 'jti');
    expect(jti).toBe('123');
  });
});
```

### Integration Tests

```typescript
// tests/integration/session-flow.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';

describe('Session Flow Integration', () => {
  let sdk: MarketplaceSDK;

  beforeEach(() => {
    // Mock URL with session token
    Object.defineProperty(window, 'location', {
      value: {
        search: '?session=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    });

    sdk = new MarketplaceSDK({
      apiEndpoint: 'http://localhost:8080',
      debug: true,
    });
  });

  it('should initialize session successfully', async () => {
    const sessionData = await sdk.initialize();
    expect(sessionData.sessionId).toBeDefined();
    expect(sessionData.tokensAllocated).toBeGreaterThan(0);
  });

  it('should start timer after initialization', async () => {
    await sdk.initialize();
    const remaining = sdk.getRemainingTime();
    expect(remaining).toBeGreaterThan(0);
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/session-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Session Lifecycle', () => {
  test('complete session flow', async ({ page }) => {
    // Navigate to provider app with session token
    await page.goto('http://localhost:3000/?session=<JWT_TOKEN>');

    // Wait for SDK initialization
    await page.waitForSelector('[data-testid="session-timer"]');

    // Verify timer is counting down
    const timer = page.locator('[data-testid="session-timer"]');
    const initialTime = await timer.textContent();
    
    await page.waitForTimeout(2000);
    
    const newTime = await timer.textContent();
    expect(newTime).not.toBe(initialTime);

    // Trigger early session end
    await page.click('[data-testid="end-session"]');

    // Verify redirect to marketplace
    await expect(page).toHaveURL(/marketplace\.com\/session\/complete/);
  });
});
```

---

## NPM Publishing & Distribution

### Publishing to NPM

```bash
# 1. Login to NPM
npm login

# 2. Build the package
npm run build

# 3. Test locally first
npm pack
# This creates marketplace-provider-sdk-1.0.0.tgz

# 4. Test installation in example project
cd examples/react
npm install ../../marketplace-provider-sdk-1.0.0.tgz

# 5. Publish to NPM
npm publish --access public
```

### CDN Distribution (jsDelivr)

After publishing to NPM, jsDelivr automatically serves your package:

```html
<!-- Latest version -->
<script src="https://cdn.jsdelivr.net/npm/@marketplace/provider-sdk@latest/dist/marketplace-sdk.umd.js"></script>

<!-- Specific version -->
<script src="https://cdn.jsdelivr.net/npm/@marketplace/provider-sdk@1.0.0/dist/marketplace-sdk.umd.js"></script>

<!-- Minified version (auto-served if available) -->
<script src="https://cdn.jsdelivr.net/npm/@marketplace/provider-sdk@1.0.0/dist/marketplace-sdk.umd.min.js"></script>
```

### Version Management

```json
// package.json versioning strategy
{
  "version": "1.0.0",  // Major.Minor.Patch
  
  // Major: Breaking changes (v1 → v2)
  // Minor: New features, backwards compatible (v1.0 → v1.1)
  // Patch: Bug fixes (v1.0.0 → v1.0.1)
}
```

---

## Provider Integration Examples

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Provider App</title>
  <script src="https://cdn.jsdelivr.net/npm/@marketplace/provider-sdk@latest"></script>
</head>
<body>
  <div id="app">
    <h1>My Application</h1>
    <div id="timer">Loading...</div>
    <button id="end-btn">End Session</button>
  </div>

  <script>
    // Initialize SDK
    const sdk = new MarketplaceSDK.MarketplaceSDK({
      apiEndpoint: 'https://api.marketplace.com',
      debug: true,
    });

    // Register event handlers
    sdk.on('onSessionStart', (data) => {
      console.log('Session started:', data);
    });

    sdk.on('onSessionWarning', ({ remainingSeconds }) => {
      alert(`Only ${Math.floor(remainingSeconds / 60)} minutes remaining!`);
    });

    sdk.on('onSessionEnd', () => {
      console.log('Session ended');
    });

    sdk.on('onError', (error) => {
      alert('Error: ' + error.message);
    });

    // Initialize session
    sdk.initialize().then((data) => {
      console.log('Initialized:', data);
      
      // Update timer display every second
      setInterval(() => {
        document.getElementById('timer').textContent = sdk.getFormattedTime();
      }, 1000);
    });

    // End session button
    document.getElementById('end-btn').addEventListener('click', () => {
      sdk.endSession();
    });
  </script>
</body>
</html>
```

### React with TypeScript

```tsx
// hooks/useMarketplaceSession.ts
import { useEffect, useState, useCallback } from 'react';
import { MarketplaceSDK, SessionData, SDKConfig } from '@marketplace/provider-sdk';

export function useMarketplaceSession(config: SDKConfig) {
  const [sdk, setSdk] = useState<MarketplaceSDK | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sdkInstance = new MarketplaceSDK({
      ...config,
      onSessionStart: (data) => {
        setSession(data);
        setLoading(false);
        config.onSessionStart?.(data);
      },
      onSessionWarning: (data) => {
        config.onSessionWarning?.(data);
      },
      onSessionEnd: () => {
        config.onSessionEnd?.();
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
        config.onError?.(err);
      },
    });

    setSdk(sdkInstance);

    sdkInstance.initialize().catch((err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => {
      sdkInstance.destroy();
    };
  }, []);

  useEffect(() => {
    if (!sdk) return;

    const interval = setInterval(() => {
      setRemainingTime(sdk.getRemainingTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [sdk]);

  const endSession = useCallback(() => {
    sdk?.endSession();
  }, [sdk]);

  const pauseSession = useCallback(() => {
    sdk?.pauseTimer();
  }, [sdk]);

  const resumeSession = useCallback(() => {
    sdk?.resumeTimer();
  }, [sdk]);

  return {
    session,
    loading,
    error,
    remainingTime,
    formattedTime: sdk?.getFormattedTime() ?? '0:00',
    endSession,
    pauseSession,
    resumeSession,
  };
}
```

```tsx
// App.tsx
import React from 'react';
import { useMarketplaceSession } from './hooks/useMarketplaceSession';

function App() {
  const {
    session,
    loading,
    error,
    formattedTime,
    endSession,
    pauseSession,
    resumeSession,
  } = useMarketplaceSession({
    apiEndpoint: 'https://api.marketplace.com',
    debug: process.env.NODE_ENV === 'development',
  });

  if (loading) {
    return <div>Loading session...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <header>
        <h1>My Application</h1>
        <div>Time Remaining: {formattedTime}</div>
        <div>Tokens: {session?.tokensAllocated}</div>
      </header>

      <main>
        {/* Your app content */}
      </main>

      <footer>
        <button onClick={pauseSession}>Pause</button>
        <button onClick={resumeSession}>Resume</button>
        <button onClick={endSession}>End Session</button>
      </footer>
    </div>
  );
}

export default App;
```

### Vue 3 with Composition API

```typescript
// composables/useMarketplaceSession.ts
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { MarketplaceSDK, SessionData, SDKConfig } from '@marketplace/provider-sdk';

export function useMarketplaceSession(config: SDKConfig) {
  const sdk = ref<MarketplaceSDK | null>(null);
  const session = ref<SessionData | null>(null);
  const remainingTime = ref(0);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const formattedTime = computed(() => {
    const minutes = Math.floor(remainingTime.value / 60);
    const seconds = remainingTime.value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  let intervalId: number | null = null;

  onMounted(async () => {
    const sdkInstance = new MarketplaceSDK({
      ...config,
      onSessionStart: (data) => {
        session.value = data;
        loading.value = false;
        config.onSessionStart?.(data);
      },
      onSessionWarning: (data) => {
        config.onSessionWarning?.(data);
      },
      onSessionEnd: () => {
        config.onSessionEnd?.();
      },
      onError: (err) => {
        error.value = err.message;
        loading.value = false;
        config.onError?.(err);
      },
    });

    sdk.value = sdkInstance;

    try {
      await sdkInstance.initialize();
      
      // Update remaining time every second
      intervalId = window.setInterval(() => {
        if (sdk.value) {
          remainingTime.value = sdk.value.getRemainingTime();
        }
      }, 1000);
    } catch (err: any) {
      error.value = err.message;
      loading.value = false;
    }
  });

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    sdk.value?.destroy();
  });

  const endSession = () => {
    sdk.value?.endSession();
  };

  const pauseSession = () => {
    sdk.value?.pauseTimer();
  };

  const resumeSession = () => {
    sdk.value?.resumeTimer();
  };

  return {
    session,
    loading,
    error,
    remainingTime,
    formattedTime,
    endSession,
    pauseSession,
    resumeSession,
  };
}
```

```vue
<!-- App.vue -->
<template>
  <div v-if="loading">Loading session...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else>
    <header>
      <h1>My Application</h1>
      <div>Time Remaining: {{ formattedTime }}</div>
      <div>Tokens: {{ session?.tokensAllocated }}</div>
    </header>

    <main>
      <!-- Your app content -->
    </main>

    <footer>
      <button @click="pauseSession">Pause</button>
      <button @click="resumeSession">Resume</button>
      <button @click="endSession">End Session</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useMarketplaceSession } from './composables/useMarketplaceSession';

const {
  session,
  loading,
  error,
  formattedTime,
  endSession,
  pauseSession,
  resumeSession,
} = useMarketplaceSession({
  apiEndpoint: 'https://api.marketplace.com',
  debug: import.meta.env.DEV,
});
</script>
```

---

## Complete Implementation Plan (6 Weeks)

### Week 1: Core SDK Foundation

#### Day 1: Project Setup
**Morning** (4 hours)
- Initialize TypeScript project: `npm create vite@latest marketplace-provider-sdk --template vanilla-ts`
- Configure package.json with library metadata
- Set up Git repository with .gitignore
- Configure ESLint + Prettier
- Set up CI/CD pipeline (GitHub Actions)

**Afternoon** (4 hours)
- Configure tsconfig.json for library mode
- Set up Vite config for dual ESM/UMD builds
- Configure Vitest for unit testing
- Set up test coverage reporting
- Create basic folder structure

**Deliverable**: Repository with build and test infrastructure

#### Day 2: JWT Utilities & Types
**Morning** (4 hours)
- Define TypeScript types (SDKConfig, SessionData, SDKEvents, etc.)
- Implement JWTParser.decode() method
- Implement JWTParser.extractClaim() method
- Implement JWTParser.isExpired() method
- Add base64URL decoding utilities

**Afternoon** (4 hours)
- Write comprehensive unit tests for JWTParser
- Test edge cases (malformed tokens, missing claims)
- Test expired token detection
- Add JSDoc comments
- Code review and cleanup

**Deliverable**: JWT parsing module with 100% test coverage

#### Day 3: HTTP Client & Error Handling
**Morning** (4 hours)
- Implement http.ts with fetch wrapper
- Add retry logic with exponential backoff
- Add request/response interceptors
- Implement timeout handling
- Add request cancellation support

**Afternoon** (4 hours)
- Create custom error classes (SDKError, NetworkError, ValidationError)
- Implement error serialization
- Write unit tests for HTTP client
- Test retry logic and timeout scenarios
- Add request mocking utilities for tests

**Deliverable**: HTTP client with retry logic and error handling

#### Day 4: Session Validator
**Morning** (4 hours)
- Implement SessionValidator.validate() method
- Add JWT Bearer token formatting
- Implement session data mapping from backend response
- Add validation error handling
- Implement default return URL logic

**Afternoon** (4 hours)
- Implement SessionValidator.heartbeat() method
- Add heartbeat error handling (non-fatal)
- Write unit tests for session validation
- Mock Go backend responses
- Test error scenarios (401, 404, 500)

**Deliverable**: Session validation module with backend integration

#### Day 5: Timer Management
**Morning** (4 hours)
- Implement TimerManager class
- Add start/stop/pause/resume methods
- Implement countdown interval logic
- Add warning threshold detection
- Implement time formatting utilities

**Afternoon** (4 hours)
- Add event callbacks for timer events
- Write comprehensive unit tests
- Test timer accuracy and drift
- Test pause/resume functionality
- Add cleanup and disposal logic

**Deliverable**: Timer module with precise countdown logic

### Week 2: SDK Core & UI Components

#### Day 6: Warning Modal UI
**Morning** (4 hours)
- Create WarningModal class (vanilla JS)
- Implement modal HTML structure
- Add inline CSS styles (no external dependencies)
- Implement show/hide animations
- Add customization options (colors, text, etc.)

**Afternoon** (4 hours)
- Add "Extend Session" button handler
- Add "End Now" button handler
- Implement countdown display in modal
- Make modal responsive (mobile-friendly)
- Write unit tests for modal

**Deliverable**: Customizable warning modal component

#### Day 7: Storage Manager & URL Utils
**Morning** (4 hours)
- Implement StorageManager (LocalStorage wrapper)
- Add session persistence logic
- Implement storage quota handling
- Add serialization/deserialization
- Create URL parameter extraction utilities

**Afternoon** (4 hours)
- Implement Logger class with log levels
- Add conditional logging based on debug mode
- Write unit tests for storage manager
- Test localStorage quota scenarios
- Test URL parameter parsing edge cases

**Deliverable**: Storage and utility modules

#### Day 8: Main SDK Class (Part 1)
**Morning** (4 hours)
- Create MarketplaceSDK main class
- Implement constructor and config validation
- Add event registration (on() method)
- Implement JWT extraction from URL
- Add session data storage

**Afternoon** (4 hours)
- Implement initialize() method
- Integrate JWTParser, SessionValidator, TimerManager
- Add session expiry calculation
- Implement autoStart logic
- Add error handling throughout initialization

**Deliverable**: SDK initialization flow working

#### Day 9: Main SDK Class (Part 2)
**Morning** (4 hours)
- Implement startTimer/pauseTimer/resumeTimer methods
- Implement endSession() with redirect
- Integrate warning modal display
- Add session data getters
- Implement destroy() cleanup method

**Afternoon** (4 hours)
- Write integration tests for SDK
- Test full initialization → timer → warning → end flow
- Test error scenarios (no token, invalid token, expired token)
- Test event callbacks
- Add comprehensive JSDoc documentation

**Deliverable**: Complete SDK core with integration tests

#### Day 10: React Integration
**Morning** (4 hours)
- Create useMarketplaceSession React hook
- Implement hook state management (session, loading, error, time)
- Add effect hooks for SDK lifecycle
- Create interval for time updates
- Add cleanup logic

**Afternoon** (4 hours)
- Build React example application
- Create SessionTimer component
- Create SessionControls component
- Test React integration thoroughly
- Write React-specific documentation

**Deliverable**: React integration with example app

### Week 3: Framework Integrations & Advanced Features

#### Day 11: Vue Integration
**Morning** (4 hours)
- Create useMarketplaceSession Vue composable
- Implement reactive refs for session state
- Add onMounted/onUnmounted lifecycle hooks
- Create computed properties for formatted time
- Add TypeScript types for composable

**Afternoon** (4 hours)
- Build Vue 3 example application
- Create SessionTimer.vue component
- Create SessionControls.vue component
- Test Vue integration thoroughly
- Write Vue-specific documentation

**Deliverable**: Vue integration with example app

#### Day 12: Next.js Integration
**Morning** (4 hours)
- Create Next.js integration example
- Handle SSR considerations (window, localStorage)
- Create app router example (app directory)
- Create pages router example (pages directory)
- Add client-side only component wrappers

**Afternoon** (4 hours)
- Test Next.js integration with both routers
- Add middleware integration example
- Create API route handler examples
- Document Next.js-specific gotchas
- Test production build

**Deliverable**: Next.js integration examples

#### Day 13: Multi-Tab Session Synchronization
**Morning** (4 hours)
- Implement BroadcastChannel API for tab communication
- Add localStorage events as fallback
- Create TabSyncManager class
- Implement session state broadcasting
- Add timer synchronization across tabs

**Afternoon** (4 hours)
- Handle "master tab" election logic
- Implement graceful fallback when tabs close
- Test multi-tab scenarios (open, close, navigate)
- Write unit tests for tab sync
- Add integration tests with Playwright

**Deliverable**: Multi-tab session synchronization

#### Day 14: Session Pause/Resume (Visibility API)
**Morning** (4 hours)
- Implement Page Visibility API integration
- Add automatic pause when tab hidden
- Add automatic resume when tab visible
- Implement configurable pause behavior
- Add pause/resume event callbacks

**Afternoon** (4 hours)
- Test visibility change scenarios
- Test pause/resume accuracy
- Add user-initiated pause/resume methods
- Write unit tests for pause/resume
- Update documentation with pause/resume API

**Deliverable**: Automatic pause/resume on tab visibility

#### Day 15: Active Heartbeat System
**Morning** (4 hours)
- Implement periodic heartbeat sending (every 30s)
- Add heartbeat interval configuration
- Implement heartbeat queue for offline scenarios
- Add exponential backoff for failed heartbeats
- Handle heartbeat response (remaining time sync)

**Afternoon** (4 hours)
- Test heartbeat reliability
- Test offline/online transitions
- Implement heartbeat failure threshold
- Add telemetry for heartbeat success rate
- Write integration tests with mock backend

**Deliverable**: Reliable heartbeat system

### Week 4: Webhooks, Provider Dashboard & Advanced Features

#### Day 16: Webhook System Foundation
**Morning** (4 hours)
- Design webhook event types (session.started, session.warning, session.ended, session.extended)
- Create WebhookManager class in SDK
- Implement webhook registration API
- Add webhook signature generation (HMAC-SHA256)
- Create webhook event payload structure

**Afternoon** (4 hours)
- Document Go backend webhook endpoints:
  ```go
  POST /api/v1/providers/{id}/webhooks      // Register webhook
  DELETE /api/v1/providers/{id}/webhooks/{webhook_id}  // Delete
  GET /api/v1/providers/{id}/webhooks       // List webhooks
  ```
- Write webhook verification utilities
- Create webhook testing tools
- Document webhook security best practices

**Deliverable**: Webhook system design and SDK integration

#### Day 17: Webhook Event Broadcasting
**Morning** (4 hours)
- Implement session event detection in SDK
- Add webhook event queueing
- Implement retry logic for failed webhook deliveries
- Add exponential backoff for webhook retries
- Create webhook delivery status tracking

**Afternoon** (4 hours)
- Add webhook payload examples for all event types
- Create webhook test server (for provider testing)
- Write integration tests for webhook delivery
- Document webhook event schemas
- Create webhook debugging guide

**Deliverable**: Complete webhook event system

#### Day 18: Provider Analytics SDK Features
**Morning** (4 hours)
- Add analytics event tracking to SDK
- Implement session metrics collection:
  - Session duration
  - Time to expiration
  - User engagement patterns
  - Error rates
- Create AnalyticsManager class

**Afternoon** (4 hours)
- Add custom event tracking API
- Implement analytics batching (reduce API calls)
- Add privacy-focused analytics (no PII)
- Write analytics integration tests
- Document analytics API for providers

**Deliverable**: Analytics tracking in SDK

#### Day 19: Provider Dashboard Integration
**Morning** (4 hours)
- Create provider dashboard API integration
- Implement provider stats endpoint calls:
  ```typescript
  getSessionStats(providerId: string): Promise<Stats>
  getRevenueStats(providerId: string): Promise<Revenue>
  getActiveSessionCount(providerId: string): Promise<number>
  ```
- Add dashboard data caching
- Implement real-time updates via WebSocket

**Afternoon** (4 hours)
- Create provider dashboard React components
- Build provider metrics visualization
- Add session history table component
- Test dashboard integration
- Document provider dashboard API

**Deliverable**: Provider dashboard SDK integration

#### Day 20: Session Extension Feature
**Morning** (4 hours)
- Implement session extension API in SDK
- Add "Extend Session" button handler
- Create extension request to Go backend:
  ```typescript
  POST /api/v1/sessions/{id}/extend
  {
    "additional_seconds": 3600,
    "tokens_to_deduct": 100
  }
  ```
- Update timer with extended time
- Add extension confirmation UI

**Afternoon** (4 hours)
- Test session extension flow
- Add extension limits (max extensions per session)
- Implement extension pricing logic
- Write integration tests for extension
- Document extension API

**Deliverable**: Session extension feature

### Week 5: Testing, Documentation & Production Readiness

#### Day 21: Comprehensive E2E Testing
**Morning** (4 hours)
- Set up Playwright test environment
- Write E2E test for complete session lifecycle
- Test session expiration flow
- Test warning modal interaction
- Test session extension flow

**Afternoon** (4 hours)
- Write E2E tests for error scenarios
- Test multi-tab synchronization (E2E)
- Test network failure recovery
- Test different browsers (Chrome, Firefox, Safari)
- Add visual regression testing

**Deliverable**: Complete E2E test suite

#### Day 22: Performance Testing & Optimization
**Morning** (4 hours)
- Run bundle size analysis
- Optimize imports (tree-shaking)
- Minimize external dependencies
- Test bundle size across builds (<10KB goal)
- Profile runtime performance

**Afternoon** (4 hours)
- Optimize timer performance (reduce CPU usage)
- Optimize storage operations
- Add lazy loading for UI components
- Test memory leaks (Chrome DevTools)
- Benchmark API call performance

**Deliverable**: Optimized SDK bundle and performance

#### Day 23: Security Hardening
**Morning** (4 hours)
- Implement JWT expiration validation
- Add nonce (JTI) verification
- Implement rate limiting for API calls
- Add request signing for webhooks
- Review XSS vulnerabilities

**Afternoon** (4 hours)
- Add Content Security Policy recommendations
- Implement HTTPS-only enforcement
- Add token storage security (no localStorage for sensitive data)
- Write security best practices guide
- Run security audit (npm audit)

**Deliverable**: Security-hardened SDK

#### Day 24: Error Recovery & Resilience
**Morning** (4 hours)
- Implement automatic retry for transient failures
- Add circuit breaker pattern for API calls
- Implement offline queue for events
- Add exponential backoff everywhere
- Create error recovery guide

**Afternoon** (4 hours)
- Test network interruption scenarios
- Test backend downtime scenarios
- Test browser crash recovery
- Add session state recovery from storage
- Write resilience testing guide

**Deliverable**: Resilient SDK with error recovery

#### Day 25: Complete Documentation
**Morning** (4 hours)
- Write comprehensive README.md
- Create quick start guide (5-minute setup)
- Write complete API reference
- Document all TypeScript types
- Add migration guide (future versions)

**Afternoon** (4 hours)
- Create integration guides for all frameworks
- Write troubleshooting guide
- Document common issues and solutions
- Create FAQ document
- Write Go backend integration guide

**Deliverable**: Complete documentation suite

### Week 6: Publishing, Monitoring & Support

#### Day 26: NPM Package Preparation
**Morning** (4 hours)
- Finalize package.json metadata
- Add keywords, description, repository links
- Create LICENSE file (MIT)
- Add CHANGELOG.md
- Configure .npmignore properly

**Afternoon** (4 hours)
- Test npm pack locally
- Test installation in fresh projects
- Verify type definitions are exported correctly
- Test both ESM and UMD builds
- Verify peer dependencies

**Deliverable**: NPM-ready package

#### Day 27: Publishing & Distribution
**Morning** (4 hours)
- Publish v1.0.0 to NPM registry
- Verify jsDelivr CDN distribution
- Test CDN URLs in browser
- Create GitHub release with notes
- Tag release in Git (v1.0.0)

**Afternoon** (4 hours)
- Set up npm version scripts
- Configure semantic versioning
- Create release automation (GitHub Actions)
- Test package installation from NPM
- Verify type definitions on DefinitelyTyped

**Deliverable**: Published package on NPM and CDN

#### Day 28: Monitoring & Telemetry Setup
**Morning** (4 hours)
- Add optional telemetry to SDK
- Implement error tracking (opt-in)
- Add performance metrics collection
- Create telemetry dashboard (for SDK maintainers)
- Add telemetry opt-out documentation

**Afternoon** (4 hours)
- Set up NPM download monitoring
- Configure GitHub issue templates
- Set up automated dependency updates (Dependabot)
- Create package health monitoring
- Add usage analytics (anonymous)

**Deliverable**: Monitoring and telemetry infrastructure

#### Day 29: Provider Onboarding & Support
**Morning** (4 hours)
- Create provider onboarding checklist
- Build interactive setup wizard (web-based)
- Create video tutorial (screen recording)
- Write provider FAQ
- Create Discord/Slack community channel

**Afternoon** (4 hours)
- Set up GitHub Discussions for Q&A
- Create issue triage workflow
- Write contribution guidelines
- Create pull request template
- Document support SLAs

**Deliverable**: Provider support infrastructure

#### Day 30: Launch Preparation & Marketing
**Morning** (4 hours)
- Create launch blog post
- Prepare demo videos
- Create provider case studies
- Design marketing materials
- Schedule social media posts

**Afternoon** (4 hours)
- Contact first 5 pilot providers
- Schedule onboarding calls
- Prepare launch announcement
- Update marketplace website with SDK docs
- Final review and testing

**Deliverable**: Launch-ready SDK with marketing materials

---

## Post-Launch: Ongoing Maintenance (Weeks 7+)

### Weekly Tasks
- Monitor error rates and performance metrics
- Triage and respond to GitHub issues (within 24 hours)
- Review and merge pull requests
- Update documentation based on feedback
- Release patch versions for bug fixes

### Monthly Tasks
- Review feature requests and prioritize
- Plan minor version releases
- Update dependencies (security patches)
- Review analytics and usage patterns
- Provider satisfaction surveys

### Quarterly Tasks
- Major version planning (if breaking changes needed)
- Performance optimization review
- Security audit
- Documentation refresh
- Community growth initiatives

---

## Go Backend Implementation Requirements

The SDK requires these Go backend endpoints to be implemented:

### Core Session Endpoints (Required for MVP)
```go
POST   /api/v1/sessions                      // Create session (marketplace calls)
POST   /api/v1/sessions/validate             // Validate JWT (SDK calls)
POST   /api/v1/sessions/{id}/complete        // Complete session (marketplace calls)
POST   /api/v1/sessions/{id}/heartbeat       // Heartbeat (SDK calls)
GET    /api/v1/keys/public                   // Get public key for JWT verification
```

### Provider Management Endpoints (Week 4+)
```go
POST   /api/v1/providers                     // Register new provider
GET    /api/v1/providers/{id}                // Get provider details
PATCH  /api/v1/providers/{id}                // Update provider settings
GET    /api/v1/providers/{id}/stats          // Get provider statistics
GET    /api/v1/providers/{id}/sessions       // List provider sessions
```

### Webhook Endpoints (Week 4)
```go
POST   /api/v1/providers/{id}/webhooks       // Register webhook URL
GET    /api/v1/providers/{id}/webhooks       // List registered webhooks
DELETE /api/v1/providers/{id}/webhooks/{wid} // Delete webhook
POST   /api/v1/webhooks/test                 // Test webhook delivery
```

### Session Extension Endpoints (Week 4)
```go
POST   /api/v1/sessions/{id}/extend          // Extend session duration
GET    /api/v1/sessions/{id}/extensions      // Get extension history
```

### Analytics Endpoints (Week 5+)
```go
GET    /api/v1/providers/{id}/analytics/sessions     // Session analytics
GET    /api/v1/providers/{id}/analytics/revenue      // Revenue analytics
GET    /api/v1/providers/{id}/analytics/users        // User analytics
```

### Backend Database Schema Extensions

```sql
-- Webhook configurations
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,  -- Array of event types to subscribe to
    secret TEXT NOT NULL,     -- HMAC secret for signature
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery attempts
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    attempt_count INTEGER DEFAULT 1,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session extensions
CREATE TABLE session_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    additional_seconds INTEGER NOT NULL,
    tokens_deducted INTEGER NOT NULL,
    extended_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heartbeat logs (optional, for debugging)
CREATE TABLE session_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Provider analytics (materialized view updated periodically)
CREATE MATERIALIZED VIEW provider_analytics AS
SELECT 
    provider_id,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as session_count,
    SUM(tokens_allocated) as tokens_consumed,
    AVG(duration_limit_seconds) as avg_session_duration,
    COUNT(DISTINCT user_id) as unique_users
FROM sessions
GROUP BY provider_id, DATE_TRUNC('day', created_at);
```

---

## Success Criteria

### Technical Metrics
- ✅ Bundle size < 10KB gzipped
- ✅ 95%+ test coverage
- ✅ < 30 min integration time for providers
- ✅ Zero dependencies (self-contained)
- ✅ TypeScript definitions included
- ✅ Framework-agnostic core

### Documentation Metrics
- ✅ Quick start guide (< 5 min read)
- ✅ Complete API reference
- ✅ Integration examples for 3+ frameworks
- ✅ Troubleshooting guide
- ✅ Go backend requirements documented

### Developer Experience
- ✅ Works with vanilla JS, React, Vue, Next.js
- ✅ Available via NPM and CDN
- ✅ Clear error messages
- ✅ Debug mode for development
- ✅ Type-safe with TypeScript

---

## Maintenance & Support Plan

### Version Strategy
- **Patch releases** (1.0.x): Bug fixes, no breaking changes
- **Minor releases** (1.x.0): New features, backwards compatible
- **Major releases** (x.0.0): Breaking changes, migration guide required

### Support Channels
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Discord/Slack for community support
- Email support for enterprise customers

### Monitoring
- NPM download metrics
- CDN usage statistics
- GitHub stars and forks
- Integration success rates (via telemetry)

---

**End of Technical Documentation**

This document provides complete implementation guidance for the Provider SDK. The companion Executive Summary document covers business objectives and high-level architecture for stakeholders.