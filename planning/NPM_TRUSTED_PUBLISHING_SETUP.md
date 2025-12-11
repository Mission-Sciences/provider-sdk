# npm Trusted Publishing Setup Guide

## Overview

npm Trusted Publishing allows GitHub Actions to publish packages using OIDC authentication **without requiring an npm token**. This is more secure and provides cryptographic provenance attestation.

---

## Benefits

✅ **No tokens** - No NPM_TOKEN to create or rotate
✅ **Provenance** - Cryptographic proof of package origin
✅ **Supply chain security** - Verifiable build attestations
✅ **Auto-signing** - Packages automatically signed
✅ **GitHub verified** - Users can verify packages came from your repo

---

## Prerequisites

- ✅ Package name: `@mission_sciences/provider-sdk`
- ✅ GitHub repository: `Mission-Sciences/provider-sdk`
- ✅ npm organization: `mission_sciences`
- ✅ Organization admin access on npm

---

## Setup Steps

### Step 1: Configure npm Package for Trusted Publishing

**Option A: For NEW package (not yet published)**

You need to publish version 0.1.1 **first time** using a token (one-time), then configure Trusted Publishing.

1. **Generate temporary npm token** (just for first publish):
   ```bash
   npm login --scope=@mission_sciences
   npm token create --read-only=false
   ```

2. **Add as GitHub secret temporarily**:
   - Go to: https://github.com/Mission-Sciences/provider-sdk/settings/secrets/actions
   - Name: `NPM_TOKEN`
   - Value: Your token

3. **First publish** (via GitHub Actions):
   - Comment out `--provenance` flag temporarily
   - Push to trigger workflow
   - Package publishes with token

4. **Then configure Trusted Publishing** (see Option B below)

5. **Delete npm token** from GitHub secrets after configuring Trusted Publishing

---

**Option B: For EXISTING package (already published to npm)**

If `@mission_sciences/provider-sdk` already exists on npm:

1. **Log in to npmjs.com** as organization admin

2. **Navigate to package settings**:
   - Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk/access
   - Or: npmjs.com → Your profile → Packages → provider-sdk → Settings

3. **Configure Publishing Access**:
   - Scroll to "Publishing Access"
   - Look for "Trusted Publishers" or "GitHub Actions" section

4. **Add GitHub as trusted publisher**:
   - Click "Add Trusted Publisher" or similar
   - Select "GitHub Actions"
   - Fill in:
     - **Repository owner**: `Mission-Sciences`
     - **Repository name**: `provider-sdk`
     - **Workflow file**: `publish-package.yml`
     - **Environment** (optional): Leave blank or use `production`

5. **Save configuration**

---

### Step 2: Verify npm Organization Settings

1. **Go to organization settings**:
   - https://www.npmjs.com/settings/mission_sciences/packages

2. **Check Trusted Publishing is enabled**:
   - Ensure "Granular Access Tokens" and "Automation Tokens" are enabled
   - Verify OIDC/Trusted Publishing feature is available

3. **Check package visibility**:
   - Package should be set to "Public"
   - Ensure publishing is not restricted

---

### Step 3: Update package.json (Already Done)

Verify `package.json` has correct configuration:

```json
{
  "name": "@mission_sciences/provider-sdk",
  "publishConfig": {
    "access": "public"
  }
}
```

✅ Already configured in your package.json

---

### Step 4: Test Publishing

#### Manual Test (Recommended First)

1. **Trigger workflow manually**:
   - Go to: https://github.com/Mission-Sciences/provider-sdk/actions
   - Select "Build and Publish Package"
   - Click "Run workflow"
   - Branch: `main`
   - Skip CodeArtifact: No
   - Skip npm: No
   - Run workflow

2. **Monitor npm publish step**:
   - Watch for "Publish to npm Registry with Provenance" job
   - Should complete without token errors
   - Should show provenance attestation created

3. **Verify on npm**:
   - Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk
   - Should see "Provenance" badge
   - Click badge to view attestation details

#### Automatic Test

Push to main branch to trigger automatic publish:

```bash
git push github main
```

---

## Troubleshooting

### Error: "npm ERR! need auth This command requires you to be logged in"

**Cause**: Trusted Publishing not configured on npm, or configuration incorrect.

**Fix**:
1. Verify package exists on npm
2. Verify you added GitHub as trusted publisher
3. Check repository name and workflow file name match exactly
4. Ensure you have admin access to npm package

---

### Error: "npm ERR! 403 Forbidden"

**Cause**: Package already exists and you're not authorized, or scope is wrong.

**Fix**:
1. Verify you're an admin of `@mission_sciences` org on npm
2. Check package name matches exactly
3. Verify `publishConfig.access` is set to "public"

---

### Error: "Cannot read property 'sub' of undefined"

**Cause**: Missing `id-token: write` permission in workflow.

