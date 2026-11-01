# Predicto - Sports Prediction Platform (Football & Formula 1 / Racing)

Predicto is a full-stack web application designed for organizing private and public prediction leagues. Users compete by predicting the outcomes of football matches and motorsport race weekends (Formula 1), as well as forecasting overall season champions.

The platform includes built-in internationalization (Polish and English), Web Push notifications (Progressive Web App), automated and idempotent point calculations within transactional database operations, and an administrative control panel.

---

## Features

- **Two Competition Categories**:
  - **Football**: League fixtures, exact score predictions, result-based scoring (exact score vs. correct outcome/draw), and pre-season winner predictions.
  - **Racing (Formula 1 / Motorsport)**: Grand Prix weekends and distinct sessions (Practice, Qualifying, Sprint Shootout, Sprint, Race). Predictions for podium finishes (P1, P2, P3) and Wildcard driver positions (designated driver or random draw), as well as season driver championship predictions.
- **League Management and Competition Formats**:
  - Public leagues (discoverable and open for direct joining) and private leagues (accessible only via a unique invite code).
  - Configurable scoring rules per competition (`exactScorePoints`, `winnerPoints`, `seasonWinnerPoints`, `podiumExactPoints`, `podiumAnyPoints`, `polePositionPoints`, `wildcardPoints`).
  - Prediction visibility isolation: competitor predictions remain hidden until the official event start time.
- **Web Push Notifications (PWA)**:
  - Standard VAPID implementation integrated with a Service Worker (`public/sw.js`).
  - Automated reminder delivery via a secured CRON endpoint, dispatching notifications in two stages (`EARLY`: between 4h and 20h/24h prior, `LATE`: within 4h prior) exclusively to participants who have not yet submitted predictions.
- **Dynamic Prediction Locking**:
  - Automatic submission lock at kickoff or session start time (`kickoff` / `startTime`).
  - Manual early lock or reopening capability controlled by administrators via `votingClosedAt`.
- **Internationalization (i18n)**:
  - Multi-language support (Polish and English) powered by `next-intl`.
  - Standardized API error format: backend returns stable `UPPER_SNAKE_CASE` error codes, translated client-side via `errors-common.json` with dynamic parameter interpolation.
- **Administration Panel**:
  - Management of driver profiles (name, car number, team) and football teams (name, 3-letter abbreviation).
  - User administration: role management (`USER` / `ADMIN`), administrative password resets, and account removal with league ownership reassignment to `SYSTEM` to preserve data integrity.
  - Match and session result entry with automatic, idempotent point recalculations inside database transactions.

---

## Technology Stack

- **Framework**: Next.js 16.2.11 (App Router, React 19, Server & Client Components)
- **Database & ORM**: PostgreSQL + Prisma ORM v6.19
- **Authentication**: NextAuth.js v5 (Auth.js beta) with JWT sessions, bcrypt hashing, and database-backed role verification
- **Styling**: Tailwind CSS v4
- **Localization**: `next-intl` (request middleware detecting `NEXT_LOCALE` cookies and `Accept-Language` headers)
- **Push Notifications**: `web-push` + Service Worker (`public/sw.js`)
- **Testing**: Vitest (306 in-memory unit and integration API tests with mock proxies for Prisma and Auth.js)

---

## Project Structure

