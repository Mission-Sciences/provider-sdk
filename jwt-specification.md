# Application Marketplace - JWT & Session Specification

**Version:** 1.0.0
**Date:** 2025-01-15
**Status:** MVP Specification

## Overview

This document specifies the JWT (JSON Web Token) implementation for application sessions. Sessions are pre-paid and time-bound, with JWTs serving as tamper-proof session credentials appended to application launch URLs.

---

## JWT Architecture

### Signature Algorithm

**RS256 (RSA SHA-256)**
- Asymmetric key pair
- GW signs with private key
- Application providers validate with public key
- 4096-bit RSA keys for security

### Key Management

**Storage:** AWS Systems Manager Parameter Store

**Parameters:**
```bash
/gw/jwt/private-key     # SecureString (KMS encrypted)
/gw/jwt/public-key      # String (public, exposed via JWKS)
/gw/jwt/key-id          # String (current key identifier, e.g., "gw-2025-01")
```

**Key Rotation Strategy:**
- Generate new key pair quarterly
- Update `key-id` parameter
- Keep old public keys in JWKS for 90 days
- Allows seamless rotation without breaking active sessions

---

## JWT Structure

### Header

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "gw-2025-01"
}
```

**Fields:**
- `alg`: Signature algorithm (always RS256)
- `typ`: Token type (always JWT)
- `kid`: Key ID for validation (matches JWKS entry)

### Payload (Claims)

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "applicationId": "app-123",
  "userId": "user-456",
  "orgId": "org-789",
  "email": "user@example.com",
  "startTime": 1705320000,
  "durationMinutes": 60,
  "iat": 1705320000,
  "exp": 1705323600,
  "iss": "generalwisdom.com",
  "sub": "user-456"
}
```

> **Note:** `email` is optional and may not be present in all JWTs. Application providers should handle its absence gracefully.

**Custom Claims:**
- `sessionId` (string): Unique session UUID
- `applicationId` (string): Application ID
- `userId` (string): General Wisdom user ID
- `orgId` (string): Organization ID
- `email` (string, optional): User email address, included when available from the identity provider
- `startTime` (integer): Unix timestamp (seconds) when session started
- `durationMinutes` (integer): Purchased duration (60, 120, 1440, etc.)

**Standard Claims (RFC 7519):**
- `iat` (integer): Issued At - Unix timestamp
- `exp` (integer): Expiration - Unix timestamp (`startTime + durationMinutes * 60`)
- `iss` (string): Issuer - `"generalwisdom.com"`
- `sub` (string): Subject - User ID

### Signature

```
RSASSA-PKCS1-v1_5 using SHA-256
```

Signed string:
```
base64UrlEncode(header) + "." + base64UrlEncode(payload)
```

---

## Session Creation Workflow

### 1. User Purchases Session

```
POST /applications/{app_id}/sessions
{
  "durationMinutes": 60
}
```

### 2. Backend Validation

```go
// Pseudocode
func CreateSession(appId, userId, orgId string, durationMinutes int) (*Session, error) {
    // 1. Get application
    app := GetApplication(appId)

    // 2. Check TOS acceptance
    if !CheckTOSAcceptance(app, userId, orgId) {
        return nil, errors.New("TOS not accepted")
    }

    // 3. Check usage limits
    if err := CheckUsageLimits(orgId, appId, userId, sessionCost); err != nil {
        return nil, err
    }

    // 4. Check token balance
    balance := GetTokenBalance(orgId)
    if balance < sessionCost {
        return nil, errors.New("insufficient balance")
    }

    // 5. Calculate costs
    baseCost := app.BaseCostPerSession
    markup := ResolveMarkup(orgId, appId, nil, nil)
    totalCost := baseCost * (1 + markup/100)
    smartTokens := totalCost / 0.10

    // 6. Create session record
    now := time.Now()
    expiresAt := now.Add(time.Duration(durationMinutes) * time.Minute)

    session := &ApplicationSession{
        ID:              uuid.New().String(),
        ApplicationID:   appId,
        UserID:          userId,
        OrgID:           orgId,
        StartTime:       now,
        ExpiresAt:       expiresAt,
        DurationMinutes: durationMinutes,
        BaseCost:        baseCost,
        MarkupPercent:   markup,
        TotalCost:       totalCost,
        SmartTokens:     smartTokens,
        Status:          "active",
    }

    // 7. Generate JWT
    jwt, err := GenerateJWT(session)
    if err != nil {
        return nil, err
    }
    session.JWT = jwt

    // 8. Save to DynamoDB
    SaveSession(session)

    // 9. Record token usage (triggers Stripe metering)
    RecordTokenUsage(orgId, appId, session.ID, smartTokens, totalCost)

    return session, nil
}
```

