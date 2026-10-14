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
                { error: "Only admins can create matches" },
                { status: 403 }
            );
        }

        const competitionId = (await params).id;
        const { homeTeamId, awayTeamId, kickoff, predictedEndTime } =
            await request.json();

        if (!homeTeamId || !awayTeamId || !kickoff) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (homeTeamId === awayTeamId) {
            return NextResponse.json(
                { error: "Home and away teams must be different" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Competition not found or is not a football competition" },
                { status: 404 }
            );
        }

        if (competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can add matches" },
                { status: 403 }
            );
        }

        const [homeTeam, awayTeam] = await Promise.all([
            prisma.team.findUnique({ where: { id: homeTeamId } }),
            prisma.team.findUnique({ where: { id: awayTeamId } }),
        ]);

        if (!homeTeam || !awayTeam) {
            return NextResponse.json(
                { error: "One or both teams not found" },
                { status: 404 }
            );
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
                kickoff: new Date(kickoff),
                predictedEndTime: predictedEndTime
                    ? new Date(predictedEndTime)
                    : null,
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
            return NextResponse.json(
                { error: "Competition not found or is not a football competition" },
                { status: 404 }
            );
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
                return NextResponse.json(
                    { error: "You are not a member of this competition" },
                    { status: 403 }
                );
            }
        }

        const matches = competition.footballSeasons[0]?.matches || [];

        return NextResponse.json({ matches });
    } catch (error) {
        console.error("Error fetching matches:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}