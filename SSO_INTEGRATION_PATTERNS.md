# SSO Integration Patterns - How Marketplace Auth Works with Any Provider

**Question**: How does marketplace SSO work when every provider app has different auth systems?

**Answer**: The marketplace **replaces** the provider's auth system for marketplace users. The provider doesn't need to change their auth - they just need to add a "marketplace path" that bypasses it.

---

## The Core Insight

**Traditional Flow** (Provider manages their own auth):
```
User → Provider Login Page → Username/Password → Provider creates session
```

**Marketplace Flow** (Marketplace manages auth):
```
User → Marketplace (already authenticated) → Provider with JWT → Provider trusts JWT → Provider creates session
```

**Key Point**: The JWT from the marketplace is **proof of identity**. The provider doesn't need to verify credentials - the marketplace already did that.

---

## Pattern 1: JWT-Based Trust (Recommended for MVP)

### How It Works

```typescript
// Provider App: /app/marketplace-entry
// This is the ONLY new code the provider writes

async function handleMarketplaceEntry(req: Request) {
  const sessionJWT = req.query.gwSession;

  // 1. Validate JWT via SDK (automatic signature verification)
  const sdk = new MarketplaceSDK({
    applicationId: 'provider-app-123',
    jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json'
  });

  await sdk.initialize(); // Validates JWT from URL

  // 2. Provision user from JWT claims (one API call)
  const marketplaceUser = await sdk.provisionUser();
  // Returns: { email, name, provider_user_id, marketplace_user_id }

  // 3. Create/update user in YOUR database
  let localUser = await db.users.findOne({
    email: marketplaceUser.email
  });

  if (!localUser) {
    // First time from marketplace - create user
    localUser = await db.users.create({
      email: marketplaceUser.email,
      name: marketplaceUser.name,
      auth_source: 'marketplace',
      marketplace_user_id: marketplaceUser.marketplace_user_id,
      email_verified: true // Marketplace already verified
    });
  }

  // 4. Create YOUR app's session (however you normally do it)
  const sessionId = await createAppSession(localUser.id);
  res.cookie('app_session', sessionId, { httpOnly: true });

  // 5. Redirect to your app's dashboard
  res.redirect('/dashboard');
}
```

### What the Provider Bypasses

The provider's **entire normal auth flow**:
- ❌ No login page
- ❌ No password verification
- ❌ No email verification
- ❌ No forgot password
- ❌ No 2FA
- ❌ No OAuth integrations

**Why?** The marketplace JWT proves the user is authenticated. The provider just needs to:
1. Validate the JWT (SDK does this automatically)
2. Trust the identity in the JWT
3. Create a local session

---

## Pattern 2: Backend Validation (High-Security Apps)

For providers who need extra verification (banking, healthcare, etc.):

```typescript
// Provider calls marketplace API to double-check

async function handleMarketplaceEntry(req: Request) {
  const sessionJWT = req.query.gwSession;

  // Validate JWT locally via SDK
  const sdk = new MarketplaceSDK({ /* config */ });
  await sdk.initialize();

  // ADDITIONAL: Call marketplace backend to verify
  const verification = await fetch(
    'https://api.generalwisdom.com/auth/sso/verify',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sdk.getSessionData().sessionId,
        application_id: 'provider-app-123'
      })
    }
  );

  const result = await verification.json();

  if (!result.valid) {
    throw new Error('Invalid session');
  }

  // result.user contains verified identity
  // result.session contains session status

  // Now proceed with local user creation...
}
```

**Why use this?**
- Real-time session revocation check
- Validate user hasn't been banned from marketplace
- Check payment status (has token balance)
- Audit trail (marketplace logs verification request)

---

## Pattern 3: Handling Different Provider Architectures

### Scenario A: Provider Has Username/Password Auth

**Before Marketplace**:
```typescript
// Their existing auth
app.post('/login', async (req, res) => {
  const user = await db.users.findOne({ email: req.body.email });
  if (!user || !await bcrypt.compare(req.body.password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Create session...
});
```

**After Adding Marketplace**:
```typescript
// Keep existing auth (for direct users)
app.post('/login', async (req, res) => {
  // Unchanged - still works for non-marketplace users
});

// Add NEW endpoint for marketplace users
app.get('/marketplace-entry', async (req, res) => {
  // JWT-based auth (Pattern 1 code above)
});
```

**Result**: Two parallel auth systems:
- Direct users → Use username/password
- Marketplace users → Use JWT (no password needed)

---

### Scenario B: Provider Has OAuth (Google/GitHub Login)

**Before Marketplace**:
```typescript
// Their existing OAuth flow
app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/callback', passport.authenticate('google'), (req, res) => {
  // Create session...
});
```