### 3. JWT Generation

```go
import "github.com/golang-jwt/jwt/v5"

type SessionClaims struct {
    SessionID       string `json:"sessionId"`
    ApplicationID   string `json:"applicationId"`
    UserID          string `json:"userId"`
    OrgID           string `json:"orgId"`
    Email           string `json:"email,omitempty"` // Optional: included when available
    StartTime       int64  `json:"startTime"`
    DurationMinutes int    `json:"durationMinutes"`
    jwt.RegisteredClaims
}

func GenerateJWT(session *ApplicationSession) (string, error) {
    // Load private key from SSM
    privateKeyPEM := GetSSMParameter("/gw/jwt/private-key")
    privateKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(privateKeyPEM))
    if err != nil {
        return "", err
    }

    // Load key ID
    keyID := GetSSMParameter("/gw/jwt/key-id")

    // Create claims
    claims := SessionClaims{
        SessionID:       session.ID,
        ApplicationID:   session.ApplicationID,
        UserID:          session.UserID,
        OrgID:           session.OrgID,
        StartTime:       session.StartTime.Unix(),
        DurationMinutes: session.DurationMinutes,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(session.ExpiresAt),
            IssuedAt:  jwt.NewNumericDate(session.StartTime),
            Issuer:    "generalwisdom.com",
            Subject:   session.UserID,
        },
    }

    // Create token
    token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
    token.Header["kid"] = keyID

    // Sign token
    signedToken, err := token.SignedString(privateKey)
    if err != nil {
        return "", err
    }

    return signedToken, nil
}
```

### 4. Response with Launch URL

```json
{
  "id": "session-uuid",
  "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Imd3LTIwMjUtMDEifQ...",
  "launchUrl": "https://app.example.com?gwSession=eyJhbGci..."
}
```

**Launch URL Construction:**
```
{application.applicationUrl}?gwSession={session.jwt}
```

> The query parameter name defaults to `gwSession` but is configurable via the SDK's `jwtParamName` option.

---

## JWT Validation (Application Provider Side)

### JWKS Endpoint

**Public Endpoint:** `GET https://api.generalwisdom.com/.well-known/jwks.json`

**Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "gw-2025-01",
      "alg": "RS256",
      "n": "xGOr-H7A-PWq...base64-encoded-modulus",
      "e": "AQAB"
    },
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "gw-2024-10",
      "alg": "RS256",
      "n": "yH1s-K8B...old-key-for-rotation",
      "e": "AQAB"
    }
  ]
}
```

### Validation Steps

**1. Extract JWT from URL**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('gwSession');  // Configurable via SDK's jwtParamName option

if (!token) {
  return res.status(401).json({ error: 'Missing session token' });
}
```

**2. Validate Signature**
```javascript
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

const client = jwksClient({
  jwksUri: 'https://api.generalwisdom.com/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 3600000  // 1 hour
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

jwt.verify(token, getKey, {
  issuer: 'generalwisdom.com',
  algorithms: ['RS256']
}, (err, decoded) => {
  if (err) {
    return res.status(401).json({ error: 'Invalid token signature' });
  }

  // Token is valid, proceed to step 3
  validateClaims(decoded);
});
```

