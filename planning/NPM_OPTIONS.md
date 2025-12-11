# npm Publishing Options for GitHub Actions

## TL;DR Recommendation

**Use the public npm registry** with an npm token (no OIDC alternative exists for npm).

Add `NPM_TOKEN` as an **org secret** (same as `AWS_ROLE_ARN`) so all Mission-Sciences repos can use it.

---

## Option 1: Public npm Registry (Recommended) ⭐

**Registry**: `https://registry.npmjs.org` (the main one)
**Package URL**: https://www.npmjs.com/package/@mission_sciences/provider-sdk
**Installation**: `npm install @mission_sciences/provider-sdk`

### Pros
✅ **Most discoverable** - Shows up on npmjs.com search
✅ **Standard installation** - No `.npmrc` configuration needed
✅ **Better for public packages** - Expected location
✅ **Global CDN** - Fast downloads worldwide
✅ **npm website features** - Package page, download stats, etc.

### Cons
❌ **Requires npm token** - No OIDC/automatic auth available
❌ **Token rotation** - Need to rotate tokens periodically

### Setup

1. **Generate npm Token** (Automation type, no expiration):
   ```bash
   npm login --scope=@mission_sciences
   npm token create --read-only=false
   ```

   Or via website: https://www.npmjs.com/settings/mission_sciences/tokens

2. **Add as GitHub Org Secret**:
   - Go to: https://github.com/organizations/Mission-Sciences/settings/secrets/actions
   - Name: `NPM_TOKEN`
   - Value: Your npm token
   - Access: All repositories (or specific repos)

3. **Workflow uses it automatically**:
   ```yaml
   - name: Publish to npm
     run: npm publish
     env:
       NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

---

## Option 2: GitHub Packages (npm on GitHub)

**Registry**: `https://npm.pkg.github.com`
**Package URL**: https://github.com/Mission-Sciences/provider-sdk/packages
**Installation**: Requires `.npmrc` configuration

### Pros
✅ **No npm account needed** - Uses GitHub identity
✅ **Automatic authentication** - Uses built-in `GITHUB_TOKEN`
✅ **Free for public repos** - No cost
✅ **Integrated with GitHub** - Package page alongside code
✅ **No token rotation** - `GITHUB_TOKEN` auto-rotates

### Cons
❌ **Requires `.npmrc` setup** - Users must configure registry
❌ **Not on npmjs.com** - Lower discoverability
❌ **Different registry** - Not the "standard" location
❌ **GitHub authentication for private** - Users need GitHub PAT for private packages

### User Installation (More Complex)

Users must configure their `.npmrc`:
```bash
# Add to .npmrc
@mission_sciences:registry=https://npm.pkg.github.com

# Then install
npm install @mission_sciences/provider-sdk
```

Or with scoped registry in `package.json`:
```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Workflow Setup

Update `.github/workflows/publish-package.yml`:

```yaml
- name: Setup Node.js with GitHub Packages
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@mission_sciences'

- name: Publish to GitHub Packages
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Automatically available!
```

**Benefit**: No npm token needed! `GITHUB_TOKEN` is automatically provided.

---

## Option 3: Dual Publishing (Both Registries)

Publish to **both** npm and GitHub Packages for maximum reach.

### Why?
- **npm**: Public discoverability, standard location
- **GitHub Packages**: Internal/backup, no token needed

### Workflow Changes

Add a second publish job:

```yaml
publish-github-packages:
  name: Publish to GitHub Packages
  runs-on: ubuntu-latest
  needs: [test-and-build]
  if: github.event.inputs.skip_github_packages != 'true'

  permissions:
    contents: read
    packages: write

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js with GitHub Packages
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        registry-url: 'https://npm.pkg.github.com'
        scope: '@mission_sciences'

    - name: Download build artifacts
      uses: actions/download-artifact@v4
      with:
        name: build-output
        path: .

    - name: Publish to GitHub Packages
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Result**: Package available on both registries!

---

## Comparison Matrix

| Feature | npm Registry | GitHub Packages | Both |
|---------|-------------|-----------------|------|
| **Authentication** | npm token | `GITHUB_TOKEN` (auto) | Both |
| **User Install** | `npm install @mission_sciences/pkg` | Requires `.npmrc` | npm simpler |
| **Discoverability** | High (npmjs.com) | Low (GitHub only) | High |
| **Cost** | Free for public | Free for public | Free |
| **CDN** | Global npm CDN | GitHub CDN | Both |
| **Token Management** | Manual rotation | Auto-rotates | Mixed |
| **Standard Location** | Yes ✅ | No | Yes |

