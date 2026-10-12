import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
            return NextResponse.json(
                { error: "Only admins can set results" },
                { status: 403 }
            );
        }

        const { id: competitionId, sessionId } = await params;
        const { results } = await request.json();

        if (!Array.isArray(results) || results.length === 0) {
            return NextResponse.json(
                { error: "Results array is required and cannot be empty" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (racingSession.weekend.season.competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can set results" },
                { status: 403 }
            );
        }

        const maxPosition = racingSession.participants.length;
        const driverIds = new Set(racingSession.participants.map((p) => p.driverId));

        for (const item of results) {
            if (!driverIds.has(item.driverId)) {
                return NextResponse.json(
                    { error: `Kierowca o ID ${item.driverId} nie uczestniczy w tej sesji` },
                    { status: 400 }
                );
            }
            if (
                !Number.isInteger(item.position) ||
                item.position < 1 ||
                item.position > maxPosition
            ) {
                return NextResponse.json(
                    { error: `Pozycja musi mieścić się w przedziale 1 - ${maxPosition}` },
                    { status: 400 }
                );
            }
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
            message: "Wyniki zostały zapisane, a głosowanie zablokowane",
        });
    } catch (error) {
        console.error("Error setting session results:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}