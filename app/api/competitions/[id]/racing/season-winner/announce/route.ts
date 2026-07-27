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
        const { driverId } = await request.json();

        if (!driverId) {
            return NextResponse.json(
                { error: "Driver ID is required" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Competition not found or is not a racing competition" },
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

        const season = competition.racingSeasons[0];
        if (!season) {
            return NextResponse.json(
                { error: "No season found for this competition" },
                { status: 404 }
            );
        }

        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
        });

        if (!driver) {
            return NextResponse.json(
                { error: "Driver not found" },
                { status: 404 }
            );
        }

        const scoringRules = await prisma.competitionScoring.findUnique({
            where: { competitionId },
        });

        const seasonWinnerPoints = scoringRules?.seasonWinnerPoints || 10;

        const updates = [];

        for (const prediction of season.seasonWinnerPredictions) {
            if (prediction.driverId === driverId) {
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
                                increment: seasonWinnerPoints,
                            },
                        },
                    })
                );
            }
        }

        updates.push(
            prisma.competition.update({
                where: { id: competitionId },
                data: { winnerResolved: true },
            })
        );

        await Promise.all(updates);

        return NextResponse.json({
            message: "Season winner announced successfully",
            driverId,
            driverName: driver.name,
            playersRewarded: season.seasonWinnerPredictions.filter(
                (p) => p.driverId === driverId
            ).length,
            pointsAwarded: seasonWinnerPoints,
        });
    } catch (error) {
        console.error("Error announcing season winner:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}