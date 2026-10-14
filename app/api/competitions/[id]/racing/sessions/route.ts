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
                { error: "Only admins can create sessions" },
                { status: 403 }
            );
        }

        const competitionId = (await params).id;
        const {
            weekendId,
            type,
            name,
            startTime,
            participatingDriverIds,
            wildcardDriverId,
        } = await request.json();

        if (!weekendId || !type || !name || !startTime || !participatingDriverIds) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const isPodiumSession = type === "SPRINT" || type === "RACE";

        // Dla sesji bez podium (treningi, kwalifikacje) kierowca Wildcard jest obowiązkowy
        if (!isPodiumSession && !wildcardDriverId) {
            return NextResponse.json(
                {
                    error: "Kierowca Wildcard jest wymagany dla sesji treningowych i kwalifikacyjnych (brak podium)",
                },
                { status: 400 }
            );
        }

        // Handle wildcard driver selection
        let finalWildcardDriverId = wildcardDriverId;

        if (wildcardDriverId === "RANDOM") {
            // Randomly select a driver from participants
            const randomIndex = Math.floor(Math.random() * participatingDriverIds.length);
            finalWildcardDriverId = participatingDriverIds[randomIndex];
        } else if (wildcardDriverId && !participatingDriverIds.includes(wildcardDriverId)) {
            // Validate wildcard driver if manually provided
            return NextResponse.json(
                { error: "Wildcard driver must be a participant" },
                { status: 400 }
            );
        }

        if (!Array.isArray(participatingDriverIds) || participatingDriverIds.length === 0) {
            return NextResponse.json(
                { error: "At least one driver must participate" },
                { status: 400 }
            );
        }

        const weekend = await prisma.racingWeekend.findUnique({
            where: { id: weekendId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
            },
        });

        if (!weekend || weekend.season.competition.id !== competitionId) {
            return NextResponse.json(
                { error: "Weekend not found" },
                { status: 404 }
            );
        }

        if (weekend.season.competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can create sessions" },
                { status: 403 }
            );
        }

        const racingSession = await prisma.racingSession.create({
            data: {
                weekendId,
                type,
                name,
                startTime: new Date(startTime),
                participants: {
                    createMany: {
                        data: participatingDriverIds.map((driverId: string) => ({
                            driverId,
                        })),
                    },
                },
                ...(finalWildcardDriverId && {
                    wildcards: {
                        create: {
                            driverId: finalWildcardDriverId,
                        },
                    },
                }),
            },
            include: {
                participants: {
                    include: { driver: true },
                },
                wildcards: {
                    include: { driver: true },
                },
            },
        });

        return NextResponse.json({ session: racingSession }, { status: 201 });
    } catch (error) {
        console.error("Error creating session:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const competitionId = (await params).id;

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
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
            return NextResponse.json(
                { error: "You are not a member of this competition" },
                { status: 403 }
            );
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: {
                    include: {
                        weekends: {
                            include: {
                                sessions: {
                                    include: {
                                        participants: {
                                            include: { driver: true },
                                        },
                                        predictions: {
                                            where: {
                                                userId: session.user.id,
                                            },
                                        },
                                    },
                                    orderBy: { startTime: "asc" },
                                },
                            },
                            orderBy: { raceDate: "asc" },
                        },
                    },
                },
            },
        });

        if (!competition) {
            return NextResponse.json(
                { error: "Competition not found" },
                { status: 404 }
            );
        }

        const sessions = competition.racingSeasons[0]?.weekends
            .flatMap((w) => w.sessions) || [];

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}