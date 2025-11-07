# Phase 2 Implementation Plan

**Status**: 📋 Planning
**Estimated Timeline**: 4-6 days
**Prerequisites**: Go backend API ready with heartbeat endpoints

---

## 🎯 Phase 2 Goals

Extend the MVP SDK with active session management features:
- Backend heartbeat system
- Session validation endpoint integration
- Session completion with token reconciliation
- Multi-tab synchronization
- Enhanced framework support

---

## 📋 Implementation Tasks

### Task 1: Backend Integration (1-2 days)

#### Heartbeat System

**New Class**: `HeartbeatManager`

```typescript
// src/core/HeartbeatManager.ts
export class HeartbeatManager {
  private intervalId: number | null = null;
  private heartbeatInterval: number = 30000; // 30 seconds
  private failureCount: number = 0;
  private maxFailures: number = 3;

  constructor(
    private sessionId: string,
    private apiEndpoint: string,
    private token: string,
    private logger: Logger
  ) {}

  start(): void {
    // Send heartbeat every 30s
    this.intervalId = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiEndpoint}/sessions/${this.sessionId}/heartbeat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: Date.now(),
            active: true,
          }),
        }
      );

      if (!response.ok) {
        this.failureCount++;
        if (this.failureCount >= this.maxFailures) {
          // Trigger error event
        }
      } else {
        this.failureCount = 0;
        const data = await response.json();
        // Sync remaining time with server
      }
    } catch (error) {
      this.failureCount++;
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

**Integration Points:**
- Add `enableHeartbeat` option to `SDKConfig`
- Start heartbeat after successful initialization
- Handle heartbeat failures gracefully
- Sync timer with server response

**API Endpoints Required:**
```
POST /sessions/{id}/heartbeat
Body: { timestamp: number, active: boolean }
Response: { remaining_seconds: number, status: string }
```

#### Session Validation Endpoint

**Enhancement**: `JWKSValidator.validateWithBackend()`

```typescript
async validateWithBackend(
  sessionId: string,
  token: string
): Promise<SessionData> {
  const response = await fetch(
    `${this.apiEndpoint}/sessions/validate`,
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
    throw new SDKError('Session validation failed', 'VALIDATION_FAILED');
  }

  return await response.json();
}
```

**API Endpoints Required:**
```
POST /sessions/validate
Body: { session_jwt: string }
Response: { valid: boolean, session: SessionData, remaining_seconds: number }
```

#### Session Completion

**New Method**: `MarketplaceSDK.completeSession()`

```typescript
async completeSession(actualUsageMinutes?: number): Promise<void> {
  if (!this.sessionData || !this.jwtToken) {
    throw new SDKError('No active session', 'NO_SESSION');
  }

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
    throw new SDKError('Session completion failed', 'COMPLETION_FAILED');
  }

  const data = await response.json();
  // { tokens_refunded: number, final_cost: number }

  this.endSession();
}
```

**API Endpoints Required:**
```
POST /sessions/{id}/complete
Body: { actual_usage_minutes: number, metadata: object }
Response: { tokens_refunded: number, final_cost: number }
```

---

### Task 2: Multi-Tab Synchronization (1 day)

**New Class**: `TabSyncManager`

```typescript
// src/core/TabSyncManager.ts
export class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private storageKey = 'gw_session_sync';

  constructor(
    private sessionId: string,
    private onSync: (data: any) => void
  ) {
    // Use BroadcastChannel if available
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('gw-session');
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } else {
      // Fallback to localStorage events
      window.addEventListener('storage', this.handleStorage);
    }
  }

  broadcast(message: any): void {
    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      // Fallback: use localStorage
      localStorage.setItem(this.storageKey, JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }));
    }
  }

  private handleMessage(data: any): void {
    if (data.sessionId === this.sessionId) {
      this.onSync(data);
    }
  }

  private handleStorage = (event: StorageEvent): void => {
    if (event.key === this.storageKey && event.newValue) {
      const data = JSON.parse(event.newValue);
      this.handleMessage(data);
    }
  };

  destroy(): void {
    if (this.channel) {
      this.channel.close();
    } else {
      window.removeEventListener('storage', this.handleStorage);
    }
  }
}
```

**Features:**
- Sync timer state across tabs
- Coordinate pause/resume
- Single "master" tab for heartbeats
- Handle tab close gracefully

---

### Task 3: Visibility API Integration (0.5 days)

**Enhancement**: `MarketplaceSDK.initializeVisibilityHandling()`

```typescript
private initializeVisibilityHandling(): void {
  if (!this.config.pauseOnHidden) {
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      this.logger.log('Tab hidden, pausing timer');
      this.pauseTimer();
    } else {
      this.logger.log('Tab visible, resuming timer');
      this.resumeTimer();
    }
  });
}
```

**New Config Option:**
```typescript
interface SDKConfig {
  // ... existing options
  pauseOnHidden?: boolean;  // Default: false
}
```

---

### Task 4: Session Extension UI (0.5 days)

**Enhancement**: `MarketplaceSDK.extendSession()`

```typescript
async extendSession(additionalMinutes: number): Promise<void> {
  if (!this.sessionData || !this.jwtToken) {
    throw new SDKError('No active session', 'NO_SESSION');
  }

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
    throw new SDKError('Session extension failed', 'EXTENSION_FAILED');
  }

  const data = await response.json();
  // { new_expires_at: timestamp, additional_cost: number }

  // Update session data
  this.sessionData.exp = data.new_expires_at;

  // Update timer
  const remainingSeconds = data.new_expires_at - Math.floor(Date.now() / 1000);
  this.timer?.updateRemainingTime(remainingSeconds);

  this.logger.info('Session extended by', additionalMinutes, 'minutes');
}
```

**Update WarningModal:**
```typescript
show(options: {
  remainingSeconds: number;
  onExtend?: (minutes: number) => void;  // Enhanced
  onEnd?: () => void;
}): void {
  // Add extension options: 15, 30, 60 minutes
}
```

---

### Task 5: Framework Extensions (1 day)

#### Vue Composable

```typescript
// examples/vue/useMarketplaceSession.ts
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

  onMounted(async () => {
    // ... implementation
  });

  onUnmounted(() => {
    sdk.value?.destroy();
  });

  return {
    session,
    loading,
    error,
    remainingTime,
    formattedTime,
    endSession: () => sdk.value?.endSession(),
    pauseTimer: () => sdk.value?.pauseTimer(),
    resumeTimer: () => sdk.value?.resumeTimer(),
  };
}
```

#### Next.js Example

```typescript
// examples/nextjs/app/session/page.tsx
'use client';

