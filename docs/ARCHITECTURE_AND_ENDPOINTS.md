# Architecture, Page Routes, and API Endpoints Documentation - Predicto

This document provides a technical specification of the Predicto application architecture, Next.js App Router structure, all 26 page views (`page.tsx`), and all 26 REST API route handlers (`route.ts`), including security constraints, request parameters, data lifecycle, and scoring rules.

---

## 1. System Architecture and Conventions

### 1.1. Security and Authorization Model
- **Session Mechanism**: Handled via NextAuth v5 utilizing JWT tokens signed with `NEXTAUTH_SECRET`.
- **Role Verification**: Users possess either a `USER` or `ADMIN` role. Roles are embedded in the JWT token upon authentication and verified against the PostgreSQL database in critical route handlers (`prisma.user.findUnique`).
- **Protection Against Stale JWTs**: Even if an outdated JWT token contains an `ADMIN` role claim, mutating endpoints verify the database directly to confirm the user is still active and holds administrative privileges.
- **Competition Ownership & Permission Boundary**: Modifying competition resources (fixtures, race sessions, results, winner declarations) requires an `ADMIN` role AND either ownership of the competition (`competition.createdBy === session.user.id`) or system-assigned ownership (`competition.createdBy === "SYSTEM"`). Evaluated using helper function `canManageCompetition(session.user, competition.createdBy)`.

### 1.2. Response Format and Error Standardization
- **Success Responses**: JSON payload with requested resource or confirmation message `{ message: string }`.
- **Error Responses**: Handled uniformly via helper `apiError(status, code, error, params?)` from `lib/api.ts`:
  - The backend returns an English technical message and a fixed `UPPER_SNAKE_CASE` code (e.g., `UNAUTHORIZED`, `MATCH_NOT_FOUND`, `VOTING_CLOSED`).
  - Frontend client components process the response through the `useApiError()` hook, translating the error code dynamically using `messages/{locale}/errors-common.json` with parameter substitution.

### 1.3. Timezone and Temporal Locks
- All timestamps in the PostgreSQL database are stored in UTC (`DateTime`).
- Centralized time helper utilities in `lib/timeUtils.ts`:
  - `getCurrentPolishTime()`: Constructs a `Date` object mapped to the `Europe/Warsaw` timezone.
  - `isTimePassed(date: Date)`: Evaluates if a given event timestamp is in the past relative to `new Date()`.
  - `formatPolishDateTime(date: Date)`: Formats timestamps for display in the Polish locale with timezone adjustment.

### 1.4. Scoring System and Points Breakdown

Each competition has an associated `CompetitionScoring` configuration record. Point values can be customized per competition during creation or default to the values listed below:

#### Football Scoring (`FOOTBALL`)

| Scoring Rule | Parameter Key | Default Value | Condition |
|---|---|---|---|
| Exact Score | `exactScorePoints` | 3 points | Awarded when both home goals and away goals exactly match the user's prediction (e.g. predicted `2:1`, actual `2:1`). |
| Correct Outcome | `winnerPoints` | 1 point | Awarded when the user predicts the correct outcome (home win, away win, or draw) but the scoreline differs (e.g. predicted `1:0`, actual `3:1`). Note: Points do not stack for the same fixture (getting an exact score awards 3 points, not 3 + 1). |
| Season Champion | `seasonWinnerPoints` | 10 points | Awarded to participants who correctly forecast the season winner team before the kickoff of the first match of the season. |

#### Racing / Formula 1 Scoring (`RACING`)

