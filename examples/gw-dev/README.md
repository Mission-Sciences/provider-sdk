# GW SDK — Dev Environment Examples

Runnable examples for each framework, wired to the dev environment.

> **API key required.** The examples use the placeholder `YOUR_API_KEY`. Get a real
> key from the GW setup page for your application (Developer → Applications →
> your app → Setup → API keys) and substitute it locally. **Never commit a real
> API key** — keys committed to the repo end up in the public npm/GitHub mirror
> and must be rotated.

**App ID:** `91108a6a-7f25-4b41-a20c-6a904e49048c`  
**Setup page:** https://dev.generalwisdom.com/developer/applications/91108a6a-7f25-4b41-a20c-6a904e49048c/setup

## How it works

1. Run one of the examples below (each on a different port)
2. On the setup page, point the app's redirect URL at `http://localhost:<port>` (see per-example instructions)
3. Launch a test session — GW opens your localhost URL with `?gwSession=<JWT>`
4. The SDK reads the JWT from the URL, validates it against the dev JWKS, and starts the session timer

## Examples

### Vanilla HTML — port 3101

Serve from the **gw-sdk root** so `/dist/marketplace-sdk.es.js` resolves correctly:

```bash
# From gw-sdk root
npx serve . -p 3101
```

Set the app's redirect URL to: `http://localhost:3101`

### React (Vite) — port 3102

```bash
npm run dev:react
# or
cd react && npm install && npm run dev
```

Set the app's redirect URL to: `http://localhost:3102`

### Vue 3 (Vite) — port 3103

```bash
npm run dev:vue
# or
cd vue && npm install && npm run dev
```

Set the app's redirect URL to: `http://localhost:3103`

### Next.js — port 3104

```bash
npm run dev:nextjs
# or
cd nextjs && npm install && npm run dev
```

Set the app's redirect URL to: `http://localhost:3104`

## Updating the app redirect URL

The app's `applicationUrl` controls where GW sends users when launching a test session. Update it for the example you're testing:

```bash
# Set to vanilla example
node ../../scripts/update-app-url.js http://localhost:3101

# Set to React example
node ../../scripts/update-app-url.js http://localhost:3102
```

Or use the GW setup page — the TestSessionLauncher's URL override field accepts a custom URL per launch without changing the app's default.

## SDK config used by all examples

```ts
{
  applicationId: '91108a6a-7f25-4b41-a20c-6a904e49048c',
  apiKey: 'YOUR_API_KEY',
  environment: 'dev',  // resolves to api.dev.generalwisdom.com
  autoStart: true,
  warningThresholdSeconds: 300,
  debug: true,
}
```

`environment: 'dev'` automatically sets:
- `jwksUri`: `https://api.dev.generalwisdom.com/.well-known/jwks.json`
- `apiEndpoint`: `https://sdk.dev.generalwisdom.com`
- `marketplaceUrl`: `https://dev.generalwisdom.com/`
