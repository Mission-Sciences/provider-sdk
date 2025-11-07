# Provider App Integration Simulation

> **Yes!** This setup perfectly simulates how a real app provider would integrate the SDK.

---

## 🎯 What We're Simulating

This test environment replicates **exactly** what happens when a third-party provider integrates your SDK into their existing application.

### Real-World Flow

```
┌─────────────────────┐
│  Marketplace PWA    │  1. User clicks "Launch Acme Analytics"
│  (Your Platform)    │  2. Creates session via Go backend
└──────────┬──────────┘  3. Opens: https://acme.com?gwSession=JWT
           │
           │ JWT Token
           ▼
┌─────────────────────┐
│  Provider App       │  4. Validates JWT via JWKS
│  (Acme Analytics)   │  5. Extracts session data
│  Uses Your SDK      │  6. Shows app + session timer
└─────────────────────┘
```

### Our Test Simulation

```
┌─────────────────────┐
│  Your Terminal      │  1. Generate test JWT manually
│  (Simulates Step 2) │  2. Copy JWT token
└──────────┬──────────┘
           │
           │ JWT Token
           ▼
┌─────────────────────┐
│  Test Server        │  3. Navigate to /provider?gwSession=JWT
│  localhost:3000     │  4. Validates JWT via mock JWKS
│  (Simulates Acme)   │  5. Shows "Acme Analytics" dashboard
└─────────────────────┘
```

**The SDK integration code is IDENTICAL!** ✅

---

## 📋 What's The Same (Real vs Test)

| Aspect | Both Environments |
|--------|-------------------|
| **SDK Code** | Exact same `import { MarketplaceSDK }` |
| **JWT Parameter** | Same `?gwSession=` in URL |
| **Validation Flow** | Same JWKS signature verification |
| **Session Timer** | Same countdown logic |
| **Warning Modal** | Same UI component |
| **Event Callbacks** | Same `onSessionStart`, etc. |
| **Error Handling** | Same error codes and messages |

---

## 🔄 What's Different (Only Infrastructure)

| Aspect | Test Environment | Production |
|--------|-----------------|------------|
| **JWKS URL** | `localhost:3000/.well-known/jwks.json` | `api.generalwisdom.com/.well-known/jwks.json` |
| **Keys** | Test keys in `keys/` folder | Production keys from AWS Secrets Manager |
| **JWT Source** | You generate manually | Go backend creates automatically |
| **Provider Domain** | `localhost:3000` | `acme-analytics.com` |

**Just 1 line changes for production:**
```typescript
// Test
jwksUri: 'http://localhost:3000/.well-known/jwks.json'

// Production
jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json'
```

---

## 🏗️ The Provider Simulation

### What You'll See

Open: `http://localhost:3000/provider?gwSession=<JWT>`

**"Acme Analytics" Dashboard:**
- 📊 Realistic analytics dashboard UI
- ⏱️ Session timer in header
- 📈 Mock widgets and charts
- 🎛️ Session controls (pause/resume/end)

This represents a **real provider's existing app** with our SDK integrated.

### Integration Code (What Provider Wrote)

Look at `examples/provider-simulation/existing-app.html` lines 153-180:

```javascript
// ============================================
// PROVIDER INTEGRATION CODE (Only these lines!)
// ============================================

const sdk = new MarketplaceSDK({
  jwksUri: 'http://localhost:3000/.well-known/jwks.json',
  applicationId: 'acme-analytics-app',
  debug: true,
  autoStart: true,
  warningThresholdSeconds: 300,
});

// Register callbacks
sdk.on('onSessionStart', (sessionData) => {
  showApp(sessionData);
});

sdk.on('onSessionEnd', () => {
  alert('Session ended. Redirecting...');
});

// Initialize
await sdk.initialize();
```

**That's it!** ~25 lines of code to integrate.

### Their Existing App Code

Everything else (lines 1-152, 181-end) is the provider's **existing application**:
- Their UI/CSS styling
- Their dashboard widgets
- Their business logic
- Their components

**They just added the SDK and it works!**

---

## 🧪 How to Test Like a Real Provider

### Step 1: Start Test Server
```bash
npm run test-server
```

### Step 2: Generate JWT
```bash
npm run generate-jwt 60
```

### Step 3: Test Integration
```bash
# Open in browser with JWT
http://localhost:3000/provider?gwSession=<YOUR_JWT>
```

### Step 4: Observe Integration

**You'll see:**

1. **Loading Screen** (SDK validating JWT)
   - "Validating Marketplace Session..."
   - Shows while SDK calls JWKS endpoint
   - Verifies signature and claims

2. **Dashboard Loads** (JWT validated successfully)
   - Session data extracted from JWT
   - Timer starts automatically
   - Provider's app renders with session info

3. **Session Management**
   - Timer counts down in header
   - Pause/Resume buttons work
   - Warning modal at 5 minutes
   - End session redirects

4. **Browser Console**
   ```
   [MarketplaceSDK] SDK initialized
   [JWKSValidator] Verifying JWT signature...
   ✅ Session validated: { sessionId: '...', userId: '...' }
   [TimerManager] Starting timer with 3600 seconds
   ```

