# Complete Lifecycle Hooks Implementation Guide

## Overview
This document contains all code changes needed to implement session lifecycle hooks in the SDK and integrate them with GhostDog. Follow steps in order.

**Estimated Time**: 2-3 hours
**Complexity**: Medium

---

## Part 1: SDK Implementation (gw-sdk)

### Step 1.1: Update MarketplaceSDK Constructor

**File**: `src/core/MarketplaceSDK.ts`

**Location**: Line 19, add private field for tracking end reason:
```typescript
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
  private endReason: 'expired' | 'manual' | 'error' = 'manual'; // ADD THIS LINE
```

**Location**: Line 32, in constructor, add hook config defaults:
```typescript
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
    // ADD THESE TWO LINES:
    hooks: config.hooks ?? {},
    hookTimeoutMs: config.hookTimeoutMs ?? 5000,
  };
  // ... rest of constructor
}
```

### Step 1.2: Add Hook Execution Utility Method

**File**: `src/core/MarketplaceSDK.ts`

**Location**: After the `on()` method (around line 68), add this new private method:

```typescript
/**
 * Execute a lifecycle hook with timeout
 */
private async executeHook<T>(
  hookName: string,
  hook: ((context: T) => Promise<void> | void) | undefined,
  context: T,
  isStrict: boolean = true
): Promise<void> {
  if (!hook) return;

  this.logger.log(`Calling ${hookName} hook`);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new SDKError(`${hookName} hook timeout after ${this.config.hookTimeoutMs}ms`, 'HOOK_TIMEOUT')),
      this.config.hookTimeoutMs
    )
  );

  try {
    await Promise.race([
      Promise.resolve(hook(context)),
      timeout
    ]);
    this.logger.log(`${hookName} hook completed successfully`);
  } catch (error) {
    this.logger.error(`${hookName} hook failed:`, error);

    if (isStrict) {
      // Strict mode: throw error to prevent session operation
      throw new SDKError(
        `${hookName} hook failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HOOK_ERROR'
      );
    } else {
      // Lenient mode: log but don't throw
      this.logger.warn(`${hookName} hook failed but continuing (lenient mode)`);
    }
  }
}
```

### Step 1.3: Add Calculate Duration Method

**File**: `src/core/MarketplaceSDK.ts`

**Location**: After the `executeHook` method, add:

```typescript
/**
 * Calculate actual session duration in minutes
 */
private calculateActualDuration(): number | undefined {
  if (!this.sessionData) return undefined;
  const now = Math.floor(Date.now() / 1000);
  const durationSeconds = now - this.sessionData.startTime;
  return Math.ceil(durationSeconds / 60);
}
```

### Step 1.4: Update initialize() Method - Add onSessionStart Hook

**File**: `src/core/MarketplaceSDK.ts`

**Location**: In `initialize()` method, after JWT validation succeeds and before timer starts

**Find this code** (around line 122):
```typescript
this.logger.log('JWT verified successfully');

// Map to SessionData
this.sessionData = {
  sessionId: verifiedClaims.sessionId,
  // ... rest of session data
};

// Calculate remaining time
const now = Math.floor(Date.now() / 1000);
const remainingSeconds = Math.max(0, this.sessionData.exp - now);
```

**Add this code AFTER the remainingSeconds calculation and BEFORE "Initialize timer":**

```typescript
// Call onSessionStart hook if provided (STRICT - failure prevents session start)
if (this.config.hooks?.onSessionStart) {
  const startContext: SessionStartContext = {
    sessionId: this.sessionData.sessionId,
    userId: this.sessionData.userId,
    email: (verifiedClaims as any).email, // May not be in all JWTs
    orgId: this.sessionData.orgId,
    applicationId: this.sessionData.applicationId,
    durationMinutes: this.sessionData.durationMinutes,
    expiresAt: this.sessionData.exp,
    jwt: this.jwtToken!,
  };

  await this.executeHook('onSessionStart', this.config.hooks.onSessionStart, startContext, true);
  this.logger.log('Application auth synchronized with marketplace session');
}

