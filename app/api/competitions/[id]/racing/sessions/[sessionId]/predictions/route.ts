import { apiError, forbidden, internalError, unauthorized } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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
            return unauthorized();
        }

        const { id: competitionId, sessionId } = await params;

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
        }

        // scope === "all": All participants' predictions for this session
        const racingSession = await prisma.racingSession.findUnique({
            where: { id: sessionId },
            include: {
                weekend: {
                    include: {
                        season: true,
                    },
                },
                participants: {
                    include: {
                        driver: true,
                    },
                },
                wildcards: {
                    include: {
                        driver: true,
                    },
                },
                predictions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                        firstDriver: true,
                        secondDriver: true,
                        thirdDriver: true,
                        wildcardDriver: true,
                    },
                },
            },
        });

        if (
            !racingSession ||
            racingSession.weekend.season.competitionId !== competitionId
        ) {
            return apiError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        const hasStarted =
            racingSession.resolved ||
            (racingSession.startTime && isTimePassed(racingSession.startTime));

        if (!hasStarted) {
            return apiError(
                403,
                "EVENT_NOT_STARTED",
                "Predictions of other participants become visible only after the session starts"
            );
        }

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
            racingSession.predictions.map((p) => [p.userId, p])
        );

        const memberPredictions = members.map((m) => {
            const pred = predictionsByUserId.get(m.userId);
            return {
                user: m.user,
                prediction: pred
                    ? {
                          id: pred.id,
                          firstDriver: pred.firstDriver,
                          secondDriver: pred.secondDriver,
                          thirdDriver: pred.thirdDriver,
                          wildcardDriver: pred.wildcardDriver,
                          wildcardPosition: pred.wildcardPosition,
                          points: pred.points,
                          createdAt: pred.createdAt,
                      }
                    : null,
            };
        });

        return NextResponse.json({
            session: {
                id: racingSession.id,
                weekendId: racingSession.weekendId,
                name: racingSession.name,
                type: racingSession.type,
                startTime: racingSession.startTime,
                resolved: racingSession.resolved,
                wildcard: racingSession.wildcards?.[0] || null,
                grandPrix: racingSession.weekend.grandPrix,
            },
            predictions: memberPredictions,
        });
    } catch (error) {
        console.error("Error fetching session predictions:", error);
        return internalError();
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
            return unauthorized();
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
            return forbidden();
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
            return apiError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        if (racingSession.resolved) {
            return apiError(400, "SESSION_ALREADY_RESOLVED", "Session has already been resolved");
        }

        if (racingSession.votingClosedAt && isTimePassed(racingSession.votingClosedAt)) {
            return apiError(400, "VOTING_CLOSED", "Voting for this session is closed");
        }

        if (racingSession.startTime && isTimePassed(racingSession.startTime)) {
            return apiError(400, "SESSION_ALREADY_STARTED", "Session has already started");
        }

        // Get number of participating drivers
        const maxPosition = racingSession.participants.length;

        // Validate based on session type
        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";

        // Podium validation (optional but if provided, must be complete)
        if (isPodiumSession && (firstDriver || secondDriver || thirdDriver)) {
            if (!firstDriver || !secondDriver || !thirdDriver) {
                return apiError(
                    400,
                    "PODIUM_INCOMPLETE",
                    "If providing podium, all three positions are required"
                );
            }

            // Verify drivers are different
            if (
                firstDriver === secondDriver ||
                firstDriver === thirdDriver ||
                secondDriver === thirdDriver
            ) {
                return apiError(
                    400,
                    "PODIUM_DUPLICATE_DRIVERS",
                    "Podium drivers must be different"
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
                return apiError(
                    400,
                    "PODIUM_NOT_PARTICIPATING",
                    "Podium drivers must participate in this session"
                );
            }
        }

        // Get wildcard driver from session (admin-selected)
        const sessionWildcard = await prisma.wildcard.findFirst({
            where: { sessionId },
        });

        // If session has a configured wildcard driver, predicting their position is mandatory
        if (sessionWildcard && !wildcardPosition) {
            return apiError(
                400,
                "WILDCARD_POSITION_REQUIRED",
                "Wildcard predicted position is required for this session"
            );
        }

        // Wildcard validation (if provided, must have position)
        if (wildcardPosition) {
            if (!Number.isInteger(wildcardPosition) || wildcardPosition < 1 || wildcardPosition > maxPosition) {
                return apiError(
                    400,
                    "POSITION_OUT_OF_RANGE",
                    `Position must be between 1 and ${maxPosition}`,
                    { max: maxPosition }
                );
            }
        }

        // At least one prediction must be provided
        if (!wildcardPosition && !(isPodiumSession && firstDriver)) {
            return apiError(
                400,
                "MISSING_PREDICTION_DATA",
                "Please provide at least wildcard position or podium prediction"
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
        return internalError();
    }
}
