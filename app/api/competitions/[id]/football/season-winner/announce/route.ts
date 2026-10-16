import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError } from "@/lib/api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return apiError(403, "FORBIDDEN", "Only admins can announce season winner");
        }

        const competitionId = (await params).id;
        const { winningTeamId } = await request.json();

        if (!winningTeamId) {
            return apiError(400, "MISSING_FIELDS", "Winning team ID is required");
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: {
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

        if (!competition || competition.type !== "FOOTBALL") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a football competition");
        }

        if (competition.createdBy !== session.user.id) {
            return apiError(403, "FORBIDDEN", "Only competition creator can announce winner");
        }

        if (competition.winnerResolved) {
            return apiError(400, "WINNER_ALREADY_RESOLVED", "Season winner already announced");
        }

        const season = competition.footballSeasons[0];
        if (!season) {
            return apiError(404, "SEASON_NOT_FOUND", "No season found for this competition");
        }

        const team = await prisma.team.findUnique({
            where: { id: winningTeamId },
        });

        if (!team) {
            return apiError(404, "TEAM_NOT_FOUND", "Team not found");
        }

        const isTeamInSeason = await prisma.footballMatch.findFirst({
            where: {
                seasonId: season.id,
                OR: [{ homeTeamId: winningTeamId }, { awayTeamId: winningTeamId }],
            },
        });

        if (!isTeamInSeason) {
            return apiError(
                400,
                "TEAM_NOT_IN_SEASON",
                "Selected team does not participate in this season's matches"
            );
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const seasonWinnerPoints = scoringRules?.seasonWinnerPoints || 10;
        const matchingPredictions = season.seasonWinnerPredictions.filter(
            (p) => p.teamId === winningTeamId
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
            winningTeamId,
            winningTeamName: team.name,
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