**3. Validate Claims**
```javascript
function validateClaims(claims) {
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (claims.exp < now) {
    return { valid: false, error: 'Session expired' };
  }

  // Check issued at (not in future)
  if (claims.iat > now + 60) {  // Allow 60s clock skew
    return { valid: false, error: 'Token issued in future' };
  }

  // Check issuer
  if (claims.iss !== 'generalwisdom.com') {
    return { valid: false, error: 'Invalid issuer' };
  }

  // Verify application ID matches
  if (claims.applicationId !== myApplicationId) {
    return { valid: false, error: 'Token for different application' };
  }

  return { valid: true };
}
```

**4. Use Session Data**
```javascript
// Extract session information
const sessionData = {
  sessionId: claims.sessionId,
  userId: claims.userId,
  orgId: claims.orgId,
  startTime: new Date(claims.startTime * 1000),
  expiresAt: new Date(claims.exp * 1000),
  durationMinutes: claims.durationMinutes
};

// Store in application session
req.session.gw = sessionData;

// Proceed with application logic
next();
```

---

## SDK for Application Providers

### Node.js Example

```javascript
// gw-session-sdk.js
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

class GeneralWisdomSession {
  constructor(applicationId, jwksUri = 'https://api.generalwisdom.com/.well-known/jwks.json') {
    this.applicationId = applicationId;
    this.client = jwksClient({
      jwksUri: jwksUri,
      cache: true,
      cacheMaxAge: 3600000
    });
  }

  // Express middleware
  middleware() {
    return (req, res, next) => {
      const token = req.query.gwSession || req.headers['x-gw-session'];

      if (!token) {
        return res.status(401).json({ error: 'Missing GW session token' });
      }

      this.verify(token, (err, session) => {
        if (err) {
          return res.status(401).json({ error: err.message });
        }

        req.gwSession = session;
        next();
      });
    };
  }

  // Verify token
  verify(token, callback) {
    const getKey = (header, cb) => {
      this.client.getSigningKey(header.kid, (err, key) => {
        if (err) return cb(err);
        cb(null, key.getPublicKey());
      });
    };

    jwt.verify(token, getKey, {
      issuer: 'generalwisdom.com',
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        return callback(err);
      }

      // Validate application ID
      if (decoded.applicationId !== this.applicationId) {
        return callback(new Error('Token for different application'));
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        return callback(new Error('Session expired'));
      }

      // Return session data
      callback(null, {
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        orgId: decoded.orgId,
        startTime: new Date(decoded.startTime * 1000),
        expiresAt: new Date(decoded.exp * 1000),
        durationMinutes: decoded.durationMinutes,
        isExpired: () => Date.now() > decoded.exp * 1000,
        timeRemaining: () => Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
      });
    });
  }
}

module.exports = GeneralWisdomSession;
```

**Usage:**
```javascript
const express = require('express');
const GeneralWisdomSession = require('./gw-session-sdk');

const app = express();
const gwSession = new GeneralWisdomSession('your-app-id');

// Protect routes with GW session validation
app.use(gwSession.middleware());

app.get('/dashboard', (req, res) => {
  // Access session data
  const { userId, orgId, timeRemaining } = req.gwSession;

  res.json({
    userId,
    orgId,
    minutesRemaining: Math.floor(timeRemaining() / 60)
  });
});
```

---

## Session Lifecycle

### States

**1. Active**
- JWT not expired
- Session can be launched
- User can access application

**2. Expired**
- JWT exp claim passed
- Session cannot be launched
- Auto-updated by EventBridge Lambda (every 5 minutes)

**3. Revoked**
- User or org_admin manually revoked
- Session cannot be launched
- No refund (pre-paid)

### Expiration Handling

**Backend (EventBridge Lambda):**
```go
// Runs every 5 minutes
func ExpireSessionsHandler() {
    now := time.Now()

    // Query active sessions that should be expired
    sessions := QueryActiveSessions()

    for _, session := range sessions {
        if session.ExpiresAt.Before(now) {
            session.Status = "expired"
            UpdateSession(session)

            // Audit log
            LogAuditEvent("session.expired", session)
        }
    }
}
```

