# AI Assistant and LLM Architecture Index - Predicto

This document serves as the architectural knowledge base and coding guidelines for LLMs and AI agents working on the Predicto application codebase.

---

## 1. Critical Project Rules (Next.js & Stack)

- **Next.js Version**: The project runs Next.js 16 (App Router) and React 19.
  - **Asynchronous Route Parameters**: In all `route.ts` and `page.tsx` files, route parameters are wrapped in a `Promise`:
    ```typescript
    // CORRECT:
    export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const { id } = await params;
    }
    ```
  - **Client vs Server Components**: Dashboard views (`app/dashboard/**`) and authentication pages (`app/auth/**`) are React Client Components (`"use client"`). They use React state hooks (`useState`), `next-intl` localization (`useTranslations`), and `next-auth/react` (`useSession`).
- **Authentication and Authorization**:
  - Session strategy is JWT-based (`NextAuth` v5 beta configured in `lib/auth.ts`).
  - Route authentication check: `const session = await auth();`.
  - Administrator privileges in API route handlers require checking `session.user.role === "ADMIN"` AND validating league-specific rights via `canManageCompetition(session.user, competition.createdBy)` from `lib/api.ts`.
- **API Error Handling**:
  - Always return errors using helper functions from `lib/api.ts`:
    ```typescript
    return apiError(400, "CODE_IN_UPPER_SNAKE_CASE", "English description", { optionalParam: 123 });
    return unauthorized(); // 401
    return forbidden();    // 403
    return internalError();// 500
    ```
  - Never hardcode translated error messages on the backend. The backend strictly returns English messages and stable error codes; translation into Polish or English is performed client-side using `useApiError()` and `messages/{locale}/errors-common.json`.
- **Timezone and Date Processing**:
  - All database timestamps are stored in UTC.
  - For checking whether an event deadline has passed relative to current time, use `isTimePassed(targetDate)` from `lib/timeUtils.ts`.
- **Test Integrity**:
  - Every API logic modification must conform to the test suite in `tests/api/`. Run `npm run test` after any modifications and ensure all 306 tests pass.

---

## 2. Codebase Map and File Index

### 2.1. Root and Configuration Files
- `README.md`: High-level project summary, installation guide, and tech stack overview.
- `package.json`: Project dependencies (Next.js 16, Prisma 6, NextAuth 5, Tailwind 4, Web-Push, Vitest).
- `tsconfig.json`: TypeScript configuration with path aliases (`@/*`).
- `vitest.config.ts`: Vitest test runner configuration.
- `docker-compose.yml`: Local PostgreSQL development database setup.
- `proxy.ts`: Proxy helper script.
- `next.config.ts`: Next.js configuration integrating `next-intl/plugin`.
- `AGENTS.md`: This file; architectural rules and index for LLM agents.
- `CLAUDE.md`: Reference pointer to `AGENTS.md`.

### 2.2. Core Libraries (`lib/`)
- `lib/prisma.ts`: Global Prisma client instance with hot-reload singleton caching for development.
- `lib/auth.ts`: NextAuth v5 configuration - credentials authentication with bcrypt, JWT and session callbacks, and database-backed role injection.
- `lib/api.ts`: Standard API response helpers (`apiError`, `unauthorized`, `forbidden`, `internalError`, `canManageCompetition`).
- `lib/timeUtils.ts`: Date utilities formatted for `Europe/Warsaw` (`getCurrentPolishTime`, `isTimePassed`, `formatPolishDateTime`).
- `lib/useApiError.ts`: React hook translating backend error codes using `errors-common.json`.
- `lib/webPush.ts`: Web-push library initialization with VAPID credentials.

### 2.3. Database and ORM (`prisma/`)
- `prisma/schema.prisma`: Database schema definitions:
  - `User`: User accounts, roles (`USER`, `ADMIN`), relations to competitions, predictions, and push subscriptions.
  - `Competition`: Prediction leagues (`FOOTBALL` or `RACING`), visibility (`isPublic`), unique `inviteCode`, owner `createdBy`.
  - `CompetitionMember`: League membership linking users to leagues, tracking cumulative `points`.
  - `CompetitionScoring`: Custom scoring parameters per competition.
  - `FootballSeason`, `Team`, `FootballMatch`, `FootballPrediction`, `FootballSeasonWinnerPrediction`: Football models.
  - `RacingSeason`, `Driver`, `RacingWeekend`, `RacingSession`, `RacingSessionParticipant`, `RacingResult`, `RacingPrediction`, `RacingSeasonWinnerPrediction`, `Wildcard`: Formula 1 racing models.
  - `PushSubscription`, `NotificationLog`: Web push subscriptions and reminder dispatch records.
  - `AuditLog`: Action audit logs for administrative interventions.
