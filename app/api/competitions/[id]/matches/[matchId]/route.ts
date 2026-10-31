import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";
import { apiError, forbidden, internalError, canManageCompetition } from "@/lib/api";

export async function PATCH(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const { id: competitionId, matchId } = await params;
        const { homeGoals, awayGoals, status, votingClosedAt } =
            await request.json();

        if (homeGoals !== undefined) {
            if (!Number.isInteger(homeGoals) || homeGoals < 0 || homeGoals > 50) {
                return apiError(400, "INVALID_GOALS", "Invalid home goals");
            }
        }

        if (awayGoals !== undefined) {
            if (!Number.isInteger(awayGoals) || awayGoals < 0 || awayGoals > 50) {
                return apiError(400, "INVALID_GOALS", "Invalid away goals");
            }
        }

        if (status !== undefined) {
            const validStatuses = ["SCHEDULED", "IN_PROGRESS", "FINISHED", "POSTPONED", "CANCELLED"];
            if (!validStatuses.includes(status)) {
                return apiError(400, "INVALID_STATUS", "Invalid match status");
            }
        }

        let parsedVotingClosedAt: Date | null | undefined = undefined;
        if (votingClosedAt !== undefined) {
            if (votingClosedAt === null) {
                parsedVotingClosedAt = null;
            } else {
                parsedVotingClosedAt = new Date(votingClosedAt);
                if (isNaN(parsedVotingClosedAt.getTime())) {
                    return apiError(400, "INVALID_DATE", "Invalid votingClosedAt date format");
                }
            }
        }

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
                predictions: true,
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return apiError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        const competition = match.season.competition;
        if (!canManageCompetition(session.user, competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can update matches");
        }

        if (parsedVotingClosedAt !== undefined) {
            if (match.resolved) {
                return apiError(
                    400,
                    "CANNOT_MODIFY_RESOLVED_MATCH",
                    "Cannot modify voting time for an already resolved match"
                );
            }
            if (match.kickoff && isTimePassed(match.kickoff)) {
                return apiError(
                    400,
                    "CANNOT_MODIFY_PAST_MATCH",
                    "Cannot modify voting time after match has started"
                );
            }
        }

        const updatedMatch = await prisma.footballMatch.update({
            where: { id: matchId },
            data: {
                ...(homeGoals !== undefined && { homeGoals }),
                ...(awayGoals !== undefined && { awayGoals }),
                ...(status && { status }),
                ...(parsedVotingClosedAt !== undefined && {
                    votingClosedAt: parsedVotingClosedAt,
                }),
                ...(homeGoals !== undefined &&
                    awayGoals !== undefined && { resolved: true }),
            },
            include: {
                homeTeam: true,
                awayTeam: true,
                predictions: true,
            },
        });

        // Automatically calculate points if score is provided and match resolved
        if (homeGoals !== undefined && awayGoals !== undefined) {
            const scoringRules = await prisma.competitionScoring.findUnique({
                where: { competitionId },
            });

            const exactScorePoints = scoringRules?.exactScorePoints ?? 3;
            const winnerPoints = scoringRules?.winnerPoints ?? 1;
            const actualResult = homeGoals - awayGoals;

            const updates = [];
            for (const prediction of updatedMatch.predictions) {
                const predictedResult = prediction.homeGoals - prediction.awayGoals;
                let points = 0;

                if (
                    prediction.homeGoals === homeGoals &&
                    prediction.awayGoals === awayGoals
                ) {
                    points = exactScorePoints;
                } else if (
                    (actualResult === 0 && predictedResult === 0) ||
                    (actualResult > 0 && predictedResult > 0) ||
                    (actualResult < 0 && predictedResult < 0)
                ) {
                    points = winnerPoints;
                }

                const oldPoints = prediction.points || 0;
                const pointsDiff = points - oldPoints;

                updates.push(
                    prisma.footballPrediction.update({
                        where: { id: prediction.id },
                        data: { points },
                    })
                );

                if (pointsDiff !== 0) {
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
                                    increment: pointsDiff,
                                },
                            },
                        })
                    );
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }
        }

        return NextResponse.json({ match: updatedMatch });
    } catch (error) {
        console.error("Error updating match:", error);
        return internalError();
    }
}

export async function DELETE(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const { id: competitionId, matchId } = await params;

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return apiError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        if (!canManageCompetition(session.user, match.season.competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can delete matches");
        }

        if (match.resolved) {
            return apiError(
                400,
                "CANNOT_DELETE_RESOLVED_MATCH",
                "Cannot delete match that has already been resolved and points awarded"
            );
        }

        await prisma.footballMatch.delete({
            where: { id: matchId },
        });

        return NextResponse.json({
            message: "Match deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting match:", error);
        return internalError();
    }
}