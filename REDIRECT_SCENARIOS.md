# All Marketplace Redirect Scenarios

## Overview
Every redirect to the marketplace now shows the "Session Ending" modal for 3 seconds before redirecting, providing consistent, professional user experience.

## Redirect Scenarios

### ✅ 1. Timer Expires Naturally
**Flow:**
```
Session timer → Counts down to 0 → TimerManager triggers onSessionEnd
→ SDK calls endSession() → Shows ending modal (3s) → Redirects to marketplace
```

**Code Path:** `TimerManager.ts:57-60` → `MarketplaceSDK.ts:438-469`

**User Experience:**
- Timer reaches 0:00
- "Session Ending" modal appears
- Progress bar animates for 3 seconds
- Redirects to `https://d3p2yqofgy75sz.cloudfront.net/`

**Test:**
```bash
npm run generate-jwt 30s
# Wait 30 seconds, watch modal appear and redirect
```

---

### ✅ 2. Warning Modal Countdown Expires
**Flow:**
```
Warning modal shown → User doesn't interact → Countdown reaches 0:00
→ Modal calls onEnd callback → SDK calls endSession() → Shows ending modal (3s) → Redirects
```

**Code Path:** `WarningModal.ts:183-187` → `MarketplaceSDK.ts:438-469`

**User Experience:**
- Warning modal appears (e.g., at 5 minutes remaining)
- User doesn't click any buttons
- Warning modal countdown reaches 0:00
- Warning modal replaced by "Session Ending" modal
- Progress bar animates for 3 seconds
- Redirects to marketplace

**Test:**
```bash
npm run generate-jwt 6  # 6 minutes
# Wait for warning modal (appears at 5 min remaining)
# Let warning countdown reach 0:00
```

---

### ✅ 3. User Clicks "End Session" in Warning Modal
**Flow:**
```
Warning modal shown → User clicks "End Session" button
→ Modal calls onEnd callback → SDK calls endSession() → Shows ending modal (3s) → Redirects
```

**Code Path:** `WarningModal.ts:148-153` → `MarketplaceSDK.ts:511-513` → `MarketplaceSDK.ts:438-469`

**User Experience:**
- Warning modal is visible
- User clicks red "End Session" button
- "Session Ending" modal appears immediately
- Progress bar animates for 3 seconds
- Redirects to marketplace

**Test:**
```bash
npm run generate-jwt 6
# Wait for warning modal
# Click "End Session" button
```

---

### ✅ 4. User Clicks "End Session" in Dashboard
**Flow:**
```
Dashboard visible → User clicks "End Session" button
→ Calls sdk.endSession() → Shows ending modal (3s) → Redirects
```

**Code Path:** `App.tsx:173-177` → `useMarketplaceSession.ts:205-208` → `MarketplaceSDK.ts:438-469`

**User Experience:**
- Dashboard is visible with timer
- User clicks "End Session" button
- Confirmation dialog appears ("Are you sure?")
- User confirms
- "Session Ending" modal appears
- Progress bar animates for 3 seconds
- Redirects to marketplace

**Test:**
```bash
npm run generate-jwt 5
# Click "End Session" button in dashboard
# Confirm the dialog
```

---

### ✅ 5. Session Extension Fails
**Flow:**
```
Warning modal shown → User clicks "Extend Session"
→ API call fails (e.g., insufficient tokens) → Shows ending modal (3s) → Redirects to extend page
```

**Code Path:** `MarketplaceSDK.ts:488-508`

**User Experience:**
- Warning modal shows "Extend Session" button
- User clicks "Extend Session"
- Backend API call fails (insufficient tokens)
- "Session Ending" modal appears
- Message: "Redirecting to marketplace..."
- Progress bar animates for 3 seconds
- Redirects to: `https://d3p2yqofgy75sz.cloudfront.net/extend-session?sessionId=...`
- User can purchase more time on marketplace

**Test:**
```bash
# Requires backend server with extension endpoint
npm run generate-jwt 6
# Wait for warning modal
# Click "Extend Session" (will fail if no backend)
```

---

### ⚠️ 6. SDK Initialization Error (Exception)
**Flow:**
```
SDK.initialize() fails → Error state in React component
→ User clicks "Return to Marketplace" → Direct redirect (no modal)
```

**Code Path:** `App.tsx:77-96`

