import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return apiError(403, "FORBIDDEN", "Only admins can create sessions");
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
            return apiError(400, "MISSING_FIELDS", "Missing required fields");
        }

        const validSessionTypes = [
            "PRACTICE1",
            "PRACTICE2",
            "PRACTICE3",
            "QUALIFYING",
            "SPRINT_QUALIFYING",
            "SPRINT",
            "RACE",
        ];
        if (!validSessionTypes.includes(type)) {
            return apiError(400, "INVALID_SESSION_TYPE", "Invalid session type");
        }

        if (!Array.isArray(participatingDriverIds) || participatingDriverIds.length === 0) {
            return apiError(400, "MISSING_PARTICIPANTS", "At least one driver must participate");
        }

        const isPodiumSession = type === "SPRINT" || type === "RACE";

        // For non-podium sessions (practice, qualifying) wildcard driver is required
        if (!isPodiumSession && !wildcardDriverId) {
            return apiError(
                400,
                "WILDCARD_REQUIRED",
                "Wildcard driver is required for practice and qualifying sessions (no podium)"
            );
        }

        // Handle wildcard driver selection
        let finalWildcardDriverId = wildcardDriverId;

        if (wildcardDriverId === "RANDOM") {
            // Randomly select a driver from participants
            const randomIndex = Math.floor(Math.random() * participatingDriverIds.length);
            finalWildcardDriverId = participatingDriverIds[randomIndex];
        } else if (wildcardDriverId && !participatingDriverIds.includes(wildcardDriverId)) {
            return apiError(400, "WILDCARD_NOT_A_PARTICIPANT", "Wildcard driver must be a participant");
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
            return apiError(404, "WEEKEND_NOT_FOUND", "Weekend not found");
        }

        if (weekend.season.competition.createdBy !== session.user.id) {
            return apiError(403, "FORBIDDEN", "Only competition creator can create sessions");
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
        console.error("Error creating racing session:", error);
        return internalError();
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
            return unauthorized();
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
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        const sessions = competition.racingSeasons[0]?.weekends
            .flatMap((w) => w.sessions) || [];

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error("Error fetching racing sessions:", error);
        return internalError();
    }
}