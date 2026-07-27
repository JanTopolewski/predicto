import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; sessionId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id: competitionId, sessionId } = await params;

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

        const prediction = await prisma.racingPrediction.findUnique({
            where: {
                sessionId_userId: {
                    sessionId,
                    userId: session.user.id,
                },
            },
            include: {
                firstDriver: true,
                secondDriver: true,
                thirdDriver: true,
                wildcardDriver: true,
            },
        });

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error("Error fetching prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

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

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id: competitionId, sessionId } = await params;
        const {
            firstDriver,
            secondDriver,
            thirdDriver,
            wildcardDriverId,
            wildcardPosition,
        } = await request.json();

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

        if (racingSession.votingClosedAt && isTimePassed(racingSession.votingClosedAt)) {
            return NextResponse.json(
                { error: "Voting for this session is closed" },
                { status: 400 }
            );
        }

        if (racingSession.startTime && isTimePassed(racingSession.startTime)) {
            return NextResponse.json(
                { error: "Session has already started" },
                { status: 400 }
            );
        }

        // Validate based on session type
        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";

        if (isPodiumSession) {
            if (!firstDriver || !secondDriver || !thirdDriver) {
                return NextResponse.json(
                    { error: "For this session type, podium prediction is required" },
                    { status: 400 }
                );
            }

            // Verify drivers are different
            if (
                firstDriver === secondDriver ||
                firstDriver === thirdDriver ||
                secondDriver === thirdDriver
            ) {
                return NextResponse.json(
                    { error: "Podium drivers must be different" },
                    { status: 400 }
                );
            }
        }

        if (!wildcardDriverId || !wildcardPosition) {
            return NextResponse.json(
                { error: "Wildcard driver and position are required" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(wildcardPosition) || wildcardPosition < 1 || wildcardPosition > 20) {
            return NextResponse.json(
                { error: "Position must be between 1 and 20" },
                { status: 400 }
            );
        }

        const prediction = await prisma.racingPrediction.upsert({
            where: {
                sessionId_userId: {
                    sessionId,
                    userId: session.user.id,
                },
            },
            update: {
                firstDriverId: isPodiumSession ? firstDriver : null,
                secondDriverId: isPodiumSession ? secondDriver : null,
                thirdDriverId: isPodiumSession ? thirdDriver : null,
                wildcardDriverId,
                wildcardPosition,
            },
            create: {
                sessionId,
                userId: session.user.id,
                firstDriverId: isPodiumSession ? firstDriver : null,
                secondDriverId: isPodiumSession ? secondDriver : null,
                thirdDriverId: isPodiumSession ? thirdDriver : null,
                wildcardDriverId,
                wildcardPosition,
            },
            include: {
                firstDriver: true,
                secondDriver: true,
                thirdDriver: true,
                wildcardDriver: true,
            },
        });

        return NextResponse.json({ prediction }, { status: 201 });
    } catch (error) {
        console.error("Error creating prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}