// Initialize timer (existing code continues here)
```

**Import the type at top of file**:
```typescript
import { SDKConfig, SDKEvents, SessionData, SDKError, SessionStartContext, SessionEndContext, SessionExtendContext, SessionWarningContext } from '../types';
```

### Step 1.5: Make endSession Async and Add onSessionEnd Hook

**File**: `src/core/MarketplaceSDK.ts`

**Find the endSession method** (around line 439):

**REPLACE this entire method:**
```typescript
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

  // Clear JWT from storage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('gw_marketplace_jwt');
    this.logger.log('JWT token cleared from storage');
  }

  // Trigger end event
  this.events.onSessionEnd?.();

  this.logger.info('Session ended');

  // Show "Session Ending" modal, then redirect after 3 seconds
  if (typeof window !== 'undefined') {
    // ... modal logic
  }
}
```

**WITH this async version:**
```typescript
/**
 * End session
 */
async endSession(): Promise<void> {
  this.logger.info('Ending session...');

  // Build session end context
  const endContext: SessionEndContext = {
    sessionId: this.sessionData?.sessionId || '',
    userId: this.sessionData?.userId || '',
    reason: this.endReason,
    actualDurationMinutes: this.calculateActualDuration(),
  };

  // Call onSessionEnd hook if provided (LENIENT - errors logged but don't block)
  if (this.config.hooks?.onSessionEnd) {
    try {
      await this.executeHook('onSessionEnd', this.config.hooks.onSessionEnd, endContext, false);
      this.logger.log('Application auth cleanup completed');
    } catch (error) {
      // This shouldn't throw due to lenient mode, but catch anyway
      this.logger.error('onSessionEnd hook error (continuing anyway):', error);
    }
  }

  // Stop timer
  this.timer?.stop();

  // Stop heartbeat
  this.heartbeat?.stop();

  // Broadcast to other tabs
  this.tabSync?.broadcast('end');

  // Clear JWT from storage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('gw_marketplace_jwt');
    this.logger.log('JWT token cleared from storage');
  }

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
```

### Step 1.6: Update Timer Initialization to Track Expiration

**File**: `src/core/MarketplaceSDK.ts`

**Find where TimerManager is initialized** (around line 134):

**REPLACE:**
```typescript
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
```

**WITH:**
```typescript
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
        this.executeHook('onSessionWarning', this.config.hooks.onSessionWarning, warningContext, false)
          .catch(error => this.logger.error('onSessionWarning hook failed:', error));
      }

      this.showWarningModal(data.remainingSeconds);
      this.events.onSessionWarning?.(data);
    },
    onSessionEnd: () => {
      this.endReason = 'expired'; // Track that this was an expiration
      this.endSession();
    },
  },
  this.config.debug
);
```

### Step 1.7: Update extendSession Method

**File**: `src/core/MarketplaceSDK.ts`

**Find the extendSession method** (around line 329):

**After successful extension, BEFORE `this.logger.info('Session extended successfully')`**, add:

```typescript
// Call onSessionExtend hook if provided
if (this.config.hooks?.onSessionExtend) {
  const extendContext: SessionExtendContext = {
    sessionId: this.sessionData.sessionId,
    userId: this.sessionData.userId,
    additionalMinutes,
    newExpiresAt: data.new_expires_at,
  };

  await this.executeHook('onSessionExtend', this.config.hooks.onSessionExtend, extendContext, false);
}

this.logger.info('Session extended successfully');
```

### Step 1.8: Build SDK

**Commands:**
```bash
cd /Users/patrick.henry/dev/gw-sdk
npm run build
```

**Expected Output:**
- No TypeScript errors
- Build succeeds
- `dist/` directory updated

---

## Part 2: GhostDog Implementation (extension-ghostdog)

### Step 2.1: Create Marketplace Auth Module

**Create new file**: `src/lib/auth/marketplace-auth.ts`

**Full file contents:**
```typescript
/**
 * Marketplace Session Lifecycle Handlers for GhostDog
 * Synchronizes marketplace sessions with app authentication
 */

import type { SessionStartContext, SessionEndContext, SessionExtendContext } from '@marketplace/provider-sdk';
import { setStorageValue, removeStorageValues, getStorageValue, StorageKey } from '../chrome/storage.chrome';

