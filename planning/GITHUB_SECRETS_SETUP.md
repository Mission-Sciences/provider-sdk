# GitHub Secrets Setup - Quick Reference

## ✅ AWS OIDC Role Created!

**Role ARN**: `arn:aws:iam::540845145946:role/GitHubActions-ProviderSDK`

This role has been created with **least-privilege permissions** for:
- ✅ CodeArtifact publishing
- ✅ Terraform infrastructure management
- ✅ Cognito integration testing
- ✅ SSM Parameter Store access

**Security**: Only allows GitHub Actions from `Mission-Sciences/provider-sdk` on the `main` branch.

---

## 🔐 Required GitHub Secrets

### Step 1: Navigate to Repository Secrets

Go to: https://github.com/Mission-Sciences/provider-sdk/settings/secrets/actions

### Step 2: Add AWS Role ARN Secret

Click **"New repository secret"**

**Secret 1: AWS_ROLE_ARN**
```
Name:  AWS_ROLE_ARN
Value: arn:aws:iam::540845145946:role/GitHubActions-ProviderSDK
```

**That's it for AWS!** No more access keys needed - OIDC handles authentication automatically.

---

### Step 3: Add npm Token Secret

You need to generate an npm automation token for the `@mission_sciences` scope.

#### Generate npm Token

**Option A: npm CLI**
```bash
# Login to npm
npm login --scope=@mission_sciences

# Create automation token
npm token create --read-only=false

# Copy the token (starts with npm_...)
```

**Option B: npm Website**
1. Go to: https://www.npmjs.com/settings/mission_sciences/tokens
2. Click **"Generate New Token"**
3. Select **"Automation"** token type (recommended)
4. If using Granular token:
   - Expiration: No expiration (or set custom)
   - Packages and scopes: Select `@mission_sciences`
   - Permissions: ✅ Read and write
5. Click **"Generate Token"**
6. **Copy immediately** (shown only once!)

#### Add to GitHub

Click **"New repository secret"**

**Secret 2: NPM_TOKEN**
```
Name:  NPM_TOKEN
Value: npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### Step 4: Add Integration Test Secrets (If Not Already Present)

These may already exist from the existing test-integration.yml workflow. Add only if missing:

**Secret 3: API_BASE_URL**
```
Name:  API_BASE_URL
Value: https://api.generalwisdom.com
```

**Secret 4: COGNITO_USER_POOL_ID**
```
Name:  COGNITO_USER_POOL_ID
Value: us-east-1_xxxxxxxxx
```

**Secret 5: COGNITO_CLIENT_ID**
```
Name:  COGNITO_CLIENT_ID
Value: xxxxxxxxxxxxxxxxxxxxxxxxx
```

**Secret 6: COGNITO_REGION** (optional)
```
Name:  COGNITO_REGION
Value: us-east-1
```

**Secret 7: TEST_USERNAME**
```
Name:  TEST_USERNAME
Value: test@example.com
```

**Secret 8: TEST_PASSWORD**
```
Name:  TEST_PASSWORD
Value: YourSecureTestPassword123!
```

---

## ✅ Verification Checklist

After adding secrets, verify:

- [ ] Total secrets count: **8** (2 new + 6 existing)
- [ ] `AWS_ROLE_ARN` shows in list
- [ ] `NPM_TOKEN` shows in list
- [ ] All integration test secrets present (from existing workflow)
- [ ] No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` (not needed with OIDC!)

---

## 🚀 What's Next?

1. ✅ **AWS OIDC Role**: Created (you're done!)
2. ⏱️ **GitHub Secrets**: Add the 2 secrets above
3. ⏱️ **Push Code**: Push to GitHub to trigger workflow
4. ⏱️ **Monitor**: Watch Actions tab for first run

---

## 🔒 Security Benefits of OIDC

Compared to the old Bitbucket setup:

| Feature | Bitbucket | GitHub (New) |
|---------|-----------|--------------|
| **Auth Method** | OIDC ✅ | OIDC ✅ |
| **Credentials Stored** | None ✅ | None ✅ |
| **Permissions** | Admin (very broad) ⚠️ | Least-privilege ✅ |
| **Credential Rotation** | Not needed ✅ | Not needed ✅ |
| **CloudTrail Auditing** | Yes ✅ | Yes ✅ |
| **Branch Restrictions** | No ❌ | Yes (main only) ✅ |

**Your new GitHub setup is MORE SECURE than Bitbucket!**

---

## 🛠️ Troubleshooting

### Issue: "Role cannot be assumed"

**Cause**: Trust policy doesn't match repository.

**Fix**: Verify you're pushing from `Mission-Sciences/provider-sdk` to `main` branch.

### Issue: "npm publish fails with 403"

**Cause**: npm token doesn't have publish permissions.

**Fix**: Regenerate token with "Automation" type and full write permissions.

### Issue: "CodeArtifact access denied"

**Cause**: Permissions policy issue (unlikely - we just created it).

**Fix**: Verify role has `GitHubActions-ProviderSDK-Permissions` policy attached:
```bash
aws iam list-attached-role-policies --role-name GitHubActions-ProviderSDK
```

### Issue: "Integration tests failing"

**Cause**: Test secrets not configured or incorrect.

**Fix**: Verify all 6 integration test secrets are present and have correct values from your existing test workflow.

---

## 📋 Quick Copy-Paste Checklist

**For GitHub Secrets Page:**

```
Secret 1:
Name: AWS_ROLE_ARN
Value: arn:aws:iam::540845145946:role/GitHubActions-ProviderSDK

Secret 2:
Name: NPM_TOKEN
Value: [Generate from npm - see instructions above]
```

**Existing secrets to verify are present:**
- API_BASE_URL
- COGNITO_USER_POOL_ID
- COGNITO_CLIENT_ID
- COGNITO_REGION (optional)
- TEST_USERNAME
- TEST_PASSWORD

---

## 🎯 Ready to Deploy

Once secrets are configured:

```bash
cd /Users/patrick.henry/dev/gw-sdk

# Commit all changes
git add .
git commit -m "chore: migrate to @mission_sciences scope with OIDC auth"

# Add GitHub remote (if not done)
git remote add github https://github.com/Mission-Sciences/provider-sdk.git

# Push to GitHub
git push github main

# Watch workflow
# https://github.com/Mission-Sciences/provider-sdk/actions
```

**That's it! The workflow will automatically authenticate via OIDC and publish to both registries.** 🚀