**After Adding Marketplace**:
```typescript
// Keep existing OAuth (for direct users)
app.get('/auth/google', passport.authenticate('google'));

// Add marketplace path (for marketplace users)
app.get('/marketplace-entry', async (req, res) => {
  // JWT-based auth (Pattern 1)
});
```

**Result**: Three auth methods:
- Direct users → Google OAuth
- Direct users → GitHub OAuth
- Marketplace users → JWT (marketplace already verified identity)

---

### Scenario C: Provider Has SAML/SSO (Enterprise App)

**Before Marketplace**:
```typescript
// Their existing SAML flow
app.post('/saml/acs', samlStrategy.authenticate(), (req, res) => {
  // Create session...
});
```

**After Adding Marketplace**:
```typescript
// Keep existing SAML (for enterprise customers)
app.post('/saml/acs', samlStrategy.authenticate(), (req, res) => {
  // Unchanged
});

// Add marketplace path
app.get('/marketplace-entry', async (req, res) => {
  // JWT-based auth (Pattern 1)
});
```

**Result**: Two enterprise paths:
- Enterprise direct customers → SAML to their IdP
- Enterprise via marketplace → SAML to marketplace, then JWT to provider

---

### Scenario D: Provider Has No Auth (Internal Tool)

Some providers don't have auth because they're internal tools or prototypes:

**Before Marketplace**:
```typescript
// No auth - just serve the app
app.get('/', (req, res) => {
  res.render('dashboard');
});
```

**After Adding Marketplace**:
```typescript
// Add marketplace auth
app.get('/', async (req, res) => {
  const sessionJWT = req.query.gwSession;

  if (!sessionJWT) {
    return res.status(401).send('Access via marketplace only');
  }

  const sdk = new MarketplaceSDK({ /* config */ });
  await sdk.initialize();

  const user = await sdk.provisionUser();

  // Store user in session middleware or pass to template
  req.session.user = user;

  res.render('dashboard', { user });
});
```

**Result**: Marketplace provides the ONLY auth

---

## Pattern 4: The User Record Strategy

### Key Decision: Single User Table vs. Dual User Tables

**Option A: Single User Table with `auth_source` Field**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  name VARCHAR,
  password_hash VARCHAR NULL,  -- NULL for marketplace users
  auth_source VARCHAR,          -- 'local' | 'marketplace' | 'google' | 'saml'
  marketplace_user_id VARCHAR NULL,
  created_at TIMESTAMP
);
```

**Pros**:
- Simple schema
- Easy to handle users switching between auth methods
- Single user regardless of entry point

**Cons**:
- password_hash is NULL for marketplace users (can be confusing)

---

**Option B: Dual User Tables**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  name VARCHAR,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMP
);

CREATE TABLE marketplace_users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  name VARCHAR,
  marketplace_user_id VARCHAR NOT NULL,
  linked_user_id UUID REFERENCES users(id) NULL,  -- Optional linking
  created_at TIMESTAMP
);
```

**Pros**:
- Clean separation
- No NULL password fields
- Clear audit trail

**Cons**:
- More complex queries
- Account linking logic needed if user signs up via marketplace then tries direct login

---

**Recommendation**: **Option A (Single Table)** for most providers

---

## Pattern 5: Account Linking (Advanced)

What happens if a user:
1. Signs up directly (creates password)
2. Later accesses via marketplace

Or vice versa?

### Strategy: Link on Email Match

```typescript
async function handleMarketplaceEntry(req: Request) {
  const marketplaceUser = await sdk.provisionUser();

  // Check if user already exists (from direct signup)
  let localUser = await db.users.findOne({
    email: marketplaceUser.email
  });

  if (localUser) {
    // User exists - link accounts
    if (!localUser.marketplace_user_id) {
      await db.users.update(localUser.id, {
        marketplace_user_id: marketplaceUser.marketplace_user_id,
        auth_source: 'linked'  // Can use both methods
      });

      // Optional: Notify user via email
      await sendEmail(localUser.email, {
        subject: 'Marketplace account linked',
        body: 'Your account is now accessible via the marketplace'
      });
    }

  } else {
    // New user - create from marketplace
    localUser = await db.users.create({
      email: marketplaceUser.email,
      name: marketplaceUser.name,
      auth_source: 'marketplace',
      marketplace_user_id: marketplaceUser.marketplace_user_id,
      password_hash: null  // No password needed
    });
  }

  // Create session regardless
  const sessionId = await createAppSession(localUser.id);
  res.cookie('app_session', sessionId);
  res.redirect('/dashboard');
}
```

**Result**: User can access via marketplace OR direct login

