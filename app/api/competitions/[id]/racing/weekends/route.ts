import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError, canManageCompetition } from "@/lib/api";

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

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: {
                    include: {
                        weekends: {
                            include: {
                                sessions: {
                                    orderBy: { startTime: "asc" },
                                    include: {
                                        participants: {
                                            include: { driver: true },
                                        },
                                        predictions: {
                                            where: {
                                                userId: session.user.id,
                                            },
                                        },
                                        wildcards: {
                                            include: { driver: true },
                                        },
                                    },
                                },
                            },
                            orderBy: { raceDate: "asc" },
                        },
                    },
                },
            },
        });

        if (!competition || competition.type !== "RACING") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a racing competition");
        }

        // Allow if user is admin of this competition OR member
        const isAdmin = canManageCompetition(session.user, competition.createdBy);

        if (!isAdmin) {
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
        }

        const season = competition.racingSeasons[0];
        const weekends = season?.weekends || [];

        return NextResponse.json({ weekends });
    } catch (error) {
        console.error("Error fetching weekends:", error);
        return internalError();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return apiError(403, "FORBIDDEN", "Only admins can create weekends");
        }

        const competitionId = (await params).id;
        const { grandPrix, country, raceDate } = await request.json();

        if (!grandPrix || !country || !raceDate) {
            return apiError(400, "MISSING_FIELDS", "Missing required fields");
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: { racingSeasons: true },
        });

        if (!competition || competition.type !== "RACING") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a racing competition");
        }

        if (!canManageCompetition(session.user, competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can create weekends");
        }

        let racingSeason = competition.racingSeasons[0];
        if (!racingSeason) {
            racingSeason = await prisma.racingSeason.create({
                data: { competitionId },
            });
        }

        const weekend = await prisma.racingWeekend.create({
            data: {
                seasonId: racingSeason.id,
                grandPrix,
                country,
                raceDate: new Date(raceDate),
            },
            include: {
                sessions: true,
            },
        });

        return NextResponse.json({ weekend }, { status: 201 });
    } catch (error) {
        console.error("Error creating weekend:", error);
        return internalError();
    }
}