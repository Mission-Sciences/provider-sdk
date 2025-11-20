# Lifecycle Hooks Implementation - Remaining Steps

## Completed ✅
- Added hook type definitions to `src/types/index.ts`
- Exported hook types from `src/index.ts`

## Remaining Implementation

### 1. Update MarketplaceSDK Constructor
Add hook defaults to config initialization:
```typescript
constructor(config: SDKConfig) {
  this.config = {
    // ... existing defaults
    hooks: config.hooks ?? {},
    hookTimeoutMs: config.hookTimeoutMs ?? 5000,
  };
}
```

Add private field for tracking end reason:
```typescript
private endReason: 'expired' | 'manual' | 'error' = 'manual';
```

### 2. Add Hook Execution Utility Method
```typescript
private async executeHook<T>(
  hookName: string,
  hook: ((context: T) => Promise<void> | void) | undefined,
  context: T
): Promise<void> {
  if (!hook) return;

  this.logger.log(`Calling ${hookName} hook`);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new SDKError(`${hookName} hook timeout`, 'HOOK_TIMEOUT')),
      this.config.hookTimeoutMs
    )
  );

  try {
    await Promise.race([
      Promise.resolve(hook(context)),
      timeout
    ]);
    this.logger.log(`${hookName} hook completed`);
  } catch (error) {
    this.logger.error(`${hookName} hook failed:`, error);
    throw new SDKError(
      `${hookName} hook failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'HOOK_ERROR'
    );
  }
}
```

### 3. Call onSessionStart Hook in initialize()
After JWT validation, before timer starts:
```typescript
// Call onSessionStart hook if provided
const startContext: SessionStartContext = {
  sessionId: this.sessionData.sessionId,
  userId: this.sessionData.userId,
  email: verifiedClaims.email, // Extract if available
  orgId: this.sessionData.orgId,
  applicationId: this.sessionData.applicationId,
  durationMinutes: this.sessionData.durationMinutes,
  expiresAt: this.sessionData.exp,
  jwt: this.jwtToken!,
};

await this.executeHook('onSessionStart', this.config.hooks?.onSessionStart, startContext);
```

### 4. Make endSession Async and Call onSessionEnd Hook
```typescript
async endSession(): Promise<void> {
  this.logger.info('Ending session...');

  // Build end context
  const endContext: SessionEndContext = {
    sessionId: this.sessionData?.sessionId || '',
    userId: this.sessionData?.userId || '',
    reason: this.endReason,
    actualDurationMinutes: this.calculateActualDuration(),
  };

  // Call onSessionEnd hook if provided (lenient - errors logged but don't block)
  if (this.config.hooks?.onSessionEnd) {
    try {
      await this.executeHook('onSessionEnd', this.config.hooks.onSessionEnd, endContext);
    } catch (error) {
      this.logger.error('onSessionEnd hook failed, continuing with session end:', error);
      // Don't throw - session end must complete
    }
  }

  // ... existing cleanup logic
}
```

### 5. Track End Reason
Update timer expiration handler:
```typescript
private handleExpiration(): void {
  this.endReason = 'expired';
  this.endSession();
}
```

### 6. Add calculateActualDuration Method
```typescript
private calculateActualDuration(): number | undefined {
  if (!this.sessionData) return undefined;
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((now - this.sessionData.startTime) / 60);
}
```

### 7. Update Timer Warning Handler
Call onSessionWarning hook:
```typescript
onSessionWarning: (data) => {
  const warningContext: SessionWarningContext = {
    sessionId: this.sessionData!.sessionId,
    userId: this.sessionData!.userId,
    remainingSeconds: data.remainingSeconds,
  };

  this.executeHook('onSessionWarning', this.config.hooks?.onSessionWarning, warningContext)
    .catch(error => this.logger.error('onSessionWarning hook failed:', error));

  this.showWarningModal(data.remainingSeconds);
  this.events.onSessionWarning?.(data);
}
```

### 8. Update extendSession Method
Call onSessionExtend hook:
```typescript
async extendSession(additionalMinutes: number): Promise<void> {
  // ... existing extension logic

  const extendContext: SessionExtendContext = {
    sessionId: this.sessionData.sessionId,
    userId: this.sessionData.userId,
    additionalMinutes,
    newExpiresAt: data.new_expires_at,
  };

  await this.executeHook('onSessionExtend', this.config.hooks?.onSessionExtend, extendContext);
}
```

### 9. Update All endSession Calls
Since endSession is now async, update all call sites:
```typescript
await this.endSession(); // instead of this.endSession()
```

## GhostDog Implementation

### 1. Create marketplace-auth.ts
Location: `extension-ghostdog/src/lib/auth/marketplace-auth.ts`

See `SESSION_LIFECYCLE_HOOKS.md` for full implementation example.

Key functions:
- `handleMarketplaceSessionStart` - Auto-login user
- `handleMarketplaceSessionEnd` - Force logout
- `handleMarketplaceSessionExtend` - Update auth expiration

### 2. Configure in marketplace.context.tsx
```typescript
import { handleMarketplaceSessionStart, handleMarketplaceSessionEnd } from '../../../lib/auth/marketplace-auth';

const sdkConfig: SDKConfig = {
  // ... existing config
  hooks: {
    onSessionStart: handleMarketplaceSessionStart,
    onSessionEnd: handleMarketplaceSessionEnd,
  },
  hookTimeoutMs: 5000,
};
```

### 3. Update App Routing
Add ProtectedRoute component that checks both marketplace session and app auth.

## Testing Checklist

### Unit Tests
- [ ] Hook timeout works (5 second default)
- [ ] onSessionStart failure prevents session init
- [ ] onSessionEnd failure doesn't prevent session end
- [ ] Hooks are optional (SDK works without them)

### Integration Tests
- [ ] GhostDog user auto-created on session start
- [ ] User auto-logged in
- [ ] User forced logout on session end
- [ ] User can't access app after session ends
- [ ] Multi-tab sync still works with hooks

## Build and Deploy

```bash
# Build SDK
cd gw-sdk
npm run build

# Build GhostDog
cd ../extension-ghostdog
npm run build:dev

# Test
# Open http://localhost:8080/app.html?jwt=<token>
```

## Files to Modify

### SDK (gw-sdk)
- ✅ `src/types/index.ts` - Add hook types
- ✅ `src/index.ts` - Export hook types
- ⏳ `src/core/MarketplaceSDK.ts` - Implement hooks

### GhostDog (extension-ghostdog)
- ⏳ `src/lib/auth/marketplace-auth.ts` - New file
- ⏳ `src/ui/contexts/marketplace.context.tsx` - Configure hooks
- ⏳ `src/ui/components/protected-route.tsx` - New file (optional)

## Next Session
Start with: Implement remaining MarketplaceSDK changes from this document.