---

## Pattern 6: Session Management

### Provider's Perspective

```typescript
// Provider creates TWO types of sessions:

// 1. Regular session (for direct users)
const regularSession = {
  user_id: 'local_user_123',
  expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000),  // 7 days
  auth_method: 'password'
};

// 2. Marketplace session (synced with marketplace session)
const marketplaceSession = {
  user_id: 'local_user_456',
  marketplace_session_id: 'sess_abc123',
  expires_at: marketplaceSDK.getSessionData().exp * 1000,  // Sync with marketplace
  auth_method: 'marketplace'
};

// Key difference: Marketplace sessions expire when marketplace session expires
```

### Syncing Expiration

```typescript
// Provider monitors marketplace session in parallel

const sdk = new MarketplaceSDK({ /* config */ });
await sdk.initialize();

// SDK emits events when session status changes
sdk.on('onSessionEnd', () => {
  // Marketplace session ended - end local session too
  clearAppSession();
  redirectToMarketplace();
});

sdk.on('onSessionWarning', ({ remainingSeconds }) => {
  // Show warning to user
  showNotification(`Session expires in ${remainingSeconds}s`);
});
```

**Result**: Provider's session lifecycle is tied to marketplace session

---

## Pattern 7: Real-World Integration Examples

### Example 1: Simple SaaS Dashboard (No Existing Auth)

```typescript
// Before marketplace: No auth at all
app.get('/', (req, res) => {
  res.render('dashboard');
});

// After marketplace: 5 lines of code
app.get('/', async (req, res) => {
  const sdk = new MarketplaceSDK({ applicationId: 'myapp' });
  await sdk.initialize();  // Validates JWT from ?gwSession=...
  const user = await sdk.provisionUser();  // Gets user identity
  req.session.user = user;  // Store in session
  res.render('dashboard', { user });  // Pass to template
});
```

**Integration Time**: 15 minutes

---

### Example 2: Existing SaaS with Username/Password

```typescript
// Keep existing routes
app.post('/login', async (req, res) => { /* existing code */ });
app.post('/signup', async (req, res) => { /* existing code */ });

// Add marketplace entry point
app.get('/marketplace-entry', async (req, res) => {
  const sdk = new MarketplaceSDK({ applicationId: 'myapp' });
  await sdk.initialize();
  const marketplaceUser = await sdk.provisionUser();

  // Reuse existing user creation logic
  let localUser = await findOrCreateUser({
    email: marketplaceUser.email,
    name: marketplaceUser.name,
    auth_source: 'marketplace'
  });

  // Reuse existing session creation
  await createSessionForUser(localUser.id);

  res.redirect('/dashboard');
});
```

**Integration Time**: 30-60 minutes

---

### Example 3: Enterprise App with Okta SAML

```typescript
// Keep existing Okta SAML flow
app.post('/saml/acs', samlStrategy.authenticate(), (req, res) => {
  // Existing enterprise SSO
});

// Add marketplace flow (becomes another "IdP")
app.get('/marketplace-entry', async (req, res) => {
  const sdk = new MarketplaceSDK({ applicationId: 'myapp' });
  await sdk.initialize();
  const marketplaceUser = await sdk.provisionUser();

  // Same user provisioning logic as SAML
  let localUser = await findOrCreateUser({
    email: marketplaceUser.email,
    name: marketplaceUser.name,
    idp: 'marketplace'  // Track IdP source
  });

  // Same session creation as SAML
  await createSessionForUser(localUser.id);

  res.redirect('/dashboard');
});
```

**Integration Time**: 30-60 minutes

**Result**: Enterprise customers use Okta, marketplace customers use marketplace SSO

---

## Pattern 8: Trust Model

### Why Should Provider Trust the Marketplace JWT?

**Cryptographic Verification**:
1. JWT signed with marketplace's private key (RS256)
2. Provider fetches public key from `/.well-known/jwks.json`
3. Provider validates signature (SDK does this automatically)
4. If signature valid → marketplace definitely issued this JWT
5. If signature invalid → reject immediately

**Analogy**: Like a driver's license issued by the DMV
- DMV (marketplace) issues licenses (JWTs)
- Businesses (providers) trust licenses because they know DMV issued them
- Businesses don't call DMV to verify every license (public key validation is enough)
- Businesses DO call DMV if license looks suspicious (Pattern 2: Backend Validation)

### Trust Hierarchy

```
Marketplace (Root of Trust)
    ↓ Issues JWT with signature
Provider validates signature via JWKS
    ↓ Signature valid = Trust identity
Provider creates local session
```

### What's in the JWT That Matters?

