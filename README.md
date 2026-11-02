# Isonga Connect (Isonga C) — Backend Core

> **"Your community. Your updates."**  
> A resilient, location-based civic announcement platform engineered for Rwanda's administrative hierarchy. Modernizes traditional loudspeaker announcements (*indangururamajwi*) through SMS, mobile push notifications, and verified community feeds.

---

## 1. System Architecture

Isonga Connect is engineered as a **Modular Monolith** using **NestJS** and **TypeScript**, backed by **PostgreSQL** (via Prisma ORM) and **Redis** (via BullMQ). 

### Key Architectural Decisions
- **Modular Monolith over Microservices:** Preserves ACID transaction guarantees across geographic hierarchy checks, user permissions, and announcement targeting while eliminating distributed transaction complexity and network latency.
- **Provider Pattern for Notification Gateways:** Notification dispatchers (`SmsModule`, `PushModule`) are abstracted behind strict TypeScript interfaces (`SmsProvider`, `PushProvider`). Carrier-specific adapters (MTN Rwanda, Airtel Rwanda, Twilio, Africa's Talking) can be swapped via environment variables without altering domain code.
- **Materialized Path Hierarchy:** Rather than slow recursive CTE queries, administrative areas store indexed materialized paths (e.g. `/RW/KIG/GAS/REM/RUK1/REB`), enabling $O(1)$ prefix queries for targeting entire sectors, cells, or villages.
- **Privacy by Design:** Strict adherence to Rwanda's Law N° 058/2021 relating to the protection of personal data and privacy. All public and admin-facing lists mask phone numbers (`+250788***222`), explicit consent is recorded with timestamps and versioning, and sensitive fields (passwords, OTP hashes) are automatically scrubbed before reaching audit logs.

```
                              ┌───────────────────────────────────┐
                              │     API Client (Mobile / Web)     │
                              └─────────────────┬─────────────────┘
                                                │ REST / Bearer JWT
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  NESTJS MODULAR MONOLITH CORE                                   │
│                                                                                                 │
│  [ Guards ] ──► JwtAuthGuard ──► RolesGuard ──► AreaScopeGuard (Server-side Territory Lock)     │
│                                                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │  AuthModule   │  │  UsersModule  │  │  AreasModule  │  │ResidentsModule│  │Announcements │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  │
│          │                  │                  │                  │                  │          │
│  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐  │
│  │TargetingModule│  │Notifications  │  │   SmsModule   │  │  PushModule   │  │Analytics/Audit│  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  │
└──────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────┘
           │                  │                  │                  │                  │
           ▼                  ▼                  ▼                  ▼                  ▼
┌─────────────────────┐  ┌─────────────────────────────────┐  ┌──────────────────────────────────┐
│   PostgreSQL 16+    │  │       Redis 7 + BullMQ          │  │       External Gateways          │
│   (Prisma Client)   │  │  (Queued Job Distribution)      │  │ (MTN / Airtel / Firebase FCM)    │
└─────────────────────┘  └─────────────────────────────────┘  └──────────────────────────────────┘
```

---

## 2. Rwanda Administrative Hierarchy

The database strictly implements Rwanda's standard 6-tier administrative structure:

$$\text{Country} \longrightarrow \text{Province / City} \longrightarrow \text{District} \longrightarrow \text{Sector} \longrightarrow \text{Cell} \longrightarrow \text{Village (Umudugudu)}$$

### Materialized Path Model
Each `AdministrativeArea` record contains:
- `code`: Unique code (e.g., `RW-KIG-GAS-REM-RUK1-REB`)
- `level`: Enum (`COUNTRY`, `PROVINCE`, `DISTRICT`, `SECTOR`, `CELL`, `VILLAGE`)
- `parentId`: Foreign key pointing to the immediate superior area
- `path`: Deterministic materialized path string (e.g., `/RW/KIG/GAS/REM/RUK1/REB`)

### Subordinate Query Optimization
When an announcement targets Sector Remera (`/RW/KIG/GAS/REM`) with `includeSubordinates = true`, the engine queries:
```sql
SELECT * FROM "AdministrativeArea" 
WHERE "path" LIKE '/RW/KIG/GAS/REM/%' OR "path" = '/RW/KIG/GAS/REM';
```
This is fully backed by a B-Tree index on `path`, executing in sub-millisecond time.

---

## 3. Technology Stack & Dependencies

| Layer | Technology | Version | Justification |
| :--- | :--- | :--- | :--- |
| **Framework** | NestJS | `^11.0.1` | Robust dependency injection, enterprise modular architecture |
| **Language** | TypeScript | `^5.7.3` | Strict type safety across DTOs, interfaces, and queries |
| **Database** | PostgreSQL | `16+` | Relational integrity, ACID compliance, spatial extensibility |
| **ORM** | Prisma ORM | `6.4.1 LTS` | Type-safe query builder, declarative migrations |
| **Queue / Cache** | Redis + BullMQ | `Redis 7 / BullMQ 5.40` | Reliable background notifications, retry backoff |
| **Auth & Crypto** | Passport-JWT + Bcrypt | `Passport 11 / Bcrypt 6` | Industry standard secure password hashing & stateless JWT |
| **Documentation** | Swagger / OpenAPI | `11.4.7` | Auto-generated interactive API schema at `/api/docs` |
| **Testing** | Jest + Supertest | `Jest 29` | Comprehensive unit and live end-to-end integration tests |

---

## 4. Security & Privacy Safeguards

### 1. Server-Side Scope Authorization (`AreaScopeGuard`)
Administrators are assigned explicit administrative areas in `AdministratorPermission`. A Cell Administrator assigned to **Rukiri I** cannot publish, view drafts, or target residents in **Rukiri II** or **Kimironko**. Super Administrators have universal scope.

### 2. Rwanda Data Protection Law (Law N° 058/2021) Compliance
- **Phone Number Masking:** Administrative endpoints return masked resident phone numbers (`+250788***222`). Plain numbers are accessible strictly by background notification dispatch workers.
- **Explicit Consent Tracking:** Each resident profile maintains `consentGiven`, `consentDate`, and `consentVersion`. Residents can withdraw consent at any time via `POST /api/v1/residents/me/consent`.
- **Targeting Engine Filtering:** The targeting engine automatically excludes residents who have not verified their phone or who have revoked consent, unless the announcement has `EMERGENCY` priority.

### 3. Cryptographic OTP Verification
- OTP codes are generated via `crypto.randomInt(100000, 999999)`.
- The database stores **only** the SHA-256 hash of the OTP (`otpHash`), never raw 6-digit digits.
- Brute-force protection: 10-minute expiration, max 5 failed attempts before lockout, and a 60-second cooldown between dispatch requests.

### 4. Audit Log Sanitization
The `AuditService` automatically sanitizes payloads before writing to `AuditLog`. Fields matching `password`, `otp`, `token`, `secret`, and `authorization` are replaced with `[REDACTED]`.

---

## 5. Modules & Responsibilities

| Module | Core Responsibility |
| :--- | :--- |
| **AuthModule** | Registration, login, JWT issuance, OTP generation, verification, and password resets |
| **UsersModule** | Administrative user management and explicit area permission assignment |
| **AreasModule** | Rwanda administrative hierarchy management, tree traversal, and path resolution |
| **ResidentsModule** | Resident profile management, location assignment, notification preferences, consent |
| **TargetingModule** | Recipient calculation engine, area subordinate resolution, opt-in filtering |
| **AnnouncementsModule** | Announcement drafting, scheduling, publishing, scope validation, resident feeds |
| **NotificationsModule** | Multi-channel dispatch orchestration, state tracking, DLR carrier webhook processing |
| **SmsModule** | Provider-agnostic SMS abstraction with mock and carrier integration adapters |
| **PushModule** | FCM-ready push notification service abstraction |
| **AnalyticsModule** | Aggregated delivery metrics, channel performance (SUBMITTED vs DELIVERED vs FAILED) |
| **AuditModule** | Immutable audit trail with automated secret redaction for regulatory compliance |
| **HealthModule** | Liveness and readiness probes checking PostgreSQL connectivity and heap memory |

---

## 6. API Route Catalogue

Interactive Swagger documentation is available at **`http://localhost:3000/api/docs`**.

### Authentication & Account (`/api/v1/auth`)
- `POST /auth/register` — Register a new resident account
- `POST /auth/login` — Authenticate and receive JWT access token
- `POST /auth/request-otp` — Request a 6-digit phone verification OTP
- `POST /auth/verify-otp` — Verify phone number using OTP
- `POST /auth/reset-password` — Secure password reset using OTP verification
- `GET /auth/me` — Retrieve authenticated user profile

### Administrative Areas (`/api/v1/areas`)
- `GET /areas` — List administrative areas (filterable by parent ID or level)
- `GET /areas/:id` — Retrieve area details
- `GET /areas/:id/subordinates` — Retrieve all subordinate administrative entities
- `GET /areas/:id/ancestors` — Retrieve ancestor administrative entities
- `POST /areas` — Create new administrative area (`SUPER_ADMIN` only)

### Resident Management (`/api/v1/residents`)
- `GET /residents/me` — Retrieve resident profile
- `PATCH /residents/me` — Update resident personal information
- `PATCH /residents/me/location` — Update registered village location
- `GET /residents/me/preferences` — Get notification channel preferences
- `PUT /residents/me/preferences` — Update channel preferences and categories
- `POST /residents/me/consent` — Grant or revoke data processing consent
- `GET /residents` — Admin resident directory with masked contact numbers

### Announcements (`/api/v1/announcements`)
- `POST /announcements` — Create announcement draft (with geographic scope validation)
- `GET /announcements` — List announcements within administrator's jurisdiction
- `GET /announcements/feed` — Resident personalized announcement feed
- `GET /announcements/:id` — Retrieve announcement details
- `PATCH /announcements/:id` — Update draft announcement
- `POST /announcements/:id/publish` — Publish draft and dispatch notifications
- `POST /announcements/:id/cancel` — Cancel announcement (requires mandatory reason)
- `POST /announcements/preview` — Preview eligible recipient count before publishing

### Notifications & Webhooks (`/api/v1/notifications`)
- `GET /notifications/announcements/:id` — Inspect delivery logs for an announcement
- `POST /notifications/webhooks/sms` — Carrier Delivery Receipt (DLR) webhook endpoint

### Analytics & Reporting (`/api/v1/analytics`)
- `GET /analytics/overview` — Platform-wide announcement and recipient statistics
- `GET /analytics/channels` — Multi-channel delivery breakdown (SUBMITTED, DELIVERED, FAILED)
- `GET /analytics/announcements/:id` — Per-announcement delivery performance

### Audit Logs (`/api/v1/audit`)
- `GET /audit/logs` — Query compliance audit logs (`SUPER_ADMIN` only)

---

## 7. Local Development Setup

### Prerequisites
- **Node.js** v20.x or v22.x LTS
- **npm** v10.x+
- **PostgreSQL** 16+ (local service or Docker)
- **Redis** 7+ (local service or Docker)

### Step 1: Clone and Install
```bash
git clone https://github.com/your-org/isonga-connect.git
cd isonga-connect
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure the database and Redis URLs match your environment:
```env
DATABASE_URL="postgresql://postgres:kaliza@localhost:5432/isonga_connect?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
JWT_SECRET="isonga-connect-super-secure-production-jwt-key-2026-rwanda"
JWT_EXPIRES_IN="7d"
```

### Step 3: Run Database Migrations & Seed
```bash
# Apply migrations to PostgreSQL
npx prisma migrate deploy

# Seed Rwanda administrative hierarchy and initial admin accounts
npm run prisma:seed
```

### Step 4: Launch the Server
```bash
# Development mode with Hot-Reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

The API will be live at `http://localhost:3000/api/v1` and Swagger docs at `http://localhost:3000/api/docs`.

---

## 8. Test Verification

Isonga Connect features complete test coverage for all domain logic and real-world integration flows:

### Unit Tests
```bash
npm test
```
*Executes 10 unit test suites covering 42 isolated domain scenarios across all modules.*

### Live End-to-End Integration Tests
```bash
npm run test:e2e
```
*Validates the entire civic workflow against a live PostgreSQL database:*
1. Health check database ping.
2. Administrative area hierarchy loading.
3. Super Admin & Sector Admin authentication.
4. Resident registration and cryptographic OTP verification.
5. Recipient count preview calculation.
6. Geographic scope enforcement (403 Forbidden when Sector Admin attempts cross-district posting).
7. Valid announcement drafting and instant publication.
8. Resident announcement feed delivery.
9. Telco carrier DLR ingestion webhook.
10. Analytics dashboard aggregation.
11. Audit log redaction.

---

## 9. Seeded Test Credentials

The database seed (`prisma/seed.ts`) populates the Rwanda hierarchy and default administrative accounts:

| Role | Phone | Password | Assigned Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `+250788000001` | `Password123!` | Rwanda (Nationwide) |
| **District Admin** | `+250788000002` | `Password123!` | Gasabo District |
| **Sector Admin** | `+250788000003` | `Password123!` | Remera Sector |
| **Cell Admin** | `+250788000004` | `Password123!` | Rukiri I Cell |
| **Resident** | `+250788000005` | `Password123!` | Rebero Village (Remera) |

---

## 10. Production Deployment Runbook

### Docker Deployment
Use the included `docker-compose.yml` to run the complete stack:
```bash
docker-compose up -d --build
```

### Production Checklist
1. **Database Connection Pooling:** Set `connection_limit` in `DATABASE_URL` matching your server's connection capacity.
2. **Environment Secret Hardening:** Replace `JWT_SECRET` with a high-entropy 256-bit secret generated via `openssl rand -hex 64`.
3. **SMS Gateway Switch:** In production, replace `MockSmsProvider` with a registered Rwandan aggregator (e.g. MTN Rwanda SMPP or Africa's Talking Rwanda SMS) by setting `SMS_PROVIDER=africas_talking` or `SMS_PROVIDER=mtn_rw`.
4. **Push Provider Configuration:** Place your Google Cloud service account JSON in `/secrets/fcm-service-account.json` and set `FCM_SERVICE_ACCOUNT_PATH`.
5. **Reverse Proxy & TLS:** Deploy behind Nginx or AWS ALB with HTTP/2 and TLS 1.3 enforced.

---

## 11. License & Civic Tech Commitment

Isonga Connect is developed as an open civic technology platform under the **MIT License**.
*Empowering local leaders and keeping citizens informed.*
