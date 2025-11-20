# Marketplace SDK Session Lifecycle Hooks

## Problem Statement

Applications need to synchronize their authentication state with marketplace sessions:
- Auto-login users when marketplace session starts
- Force logout when marketplace session ends
- Prevent users from accessing app after session expiration
- Work with any authentication solution (Cognito, Auth0, custom, etc.)

## Proposed Solution: Lifecycle Hooks

Add optional hooks to SDK configuration that allow apps to define custom behavior at key session lifecycle points.

## SDK Configuration API

```typescript
interface SessionLifecycleHooks {
  /**
   * Called after JWT validation succeeds but before session timer starts
   * Use to: Auto-login user to your app's auth system
   */
  onSessionStart?: (context: SessionStartContext) => Promise<void> | void;

  /**
   * Called when session expires or is manually ended, before redirect
   * Use to: Force logout user from your app's auth system
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

interface SessionStartContext {
  sessionId: string;
  userId: string;          // From JWT sub claim
  email?: string;          // From JWT email claim (if available)
  orgId: string;           // From JWT orgId claim
  applicationId: string;
  durationMinutes: number;
  expiresAt: number;       // Unix timestamp
  jwt: string;             // The full JWT token for app use
}

interface SessionEndContext {
  sessionId: string;
  userId: string;
  reason: 'expired' | 'manual' | 'error';
  actualDurationMinutes?: number;
}

interface SessionExtendContext {
  sessionId: string;
  userId: string;
  additionalMinutes: number;
  newExpiresAt: number;
}

interface SessionWarningContext {
  sessionId: string;
  userId: string;
  remainingSeconds: number;
}
```

## SDK Implementation Changes

### 1. Update SDKConfig Interface

```typescript
// gw-sdk/src/types/index.ts
export interface SDKConfig {
  // ... existing config
  hooks?: SessionLifecycleHooks;
}
```

### 2. Call Hooks in MarketplaceSDK

```typescript
// gw-sdk/src/core/MarketplaceSDK.ts

async initialize(): Promise<SessionData> {
  // ... existing validation logic

  // Build session start context
  const startContext: SessionStartContext = {
    sessionId: this.sessionData.sessionId,
    userId: this.sessionData.userId,
    email: verifiedClaims.email,
    orgId: this.sessionData.orgId,
    applicationId: this.sessionData.applicationId,
    durationMinutes: this.sessionData.durationMinutes,
    expiresAt: this.sessionData.exp,
    jwt: this.jwtToken!,
  };

  // Call onSessionStart hook if provided
  if (this.config.hooks?.onSessionStart) {
    this.logger.log('Calling onSessionStart hook');
    try {
      await this.config.hooks.onSessionStart(startContext);
      this.logger.log('onSessionStart hook completed');
    } catch (error) {
      this.logger.error('onSessionStart hook failed:', error);
      // Decision: Should hook failure prevent session start?
      // Option 1: Throw error (strict)
      // Option 2: Log and continue (lenient)
      throw new SDKError(
        `Session start hook failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HOOK_ERROR'
      );
    }
  }

  // ... continue with timer setup
}

endSession(): void {
  this.logger.info('Ending session...');

  // Build session end context
  const endContext: SessionEndContext = {
    sessionId: this.sessionData?.sessionId || '',
    userId: this.sessionData?.userId || '',
    reason: 'manual', // or 'expired' based on how endSession was triggered
    actualDurationMinutes: this.calculateActualDuration(),
  };

  // Call onSessionEnd hook if provided
  if (this.config.hooks?.onSessionEnd) {
    this.logger.log('Calling onSessionEnd hook');
    try {
      // Note: Using await here would make endSession async
      // Consider: Fire and forget? Or make endSession async?
      this.config.hooks.onSessionEnd(endContext);
      this.logger.log('onSessionEnd hook called');
    } catch (error) {
      this.logger.error('onSessionEnd hook failed:', error);
      // Continue with session end even if hook fails
    }
  }

  // ... existing cleanup logic
}
```

### 3. Track Session End Reason

```typescript
private endReason: 'expired' | 'manual' | 'error' = 'manual';

private handleExpiration(): void {
  this.endReason = 'expired';
  this.endSession();
}

endSession(): void {
  // Use this.endReason in context
  const endContext: SessionEndContext = {
    // ...
    reason: this.endReason,
  };
  // ...
}
```

## GhostDog Implementation Example

### 1. Define Hook Functions

```typescript
// extension-ghostdog/src/lib/auth/marketplace-auth.ts

import { SessionStartContext, SessionEndContext } from '@marketplace/provider-sdk';
import { setStorageValue, removeStorageValues, StorageKey } from '../chrome/storage.chrome';
import { exchangeMarketplaceSession } from './auth';

/**
 * Auto-login user when marketplace session starts
 */
export async function handleMarketplaceSessionStart(context: SessionStartContext): Promise<void> {
  console.log('[MarketplaceAuth] Session starting for user:', context.userId);

  try {
    // Check if user already exists in our system
    const existingUser = await checkUserExists(context.userId);

    if (!existingUser) {
      // Create new user in our system
      console.log('[MarketplaceAuth] Creating new user from marketplace session');
      await createUserFromMarketplace({
        userId: context.userId,
        email: context.email,
        orgId: context.orgId,
      });
    }

    // Generate or retrieve app auth tokens for this user
    // Option A: Create a temporary session token tied to marketplace session
    const appAuthToken = await generateTemporaryAuthToken(context.userId, context.sessionId);

    // Option B: Use the marketplace JWT directly as auth token
    // const appAuthToken = context.jwt;

    // Store auth session tied to marketplace session
    await setStorageValue(StorageKey.AuthSession, {
      userId: context.userId,
      sessionId: context.sessionId,
      token: appAuthToken,
      expiresAt: context.expiresAt,
      source: 'marketplace',
    });

    console.log('[MarketplaceAuth] User authenticated via marketplace session');
  } catch (error) {
    console.error('[MarketplaceAuth] Failed to authenticate user:', error);
    throw error; // SDK will handle this as initialization failure
  }
}

