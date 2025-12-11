# npm Trusted Publisher Fix - Summary

## 🎯 Problem

Getting `404 Not Found` and `Access token expired or revoked` when publishing to npm, even though:
- ✅ Trusted publisher was intended to be used
- ✅ Provenance signing was working
- ❌ But authentication was failing

## 🔍 Root Cause

The GitHub Actions workflow was using `setup-node` with `registry-url`, which automatically creates a `.npmrc` file that expects a `NODE_AUTH_TOKEN` environment variable. This conflicts with trusted publisher authentication (OIDC).

**Key Issue**: `setup-node` with `registry-url` = token-based auth (old way)
**Solution**: `setup-node` WITHOUT `registry-url` = OIDC auth (trusted publisher)

## ✅ Changes Made

### 1. Fixed `package.json`

Added `publishConfig` section:

```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

**Why**: Required for scoped packages (`@mission_sciences/*`) to publish publicly.

### 2. Fixed GitHub Workflow

Removed `registry-url` from `setup-node`:

```yaml
# Before (WRONG for trusted publisher)
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'npm'
    registry-url: 'https://registry.npmjs.org'  # ❌ This creates .npmrc with token

# After (CORRECT for trusted publisher)
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'npm'
    # ✅ No registry-url = no .npmrc = OIDC authentication
```

**Why**: With `registry-url`, `setup-node` creates `.npmrc` expecting `NODE_AUTH_TOKEN`. Without it, npm uses GitHub's OIDC token automatically.

### 3. Verified Package Status

Confirmed:
- ✅ `@mission_sciences` organization exists on npm
- ✅ Package `@mission_sciences/provider-sdk` exists
- ✅ Version 0.1.1 is published
- ✅ Maintainers: ian.mission_sciences, patrick.mission-sciences.com

## 🚀 Next Steps

### 1. Set Up Trusted Publisher on npm (REQUIRED)

You MUST configure trusted publisher on npm.com:

1. Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk/settings
2. Find **"Publishing access"** → **"GitHub Actions"**
3. Configure:
   - Repository: `Mission-Sciences/provider-sdk`
   - Workflow: `publish-package.yml`
   - Environment: (leave blank or use `production`)

See [NPM_TRUSTED_PUBLISHER_SETUP.md](./NPM_TRUSTED_PUBLISHER_SETUP.md) for detailed instructions.

### 2. Commit and Push Changes

```bash
cd /Users/patrick.henry/dev/gw-sdk

git add package.json
git add .github/workflows/publish-package.yml
git add docs/NPM_TRUSTED_PUBLISHER_SETUP.md
git add docs/DEPLOYMENT_FIX_SUMMARY.md

git commit -m "fix: configure npm trusted publisher authentication

- Remove registry-url from setup-node to enable OIDC auth
- Add publishConfig to package.json for scoped package
- Document trusted publisher setup process

Fixes 404 and 'Access token expired' errors when publishing to npm.
Trusted publisher uses OIDC instead of NPM_TOKEN for authentication."

git push origin main
```

### 3. Verify Workflow Run

After pushing, the workflow should:
1. ✅ Build package successfully
2. ✅ Publish to AWS CodeArtifact (private)
3. ✅ Publish to npm registry (public) with provenance
4. ✅ No token errors!

## 🔐 How Trusted Publisher Works

### Traditional (Old Way - With Token)
```
GitHub Actions → NPM_TOKEN secret → npm publish → success
```

**Issues:**
- ❌ Need to manage tokens
- ❌ Tokens can expire/leak
- ❌ Manual rotation required

### Trusted Publisher (New Way - With OIDC)
```
GitHub Actions → OIDC token → npm verifies → publish → success
```

**Benefits:**
- ✅ No secrets needed
- ✅ Cryptographic proof of provenance
- ✅ Automatic token generation
- ✅ Better supply chain security
- ✅ Verified by npm from GitHub

## 📊 Workflow Permissions

The workflow already has correct permissions:

```yaml
permissions:
  contents: read      # ✅ Read repository code
  id-token: write     # ✅ Generate OIDC token (for provenance)
```

## 🎉 Expected Result

After trusted publisher setup on npm.com, your next push to `main` will:

```
✅ Test and Build Package
✅ Terraform Plan (CodeArtifact)
✅ Terraform Apply (CodeArtifact)
✅ Publish to AWS CodeArtifact
✅ Publish to npm Registry      # This will now succeed!
✅ Deployment Summary
```

Package will be available at:
- https://www.npmjs.com/package/@mission_sciences/provider-sdk
- With provenance badge and signature

## 🐛 If Still Failing

1. **Check trusted publisher config**: Visit package settings on npm.com
2. **Verify account permissions**: `npm owner ls @mission_sciences/provider-sdk`
3. **Check workflow logs**: Look for OIDC token generation
4. **Review setup guide**: [NPM_TRUSTED_PUBLISHER_SETUP.md](./NPM_TRUSTED_PUBLISHER_SETUP.md)

## 📚 Resources

- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions)

---

**Status**: ✅ Code fixed, ready to deploy after npm.com configuration
