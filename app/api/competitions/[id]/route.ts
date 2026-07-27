import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        const competition = await prisma.competition.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                    orderBy: { points: "desc" },
                },
                footballSeasons: {
                    include: {
                        matches: {
                            include: {
                                homeTeam: true,
                                awayTeam: true,
                            },
                            orderBy: { kickoff: "asc" },
                        },
                        seasonWinnerPredictions: {
                            where: {
                                userId: session?.user?.id || "",
                            },
                            include: {
                                team: true,
                            },
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

        const isMember = competition.members.some((m) => m.user.id === session?.user?.id);
        const isAdmin = session?.user?.role === "ADMIN";
        const isOwner = competition.createdBy === session?.user?.id;

        if (!session?.user?.id || (!isMember && !(isAdmin && isOwner))) {
            return NextResponse.json(
                { error: "Access denied" },
                { status: 403 }
            );
        }

        const footballSeason = competition.footballSeasons[0];
        let allTeams = [];

        if (footballSeason) {
            const teamIds = new Set<string>();
            footballSeason.matches.forEach((match) => {
                teamIds.add(match.homeTeamId);
                teamIds.add(match.awayTeamId);
            });

            if (teamIds.size > 0) {
                allTeams = await prisma.team.findMany({
                    where: {
                        id: { in: Array.from(teamIds) },
                    },
                    orderBy: { name: "asc" },
                });
            }
        }

        return NextResponse.json({
            competition: {
                id: competition.id,
                name: competition.name,
                type: competition.type,
                season: competition.season,
                startDate: competition.startDate,
                endDate: competition.endDate,
                createdBy: competition.createdBy,
                members: competition.members.map((m) => ({
                    id: m.user.id,
                    username: m.user.username,
                    points: m.points,
                })),
                matches: footballSeason?.matches || [],
                allTeams,
                seasonPrediction: footballSeason?.seasonWinnerPredictions[0] || null,
                hasMatchStarted: footballSeason?.hasMatchStarted || false,
                winnerResolved: competition.winnerResolved,
            },
        });
    } catch (error) {
        console.error("Error fetching competition:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}