# Marketplace Provider SDK

> JWT-based session management for application providers in the General Wisdom marketplace ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

> **📦 Migration Notice**: This package has been renamed from `@marketplace/provider-sdk` to `@mission_sciences/provider-sdk`. Please update your dependencies. See [Migration Guide](#-migration-from-marketplaceprovider-sdk) below.

## 🚀 Quick Start

```bash
# Install
npm install @mission_sciences/provider-sdk

# Initialize
import MarketplaceSDK from '@mission_sciences/provider-sdk';

const sdk = new MarketplaceSDK({
  jwtParamName: 'jwt',
  applicationId: 'your-app-id',
  jwksUrl: 'https://api.generalwisdom.com/.well-known/jwks.json',
  onSessionStart: async (context) => {
    // Your auth logic
  },
  onSessionEnd: async (context) => {
    // Cleanup logic
  },
});

await sdk.initialize();
```

## 📚 Documentation

- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Comprehensive guide for all frameworks
- **[Quick Start Guide](./QUICKSTART.md)** - Get started in 3 minutes
- **[Testing Guide](./TESTING_GUIDE.md)** - Testing strategies
- **[JWT Specification](./jwt-specification.md)** - Token format details

### Example Integrations

- **[GhostDog Integration](../extension-ghostdog/MARKETPLACE_INTEGRATION.md)** - Real-world Chrome extension example

## ✨ Features

### Core Features
- ✅ **Zero Dependencies**: Self-contained with minimal external deps
- ✅ **Framework Agnostic**: Works with vanilla JS, React, Vue, and more
- ✅ **TypeScript First**: Full type definitions included
- ✅ **Lightweight**: < 10KB gzipped
- ✅ **Secure**: RS256 JWT verification with JWKS
- ✅ **Customizable**: Flexible styling and event handling

### Advanced Features (Phase 2)
- ❤️ **Heartbeat System**: Automatic server sync
- 🔄 **Multi-Tab Sync**: Master tab election with BroadcastChannel API
- ⏰ **Session Extension**: Self-service renewal
- ✅ **Early Completion**: End sessions early with refund calculation
- 👁️ **Visibility API**: Auto-pause when tab hidden
- 🔐 **Backend Validation**: Alternative to JWKS for sensitive apps

## 🎯 How It Works

```
Marketplace → JWT in URL → SDK validates → Your app authenticates → Session active
```

When users launch your app from the marketplace:

1. **URL Detection**: SDK checks for JWT parameter (`?jwt=...`)
2. **JWT Validation**: Verifies signature using RS256 and JWKS
3. **Session Start**: Calls your `onSessionStart` hook
4. **Timer Start**: Countdown begins
5. **Session Active**: User interacts with your app
6. **Warning**: Alert at 5 minutes remaining (configurable)
7. **Session End**: Calls your `onSessionEnd` hook
8. **Redirect**: Returns to marketplace (optional)

## 📦 Installation

### NPM

```bash
npm install @mission_sciences/provider-sdk
```

### Yarn

```bash
yarn add @mission_sciences/provider-sdk
```

### PNPM

```bash
pnpm add @mission_sciences/provider-sdk
```

## 🏗️ Basic Usage

### Vanilla JavaScript

```javascript
import MarketplaceSDK from '@mission_sciences/provider-sdk';

const sdk = new MarketplaceSDK({
  jwtParamName: 'jwt',
  applicationId: 'my-app',
  jwksUrl: 'https://api.generalwisdom.com/.well-known/jwks.json',
  
  onSessionStart: async (context) => {
    // Store user info
    localStorage.setItem('user_id', context.userId);
    localStorage.setItem('session_id', context.sessionId);
    
    // Show app UI
    document.getElementById('app').style.display = 'block';
  },
  
  onSessionEnd: async (context) => {
    // Clear storage
    localStorage.clear();
    
    // Hide app UI
    document.getElementById('app').style.display = 'none';
  },
});

await sdk.initialize();

// Mount session header
const header = sdk.createSessionHeader();
header.mount('#session-header');
```

### React

```typescript
import { useEffect } from 'react';
import MarketplaceSDK from '@mission_sciences/provider-sdk';

function useMarketplaceSession() {
  useEffect(() => {
    const sdk = new MarketplaceSDK({
      jwtParamName: 'jwt',
      applicationId: 'my-react-app',
      jwksUrl: 'https://api.generalwisdom.com/.well-known/jwks.json',
      
      onSessionStart: async (context) => {
        // Call your auth API
        await authenticateUser(context);
      },
      
      onSessionEnd: async (context) => {
        // Clear auth state
        await logout();
      },
    });

    sdk.initialize();

    return () => sdk.destroy();
  }, []);
}
```

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for Vue, Chrome Extensions, and more.

## 🎨 Session Header Component

Pre-built UI component for displaying session timer:

```typescript
const header = sdk.createSessionHeader({
  containerId: 'session-header',
  theme: 'dark', // 'light' | 'dark' | 'auto'
  showControls: true,
  showEndButton: true,
});

header.mount('#session-header');
```

**Custom Styling**:

```css
.gw-session-header {
  background: #1a1a1a;
  padding: 12px 24px;
}

.gw-session-timer {
  font-size: 18px;
  color: #00ff88;
}

.gw-session-timer--warning {
  color: #ff6b00;
}
```

## 🔐 Authentication Integration

### Exchange JWT for Your App's Tokens

```typescript
onSessionStart: async (context) => {
  // Send marketplace JWT to your backend
  const response = await fetch('https://api.your-app.com/auth/marketplace', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.jwt}`,
    },
  });
  
  const { token } = await response.json();
  
  // Store your app's auth token
  localStorage.setItem('auth_token', token);
},
```

**Backend Example** (Python/Flask):

```python
@app.route('/auth/marketplace', methods=['POST'])
def marketplace_auth():
    jwt_token = request.headers.get('Authorization').replace('Bearer ', '')
    
    # Validate JWT
    claims = validate_marketplace_jwt(jwt_token)
    
    # Create/update user
    user = get_or_create_user(claims['userId'], claims.get('email'))
    
    # Generate your app's token
    app_token = generate_app_token(user)
    
    return jsonify({'token': app_token})