**Fix**: ✅ Already added to workflow in `publish-npm` job

---

### Provenance attestation not created

**Cause**: Missing `--provenance` flag or permissions.

**Fix**: ✅ Already added to workflow:
```yaml
npm publish --provenance --access public
```

---

### First publish fails with OIDC error

**Cause**: Package doesn't exist yet, can't configure Trusted Publishing before first publish.

**Solution**: Use "Option A" from Step 1 - publish first version with token, then configure Trusted Publishing.

---

## Verification Checklist

After successful publish, verify:

- [ ] Package visible on npm: https://www.npmjs.com/package/@mission_sciences/provider-sdk
- [ ] **Provenance badge** visible on package page
- [ ] Clicking provenance badge shows:
  - ✅ GitHub repository link
  - ✅ Commit SHA
  - ✅ Workflow run link
  - ✅ Cryptographic signature
- [ ] Installation works: `npm install @mission_sciences/provider-sdk`
- [ ] No NPM_TOKEN secret needed in GitHub

---

## What Users See

When your package has provenance:

### On npmjs.com Package Page

```
┌─────────────────────────────────────────────┐
│ @mission_sciences/provider-sdk              │
│                                             │
│ [Provenance ✓] Published from GitHub       │
│                                             │
│ Source: Mission-Sciences/provider-sdk       │
│ Commit: abc123def                           │
│ Workflow: publish-package.yml               │
└─────────────────────────────────────────────┘
```

### During Installation

```bash
$ npm install @mission_sciences/provider-sdk

# npm automatically verifies provenance
✓ Verified provenance for @mission_sciences/provider-sdk@0.1.1
  Source: https://github.com/Mission-Sciences/provider-sdk
  Commit: abc123def456
```

---

## Migration from Token-Based Publishing

### Current State (Before Migration)

If you previously published with NPM_TOKEN:

1. ✅ Package exists on npm
2. ✅ Uses token authentication
3. ❌ No provenance attestations
4. ❌ Token needs rotation

### After Migration (With Trusted Publishing)

1. ✅ Package exists on npm
2. ✅ Uses OIDC authentication
3. ✅ Automatic provenance attestations
4. ✅ No token to manage

### Migration Steps

1. **Configure Trusted Publishing** (Step 1, Option B)
2. **Update workflow** (✅ Already done)
3. **Remove NPM_TOKEN** from GitHub secrets
4. **Test publish** with new workflow
5. **Verify provenance** on npm package page

---

## Security Improvements

### Before (Token-Based)

- ❌ Long-lived credentials
- ❌ Manual token rotation needed
- ❌ Token theft risk
- ❌ No provenance
- ❌ Can't verify package origin

### After (Trusted Publishing)

- ✅ Temporary credentials (auto-expire)
- ✅ No token rotation needed
- ✅ No token theft risk
- ✅ Cryptographic provenance
- ✅ Verifiable package origin

---

## npm CLI Verification

Users can verify your package provenance:

```bash
# Install package
npm install @mission_sciences/provider-sdk

# View provenance details
npm view @mission_sciences/provider-sdk --json | jq .dist.attestations

# Output shows:
{
  "url": "https://registry.npmjs.org/-/npm/v1/attestations/...",
  "provenance": {
    "predicateType": "https://slsa.dev/provenance/v1"
  }
}
```

---

## GitHub Actions Summary

After successful publish, workflow shows:

```
### npm Publishing Summary

- Package: @mission_sciences/provider-sdk
- Version: 0.1.1
- Registry: https://registry.npmjs.org
- Status: success
- Provenance: ✓ Attestation created
- Authentication: GitHub OIDC (Trusted Publishing)
- Package URL: https://www.npmjs.com/package/@mission_sciences/provider-sdk

✅ Package published with cryptographic provenance
```

---

## References

- **npm Trusted Publishing docs**: https://docs.npmjs.com/generating-provenance-statements
- **GitHub OIDC docs**: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- **SLSA provenance**: https://slsa.dev/provenance/

---

## Quick Start Commands

```bash
# 1. Configure npm (web UI - see Step 1 above)

# 2. Push code to GitHub
cd /Users/patrick.henry/dev/gw-sdk
git add .
git commit -m "chore: enable npm Trusted Publishing with provenance"
git push github main

# 3. Watch workflow
# https://github.com/Mission-Sciences/provider-sdk/actions

# 4. Verify package
npm view @mission_sciences/provider-sdk

# 5. Test installation
npm install @mission_sciences/provider-sdk
```

---

## Summary

✅ **No npm token needed** - OIDC authentication
✅ **More secure** - Temporary credentials only
✅ **Provenance** - Cryptographically signed packages
✅ **Supply chain security** - Verifiable build attestations
✅ **Same as AWS** - Both use OIDC now!

**Next step**: Configure Trusted Publishing on npmjs.com, then push to GitHub!
