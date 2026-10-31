import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError, forbidden } from "@/lib/api";

export async function GET(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { id: competitionId, matchId } = await params;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
        });

        if (!competition) {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        const member = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId: session.user.id,
                },
            },
        });

        const isCreatorOrAdmin =
            competition.createdBy === session.user.id || session.user.role === "ADMIN";

        if (!member && !isCreatorOrAdmin) {
            return forbidden();
        }

        const url = request.nextUrl ?? new URL(request.url ?? "http://localhost/api/test");
        const scope = url.searchParams?.get("scope");

        // If not scope=all, return just the current user's single prediction (backward compatibility)
        if (scope !== "all") {
            const prediction = await prisma.footballPrediction.findUnique({
                where: {
                    matchId_userId: {
                        matchId,
                        userId: session.user.id,
                    },
                },
            });

            return NextResponse.json({ prediction });
        }

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                homeTeam: true,
                awayTeam: true,
                season: true,
                predictions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                },
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return apiError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        // Predictions of other participants can only be viewed after the match has started or if resolved
        const hasStarted = match.resolved || (match.kickoff && isTimePassed(match.kickoff));
        if (!hasStarted) {
            return apiError(
                403,
                "EVENT_NOT_STARTED",
                "Predictions of other participants become visible only after the match starts"
            );
        }

        // Fetch all members of the competition to display both those who predicted and those who did not
        const members = await prisma.competitionMember.findMany({
            where: { competitionId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
            orderBy: {
                joinedAt: "asc",
            },
        });

        const predictionsByUserId = new Map(
            match.predictions.map((p) => [p.userId, p])
        );

        const memberPredictions = members.map((m) => {
            const pred = predictionsByUserId.get(m.userId);
            return {
                user: m.user,
                prediction: pred
                    ? {
                          id: pred.id,
                          homeGoals: pred.homeGoals,
                          awayGoals: pred.awayGoals,
                          points: pred.points,
                          createdAt: pred.createdAt,
                      }
                    : null,
            };
        });

        return NextResponse.json({
            match: {
                id: match.id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                homeGoals: match.homeGoals,
                awayGoals: match.awayGoals,
                kickoff: match.kickoff,
                resolved: match.resolved,
                status: match.status,
            },
            predictions: memberPredictions,
        });
    } catch (error) {
        console.error("Error fetching match predictions:", error);
        return internalError();
    }
}

export async function POST(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { id: competitionId, matchId } = await params;
        const { homeGoals, awayGoals } = await request.json();

        if (homeGoals === undefined || awayGoals === undefined) {
            return apiError(400, "MISSING_PREDICTION_DATA", "Missing prediction data");
        }

        if (
            !Number.isInteger(homeGoals) ||
            !Number.isInteger(awayGoals) ||
            homeGoals < 0 ||
            homeGoals > 20 ||
            awayGoals < 0 ||
            awayGoals > 20
        ) {
            return apiError(400, "INVALID_GOALS", "Incorrect goal numbers (must be integer between 0 and 20)");
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

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                season: true,
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return apiError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        if (match.resolved) {
            return apiError(400, "MATCH_RESOLVED", "Match has already been resolved");
        }

        if (match.status !== "SCHEDULED") {
            return apiError(400, "MATCH_NOT_SCHEDULED", `Cannot predict a match with status ${match.status}`, { status: match.status });
        }

        if (match.votingClosedAt && isTimePassed(match.votingClosedAt)) {
            return apiError(400, "VOTING_CLOSED", "Voting for this match is closed");
        }

        if (match.kickoff && isTimePassed(match.kickoff)) {
            return apiError(400, "MATCH_ALREADY_STARTED", "Match has already started");
        }

        const prediction = await prisma.footballPrediction.upsert({
            where: {
                matchId_userId: {
                    matchId,
                    userId: session.user.id,
                },
            },
            update: {
                homeGoals,
                awayGoals,
            },
            create: {
                matchId,
                userId: session.user.id,
                homeGoals,
                awayGoals,
            },
        });

        return NextResponse.json({ prediction }, { status: 201 });
    } catch (error) {
        console.error("Error creating prediction:", error);
        return internalError();
    }
}