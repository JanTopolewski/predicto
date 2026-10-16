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
            return apiError(403, "FORBIDDEN", "Only admins can create matches");
        }

        const competitionId = (await params).id;
        const { homeTeamId, awayTeamId, kickoff, predictedEndTime } =
            await request.json();

        if (!homeTeamId || !awayTeamId || !kickoff) {
            return apiError(400, "MISSING_FIELDS", "Missing required fields");
        }

        if (homeTeamId === awayTeamId) {
            return apiError(400, "TEAMS_MUST_DIFFER", "Home and away teams must be different");
        }

        const parsedKickoff = new Date(kickoff);
        if (isNaN(parsedKickoff.getTime())) {
            return apiError(400, "INVALID_DATE", "Invalid kickoff date format");
        }

        let parsedPredictedEndTime: Date | null = null;
        if (predictedEndTime) {
            parsedPredictedEndTime = new Date(predictedEndTime);
            if (isNaN(parsedPredictedEndTime.getTime())) {
                return apiError(400, "INVALID_DATE", "Invalid predicted end time format");
            }
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: {
                    include: {
                        matches: true,
                    },
                },
            },
        });

        if (!competition || competition.type !== "FOOTBALL") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a football competition");
        }

        if (competition.createdBy !== session.user.id) {
            return apiError(403, "FORBIDDEN", "Only competition creator can add matches");
        }

        const [homeTeam, awayTeam] = await Promise.all([
            prisma.team.findUnique({ where: { id: homeTeamId } }),
            prisma.team.findUnique({ where: { id: awayTeamId } }),
        ]);

        if (!homeTeam || !awayTeam) {
            return apiError(404, "TEAM_NOT_FOUND", "One or both teams not found");
        }

        let footballSeason: { id: string } | undefined = competition.footballSeasons[0];
        if (!footballSeason) {
            footballSeason = await prisma.footballSeason.create({
                data: {
                    competitionId,
                },
            });
        }

        const match = await prisma.footballMatch.create({
            data: {
                seasonId: footballSeason.id,
                homeTeamId,
                awayTeamId,
                kickoff: parsedKickoff,
                predictedEndTime: parsedPredictedEndTime,
                status: "SCHEDULED",
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
        });

        return NextResponse.json({ match }, { status: 201 });
    } catch (error) {
        console.error("Error creating match:", error);
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

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: {
                    include: {
                        matches: {
                            include: {
                                homeTeam: true,
                                awayTeam: true,
                                predictions: {
                                    where: {
                                        userId: session.user.id,
                                    },
                                },
                            },
                            orderBy: {
                                kickoff: "asc",
                            },
                        },
                    },
                },
            },
        });

        if (!competition || competition.type !== "FOOTBALL") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a football competition");
        }

        // Allow if user is admin/owner of this competition OR a member
        const isAdminOwner =
            session.user.role === "ADMIN" && competition.createdBy === session.user.id;

        if (!isAdminOwner) {
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

        const matches = competition.footballSeasons[0]?.matches || [];

        return NextResponse.json({ matches });
    } catch (error) {
        console.error("Error fetching matches:", error);
        return internalError();
    }
}