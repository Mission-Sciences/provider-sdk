# Session Handoff Summary - Marketplace Session Lifecycle Hooks

## 🎯 What We're Building

Enable apps to automatically sync their authentication with marketplace sessions:
- **Auto-login** users when marketplace session starts
- **Force-logout** users when marketplace session ends
- **Prevent access** after session expires
- **Works with any auth system** (Cognito, Auth0, custom, etc.)

## 📁 Key Documents

1. **`COMPLETE_HOOKS_IMPLEMENTATION.md`** ⭐ START HERE
   - Step-by-step implementation guide
   - All code changes needed
   - 9 test scenarios
   - Troubleshooting guide
   - **Estimated time**: 2-3 hours

2. **`SESSION_LIFECYCLE_HOOKS.md`**
   - Architecture overview
   - Design decisions
   - Use cases and examples
   - **Reference material**

3. **`MARKETPLACE_HEARTBEAT_CORS_ISSUE.md`**
   - Known issue: Heartbeat disabled due to CORS
   - Not blocking for hooks implementation
   - Backend work needed separately

## ✅ Already Completed

- [x] Hook type definitions added to SDK
- [x] Types exported from SDK
- [x] JWT persistence through OAuth login
- [x] Session header global mounting
- [x] Multi-tab sync working

## 🚧 Implementation Needed

### SDK Changes (gw-sdk)
**File**: `src/core/MarketplaceSDK.ts`

1. Add `endReason` field (1 line)
2. Update constructor with hook defaults (2 lines)
3. Add `executeHook()` utility method (~30 lines)
4. Add `calculateActualDuration()` method (~5 lines)
5. Call `onSessionStart` hook in `initialize()` (~15 lines)
6. Make `endSession` async and call `onSessionEnd` hook (~40 lines)
7. Update timer initialization for expiration tracking (~20 lines)
8. Call `onSessionExtend` hook in `extendSession()` (~10 lines)

**Total**: ~8 code locations, ~123 lines of code

### GhostDog Changes (extension-ghostdog)

1. **Create**: `src/lib/auth/marketplace-auth.ts` (new file, ~200 lines)
   - `handleMarketplaceSessionStart()` - Auto-login
   - `handleMarketplaceSessionEnd()` - Force logout
   - `handleMarketplaceSessionExtend()` - Update expiration

2. **Update**: `src/ui/contexts/marketplace.context.tsx` (~5 lines)
   - Import handlers
   - Add `hooks` to SDK config

**Total**: 1 new file, 1 file modified

## 🧪 Testing Strategy

**9 Test Scenarios** (all detailed in COMPLETE_HOOKS_IMPLEMENTATION.md):
1. ✅ Hook execution - happy path
2. ✅ Auto-login integration
3. ✅ Session end hook
4. ✅ Session expiration hook
5. ✅ Hook failure - session start (strict)
6. ✅ Hook failure - session end (lenient)
7. ✅ Hook timeout (5 seconds)
8. ✅ Multi-tab sync with hooks
9. ✅ Session extension hook

## 🔧 Build Commands

```bash
# Build SDK
cd /Users/patrick.henry/dev/gw-sdk
npm run build

# Build GhostDog
cd /Users/patrick.henry/dev/extension-ghostdog
npm run build:dev

# Generate test JWT
/tmp/create-session.sh
```

## 🎮 Quick Start for Next Session

```bash
# 1. Open implementation guide
cat /Users/patrick.henry/dev/gw-sdk/planning/COMPLETE_HOOKS_IMPLEMENTATION.md

# 2. Start with SDK changes (Part 1)
code /Users/patrick.henry/dev/gw-sdk/src/core/MarketplaceSDK.ts

# 3. Then GhostDog changes (Part 2)
code /Users/patrick.henry/dev/extension-ghostdog/src/lib/auth/marketplace-auth.ts

# 4. Build both
cd /Users/patrick.henry/dev/gw-sdk && npm run build
cd /Users/patrick.henry/dev/extension-ghostdog && npm run build:dev

# 5. Test (Part 3)
# Open: http://localhost:8080/app.html?jwt=<token>
```

## 🚨 Critical Implementation Notes

### Strict vs Lenient Hooks
- **`onSessionStart`**: STRICT - Failure prevents session from starting
  - Reasoning: If auto-login fails, user shouldn't access app
- **`onSessionEnd`**: LENIENT - Failure logged but doesn't block
  - Reasoning: Session must end even if logout fails
- **`onSessionWarning`**: LENIENT - Non-critical
- **`onSessionExtend`**: LENIENT - Timer still works if this fails

### Hook Timeout
- **Default**: 5000ms (5 seconds)
- **Configurable**: `hookTimeoutMs` in SDK config
- **Purpose**: Prevent hanging if auth system is slow/down

### Error Handling
- SDK uses `executeHook()` utility with timeout wrapper
- Clear error messages: "onSessionStart hook failed: <reason>"
- Hook errors include stack traces in debug mode

### Storage Strategy
**GhostDog uses Option 1**: Store marketplace JWT directly as auth token
- Simplest approach
- App trusts validated JWT
- No additional API calls needed

Alternative options documented in marketplace-auth.ts for other apps.

## 📊 Success Criteria

### Must Have
- [ ] SDK builds without errors
- [ ] GhostDog builds without errors
- [ ] Session start auto-logs in user
- [ ] Session end forces logout
- [ ] Hook failures handled correctly (strict/lenient)
- [ ] All 9 test scenarios pass

### Nice to Have
- [ ] Session extension updates auth
- [ ] Multi-tab sync works with hooks
- [ ] Clear error messages
- [ ] Debug logging comprehensive

## 🔄 Rollback Plan

If hooks cause issues, disable in GhostDog config:
```typescript
// Comment out hooks:
// hooks: {
//   onSessionStart: handleMarketplaceSessionStart,
//   onSessionEnd: handleMarketplaceSessionEnd,
// },
```

SDK works perfectly without hooks (backward compatible).

## 📝 After Implementation

1. Test all scenarios (Part 3 of guide)
2. Verify validation checklist (Part 4 of guide)
3. Document any issues encountered
4. Consider adding to SDK examples/documentation
5. Plan next features:
   - Protected routes in GhostDog
   - User menu integration
   - Analytics/billing integration

## 🤝 Questions for Next Session

If anything is unclear:
1. Check COMPLETE_HOOKS_IMPLEMENTATION.md first
2. Check SESSION_LIFECYCLE_HOOKS.md for architecture
3. Look at code comments in implementation guide
4. Test incrementally - build/test after each major change

## 🎯 Final Checklist Before Starting

- [ ] Read COMPLETE_HOOKS_IMPLEMENTATION.md (Parts 1-7)
- [ ] Understand strict vs lenient hook modes
- [ ] Have test JWT generation script ready
- [ ] Browser DevTools open for debugging
- [ ] Both repos checked out and buildable

---

**Status**: Ready for implementation
**Complexity**: Medium
**Time Estimate**: 2-3 hours
**Risk**: Low (backward compatible, well-tested design)

**Let's build this! 🚀**
