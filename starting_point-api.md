# Application Marketplace Platform - Backend API
## Starting Point: Go API Implementation Plan

**Repository**: gw-api  
**Focus**: Building the serverless Go backend API with session management for application marketplace  
**Timeline**: 6 weeks MVP + future enhancements  
**Audience**: Backend developers and platform engineers  
**Primary Reference**: `/gw-docs/PRPs/PRP-002D-sessions-backend.md`

---

## 🔴 Important: Documentation Hierarchy

This document aligns with:
1. **PRIMARY**: PRPs in `/gw-docs/PRPs/` (detailed implementation tasks)
2. **SECONDARY**: Feature specs in `/gw-docs/features/application-marketplace/`
3. **RELATED**: E2E tests define expected behavior (`gw-spa/tests/e2e/`)

**When in doubt, PRPs are the source of truth.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Current State Assessment](#current-state-assessment)
3. [Session Management Design (MVP)](#session-management-design-mvp)
4. [Implementation Plan - MVP (6 Weeks)](#implementation-plan---mvp-6-weeks)
5. [Future Roadmap (Post-MVP)](#future-roadmap-post-mvp)
6. [Success Criteria](#success-criteria)

---

## Architecture Overview

### System Integration

```
Marketplace PWA (gw-spa)
    ↓ HTTPS/REST + Cognito JWT
API Gateway
    ↓ Lambda Proxy Integration
Lambda Functions (Go 1.21)
├── Sessions (❌ NEW - PRP-002D)
│   ├── List sessions (GET /users/:userId/sessions)
│   ├── Get session (GET /sessions/:id)
│   ├── Create session (POST /sessions)
│   ├── Revoke session (DELETE /sessions/:id)
│   └── Renew session (PUT /sessions/:id/renew)
├── JWKS (❌ NEW - GET /.well-known/jwks.json)
├── Settings, Users, Orgs (✅ Implemented)
└── Applications, Tokens (✅ Partially implemented)
    ↓ AWS SDK
DynamoDB Tables
├── gw-sessions-{env} (❌ NEW)
├── gw-applications-{env} (✅ EXISTS)
├── gw-users-{env} (✅ EXISTS)
└── gw-organizations-{env} (✅ EXISTS)
    ↓
Secrets Manager (JWT private key - production)
Local keys/ directory (development)
```

### Session Flow (MVP)

```
1. User browses marketplace → selects application

2. User clicks "Create Session" →  POST /sessions
   Request:  { application_id, duration_minutes }
   Response: { session_id, session_jwt, launch_url, expires_at, tokens_consumed }

3. Frontend opens new tab: https://app.example.com?gwSession={jwt}

4. Application validates JWT via JWKS:
   - Fetch public key from GET /.well-known/jwks.json
   - Verify RS256 signature
   - Check expiration
   - Extract session claims

5. User manages session in "My Sessions" page:
   - View countdown timer (client-side)
   - Relaunch application (opens with same JWT while active)
   - Revoke: DELETE /sessions/{id}
   - Extend: PUT /sessions/{id}/renew
```

---

## Current State Assessment

### ✅ Implemented (~60% Complete)

**Endpoints** (26 total):
- Settings CRUD: 5 endpoints
- Users CRUD: 6 endpoints  
- Organizations CRUD: 5 endpoints
- Applications/Providers CRUD: 7 endpoints
- Tokens balance: 3 endpoints (basic)

**Infrastructure**:
- Terraform modules (lambda, dynamodb, api_gateway, iam)
- Multi-environment support (ghostdog-dev, gw-prod)
- Cognito authentication via API Gateway
- OpenAPI 3.0.1 specification
- CI/CD with Bitbucket Pipelines
- Integration tests with Cognito tokens
- Docker Compose local development

**Code Quality**:
- Shared `pkg/models` with DynamoDB/JSON tags
- Response helpers (`pkg/response`)
- Makefile automation
- Go 1.21+ with per-function modules

### ❌ Missing for MVP (~40% Remaining)

**Priority 1: Session Management** (PRP-002D)
- [ ] Sessions DynamoDB table with 3 GSIs
- [ ] Session model structs and validation
- [ ] RS256 JWT generation (2048-bit keys)
- [ ] 5 session Lambda handlers (list, get, create, revoke, renew)
- [ ] JWKS public key endpoint
- [ ] Session lifecycle logic (status calculation)
- [ ] Token deduction on session creation
- [ ] API Gateway route configuration

**Priority 2: Enhanced Features** (Other PRPs)
- [ ] Stripe payment integration (PRP-003)
- [ ] TOS acceptance tracking
- [ ] Usage limits enforcement
- [ ] Analytics collection

---

## Session Management Design (MVP)

### Session Model (Per PRP-002D Task 2)

```go
// internal/models/session.go
package models

import "time"

type Session struct {
    SessionID       string     `json:"session_id" dynamodbav:"session_id"`
    UserID          string     `json:"user_id" dynamodbav:"user_id"`
    TenantID        string     `json:"tenant_id" dynamodbav:"tenant_id"`        // Multi-tenancy
    OrganizationID  string     `json:"organization_id" dynamodbav:"organization_id"`
    ApplicationID   string     `json:"application_id" dynamodbav:"application_id"`
    ApplicationName string     `json:"application_name" dynamodbav:"application_name"` // Denormalized
    Status          string     `json:"status" dynamodbav:"status"` // active, expired, revoked
    CreatedAt       time.Time  `json:"created_at" dynamodbav:"created_at"`
    ExpiresAt       time.Time  `json:"expires_at" dynamodbav:"expires_at"`
    StartedAt       *time.Time `json:"started_at,omitempty" dynamodbav:"started_at,omitempty"`
    RevokedAt       *time.Time `json:"revoked_at,omitempty" dynamodbav:"revoked_at,omitempty"`
    RevokedBy       string     `json:"revoked_by,omitempty" dynamodbav:"revoked_by,omitempty"`
    TokensConsumed  int        `json:"tokens_consumed" dynamodbav:"tokens_consumed"`
    SessionJWT      string     `json:"session_jwt" dynamodbav:"session_jwt"`
    Configuration   map[string]interface{} `json:"configuration,omitempty" dynamodbav:"configuration,omitempty"`
    TTL             int64      `json:"-" dynamodbav:"ttl"` // Unix timestamp for DynamoDB auto-deletion
}

// Status constants
const (
    SessionStatusActive  = "active"
    SessionStatusExpired = "expired"
    SessionStatusRevoked = "revoked"
)

// Utility methods
func (s *Session) CalculateStatus() string {
    if s.RevokedAt != nil {
        return SessionStatusRevoked
    }
    if time.Now().After(s.ExpiresAt) {
        return SessionStatusExpired
    }
    return SessionStatusActive
}

func (s *Session) IsAccessible() bool {
    return s.CalculateStatus() == SessionStatusActive
}

func (s *Session) TimeRemaining() time.Duration {
    remaining := time.Until(s.ExpiresAt)
    if remaining < 0 {
        return 0
    }
    return remaining
}

// Request/Response models
type CreateSessionRequest struct {
    ApplicationID   string `json:"application_id" validate:"required,uuid"`
    DurationMinutes int    `json:"duration_minutes" validate:"required,min=1,max=1440"`
}

type CreateSessionResponse struct {
    SessionID       string    `json:"session_id"`
    SessionJWT      string    `json:"session_jwt"`
    LaunchURL       string    `json:"launch_url"`
    ExpiresAt       time.Time `json:"expires_at"`
    TokensConsumed  int       `json:"tokens_consumed"`
    ApplicationName string    `json:"application_name"`
}

type RenewSessionRequest struct {
    AdditionalMinutes int `json:"additional_minutes" validate:"required,min=1,max=1440"`
}

type RenewSessionResponse struct {
    SessionID        string    `json:"session_id"`
    NewExpiresAt     time.Time `json:"new_expires_at"`
    AdditionalCost   int       `json:"additional_cost"`
    TotalTokensSpent int       `json:"total_tokens_spent"`
}
```

### DynamoDB Table Schema (Per PRP-002D Task 1)

```hcl
# terraform/sessions_table.tf
resource "aws_dynamodb_table" "sessions" {
  name           = "gw-sessions-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "session_id"
  range_key      = "created_at"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "organization_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "expires_at"
    type = "N"
  }

  # GSI: Query user's sessions sorted by creation time
  global_secondary_index {
    name            = "UserSessionsIndex"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # GSI: Query org's sessions
  global_secondary_index {
    name            = "OrgSessionsIndex"
    hash_key        = "organization_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # GSI: Query by status and expiration (for cleanup jobs)
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "expires_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.environment
    Project     = "general-wisdom"
    ManagedBy   = "terraform"
  }
}
```

### JWT Structure (RS256 Algorithm)

**Algorithm**: RS256 (RSA Signature with SHA-256)  
**Key Size**: 2048-bit

**Claims**:
```json
{
  "session_id": "sess_abc123",
  "user_id": "user-456",
  "organization_id": "org-789",
  "application_id": "app-xyz",
  "exp": 1699203600,
  "iat": 1699200000
}
```

**Key Generation** (PRP-002D Task 3):
```bash
# Development
mkdir -p keys
openssl genrsa -out keys/session_signing_key.pem 2048
openssl rsa -in keys/session_signing_key.pem -pubout > keys/session_signing_key.pub

# Add to .gitignore
echo "keys/" >> .gitignore

# Production: Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name gw-api/jwt-private-key \
  --secret-string file://keys/session_signing_key.pem
```

**JWT Generation** (PRP-002D Task 4):
```go
// internal/services/sessions/jwt.go
package sessions

import (
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "fmt"
    "os"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

func GenerateSessionJWT(sessionID, userID, orgID, appID string, expiresAt time.Time) (string, error) {
    // Load private key
    signingKey, err := loadPrivateKey()
    if err != nil {
        return "", fmt.Errorf("failed to load signing key: %w", err)
    }

    // Create claims
    claims := jwt.MapClaims{
        "session_id":      sessionID,
        "user_id":         userID,
        "organization_id": orgID,
        "application_id":  appID,
        "exp":             expiresAt.Unix(),
        "iat":             time.Now().Unix(),
    }

    // Sign token
    token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
    signedToken, err := token.SignedString(signingKey)
    if err != nil {
        return "", fmt.Errorf("failed to sign JWT: %w", err)
    }

    return signedToken, nil
}

func loadPrivateKey() (*rsa.PrivateKey, error) {
    // Try environment variable first (production)
    keyPEM := os.Getenv("JWT_PRIVATE_KEY")
    
    // Fall back to file (development)
    if keyPEM == "" {
        data, err := os.ReadFile("keys/session_signing_key.pem")
        if err != nil {
            return nil, err
        }
        keyPEM = string(data)
    }

    block, _ := pem.Decode([]byte(keyPEM))
    if block == nil {
        return nil, fmt.Errorf("failed to parse PEM block")
    }

    privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
    if err != nil {
        return nil, err
    }

    return privateKey, nil
}
```

### API Endpoints (MVP)

```
# Session Management
GET    /users/:userId/sessions?status=active|expired|revoked
GET    /sessions/:id
POST   /sessions
DELETE /sessions/:id
PUT    /sessions/:id/renew

# Public Key Distribution  
GET    /.well-known/jwks.json
```

**Example Requests**:

```bash
# Create session
curl -X POST https://api.generalwisdom.com/sessions \
  -H "Authorization: Bearer ${COGNITO_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "app-123",
    "duration_minutes": 30
  }'

# Response
{
  "session_id": "sess-456",
  "session_jwt": "eyJhbGci...",
  "launch_url": "https://app.example.com?gwSession=eyJhbGci...",
  "expires_at": "2025-11-06T15:30:00Z",
  "tokens_consumed": 150,
  "application_name": "Example Application"
}

# List user sessions
curl https://api.generalwisdom.com/users/user-123/sessions?status=active \
  -H "Authorization: Bearer ${COGNITO_JWT}"

# Revoke session
curl -X DELETE https://api.generalwisdom.com/sessions/sess-456 \
  -H "Authorization: Bearer ${COGNITO_JWT}"

# Renew session
curl -X PUT https://api.generalwisdom.com/sessions/sess-456/renew \
  -H "Authorization: Bearer ${COGNITO_JWT}" \
  -H "Content-Type: application/json" \
  -d '{ "additional_minutes": 15 }'

# Get JWKS (public - no auth required)
curl https://api.generalwisdom.com/.well-known/jwks.json
```

---

## Implementation Plan - MVP (6 Weeks)

### 🔴 Primary Reference: PRP-002D

**For detailed day-by-day tasks**, see `/gw-docs/PRPs/PRP-002D-sessions-backend.md`

This section provides a high-level overview.

---

### Week 1: Backend Foundation (6-8 hours)

**Owner**: golang-pro + database-optimizer  
**Reference**: PRP-002D Tasks 1-6

#### Deliverables
1. **DynamoDB Table** (Task 1)
   - `terraform/sessions_table.tf`
   - Deploy to ghostdog-dev
   - Verify GSIs are ACTIVE

2. **Session Model** (Task 2)
   - `internal/models/session.go`
   - All structs, enums, methods
   - Unit tests

3. **RSA Key Pair** (Task 3)
   - Generate 2048-bit keys
   - Add to .gitignore
   - Document rotation procedure

4. **JWT Service** (Task 4)
   - `internal/services/sessions/jwt.go`
   - GenerateSessionJWT function
   - Private key loading
   - Unit tests

5. **Session Service** (Tasks 5-6)
   - `internal/services/sessions/service.go`
   - CreateSession business logic
   - `internal/services/sessions/lifecycle.go`
   - Status calculation methods

#### Validation
```bash
# Terraform
cd terraform && terraform plan
terraform apply

# Unit tests
go test ./internal/models/...
go test ./internal/services/sessions/...

# DynamoDB
aws dynamodb describe-table --table-name gw-sessions-dev
```

---

### Week 2: Lambda Handlers (6-8 hours)

**Owner**: golang-pro  
**Reference**: PRP-002D Tasks 7-11

#### Deliverables
1. **List Sessions Handler** (Task 7)
   - `internal/handlers/sessions/list.go`
   - GET /users/:userId/sessions
   - Query UserSessionsIndex
   - Filter by status parameter

2. **Get Session Handler** (Task 8)
   - `internal/handlers/sessions/get.go`
   - GET /sessions/:id
   - Single item retrieval

3. **Create Session Handler** (Task 9)
   - `internal/handlers/sessions/create.go`
   - POST /sessions
   - Validate, generate JWT, save, deduct tokens

4. **Revoke Session Handler** (Task 10)
   - `internal/handlers/sessions/revoke.go`
   - DELETE /sessions/:id
   - Update status and set revoked_at

5. **Renew Session Handler** (Task 11)
   - `internal/handlers/sessions/renew.go`
   - PUT /sessions/:id/renew
   - Extend expiration, charge tokens

#### Validation
```bash
# Build
make build-lambda-sessions

# Local test (if using SAM or LocalStack)
sam local invoke CreateSessionFunction --event events/create-session.json

# Deploy
make deploy ENV=dev
```

---

### Week 3: API Gateway & JWKS (4-6 hours)

**Owner**: golang-pro  
**Reference**: PRP-002D Tasks 12-14

#### Deliverables
1. **API Gateway Routes** (Task 12)
   - `terraform/api_gateway.tf`
   - Add session routes
   - Connect to Lambda functions
   - Enable Cognito authorization

2. **Lambda Functions** (Task 13)
   - `terraform/lambda.tf`
   - Create Lambda resources
   - Environment variables
   - IAM execution roles

3. **IAM Policies** (Task 14)
   - DynamoDB permissions (sessions table)
   - DynamoDB permissions (applications, users, tokens tables)
   - Secrets Manager access (if using for keys)
   - CloudWatch Logs

4. **JWKS Endpoint**
   - `internal/handlers/keys/jwks.go`
   - GET /.well-known/jwks.json
   - Return public key in JWKS format
   - No authentication required

#### Validation
```bash
# Deploy
terraform apply

# Test endpoints with Cognito token
export COGNITO_JWT="..."
curl -H "Authorization: Bearer $COGNITO_JWT" \
  https://api-dev.generalwisdom.com/users/user-123/sessions

# Test JWKS
curl https://api-dev.generalwisdom.com/.well-known/jwks.json
```

---

### Week 4-5: Frontend Integration (20+ hours)

**Owner**: react-specialist  
**Reference**: PRP-002A, 002B, 002C (Frontend PRPs)

#### Frontend Tasks
- My Sessions page (PRP-002A)
- Create Session modal (PRP-002B)
- Session lifecycle management (PRP-002C)

**Backend is complete** - frontend connects to existing APIs.

---

### Week 6: Testing & Deployment (4-6 hours)

#### Integration Testing
```bash
# Run E2E tests
cd gw-spa
npm run test:e2e tests/e2e/my-sessions.test.ts

# Manual QA checklist (MVP-COMPLETION-MASTER-PRP)
- Create session works
- JWT contains correct claims
- JWKS endpoint returns public key
- Revoke updates status
- Renew extends expiration
- List filters correctly
```

#### Production Deployment
```bash
# Store private key in Secrets Manager
aws secretsmanager create-secret \
  --name gw-api/jwt-private-key \
  --secret-string file://keys/session_signing_key.pem \
  --profile ghostdog-prod

# Update Lambda environment
# JWT_PRIVATE_KEY_SECRET_ARN=arn:aws:secretsmanager:...

# Deploy
make deploy ENV=prod

# Smoke tests
./scripts/smoke-test-sessions.sh
```

---

## Future Roadmap (Post-MVP)

The following features are **not required for MVP** but are planned for future phases:

### Phase 2: Active SDK Integration (2-3 weeks)

**Heartbeat Mechanism**:
```
POST   /sessions/{id}/heartbeat
Body: { timestamp: "2025-11-06T14:30:00Z" }
Response: { remaining_seconds: 450, status: "active" }
```

**Use Cases**:
- Real-time usage tracking
- Early warning of expiration (5 min notice)
- Detailed analytics on actual usage
- Connection health monitoring

**Implementation**:
- Update Session model with `last_heartbeat` field
- Create heartbeat Lambda handler
- SDK sends heartbeat every 30 seconds
- Backend checks for stale sessions (>90s no heartbeat)
- EventBridge rule triggers cleanup Lambda

---

### Phase 3: Advanced Session Features (2-3 weeks)

**Session Validation Endpoint**:
```
POST   /sessions/validate
Body: { jwt: "eyJhbGci..." }
Response: { valid: true, session: {...}, remaining_seconds: 450 }
```

**Use Cases**:
- Provider apps validate JWT with backend
- Get real-time session status
- Check if session revoked
- Richer validation beyond JWT signature

**Session Completion with Reconciliation**:
```
POST   /sessions/{id}/complete
Body: { actual_usage_minutes: 25 }
Response: { tokens_refunded: 50, final_cost: 125 }
```

**Use Cases**:
- Refund unused tokens
- Detailed usage analytics
- Provider incentives for efficiency
- Cost optimization

---

### Phase 4: Webhooks & Events (3-4 weeks)

**Webhook Registration**:
```
POST   /applications/{id}/webhooks
Body: {
  "url": "https://provider.com/webhooks",
  "events": ["session.started", "session.warning", "session.ended"],
  "secret": "webhook-secret-123"
}
```

**Event Types**:
- `session.started` - Session JWT generated
- `session.warning` - 5 minutes remaining
- `session.ended` - Session expired or revoked
- `session.extended` - Duration increased
- `tokens.low` - User balance below threshold

**Implementation**:
- Webhooks DynamoDB table
- Event dispatcher with retry logic (3 attempts)
- HMAC signature generation
- SQS queue for async delivery
- Delivery status logging

---

### Phase 5: Analytics & Dashboards (2-3 weeks)

**Provider Analytics**:
```
GET    /applications/{id}/analytics
Query: start_date, end_date, granularity
Response: {
  "total_sessions": 1250,
  "unique_users": 450,
  "revenue_tokens": 125000,
  "avg_duration_minutes": 28.5
}
```

**Organization Analytics**:
```
GET    /organizations/{id}/usage
Response: {
  "tokens_spent": 50000,
  "sessions_created": 500,
  "top_applications": [...]
}
```

---

### Phase 6: Performance Optimizations

**Caching**:
- ElastiCache for session lookups
- TTL-based invalidation
- Reduce DynamoDB costs

**Batch Operations**:
- Bulk session creation
- Batch revocation
- Efficient cleanup jobs

**Monitoring**:
- CloudWatch metrics
- X-Ray tracing
- Custom dashboards
- Alerting on failures

---

## Success Criteria

### MVP Completion Checklist

**Backend (This Repo)**:
- [ ] Sessions DynamoDB table deployed and active
- [ ] 5 Lambda handlers implemented and tested
- [ ] JWKS endpoint serving public key
- [ ] JWT generation working with RS256
- [ ] API Gateway routes configured
- [ ] Cognito authorization enforced
- [ ] IAM policies minimal and correct
- [ ] Integration tests passing
- [ ] Deployed to ghostdog-dev environment
- [ ] Manual testing completed
- [ ] OpenAPI spec updated
- [ ] CLAUDE.md and README.md updated

**Cross-Repo Integration**:
- [ ] Frontend can create sessions (PRP-002B)
- [ ] My Sessions page displays correctly (PRP-002A)
- [ ] Session countdown timer works (PRP-002C)
- [ ] Revoke and renew functional (PRP-002C)
- [ ] Application launches with gwSession parameter
- [ ] E2E tests passing (my-sessions.test.ts)

**Quality Gates**:
- [ ] No TypeScript errors in frontend
- [ ] No Go compilation errors
- [ ] Unit test coverage >80%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Manual QA checklist complete
- [ ] Chrome DevTools showing no errors
- [ ] No NaN or placeholder data

**Production Readiness**:
- [ ] Private key in Secrets Manager
- [ ] Environment variables configured
- [ ] Terraform state in S3
- [ ] CI/CD pipeline updated
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## Appendix

### Key Files Reference

```
gw-api/
├── internal/
│   ├── handlers/
│   │   ├── sessions/
│   │   │   ├── list.go           # GET /users/:userId/sessions
│   │   │   ├── get.go            # GET /sessions/:id
│   │   │   ├── create.go         # POST /sessions
│   │   │   ├── revoke.go         # DELETE /sessions/:id
│   │   │   └── renew.go          # PUT /sessions/:id/renew
│   │   └── keys/
│   │       └── jwks.go           # GET /.well-known/jwks.json
│   ├── models/
│   │   └── session.go            # Session structs
│   └── services/
│       └── sessions/
│           ├── service.go        # Business logic
│           ├── jwt.go            # JWT generation
│           └── lifecycle.go      # Status calculation
├── terraform/
│   ├── sessions_table.tf         # DynamoDB table
│   ├── api_gateway.tf            # Route configuration
│   ├── lambda.tf                 # Lambda resources
│   └── iam.tf                    # Permissions
├── keys/
│   ├── session_signing_key.pem   # Private key (gitignored)
│   └── session_signing_key.pub   # Public key
└── openapi.yaml                  # API specification
```

### Related Documentation

- **PRP-002D**: `/gw-docs/PRPs/PRP-002D-sessions-backend.md` - Detailed backend tasks
- **PRP-002A**: `/gw-docs/PRPs/PRP-002A-session-display.md` - Frontend display
- **PRP-002B**: `/gw-docs/PRPs/PRP-002B-session-creation.md` - Session creation flow
- **PRP-002C**: `/gw-docs/PRPs/PRP-002C-session-lifecycle.md` - Lifecycle management
- **API Spec**: `/gw-docs/features/application-marketplace/api-specification.md`
- **JWT Spec**: `/gw-docs/features/application-marketplace/jwt-specification.md`
- **Data Models**: `/gw-docs/features/application-marketplace/data-models.md`
- **Alignment**: `/gw-docs/PRP_ALIGNMENT_CRITICAL.md` - Why PRPs are source of truth

---

**Last Updated**: 2025-11-06  
**Status**: Aligned with PRPs  
**Next Review**: After MVP completion