| Scoring Rule | Parameter Key | Default Value | Condition |
|---|---|---|---|
| Exact Podium Position | `podiumExactPoints` | 3 points | Awarded for each driver predicted on the podium who finishes on that exact step (P1, P2, or P3). A user correctly predicting all three podium finishers on their exact positions earns 3 * 3 = 9 points. |
| Podium Any Position | `podiumAnyPoints` | 1 point | Awarded for each driver predicted on the podium who finishes on the podium, but on a different step (e.g. predicted P1, finished P2 or P3). |
| Wildcard Driver Position | `wildcardPoints` | 2 points | Awarded in any session with a configured Wildcard driver if the user correctly predicts the exact finishing position of that designated driver. |
| Season Champion | `seasonWinnerPoints` | 10 points | Awarded to participants who correctly forecast the season driver champion before the start of the first racing session of the season. |
| Pole Position | `polePositionPoints` | 2 points | Configurable in `CompetitionScoring` for qualifying sessions. |

---

## 2. Page Routing Map (`page.tsx`)

All dashboard views and auth pages are implemented as React Client Components (`"use client"`), utilizing hooks such as `useTranslations()` from `next-intl` and `useSession()` from `next-auth/react`. Static legal pages are rendered on the server.

### 2.1. Authentication and Legal Pages

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Server | Public | Root redirect handler routing incoming traffic to `/dashboard`. |
| `/auth/login` | `app/auth/login/page.tsx` | Client | Public | User authentication form (email, password). Handles NextAuth credentials flow, error reporting, and language switching. |
| `/auth/register` | `app/auth/register/page.tsx` | Client | Public | User registration form (username, email, password, confirm password, terms and privacy acceptance). |
| `/privacy` | `app/privacy/page.tsx` | Server | Public | Privacy policy content with internationalized headers and metadata. |
| `/terms` | `app/terms/page.tsx` | Server | Public | Terms of service content with internationalized headers and metadata. |

### 2.2. User Dashboard and Administration Views

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | Client | Authenticated | Main user landing page displaying joined leagues, upcoming football fixtures, F1 race sessions, and notification status. |
| `/dashboard/profile` | `app/dashboard/profile/page.tsx` | Client | Authenticated | Account management interface: password update, Web Push subscription toggle, and account deletion (requires password verification). |
| `/dashboard/users` | `app/dashboard/users/page.tsx` | Client | ADMIN | User management console: paginated user list, role elevation/demotion (`USER`/`ADMIN`), password reset, and account deletion. |

### 2.3. Football Teams and Drivers Management

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/dashboard/teams` | `app/dashboard/teams/page.tsx` | Client | ADMIN | Listing of all football clubs with filtering, sorting, and deletion options. |
| `/dashboard/teams/create` | `app/dashboard/teams/create/page.tsx` | Client | ADMIN | Creation form for football teams (full name and unique 3-letter uppercase abbreviation). |
| `/dashboard/teams/[id]/edit` | `app/dashboard/teams/[id]/edit/page.tsx` | Client | ADMIN | Modification interface for football team records. |
| `/dashboard/drivers/create` | `app/dashboard/drivers/create/page.tsx` | Client | ADMIN | Driver creation form (driver name, unique car number, constructor/team name). |
| `/dashboard/drivers/[id]/edit` | `app/dashboard/drivers/[id]/edit/page.tsx` | Client | ADMIN | Driver profile edit interface. |

### 2.4. Competitions and Leagues

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/dashboard/competitions` | `app/dashboard/competitions/page.tsx` | Client | Authenticated | Competition hub with tabs for "My Competitions" and "Discover Public Competitions", invite code entry, and discipline filtering. |
| `/dashboard/competitions/create` | `app/dashboard/competitions/create/page.tsx` | Client | ADMIN | League creation wizard: type selection (`FOOTBALL`/`RACING`), name, season, visibility toggle, date range, and custom scoring rule values. |
| `/dashboard/competitions/[id]` | `app/dashboard/competitions/[id]/page.tsx` | Client | Member | Main league view: member standings table (points and rank), season champion voting, navigation to matches/sessions, invite code copy, admin tools. |

