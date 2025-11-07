# 🧪 Phase 2 Testing Guide

**Complete walkthrough for testing all Phase 2 features**

---

## 📋 Prerequisites

Make sure you have:
- ✅ Node.js installed
- ✅ Dependencies installed (`npm install`)
- ✅ SDK built (`npm run build`)
- ✅ Test keys generated (`npm run generate-keys`)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Start Phase 2 Test Server

```bash
npm run test-server-p2
```

You should see:
```
🚀 Phase 2 Test Server Running!

📍 Endpoints:
   React Example:    http://localhost:3000/provider
   Vanilla Example:  http://localhost:3000/example
   JWKS:            http://localhost:3000/.well-known/jwks.json

📡 Mock Backend (Phase 2):
   POST /sessions/validate         - Validate JWT
   POST /sessions/:id/heartbeat    - Receive heartbeats
   POST /sessions/:id/complete     - Complete session
   PUT  /sessions/:id/renew        - Extend session
```

**✅ Server is ready when you see this output**

---

### Step 2: Generate Test JWT

Open a **new terminal** (keep the server running) and run:

```bash
npm run generate-jwt 5
```

**Why 5 minutes?** Phase 2 testing is faster with short sessions. You can test:
- Heartbeat (every 30s)
- Extension (add 5-15 minutes)
- Early completion
- Warning modal (at 5 min threshold with default config)

**Output:**
```
✅ JWT Generated Successfully!

📋 Session Details:
   Duration: 5 minutes
   Expires: 2025-11-06T12:50:00.000Z

🔑 Your JWT Token:
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRl...
```

**✅ Copy the entire JWT token**

---

### Step 3: Open Test App

**Option A: React Example (Recommended - First-Class Citizen)**
```
http://localhost:3000/provider?gwSession=<PASTE_YOUR_JWT_HERE>
```

**Option B: Vanilla JS Example**
```
http://localhost:3000/example?gwSession=<PASTE_YOUR_JWT_HERE>
```

**✅ You should see the session dashboard load**

---

### Step 4: Open Browser DevTools

**Press F12** or **Right-click → Inspect**

Go to the **Console** tab. You'll see Phase 2 initialization logs:

```
[MarketplaceSDK] Initializing with Phase 2 features enabled
[MarketplaceSDK] Heartbeat enabled: true
[MarketplaceSDK] Tab sync enabled: true
[MarketplaceSDK] JWT validated successfully
[HeartbeatManager] Starting heartbeat system (interval: 30s)
[TabSyncManager] Initializing tab sync
[TabSyncManager] Elected as master tab
[MarketplaceSDK] Session started
```

**✅ If you see these logs, Phase 2 is working!**

---

## 🧪 Phase 2 Feature Tests

### Test 1: Heartbeat System ❤️

**What it does:** Sends a heartbeat to the backend every 30 seconds to sync remaining time.

**How to test:**

1. Keep the Console tab open
2. Wait 30 seconds
3. Watch for heartbeat logs:

```
[HeartbeatManager] Sending heartbeat...
[HeartbeatManager] Heartbeat acknowledged: 240 seconds remaining
```

4. Check the **Network** tab:
   - Filter by `heartbeat`
   - You should see POST requests to `/sessions/:id/heartbeat`
   - Click on a request → Preview tab → See response:
     ```json
     {
       "acknowledged": true,
       "remaining_seconds": 240,
       "status": "active"
     }
     ```

**✅ Success criteria:**
- Heartbeat logs appear every 30 seconds
- Network shows POST requests
- Timer stays in sync with server

**What to look for:**
- 3 heartbeat failures → heartbeat stops (by design)
- Server time sync updates the countdown timer
- Only master tab sends heartbeats (test with multiple tabs)

---

### Test 2: Session Extension ⏰

**What it does:** Extends your session by adding minutes (charges tokens).

**How to test:**

1. Note current remaining time (e.g., "3:45")
2. Click **"Extend Session"** button
3. Select duration (5, 15, 30, or 60 minutes)
4. Click **"Confirm"**

**Console logs:**
```
[MarketplaceSDK] Extending session by 15 minutes
[MarketplaceSDK] Session extended successfully
[MarketplaceSDK] New expiration: <timestamp>
[TabSyncManager] Broadcasted: extend (15 minutes)
```

**Network tab:**
- PUT request to `/sessions/:id/renew`
- Response shows:
  ```json
  {
    "session_id": "sess_...",
    "new_expires_at": 1730004000,
    "additional_cost": 75,
    "total_tokens_spent": 225
  }
  ```

5. Watch the timer **increase** by 15 minutes
6. Alert should show: "Session extended by 15 minutes!"

**✅ Success criteria:**
- Timer updates immediately
- All tabs sync the new time (if multi-tab open)
- Network request succeeds
- No errors in console

---

### Test 3: Multi-Tab Synchronization 🔄

**What it does:** Syncs session state (pause, resume, extension) across all open tabs.

**How to test:**