import { useMarketplaceSession } from '@marketplace/provider-sdk/react';

export default function SessionPage() {
  const { session, formattedTime, endSession } = useMarketplaceSession({
    jwksUri: process.env.NEXT_PUBLIC_JWKS_URI!,
    applicationId: process.env.NEXT_PUBLIC_APP_ID!,
  });

  // ... implementation
}
```

---

### Task 6: Testing & Documentation (1-2 days)

#### Unit Tests

```typescript
// tests/unit/heartbeat-manager.test.ts
describe('HeartbeatManager', () => {
  it('should send heartbeat every 30 seconds', async () => {
    // ... test
  });

  it('should handle heartbeat failures', async () => {
    // ... test
  });

  it('should sync remaining time with server', async () => {
    // ... test
  });
});

// tests/unit/tab-sync-manager.test.ts
describe('TabSyncManager', () => {
  it('should broadcast messages to other tabs', () => {
    // ... test
  });

  it('should handle localStorage fallback', () => {
    // ... test
  });
});
```

#### Integration Tests

```typescript
// tests/integration/phase2-features.test.ts
describe('Phase 2 Features', () => {
  it('should complete full heartbeat flow', async () => {
    // ... test
  });

  it('should extend session successfully', async () => {
    // ... test
  });

  it('should sync across multiple tabs', async () => {
    // ... test with multiple browser contexts
  });
});
```

#### Documentation Updates

- Add Phase 2 features to README
- Create migration guide from Phase 1
- Document new API endpoints
- Add troubleshooting for heartbeat issues

---

## 🎯 Success Criteria

### Functional

- ✅ Heartbeat system works reliably
- ✅ Session validation endpoint integration
- ✅ Session completion with reconciliation
- ✅ Multi-tab synchronization working
- ✅ Visibility API pause/resume
- ✅ Session extension UI

### Performance

- ✅ Heartbeat overhead < 100ms
- ✅ Multi-tab sync latency < 50ms
- ✅ Bundle size still < 10KB gzipped (target: ~8KB)

### Quality

- ✅ 80%+ test coverage
- ✅ All integration tests passing
- ✅ E2E tests with backend
- ✅ Documentation updated

---

## 📊 Estimated Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| Heartbeat System | 1 day | Go backend ready |
| Session Validation | 0.5 days | Backend endpoints |
| Session Completion | 0.5 days | Backend endpoints |
| Multi-Tab Sync | 1 day | None |
| Visibility API | 0.5 days | None |
| Session Extension | 0.5 days | Backend endpoints |
| Framework Extensions | 1 day | None |
| Testing & Docs | 1-2 days | All above complete |

**Total**: 4-6 days

**Critical Path**: Backend endpoints → Heartbeat → Testing

---

## 🚀 Rollout Strategy

### Phase 2A: Core Features (Days 1-3)
- Heartbeat system
- Session validation
- Session completion
- Internal testing

### Phase 2B: Advanced Features (Days 4-5)
- Multi-tab sync
- Visibility API
- Session extension
- Framework extensions

### Phase 2C: Polish & Release (Day 6)
- Testing
- Documentation
- NPM publishing
- Production deployment

---

## 📝 Notes

- Heartbeat feature is opt-in via `enableHeartbeat` config
- Multi-tab sync uses BroadcastChannel with localStorage fallback
- Session extension requires backend approval (user has sufficient tokens)
- All Phase 2 features are backward compatible with Phase 1

---

**Next**: Coordinate with backend team on endpoint availability
