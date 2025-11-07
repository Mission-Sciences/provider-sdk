# Marketplace Provider SDK

> JWT-based session management for application providers in the General Wisdom marketplace ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [Vanilla JavaScript](#vanilla-javascript)
  - [React](#react)
  - [TypeScript](#typescript)
- [API Reference](#api-reference)
- [Development](#development)
- [Testing](#testing)
- [Examples](#examples)
- [License](#license)

## 🎯 Overview

The Marketplace Provider SDK enables third-party applications to integrate with the General Wisdom marketplace platform through JWT-based session management. The SDK handles:

### Phase 1 (Core Features)
- **JWT Validation**: RS256 signature verification using JWKS
- **Session Timers**: Client-side countdown with expiration warnings
- **Event Handling**: Lifecycle hooks for session start, warning, and end
- **UI Components**: Pre-built warning modals with customizable styling

### Phase 2 (Advanced Features) ✨
- **Heartbeat System**: Periodic server communication and time synchronization
- **Multi-Tab Coordination**: Automatic synchronization across browser tabs
- **Session Extension**: Self-service session renewal with token management
- **Early Completion**: End sessions early with automatic refund calculation
- **Visibility API**: Battery-friendly auto-pause when tab hidden
- **Backend Validation**: Optional server-side JWT validation

### Architecture

```
Marketplace PWA → Go Backend (creates JWT) → Provider App (validates JWT via SDK)
```

## ✨ Features

### Core Features (Phase 1)
- ✅ **Zero Dependencies**: Self-contained with minimal external deps (`jwks-rsa`, `jsonwebtoken`)
- ✅ **Framework Agnostic**: Works with vanilla JS, React, Vue, and more
- ✅ **TypeScript First**: Full type definitions included
- ✅ **Lightweight**: < 10KB gzipped (8.14 KB in Phase 2)
- ✅ **Secure**: RS256 JWT verification with JWKS
- ✅ **Customizable**: Flexible styling and event handling

### Advanced Features (Phase 2) ✨
- ❤️ **Heartbeat System**: Automatic server sync every 30s (configurable)
- 🔄 **Multi-Tab Sync**: Master tab election with BroadcastChannel API
- ⏰ **Session Extension**: Self-service renewal via backend API
- ✅ **Early Completion**: End sessions early with refund calculation
- 👁️ **Visibility API**: Auto-pause when tab hidden (battery-friendly)
- 🔐 **Backend Validation**: Alternative to JWKS for sensitive apps
- 🎯 **React-First**: Comprehensive React hook with all features

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Test Keys (Development Only)

```bash
npm run generate-keys
```

This creates a 2048-bit RSA key pair in the `keys/` directory.

### 3. Start Test Server

**Phase 1 (Basic Features):**
```bash
npm run test-server
```

**Phase 2 (All Features + Backend Mocks):**
```bash
npm run test-server-p2
```

This serves the test app, JWKS endpoint, and Phase 2 backend mocks at `http://localhost:3000`

### 4. Generate Test JWT

```bash
npm run generate-jwt 60  # 60 minutes duration
```

Copy the JWT token and use it in your test URL:
```
http://localhost:3000?gwSession=<YOUR_JWT_TOKEN>
```

### 5. Run Example

```bash
# Build SDK first
npm run build

# Open vanilla JS example
open examples/vanilla-js/index.html
```

## 📦 Installation

### NPM (Production)

```bash
npm install @marketplace/provider-sdk
```

### CDN (UMD Build)

```html
<script src="https://cdn.jsdelivr.net/npm/@marketplace/provider-sdk@latest/dist/marketplace-sdk.umd.js"></script>
```

## 💻 Usage

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { MarketplaceSDK } from '@marketplace/provider-sdk';

    // Initialize SDK
    const sdk = new MarketplaceSDK({
      jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json',
      applicationId: 'your-app-id',
      debug: true,
    });

    // Register event handlers
    sdk.on('onSessionStart', (data) => {
      console.log('Session started:', data);
    });

    sdk.on('onSessionWarning', ({ remainingSeconds }) => {
      console.warn('Session expiring in', remainingSeconds, 'seconds');
    });

    sdk.on('onSessionEnd', () => {
      console.log('Session ended');
    });

    sdk.on('onError', (error) => {
      console.error('SDK error:', error);
    });

    // Initialize session
    await sdk.initialize();

    // Update timer display
    setInterval(() => {
      document.getElementById('timer').textContent = sdk.getFormattedTime();
    }, 1000);
  </script>
</head>
<body>
  <div id="timer">--:--</div>
  <button onclick="sdk.pauseTimer()">Pause</button>
  <button onclick="sdk.resumeTimer()">Resume</button>
  <button onclick="sdk.endSession()">End Session</button>
</body>
</html>
```

### React (First-Class Citizen)

**Basic Usage (Phase 1):**
```tsx
import { useMarketplaceSession } from '@marketplace/provider-sdk/react';

function App() {
  const {
    session,
    loading,
    error,
    formattedTime,
    pauseTimer,
    resumeTimer,
    endSession,
  } = useMarketplaceSession({
    applicationId: 'your-app-id',
  });

  if (loading) return <div>Loading session...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Session Dashboard</h1>
      <p>Time remaining: {formattedTime}</p>
      <button onClick={pauseTimer}>Pause</button>
      <button onClick={resumeTimer}>Resume</button>
      <button onClick={endSession}>End Session</button>
    </div>
  );
}
```

**Advanced Usage (Phase 2 - All Features):**
```tsx
import { useMarketplaceSession } from '@marketplace/provider-sdk/react';

function AdvancedApp() {
  const {
    session,
    loading,
    error,
    formattedTime,
    isTimerRunning,
    pauseTimer,
    resumeTimer,
    endSession,
    extendSession,        // ⏰ Phase 2: Extend session
    completeSession,      // ✅ Phase 2: Complete early
    isHeartbeatEnabled,   // ❤️ Phase 2: Heartbeat status
    isTabSyncEnabled,     // 🔄 Phase 2: Tab sync status
  } = useMarketplaceSession({
    apiEndpoint: 'https://api.generalwisdom.com',
    applicationId: 'your-app-id',

    // Phase 2 Features
    enableHeartbeat: true,           // ❤️ Send heartbeats every 30s
    heartbeatIntervalSeconds: 30,    // Configurable interval
    enableTabSync: true,              // 🔄 Sync across tabs
    pauseOnHidden: true,              // 👁️ Auto-pause when hidden

    debug: true,
  });

  if (loading) return <div>Loading session...</div>;
  if (error) return <div>Error: {error}</div>;

  const handleExtend = async () => {
    try {
      await extendSession(15); // Extend by 15 minutes
      alert('Session extended!');
    } catch (error) {
      alert('Extension failed');
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete session early?')) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const actualMinutes = Math.ceil((now - session.startTime) / 60);
      await completeSession(actualMinutes);
    } catch (error) {
      alert('Completion failed');
    }
  };

  return (
    <div>
      <h1>Session Dashboard</h1>
      <div>
        Time: {formattedTime}
        {isHeartbeatEnabled && <span> ❤️</span>}
        {isTabSyncEnabled && <span> 🔄</span>}
      </div>
      <button onClick={pauseTimer}>Pause</button>
      <button onClick={resumeTimer}>Resume</button>
      <button onClick={handleExtend}>Extend +15min</button>
      <button onClick={handleComplete}>Complete Early</button>
      <button onClick={endSession}>End Session</button>
    </div>
  );
}
```

### TypeScript

```typescript
import { MarketplaceSDK, SessionData, SDKConfig } from '@marketplace/provider-sdk';

const config: SDKConfig = {
  jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json',
  applicationId: 'your-app-id',
  debug: true,
  autoStart: true,
  warningThresholdSeconds: 300, // 5 minutes
};

const sdk = new MarketplaceSDK(config);

sdk.on('onSessionStart', (data: SessionData) => {
  console.log('Session:', data.sessionId);
  console.log('User:', data.userId);
  console.log('Expires:', new Date(data.exp * 1000));
});

await sdk.initialize();
```

## 📚 API Reference

### `MarketplaceSDK`

Main SDK class for session management.

#### Constructor

```typescript
new MarketplaceSDK(config: SDKConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Phase 1 Options** | | | |
| `jwksUri` | `string` | `https://api.generalwisdom.com/.well-known/jwks.json` | JWKS endpoint URL |
| `applicationId` | `string` | `''` | Your application ID (optional but recommended) |
| `debug` | `boolean` | `false` | Enable debug logging |
| `autoStart` | `boolean` | `true` | Auto-start timer after initialization |
| `warningThresholdSeconds` | `number` | `300` | Show warning when seconds remaining <= threshold |
| `customStyles` | `Partial<ModalStyles>` | `{}` | Custom styles for warning modal |
| **Phase 2 Options** | | | |
| `apiEndpoint` | `string` | `http://localhost:3000` | Backend API URL |
| `enableHeartbeat` | `boolean` | `false` | Enable heartbeat system |
| `heartbeatIntervalSeconds` | `number` | `30` | Heartbeat frequency in seconds |
| `enableTabSync` | `boolean` | `false` | Enable multi-tab synchronization |
| `pauseOnHidden` | `boolean` | `false` | Auto-pause when tab is hidden |
| `useBackendValidation` | `boolean` | `false` | Use backend validation instead of JWKS |

#### Methods

**`initialize(): Promise<SessionData>`**

Initialize SDK and validate JWT. Must be called before other methods.

```typescript
const sessionData = await sdk.initialize();
console.log('Session:', sessionData.sessionId);
```

**`on<K extends keyof SDKEvents>(event: K, handler: SDKEvents[K]): void`**

Register event handler.

```typescript
sdk.on('onSessionStart', (data) => { /* ... */ });
sdk.on('onSessionWarning', ({ remainingSeconds }) => { /* ... */ });
sdk.on('onSessionEnd', () => { /* ... */ });
sdk.on('onError', (error) => { /* ... */ });
```

**`startTimer(): void`**

Manually start the countdown timer.

**`pauseTimer(): void`**

Pause the countdown timer.

**`resumeTimer(): void`**

Resume the paused timer.

**`endSession(): void`**

End the session and trigger cleanup.

**`getRemainingTime(): number`**

Get remaining seconds.

**`getFormattedTime(): string`**

Get formatted time as `MM:SS`.

**`getFormattedTimeWithHours(): string`**

Get formatted time as `HH:MM:SS`.

**`getSessionData(): SessionData | null`**

Get current session data.

**`destroy(): void`**

Cleanup and destroy SDK instance.

#### Phase 2 Methods

**`extendSession(additionalMinutes: number): Promise<void>`**

Extend the current session by specified minutes. Charges additional tokens via backend API.

```typescript
// Extend session by 15 minutes
await sdk.extendSession(15);

// Extend by 1 hour
await sdk.extendSession(60);
```

**`completeSession(actualUsageMinutes?: number): Promise<void>`**

Complete the session early and trigger refund calculation. Returns unused tokens.

```typescript
// Complete with calculated actual usage
const now = Math.floor(Date.now() / 1000);
const actualUsage = Math.ceil((now - session.startTime) / 60);
await sdk.completeSession(actualUsage);

// Complete without usage calculation (SDK calculates)
await sdk.completeSession();
```

### `SessionData`

```typescript
interface SessionData {
  sessionId: string;          // Unique session UUID
  applicationId: string;      // Application ID
  userId: string;             // User ID
  orgId: string;              // Organization ID
  startTime: number;          // Unix timestamp (seconds)
  durationMinutes: number;    // Session duration
  iat: number;                // Issued at (Unix seconds)
  exp: number;                // Expires at (Unix seconds)
  iss: string;                // Issuer
  sub: string;                // Subject (user ID)
}
```

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Generate test keys
npm run generate-keys

# Start mock JWKS server
node scripts/mock-jwks-server.js
```

### Build

```bash
# Build library (ESM + UMD)
npm run build

# Watch mode
npm run dev
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📖 Examples

### Generate Test JWT

```bash
# Generate 60-minute session
npm run generate-jwt 60

# Generate 120-minute session
npm run generate-jwt 120
```

### Test with Vanilla JS

1. Build the SDK: `npm run build`
2. Generate JWT: `npm run generate-jwt 60`
3. Start mock JWKS server: `node scripts/mock-jwks-server.js`
4. Open `examples/vanilla-js/index.html` in browser
5. Append JWT to URL: `?gwSession=<YOUR_JWT>`

### Test with React

```bash
cd examples/react
npm install
npm run dev
```

Open browser and append JWT to URL.

## 📖 Phase 2 Documentation

For comprehensive Phase 2 documentation, see:

- **[PHASE_2_COMPLETE.md](./PHASE_2_COMPLETE.md)** - Complete Phase 2 feature guide
  - Testing guide with step-by-step instructions
  - Configuration reference with recommended settings
  - API reference for all Phase 2 endpoints
  - Migration guide from Phase 1
  - Bundle size analysis
  - React hook documentation

### Phase 2 Testing

**Start Phase 2 Test Server:**
```bash
npm run test-server-p2
```

**Generate Short Test JWT:**
```bash
npm run generate-jwt 5  # 5 minutes for quick testing
```

**Open Test App:**
```
http://localhost:3000/provider?gwSession=<YOUR_JWT>
```

**What to Test:**
- ❤️ Heartbeat logs in console (every 30s)
- 🔄 Multi-tab sync (open in 2 tabs, pause in one)
- 👁️ Visibility API (minimize tab, timer pauses)
- ⏰ Session extension (click "Extend Session" button)
- ✅ Early completion (click "Complete Early" button)

### Phase 2 Recommended Config

**Production (Full Features):**
```typescript
useMarketplaceSession({
  apiEndpoint: 'https://api.generalwisdom.com',
  applicationId: 'your-app-id',
  enableHeartbeat: true,           // ❤️ Track active usage
  heartbeatIntervalSeconds: 30,    // Every 30 seconds
  enableTabSync: true,              // 🔄 Handle multiple tabs
  pauseOnHidden: true,              // 👁️ Battery-friendly
  warningThresholdSeconds: 300,    // Warn at 5 minutes
  debug: process.env.NODE_ENV === 'development',
})
```

**Minimal (Phase 1 Only):**
```typescript
useMarketplaceSession({
  applicationId: 'your-app-id',
  // All Phase 2 features disabled by default
})
```

## 🔐 Security

### JWT Validation

The SDK performs comprehensive JWT validation:

1. **Signature Verification**: RS256 using JWKS public key
2. **Expiration Check**: Validates `exp` claim
3. **Issuer Validation**: Verifies `iss` claim
4. **Application ID Check**: Optional validation of `applicationId`
5. **Required Claims**: Ensures all required claims present

### Best Practices

- ✅ Always use HTTPS in production
- ✅ Validate JWT on every request
- ✅ Set appropriate warning thresholds
- ✅ Handle session expiration gracefully
- ✅ Never log JWT tokens
- ❌ Don't store JWTs in localStorage (XSS risk)
- ❌ Don't share JWTs between users

## 📝 License

MIT © General Wisdom

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/gw-sdk/issues)
- **Email**: support@generalwisdom.com
- **Docs**: [https://docs.generalwisdom.com](https://docs.generalwisdom.com)

---

**Made with ❤️ by the General Wisdom team**
