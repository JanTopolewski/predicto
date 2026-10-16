import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, forbidden, internalError } from "@/lib/api";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return forbidden();
        }

        const team = await prisma.team.findUnique({
            where: { id },
        });

        if (!team) {
            return apiError(404, "TEAM_NOT_FOUND", "Team not found");
        }

        return NextResponse.json({ team });
    } catch (error) {
        console.error("Error fetching team:", error);
        return internalError();
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return forbidden();
        }

        const { name, shortName } = await request.json();

        if (
            !name ||
            !shortName ||
            typeof name !== "string" ||
            typeof shortName !== "string" ||
            !name.trim() ||
            !shortName.trim()
        ) {
            return apiError(400, "MISSING_FIELDS", "Name and short name are required");
        }

        const existingTeam = await prisma.team.findUnique({
            where: { id },
        });

        if (!existingTeam) {
            return apiError(404, "TEAM_NOT_FOUND", "Team not found");
        }

        const trimmedShortName = shortName.trim().toUpperCase();

        const shortnameExists = await prisma.team.findUnique({
            where: { shortName: trimmedShortName },
        });

        if (shortnameExists && shortnameExists.id !== id) {
            return apiError(409, "TEAM_SHORT_NAME_TAKEN", "Team with this short name already exists");
        }

        const updatedTeam = await prisma.team.update({
            where: { id },
            data: {
                name: name.trim(),
                shortName: trimmedShortName,
            },
        });

        return NextResponse.json({ team: updatedTeam });
    } catch (error) {
        console.error("Error updating team:", error);
        return internalError();
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return forbidden();
        }

        const team = await prisma.team.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        homeMatches: true,
                        awayMatches: true,
                        seasonWinnerPredictions: true,
                    },
                },
            },
        });

        if (!team) {
            return apiError(404, "TEAM_NOT_FOUND", "Team not found");
        }

        const isUsed =
            team._count.homeMatches > 0 ||
            team._count.awayMatches > 0 ||
            team._count.seasonWinnerPredictions > 0;

        if (isUsed) {
            return apiError(
                409,
                "CANNOT_DELETE_USED_TEAM",
                "Cannot delete team with associated matches or season winner predictions"
            );
        }

        await prisma.team.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Team deleted successfully" });
    } catch (error) {
        console.error("Error deleting team:", error);
        return internalError();
    }
}