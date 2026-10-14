-- AlterTable
ALTER TABLE "FootballMatch" ADD COLUMN     "predictedEndTime" TIMESTAMP(3),
ADD COLUMN     "votingClosedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FootballSeason" ADD COLUMN     "hasMatchStarted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FootballSeasonWinnerPrediction" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballSeasonWinnerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootballSeasonWinnerPrediction_seasonId_idx" ON "FootballSeasonWinnerPrediction"("seasonId");

-- CreateIndex
CREATE INDEX "FootballSeasonWinnerPrediction_userId_idx" ON "FootballSeasonWinnerPrediction"("userId");

-- CreateIndex
CREATE INDEX "FootballSeasonWinnerPrediction_teamId_idx" ON "FootballSeasonWinnerPrediction"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FootballSeasonWinnerPrediction_seasonId_userId_key" ON "FootballSeasonWinnerPrediction"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- AddForeignKey
ALTER TABLE "FootballSeasonWinnerPrediction" ADD CONSTRAINT "FootballSeasonWinnerPrediction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "FootballSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballSeasonWinnerPrediction" ADD CONSTRAINT "FootballSeasonWinnerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballSeasonWinnerPrediction" ADD CONSTRAINT "FootballSeasonWinnerPrediction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
