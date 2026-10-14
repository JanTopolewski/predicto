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

        if (racingSession.resolved) {
            return NextResponse.json(
                { error: "Sesja została już rozliczona" },
                { status: 400 }
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

        // Get number of participating drivers
        const maxPosition = racingSession.participants.length;

        // Validate based on session type
        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";

        // Podium validation (optional but if provided, must be complete)
        if (isPodiumSession && (firstDriver || secondDriver || thirdDriver)) {
            if (!firstDriver || !secondDriver || !thirdDriver) {
                return NextResponse.json(
                    { error: "If providing podium, all three positions are required" },
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

            // Verify drivers actually participate in this session
            const participantDriverIds = new Set(
                racingSession.participants.map((p) => p.driverId)
            );

            if (
                !participantDriverIds.has(firstDriver) ||
                !participantDriverIds.has(secondDriver) ||
                !participantDriverIds.has(thirdDriver)
            ) {
                return NextResponse.json(
                    { error: "Podium drivers must participate in this session" },
                    { status: 400 }
                );
            }
        }

        // Wildcard validation (optional but if provided, must have position)
        if (wildcardPosition) {
            if (!Number.isInteger(wildcardPosition) || wildcardPosition < 1 || wildcardPosition > maxPosition) {
                return NextResponse.json(
                    { error: `Position must be between 1 and ${maxPosition}` },
                    { status: 400 }
                );
            }
        }

        // At least one prediction must be provided
        if (!wildcardPosition && !(isPodiumSession && firstDriver)) {
            return NextResponse.json(
                { error: "Please provide at least wildcard position or podium prediction" },
                { status: 400 }
            );
        }

        // Get wildcard driver from session (admin-selected)
        const sessionWildcard = await prisma.wildcard.findFirst({
            where: { sessionId },
        });

        const prediction = await prisma.racingPrediction.upsert({
            where: {
                sessionId_userId: {
                    sessionId,
                    userId: session.user.id,
                },
            },
            update: {
                firstDriverId: isPodiumSession && firstDriver ? firstDriver : null,
                secondDriverId: isPodiumSession && secondDriver ? secondDriver : null,
                thirdDriverId: isPodiumSession && thirdDriver ? thirdDriver : null,
                wildcardDriverId: sessionWildcard?.driverId || null,
                wildcardPosition: wildcardPosition || null,
            },
            create: {
                sessionId,
                userId: session.user.id,
                firstDriverId: isPodiumSession && firstDriver ? firstDriver : null,
                secondDriverId: isPodiumSession && secondDriver ? secondDriver : null,
                thirdDriverId: isPodiumSession && thirdDriver ? thirdDriver : null,
                wildcardDriverId: sessionWildcard?.driverId || null,
                wildcardPosition: wildcardPosition || null,
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