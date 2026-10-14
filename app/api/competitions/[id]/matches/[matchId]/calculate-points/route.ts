import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
            return NextResponse.json(
                { error: "Only admins can calculate points" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { error: "Match not found" },
                { status: 404 }
            );
        }

        if (match.season.competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can calculate points" },
                { status: 403 }
            );
        }

        if (!match.resolved || match.homeGoals === null || match.awayGoals === null) {
            return NextResponse.json(
                { error: "Match result must be set first" },
                { status: 400 }
            );
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const exactScorePoints = scoringRules?.exactScorePoints || 3;
        const winnerPoints = scoringRules?.winnerPoints || 1;

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
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}