1. **Open the same URL in TWO browser tabs**
   ```
   http://localhost:3000/provider?gwSession=<YOUR_JWT>
   ```

2. **Open Console in BOTH tabs** (F12)

3. **In Tab 1:** Click "Pause" button

   **Tab 1 console:**
   ```
   [MarketplaceSDK] Timer paused
   [TabSyncManager] Broadcasted: pause
   ```

   **Tab 2 console:**
   ```
   [TabSyncManager] Received message: pause
   [MarketplaceSDK] Timer paused (synced from another tab)
   ```

4. **Watch Tab 2:** Timer should pause automatically!

5. **In Tab 2:** Click "Resume" button

   **Both tabs** should resume automatically

6. **Close Tab 1**, **Tab 2** becomes the master tab:
   ```
   [TabSyncManager] Master tab closed, electing new master
   [TabSyncManager] Elected as master tab
   [HeartbeatManager] Starting heartbeat system
   ```

**✅ Success criteria:**
- Pause in one tab → all tabs pause
- Resume in one tab → all tabs resume
- Extend in one tab → all tabs get new time
- Close master tab → new master elected
- Only master tab sends heartbeats

**Modern browsers:** Uses `BroadcastChannel` API
**Older browsers:** Falls back to `localStorage` events

---

### Test 4: Visibility API 👁️

**What it does:** Auto-pauses timer when you switch tabs/minimize (battery-friendly).

**How to test:**

1. Make sure timer is running
2. Note the current time (e.g., "4:23")

**Method A: Minimize the browser**
3. Minimize the entire browser window
4. Wait 10 seconds
5. Restore the window

**Console logs:**
```
[MarketplaceSDK] Tab hidden, pausing timer
[MarketplaceSDK] Tab visible, resuming timer
```

**Method B: Switch to another tab**
3. Switch to a different browser tab
4. Wait 10 seconds
5. Switch back

**✅ Success criteria:**
- Timer pauses when tab is hidden
- Timer resumes when tab is visible
- Time doesn't advance while hidden
- Smooth pause/resume experience

**Note:** This is configurable via `pauseOnHidden` option (enabled by default in test app).

---

### Test 5: Early Completion ✅

**What it does:** Ends the session early and calculates a refund for unused time.

**How to test:**

1. Note current remaining time (e.g., "3:30" left)
2. Click **"Complete Early"** button
3. Confirm the dialog: "Complete session early?"

**Console logs:**
```
[MarketplaceSDK] Completing session early
[MarketplaceSDK] Actual usage: 2 minutes
[MarketplaceSDK] Session completed successfully
```

**Network tab:**
- POST request to `/sessions/:id/complete`
- Response shows refund calculation:
  ```json
  {
    "session_id": "sess_...",
    "tokens_refunded": 50,
    "final_cost": 125,
    "actual_usage_minutes": 2
  }
  ```

4. Session ends immediately
5. You're redirected to marketplace (or see end screen)

**✅ Success criteria:**
- Session ends immediately
- Backend calculates refund
- Network request succeeds
- Cleanup happens properly

---

### Test 6: Warning Modal (Phase 1 + Phase 2)

**What it does:** Shows a warning when time is running low.

**How to test:**

1. Generate a JWT with warning threshold:
   ```bash
   npm run generate-jwt 5
   ```

2. Open app and wait until 5 minutes remaining (default threshold)

**Modal appears:**
```
⏰ Session Expiring Soon

Your session will expire in 5:00 minutes.
Would you like to extend your session?

[Extend Session] [Continue]
```

3. Click **"Extend Session"** → Extension dialog opens
4. OR click **"Continue"** → Modal dismisses

**✅ Success criteria:**
- Modal appears at threshold
- Customizable styling works
- Extension flow works from modal

---

## 🔍 Advanced Testing Scenarios

### Scenario 1: Network Failure Handling

**Test heartbeat failure:**

1. Open DevTools → Network tab
2. Click "Throttling" dropdown → Select "Offline"
3. Wait 30 seconds for heartbeat attempt

**Console logs:**
```
[HeartbeatManager] Heartbeat failed: Network error
[HeartbeatManager] Retry attempt 1/3
[HeartbeatManager] Retry attempt 2/3
[HeartbeatManager] Retry attempt 3/3
[HeartbeatManager] Max heartbeat failures reached, stopping heartbeat system
```

4. Go back online
5. Heartbeat should NOT resume (by design - prevents spam)

**✅ Success criteria:**
- 3 retry attempts
- Graceful degradation
- Session continues without heartbeat

---

### Scenario 2: Expired JWT

**Test JWT expiration:**

1. Generate 1-minute JWT:
   ```bash
   npm run generate-jwt 1
   ```

2. Open app with JWT
3. Wait 1 minute for expiration

**Console logs:**
```
[MarketplaceSDK] Session expired
[MarketplaceSDK] Triggering onSessionEnd
```

**Modal appears:**
```
⏰ Session Expired

Your session has expired.
You will be redirected to the marketplace.

[Return to Marketplace]
```