**Application Provider (Runtime Check):**
```javascript
// Check on each request
app.use((req, res, next) => {
  if (req.gwSession.isExpired()) {
    return res.status(401).json({
      error: 'Session expired',
      message: 'Please purchase a new session from General Wisdom'
    });
  }
  next();
});
```

### Time Remaining Display

**Application Provider UI:**
```javascript
// Display countdown timer
function displayTimeRemaining() {
  const remaining = gwSession.timeRemaining();
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  document.getElementById('timer').textContent =
    `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (remaining < 300) {  // Less than 5 minutes
    showWarning('Your session will expire soon. Save your work!');
  }
}

setInterval(displayTimeRemaining, 1000);
```

---

## Security Considerations

### Token Security

**1. HTTPS Only**
- All launch URLs must use HTTPS
- JWTs contain sensitive session data
- Man-in-the-middle protection

**2. Short-Lived Tokens**
- Max duration: 24 hours (1440 minutes)
- Typical durations: 60-120 minutes
- Reduces exposure window

**3. No Token Refresh**
- Sessions are pre-paid and time-bound
- No refresh tokens issued
- Users must purchase new session when expired

**4. Public Key Rotation**
- Quarterly key rotation
- Old keys kept in JWKS for 90 days
- Seamless transition

### Application Provider Best Practices

**DO:**
- ✅ Validate JWT signature on every request
- ✅ Check expiration claim before processing
- ✅ Verify application ID matches
- ✅ Use HTTPS for all endpoints
- ✅ Cache JWKS public keys (1 hour)
- ✅ Display session expiration countdown
- ✅ Save user work before expiration

**DON'T:**
- ❌ Store JWT in localStorage (XSS risk)
- ❌ Log JWT tokens
- ❌ Share JWT tokens between users
- ❌ Accept expired tokens
- ❌ Skip signature validation
- ❌ Hard-code public keys

---

## Testing & Debugging

### JWT Decoder (Development Only)

**Online Tool:** https://jwt.io

**Command Line:**
```bash
# Decode header and payload (signature not verified)
echo "eyJhbGci..." | base64 -d | jq
```

### Test Token Generation

```bash
# Generate test keypair
openssl genrsa -out test-private.pem 2048
openssl rsa -in test-private.pem -pubout -out test-public.pem

# Use in development environment
aws ssm put-parameter --name "/gw-dev/jwt/private-key" --value "$(cat test-private.pem)" --type SecureString
aws ssm put-parameter --name "/gw-dev/jwt/public-key" --value "$(cat test-public.pem)" --type String
```

### Validation Testing

```javascript
// Test expired token
const expiredToken = generateTestToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
gwSession.verify(expiredToken, (err, session) => {
  assert(err.message === 'Session expired');
});

// Test wrong application ID
const wrongAppToken = generateTestToken({ applicationId: 'wrong-app' });
gwSession.verify(wrongAppToken, (err, session) => {
  assert(err.message === 'Token for different application');
});
```

---

## Monitoring & Alerts

### Metrics to Track

**General Wisdom Backend:**
- JWT generation success rate
- JWT generation latency
- Session creation rate
- Session expiration rate
- JWKS endpoint request rate
- JWKS cache hit rate

**Application Provider:**
- JWT validation failures
- Invalid signature count
- Expired token attempts
- Missing token requests

### CloudWatch Alarms

```yaml
JWTGenerationFailureRate:
  Metric: Lambda/Errors
  Threshold: > 5 failures in 5 minutes
  Action: SNS notification to on-call engineer

JWKSEndpointErrors:
  Metric: APIGateway/5XXError
  Threshold: > 10 errors in 5 minutes
  Action: Page on-call engineer

SessionExpirationBacklog:
  Metric: DynamoDB/ActiveSessionsExpired
  Threshold: > 1000 stale sessions
  Action: Alert engineering team