/**
 * Force logout user when marketplace session ends
 */
export async function handleMarketplaceSessionEnd(context: SessionEndContext): Promise<void> {
  console.log('[MarketplaceAuth] Session ending for user:', context.userId, 'Reason:', context.reason);

  try {
    // Clear all app auth state
    await removeStorageValues(StorageKey.AuthSession);

    // Optional: Report session usage to backend
    if (context.actualDurationMinutes) {
      await reportSessionUsage(context.sessionId, context.actualDurationMinutes);
    }

    console.log('[MarketplaceAuth] User logged out');
  } catch (error) {
    console.error('[MarketplaceAuth] Failed to logout user:', error);
    // Don't throw - session end should always complete
  }
}

/**
 * Handle session extension
 */
export async function handleMarketplaceSessionExtend(context: SessionExtendContext): Promise<void> {
  console.log('[MarketplaceAuth] Session extended by', context.additionalMinutes, 'minutes');

  // Update stored auth expiration time
  const currentAuth = await getStorageValue(StorageKey.AuthSession);
  if (currentAuth) {
    await setStorageValue(StorageKey.AuthSession, {
      ...currentAuth,
      expiresAt: context.newExpiresAt,
    });
  }
}
```

### 2. Configure SDK with Hooks

```typescript
// extension-ghostdog/src/ui/contexts/marketplace.context.tsx

import { handleMarketplaceSessionStart, handleMarketplaceSessionEnd, handleMarketplaceSessionExtend } from '../../../lib/auth/marketplace-auth';

const sdkConfig: SDKConfig = {
  jwksUri: MARKETPLACE_CONFIG.jwksUri,
  applicationId: MARKETPLACE_CONFIG.applicationId,
  debug: process.env.NODE_ENV === 'development',
  warningThresholdSeconds: 300,
  apiEndpoint: MARKETPLACE_CONFIG.apiEndpoint,
  enableTabSync: true,
  pauseOnHidden: true,

  // Lifecycle hooks
  hooks: {
    onSessionStart: handleMarketplaceSessionStart,
    onSessionEnd: handleMarketplaceSessionEnd,
    onSessionExtend: handleMarketplaceSessionExtend,
  },
};
```

### 3. Update App Routing to Respect Marketplace Auth

```typescript
// extension-ghostdog/src/ui/components/protected-route.tsx

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { useMarketplaceSession } from '../contexts/marketplace.context';
import { getStorageValue, StorageKey } from '../../lib/chrome/storage.chrome';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session } = useMarketplaceSession();
  const [authSession, setAuthSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStorageValue(StorageKey.AuthSession).then(auth => {
      setAuthSession(auth);
      setLoading(false);
    });
  }, [session]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // If marketplace session exists but no app auth, something went wrong
  if (session && !authSession) {
    return <div>Authentication failed</div>;
  }

  // If no marketplace session and no app auth, redirect to login
  if (!session && !authSession) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

## Alternative Approaches Considered

### 1. SDK Manages Auth Directly
❌ **Rejected**: Too opinionated, doesn't work with different auth systems

### 2. Pass JWT to App, Let App Handle Everything
❌ **Rejected**: App has to manually track session lifecycle, easy to miss edge cases

### 3. Hooks + Helper Library
✅ **Selected**: Flexible, auth-agnostic, SDK manages lifecycle

## Migration Path

1. **Phase 1**: Add hooks to SDK (backward compatible - hooks are optional)
2. **Phase 2**: Implement GhostDog hooks
3. **Phase 3**: Test full lifecycle (start, extend, end)
4. **Phase 4**: Document patterns for other apps

## Testing Strategy

### Unit Tests
- Test hook execution order
- Test error handling in hooks
- Test session lifecycle with and without hooks

### Integration Tests
- GhostDog: Create user on session start
- GhostDog: Verify auto-login works
- GhostDog: Verify forced logout on session end
- GhostDog: Verify user can't access app after session ends

### Edge Cases
- Hook throws error during session start
- Hook takes too long (timeout?)
- Multiple tabs with same session
- Session ends while hook is executing

## Open Questions

1. **Should hook failures block SDK initialization?**
   - Option A: Strict - Throw error, prevent session start
   - Option B: Lenient - Log warning, continue
   - **Recommendation**: Strict for onSessionStart, lenient for onSessionEnd

2. **Should hooks be async or sync?**
   - **Recommendation**: Support both (async preferred)

3. **Should we provide helper utilities?**
   - JWT parsing utilities
   - Common auth pattern helpers
   - **Recommendation**: Yes, but keep SDK core minimal

4. **How to handle hook timeouts?**
   - **Recommendation**: 5 second timeout with configurable override

5. **Should onSessionEnd be awaited?**
   - If yes, session end becomes async
   - If no, hook might not complete before redirect
   - **Recommendation**: Make endSession async, await hook

## Related Files
- `gw-sdk/src/types/index.ts` - Type definitions
- `gw-sdk/src/core/MarketplaceSDK.ts` - Hook execution
- `extension-ghostdog/src/lib/auth/marketplace-auth.ts` - GhostDog implementation
- `extension-ghostdog/src/ui/contexts/marketplace.context.tsx` - Hook configuration

## Next Steps

1. Review and approve architecture
2. Implement hooks in SDK
3. Implement GhostDog hooks
4. Test end-to-end lifecycle
5. Document for other integrators
