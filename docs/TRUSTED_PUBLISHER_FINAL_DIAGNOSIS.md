# Trusted Publisher - Final Diagnosis

## Summary

After extensive debugging, npm publishing fails with:
```
npm notice publish Signed provenance statement [SUCCESS]
npm notice Access token expired or revoked
npm error 404 Not Found
```

## What We've Tried

1. ✅ Removed `registry-url` from setup-node
2. ✅ Added `publishConfig` to package.json
3. ✅ Deleted `NPM_TOKEN` secret
4. ✅ Unsetting env vars in publish step
5. ✅ Removing `.npmrc` files
6. ✅ Upgrading npm to latest version
7. ✅ Verified npm 10.8.2+ supports provenance

## What Works

- ✅ Provenance signing (OIDC token generated)
- ✅ Sigstore transparency log publishing
- ✅ GitHub Actions OIDC permissions correct
- ✅ Workflow configuration correct

## What Doesn't Work

- ❌ npm registry publishing (404 + token expired)
- ❌ npm uses token auth instead of OIDC

## Most Likely Root Cause

**The trusted publisher configuration on npm.com is NOT actually saved/active.**

### Evidence

1. Provenance signing works → OIDC token IS being generated
2. Publishing fails → npm is NOT accepting the OIDC token
3. Error message → npm expects a token, not OIDC

This exact error pattern occurs when:
- Trusted publisher form is filled out but NOT saved
- Trusted publisher is saved at USER level but package is under ORGANIZATION
- Trusted publisher requires email verification/2FA that isn't complete

## Required Verification Steps

### 1. Verify Trusted Publisher is SAVED

Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk/settings

**Look for SAVED configuration** (not just the form):
- Should show "GitHub Actions" with green checkmark/badge
- Should display: Mission-Sciences/provider-sdk/publish-package.yml
- Should have "Remove" or "Edit" button (not "Save")

**If you only see the ADD form:**
- The configuration was NOT saved
- Fill it out and click "Save changes"
- Refresh the page to confirm it's saved

### 2. Check Package for Provenance Badge

Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk

**On version 0.1.1:**
- Is there a "Provenance" section?
- Does it show "Published from GitHub Actions"?
- This confirms trusted publisher worked for that version

### 3. Verify Organization vs User

The package is scoped: `@mission_sciences/provider-sdk`

**Trusted publisher MUST be configured at the ORGANIZATION level:**
- NOT at: https://www.npmjs.com/settings/YOUR-USER/packages/...
- YES at: https://www.npmjs.com/org/mission_sciences/packages/...

### 4. Check Organization Membership

Go to: https://www.npmjs.com/org/mission_sciences/members

**Verify:**
- Your npm account is a member
- You have "Owner" or "Developer" role (can publish)
- 2FA is enabled (required for scoped packages)

### 5. Verify Account Status

**Check your npm account:**
- Email is verified
- 2FA is enabled
- No security holds
- No pending actions required

## If Everything Checks Out

If trusted publisher IS properly saved and you meet all requirements, the issue might be:

1. **npm.com bug** - Rare but possible
2. **Propagation delay** - Wait 24h after saving
3. **Organization-level permissions** - Contact npm support

## Alternative: Manual Publish Test

To verify trusted publisher works, try manual publish from local:

```bash
# This will FAIL (you need GitHub OIDC):
npm publish --provenance --access public

# Expected error: "provenance attestation generation failed"
# This confirms npm knows about provenance but needs GitHub OIDC
```

If you get a DIFFERENT error (like "already published"), trusted publisher might be working but GitHub workflow has other issues.

## Next Steps

1. **Verify trusted publisher is SAVED on npm.com**
2. **Check it's at ORGANIZATION level, not user level**
3. **Confirm 2FA and email verification**
4. **If all verified, contact npm support**

The fact that provenance signing works but publishing fails is a strong indicator the trusted publisher config isn't fully active on npm's side.

---

**Current Test**: Workflow running with npm@latest to see if newer npm version handles OIDC differently.

**Expected**: Will still fail unless npm.com trusted publisher is properly saved.