```json
{
  // Session claims
  "session_id": "sess_abc123",
  "exp": 1699203600,  // Expiration

  // Identity claims (what provider needs)
  "user_id": "user_456",
  "email": "john@example.com",
  "email_verified": true,  // ← Provider trusts this
  "name": "John Doe",
  "organization_id": "org_789",

  // Authorization claims
  "application_id": "app_xyz",  // Which provider app
  "scope": "profile email session_access",

  // Signature (validates everything above)
  "iss": "https://api.generalwisdom.com",
  "aud": "app_xyz"
}
```

**Key Point**: `email_verified: true` means marketplace already verified the email. Provider doesn't need to send verification emails.

---

## Pattern 9: Migration Path (No Big Bang Required)

Providers can add marketplace auth incrementally:

### Phase 1: Parallel Auth (Week 1)
- Add `/marketplace-entry` endpoint
- Keep all existing auth flows
- Test with marketplace beta users
- No risk to existing users

### Phase 2: Auto-Linking (Week 2-3)
- Add email-based account linking
- Marketplace users can access via both methods
- Notify users of linked accounts

### Phase 3: Encourage Migration (Month 2+)
- Show "Also available via marketplace" banner to direct users
- Offer incentives (discount if they switch)
- Gradually deprecate direct auth (optional)

**No forced migration** - providers can support both forever

---

## Pattern 10: What Marketplace Provides to Providers

### Authentication Infrastructure (Free to Provider)

| Feature | Provider Must Build (Without Marketplace) | Provider Must Build (With Marketplace) |
|---------|-------------------------------------------|---------------------------------------|
| Password hashing/storage | ✅ Required | ❌ Not needed |
| Password reset flow | ✅ Required | ❌ Not needed |
| Email verification | ✅ Required | ❌ Not needed |
| 2FA implementation | ✅ Required (if wanted) | ❌ Not needed |
| OAuth integrations | ✅ Required (if wanted) | ❌ Not needed |
| SAML/SSO for enterprises | ✅ Required (if wanted) | ❌ Not needed |
| Session management | ✅ Required | 🔶 Simplified |
| User database | ✅ Required | 🔶 Simplified (just store email + ID) |

**Result**: Providers save 2-4 weeks of auth implementation

### SDK Does the Heavy Lifting

```typescript
// Without marketplace (provider implements everything):
- JWT parsing and validation (50+ lines)
- JWKS fetching and caching (30+ lines)
- Public key cryptography (40+ lines)
- Session state management (100+ lines)
- Token refresh logic (50+ lines)
- Error handling (40+ lines)
= ~300+ lines of security-critical code

// With marketplace (provider uses SDK):
const sdk = new MarketplaceSDK({ applicationId: 'myapp' });
await sdk.initialize();
const user = await sdk.provisionUser();
= 3 lines of code
```

---

## Summary: Provider Integration Checklist

### Minimal Integration (5-15 minutes)
- [ ] Install SDK: `npm install @marketplace/provider-sdk`
- [ ] Add marketplace entry route: `/marketplace-entry` or `/app?gwSession=...`
- [ ] Initialize SDK and validate JWT
- [ ] Call `sdk.provisionUser()` to get user
- [ ] Create local session (however you normally do it)
- [ ] Done! ✅

### Full Integration (30-60 minutes)
- [ ] Add marketplace entry route
- [ ] Implement account linking logic (email matching)
- [ ] Add SDK event handlers (session warning, end)
- [ ] Update user database schema (add `auth_source`, `marketplace_user_id` fields)
- [ ] Test end-to-end flow
- [ ] Add monitoring/logging
- [ ] Done! ✅

### Advanced Integration (1-2 days)
- [ ] Implement backend validation (Pattern 2)
- [ ] Add session syncing logic
- [ ] Build user preference migration UI
- [ ] Implement account unlinking
- [ ] Add marketplace-specific features (token balance display, etc.)
- [ ] Write integration tests
- [ ] Done! ✅

---

## Key Takeaway

**The provider's existing auth system doesn't matter** because:

1. Marketplace auth is a **parallel path**, not a replacement
2. Providers add **one new route** for marketplace users
3. JWT validation is **handled by SDK** (3 lines of code)
4. Providers **trust the marketplace** like they trust Google OAuth or Okta SAML
5. Integration time: **5 minutes to 1 hour** depending on complexity

**Every provider integration looks the same**:
```typescript
SDK.initialize() → SDK.provisionUser() → Create local session → Done
```

The provider's internal auth complexity is hidden from the marketplace. The marketplace just provides verified identity via JWT.

---

**Next**: Want me to create a detailed integration guide for provider onboarding? Or mock up the actual API endpoints on the marketplace side?
