# Marketplace URL Configuration

## Overview

The SDK now supports configurable marketplace redirect URLs, making it easy to change the marketplace endpoint in one place without updating code throughout your application.

## Configuration

### Basic Usage

```typescript
import { MarketplaceSDK } from '@marketplace/provider-sdk';

const sdk = new MarketplaceSDK({
  apiEndpoint: 'https://api.generalwisdom.com',
  applicationId: 'your-app-id',
  marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/', // Configure marketplace URL
  // ... other options
});
```

### Default Value

If not specified, the SDK defaults to:
```
https://d3p2yqofgy75sz.cloudfront.net/
```

### Environment-Specific Configuration

You can configure different URLs for different environments:

```typescript
const MARKETPLACE_URLS = {
  production: 'https://d3p2yqofgy75sz.cloudfront.net/',
  staging: 'https://staging.marketplace.generalwisdom.com/',
  development: 'http://localhost:4000/',
};

const sdk = new MarketplaceSDK({
  marketplaceUrl: MARKETPLACE_URLS[process.env.NODE_ENV || 'production'],
  // ... other options
});
```

## Where the URL is Used

The configured marketplace URL is used for:

1. **Session Expiration Redirect**
   - When the session timer reaches 0
   - Automatically redirects to `marketplaceUrl`

2. **Manual Session End**
   - When user clicks "End Session" button
   - Redirects to `marketplaceUrl`

3. **Warning Modal Timeout**
   - When warning modal countdown expires
   - Triggers session end and redirects to `marketplaceUrl`

4. **Extension Failure Redirect**
   - When session extension fails (e.g., insufficient tokens)
   - Redirects to `marketplaceUrl/extend-session?sessionId=...`

## React Hook Usage

```typescript
import { useMarketplaceSession } from './useMarketplaceSession';

function MyApp() {
  const { session, error } = useMarketplaceSession({
    apiEndpoint: 'https://api.generalwisdom.com',
    applicationId: 'my-app',
    marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',
  });

  // ... rest of component
}
```

## Vanilla JavaScript Usage

```html
<script type="module">
  import { MarketplaceSDK } from './dist/marketplace-sdk.es.js';

  const sdk = new MarketplaceSDK({
    jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json',
    applicationId: 'my-app',
    marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',
  });

  await sdk.initialize();
</script>
```

## Complete Redirect Flow

### 1. Normal Session Expiration
```
User Session → Timer expires → endSession() called → 500ms delay → window.location.href = marketplaceUrl
```

### 2. Warning Modal Timeout
```
Warning shown → Modal countdown → Countdown hits 0 → onEnd callback → endSession() → Redirect to marketplaceUrl
```

### 3. Manual End Session
```
User clicks "End Session" → endSession() called → 500ms delay → Redirect to marketplaceUrl
```

### 4. Extension Failure
```
User clicks "Extend" → API call fails → Redirect to marketplaceUrl/extend-session?sessionId=...
```

## Best Practices

### 1. Centralized Configuration

Create a configuration file:

```typescript
// config/marketplace.ts
export const marketplaceConfig = {
  url: process.env.MARKETPLACE_URL || 'https://d3p2yqofgy75sz.cloudfront.net/',
  apiEndpoint: process.env.API_ENDPOINT || 'https://api.generalwisdom.com',
};
```

Then use it consistently:

```typescript
import { marketplaceConfig } from './config/marketplace';

const sdk = new MarketplaceSDK({
  marketplaceUrl: marketplaceConfig.url,
  apiEndpoint: marketplaceConfig.apiEndpoint,
  // ... other options
});
```

### 2. Environment Variables

Use environment variables for flexibility:

```bash
# .env.production
MARKETPLACE_URL=https://d3p2yqofgy75sz.cloudfront.net/
API_ENDPOINT=https://api.generalwisdom.com

# .env.development
MARKETPLACE_URL=http://localhost:4000/
API_ENDPOINT=http://localhost:3000
```

### 3. Trailing Slash

Always include a trailing slash to ensure proper URL construction:

✅ **Correct:**
```typescript
marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/'
```

❌ **Incorrect:**
```typescript
marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net'
// This would create: https://d3p2yqofgy75sz.cloudfront.netextend-session
```

## Migration Guide

### From Hardcoded URLs

**Before:**
```typescript
// Multiple places in your code
window.location.href = 'https://marketplace.generalwisdom.com';
```

**After:**
```typescript
// SDK configuration
const sdk = new MarketplaceSDK({
  marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',
});

// SDK handles all redirects automatically
```

### Updating Existing Code

1. **Find all hardcoded marketplace URLs:**
   ```bash
   grep -r "marketplace.generalwisdom.com" .
   grep -r "d3p2yqofgy75sz.cloudfront.net" .
   ```

2. **Remove manual redirects in SDK event handlers:**
   ```typescript
   // REMOVE THIS:
   sdk.on('onSessionEnd', () => {
     window.location.href = 'https://marketplace.example.com';
   });
   ```

3. **Configure SDK once:**
   ```typescript
   const sdk = new MarketplaceSDK({
     marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',
   });
   ```

## TypeScript Type Definition

```typescript
interface SDKConfig {
  /** Marketplace URL for redirects (default: https://d3p2yqofgy75sz.cloudfront.net/) */
  marketplaceUrl?: string;

  // ... other config options
}
```

## Testing

### Test Different URLs

```typescript
describe('Marketplace SDK', () => {
  it('should redirect to configured marketplace URL', async () => {
    const customUrl = 'https://test.marketplace.com/';

    const sdk = new MarketplaceSDK({
      marketplaceUrl: customUrl,
      applicationId: 'test-app',
    });

    // Mock window.location
    delete window.location;
    window.location = { href: '' };

    sdk.endSession();

    // Wait for 500ms delay
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(window.location.href).toBe(customUrl);
  });
});
```

## Troubleshooting

### Redirect Not Working

1. **Check trailing slash:**
   ```typescript
   // Correct
   marketplaceUrl: 'https://example.com/'

   // May cause issues
   marketplaceUrl: 'https://example.com'
   ```

2. **Verify URL is valid:**
   ```typescript
   console.log('Marketplace URL:', sdk.config.marketplaceUrl);
   ```

3. **Check browser console for errors:**
   - Look for network errors
   - Check if redirect is blocked by browser
   - Verify URL is properly formatted

### Extension Redirect Issues

The extension failure redirect constructs the URL as:
```typescript
`${marketplaceUrl}extend-session?sessionId=${sessionId}`
```

Ensure your marketplace URL ends with `/` so this becomes:
```
https://example.com/extend-session?sessionId=...
```

Not:
```
https://example.comextend-session?sessionId=...
```

## Summary

- ✅ Configure marketplace URL in one place
- ✅ Consistent redirects across all expiration scenarios
- ✅ Environment-specific configuration support
- ✅ No manual redirect logic needed in event handlers
- ✅ Proper URL construction for extension failures