### 2.5. Football Fixtures and Predictions

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/dashboard/competitions/[id]/matches` | `app/dashboard/competitions/[id]/matches/page.tsx` | Client | Member | Fixture calendar with inline prediction submission for upcoming matches prior to kickoff or voting closure. |
| `/dashboard/competitions/[id]/matches/[matchId]/predictions` | `.../[matchId]/predictions/page.tsx` | Client | Member | Competitor prediction overview for a match. Unlocked only after match kickoff. |
| `/dashboard/competitions/[id]/admin/matches` | `.../admin/matches/page.tsx` | Client | Creator (ADMIN) | Fixture administration: creating matches, modifying kickoff times, toggling voting closures, and entering final scores to trigger resolution. |
| `/dashboard/competitions/[id]/admin/announce-winner` | `.../admin/announce-winner/page.tsx` | Client | Creator (ADMIN) | Season winner announcement console. Resolves season winner predictions and awards bonus points to eligible members. |

### 2.6. Racing Sessions and Predictions (Formula 1)

| Route URL | File Path | Type | Access | Functionality |
|---|---|---|---|---|
| `/dashboard/competitions/[id]/racing` | `.../racing/page.tsx` | Client | Member | Race weekend overview. Allows users to submit podium predictions (P1, P2, P3) and Wildcard driver finishing positions prior to session start. |
| `/dashboard/competitions/[id]/racing/sessions/[sessionId]/predictions` | `.../predictions/page.tsx` | Client | Member | Overview of all competitors' predictions for a session, available only after session start. |
| `/dashboard/competitions/[id]/admin/racing` | `.../admin/racing/page.tsx` | Client | Creator (ADMIN) | Racing management navigation menu with shortcuts to weekends, sessions, and champion announcement. |
| `/dashboard/competitions/[id]/admin/racing/weekends` | `.../admin/racing/weekends/page.tsx` | Client | Creator (ADMIN) | Grand Prix weekend management (Grand Prix name, country, race date). |
| `/dashboard/competitions/[id]/admin/racing/sessions/[weekendId]` | `.../sessions/[weekendId]/page.tsx` | Client | Creator (ADMIN) | Session setup: session type (Practice, Qualifying, Sprint, Race), driver roster assignment, Wildcard configuration (specific driver or random), official result entry, and score calculation. |
| `/dashboard/competitions/[id]/admin/racing/season-winner` | `.../admin/racing/season-winner/page.tsx` | Client | Creator (ADMIN) | Driver championship announcement console. Awards season winner bonus points and closes competition. |

---

## 3. Comprehensive REST API Endpoint Reference (`app/api/`)

All API routes are located in `app/api/**/route.ts` and return standard `NextResponse.json` payloads with appropriate HTTP status codes.

---

### 3.1. Authentication and Profile Endpoints (`/api/auth`)

#### `POST /api/auth/[...nextauth]`
- **File**: `app/api/auth/[...nextauth]/route.ts`
- **Access**: Public
- **Description**: NextAuth.js v5 route handler managing credentials-based authentication, JWT issuance, and session termination.

#### `POST /api/auth/register`
- **File**: `app/api/auth/register/route.ts`
- **Access**: Public
- **Request Body**:
  ```json
  { "username": "alice", "email": "alice@example.com", "password": "Password123", "acceptTerms": true }
  ```
- **Business Logic**:
  1. Validates that terms of service are accepted (`acceptTerms === true`).
  2. Checks for existing email (case-insensitive normalization) and username. Returns `409 EMAIL_TAKEN` or `409 USERNAME_TAKEN` on collision.
  3. Validates email format and password length (minimum 6 characters).
  4. Hashes the password using `bcrypt.hash(password, 10)`.
  5. Ignores any client-supplied `role` attribute; newly registered users are assigned `USER` by default.
- **Response**: `201 Created` with created user details (excluding password hash).

#### `PATCH /api/auth/password`
- **File**: `app/api/auth/password/route.ts`
- **Access**: Authenticated User
- **Request Body**:
  ```json
  { "currentPassword": "OldPassword123", "newPassword": "NewPassword123" }
  ```
- **Business Logic**: Validates that the provided current password matches the stored bcrypt hash. Ensures the new password is at least 6 characters and differs from the current password. Updates the user's password hash in the database.

---

### 3.2. User Management Endpoints (`/api/users`)

#### `GET /api/users`
- **File**: `app/api/users/route.ts`
- **Access**: `ADMIN` only
- **Query Parameters**: `?page=1&limit=10&search=alice`
- **Description**: Returns a paginated list of registered users. The `passwordHash` field is excluded. Max page limit is capped at 100.

#### `PATCH /api/users/[id]`
- **File**: `app/api/users/[id]/route.ts`
- **Access**: `ADMIN` only
- **Request Body**: `{ "role": "ADMIN" | "USER", "newPassword": "optionalPassword" }`
- **Business Logic**: Modifies user role or resets password. Self-demotion protection: an administrator cannot remove their own `ADMIN` role.

#### `DELETE /api/users/[id]`
- **File**: `app/api/users/[id]/route.ts`
- **Access**: Account Owner (requires password verification) OR `ADMIN` (password verification bypassed)
- **Data Integrity**: When a user who created competitions is deleted, the competitions are preserved by reassigning their `createdBy` identifier to `"SYSTEM"`.

---

### 3.3. Football Teams and Drivers Endpoints (`/api/teams`, `/api/drivers`)

#### `GET /api/teams`
- **File**: `app/api/teams/route.ts`
- **Access**: Authenticated User
- **Query Parameters**: `?sort=name` | `?sort=shortName`
- **Description**: Returns all football teams ordered by specified column.

#### `POST /api/teams`
- **File**: `app/api/teams/route.ts`
- **Access**: `ADMIN` only
- **Request Body**: `{ "name": "Arsenal", "shortName": "ARS" }`
- **Business Logic**: Enforces unique names and short names. Converts `shortName` to uppercase automatically. Returns `409` on duplicate.

#### `GET /api/teams/[id]` | `PUT /api/teams/[id]` | `DELETE /api/teams/[id]`
- **File**: `app/api/teams/[id]/route.ts`
- **Access**: GET (Authenticated), PUT/DELETE (`ADMIN` only).
- **Referential Integrity**: DELETE rejects removal with `400 REFERENTIAL_INTEGRITY` if the team has associated fixtures or season predictions.

#### `GET /api/drivers`
- **File**: `app/api/drivers/route.ts`
- **Access**: Authenticated User
- **Description**: Retrieves all motorsport drivers sorted by team and name.

#### `POST /api/drivers`
- **File**: `app/api/drivers/route.ts`
- **Access**: `ADMIN` only
- **Request Body**: `{ "name": "Charles Leclerc", "number": 16, "team": "Ferrari" }`
- **Business Logic**: Validates car number uniqueness (`409 NUMBER_TAKEN`). Preserves international diacritic characters.

#### `GET /api/drivers/[id]` | `PUT /api/drivers/[id]` | `DELETE /api/drivers/[id]`
- **File**: `app/api/drivers/[id]/route.ts`
- **Access**: GET (Authenticated), PUT/DELETE (`ADMIN` only).
- **Referential Integrity**: Rejects driver deletion (`400`) if the driver is linked to race sessions, official results, or predictions.

---

### 3.4. Competition Endpoints (`/api/competitions`)

#### `GET /api/competitions`
- **File**: `app/api/competitions/route.ts`
- **Access**: Authenticated User
- **Query Parameters**:
  - default: Returns competitions where the session user is an enrolled member (`my competitions`).
  - `?scope=all`: Public league discovery mode. Returns public leagues the user has not yet joined. Administrators receive all leagues.
  - `?type=FOOTBALL` / `?type=RACING`: Filter by competition discipline.
- **Privacy Enforcement**: The `inviteCode` is revealed strictly to the creator of the competition. For all other users, it is masked or omitted.

#### `POST /api/competitions`
- **File**: `app/api/competitions/route.ts`
- **Access**: `ADMIN` only
- **Request Body**:
  ```json
  {
    "name": "Premier League 2026/27",
    "type": "FOOTBALL",
    "season": "2026/2027",
    "startDate": "2026-08-15T00:00:00.000Z",
    "endDate": "2027-05-25T00:00:00.000Z",
    "isPublic": true,
    "scoringRules": {
      "exactScorePoints": 3,
      "winnerPoints": 1,
      "seasonWinnerPoints": 10
    }
  }
  ```
- **Business Logic**: Generates an 8-character uppercase invite code using `nanoid`. Automatically enrolls the creator as the first competition member with 0 points. Inserts custom scoring rules into `CompetitionScoring`.

#### `GET /api/competitions/[id]`
- **File**: `app/api/competitions/[id]/route.ts`
- **Access**: Enrolled member or Competition Admin
- **Description**: Returns competition metadata, scoring configuration, and member leaderboard ordered by points descending (`points DESC`). Sensitive user fields (email, password hash) are excluded.

#### `DELETE /api/competitions/[id]`
- **File**: `app/api/competitions/[id]/route.ts`
- **Access**: Competition Creator (`ADMIN`) or System Admin
- **Description**: Cascading deletion of the competition and all associated seasons, fixtures, race weekends, predictions, and scoring records.

#### `POST /api/competitions/[id]/members`
- **File**: `app/api/competitions/[id]/members/route.ts`
- **Access**: Authenticated User
- **Description**: Joins a public competition by ID.
- **Security Check**: Enforces that private competitions cannot be joined by ID (`403 FORBIDDEN`). Private competitions require the invite code endpoint.

#### `POST /api/competitions/members`
- **File**: `app/api/competitions/members/route.ts`
- **Access**: Authenticated User
- **Request Body**: `{ "inviteCode": "ABC12XYZ" }`
- **Description**: Joins a competition using its unique invite code. Codes are evaluated case-insensitively. Returns `409 ALREADY_MEMBER` if the user is already enrolled.

---

### 3.5. Football Match Endpoints (`/api/competitions/[id]/matches`, `/football`)

#### `GET /api/competitions/[id]/matches`
- **File**: `app/api/competitions/[id]/matches/route.ts`
- **Access**: Enrolled member
- **Description**: Returns all scheduled and finished matches in the competition, including team details and indicator of whether the user has predicted each fixture.

#### `POST /api/competitions/[id]/matches`
- **File**: `app/api/competitions/[id]/matches/route.ts`
- **Access**: Competition Creator (`ADMIN`)
- **Request Body**: `{ "homeTeamId": "...", "awayTeamId": "...", "kickoff": "2026-11-20T20:00:00.000Z" }`
- **Business Logic**: Validates that home and away teams are distinct. Creates match with status `SCHEDULED`. Lazily creates the parent `FootballSeason` if it does not yet exist.

#### `PATCH /api/competitions/[id]/matches/[matchId]`
- **File**: `app/api/competitions/[id]/matches/[matchId]/route.ts`
- **Access**: Competition Creator (`ADMIN`)
- **Request Body**:
  ```json
  {
    "homeGoals": 2,
    "awayGoals": 1,
    "status": "FINISHED",
    "votingClosedAt": "2026-11-20T19:30:00.000Z"
  }
  ```
- **Business Logic**:
  - **Voting Window Configuration**: Allows setting `votingClosedAt` or reopening voting by passing `null` prior to kickoff. Reopening or modifying voting after kickoff or on resolved matches is rejected (`400`).
  - **Score Resolution and Calculation**:
    1. Executed in a single database transaction (`prisma.$transaction`).
    2. Marks match as `resolved: true`.
    3. Evaluates predictions against actual scores:
       - Exact score match: awards `exactScorePoints` (default: 3).
       - Correct outcome (win/loss/draw margin): awards `winnerPoints` (default: 1).
       - Exact score takes precedence over outcome points; points do not stack for the same fixture.
    4. Recalculates and updates cumulative points in `CompetitionMember.points`. Operation is fully idempotent.

#### `DELETE /api/competitions/[id]/matches/[matchId]`
- **File**: `app/api/competitions/[id]/matches/[matchId]/route.ts`
- **Access**: Competition Creator (`ADMIN`)
- **Description**: Deletes a match record. Deletion of already resolved fixtures without reversing points is rejected to protect leaderboard consistency.

#### `GET /api/competitions/[id]/matches/[matchId]/predictions`
- **File**: `app/api/competitions/[id]/matches/[matchId]/predictions/route.ts`
- **Access**: Enrolled member
- **Security Check**:
  - Before kickoff (`isTimePassed(kickoff) === false`): Returns strictly the caller's own prediction. Accessing other participants' predictions is forbidden (`403`).
  - After kickoff: Returns predictions for all competition members for full leaderboard transparency.

#### `POST /api/competitions/[id]/matches/[matchId]/predictions`
- **File**: `app/api/competitions/[id]/matches/[matchId]/predictions/route.ts`
- **Access**: Enrolled member
- **Request Body**: `{ "homeGoals": 2, "awayGoals": 0 }`
- **Business Logic**: Rejects submission if current time exceeds kickoff or manual deadline `votingClosedAt` (`400 VOTING_CLOSED`). Upserts the prediction assigned to the authenticated user ID.

#### `GET` | `POST` | `PUT /api/competitions/[id]/football/season-winner`
- **File**: `app/api/competitions/[id]/football/season-winner/route.ts`
- **Access**: GET/POST (Enrolled Member), PUT (Competition Creator `ADMIN`).
- **POST**: Submits user prediction for season champion prior to the kickoff of the first match of the season. Predictions are immutable once placed.
- **GET**: Returns the authenticated user's selected champion and resolution status.
- **PUT**: Official champion declaration by admin (`{ "teamId": "..." }`). Awards `seasonWinnerPoints` (default: 10) to participants with matching predictions and sets `winnerResolved: true`.

---

### 3.6. Racing Endpoints (`/racing`, `/sessions`, `/weekends`)

#### `GET` | `POST /api/competitions/[id]/racing/weekends`
- **File**: `app/api/competitions/[id]/racing/weekends/route.ts`
- **Access**: GET (Member), POST (Competition Creator `ADMIN`).
- **POST Request Body**: `{ "grandPrix": "Italian GP", "country": "Italy", "raceDate": "2026-09-06T15:00:00.000Z" }`
- **Description**: Creates and lists Grand Prix weekend schedules linked to the competition.

#### `GET` | `DELETE /api/competitions/[id]/racing/weekends/[weekendId]`
- **File**: `app/api/competitions/[id]/racing/weekends/[weekendId]/route.ts`
- **Access**: GET (Member), DELETE (Competition Creator `ADMIN`).
- **DELETE Logic**: Deletion is blocked (`400`) if any session within the weekend has already been scored and resolved (`resolved: true`).

#### `GET` | `POST /api/competitions/[id]/racing/sessions`
- **File**: `app/api/competitions/[id]/racing/sessions/route.ts`
- **Access**: GET (Member), POST (Competition Creator `ADMIN`).
- **POST Request Body**:
  ```json
  {
    "weekendId": "...",
    "type": "RACE",
    "name": "Grand Prix Race",
    "startTime": "2026-09-06T13:00:00.000Z",
    "participatingDriverIds": ["d1", "d2", "d3"],
    "wildcardDriverId": "RANDOM"
  }
  ```
- **Business Logic**: Inserts session participants into `RacingSessionParticipant`. If `wildcardDriverId` is specified as `"RANDOM"`, randomly selects one driver from the participating roster and registers a `Wildcard` record.

#### `PATCH` | `DELETE /api/competitions/[id]/racing/sessions/[sessionId]`
- **File**: `app/api/competitions/[id]/racing/sessions/[sessionId]/route.ts`
- **Access**: Competition Creator (`ADMIN`).
- **PATCH**: Updates start time, driver participation roster, or voting closure timestamp. Modifications are rejected on resolved sessions.
- **DELETE**: Deletes an unresolved session.

#### `GET` | `POST /api/competitions/[id]/racing/sessions/[sessionId]/predictions`
- **File**: `app/api/competitions/[id]/racing/sessions/[sessionId]/predictions/route.ts`
- **Access**: Enrolled member.
- **GET**: Enforces prediction visibility isolation: competitor predictions are hidden until `startTime`.
- **POST Request Body**:
  ```json
  {
    "firstDriverId": "d1",
    "secondDriverId": "d2",
    "thirdDriverId": "d3",
    "wildcardPosition": 5
  }
  ```
- **Prediction Rules**:
  - Podium sessions (`RACE`, `SPRINT`): P1, P2, and P3 selections must be distinct drivers.
  - Non-podium sessions (e.g. `QUALIFYING`): Podium driver fields are nulled; only the Wildcard driver position is submitted.
  - If a Wildcard driver is configured for the session, `wildcardPosition` is mandatory and must fall within valid participant limits.

#### `POST /api/competitions/[id]/racing/sessions/[sessionId]/results`
- **File**: `app/api/competitions/[id]/racing/sessions/[sessionId]/results/route.ts`
- **Access**: Competition Creator (`ADMIN`).
- **Request Body**:
  ```json
  {
    "results": [
      { "driverId": "d1", "position": 1 },
      { "driverId": "d2", "position": 2 },
      { "driverId": "d3", "position": 3 }
    ]
  }
  ```
- **Scoring Logic**:
  1. Validates that positions are sequential, within bounds, and contain no duplicate drivers or positions.
  2. Inserts results into `RacingResult` and marks session as `resolved: true`.
  3. Computes participant points inside a transaction:
     - Exact podium match: awards `podiumExactPoints` (default: 3) for each correct position.
     - Podium presence on a different position: awards `podiumAnyPoints` (default: 1) for each driver who finished on the podium in another place.
     - Wildcard position match: awards `wildcardPoints` (default: 2) if predicted position equals the official finishing position of the designated Wildcard driver.
  4. Updates leaderboard points in `CompetitionMember.points`.

#### `GET` | `POST` | `PUT /api/competitions/[id]/racing/season-winner`
- **File**: `app/api/competitions/[id]/racing/season-winner/route.ts`
- **Access**: GET/POST (Enrolled Member), PUT (Competition Creator `ADMIN`).
- **Description**: Manages long-term season driver champion predictions and award distribution upon season completion.

---

### 3.7. Push Notifications and Background CRON (`/api/push`, `/api/cron`)

#### `GET` | `POST` | `DELETE /api/push/subscriptions`
- **File**: `app/api/push/subscriptions/route.ts`
- **Access**: Authenticated User.
- **GET**: Checks whether a browser push subscription endpoint is registered in the database.
- **POST**: Stores new browser push subscription parameters (`endpoint`, `p256dh`, `auth`).
- **DELETE**: Deregisters and removes the subscription.

#### `POST /api/cron/reminders`
- **File**: `app/api/cron/reminders/route.ts`
- **Access**: Protected by header `Authorization: Bearer <CRON_SECRET>`.
- **Purpose**: Background task dispatched by serverless cron scheduler to notify users of pending fixtures.
- **Algorithm**:
  1. Queries upcoming football fixtures and racing sessions:
     - Football matches: `now < kickoff <= now + 24h`
     - Racing sessions: `now < startTime <= now + 20h`
  2. Identifies competition members who hold active push subscriptions but have **not yet placed predictions**.
  3. Classifies each event into one of two distinct reminder stages:
     - `LATE`: Event starts within 4 hours (`eventTime <= now + 4h`).
     - `EARLY`: Event starts in more than 4 hours (`eventTime > now + 4h` up to the query boundary).
  4. Deduplication: Ensures each user receives at most one notification per stage per event via unique records in `NotificationLog` (`@@unique([userId, type, targetId, stage])`).
  5. Generates localized payloads in Polish and English and dispatches them via `webpush.sendNotification`.
  6. Automatically cleans up expired subscriptions when receiving HTTP `404` or `410` status codes from push services.
