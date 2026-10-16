import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError } from "@/lib/api";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return apiError(403, "FORBIDDEN", "Only admins can delete competitions");
        }

        const competitionId = (await params).id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
        });

        if (!competition) {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        if (competition.createdBy !== session.user.id) {
            return apiError(403, "FORBIDDEN", "Only competition creator can delete it");
        }

        await prisma.competition.delete({
            where: { id: competitionId },
        });

        return NextResponse.json({
            message: "Competition deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting competition:", error);
        return internalError();
    }
}