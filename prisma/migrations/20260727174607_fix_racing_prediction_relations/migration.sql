/*
  Warnings:

  - You are about to drop the column `driverId` on the `RacingPrediction` table. All the data in the column will be lost.
  - You are about to drop the column `firstDriver` on the `RacingPrediction` table. All the data in the column will be lost.
  - You are about to drop the column `polePosition` on the `RacingPrediction` table. All the data in the column will be lost.
  - You are about to drop the column `secondDriver` on the `RacingPrediction` table. All the data in the column will be lost.
  - You are about to drop the column `thirdDriver` on the `RacingPrediction` table. All the data in the column will be lost.
  - You are about to drop the column `wildcardPrediction` on the `RacingPrediction` table. All the data in the column will be lost.
  - Added the required column `name` to the `RacingSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "RacingSessionType" ADD VALUE 'SPRINT_QUALIFYING';

-- DropForeignKey
ALTER TABLE "RacingPrediction" DROP CONSTRAINT "RacingPrediction_driverId_fkey";

-- DropForeignKey
ALTER TABLE "RacingResult" DROP CONSTRAINT "RacingResult_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Wildcard" DROP CONSTRAINT "Wildcard_driverId_fkey";

-- AlterTable
ALTER TABLE "RacingPrediction" DROP COLUMN "driverId",
DROP COLUMN "firstDriver",
DROP COLUMN "polePosition",
DROP COLUMN "secondDriver",
DROP COLUMN "thirdDriver",
DROP COLUMN "wildcardPrediction",
ADD COLUMN     "firstDriverId" TEXT,
ADD COLUMN     "secondDriverId" TEXT,
ADD COLUMN     "thirdDriverId" TEXT,
ADD COLUMN     "wildcardDriverId" TEXT,
ADD COLUMN     "wildcardPosition" INTEGER;

-- AlterTable
ALTER TABLE "RacingSession" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "votingClosedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RacingSessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RacingSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RacingSeasonWinnerPrediction" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RacingSeasonWinnerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RacingSessionParticipant_sessionId_idx" ON "RacingSessionParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "RacingSessionParticipant_driverId_idx" ON "RacingSessionParticipant"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "RacingSessionParticipant_sessionId_driverId_key" ON "RacingSessionParticipant"("sessionId", "driverId");

-- CreateIndex
CREATE INDEX "RacingSeasonWinnerPrediction_seasonId_idx" ON "RacingSeasonWinnerPrediction"("seasonId");

-- CreateIndex
CREATE INDEX "RacingSeasonWinnerPrediction_userId_idx" ON "RacingSeasonWinnerPrediction"("userId");

-- CreateIndex
CREATE INDEX "RacingSeasonWinnerPrediction_driverId_idx" ON "RacingSeasonWinnerPrediction"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "RacingSeasonWinnerPrediction_seasonId_userId_key" ON "RacingSeasonWinnerPrediction"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "RacingPrediction_firstDriverId_idx" ON "RacingPrediction"("firstDriverId");

-- CreateIndex
CREATE INDEX "RacingPrediction_secondDriverId_idx" ON "RacingPrediction"("secondDriverId");

-- CreateIndex
CREATE INDEX "RacingPrediction_thirdDriverId_idx" ON "RacingPrediction"("thirdDriverId");

-- CreateIndex
CREATE INDEX "RacingPrediction_wildcardDriverId_idx" ON "RacingPrediction"("wildcardDriverId");

-- AddForeignKey
ALTER TABLE "RacingSessionParticipant" ADD CONSTRAINT "RacingSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RacingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSessionParticipant" ADD CONSTRAINT "RacingSessionParticipant_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingResult" ADD CONSTRAINT "RacingResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_firstDriverId_fkey" FOREIGN KEY ("firstDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_secondDriverId_fkey" FOREIGN KEY ("secondDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_thirdDriverId_fkey" FOREIGN KEY ("thirdDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingPrediction" ADD CONSTRAINT "RacingPrediction_wildcardDriverId_fkey" FOREIGN KEY ("wildcardDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSeasonWinnerPrediction" ADD CONSTRAINT "RacingSeasonWinnerPrediction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "RacingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSeasonWinnerPrediction" ADD CONSTRAINT "RacingSeasonWinnerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RacingSeasonWinnerPrediction" ADD CONSTRAINT "RacingSeasonWinnerPrediction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wildcard" ADD CONSTRAINT "Wildcard_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