```

See [INTEGRATION_GUIDE.md#authentication-integration](./INTEGRATION_GUIDE.md#authentication-integration) for Cognito, Firebase, Auth0 examples.

## ⚙️ Configuration

### SDK Options

```typescript
interface SDKOptions {
  // Required
  jwtParamName: string;              // URL parameter name
  applicationId: string;             // Your app ID
  jwksUrl: string;                   // JWKS endpoint
  onSessionStart: (context) => Promise<void>;
  onSessionEnd: (context) => Promise<void>;
  
  // Optional
  onSessionWarning?: (context) => Promise<void>;
  onSessionExtend?: (context) => Promise<void>;
  marketplaceUrl?: string;           // Redirect after session end
  warningThresholdMinutes?: number;  // Default: 5
  debug?: boolean;                   // Enable logging
  pauseWhenHidden?: boolean;         // Auto-pause when tab hidden
}
```

### JWT Structure

```json
{
  "sessionId": "35iiYDoY1fSwSpYX22H8GP7x61o",
  "applicationId": "your-app-id",
  "userId": "a47884c8-50d1-7040-2de8-b7801699643c",
  "orgId": "org-123",
  "email": "user@example.com",
  "startTime": 1763599337,
  "durationMinutes": 60,
  "exp": 1763602937,
  "iat": 1763599337
}
```

## 🧪 Testing

### Generate Test JWT

```bash
npm run generate-keys     # Create RSA key pair (dev only)
npm run generate-jwt 60   # Generate 60-minute JWT
```

### Test Server

```bash
npm run test-server       # Start dev server at localhost:3000
```

Open: `http://localhost:3000?jwt=<YOUR_JWT>`

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for unit, integration, and E2E testing.

## 🛠️ Development

### Build

```bash
npm run build         # Build for production
npm run dev           # Watch mode
```

### Code Quality

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run type-check    # TypeScript
```

### Examples

```bash
cd examples/vanilla-js
npm install
npm run dev
```

## 📖 API Reference

### MarketplaceSDK

```typescript
class MarketplaceSDK {
  constructor(options: SDKOptions)
  
