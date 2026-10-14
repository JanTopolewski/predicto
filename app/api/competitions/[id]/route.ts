import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const competitionId = (await params).id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                members: {
                    include: {
                        user: true,
                    },
                },
                footballSeasons: {
                    include: {
                        matches: {
                            include: {
                                homeTeam: true,
                                awayTeam: true,
                                predictions: {
                                    where: { userId: session?.user?.id },
                                },
                            },
                            orderBy: { kickoff: "asc" },
                        },
                        seasonWinnerPredictions: {
                            where: { userId: session?.user?.id },
                            include: { team: true },
                        },
                    },
                },
                racingSeasons: {
                    include: {
                        weekends: {
                            include: {
                                sessions: {
                                    include: {
                                        participants: {
                                            include: { driver: true },
                                        },
                                    },
                                },
                            },
                        },
                        seasonWinnerPredictions: {
                            where: { userId: session?.user?.id },
                            include: { driver: true },
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

        const isMember = competition.members.some((m) => m.userId === session?.user?.id);
        const isAdmin = session?.user?.role === "ADMIN";
        const isOwner = competition.createdBy === session?.user?.id;

        if (!session?.user?.id || (!isMember && !(isAdmin && isOwner))) {
            return NextResponse.json(
                { error: "Access denied" },
                { status: 403 }
            );
        }

        const footballSeason = competition.footballSeasons[0];
        let allTeams: Awaited<ReturnType<typeof prisma.team.findMany>> = [];

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

        const racingSeason = competition.racingSeasons[0];
        let allDrivers: Awaited<ReturnType<typeof prisma.driver.findMany>> = [];

        if (racingSeason) {
            const driverIds = new Set<string>();
            racingSeason.weekends.forEach((weekend) => {
                weekend.sessions.forEach((session) => {
                    session.participants.forEach((participant) => {
                        driverIds.add(participant.driverId);
                    });
                });
            });

            if (driverIds.size > 0) {
                allDrivers = await prisma.driver.findMany({
                    where: {
                        id: { in: Array.from(driverIds) },
                    },
                    orderBy: { number: "asc" },
                });
            }
        }

        let hasSessionStarted = false;
        if (racingSeason) {
            for (const weekend of racingSeason.weekends) {
                for (const sess of weekend.sessions) {
                    if (new Date() >= new Date(sess.startTime)) {
                        hasSessionStarted = true;
                        break;
                    }
                }
                if (hasSessionStarted) break;
            }
        }

        let hasMatchStarted = false;
        if (footballSeason) {
            for (const match of footballSeason.matches) {
                if (new Date() >= new Date(match.kickoff)) {
                    hasMatchStarted = true;
                    break;
                }
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
                    id: m.userId,
                    username: m.user.username,
                    points: m.points,
                })),
                matches: footballSeason?.matches || [],
                allTeams,
                allDrivers,
                seasonPrediction: competition.type === "FOOTBALL"
                    ? competition.footballSeasons[0]?.seasonWinnerPredictions[0] || null
                    : competition.racingSeasons[0]?.seasonWinnerPredictions[0] || null,
                hasStarted: competition.type === "FOOTBALL" ? hasMatchStarted : hasSessionStarted,
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