```

---

## JWT Utility Functions (TypeScript/Node.js)

> **Context:** The following utility functions originate from the [gw-jwt-demo](../gw-jwt-demo) project, which tests the SDK against multiple identity providers (Auth0, Okta, Azure AD, Cognito, Keycloak). Some functions reference provider-specific claim names (e.g., `cognito:username`, `cognito:groups`) that are not part of the GW marketplace JWT specification above. They are included here as reference implementations for application providers.

The General Wisdom platform provides a comprehensive set of JWT utility functions for token validation and claims extraction. These functions are used in end-to-end tests and can serve as reference implementations for application providers.

### Core Decoding Functions

**decodeJwt(token: string): any**
```typescript
// Decodes JWT token and returns payload directly
const payload = decodeJwt(token);
console.log(payload.email); // Access claims directly
```

**Returns:** JWT payload object (not the full token structure)
**Throws:** Error if token format is invalid (not 3 parts separated by dots)

**Alias:** `decodeJWT` (capitalized for naming consistency)

### Token Validation Functions

**validateTokenStructure(token: string): boolean**
```typescript
// Validates that token has required standard claims
const isValid = validateTokenStructure(token);
// Checks for: sub, iss, exp, iat
```

**validateJWTClaims(token: string, expectedClaims: Record<string, any>): boolean**
```typescript
// Validates specific claims against expected values
const isValid = validateJWTClaims(token, {
  email: 'user@example.com',
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx',
});
// Returns false and logs mismatches to console
```

**isTokenExpired(token: string): boolean**
```typescript
// Checks if token has expired
if (isTokenExpired(token)) {
  console.log('Token expired, redirect to login');
}
```

**isTokenValid(token: string): boolean**
```typescript
// Alias for !isTokenExpired() - checks if token is NOT expired
if (isTokenValid(token)) {
  console.log('Token is still valid');
}
```

### Claim Extraction Functions

**getTokenExpiration(token: string): Date**
```typescript
// Returns expiration as Date object
const expiration = getTokenExpiration(token);
console.log(`Token expires at: ${expiration.toISOString()}`);
```

**getTimeUntilExpiration(token: string): number**
```typescript
// Returns seconds until expiration (0 if already expired)
const seconds = getTimeUntilExpiration(token);
const minutes = Math.floor(seconds / 60);
console.log(`Token expires in ${minutes} minutes`);
```

**getTokenSubject(token: string): string**
```typescript
// Extract subject (user ID) from token
const userId = getTokenSubject(token);
```

**getTokenIssuer(token: string): string**
```typescript
// Extract issuer from token
const issuer = getTokenIssuer(token);
```

**getTokenEmail(token: string): string**
```typescript
// Extract email (checks multiple claim names)
const email = getTokenEmail(token);
// Checks: email, cognito:username
```

**getTokenGroups(token: string): string[]**
```typescript
// Extract groups/roles array
const groups = getTokenGroups(token);
// Checks: cognito:groups, groups
```

**getCustomClaims(token: string): Record<string, any>**
```typescript
// Extract all non-standard claims
const customClaims = getCustomClaims(token);
// Returns object with all claims except: sub, iss, aud, exp, iat, nbf, jti
```

**getTenantId(token: string): string | null**
```typescript
// Extract tenant identifier
const tenantId = getTenantId(token);
// Checks: tenant_id, custom:tenant_id
```

**getUserType(token: string): string | null**
```typescript
// Extract user type (corporate vs social)
const userType = getUserType(token);
// Checks: user_type, custom:user_type
```

### Role Parsing Functions

**parseRoles(token: string): string[]**
```typescript
// Parse roles from custom:roles claim
const roles = parseRoles(token);
// Handles:
// - JSON array string: '["admin", "user"]'
// - Comma-separated string: 'admin,user'
// - Actual array: ['admin', 'user']
```

### URL Extraction Functions

**extractJWTFromURL(url: string): string | null**
```typescript
// Extract JWT from query parameters or hash fragment
const token = extractJWTFromURL(window.location.href);
// Checks parameters: token, jwt, access_token, id_token
// Checks both query string and hash fragment
```

### Debugging Functions

**prettyPrintToken(token: string): string**
```typescript
// Format payload as indented JSON string
const formatted = prettyPrintToken(token);
console.log(formatted);
```

**printJWTInfo(token: string): void**
```typescript
// Print comprehensive token information to console
printJWTInfo(token);
// Outputs:
// - Header (algorithm, key ID)
// - Payload (all claims)
// - Expiration time (ISO format)
// - Issued time (ISO format)
// - Time until expiration (seconds)
```

## Token Validation Process

### Typical Validation Workflow

**Step 1: Extract Token from Request**
```typescript
// From URL parameter
const token = extractJWTFromURL(window.location.href);

