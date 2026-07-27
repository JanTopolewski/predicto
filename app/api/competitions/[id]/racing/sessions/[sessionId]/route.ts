import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
            return NextResponse.json(
                { error: "Only admins can update sessions" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (
            racingSession.weekend.season.competition.createdBy !== session.user.id
        ) {
            return NextResponse.json(
                { error: "Only competition creator can update sessions" },
                { status: 403 }
            );
        }

        // Update participants if provided
        if (participatingDriverIds && Array.isArray(participatingDriverIds)) {
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

        const updatedSession = await prisma.racingSession.update({
            where: { id: sessionId },
            data: {
                ...(name && { name }),
                ...(startTime && { startTime: new Date(startTime) }),
                ...(votingClosedAt && {
                    votingClosedAt: new Date(votingClosedAt),
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
        console.error("Error updating session:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
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
            return NextResponse.json(
                { error: "Only admins can delete sessions" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (
            racingSession.weekend.season.competition.createdBy !== session.user.id
        ) {
            return NextResponse.json(
                { error: "Only competition creator can delete sessions" },
                { status: 403 }
            );
        }

        await prisma.racingSession.delete({
            where: { id: sessionId },
        });

        return NextResponse.json({
            message: "Session deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting session:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}