---

## My Recommendation for provider-sdk

**Use npm Registry (Option 1)** because:

1. ✅ **It's a public SDK** - Should be easily discoverable
2. ✅ **Standard location** - Users expect packages on npmjs.com
3. ✅ **Simple installation** - No `.npmrc` configuration needed
4. ✅ **Better package page** - npm website has better UX than GitHub Packages
5. ✅ **Current plan** - Already designed for npm in requirements

**Add NPM_TOKEN as org secret** (like you did with AWS_ROLE_ARN) so it's reusable across repos.

---

## Setting Up npm Token as Org Secret

### Step 1: Generate npm Token

**Via npm CLI:**
```bash
npm login --scope=@mission_sciences
npm token create --read-only=false
```

**Via npm Website:**
1. Go to: https://www.npmjs.com/settings/mission_sciences/tokens
2. Click **"Generate New Token"**
3. Choose **"Automation"** (recommended)
4. Token settings:
   - **No expiration** (or set custom)
   - **Packages**: Select `@mission_sciences` scope
   - **Permissions**: Read and write
5. **Copy token immediately** (starts with `npm_...`)

### Step 2: Add as Organization Secret

1. Go to: https://github.com/organizations/Mission-Sciences/settings/secrets/actions
2. Click **"New organization secret"**
3. Configuration:
   - **Name**: `NPM_TOKEN`
   - **Secret**: Paste your npm token
   - **Repository access**:
     - Option A: "All repositories" (recommended for org-wide use)
     - Option B: "Private repositories" only
     - Option C: "Selected repositories" → Choose `provider-sdk`
4. Click **"Add secret"**

### Step 3: Verify in Workflow

Your workflow already references it correctly:
```yaml
- name: Publish to npm
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This works with org-level secrets automatically!

---

## GitHub's npm Integration Summary

**What exists:**
- ✅ GitHub Packages (npm registry on GitHub)
- ✅ `GITHUB_TOKEN` auto-authentication for GitHub Packages
- ❌ **NO OIDC for public npm registry** (registry.npmjs.org)

**What doesn't exist:**
- ❌ OIDC authentication for npm registry
- ❌ Automatic tokens for npm registry
- ❌ GitHub-native auth for npm registry

**Bottom line**: For the **public npm registry**, you need an npm token. No way around it!

---

## Security Best Practices

### npm Token Security

1. **Use Automation tokens** (not Classic/Granular when possible)
2. **Scope to organization** (`@mission_sciences` only)
3. **Org-level secret** (like `AWS_ROLE_ARN`)
4. **Rotate periodically** (every 90 days recommended)
5. **Monitor usage** (npm shows token usage stats)

### Org Secret Benefits

✅ **Single token for all repos** - Add once, use everywhere
✅ **Centralized management** - Update in one place
✅ **Consistent authentication** - Same token across projects
✅ **Easier rotation** - Update one secret, affects all repos

### Token Rotation Reminder

Set a calendar reminder to rotate npm token every 90 days:
```bash
# When rotating:
npm token create --read-only=false
# Update GitHub org secret with new token
# Revoke old token on npm website
```

---

## Quick Decision Guide

**Choose npm Registry if:**
- ✅ Package should be publicly discoverable
- ✅ Users expect standard `npm install`
- ✅ You want package on npmjs.com
- ✅ **This is your case!**

**Choose GitHub Packages if:**
- ✅ Internal package only
- ✅ Prefer GitHub integration
- ✅ Don't want to manage npm tokens
- ✅ Users are already in GitHub ecosystem

**Choose Both if:**
- ✅ Want maximum reach
- ✅ Need backup registry
- ✅ Don't mind extra publish step

---

## Next Steps

1. ✅ **AWS_ROLE_ARN**: Already added as org secret
2. ⏱️ **NPM_TOKEN**: Add as org secret (same process)
3. ⏱️ **Push code**: Everything else is ready!

**Command to generate npm token:**
```bash
npm login --scope=@mission_sciences
npm token create --read-only=false
```

Then add to: https://github.com/organizations/Mission-Sciences/settings/secrets/actions