  // Initialize SDK
  async initialize(): Promise<void>
  
  // Session management
  hasActiveSession(): boolean
  getSession(): Session | null
  async endSession(reason: string): Promise<void>
  async extendSession(minutes: number): Promise<void>
  
  // UI components
  createSessionHeader(options?: HeaderOptions): SessionHeader
  
  // Timer control
  pauseTimer(): void
  resumeTimer(): void
  isTimerPaused(): boolean
  
  // Cleanup
  destroy(): void
}
```

### Context Types

```typescript
interface SessionStartContext {
  sessionId: string;
  applicationId: string;
  userId: string;
  orgId?: string;
  email?: string;
  startTime: number;
  expiresAt: number;
  durationMinutes: number;
  jwt: string;
}

interface SessionEndContext {
  sessionId: string;
  userId: string;
  reason: 'expired' | 'manual' | 'error';
  actualDurationMinutes: number;
}
```

See [INTEGRATION_GUIDE.md#api-reference](./INTEGRATION_GUIDE.md#api-reference) for complete API documentation.

## 🚀 Production Deployment

### Checklist

- [ ] Update `jwksUrl` to production endpoint
- [ ] Set correct `applicationId`
- [ ] Enable HTTPS for all endpoints
- [ ] Configure proper CORS headers
- [ ] Set up secrets management
- [ ] Enable rate limiting
- [ ] Configure monitoring and logging
- [ ] Test with production JWT
- [ ] Load test auth endpoints

See [INTEGRATION_GUIDE.md#production-deployment](./INTEGRATION_GUIDE.md#production-deployment) for complete checklist.

## 🐛 Troubleshooting

### Common Issues

**JWT validation failed**
- Check JWKS URL is correct
- Verify applicationId matches
- Ensure JWT not expired

**Session header not showing**
- Verify mount element exists
- Check SDK initialized
- Confirm active session

**Auth server 500 error**
- Check Cognito configuration
- Verify client secret (if required)
- Review server logs

See [INTEGRATION_GUIDE.md#troubleshooting](./INTEGRATION_GUIDE.md#troubleshooting) for detailed solutions.

## 📚 Resources

- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Complete integration reference
- **[Quick Start](./QUICKSTART.md)** - Get started in 3 minutes
- **[Testing Guide](./TESTING_GUIDE.md)** - Testing strategies
- **[JWT Spec](./jwt-specification.md)** - Token format details
- **[Examples](./examples/)** - Sample implementations
- **[GhostDog Integration](../extension-ghostdog/MARKETPLACE_INTEGRATION.md)** - Real-world example

## 📦 Migration from @marketplace/provider-sdk

If you're upgrading from the old `@marketplace/provider-sdk` package:

### Step 1: Update package.json

```bash
npm uninstall @marketplace/provider-sdk
npm install @mission_sciences/provider-sdk
```

### Step 2: Update imports

```typescript
// Old
import MarketplaceSDK from '@marketplace/provider-sdk';

// New
import MarketplaceSDK from '@mission_sciences/provider-sdk';
```

### Step 3: Remove old registry config (if using CodeArtifact)

Remove or update your `.npmrc` file:

```bash
# Old (remove this)
@marketplace:registry=https://ghostdogbase-540845145946.d.codeartifact.us-east-1.amazonaws.com/npm/sdk-packages/

# New (use default npm registry - no configuration needed)
```

**Note**: The API is 100% compatible. No code changes required beyond the package name!

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Mission-Sciences/provider-sdk/issues)
- **Email**: support@generalwisdom.com
- **Docs**: [docs.generalwisdom.com](https://docs.generalwisdom.com)

## 📊 Changelog

### v2.0.0 (Phase 2)
- Heartbeat system
- Multi-tab coordination
- Session extension
- Early completion
- Visibility API integration

### v1.0.0 (Phase 1)
- Initial release
- JWT validation with JWKS
- Session timer management
- Lifecycle hooks
- Session header component

---

**Built with ❤️ by the General Wisdom team**
