import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";
import { apiError, forbidden, internalError } from "@/lib/api";

export async function PATCH(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; sessionId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const { id: competitionId, sessionId } = await params;
        const { name, startTime, votingClosedAt, participatingDriverIds } =
            await request.json();

        const racingSession = await prisma.racingSession.findUnique({
            where: { id: sessionId },
            include: {
                weekend: {
                    include: {
                        season: {
                            include: {
                                competition: true,
                            },
                        },
                    },
                },
                participants: true,
            },
        });

        if (
            !racingSession ||
            racingSession.weekend.season.competition.id !== competitionId
        ) {
            return apiError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        if (
            racingSession.weekend.season.competition.createdBy !== session.user.id
        ) {
            return apiError(403, "FORBIDDEN", "Only competition creator can update sessions");
        }

        // Update participants if provided
        if (participatingDriverIds && Array.isArray(participatingDriverIds)) {
            if (racingSession.resolved) {
                return apiError(
                    400,
                    "CANNOT_MODIFY_RESOLVED_SESSION_PARTICIPANTS",
                    "Cannot modify participants list of an already resolved session"
                );
            }

            await prisma.racingSessionParticipant.deleteMany({
                where: { sessionId },
            });

            await prisma.racingSessionParticipant.createMany({
                data: participatingDriverIds.map((driverId: string) => ({
                    sessionId,
                    driverId,
                })),
            });
        }

        let parsedVotingClosedAt: Date | null | undefined = undefined;
        if (votingClosedAt !== undefined) {
            if (racingSession.resolved) {
                return apiError(
                    400,
                    "CANNOT_MODIFY_RESOLVED_SESSION",
                    "Cannot modify voting time for an already resolved session"
                );
            }
            if (racingSession.startTime && isTimePassed(racingSession.startTime)) {
                return apiError(
                    400,
                    "CANNOT_MODIFY_PAST_SESSION",
                    "Cannot modify voting time after session has started"
                );
            }

            if (votingClosedAt === null) {
                parsedVotingClosedAt = null;
            } else {
                parsedVotingClosedAt = new Date(votingClosedAt);
                if (isNaN(parsedVotingClosedAt.getTime())) {
                    return apiError(400, "INVALID_DATE", "Invalid votingClosedAt date format");
                }
            }
        }

        const updatedSession = await prisma.racingSession.update({
            where: { id: sessionId },
            data: {
                ...(name && { name }),
                ...(startTime && { startTime: new Date(startTime) }),
                ...(parsedVotingClosedAt !== undefined && {
                    votingClosedAt: parsedVotingClosedAt,
                }),
            },
            include: {
                participants: {
                    include: { driver: true },
                },
            },
        });

        return NextResponse.json({ session: updatedSession });
    } catch (error) {
        console.error("Error updating racing session:", error);
        return internalError();
    }
}

export async function DELETE(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; sessionId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return forbidden();
        }

        const { id: competitionId, sessionId } = await params;

        const racingSession = await prisma.racingSession.findUnique({
            where: { id: sessionId },
            include: {
                weekend: {
                    include: {
                        season: {
                            include: {
                                competition: true,
                            },
                        },
                    },
                },
            },
        });

        if (
            !racingSession ||
            racingSession.weekend.season.competition.id !== competitionId
        ) {
            return apiError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        if (
            racingSession.weekend.season.competition.createdBy !== session.user.id
        ) {
            return apiError(403, "FORBIDDEN", "Only competition creator can delete sessions");
        }

        if (racingSession.resolved) {
            return apiError(
                400,
                "CANNOT_DELETE_RESOLVED_SESSION",
                "Cannot delete session that has already been resolved and points awarded"
            );
        }

        await prisma.racingSession.delete({
            where: { id: sessionId },
        });

        return NextResponse.json({
            message: "Session deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting racing session:", error);
        return internalError();
    }
}