---

## 🎭 Two Examples to Compare

### Example 1: Simple Demo (`/example`)
- Minimal UI focused on SDK features
- Shows all SDK capabilities clearly
- Good for testing SDK functionality

### Example 2: Provider Simulation (`/provider`)
- Realistic provider app UI
- Shows SDK integrated into existing app
- Good for understanding real-world integration

**Both use the exact same SDK code!**

---

## 📝 Real Provider Integration Guide

Here's exactly what a real provider (like "Acme Analytics") would do:

### Their Existing App (Before SDK)

```html
<!-- acme-analytics.com/dashboard.html -->
<html>
<body>
  <header>
    <h1>Acme Analytics</h1>
  </header>
  <main>
    <!-- Their existing dashboard -->
  </main>
</body>
</html>
```

### Adding SDK Integration (After)

```html
<!-- acme-analytics.com/dashboard.html -->
<html>
<body>
  <!-- Loading screen while validating -->
  <div id="loading">Validating session...</div>

  <!-- Error screen if JWT invalid -->
  <div id="error" style="display:none">Invalid session</div>

  <!-- Their existing app (hidden until valid) -->
  <div id="app" style="display:none">
    <header>
      <h1>Acme Analytics</h1>
      <div id="timer">--:--</div>  <!-- Added -->
    </header>
    <main>
      <!-- Their existing dashboard unchanged -->
    </main>
  </div>

  <script type="module">
    import { MarketplaceSDK } from '@marketplace/provider-sdk';

    const sdk = new MarketplaceSDK({
      jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json',
      applicationId: 'acme-analytics',
      debug: false,
    });

    sdk.on('onSessionStart', (data) => {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    });

    sdk.on('onError', (error) => {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
    });

    await sdk.initialize();

    setInterval(() => {
      document.getElementById('timer').textContent = sdk.getFormattedTime();
    }, 1000);
  </script>
</body>
</html>
```

**Changes:**
- ✅ Added loading/error states
- ✅ Added timer display
- ✅ Added SDK import and setup (~30 lines)
- ❌ No changes to existing app logic
- ❌ No changes to existing UI
- ❌ No changes to existing APIs

---

## 🎯 What This Proves

### ✅ SDK Works Exactly As Designed

1. **JWT Validation**: Signature verification via JWKS ✅
2. **Session Timer**: Countdown from JWT expiration ✅
3. **Event System**: All callbacks firing correctly ✅
4. **UI Components**: Warning modal working ✅
5. **Error Handling**: Proper error states ✅

### ✅ Integration is Simple

- **~30 lines of code** to integrate
- **No backend changes** required
- **Works with existing UI** (doesn't interfere)
- **Framework agnostic** (works with vanilla JS)

### ✅ Provider Experience is Good

- **Clear loading states**
- **Good error messages**
- **Non-intrusive UI**
- **Customizable styling**
- **Debug mode helps troubleshooting**

---

## 🚀 Testing Different Provider Scenarios

### Scenario 1: Provider with React

See `examples/react/App.tsx` for React integration.

### Scenario 2: Provider with Vue

Phase 2 will add Vue composable.

### Scenario 3: Provider with Next.js

Phase 2 will add Next.js example.

### Scenario 4: Provider with Custom UI

Customize the warning modal:
```javascript
const sdk = new MarketplaceSDK({
  // ...
  customStyles: {
    backgroundColor: '#your-brand-color',
    primaryColor: '#your-accent-color',
    fontFamily: 'Your Font, sans-serif',
  },
});
```

---

## 🐛 Test Error Scenarios

### No JWT Token
```
http://localhost:3000/provider
```
Should show: "No gwSession token found in URL"

### Expired JWT
```bash
# Generate JWT that's already expired
npm run generate-jwt 0
```
Should show: "Session has already expired"

### Invalid JWT
```
http://localhost:3000/provider?gwSession=invalid-token
```
Should show: "Invalid token signature"

### Wrong Application ID
Edit the provider simulation to use different `applicationId`:
```javascript
applicationId: 'wrong-app-id'  // Won't match JWT
```
Should show: "Token is for a different application"

---

## 💡 Key Takeaways

1. **The simulation is authentic** - Same code, same flow, same SDK
2. **Only infrastructure differs** - JWKS URL and key source
3. **Integration is minimal** - ~30 lines, no backend changes
4. **Works with any frontend** - Framework agnostic
5. **Provider keeps their app** - SDK doesn't interfere

---

## 📞 For Real Providers

When you're ready to onboard real providers, they can:

1. **See the simulation**: Show them `/provider` example
2. **Copy the code**: Give them `examples/provider-simulation/existing-app.html`
3. **Update JWKS URL**: Change to production endpoint
4. **Test with real JWTs**: Use marketplace-generated tokens
5. **Go live**: That's it!

**Integration time: ~30 minutes** ⏱️

---

**Questions?** The SDK is working exactly as it will in production! 🚀
