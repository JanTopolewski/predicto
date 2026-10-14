/*
  Warnings:

  - You are about to drop the `SeasonWinnerPrediction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SeasonWinnerPrediction" DROP CONSTRAINT "SeasonWinnerPrediction_competitionId_fkey";

-- DropForeignKey
ALTER TABLE "SeasonWinnerPrediction" DROP CONSTRAINT "SeasonWinnerPrediction_userId_fkey";

-- DropTable
DROP TABLE "SeasonWinnerPrediction";
