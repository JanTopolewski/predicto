import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; sessionId: string }>;
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

        const { id: competitionId, sessionId } = await params;

        const racingSession = await prisma.racingSession.findUnique({
            where: { id: sessionId },
            include: {
                weekend: {
                    include: {
                        season: {
                            include: {
                                competition: true,
                            },
                        },
                    },
                },
                results: {
                    include: { driver: true },
                },
                predictions: {
                    include: { user: true },
                },
            },
        });

        if (
            !racingSession ||
            racingSession.weekend.season.competition.id !== competitionId
        ) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (
            racingSession.weekend.season.competition.createdBy !== session.user.id
        ) {
            return NextResponse.json(
                { error: "Only competition creator can calculate points" },
                { status: 403 }
            );
        }

        if (racingSession.results.length === 0) {
            return NextResponse.json(
                { error: "Session results must be set first" },
                { status: 400 }
            );
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const podiumExactPoints = scoringRules?.podiumExactPoints || 3;
        const podiumAnyPoints = scoringRules?.podiumAnyPoints || 1;
        const wildcardPoints = scoringRules?.wildcardPoints || 2;

        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";

        // Create a map of driver results
        const resultsMap = new Map<string, number>();
        racingSession.results.forEach((result) => {
            resultsMap.set(result.driverId, result.position);
        });

        const updates: any[] = [];

        for (const prediction of racingSession.predictions) {
            let points = 0;

            if (isPodiumSession && prediction.firstDriverId && prediction.secondDriverId && prediction.thirdDriverId) {
                // Check podium predictions
                const pos1 = resultsMap.get(prediction.firstDriverId);
                const pos2 = resultsMap.get(prediction.secondDriverId);
                const pos3 = resultsMap.get(prediction.thirdDriverId);

                // Exact match for each position
                if (pos1 === 1) points += podiumExactPoints;
                if (pos2 === 2) points += podiumExactPoints;
                if (pos3 === 3) points += podiumExactPoints;

                // Any podium positions (1-3) but not exact
                if (pos1 && pos1 <= 3 && pos1 !== 1) {
                    points += podiumAnyPoints;
                }
                if (pos2 && pos2 <= 3 && pos2 !== 2) {
                    points += podiumAnyPoints;
                }
                if (pos3 && pos3 <= 3 && pos3 !== 3) {
                    points += podiumAnyPoints;
                }
            }

            // Wildcard prediction
            if (prediction.wildcardDriverId && prediction.wildcardPosition) {
                const actualPosition = resultsMap.get(prediction.wildcardDriverId);

                if (actualPosition) {
                    if (actualPosition === prediction.wildcardPosition) {
                        // Exact position match
                        points += wildcardPoints;
                    } else if (
                        Math.abs(actualPosition - prediction.wildcardPosition) <= 2
                    ) {
                        // Within 2 positions
                        points += Math.round(wildcardPoints / 2);
                    }
                }
            }

            const oldPoints = prediction.points || 0;
            const pointsDiff = points - oldPoints;

            // Update prediction with points
            updates.push(
                prisma.racingPrediction.update({
                    where: { id: prediction.id },
                    data: { points },
                })
            );

            // Update member points
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

        // Mark session as resolved
        updates.push(
            prisma.racingSession.update({
                where: { id: sessionId },
                data: { resolved: true },
            })
        );

        await Promise.all(updates);

        return NextResponse.json({
            message: "Points calculated successfully",
            sessionId,
            totalPredictions: racingSession.predictions.length,
        });
    } catch (error) {
        console.error("Error calculating points:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}