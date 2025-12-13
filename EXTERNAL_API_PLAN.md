# External API Plan for TaskForce

## 🎯 Overview

This document outlines the plan to expose TaskForce's functionality as a public API that other platforms can integrate with. The API will enable third-party applications to manage campaigns, contacts, follow-ups, and more programmatically.

---

## 📋 Table of Contents

1. [Architecture & Design](#architecture--design)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Versioning](#api-versioning)
4. [Core Endpoints](#core-endpoints)
5. [Rate Limiting](#rate-limiting)
6. [Documentation](#documentation)
7. [Webhooks](#webhooks)
8. [SDKs & Developer Tools](#sdks--developer-tools)
9. [Implementation Phases](#implementation-phases)
10. [Security Considerations](#security-considerations)

---

## 🏗️ Architecture & Design

### API Style
- **RESTful API** with JSON responses
- **Base URL**: `https://api.taskforce.com/v1` (or your domain)
- **Content-Type**: `application/json`
- **Response Format**: Consistent JSON structure with `data`, `error`, `meta` fields

### Response Structure
```json
{
  "success": true,
  "data": { /* resource data */ },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email address",
    "details": { /* field-specific errors */ }
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## 🔐 Authentication & Authorization

### Current State
- Current API uses `X-User-Id` header (internal only)
- Basic API key auth exists but is in-memory only
- No persistent API key storage in database

### Proposed Solution

#### 1. API Key Management
- **Database Model**: Create `ApiKey` table in Prisma schema
- **Key Format**: `tf_live_...` (production) or `tf_test_...` (sandbox)
- **Key Generation**: Cryptographically secure random keys (32+ bytes)
- **Key Storage**: Hashed (bcrypt/argon2) in database
- **Key Metadata**: 
  - User ID
  - Permissions/scopes
  - Rate limit tier
  - Created date
  - Last used date
  - Expiration date (optional)
  - IP whitelist (optional)

#### 2. Authentication Methods

**Option A: API Key (Recommended for most use cases)**
```
Header: X-API-Key: tf_live_abc123...
```

**Option B: OAuth 2.0 (For advanced integrations)**
```
Header: Authorization: Bearer <access_token>
```

**Option C: JWT Tokens (For server-to-server)**
```
Header: Authorization: Bearer <jwt_token>
```

#### 3. Scopes & Permissions
- `campaigns:read` - View campaigns
- `campaigns:write` - Create/update campaigns
- `campaigns:delete` - Delete campaigns
- `contacts:read` - View contacts
- `contacts:write` - Create/update contacts
- `followups:read` - View follow-ups
- `followups:write` - Create/update follow-ups
- `analytics:read` - View analytics/metrics
- `webhooks:write` - Manage webhooks

---

## 🔢 API Versioning

### Strategy
- **URL-based versioning**: `/v1/`, `/v2/`, etc.
- **Default version**: Latest stable version
- **Deprecation policy**: 6 months notice before removing endpoints

### Version Header (Optional)
```
Header: API-Version: v1
```

---

## 📡 Core Endpoints

### Base Path: `/api/v1`

### 1. Campaigns API

#### List Campaigns
```
GET /api/v1/campaigns
Query Params:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - status: string (DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED)
  - folderId: string (optional)
  - sortBy: string (createdAt, updatedAt, name)
  - sortOrder: string (asc, desc)
```

#### Get Campaign
```
GET /api/v1/campaigns/:id
```

#### Create Campaign
```
POST /api/v1/campaigns
Body: {
  name: string
  recipients: {
    emailField: string
    rows: Array<Record<string, string>>
  }
  strategy: {
    startAt?: string (ISO 8601)
    delayMsBetweenEmails: number
    trackOpens: boolean
    trackClicks: boolean
    template: {
      subject: string
      html: string
      attachments?: Array<{
        filename: string
        content: string (base64)
        contentType: string
      }>
    }
  }
  folderId?: string
}
```

#### Update Campaign
```
PUT /api/v1/campaigns/:id
Body: { /* same as create, partial updates allowed */ }
```

#### Schedule Campaign
```
POST /api/v1/campaigns/:id/schedule
Body: {
  startAt: string (ISO 8601)
}
```

#### Pause Campaign
```
POST /api/v1/campaigns/:id/pause
```

#### Resume Campaign
```
POST /api/v1/campaigns/:id/resume
```

#### Cancel Campaign
```
POST /api/v1/campaigns/:id/cancel
```

#### Delete Campaign
```
DELETE /api/v1/campaigns/:id
```

#### Get Campaign Recipients
```
GET /api/v1/campaigns/:id/recipients
Query Params:
  - page: number
  - limit: number
  - status: string (PENDING, SENT, FAILED, etc.)
```

#### Get Campaign Analytics
```
GET /api/v1/campaigns/:id/analytics
Response: {
  totalRecipients: number
  sent: number
  failed: number
  opened: number
  clicked: number
  unsubscribed: number
  bounced: number
  openRate: number
  clickRate: number
  deliveryRate: number
}
```

### 2. Contacts API

#### List Contacts
```
GET /api/v1/contacts
Query Params:
  - page: number
  - limit: number
  - search: string (search by email/name)
```

#### Get Contact
```
GET /api/v1/contacts/:email
```

#### Create/Update Contact
```
PUT /api/v1/contacts/:email
Body: {
  email: string
  name?: string
  company?: string
  customFields?: Record<string, string>
}
```

#### Delete Contact
```
DELETE /api/v1/contacts/:email
```

#### Get Contact Activity
```
GET /api/v1/contacts/:email/activity
Response: Array of activity events (campaigns, opens, clicks, etc.)
```

### 3. Follow-Up Sequences API

#### List Follow-Up Sequences
```
GET /api/v1/follow-ups
Query Params:
  - campaignId: string (optional)
  - page: number
  - limit: number
```

#### Get Follow-Up Sequence
```
GET /api/v1/follow-ups/:id
```

#### Create Follow-Up Sequence
```
POST /api/v1/follow-ups
Body: {
  campaignId: string
  name: string
  steps: Array<{
    order: number
    delayMs: number
    template: {
      subject: string
      html: string
    }
    conditions?: {
      ifNotOpened?: boolean
      ifNotReplied?: boolean
      ifNotClicked?: boolean
    }
    sendAsReply?: boolean
    parentStepId?: string (for nested follow-ups)
  }>
}
```

#### Update Follow-Up Sequence
```
PUT /api/v1/follow-ups/:id
```

#### Delete Follow-Up Sequence
```
DELETE /api/v1/follow-ups/:id
```

### 4. Google Sheets Integration API

#### Import from Google Sheets
```
POST /api/v1/sheets/import
Body: {
  spreadsheetUrl: string
  worksheetId?: string
  headerRowIndex?: number (default: 0)
}
Response: {
  sheetSourceId: string
  columns: Array<string>
  rowCount: number
}
```

#### List Sheet Sources
```
GET /api/v1/sheets/sources
```

#### Get Sheet Source
```
GET /api/v1/sheets/sources/:id
```

### 5. Analytics API

#### Get User Analytics
```
GET /api/v1/analytics
Query Params:
  - startDate: string (ISO 8601)
  - endDate: string (ISO 8601)
  - groupBy: string (day, week, month)
Response: {
  campaigns: {
    total: number
    byStatus: Record<string, number>
  }
  emails: {
    sent: number
    opened: number
    clicked: number
    bounced: number
  }
  rates: {
    openRate: number
    clickRate: number
    bounceRate: number
  }
  trends: Array<{
    date: string
    sent: number
    opened: number
    clicked: number
  }>
}
```

### 6. Webhooks API

#### List Webhooks
```
GET /api/v1/webhooks
```

#### Create Webhook
```
POST /api/v1/webhooks
Body: {
  url: string
  events: Array<string> (campaign.sent, campaign.completed, email.opened, etc.)
  secret?: string (for signature verification)
}
```

#### Update Webhook
```
PUT /api/v1/webhooks/:id
```

#### Delete Webhook
```
DELETE /api/v1/webhooks/:id
```

#### Test Webhook
```
POST /api/v1/webhooks/:id/test
```

### 7. API Key Management API

#### List API Keys
```
GET /api/v1/api-keys
```

#### Create API Key
```
POST /api/v1/api-keys
Body: {
  name: string
  scopes: Array<string>
  expiresAt?: string (ISO 8601)
}
Response: {
  key: string (only shown once!)
  id: string
  name: string
  scopes: Array<string>
  createdAt: string
}
```

#### Revoke API Key
```
DELETE /api/v1/api-keys/:id
```

---

## ⚡ Rate Limiting

### Current State
- General rate limiter: 5000 requests per 15 minutes
- Campaign creation: 100 per hour
- Campaign start: 50 per minute

### Proposed API Rate Limits

#### Tier-Based Limits
- **Free Tier**: 1,000 requests/day
- **Starter Tier**: 10,000 requests/day
- **Professional Tier**: 100,000 requests/day
- **Enterprise Tier**: Custom limits

#### Per-Endpoint Limits
- Campaign creation: 50/hour
- Email sending: Limited by campaign queue
- Analytics queries: 100/hour
- Webhook creation: 10/hour

#### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1640995200
```

---

## 📚 Documentation

### 1. OpenAPI/Swagger Specification
- Generate OpenAPI 3.0 spec from code
- Interactive API explorer (Swagger UI)
- Code examples in multiple languages

### 2. Developer Portal
- Getting started guide
- Authentication guide
- Code examples (cURL, JavaScript, Python, etc.)
- SDK documentation
- Webhook guide
- Best practices
- FAQ

### 3. API Reference
- Endpoint documentation
- Request/response examples
- Error codes reference
- Rate limit documentation

---

## 🔔 Webhooks

### Supported Events
- `campaign.created`
- `campaign.scheduled`
- `campaign.started`
- `campaign.paused`
- `campaign.completed`
- `campaign.cancelled`
- `email.sent`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.unsubscribed`
- `followup.sent`
- `contact.created`
- `contact.updated`

### Webhook Payload
```json
{
  "event": "email.opened",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "campaignId": "camp_123",
    "recipientEmail": "user@example.com",
    "messageLogId": "msg_123",
    "openedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Webhook Security
- **Signature Verification**: HMAC-SHA256 signature in `X-TaskForce-Signature` header
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Timeout**: 5 seconds per attempt
- **Max Retries**: 3 attempts

---

## 🛠️ SDKs & Developer Tools

### Planned SDKs
1. **JavaScript/TypeScript** (Node.js & Browser)
2. **Python**
3. **PHP**
4. **Ruby**
5. **Go**

### SDK Features
- Type-safe API client
- Automatic retries
- Request/response logging
- Webhook signature verification
- Error handling

### Developer Tools
- Postman Collection
- Insomnia Collection
- CLI tool (`taskforce-cli`)
- VS Code extension (optional)

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `ApiKey` database model
- [ ] Implement API key authentication middleware
- [ ] Create API key management endpoints
- [ ] Set up API versioning structure (`/api/v1`)
- [ ] Implement consistent error handling
- [ ] Add request/response logging

### Phase 2: Core Endpoints (Week 3-4)
- [ ] Campaigns API (CRUD + actions)
- [ ] Contacts API
- [ ] Follow-Up Sequences API
- [ ] Analytics API
- [ ] Rate limiting per API key tier

### Phase 3: Advanced Features (Week 5-6)
- [ ] Webhooks system
- [ ] Google Sheets integration API
- [ ] Webhook signature verification
- [ ] Webhook retry logic

### Phase 4: Documentation & SDKs (Week 7-8)
- [ ] OpenAPI specification
- [ ] Developer portal
- [ ] JavaScript/TypeScript SDK
- [ ] Python SDK
- [ ] Postman collection

### Phase 5: Testing & Launch (Week 9-10)
- [ ] Comprehensive API testing
- [ ] Load testing
- [ ] Security audit
- [ ] Beta testing with select partners
- [ ] Public launch

---

## 🔒 Security Considerations

### 1. API Key Security
- Keys stored as hashes (never plaintext)
- Key rotation support
- IP whitelisting (optional)
- Key expiration
- Audit logging for key usage

### 2. Request Security
- HTTPS only (TLS 1.2+)
- Request signing (optional, for sensitive operations)
- Timestamp validation (prevent replay attacks)
- Input validation & sanitization
- SQL injection prevention (Prisma handles this)

### 3. Rate Limiting
- Per-API-key limits
- Per-IP limits (fallback)
- Burst protection
- Rate limit headers

### 4. Data Privacy
- User data isolation (API keys scoped to users)
- PII handling compliance
- Audit trails
- Data retention policies

### 5. Monitoring & Alerting
- Unusual activity detection
- Failed authentication alerts
- Rate limit abuse alerts
- Error rate monitoring

---

## 📊 Database Schema Changes

### New Models

```prisma
model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  keyHash     String   @unique // Hashed API key
  name        String
  scopes      String[] // Array of permission strings
  rateLimitTier String @default("free") // free, starter, professional, enterprise
  ipWhitelist String[] // Optional IP addresses
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([keyHash])
  @@index([isActive])
}

model Webhook {
  id          String   @id @default(cuid())
  userId      String
  url         String
  events      String[] // Array of event types
  secret      String?  // For signature verification
  isActive    Boolean  @default(true)
  lastTriggeredAt DateTime?
  failureCount Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isActive])
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  payload     Json
  status      String   // pending, success, failed
  statusCode  Int?
  responseBody String?
  attempts    Int      @default(0)
  deliveredAt DateTime?
  createdAt   DateTime @default(now())

  webhook Webhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId])
  @@index([status])
  @@index([createdAt])
}
```

### Update User Model
```prisma
model User {
  // ... existing fields ...
  apiKeys     ApiKey[]
  webhooks    Webhook[]
}
```

---

## 🎯 Success Metrics

### Technical Metrics
- API uptime: > 99.9%
- Average response time: < 200ms
- Error rate: < 0.1%
- Rate limit compliance: 100%

### Business Metrics
- Number of API keys created
- API requests per day
- Active integrations
- Developer satisfaction (surveys)

---

## 📝 Next Steps

1. **Review & Approve Plan**: Get stakeholder approval
2. **Create GitHub Issues**: Break down into tasks
3. **Start Phase 1**: Database schema + authentication
4. **Set up API Documentation**: OpenAPI spec structure
5. **Create Developer Portal**: Basic landing page

---

## ❓ Questions to Consider

1. **Pricing Model**: Should API usage be included in existing plans or separate pricing?
2. **Rate Limits**: Are the proposed limits appropriate?
3. **OAuth 2.0**: Should we implement OAuth in addition to API keys?
4. **Sandbox Environment**: Do we need a separate test environment?
5. **API Deprecation**: What's our policy for breaking changes?

---

## 📚 References

- [REST API Best Practices](https://restfulapi.net/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [OAuth 2.0 RFC](https://oauth.net/2/)
- [Webhook Best Practices](https://webhooks.fyi/)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Author**: TaskForce Development Team





