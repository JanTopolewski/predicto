import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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