**✅ Success criteria:**
- Clean expiration handling
- User redirected to marketplace
- No errors or crashes

---

### Scenario 3: Invalid JWT

**Test invalid JWT:**

1. Open app with garbage JWT:
   ```
   http://localhost:3000/provider?gwSession=invalid_jwt_token
   ```

**Console logs:**
```
[MarketplaceSDK] JWT validation failed: Invalid token format
[MarketplaceSDK] Triggering onError
```

**Error screen:**
```
❌ Session Error

Invalid JWT token. Please request a new session
from the marketplace.

[Return to Marketplace]
```

**✅ Success criteria:**
- Clear error message
- No crash
- User redirected

---

## 📊 What to Check in Each Test

### Console Tab
- ✅ No errors (red text)
- ✅ Heartbeat logs every 30s
- ✅ Tab sync messages
- ✅ Visibility API logs
- ✅ Extension/completion logs

### Network Tab
- ✅ POST `/sessions/:id/heartbeat` every 30s
- ✅ PUT `/sessions/:id/renew` for extensions
- ✅ POST `/sessions/:id/complete` for completion
- ✅ All requests return 200 OK

### Application Tab (Storage)
- ✅ `marketplace_jwt` in sessionStorage
- ✅ Tab sync messages in localStorage (if using fallback)

### Performance
- ✅ No memory leaks (check Memory tab)
- ✅ No excessive CPU usage
- ✅ Smooth UI interactions

---

## 🐛 Common Issues & Solutions

### Issue 1: "No JWT token found"

**Solution:**
- Check URL has `?gwSession=<JWT>` parameter
- JWT should be in the URL, not just copied

### Issue 2: Heartbeat not appearing

**Solution:**
- Check `enableHeartbeat: true` in config
- Wait full 30 seconds (default interval)
- Check console for initialization logs

### Issue 3: Multi-tab sync not working

**Solution:**
- Open in **same browser** (not different browsers)
- Check `enableTabSync: true` in config
- Try with 2 tabs in same window

### Issue 4: "Server responded with 500"

**Solution:**
- Restart test server: `npm run test-server-p2`
- Regenerate JWT: `npm run generate-jwt 5`
- Check server console for errors

### Issue 5: Visibility API not working

**Solution:**
- Check `pauseOnHidden: true` in config
- Try minimizing entire browser (not just switching tabs)
- Some browsers need focus change

---

## 🎯 Testing Checklist

Copy this and check off as you test:

```
Phase 2 Feature Testing:

Core Features:
□ SDK initializes without errors
□ Timer counts down correctly
□ JWT validation works
□ Session data displays correctly

Heartbeat System:
□ Heartbeat sends every 30 seconds
□ Console shows heartbeat logs
□ Network shows POST requests
□ Server time syncs correctly
□ Handles 3 failures gracefully

Multi-Tab Sync:
□ Opens in 2 tabs successfully
□ Pause in Tab 1 → Tab 2 pauses
□ Resume in Tab 2 → Tab 1 resumes
□ Extension syncs across tabs
□ Master tab election works
□ Only master sends heartbeats

Session Extension:
□ Extension dialog opens
□ Can select duration (5/15/30/60 min)
□ Timer updates immediately
□ Network request succeeds
□ All tabs sync new time
□ Alert confirms extension

Early Completion:
□ Complete button works
□ Confirmation dialog shows
□ Session ends on confirm
□ Refund calculation shown
□ Network request succeeds
□ Cleanup happens properly

Visibility API:
□ Pause when tab hidden
□ Resume when tab visible
□ Time doesn't advance while hidden
□ Works with minimize
□ Works with tab switch

Error Handling:
□ Invalid JWT shows error
□ Expired JWT handled gracefully
□ Network failures handled
□ No crashes or freezes

Performance:
□ No console errors
□ Smooth UI interactions
□ No memory leaks
□ Network requests efficient
```

---

## 🚀 Next Steps After Testing

1. **If everything works:**
   - ✅ Phase 2 is ready for production!
   - Coordinate with Go backend team for real endpoints
   - Begin pilot provider onboarding

2. **If issues found:**
   - Document issues with screenshots
   - Check console logs for errors
   - Share logs for debugging

3. **Performance testing:**
   - Test with long sessions (60+ minutes)
   - Test with many tabs (5+ open)
   - Monitor memory usage over time

---

## 📞 Need Help?

**Documentation:**
- [PHASE_2_COMPLETE.md](./PHASE_2_COMPLETE.md) - Complete Phase 2 docs
- [README.md](./README.md) - API reference
- [QUICKSTART.md](./QUICKSTART.md) - 3-minute quick start

**Common Questions:**
- "How do I test without a provider?" → Use test server
- "How do I generate JWTs?" → `npm run generate-jwt <minutes>`
- "How do I test multi-tab?" → Open same URL in 2 tabs
- "How do I test backend endpoints?" → Test server mocks them

---

**Happy Testing! 🎉**

*Last updated: November 6, 2025*
*Phase 2 Testing Guide v1.0*
