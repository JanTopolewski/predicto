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
            return NextResponse.json(
                { error: "Only admins can announce season winner" },
                { status: 403 }
            );
        }

        const competitionId = (await params).id;
        const { winningTeamId } = await request.json();

        if (!winningTeamId) {
            return NextResponse.json(
                { error: "Winning team ID is required" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Competition not found or is not a football competition" },
                { status: 404 }
            );
        }

        if (competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can announce winner" },
                { status: 403 }
            );
        }

        if (competition.winnerResolved) {
            return NextResponse.json(
                { error: "Season winner already announced" },
                { status: 400 }
            );
        }

        const season = competition.footballSeasons[0];
        if (!season) {
            return NextResponse.json(
                { error: "No season found for this competition" },
                { status: 404 }
            );
        }

        const team = await prisma.team.findUnique({
            where: { id: winningTeamId },
        });

        if (!team) {
            return NextResponse.json(
                { error: "Team not found" },
                { status: 404 }
            );
        }

        const isTeamInSeason = await prisma.footballMatch.findFirst({
            where: {
                seasonId: season.id,
                OR: [{ homeTeamId: winningTeamId }, { awayTeamId: winningTeamId }],
            },
        });

        if (!isTeamInSeason) {
            return NextResponse.json(
                { error: "Wybrana drużyna nie bierze udziału w rozgrywkach tego sezonu" },
                { status: 400 }
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
            return NextResponse.json(
                { error: "Season winner already announced" },
                { status: 400 }
            );
        }
        console.error("Error announcing season winner:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}