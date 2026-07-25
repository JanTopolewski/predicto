/*
  Warnings:

  - The values [F1] on the enum `CompetitionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `f1SessionId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `leagueId` on the `Competition` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `totalPoints` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `F1Prediction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `F1Result` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `F1Season` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `F1Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `F1Weekend` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `League` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeagueMember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[inviteCode]` on the table `Competition` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdBy` to the `Competition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inviteCode` to the `Competition` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RacingSessionType" AS ENUM ('PRACTICE1', 'PRACTICE2', 'PRACTICE3', 'QUALIFYING', 'SPRINT', 'RACE');

-- AlterEnum
BEGIN;
CREATE TYPE "CompetitionType_new" AS ENUM ('FOOTBALL', 'RACING');
ALTER TABLE "Competition" ALTER COLUMN "type" TYPE "CompetitionType_new" USING ("type"::text::"CompetitionType_new");
ALTER TYPE "CompetitionType" RENAME TO "CompetitionType_old";
ALTER TYPE "CompetitionType_new" RENAME TO "CompetitionType";
DROP TYPE "public"."CompetitionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_f1SessionId_fkey";

-- DropForeignKey
ALTER TABLE "Competition" DROP CONSTRAINT "Competition_leagueId_fkey";

-- DropForeignKey
ALTER TABLE "F1Prediction" DROP CONSTRAINT "F1Prediction_driverId_fkey";

-- DropForeignKey
ALTER TABLE "F1Prediction" DROP CONSTRAINT "F1Prediction_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "F1Prediction" DROP CONSTRAINT "F1Prediction_userId_fkey";

-- DropForeignKey
ALTER TABLE "F1Result" DROP CONSTRAINT "F1Result_driverId_fkey";

-- DropForeignKey
ALTER TABLE "F1Result" DROP CONSTRAINT "F1Result_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "F1Season" DROP CONSTRAINT "F1Season_competitionId_fkey";

-- DropForeignKey
ALTER TABLE "F1Session" DROP CONSTRAINT "F1Session_weekendId_fkey";

-- DropForeignKey
ALTER TABLE "F1Weekend" DROP CONSTRAINT "F1Weekend_seasonId_fkey";

-- DropForeignKey
ALTER TABLE "LeagueMember" DROP CONSTRAINT "LeagueMember_leagueId_fkey";

-- DropForeignKey
ALTER TABLE "LeagueMember" DROP CONSTRAINT "LeagueMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Wildcard" DROP CONSTRAINT "Wildcard_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Wildcard" DROP CONSTRAINT "Wildcard_weekendId_fkey";

-- DropIndex
DROP INDEX "Competition_leagueId_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "f1SessionId",
ADD COLUMN     "racingSessionId" TEXT;

-- AlterTable
ALTER TABLE "Competition" DROP COLUMN "leagueId",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "inviteCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "logo";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "totalPoints";

-- DropTable
DROP TABLE "F1Prediction";

-- DropTable
DROP TABLE "F1Result";

-- DropTable
DROP TABLE "F1Season";

-- DropTable
DROP TABLE "F1Session";

-- DropTable
DROP TABLE "F1Weekend";

-- DropTable
DROP TABLE "League";

-- DropTable
DROP TABLE "LeagueMember";

-- DropEnum
DROP TYPE "F1SessionType";

-- CreateTable
CREATE TABLE "CompetitionMember" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetitionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingSeason" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RacingSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingWeekend" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "grandPrix" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RacingWeekend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingSession" (
    "id" TEXT NOT NULL,
    "weekendId" TEXT NOT NULL,
    "type" "RacingSessionType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RacingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RacingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingPrediction" (
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

    CONSTRAINT "RacingPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitionMember_competitionId_idx" ON "CompetitionMember"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionMember_userId_idx" ON "CompetitionMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionMember_competitionId_userId_key" ON "CompetitionMember"("competitionId", "userId");

-- CreateIndex
CREATE INDEX "RacingSeason_competitionId_idx" ON "RacingSeason"("competitionId");

-- CreateIndex
CREATE INDEX "RacingWeekend_seasonId_idx" ON "RacingWeekend"("seasonId");

-- CreateIndex
CREATE INDEX "RacingWeekend_raceDate_idx" ON "RacingWeekend"("raceDate");

-- CreateIndex
CREATE INDEX "RacingSession_weekendId_idx" ON "RacingSession"("weekendId");

-- CreateIndex
CREATE INDEX "RacingSession_type_idx" ON "RacingSession"("type");

-- CreateIndex
CREATE INDEX "RacingSession_startTime_idx" ON "RacingSession"("startTime");

-- CreateIndex
CREATE INDEX "RacingResult_sessionId_idx" ON "RacingResult"("sessionId");

-- CreateIndex
CREATE INDEX "RacingResult_driverId_idx" ON "RacingResult"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "RacingResult_sessionId_driverId_key" ON "RacingResult"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "RacingPrediction_sessionId_idx" ON "RacingPrediction"("sessionId");

-- CreateIndex
CREATE INDEX "RacingPrediction_userId_idx" ON "RacingPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RacingPrediction_sessionId_userId_key" ON "RacingPrediction"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_inviteCode_key" ON "Competition"("inviteCode");

-- CreateIndex
CREATE INDEX "Competition_createdBy_idx" ON "Competition"("createdBy");

-- CreateIndex
CREATE INDEX "Competition_inviteCode_idx" ON "Competition"("inviteCode");

-- AddForeignKey
ALTER TABLE "CompetitionMember" ADD CONSTRAINT "CompetitionMember_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionMember" ADD CONSTRAINT "CompetitionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSeason" ADD CONSTRAINT "RacingSeason_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingWeekend" ADD CONSTRAINT "RacingWeekend_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "RacingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSession" ADD CONSTRAINT "RacingSession_weekendId_fkey" FOREIGN KEY ("weekendId") REFERENCES "RacingWeekend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingResult" ADD CONSTRAINT "RacingResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RacingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingResult" ADD CONSTRAINT "RacingResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RacingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RacingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_weekendId_fkey" FOREIGN KEY ("weekendId") REFERENCES "RacingWeekend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_racingSessionId_fkey" FOREIGN KEY ("racingSessionId") REFERENCES "RacingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
