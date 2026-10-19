import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, forbidden, internalError, canManageCompetition } from "@/lib/api";

export async function POST(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const { id: competitionId, matchId } = await params;

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
                predictions: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return apiError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        if (!canManageCompetition(session.user, match.season.competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can calculate points");
        }

        if (!match.resolved || match.homeGoals === null || match.awayGoals === null) {
            return apiError(400, "MATCH_NOT_RESOLVED", "Match result must be set first");
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const exactScorePoints = scoringRules?.exactScorePoints ?? 3;
        const winnerPoints = scoringRules?.winnerPoints ?? 1;

        const actualResult = match.homeGoals - match.awayGoals;

        const updates = [];

        for (const prediction of match.predictions) {
            const predictedResult = prediction.homeGoals - prediction.awayGoals;
            let points = 0;

            if (
                prediction.homeGoals === match.homeGoals &&
                prediction.awayGoals === match.awayGoals
            ) {
                points = exactScorePoints;
            }
            else if (
                (actualResult === 0 && predictedResult === 0) ||
                (actualResult > 0 && predictedResult > 0) ||
                (actualResult < 0 && predictedResult < 0)
            ) {
                points = winnerPoints;
            }

            const oldPoints = prediction.points || 0;
            const pointsDiff = points - oldPoints;

            updates.push(
                prisma.footballPrediction.update({
                    where: { id: prediction.id },
                    data: { points },
                })
            );

            if (pointsDiff !== 0) {
                updates.push(
                    prisma.competitionMember.update({
                        where: {
                            competitionId_userId: {
                                competitionId,
                                userId: prediction.userId,
                            },
                        },
                        data: {
                            points: {
                                increment: pointsDiff,
                            },
                        },
                    })
                );
            }
        }

        await Promise.all(updates);

        return NextResponse.json({
            message: "Points calculated successfully",
            matchId,
            totalPredictions: match.predictions.length,
        });
    } catch (error) {
        console.error("Error calculating points:", error);
        return internalError();
    }
}