// Or from query parameter directly
const token = new URLSearchParams(window.location.search).get('gwSession');

// Or from header
const token = request.headers['x-gw-session'];
```

**Step 2: Validate Token Structure**
```typescript
if (!token || !validateTokenStructure(token)) {
  return res.status(401).json({ error: 'Invalid token format' });
}
```

**Step 3: Check Expiration**
```typescript
if (isTokenExpired(token)) {
  return res.status(401).json({ error: 'Session expired' });
}
```

**Step 4: Validate Claims**
```typescript
const payload = decodeJwt(token);

// Check issuer
if (payload.iss !== 'generalwisdom.com') {
  return res.status(401).json({ error: 'Invalid issuer' });
}

// Check application ID
if (payload.applicationId !== myApplicationId) {
  return res.status(401).json({ error: 'Token for different application' });
}

// Validate specific claims
const isValid = validateJWTClaims(token, {
  iss: 'generalwisdom.com',
  applicationId: myApplicationId,
});

if (!isValid) {
  return res.status(401).json({ error: 'Invalid claims' });
}
```

**Step 5: Extract Session Data**
```typescript
const sessionData = {
  sessionId: payload.sessionId,
  userId: payload.userId,
  orgId: payload.orgId,
  startTime: new Date(payload.startTime * 1000),
  expiresAt: new Date(payload.exp * 1000),
  durationMinutes: payload.durationMinutes,
};
```

### Important Implementation Notes

**decodeJwt Returns Payload Directly**
```typescript
// CORRECT: decodeJwt returns the payload object
const payload = decodeJwt(token);
console.log(payload.email); // Direct access

// INCORRECT: Do NOT try to access .payload property
const payload = decodeJwt(token).payload; // ❌ Wrong!
```

**Token Expiration Checking**
```typescript
// Use isTokenExpired or isTokenValid
if (isTokenExpired(token)) {
  // Token has expired
}

if (isTokenValid(token)) {
  // Token is still valid (NOT expired)
}

// Both check the exp claim against current time
// isTokenValid is an alias for !isTokenExpired
```

**Claim Validation**
```typescript
// validateJWTClaims compares actual vs expected
// Logs mismatches to console for debugging
// Returns true only if all expected claims match

const isValid = validateJWTClaims(token, {
  email: 'expected@example.com',
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/pool-id',
});

// Check console output for detailed mismatch information
```

**Environment-Specific Issuer URLs**
```typescript
// Cognito issuer format varies by region and pool
const expectedIssuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;

// For marketplace JWT tokens:
const expectedIssuer = 'generalwisdom.com';

// Always verify issuer matches your environment
```

## Testing Integration

### End-to-End Test Usage

The JWT utility functions are extensively used in E2E tests to validate authentication flows. Here's how they integrate with test scenarios:

**Test Setup**
```typescript
import { decodeJWT, validateJWTClaims, parseRoles, isTokenValid } from './utils/jwt';
import { config } from './config';

