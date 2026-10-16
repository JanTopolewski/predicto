import { apiError, internalError, unauthorized } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const competitionId = (await params).id;
        const { driverId } = await request.json();

        if (!driverId) {
            return apiError(400, "MISSING_FIELDS", "Driver ID is required");
        }

        const member = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId: session.user.id,
                },
            },
        });

        if (!member) {
            return apiError(403, "NOT_A_MEMBER", "You are not a member of this competition");
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: true,
            },
        });

        if (!competition || competition.type !== "RACING") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a racing competition");
        }

        if (competition.winnerResolved) {
            return apiError(
                400,
                "WINNER_ALREADY_RESOLVED",
                "Season winner has already been announced. Voting is closed."
            );
        }

        let racingSeason = competition.racingSeasons[0];
        if (!racingSeason) {
            racingSeason = await prisma.racingSeason.create({
                data: { competitionId },
            });
        }

        const earliestSession = await prisma.racingSession.findFirst({
            where: {
                weekend: {
                    seasonId: racingSeason.id,
                },
            },
            orderBy: {
                startTime: "asc",
            },
        });
        if (earliestSession && new Date() >= new Date(earliestSession.startTime)) {
            return apiError(
                400,
                "SEASON_ALREADY_STARTED",
                "First session of the season has already started. Season winner prediction is closed."
            );
        }

        const existingPrediction = await prisma.racingSeasonWinnerPrediction.findUnique({
            where: {
                seasonId_userId: {
                    seasonId: racingSeason.id,
                    userId: session.user.id,
                },
            },
        });
        if (existingPrediction) {
            return apiError(
                400,
                "ALREADY_VOTED",
                "You have already voted for the season winner. Predictions cannot be changed."
            );
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
                        seasonId: racingSeason.id,
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

        const prediction =
            await prisma.racingSeasonWinnerPrediction.create({
                data: {
                    seasonId: racingSeason.id,
                    userId: session.user.id,
                    driverId,
                },
                include: {
                    driver: true,
                },
            });

        return NextResponse.json({ prediction }, { status: 201 });
    } catch (error) {
        console.error("Error creating season winner prediction:", error);
        return internalError();
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const competitionId = (await params).id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: {
                    include: {
                        seasonWinnerPredictions: {
                            where: { userId: session.user.id },
                            include: { driver: true },
                        },
                    },
                },
            },
        });

        if (!competition) {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        const prediction =
            competition.racingSeasons[0]?.seasonWinnerPredictions[0] || null;

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error("Error fetching season winner prediction:", error);
        return internalError();
    }
}