import { apiError, forbidden, internalError, canManageCompetition } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const competitionId = (await params).id;
        const { driverId } = await request.json();

        if (!driverId) {
            return apiError(400, "MISSING_FIELDS", "Driver ID is required");
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: {
                    include: {
                        seasonWinnerPredictions: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });

        if (!competition || competition.type !== "RACING") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a racing competition");
        }

        if (!canManageCompetition(session.user, competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can announce winner");
        }

        if (competition.winnerResolved) {
            return apiError(400, "WINNER_ALREADY_RESOLVED", "Season winner already announced");
        }

        const season = competition.racingSeasons[0];
        if (!season) {
            return apiError(404, "SEASON_NOT_FOUND", "No season found for this competition");
        }

        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
        });

        if (!driver) {
            return apiError(404, "DRIVER_NOT_FOUND", "Driver not found");
        }

        const isDriverInSeason = await prisma.racingSessionParticipant.findFirst({
            where: {
                driverId,
                session: {
                    weekend: {
                        seasonId: season.id,
                    },
                },
            },
        });

        if (!isDriverInSeason) {
            return apiError(
                400,
                "DRIVER_NOT_IN_SEASON",
                "Selected driver does not participate in this season's sessions"
            );
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const seasonWinnerPoints = scoringRules?.seasonWinnerPoints || 10;
        const matchingPredictions = season.seasonWinnerPredictions.filter(
            (p) => p.driverId === driverId
        );

        // Atomic guard & transaction: ensure only one request can set winnerResolved and award points
        await prisma.$transaction(async (tx) => {
            const updateResult = await tx.competition.updateMany({
                where: {
                    id: competitionId,
                    winnerResolved: false,
                },
                data: { winnerResolved: true },
            });

            if (updateResult.count === 0) {
                throw new Error("ALREADY_RESOLVED");
            }

            for (const prediction of matchingPredictions) {
                await tx.competitionMember.update({
                    where: {
                        competitionId_userId: {
                            competitionId,
                            userId: prediction.userId,
                        },
                    },
                    data: {
                        points: {
                            increment: seasonWinnerPoints,
                        },
                    },
                });
            }
        });

        return NextResponse.json({
            message: "Season winner announced successfully",
            driverId,
            driverName: driver.name,
            playersRewarded: matchingPredictions.length,
            pointsAwarded: seasonWinnerPoints,
        });
    } catch (error: any) {
        if (error?.message === "ALREADY_RESOLVED") {
            return apiError(400, "WINNER_ALREADY_RESOLVED", "Season winner already announced");
        }
        console.error("Error announcing season winner:", error);
        return internalError();
    }
}