// Expected claims from config
const expectedClaims = {
  email: config.testUser.email,
  iss: config.expectedClaims.iss,
};
```

**Token Extraction from localStorage**
```typescript
async function getStoredTokens(page: Page): Promise<{ idToken: string, accessToken: string }> {
  return await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const cognitoKey = keys.find(key => key.includes('CognitoIdentityServiceProvider'));

    return {
      idToken: localStorage.getItem(`${cognitoKey}.idToken`) || '',
      accessToken: localStorage.getItem(`${cognitoKey}.accessToken`) || '',
    };
  });
}
```

**JWT Claims Verification Test**
```typescript
// Step 1: Get token from storage
const tokens = await getStoredTokens(page);

// Step 2: Decode JWT (returns payload directly)
const payload = decodeJWT(tokens.idToken);

// Step 3: Validate expected claims
const isValid = validateJWTClaims(tokens.idToken, {
  email: config.testUser.email,
  iss: config.expectedClaims.iss,
});

if (!isValid) {
  throw new Error('JWT validation failed - see console for details');
}

// Step 4: Check specific claims
if (!payload.sub) {
  throw new Error('Missing claim: sub');
}

if (payload.email !== config.testUser.email) {
  throw new Error(`Email mismatch: expected ${config.testUser.email}, got ${payload.email}`);
}

// Step 5: Verify token not expired
if (!isTokenValid(tokens.idToken)) {
  throw new Error('Token is expired');
}

// Step 6: Parse and verify roles (if present)
if (payload['custom:roles']) {
  const roles = parseRoles(tokens.idToken);
  if (!Array.isArray(roles)) {
    throw new Error('Roles is not an array');
  }
  console.log('User roles:', roles);
}
```

**Expected Claims Configuration**
```typescript
// tests/e2e/config.ts
export const config = {
  testUser: {
    email: 'user@example.com',
    password: 'TestPassword123!',
  },
  expectedClaims: {
    // Environment-specific issuer URL
    iss: `https://cognito-idp.${process.env.VITE_AWS_REGION}.amazonaws.com/${process.env.VITE_AWS_COGNITO_USER_POOL_ID}`,
  },
};
```

**Debug Output for Test Failures**
```typescript
// Print detailed JWT information for debugging
printJWTInfo(tokens.idToken);

// Output:
// ================================================================================
// JWT TOKEN INFORMATION
// ================================================================================
//
// Header:
// {
//   "alg": "RS256",
//   "kid": "abc123..."
// }
//
// Payload:
// {
//   "sub": "user-id",
//   "email": "user@example.com",
//   "iss": "https://cognito-idp.us-east-1.amazonaws.com/...",
//   "exp": 1705323600,
//   "iat": 1705320000
// }
//
// ================================================================================
// Expires: 2025-01-15T18:00:00.000Z
// Issued: 2025-01-15T17:00:00.000Z
// Time until expiration: 3600 seconds
// ================================================================================
```

## Common Issues & Solutions

### Issue 1: Function Signature Misunderstandings

**Problem:**
```typescript
// Expecting decodeJwt to return { payload: {...} }
const jwt = decodeJwt(token);
console.log(jwt.payload.email); // ❌ TypeError: Cannot read property 'email' of undefined
```

**Solution:**
```typescript
// decodeJwt returns the payload directly
const payload = decodeJwt(token);
console.log(payload.email); // ✅ Correct
```

**Why This Happens:**
Some JWT libraries return `{ header, payload, signature }`, but our utility function extracts and parses only the payload for convenience.

### Issue 2: Wrong Issuer URL Format

**Problem:**
```typescript
// Using wrong issuer format
const isValid = validateJWTClaims(token, {
  iss: 'generalwisdom.com',
});
// Fails because Cognito uses full URL
```

**Solution:**
```typescript
// Use full Cognito issuer URL
const expectedIssuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;

const isValid = validateJWTClaims(token, {
  iss: expectedIssuer,
});
```

**Environment-Specific Configuration:**
```typescript
// Development
const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yMqRDIh9x';

// Production
const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PRODUCTION';

