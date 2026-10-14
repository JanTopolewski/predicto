import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
            return NextResponse.json(
                { error: "Only admins can update matches" },
                { status: 403 }
            );
        }

        const { id: competitionId, matchId } = await params;
        const { homeGoals, awayGoals, status, votingClosedAt } =
            await request.json();

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
            return NextResponse.json(
                { error: "Match not found" },
                { status: 404 }
            );
        }

        const competition = match.season.competition;
        if (competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can update matches" },
                { status: 403 }
            );
        }

        const updatedMatch = await prisma.footballMatch.update({
            where: { id: matchId },
            data: {
                ...(homeGoals !== undefined && { homeGoals }),
                ...(awayGoals !== undefined && { awayGoals }),
                ...(status && { status }),
                ...(votingClosedAt && {
                    votingClosedAt: new Date(votingClosedAt),
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

        return NextResponse.json({ match: updatedMatch });
    } catch (error) {
        console.error("Error updating match:", error);
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
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only admins can delete matches" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { error: "Match not found" },
                { status: 404 }
            );
        }

        if (match.season.competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can delete matches" },
                { status: 403 }
            );
        }

        if (match.resolved) {
            return NextResponse.json(
                {
                    error:
                        "Nie można usunąć meczu, który został już rozliczony i posiada naliczone punkty.",
                },
                { status: 400 }
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
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}