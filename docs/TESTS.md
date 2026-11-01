# Test Suite Documentation - Predicto

Predicto includes an automated unit and integration test suite built with **Vitest**. All tests execute entirely in-memory without requiring an external PostgreSQL instance, utilizing dynamic proxy mocks for the Prisma Client and session mocking for NextAuth v5.

---

## 1. Running Tests

The test runners are configured in `package.json`:

```bash
# Run all test suites once
npm run test
# or
npx vitest run

# Run tests in continuous watch mode
npm run test:watch

# Execute a single test file
npx vitest run tests/api/football-scoring.test.ts
```

Current test status: **15 test files, 306 tests - 100% PASS** (execution time: ~1.5s).

---

## 2. Test Harness Architecture

Directory structure within `tests/`:

```text
tests/
├── setup.ts                    # Global Vitest configuration; resets all mocks before each test
├── helpers.ts                  # Test utilities for requests, contexts, dates, and sessions
├── mocks/
│   ├── auth.ts                 # Mock for @/lib/auth (auth(), signIn, signOut)
│   └── prisma.ts               # Dynamic JavaScript Proxy mock for @/lib/prisma
└── api/                        # Endpoint test suites (15 test files)
```

### 2.1. Dynamic Prisma Client Proxy Mock (`tests/mocks/prisma.ts`)
The Prisma client is mocked using a JavaScript `Proxy`. Any access to a model and method:
```typescript
prisma.competition.findUnique(...)
prisma.footballPrediction.upsert(...)
prisma.$transaction(...)
```
automatically instantiates a `vi.fn()` mock function on demand. This eliminates the need to update manual test mock declarations when changing the Prisma schema.
- `resetPrismaMock()` flushes mock state and call logs before each test in `setup.ts`.
- `prisma.$transaction` executes the passed transactional callback directly using the same mock proxy instance.

### 2.2. Test Helper Utilities (`tests/helpers.ts`)
Common utilities used across test suites:
- `asAnon()`: Simulates an unauthenticated request (`auth()` resolves to `null`).
- `asUser(id = "user1")`: Simulates an authenticated standard user with role `USER`.
- `asAdmin(id = "admin1")`: Simulates an authenticated administrator with role `ADMIN`.
- `jsonReq(body, method = "POST", url)`: Creates a standard `NextRequest` with serialized JSON payload and `application/json` headers.
- `ctx({ id: "c1" })`: Wraps route parameters in a `Promise` according to Next.js 15+ App Router typing requirements.
- `calls(mockFn)`: Returns array of first arguments from all mock calls.
- `FUTURE()` and `PAST()`: Generates Date instances one hour in the future or one hour in the past.

---

## 3. Test Suites Overview (`tests/api/`)

The table below summarizes all 15 test suites and their tested invariants:

| Test File | Tests | Coverage and Invariants |
|---|---|---|
| `change-password.test.ts` | 4 tests | Password change authentication, validation of current password, rejection of identical new passwords, and correct storage of bcrypt hashes. |
| `competitions-admin.test.ts` | 22 tests | Admin competition creation, unique invite code generation, private league isolation, lazy football season creation, and football champion announcement. |
| `competitions.test.ts` | 11 tests | Joining leagues via direct ID vs invite code, blocking private league entry via ID, member leaderboard data filtering, and cascade deletion by league creator. |
| `drivers-teams.test.ts` | 14 tests | Football team and driver management: database-backed role validation, car number uniqueness, 3-letter team acronym uppercase enforcement, and referential integrity upon deletion. |
| `football-predict.test.ts` | 11 tests | Fixture predictions: score range validation (0-20), temporal lock at kickoff and voting closure deadline, IDOR protection, and prediction visibility masking prior to kickoff. |
| `football-scoring.test.ts` | 9 tests | Match scoring calculations: exact score vs correct outcome/draw, leaderboard point updates, calculation idempotency, and score correction point reversals. |
| `match-admin-and-time.test.ts` | 11 tests | Time utility verification (`Europe/Warsaw` summer/winter daylight savings time), match administration, and early voting deadline adjustment (`votingClosedAt`). |
| `notifications.test.ts` | 7 tests | Web Push subscription lifecycle (registration and deletion) and CRON endpoint (`/api/cron/reminders`): bearer token validation, EARLY and LATE reminder stages, handling HTTP 404/410 push service errors. |
| `racing-admin.test.ts` | 7 tests | Racing administration: driver season winner resolution, transactional race session result submission, and automatic voting deadline locking. |
| `racing-predictions.test.ts` | 11 tests | F1 predictions: podium driver uniqueness (P1 != P2 != P3), Wildcard driver prediction handling, nullifying podium fields in qualifying sessions, and visibility masking before session start. |
| `racing-scoring.test.ts` | 12 tests | Racing points calculation: exact podium matches, podium presence in alternate positions, Wildcard driver finishing position matches, and leaderboard updates. |
| `racing-structure.test.ts` | 23 tests | Grand Prix weekend and session management: participant rosters, random Wildcard driver assignment, and deletion guards for resolved weekends and sessions. |
| `register.test.ts` | 7 tests | Account registration: username and email uniqueness (case-insensitive), bcrypt password hashing, payload sanitization, and discarding client-provided `role` fields. |
| `season-winner-vote.test.ts` | 10 tests | Long-term championship prediction submissions: immutable single-vote enforcement, locking upon season event start, and user identity isolation. |
| `users-admin.test.ts` | 13 tests | User directory administration: pagination, role modification, self-demotion guards, account deletion with password verification, and league reassignment to `SYSTEM`. |

---

## 4. Key Testing Patterns and Principles

1. **Security-First Assertions**:
   - Every protected route handler verifies `401 Unauthorized` for unauthenticated requests and `403 Forbidden` for insufficient privileges.
   - **IDOR Prevention**: Assertions confirm that manipulating URL path parameters to reference resources belonging to other competitions returns `404` or `403`.
   - **Data Leak Prevention**: Queries ensure that sensitive attributes such as `passwordHash` and rival predictions prior to event kickoff are never included in responses.
2. **Idempotency and Calculation Consistency**:
   - Repeated result submission tests guarantee that re-submitting identical match scores or race results leaves total member leaderboard points unchanged.
3. **Temporal Boundary Testing**:
   - Time-sensitive logic (prediction locking, voting closure) is tested deterministically using `FUTURE()` and `PAST()` or `vi.setSystemTime()`.
