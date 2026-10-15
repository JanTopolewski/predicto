import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Forbidden" },
                { status: 403 }
            );
        }

        const team = await prisma.team.findUnique({
            where: { id },
        });

        if (!team) {
            return NextResponse.json(
                { message: "Drużyna nie znaleziona" },
                { status: 404 }
            );
        }

        return NextResponse.json({ team });
    } catch (error) {
        console.error("Error fetching team:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
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
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Forbidden" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { message: "Nazwa i skrót są wymagane" },
                { status: 400 }
            );
        }

        const existingTeam = await prisma.team.findUnique({
            where: { id },
        });

        if (!existingTeam) {
            return NextResponse.json(
                { message: "Drużyna nie znaleziona" },
                { status: 404 }
            );
        }

        const trimmedShortName = shortName.trim().toUpperCase();

        const shortnameExists = await prisma.team.findUnique({
            where: { shortName: trimmedShortName },
        });

        if (shortnameExists && shortnameExists.id !== id) {
            return NextResponse.json(
                { message: "Drużyna z takim skrótem już istnieje" },
                { status: 409 }
            );
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
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
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
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Forbidden" },
                { status: 403 }
            );
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
            return NextResponse.json(
                { message: "Drużyna nie znaleziona" },
                { status: 404 }
            );
        }

        const isUsed =
            team._count.homeMatches > 0 ||
            team._count.awayMatches > 0 ||
            team._count.seasonWinnerPredictions > 0;

        if (isUsed) {
            return NextResponse.json(
                {
                    message:
                        "Nie można usunąć drużyny, która bierze udział w meczach lub posiada zarejestrowane głosy na zwycięzcę sezonu.",
                },
                { status: 409 }
            );
        }

        await prisma.team.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Drużyna usunięta" });
    } catch (error) {
        console.error("Error deleting team:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}