/**
 * Auto-login user when marketplace session starts
 * Called after JWT validation but before timer starts
 *
 * Flow:
 * 1. Check if marketplace user exists in GhostDog
 * 2. If not, create user account
 * 3. Generate app auth token tied to marketplace session
 * 4. Store in chrome.storage with matching expiration
 */
export async function handleMarketplaceSessionStart(context: SessionStartContext): Promise<void> {
  console.log('[MarketplaceAuth] Session starting for user:', context.userId);
  console.log('[MarketplaceAuth] Email:', context.email || 'N/A');
  console.log('[MarketplaceAuth] Organization:', context.orgId || 'N/A');
  console.log('[MarketplaceAuth] Expires at:', new Date(context.expiresAt * 1000).toISOString());

  try {
    // OPTION 1: Use marketplace JWT directly as app auth token
    // This is the simplest approach - the app trusts the validated JWT
    await setStorageValue(StorageKey.AuthSession, {
      userId: context.userId,
      sessionId: context.sessionId,
      token: context.jwt, // Use marketplace JWT
      expiresAt: context.expiresAt * 1000, // Convert to milliseconds
      source: 'marketplace',
      email: context.email,
      orgId: context.orgId,
    });

    console.log('[MarketplaceAuth] User authenticated via marketplace session');

    // OPTION 2: Exchange marketplace JWT for app-specific token
    // Uncomment this if you need to call your own auth endpoint:
    /*
    const appAuthToken = await exchangeMarketplaceToken(context.jwt);
    await setStorageValue(StorageKey.AuthSession, {
      userId: context.userId,
      sessionId: context.sessionId,
      token: appAuthToken,
      expiresAt: context.expiresAt * 1000,
      source: 'marketplace',
      email: context.email,
      orgId: context.orgId,
    });
    */

    // OPTION 3: Check if user exists in GhostDog DB, create if needed
    // Uncomment this if you need to ensure user exists in your database:
    /*
    const userExists = await checkUserExists(context.userId);
    if (!userExists) {
      await createUserFromMarketplace({
        userId: context.userId,
        email: context.email,
        orgId: context.orgId,
      });
    }
    */

  } catch (error) {
    console.error('[MarketplaceAuth] Failed to authenticate user:', error);
    // Throw error to prevent session from starting
    throw new Error(`Failed to authenticate marketplace user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Force logout user when marketplace session ends
 * Called before redirect to marketplace
 *
 * Flow:
 * 1. Clear all app auth state
 * 2. Optional: Report session usage to backend
 * 3. Optional: Clear any cached data
 */
export async function handleMarketplaceSessionEnd(context: SessionEndContext): Promise<void> {
  console.log('[MarketplaceAuth] Session ending for user:', context.userId);
  console.log('[MarketplaceAuth] Reason:', context.reason);
  console.log('[MarketplaceAuth] Duration:', context.actualDurationMinutes, 'minutes');

  try {
    // Clear all app auth state
    await removeStorageValues(StorageKey.AuthSession);
    console.log('[MarketplaceAuth] Auth session cleared');

    // Optional: Report session usage to backend for analytics/billing
    if (context.actualDurationMinutes && context.reason === 'manual') {
      try {
        await reportSessionUsage(context.sessionId, context.actualDurationMinutes);
        console.log('[MarketplaceAuth] Session usage reported');
      } catch (error) {
        console.error('[MarketplaceAuth] Failed to report usage (non-critical):', error);
      }
    }

    // Optional: Clear any cached data
    // await clearUserCache();

    console.log('[MarketplaceAuth] User logged out successfully');
  } catch (error) {
    console.error('[MarketplaceAuth] Failed to logout user:', error);
    // Don't throw - session end must always complete
    // The SDK will log this but continue with session end
  }
}

/**
 * Handle session extension
 * Called after successful session extension
 */
export async function handleMarketplaceSessionExtend(context: SessionExtendContext): Promise<void> {
  console.log('[MarketplaceAuth] Session extended by', context.additionalMinutes, 'minutes');
  console.log('[MarketplaceAuth] New expiration:', new Date(context.newExpiresAt * 1000).toISOString());

  try {
    // Update stored auth expiration time
    const currentAuth = await getStorageValue(StorageKey.AuthSession);
    if (currentAuth) {
      await setStorageValue(StorageKey.AuthSession, {
        ...currentAuth,
        expiresAt: context.newExpiresAt * 1000, // Convert to milliseconds
      });
      console.log('[MarketplaceAuth] Auth expiration updated');
    }
  } catch (error) {
    console.error('[MarketplaceAuth] Failed to update auth expiration:', error);
    // Non-critical - timer will still work
  }
}

/**
 * Optional: Report session usage to backend
 */
async function reportSessionUsage(sessionId: string, durationMinutes: number): Promise<void> {
  // Implement this if you want to track usage in your own analytics
  // Example:
  // await fetch('/api/analytics/session-usage', {
  //   method: 'POST',
  //   body: JSON.stringify({ sessionId, durationMinutes }),
  // });
}

/**
 * Optional: Check if user exists in GhostDog database
 */
async function checkUserExists(userId: string): Promise<boolean> {
  // Implement this if you need to verify user exists in your DB
  return true;
}

/**
 * Optional: Create user from marketplace session
 */
async function createUserFromMarketplace(data: { userId: string; email?: string; orgId: string }): Promise<void> {
  // Implement this if you need to create user records in your DB
  console.log('[MarketplaceAuth] Would create user:', data);
}

/**
 * Optional: Exchange marketplace JWT for app-specific token
 */
async function exchangeMarketplaceToken(marketplaceJwt: string): Promise<string> {
  // Implement this if you need to call your own auth endpoint
  // Example:
  // const response = await fetch('/api/auth/marketplace-exchange', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${marketplaceJwt}` },
  // });
  // const { token } = await response.json();
  // return token;
  return marketplaceJwt;
}
```

### Step 2.2: Update Storage Types (if needed)

**File**: `src/lib/chrome/storage.chrome.ts`

**Check if AuthSession type needs updating**. It should include these fields:
```typescript
export interface AuthSession {
  userId: string;
  sessionId: string;
  token: string;
  expiresAt: number;
  source: 'cognito' | 'marketplace';
  email?: string;
  orgId?: string;
  // ... other existing fields
}
```

### Step 2.3: Configure Hooks in Marketplace Context

**File**: `src/ui/contexts/marketplace.context.tsx`

**Add import at top:**
```typescript
import { handleMarketplaceSessionStart, handleMarketplaceSessionEnd, handleMarketplaceSessionExtend } from '../../../lib/auth/marketplace-auth';
```

**Update SDK config** (around line 48):
```typescript
const sdkConfig: SDKConfig = {
  jwksUri: MARKETPLACE_CONFIG.jwksUri,
  applicationId: MARKETPLACE_CONFIG.applicationId,
  debug: process.env.NODE_ENV === 'development',
  warningThresholdSeconds: 300, // 5 minutes
  apiEndpoint: MARKETPLACE_CONFIG.apiEndpoint,
  // Phase 2 features
  enableHeartbeat: false, // Disabled: CORS not configured for localhost
  heartbeatIntervalSeconds: 30,
  enableTabSync: true,
  pauseOnHidden: true,
  useBackendValidation: false, // Using JWKS validation for now

  // ADD THESE LINES:
  // Lifecycle hooks for auth synchronization
  hooks: {
    onSessionStart: handleMarketplaceSessionStart,
    onSessionEnd: handleMarketplaceSessionEnd,
    onSessionExtend: handleMarketplaceSessionExtend,
  },
  hookTimeoutMs: 5000, // 5 second timeout
};
```

### Step 2.4: Build GhostDog

**Commands:**
```bash
cd /Users/patrick.henry/dev/extension-ghostdog
npm run build:dev
```

**Expected Output:**
- No TypeScript errors
- Build succeeds
- `dist/` directory updated

---

## Part 3: Testing

### Test 3.1: Hook Execution - Happy Path

**Steps:**
1. Clear sessionStorage: `sessionStorage.clear()`
2. Generate fresh JWT:
   ```bash
   cd /Users/patrick.henry/dev/gw-api
   /tmp/create-session.sh
   ```
3. Open URL with JWT in browser
4. Open DevTools Console

**Expected Console Output:**
```
[MarketplaceAuth] Session starting for user: a47884c8-50d1-7040-2de8-b7801699643c
[MarketplaceAuth] Email: integration-test@generalwisdom.io
[MarketplaceAuth] User authenticated via marketplace session
[MarketplaceSDK] onSessionStart hook completed successfully
[MarketplaceSDK] Application auth synchronized with marketplace session
[Marketplace] Session started: {...}
```

**Verify:**
- [ ] Session header appears
- [ ] Timer counts down
- [ ] Check sessionStorage for `AuthSession`
- [ ] No errors in console

### Test 3.2: Auto-Login Integration

**Steps:**
1. Start with fresh session (from Test 3.1)
2. Navigate to different pages in app
3. Verify user is logged in (check for user-specific UI)

**Expected Behavior:**
- [ ] User can access protected routes
- [ ] User menu shows user info
- [ ] No login screen appears

### Test 3.3: Session End Hook

**Steps:**
1. Start session (Test 3.1)
2. Click "End Session" button on session header
3. Watch console

**Expected Console Output:**
```
[MarketplaceAuth] Session ending for user: a47884c8-50d1-7040-2de8-b7801699643c
[MarketplaceAuth] Reason: manual
[MarketplaceAuth] Duration: X minutes
[MarketplaceAuth] Auth session cleared
[MarketplaceAuth] User logged out successfully
[MarketplaceSDK] onSessionEnd hook completed successfully
[MarketplaceSDK] Application auth cleanup completed
```

**Verify:**
- [ ] sessionStorage `AuthSession` is cleared
- [ ] Redirects to marketplace after 3 seconds
- [ ] No errors in console

### Test 3.4: Session Expiration Hook

**Steps:**
1. Start session with 1-minute duration (modify create-session.sh):
   ```bash
   -d '{"application_id":"ghostdog","duration_minutes":1}'
   ```
2. Wait for session to expire (1 minute)
3. Watch console

**Expected:**
- [ ] Warning modal appears at 5 minutes (won't apply for 1-min session)
- [ ] Session ends automatically
- [ ] `reason: 'expired'` in end hook
- [ ] Auth cleared
- [ ] Redirects to marketplace

### Test 3.5: Hook Failure - Session Start

**Steps:**
1. Temporarily modify `handleMarketplaceSessionStart` to throw error:
   ```typescript
   export async function handleMarketplaceSessionStart(context: SessionStartContext): Promise<void> {
     throw new Error('TEST: Simulated auth failure');
   }
   ```
2. Rebuild app: `npm run build:dev`
3. Try to start session

**Expected:**
- [ ] Session does NOT start
- [ ] Error in console: "onSessionStart hook failed"
- [ ] No timer appears
- [ ] User sees error message

**After test**: Remove the error throw and rebuild

### Test 3.6: Hook Failure - Session End

**Steps:**
1. Temporarily modify `handleMarketplaceSessionEnd` to throw error
2. Start session
3. End session

**Expected:**
- [ ] Error logged in console
- [ ] Session STILL ends (lenient mode)
- [ ] Redirect STILL happens
- [ ] Auth might not be cleared (but redirect still works)

**After test**: Remove the error throw and rebuild

### Test 3.7: Hook Timeout

**Steps:**
1. Modify `handleMarketplaceSessionStart` to delay:
   ```typescript
   export async function handleMarketplaceSessionStart(context: SessionStartContext): Promise<void> {
     await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
     // ... rest of function
   }
   ```
2. Rebuild
3. Try to start session

**Expected:**
- [ ] After 5 seconds, timeout error
- [ ] Session does not start
- [ ] Console shows "hook timeout after 5000ms"

**After test**: Remove the delay and rebuild

### Test 3.8: Multi-Tab Sync with Hooks

**Steps:**
1. Open Tab 1 with session
2. Verify session starts and auth is set
3. Open Tab 2 with same session ID
4. End session in Tab 1
5. Watch Tab 2

**Expected:**
- [ ] Both tabs show session header
- [ ] Both tabs sync timer
- [ ] When Tab 1 ends session, Tab 2 also ends
- [ ] Both tabs clear auth
- [ ] Both tabs redirect to marketplace

### Test 3.9: Session Extension Hook

**Steps:**
1. Start session
2. Click "Extend" button on session header (if visible)
3. Watch console

**Expected:**
- [ ] `onSessionExtend` hook called
- [ ] New expiration logged
- [ ] Auth session expiration updated
- [ ] Timer updates with new time

---

## Part 4: Validation Checklist

Before considering implementation complete:

### SDK Validation
- [ ] TypeScript compiles with no errors
- [ ] All hooks are optional (SDK works without them)
- [ ] Hook timeout works (5 seconds default)
- [ ] onSessionStart failure prevents session init
- [ ] onSessionEnd failure doesn't prevent session end
- [ ] All hook contexts have correct data
- [ ] Hooks are called in correct order
- [ ] SDK exports all hook types

### GhostDog Validation
- [ ] marketplace-auth.ts compiles with no errors
- [ ] Hooks are configured in marketplace context
- [ ] Storage types support marketplace auth
- [ ] Build succeeds with no warnings
- [ ] All imports resolve correctly

### Integration Validation
- [ ] Session starts → User auto-logged in
- [ ] Session ends → User forced logout
- [ ] Session extends → Auth expiration updated
- [ ] Multi-tab sync works with hooks
- [ ] OAuth login still works with marketplace session
- [ ] No memory leaks (session cleanup complete)
- [ ] Error messages are clear and actionable

---

## Part 5: Troubleshooting

### Issue: "Cannot find module '@marketplace/provider-sdk'"

**Solution:**
```bash
cd /Users/patrick.henry/dev/gw-sdk
npm run build

cd /Users/patrick.henry/dev/extension-ghostdog
npm install
npm run build:dev
```

### Issue: "Hook timeout" on session start

**Causes:**
- Network slow for storage operations
- External API call in hook taking too long

**Solution:**
- Increase `hookTimeoutMs` in config
- Optimize hook code
- Remove blocking operations

### Issue: Session ends but user still logged in

**Causes:**
- onSessionEnd hook not clearing storage
- Error in hook being silently caught

**Solution:**
- Check console for hook errors
- Verify `removeStorageValues` is called
- Add debug logging to hook

### Issue: User can't log in after marketplace session

**Causes:**
- onSessionStart hook failing
- Storage write failing
- Auth session data incorrect

**Solution:**
- Check console for hook errors
- Verify storage permissions
- Add try/catch with detailed logging

---

## Part 6: Rollback Plan

If hooks cause issues in production:

### Quick Disable (No Code Changes)
**GhostDog**: `src/ui/contexts/marketplace.context.tsx`

Change:
```typescript
hooks: {
  onSessionStart: handleMarketplaceSessionStart,
  onSessionEnd: handleMarketplaceSessionEnd,
  onSessionExtend: handleMarketplaceSessionExtend,
},
```

To:
```typescript
// hooks: {
//   onSessionStart: handleMarketplaceSessionStart,
//   onSessionEnd: handleMarketplaceSessionEnd,
//   onSessionExtend: handleMarketplaceSessionExtend,
// },
```

Rebuild and deploy. SDK will work without hooks.

---

## Part 7: Next Steps After Implementation

1. **Documentation**: Update SDK README with hooks example
2. **Testing**: Add unit tests for hook execution
3. **Monitoring**: Add analytics to track hook success/failure rates
4. **Optimization**: Consider caching user lookups in hooks
5. **Enhancement**: Add more hook types (onSessionPause, onSessionResume)

---

## Summary

**What We're Building:**
- SDK hooks for app auth synchronization
- GhostDog auto-login on session start
- GhostDog force-logout on session end
- 5-second timeout protection
- Strict mode for session start, lenient for session end

**Files Modified:**
- SDK: `src/core/MarketplaceSDK.ts` (8 changes)
- SDK: `src/types/index.ts` (already done ✅)
- SDK: `src/index.ts` (already done ✅)
- GhostDog: `src/lib/auth/marketplace-auth.ts` (new file)
- GhostDog: `src/ui/contexts/marketplace.context.tsx` (add hooks config)

**Testing:**
- 9 test scenarios covering happy path and edge cases
- Validation checklist with 20+ items
- Troubleshooting guide for common issues

**Ready for handoff to next session!** 🚀