- `prisma/seed.ts`: Seed script populating default teams, F1 drivers, and default admin user.
- `prisma/migrations/`: SQL database migration directory.

### 2.4. Internationalization (`i18n/` & `messages/`)
- `i18n/config.ts`: Supported language configurations (`['pl', 'en']`, default: `'pl'`).
- `i18n/request.ts`: Request middleware extracting locale from cookie `NEXT_LOCALE` or `Accept-Language` headers.
- `messages/pl/base.json` & `messages/en/base.json`: UI translation dictionaries.
- `messages/pl/errors-common.json` & `messages/en/errors-common.json`: Dictionaries mapping API error codes (`UPPER_SNAKE_CASE`) to user-facing messages.

### 2.5. UI Components (`components/`)
- `components/Icons.tsx`: SVG icon components (trophies, football, race car, notifications, lock, users).
- `components/LanguageSwitcher.tsx`: Language toggle component setting the `NEXT_LOCALE` cookie.
- `components/NotificationToggle.tsx`: Push notification permission toggle managing Service Worker registration.

### 2.6. PWA and Public Assets (`public/`)
- `public/sw.js`: Service Worker handling `push` and `notificationclick` events with bilingual support.
- `public/*.png`: Web App manifest icons, badges, and favicons.
- `app/manifest.ts`: Progressive Web App manifest generator.

### 2.7. API Route Handlers (`app/api/` - 26 Routes)
1. `auth/password/route.ts`: `PATCH` - Authenticated user password update.
2. `auth/register/route.ts`: `POST` - User registration.
3. `auth/[...nextauth]/route.ts`: `GET`, `POST` - NextAuth handlers.
4. `competitions/route.ts`: `GET` (list my leagues / explore public leagues), `POST` (create competition by ADMIN).
5. `competitions/members/route.ts`: `POST` - Join league via `inviteCode`.
6. `competitions/[id]/route.ts`: `GET` (league details and leaderboard), `DELETE` (delete league).
7. `competitions/[id]/members/route.ts`: `POST` - Join public league by ID.
8. `competitions/[id]/matches/route.ts`: `GET` (list matches), `POST` (create fixture by ADMIN).
9. `competitions/[id]/matches/[matchId]/route.ts`: `PATCH` (update match, enter score, resolve points, adjust `votingClosedAt`), `DELETE` (delete fixture).
10. `competitions/[id]/matches/[matchId]/predictions/route.ts`: `GET` (view predictions - caller only before kickoff, all members after kickoff), `POST` (save prediction).
11. `competitions/[id]/football/season-winner/route.ts`: `GET` (get champion pick), `POST` (submit champion pick before season start), `PUT` (declare champion by ADMIN and award bonus points).
12. `competitions/[id]/racing/weekends/route.ts`: `GET` (list GP weekends), `POST` (create weekend).
13. `competitions/[id]/racing/weekends/[weekendId]/route.ts`: `GET` (weekend details), `DELETE` (delete weekend).
14. `competitions/[id]/racing/sessions/route.ts`: `GET` (list sessions), `POST` (create session, assign drivers and Wildcard).
15. `competitions/[id]/racing/sessions/[sessionId]/route.ts`: `PATCH` (update session, adjust schedule), `DELETE` (delete unresolved session).
16. `competitions/[id]/racing/sessions/[sessionId]/predictions/route.ts`: `GET` (view session predictions), `POST` (save podium P1-P3 and Wildcard prediction).
17. `competitions/[id]/racing/sessions/[sessionId]/results/route.ts`: `POST` (submit official session finishing order, transactional point recalculation).
18. `competitions/[id]/racing/season-winner/route.ts`: `GET`, `POST`, `PUT` - Forecast and declare driver champion.
19. `drivers/route.ts`: `GET` (list drivers), `POST` (create driver).
20. `drivers/[id]/route.ts`: `GET`, `PUT`, `DELETE` - Manage and safely delete drivers.
21. `teams/route.ts`: `GET` (list teams), `POST` (create team).
22. `teams/[id]/route.ts`: `GET`, `PUT`, `DELETE` - Manage and safely delete teams.
23. `users/route.ts`: `GET` - Paginated user directory (`ADMIN` only).
24. `users/[id]/route.ts`: `PATCH` (role elevation, password reset), `DELETE` (account deletion).
25. `push/subscriptions/route.ts`: `GET`, `POST`, `DELETE` - Browser push subscription management.
26. `cron/reminders/route.ts`: `POST` - Reminder notification dispatcher authenticated via `CRON_SECRET`.

