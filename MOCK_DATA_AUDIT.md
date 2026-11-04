# Isonga Connect (Isonga C) — Comprehensive Mock Data Audit & Removal Report

**Date:** March 2025  
**Platform Tagline:** *Your community. Your updates.*  
**Scope:** `isonga_frontend` & `isonga_backend`  
**Compliance Standard:** Zero mock fallbacks; full PostgreSQL + NestJS API integration; Rwanda Data Protection Law (Law N° 058/2021).

---

## 1. Executive Summary

This audit records the identification and complete removal of all hardcoded mock records, dummy datasets, simulated API responses, fake credentials, and silent catch-block fallbacks across the Isonga Connect application.

Every UI feature is now connected to authentic backend endpoints. When the database contains zero records, proper **empty states** are rendered. If an API call fails, proper **error states** and user feedback are surfaced rather than silently reverting to fictitious demo data.

---

## 2. Audited & Purged Mock Data Sources

| Location | Prior Mock Data / Fallback Anti-Pattern | Resolution & Real API Integration | Status |
| :--- | :--- | :--- | :--- |
| `lib/constants.ts` | `RWANDA_AREAS` (10 seeded objects), `DEMO_METRICS` (fake KPI values), `DEMO_ANNOUNCEMENTS` (4 fake announcements) | Removed all mock arrays; replaced with empty defaults. Added deprecation notice requiring API services. | **PURGED** |
| `lib/context/AuthContext.tsx` | `defaultAdminUser` pre-populating session without authentication; catch block fallback to demo admin | Initial state set to `null`; session restored strictly via `localStorage.getItem('isonga_token')` and verified by `GET /auth/me`. Expired tokens clear session. | **PURGED** |
| `lib/api/areas.service.ts` | Catch blocks fallback to `RWANDA_AREAS.filter(...)` | Replaced with direct calls to `GET /areas`, `GET /areas/:id`, `GET /areas/:id/subordinates`. Errors propagate to UI. | **PURGED** |
| `lib/api/announcements.service.ts` | Fallback to `DEMO_ANNOUNCEMENTS` in `getAnnouncements`, `getFeed`, `getAnnouncement`, and mock recipient numbers in `previewRecipients` | Replaced with direct API calls to `GET /announcements`, `GET /announcements/feed`, `GET /announcements/:id`, and `POST /announcements/preview`. Mapped targets and author details. | **PURGED** |
| `lib/api/residents.service.ts` | Fallback arrays with fake residents (`Aline Uwimana`, `Jean Claude`) and dummy profile/preferences | Replaced with direct calls to `GET /residents`, `GET /residents/me`, `GET /residents/me/preferences`, `PUT /residents/me/preferences`, `POST /residents/me/consent`. | **PURGED** |
| `lib/api/analytics.service.ts` | Fallback to `DEMO_METRICS` (38,400 submitted, 95.9% rate) and hardcoded channel performance | Integrated directly with `GET /analytics/overview` and `GET /analytics/channels`. Computes real-time totals and delivery rates from carrier DLR receipts. | **PURGED** |
| `lib/api/notifications.service.ts` | Hardcoded `log-101` through `log-103` fallback array | Extended backend with `GET /notifications` endpoint; connected service to real carrier delivery logs with masked recipients. | **PURGED** |
| `app/(dashboard)/page.tsx` | Hardcoded summary numbers `(metrics?.totalResidents || 14250)`, `76`, `38400`, `95.9%` | Replaced with real dynamic metrics (`?? 0`). Added empty state banner when no announcements have been published. | **PURGED** |
| `app/(dashboard)/analytics/page.tsx` | Hardcoded `channelMetrics`, `categoryBreakdown`, and static KPI counts (`38,400`, `37,320`, `1,080`) | Dynamic calculation using `analyticsService.getOverview()`, `analyticsService.getChannelMetrics()`, and announcements category aggregator. | **PURGED** |
| `app/(dashboard)/notifications/page.tsx` | Hardcoded `logs` array (`log-101` to `log-105`) | Dynamic fetching using `notificationsService.getLogs()`. Real status indicators (`DELIVERED`, `SUBMITTED`, `FAILED`), empty state, and refresh button. | **PURGED** |
| `app/(dashboard)/areas/page.tsx` | Imported `RWANDA_AREAS` directly from `constants.ts` | Dynamic hierarchy explorer fetching from `areasService.getAreas()`. Real search, tree navigation, and subordinate inspectors. | **PURGED** |
| `app/(dashboard)/residents/page.tsx` | Hardcoded village select options (`Rebero`, `Izuba`, `Ubumwe`) | Dynamic village options from `areasService.getAreas({ level: 'VILLAGE' })`; masked phone compliance; empty state when 0 residents found. | **PURGED** |
| `app/(dashboard)/settings/page.tsx` | Hardcoded administrator name `Diane Uwamahoro` and phone `+250 788 000 003` | Connected to authenticated administrator session via `useAuth()`. Displays real profile, assigned administrative scope, and role. | **PURGED** |
| `app/resident/page.tsx` | Hardcoded greeting `Aline`, location `Gasabo`, and static initial avatar | Connected to `residentsService.getProfile()` and `announcementsService.getFeed()`. Dynamic initials, greeting, and empty state banner. | **PURGED** |
| `app/resident/announcements/page.tsx` | Hardcoded mock array of 4 announcements | Dynamic feed fetching via `announcementsService.getFeed()`. Category filters, real dates, and empty state. | **PURGED** |
| `app/resident/announcements/[id]/page.tsx` | Hardcoded "Umuganda this Saturday" text and dates | Dynamic page using `useParams().id` and `announcementsService.getAnnouncement(id)`. Wrapped in `<Suspense>`. Real author, scope, and share action. | **PURGED** |
| `app/resident/location/page.tsx` | Hardcoded cells and static Kigali hierarchy | Connected to `areasService.getAreas()` and `residentsService.updateLocation()`. Saves selected location to PostgreSQL. | **PURGED** |
| `app/resident/notifications/page.tsx` | Hardcoded mock notifications (`notif-1` to `notif-4`) | Connected to real announcement feed with timestamps, read status, and empty state. | **PURGED** |
| `app/resident/profile/page.tsx` | Hardcoded `Aline Uwimana` and `+250 788 123 456` | Connected to `residentsService.getProfile()` and `authService.logout()`. Real Kinyarwanda/English language preference toggle and consent badge. | **PURGED** |
| `app/resident/login/page.tsx` | Pre-filled credentials (`+250788000003`, `Password123!`) and clickable quick-fill box | Clean production login form with empty inputs, loading spinner, and real error banner on invalid credentials. | **PURGED** |
| `components/layout/TopNavbar.tsx` | Hardcoded `Kigali City • Gasabo District • Remera Sector`, avatar `DU`, `Diane Uwamahoro` | Dynamic user profile and territory scope from `useAuth()`. | **PURGED** |
| `components/layout/AppSidebar.tsx` | Hardcoded `Remera Sector, Gasabo` and `Sector Administrator` | Dynamic territory badge and role display from `useAuth()`. Real logout handler. | **PURGED** |

---

## 3. Backend Verification

Backend tests pass cleanly with **0 failures**:
- **Unit & Service Tests:** 10 test suites passed, 42 tests passed.
- **E2E Integration Tests:** 12 tests passed against live PostgreSQL database.
- **New API Endpoint:** `GET /api/v1/notifications` added to `NotificationsController` with JWT and `RolesGuard` protection to feed platform-wide carrier receipt logs.

---

## 4. Frontend Verification

Frontend production build passed cleanly:
- **Build Engine:** Next.js 16.4.4 (Turbopack) with Partial Prerendering enabled.
- **Route Compilation:** 19 of 19 static and dynamic routes compiled with **0 errors**.
- **Suspense Boundaries:** All client hooks (`useParams()`, `usePathname()`) properly isolated within `<Suspense>` wrappers.
