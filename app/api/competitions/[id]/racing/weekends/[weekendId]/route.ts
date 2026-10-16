import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function GET(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; weekendId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { id: competitionId, weekendId } = await params;

        // Check if user is admin or member
        const isAdmin = session.user.role === "ADMIN";
        const member = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId: session.user.id,
                },
            },
        });

        if (!isAdmin && !member) {
            return apiError(403, "NOT_A_MEMBER", "You are not a member of this competition");
        }

        const weekend = await prisma.racingWeekend.findUnique({
            where: { id: weekendId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
                sessions: {
                    include: {
                        participants: {
                            include: {
                                driver: true,
                            },
                        },
                        results: {
                            include: {
                                driver: true,
                            },
                        },
                        wildcards: {
                            include: {
                                driver: true,
                            },
                        },
                    },
                    orderBy: {
                        startTime: "asc",
                    },
                },
            },
        });

        if (!weekend || weekend.season.competition.id !== competitionId) {
            return apiError(404, "WEEKEND_NOT_FOUND", "Weekend not found");
        }

        return NextResponse.json({ weekend });
    } catch (error) {
        console.error("Error fetching weekend:", error);
        return internalError();
    }
}

export async function DELETE(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; weekendId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return apiError(403, "FORBIDDEN", "Only admins can delete weekends");
        }

        const { id: competitionId, weekendId } = await params;

        const weekend = await prisma.racingWeekend.findUnique({
            where: { id: weekendId },
            include: {
                season: {
                    include: {
                        competition: true,
                    },
                },
                sessions: {
                    select: {
                        resolved: true,
                    },
                },
            },
        });

        if (!weekend || weekend.season.competition.id !== competitionId) {
            return apiError(404, "WEEKEND_NOT_FOUND", "Weekend not found");
        }

        if (weekend.season.competition.createdBy !== session.user.id) {
            return apiError(403, "FORBIDDEN", "Only competition creator can delete weekends");
        }

        const hasResolvedSession = weekend.sessions.some((s) => s.resolved);
        if (hasResolvedSession) {
            return apiError(
                400,
                "CANNOT_DELETE_RESOLVED_WEEKEND",
                "Cannot delete weekend with already resolved sessions and points awarded"
            );
        }

        await prisma.racingWeekend.delete({
            where: { id: weekendId },
        });

        return NextResponse.json({
            message: "Weekend deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting weekend:", error);
        return internalError();
    }
}