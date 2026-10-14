import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
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
            return NextResponse.json(
                { error: "You are not a member of this competition" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { error: "Weekend not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ weekend });
    } catch (error) {
        console.error("Error fetching weekend:", error);
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
        params: Promise<{ id: string; weekendId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only admins can delete weekends" },
                { status: 403 }
            );
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
            },
        });

        if (!weekend || weekend.season.competition.id !== competitionId) {
            return NextResponse.json(
                { error: "Weekend not found" },
                { status: 404 }
            );
        }

        if (weekend.season.competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can delete weekends" },
                { status: 403 }
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
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}