// For marketplace tokens (not Cognito)
const issuer = 'generalwisdom.com';
```

### Issue 3: Role Parsing Failures

**Problem:**
```typescript
// Assuming roles is always an array
const roles = payload['custom:roles'];
roles.forEach(role => console.log(role)); // ❌ TypeError if roles is a string
```

**Solution:**
```typescript
// Use parseRoles utility which handles multiple formats
const roles = parseRoles(token);
// Always returns an array, handles:
// - JSON string: '["admin", "user"]'
// - CSV string: 'admin,user'
// - Actual array: ['admin', 'user']
// - Missing: []
```

### Issue 4: Token Expiration Edge Cases

**Problem:**
```typescript
// Not handling token expiration edge case
const payload = decodeJwt(token);
// Token could be expired but payload still decodes
```

**Solution:**
```typescript
// Always check expiration separately
if (isTokenExpired(token)) {
  throw new Error('Token expired');
}

const payload = decodeJwt(token);
// Now safe to use payload
```

**Why:**
`decodeJwt` only parses the token structure, it does NOT validate expiration. Always use `isTokenExpired` or `isTokenValid` for expiration checks.

### Issue 5: Missing Custom Claims

**Problem:**
```typescript
// Assuming custom claims always exist
const orgId = payload['custom:orgId'];
console.log(orgId.toUpperCase()); // ❌ TypeError if orgId is undefined
```

**Solution:**
```typescript
// Check for existence before using
const orgId = payload['custom:orgId'];
if (!orgId) {
  console.warn('No organization ID in token');
  // Handle missing claim
} else {
  console.log(orgId.toUpperCase());
}

// Or use optional chaining
console.log(payload['custom:orgId']?.toUpperCase() ?? 'No Org ID');
```

**Testing Tip:**
```typescript
// Use getTenantId utility which checks multiple claim names
const tenantId = getTenantId(token);
// Checks: tenant_id, custom:tenant_id, returns null if missing
```

### Issue 6: URL Token Extraction

**Problem:**
```typescript
// Only checking query parameters, missing hash fragment
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token'); // ❌ Misses tokens in hash
```

**Solution:**
```typescript
// Use extractJWTFromURL which checks both locations
const token = extractJWTFromURL(window.location.href);
// Checks query params: ?token=xxx, ?jwt=xxx, ?access_token=xxx, ?id_token=xxx
// Also checks hash fragment: #token=xxx, #access_token=xxx
```

### Issue 7: Testing with Environment Variables

**Problem:**
```typescript
// Hardcoded expected claims fail across environments
const isValid = validateJWTClaims(token, {
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV_POOL',
});
// Fails in staging/production
```

**Solution:**
```typescript
// Use environment variables for expected claims
const config = {
  expectedClaims: {
    iss: `https://cognito-idp.${process.env.VITE_AWS_REGION}.amazonaws.com/${process.env.VITE_AWS_COGNITO_USER_POOL_ID}`,
  },
};

const isValid = validateJWTClaims(token, {
  iss: config.expectedClaims.iss,
});
```

### Best Practices Summary

**✅ DO:**
- Always validate token expiration separately from decoding
- Use environment variables for issuer URLs
- Check for custom claims existence before accessing
- Use utility functions (parseRoles, getTenantId) for complex claim parsing
- Log detailed errors with printJWTInfo for debugging
- Handle missing or malformed tokens gracefully

**❌ DON'T:**
- Assume decodeJwt returns { payload: ... } structure
- Hardcode issuer URLs or expected claim values
- Skip expiration validation
- Assume custom claims always exist
- Log full JWT tokens in production (security risk)
- Trust tokens without signature validation

## Migration & Rollout

### Phase 1: Infrastructure Setup
- Generate RSA key pairs
- Store in SSM Parameter Store
- Deploy JWKS Lambda endpoint
- Test key retrieval

### Phase 2: SDK Development
- Node.js SDK implementation
- Python SDK (future)
- Go SDK (future)
- Documentation and examples

### Phase 3: Pilot Partners
- Onboard 2-3 application providers
- Test end-to-end workflow
- Gather feedback
- Iterate on SDK

### Phase 4: General Availability
- Open marketplace to all providers
- Marketing launch
- Developer documentation site
- Support channels