### 2.8. Application Views (`app/` - 26 Pages)
- `app/layout.tsx`: Root HTML layout with font imports, session provider, and i18n setup.
- `app/page.tsx`: Root entry point redirecting to `/dashboard`.
- `app/auth/login/page.tsx`: Authentication login page.
- `app/auth/register/page.tsx`: User registration page.
- `app/privacy/page.tsx` & `app/terms/page.tsx`: Static legal policy pages.
- `app/dashboard/page.tsx`: Main dashboard overview.
- `app/dashboard/profile/page.tsx`: Account profile, password change, push toggle.
- `app/dashboard/users/page.tsx`: User directory and role management.
- `app/dashboard/teams/page.tsx`, `teams/create/page.tsx`, `teams/[id]/edit/page.tsx`: Football team management views.
- `app/dashboard/drivers/create/page.tsx`, `drivers/[id]/edit/page.tsx`: Driver management views.
- `app/dashboard/competitions/page.tsx`: Competitions index, code-based join, public discovery.
- `app/dashboard/competitions/create/page.tsx`: Competition creation wizard with custom scoring settings.
- `app/dashboard/competitions/[id]/page.tsx`: Competition hub, member standings, champion voting.
- `app/dashboard/competitions/[id]/matches/page.tsx`: Match schedule and prediction form.
- `app/dashboard/competitions/[id]/matches/[matchId]/predictions/page.tsx`: Competitor prediction overview after match kickoff.
- `app/dashboard/competitions/[id]/admin/matches/page.tsx`: Fixture management and score submission.
- `app/dashboard/competitions/[id]/admin/announce-winner/page.tsx`: Football champion announcement console.
- `app/dashboard/competitions/[id]/racing/page.tsx`: GP weekend schedule and session prediction form.
- `app/dashboard/competitions/[id]/racing/sessions/[sessionId]/predictions/page.tsx`: Competitor prediction overview after session start.
- `app/dashboard/competitions/[id]/admin/racing/page.tsx`: Racing admin navigation dashboard.
- `app/dashboard/competitions/[id]/admin/racing/weekends/page.tsx`: Grand Prix weekend administration.
- `app/dashboard/competitions/[id]/admin/racing/sessions/[weekendId]/page.tsx`: Session setup and result entry.
- `app/dashboard/competitions/[id]/admin/racing/season-winner/page.tsx`: F1 driver champion announcement console.

### 2.9. Test Suite (`tests/`)
- `tests/setup.ts`, `tests/helpers.ts`, `tests/mocks/auth.ts`, `tests/mocks/prisma.ts`.
- 15 test suites in `tests/api/*.test.ts` covering authorization, business rules, idempotency, and scoring logic.

---

## 3. Implementation Guidelines for Common Modifications

1. **Adding a Scoring Rule**:
   - Update `CompetitionScoring` model in `prisma/schema.prisma`.
   - Update default scoring values in `app/dashboard/competitions/create/page.tsx` and the creation endpoint in `app/api/competitions/route.ts`.
   - Implement the rule in the relevant calculation handler (`app/api/competitions/[id]/matches/[matchId]/route.ts` or `racing/.../results/route.ts`).
   - Add unit tests verifying calculation logic and idempotency in `tests/api/football-scoring.test.ts` or `racing-scoring.test.ts`.
2. **Adding a New API Error Code**:
   - Return via `apiError(400, "NEW_ERROR_CODE", "English description")`.
   - Add localized translations to `messages/pl/errors-common.json` and `messages/en/errors-common.json` under `"apiErrors"`.
3. **Database Schema Changes**:
   - Run `npx prisma generate` after altering `schema.prisma`. Dynamic proxy mocks in `tests/mocks/prisma.ts` adapt automatically without manual test mock edits.