```text
predicto/
├── app/                              # Next.js App Router
│   ├── api/                          # REST API route handlers (route.ts)
│   │   ├── auth/                     # Registration, password change, NextAuth endpoints
│   │   ├── competitions/             # Competition management, discovery, and membership
│   │   │   └── [id]/                 # Competition-specific endpoints
│   │   │       ├── football/         # Football season winner predictions and announcement
│   │   │       ├── matches/          # Match scheduling, scoring, and prediction submission
│   │   │       ├── members/          # Join competition by ID
│   │   │       └── racing/           # GP weekends, sessions, results, predictions, winner
│   │   ├── cron/reminders/           # Push notification cron runner secured by CRON_SECRET
│   │   ├── drivers/                  # Driver management endpoints
│   │   ├── push/subscriptions/       # Web Push subscription registration
│   │   ├── teams/                    # Football team management endpoints
│   │   └── users/                    # User administration (ADMIN only)
│   ├── auth/                         # Authentication views (login, registration)
│   ├── dashboard/                    # Authenticated dashboard views
│   │   ├── competitions/             # League listing, creation wizard, competition view
│   │   │   └── [id]/admin/           # Competition admin panels (fixtures, sessions, results)
│   │   ├── drivers/                  # Driver management interfaces
│   │   ├── profile/                  # Account profile, password updates, push toggle
│   │   ├── teams/                    # Football team management interfaces
│   │   └── users/                    # User directory and role management
│   ├── privacy/ & terms/             # Legal pages (Privacy Policy and Terms of Service)
│   ├── layout.tsx & page.tsx         # Root layout and root redirect
│   └── manifest.ts                   # PWA web app manifest
├── components/                       # UI components (Icons, LanguageSwitcher, NotificationToggle)
├── docs/                             # Detailed technical documentation
│   ├── ARCHITECTURE_AND_ENDPOINTS.md # Architecture, page routing, and 26 API endpoints
│   └── TESTS.md                      # Test suite specification and mock architecture
├── i18n/                             # next-intl configuration and request middleware
├── lib/                              # Core utilities (api, auth, prisma, timeUtils, webPush)
├── messages/                         # Translation dictionaries (pl and en)
├── prisma/                           # Database schema (schema.prisma), migrations, seed
├── public/                           # Static assets, PWA icons, Service Worker (sw.js)
├── tests/                            # Vitest test suite
│   ├── api/                          # Integration API tests (15 test suites)
│   ├── helpers.ts                    # Test utilities (asAdmin, asUser, jsonReq, ctx)
│   ├── mocks/                        # Prisma proxy mock and NextAuth session mock
│   └── setup.ts                      # Vitest test setup and teardown
├── AGENTS.md                         # Context and guidelines for AI assistants and LLMs
├── CLAUDE.md                         # Reference pointer to AGENTS.md
└── vitest.config.ts                  # Vitest runner configuration
```

---

## Getting Started

### 1. Environment Configuration (`.env`)

Create a `.env` file based on `.env.example`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/predicto?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-secret"

# VAPID Keys for Web Push (generate using: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-vapid-key"
VAPID_PRIVATE_KEY="your-private-vapid-key"
VAPID_SUBJECT="mailto:support@predicto.app"

# Secret token securing CRON reminder executions
CRON_SECRET="your-cron-secret-token"
```

### 2. Dependency Installation

```bash
npm install
```

### 3. Database Initialization

Start the PostgreSQL service (or use the provided `docker-compose.yml`), run migrations, and optionally seed the database:

```bash
# Start PostgreSQL via Docker (optional)
docker compose up -d

# Execute Prisma migrations
npx prisma migrate dev

# Seed initial data (default admin user)
npm run db:seed
```

### 4. Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start
```

The web application runs by default at [http://localhost:3000](http://localhost:3000).

---

## Testing

The project contains an automated unit and integration API test suite located in `tests/api/`. It enforces business rules, role-based access control, IDOR security, calculation idempotency, and push notification triggers.

```bash
# Run the test suite once (306 tests)
npm run test

# Run tests in watch mode
npm run test:watch
```

For an in-depth breakdown of the testing framework and test suites, refer to [docs/TESTS.md](docs/TESTS.md).

---

## Detailed Documentation

Comprehensive technical documentation is maintained in the following documents:

- [docs/ARCHITECTURE_AND_ENDPOINTS.md](docs/ARCHITECTURE_AND_ENDPOINTS.md) - Complete architecture reference, all 26 page views (`page.tsx`), and specification of all 26 REST API endpoints (`route.ts`).
- [docs/TESTS.md](docs/TESTS.md) - Vitest test architecture, proxy mock mechanics, security assertions, and test directory breakdown.
- [AGENTS.md](AGENTS.md) - LLM and AI agent guide covering domain rules, technical constraints, and full file index.
