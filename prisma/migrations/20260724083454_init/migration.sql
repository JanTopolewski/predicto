-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('FOOTBALL', 'F1');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "F1SessionType" AS ENUM ('PRACTICE1', 'PRACTICE2', 'PRACTICE3', 'QUALIFYING', 'SPRINT', 'RACE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "winnerResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionScoring" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "exactScorePoints" INTEGER NOT NULL DEFAULT 3,
    "winnerPoints" INTEGER NOT NULL DEFAULT 1,
    "seasonWinnerPoints" INTEGER NOT NULL DEFAULT 10,
    "podiumExactPoints" INTEGER NOT NULL DEFAULT 3,
    "podiumAnyPoints" INTEGER NOT NULL DEFAULT 1,
    "polePositionPoints" INTEGER NOT NULL DEFAULT 2,
    "wildcardPoints" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionScoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonWinnerPrediction" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonWinnerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballSeason" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FootballSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballPrediction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F1Season" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "F1Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F1Weekend" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "grandPrix" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F1Weekend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F1Session" (
    "id" TEXT NOT NULL,
    "weekendId" TEXT NOT NULL,
    "type" "F1SessionType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F1Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F1Result" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "F1Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "F1Prediction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstDriver" TEXT NOT NULL,
    "secondDriver" TEXT NOT NULL,
    "thirdDriver" TEXT NOT NULL,
    "polePosition" TEXT,
    "wildcardPrediction" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "driverId" TEXT,

    CONSTRAINT "F1Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wildcard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "weekendId" TEXT,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wildcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "footballMatchId" TEXT,
    "f1SessionId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE INDEX "League_createdBy_idx" ON "League"("createdBy");

-- CreateIndex
CREATE INDEX "League_inviteCode_idx" ON "League"("inviteCode");

-- CreateIndex
CREATE INDEX "LeagueMember_leagueId_idx" ON "LeagueMember"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueMember_userId_idx" ON "LeagueMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "Competition_leagueId_idx" ON "Competition"("leagueId");

-- CreateIndex
CREATE INDEX "Competition_type_idx" ON "Competition"("type");

-- CreateIndex
CREATE INDEX "Competition_season_idx" ON "Competition"("season");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionScoring_competitionId_key" ON "CompetitionScoring"("competitionId");

-- CreateIndex
CREATE INDEX "SeasonWinnerPrediction_competitionId_idx" ON "SeasonWinnerPrediction"("competitionId");

-- CreateIndex
CREATE INDEX "SeasonWinnerPrediction_userId_idx" ON "SeasonWinnerPrediction"("userId");

-- CreateIndex
CREATE INDEX "SeasonWinnerPrediction_winnerId_idx" ON "SeasonWinnerPrediction"("winnerId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonWinnerPrediction_competitionId_userId_key" ON "SeasonWinnerPrediction"("competitionId", "userId");

-- CreateIndex
CREATE INDEX "FootballSeason_competitionId_idx" ON "FootballSeason"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_shortName_key" ON "Team"("shortName");

-- CreateIndex
CREATE INDEX "FootballMatch_seasonId_idx" ON "FootballMatch"("seasonId");

-- CreateIndex
CREATE INDEX "FootballMatch_homeTeamId_idx" ON "FootballMatch"("homeTeamId");

-- CreateIndex
CREATE INDEX "FootballMatch_awayTeamId_idx" ON "FootballMatch"("awayTeamId");

-- CreateIndex
CREATE INDEX "FootballMatch_kickoff_idx" ON "FootballMatch"("kickoff");

-- CreateIndex
CREATE INDEX "FootballMatch_status_idx" ON "FootballMatch"("status");

-- CreateIndex
CREATE INDEX "FootballPrediction_matchId_idx" ON "FootballPrediction"("matchId");

-- CreateIndex
CREATE INDEX "FootballPrediction_userId_idx" ON "FootballPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FootballPrediction_matchId_userId_key" ON "FootballPrediction"("matchId", "userId");

-- CreateIndex
CREATE INDEX "F1Season_competitionId_idx" ON "F1Season"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_name_key" ON "Driver"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_number_key" ON "Driver"("number");

-- CreateIndex
CREATE INDEX "Driver_number_idx" ON "Driver"("number");

-- CreateIndex
CREATE INDEX "F1Weekend_seasonId_idx" ON "F1Weekend"("seasonId");

-- CreateIndex
CREATE INDEX "F1Weekend_raceDate_idx" ON "F1Weekend"("raceDate");

-- CreateIndex
CREATE INDEX "F1Session_weekendId_idx" ON "F1Session"("weekendId");

-- CreateIndex
CREATE INDEX "F1Session_type_idx" ON "F1Session"("type");

-- CreateIndex
CREATE INDEX "F1Session_startTime_idx" ON "F1Session"("startTime");

-- CreateIndex
CREATE INDEX "F1Result_sessionId_idx" ON "F1Result"("sessionId");

-- CreateIndex
CREATE INDEX "F1Result_driverId_idx" ON "F1Result"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "F1Result_sessionId_driverId_key" ON "F1Result"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "F1Prediction_sessionId_idx" ON "F1Prediction"("sessionId");

-- CreateIndex
CREATE INDEX "F1Prediction_userId_idx" ON "F1Prediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "F1Prediction_sessionId_userId_key" ON "F1Prediction"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "Wildcard_sessionId_idx" ON "Wildcard"("sessionId");

-- CreateIndex
CREATE INDEX "Wildcard_weekendId_idx" ON "Wildcard"("weekendId");

-- CreateIndex
CREATE INDEX "Wildcard_driverId_idx" ON "Wildcard"("driverId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionScoring" ADD CONSTRAINT "CompetitionScoring_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonWinnerPrediction" ADD CONSTRAINT "SeasonWinnerPrediction_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonWinnerPrediction" ADD CONSTRAINT "SeasonWinnerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballSeason" ADD CONSTRAINT "FootballSeason_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatch" ADD CONSTRAINT "FootballMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "FootballSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatch" ADD CONSTRAINT "FootballMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatch" ADD CONSTRAINT "FootballMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballPrediction" ADD CONSTRAINT "FootballPrediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "FootballMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballPrediction" ADD CONSTRAINT "FootballPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Season" ADD CONSTRAINT "F1Season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Weekend" ADD CONSTRAINT "F1Weekend_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "F1Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Session" ADD CONSTRAINT "F1Session_weekendId_fkey" FOREIGN KEY ("weekendId") REFERENCES "F1Weekend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Result" ADD CONSTRAINT "F1Result_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "F1Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Result" ADD CONSTRAINT "F1Result_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Prediction" ADD CONSTRAINT "F1Prediction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "F1Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Prediction" ADD CONSTRAINT "F1Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "F1Prediction" ADD CONSTRAINT "F1Prediction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "F1Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_weekendId_fkey" FOREIGN KEY ("weekendId") REFERENCES "F1Weekend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_footballMatchId_fkey" FOREIGN KEY ("footballMatchId") REFERENCES "FootballMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_f1SessionId_fkey" FOREIGN KEY ("f1SessionId") REFERENCES "F1Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
