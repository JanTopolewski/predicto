import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only admins can delete competitions" },
                { status: 403 }
            );
        }

        const competitionId = (await params).id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
        });

        if (!competition) {
            return NextResponse.json(
                { error: "Competition not found" },
                { status: 404 }
            );
        }

        if (competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can delete it" },
                { status: 403 }
            );
        }

        await prisma.competition.delete({
            where: { id: competitionId },
        });

        return NextResponse.json({
            message: "Competition deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting competition:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}