**User Experience:**
- Invalid JWT or initialization error
- Error card displayed: "Session Error"
- Error message shown
- "Return to Marketplace" button available
- Clicking button redirects immediately (no modal)

**Why No Modal:**
- SDK failed to initialize, so modal system is not available
- This is a fatal error state, not a normal session end
- Direct redirect is appropriate for error recovery

**Test:**
```bash
# Visit with invalid or expired JWT
http://localhost:3000/provider?gwSession=invalid_token_here
```

---

## Summary Table

| Scenario | Modal Shown? | Duration | Redirect To |
|----------|-------------|----------|-------------|
| Timer expires | ✅ Yes | 3 seconds | Marketplace home |
| Warning countdown expires | ✅ Yes | 3 seconds | Marketplace home |
| User clicks "End Session" (warning modal) | ✅ Yes | 3 seconds | Marketplace home |
| User clicks "End Session" (dashboard) | ✅ Yes | 3 seconds | Marketplace home |
| Extension fails | ✅ Yes | 3 seconds | Marketplace extend page |
| Initialization error | ❌ No | Immediate | Marketplace home |

## Modal Content

### Standard Session End
```
┌─────────────────────────────────────┐
│              ⏱️                      │
│                                     │
│        Session Ending               │
│          (in red)                   │
│                                     │
│    Your session has expired.        │
│   Redirecting to marketplace...     │
│                                     │
│  [=====>              ]             │
│    (animated progress bar)          │
└─────────────────────────────────────┘
```

**Features:**
- Large clock emoji (⏱️)
- Red headline: "Session Ending"
- Clear message about what's happening
- Animated progress bar (3 seconds)
- Smooth fade-in and slide-in animations
- Uses theme colors (light/dark mode support)

## Configuration

All redirects use the configured marketplace URL:

```typescript
const sdk = new MarketplaceSDK({
  marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',
  themeMode: 'auto', // Modal respects theme
  // ... other options
});
```

## Code Locations

### SDK Core
- **endSession()**: `src/core/MarketplaceSDK.ts:438-469`
  - Calls `showEndingMessage()` with callback
  - Redirects after 3 seconds

### Modal Component
- **showEndingMessage()**: `src/ui/WarningModal.ts:221-309`
  - Creates ending modal
  - Animates progress bar
  - Calls redirect callback after duration

### Timer Manager
- **Timer expiration**: `src/core/TimerManager.ts:57-60`
  - Triggers `onSessionEnd` event when timer reaches 0

### Warning Modal
- **Countdown expiration**: `src/ui/WarningModal.ts:183-187`
  - Calls `onEnd` callback when warning countdown reaches 0

## Testing All Scenarios

### Quick Test Script
```bash
# 1. Test natural expiration (30 seconds)
npm run generate-jwt 30s
# Open URL, wait for timer to expire

# 2. Test warning modal timeout (6 minutes)
npm run generate-jwt 6
# Wait for warning modal, let it countdown to 0:00

# 3. Test manual end from dashboard
npm run generate-jwt 5
# Click "End Session" button

# 4. Test manual end from warning modal
npm run generate-jwt 6
# Wait for warning modal, click "End Session"

# 5. Test error case
# Visit with invalid token: http://localhost:3000/provider?gwSession=invalid
```

## User Experience Benefits

### Before (Without Consistent Modals)
❌ Some redirects were instant (confusing)
❌ No visual feedback on what's happening
❌ Inconsistent experience across scenarios
❌ Users confused about why they're being redirected

### After (With Consistent Modals)
✅ All redirects show clear "Session Ending" modal
✅ 3-second countdown with progress bar
✅ Clear message: "Redirecting to marketplace..."
✅ Smooth, professional transition
✅ Consistent experience everywhere
✅ Users understand what's happening and why

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

The ending modal includes:
- ✅ High contrast text
- ✅ Large, clear typography (48px emoji, 24px headline)
- ✅ Clear messaging
- ✅ Visual progress indicator
- ✅ Automatic redirect (no interaction required)
- ✅ Keyboard accessible (can't be cancelled, but could be enhanced)

## Future Enhancements

Potential improvements:
1. Add countdown timer text (e.g., "Redirecting in 3... 2... 1...")
2. Add cancel button for certain scenarios
3. Add sound/notification option
4. Customize message per scenario (different text for extension failure)
5. Allow configuration of duration (currently hardcoded to 3 seconds)
