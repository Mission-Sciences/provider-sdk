# Bug Fix: Session Timeout Redirect Issue

## Issue Summary
The dashboard and modal were not properly redirecting back to the marketplace when the session timer expired.

## Root Cause
**Location:** `src/ui/WarningModal.ts:180-183`

The warning modal had an independent countdown timer that, when reaching zero, would only hide the modal without triggering the session end redirect:

```typescript
// If time runs out, hide the modal
if (remaining === 0) {
  this.hide();  // ❌ Only hides, doesn't trigger redirect
}
```

This created a broken user experience where:
1. User sees the warning modal countdown reach 0:00
2. Modal disappears
3. No redirect happens
4. User is left on the dashboard without clear guidance

## Additional Issues Found
**Location:** `src/core/MarketplaceSDK.ts:490-496`

There was a duplicate redirect in the modal's `onEnd` callback that could interfere with proper cleanup:

```typescript
onEnd: () => {
  this.endSession();
  // ❌ Duplicate redirect - endSession() already handles this
  window.location.href = 'https://d3p2yqofgy75sz.cloudfront.net/';
},
```

## Solution Implemented

### Fix 1: Modal Countdown Trigger (WarningModal.ts)
Added proper callback triggering when modal countdown expires:

```typescript
// If time runs out, trigger session end if callback exists
if (remaining === 0) {
  if (this.onEndCallback) {
    this.onEndCallback();  // ✅ Triggers session end and redirect
  }
  this.hide();
}
```

Added the callback property to store the `onEnd` handler:
```typescript
private onEndCallback: (() => void) | undefined = undefined;
```

And stored it when modal is shown:
```typescript
this.onEndCallback = options.onEnd;
```

### Fix 2: Remove Duplicate Redirect (MarketplaceSDK.ts)
Removed the duplicate redirect, allowing `endSession()` to handle cleanup and redirect properly:

```typescript
onEnd: () => {
  // ✅ endSession() handles cleanup and redirect with proper timing
  this.endSession();
},
```

## Expected Behavior After Fix

### When Warning Modal is Shown:
1. Modal appears at warning threshold (default 5 minutes before expiration)
2. Modal shows countdown timer
3. User has options:
   - **Continue:** Dismiss modal and continue working
   - **Extend Session:** Request more time
   - **End Session:** End immediately and redirect

### When Modal Countdown Reaches 0:
1. Modal triggers the `onEnd` callback
2. `endSession()` method is called:
   - Stops all timers
   - Stops heartbeat
   - Broadcasts to other tabs
   - Hides modal
   - Triggers `onSessionEnd` event
3. After 500ms delay (for cleanup), redirects to marketplace
4. User is returned to `https://d3p2yqofgy75sz.cloudfront.net/`

### When Main Timer Expires (Natural Expiration):
1. `TimerManager` reaches 0 and triggers `onSessionEnd` event
2. SDK's handler calls `endSession()`
3. Same cleanup and redirect process as above

## Testing Instructions

### Quick Test (1 minute session):
```bash
# Generate a 1-minute test JWT
npm run generate-jwt 1

# Start the test server (if not running)
npm run test-server

# Build the SDK with fixes
npm run build

# Open the test URL in browser (use the React URL from generate-jwt output)
# Wait for timer to expire and verify redirect happens
```

### Full Test (with warning modal):
```bash
# Generate a 6-minute test JWT (warning at 5 minutes)
npm run generate-jwt 6

# Open test URL
# Wait 1 minute for warning modal to appear
# Verify modal countdown reaches 0:00 and redirects properly
```

## Files Changed
- `src/ui/WarningModal.ts` - Fixed countdown expiration behavior
- `src/core/MarketplaceSDK.ts` - Removed duplicate redirect and added configurable marketplace URL
- `src/types/index.ts` - Added `marketplaceUrl` to SDK config interface
- `examples/react/App.tsx` - Updated with marketplace URL configuration
- `examples/vanilla-js/index.html` - Updated with marketplace URL configuration
- `examples/provider-simulation/existing-app.html` - Updated with marketplace URL configuration

## Improvement: Configurable Marketplace URL

### Problem
The marketplace URL was hardcoded in multiple places (`https://d3p2yqofgy75sz.cloudfront.net/` and `https://marketplace.generalwisdom.com`), making it difficult to:
- Switch environments (dev/staging/prod)
- Update the URL in one place
- Maintain consistency across the codebase

### Solution
Added `marketplaceUrl` as a configurable option in the SDK:

```typescript
const sdk = new MarketplaceSDK({
  apiEndpoint: 'https://api.generalwisdom.com',
  applicationId: 'my-app',
  marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/', // ✅ Configure in one place
  // ... other options
});
```

**Default Value:** `https://d3p2yqofgy75sz.cloudfront.net/`

**Used For:**
- Session expiration redirects
- Manual session end redirects
- Warning modal timeout redirects
- Extension failure redirects (e.g., `marketplaceUrl/extend-session?sessionId=...`)

**Documentation:** See `REDIRECT_CONFIGURATION.md` for complete configuration guide

## Impact
✅ Session expiration now properly redirects users back to marketplace
✅ No more "stuck on dashboard" after timer expires
✅ Consistent redirect behavior whether user dismisses modal or lets it expire
✅ Proper cleanup before redirect (timer, heartbeat, tab sync)
✅ Single source of truth for marketplace URL
✅ Easy environment-specific configuration
✅ No hardcoded URLs throughout the codebase

## Related Code References
- Timer expiration: `src/core/TimerManager.ts:56-61`
- Session end handler: `src/core/MarketplaceSDK.ts:437-463`
- Modal countdown: `src/ui/WarningModal.ts:169-188`
- URL configuration: `src/types/index.ts:19-20`
