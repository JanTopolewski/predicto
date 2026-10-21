import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, canManageCompetition } from "@/lib/api";

export async function POST(
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
            return apiError(403, "FORBIDDEN", "Only admins can set results");
        }

        const { id: competitionId, sessionId } = await params;
        const { results } = await request.json();

        if (!Array.isArray(results) || results.length === 0) {
            return apiError(400, "MISSING_FIELDS", "Results array is required and cannot be empty");
        }

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
                wildcards: true,
            },
        });

        if (
            !racingSession ||
            racingSession.weekend.season.competition.id !== competitionId
        ) {
            return apiError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        if (!canManageCompetition(session.user, racingSession.weekend.season.competition.createdBy)) {
            return apiError(403, "FORBIDDEN", "Only competition creator can set results");
        }

        const maxPosition = racingSession.participants.length;
        const participantDriverIds = new Set(racingSession.participants.map((p) => p.driverId));
        const seenDriverIds = new Set<string>();
        const seenPositions = new Set<number>();

        for (const item of results) {
            if (!participantDriverIds.has(item.driverId)) {
                return apiError(
                    400,
                    "DRIVER_NOT_IN_SESSION",
                    `Driver with ID ${item.driverId} does not participate in this session`,
                    { driverId: item.driverId }
                );
            }
            if (seenDriverIds.has(item.driverId)) {
                return apiError(
                    400,
                    "DUPLICATE_DRIVER_RESULT",
                    `Driver with ID ${item.driverId} was provided more than once`,
                    { driverId: item.driverId }
                );
            }
            seenDriverIds.add(item.driverId);

            if (
                !Number.isInteger(item.position) ||
                item.position < 1 ||
                item.position > maxPosition
            ) {
                return apiError(
                    400,
                    "POSITION_OUT_OF_RANGE",
                    `Position must be between 1 and ${maxPosition}`,
                    { max: maxPosition }
                );
            }
            if (seenPositions.has(item.position)) {
                return apiError(
                    400,
                    "DUPLICATE_POSITION_RESULT",
                    `Position P${item.position} has been assigned to more than one driver`,
                    { position: item.position }
                );
            }
            seenPositions.add(item.position);
        }

        await prisma.$transaction(async (tx) => {
            await tx.racingResult.deleteMany({
                where: { sessionId },
            });

            await tx.racingResult.createMany({
                data: results.map((r) => ({
                    sessionId,
                    driverId: r.driverId,
                    position: r.position,
                })),
            });

            await tx.racingSession.update({
                where: { id: sessionId },
                data: {
                    votingClosedAt: new Date(),
                },
            });
        });

        return NextResponse.json({
            message: "Results saved and voting locked successfully",
        });
    } catch (error) {
        console.error("Error setting session results:", error);
        return internalError();
    }
}