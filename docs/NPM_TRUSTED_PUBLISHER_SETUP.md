# npm Trusted Publisher Setup Guide

## ✅ What We Fixed

1. **Added `publishConfig` to package.json** - Required for scoped packages
2. **Removed `registry-url` from workflow** - This was creating `.npmrc` with token placeholder
3. **Verified package scope exists** - `@mission_sciences` is valid on npm

## 🔐 Set Up Trusted Publisher on npm

**IMPORTANT**: You must configure trusted publisher on npm.com to publish without tokens.

### Step 1: Log in to npm

Go to https://www.npmjs.com and log in with an account that has publish access to `@mission_sciences/provider-sdk`.

### Step 2: Navigate to Package Settings

1. Go to: https://www.npmjs.com/package/@mission_sciences/provider-sdk
2. Click **"Settings"** tab
3. Scroll to **"Publishing access"** section

### Step 3: Add GitHub Actions as Trusted Publisher

Look for **"Automation tokens and granular access tokens"** section.

Click **"Configure GitHub Actions"** (or similar button).

### Step 4: Configure Repository Access

Enter these exact values:

- **Repository owner**: `Mission-Sciences`
- **Repository name**: `provider-sdk`
- **Workflow filename**: `publish-package.yml`
- **Environment** (optional): Leave blank or use `production`

### Step 5: Save Configuration

Click **"Add"** or **"Save"** to complete setup.

## ✅ Verify Setup

### 1. Check Package Maintainers

```bash
npm owner ls @mission_sciences/provider-sdk
```

You should see:
```
ian.mission_sciences <ian@mission-sciences.com>
patrick.mission-sciences.com <patrick@mission-sciences.com>
```

### 2. Check Organization Members

Go to: https://www.npmjs.com/org/mission_sciences/members

Verify your GitHub account can publish.

### 3. Test Publish (Dry Run)

After committing the changes:

```bash
# Push to main branch
git add .
git commit -m "fix: configure trusted publisher for npm"
git push origin main

# Or manually trigger workflow
gh workflow run publish-package.yml
```

## 🚀 What Happens Now

When you push to main or create a release:

1. ✅ GitHub generates OIDC token automatically
2. ✅ npm verifies token came from your configured repo/workflow
3. ✅ Package publishes with provenance attestation
4. ✅ No secrets or tokens needed!

## 🔍 Troubleshooting

### Still getting "Access token expired"?

**Option A: Trusted Publisher Not Configured**

Follow steps above to configure on npm.com.

**Option B: Wrong Account**

Make sure the npm account you're logged in with:
- Is a maintainer of `@mission_sciences/provider-sdk`
- Is a member of `@mission_sciences` organization
- Has publish permissions

**Option C: Environment Protection Rules**

If you added `environment: production` to the workflow:
1. Go to GitHub repo → **Settings** → **Environments**
2. Click **"production"** environment
3. Remove any deployment branch restrictions
4. Or configure to allow `main` branch

### Check if Trusted Publisher is Configured

Visit: https://www.npmjs.com/package/@mission_sciences/provider-sdk/access

You should see **"GitHub Actions"** in the publishing access section with your repo listed.

### Still Not Working?

Run this to check what npm sees:

```bash
npm whoami --registry https://registry.npmjs.org
```

If you get an error, you need to configure trusted publisher on npm.com.

## 📚 Additional Resources

- [npm Trusted Publishing Docs](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance Guide](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions)

## 🎯 Quick Reference

**Workflow Permissions Required:**
```yaml
permissions:
  contents: read      # Read repo
  id-token: write     # Generate OIDC token
```

**Package.json Config Required:**
```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

**Publish Command:**
```bash
npm publish --provenance --access public
```

**NO Token Needed:**
- ❌ No `NPM_TOKEN` secret
- ❌ No `NODE_AUTH_TOKEN` env var
- ❌ No `.npmrc` with auth
- ✅ Only OIDC `id-token: write` permission

---

**After setup**, your next push to `main` should publish version 0.1.2 successfully! 🎉
