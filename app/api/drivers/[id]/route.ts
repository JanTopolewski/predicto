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

        const driver = await prisma.driver.findUnique({
            where: { id },
        });

        if (!driver) {
            return NextResponse.json(
                { message: "Kierowca nie znaleziony" },
                { status: 404 }
            );
        }

        return NextResponse.json({ driver });
    } catch (error) {
        console.error("Error fetching driver:", error);
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

        const { name, number, team } = await request.json();

        if (!name || !number || !team) {
            return NextResponse.json(
                { message: "Nazwa, numer i zespół są wymagane" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(number) || number < 1) {
            return NextResponse.json(
                { message: "Numer musi być liczbą dodatnią" },
                { status: 400 }
            );
        }

        const existingDriver = await prisma.driver.findUnique({
            where: { id },
        });

        if (!existingDriver) {
            return NextResponse.json(
                { message: "Kierowca nie znaleziony" },
                { status: 404 }
            );
        }

        const numberExists = await prisma.driver.findUnique({
            where: { number },
        });

        if (numberExists && numberExists.id !== id) {
            return NextResponse.json(
                { message: "Kierowca z takim numerem już istnieje" },
                { status: 409 }
            );
        }

        const updatedDriver = await prisma.driver.update({
            where: { id },
            data: {
                name,
                number,
                team,
            },
        });

        return NextResponse.json({ driver: updatedDriver });
    } catch (error) {
        console.error("Error updating driver:", error);
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

        const driver = await prisma.driver.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        sessionParticipants: true,
                        racingResults: true,
                        wildcards: true,
                        seasonWinnerPredictions: true,
                        racingPredictionFirsts: true,
                        racingPredictionSeconds: true,
                        racingPredictionThirds: true,
                    },
                },
            },
        });

        if (!driver) {
            return NextResponse.json(
                { message: "Kierowca nie znaleziony" },
                { status: 404 }
            );
        }

        const isUsed =
            driver._count.sessionParticipants > 0 ||
            driver._count.racingResults > 0 ||
            driver._count.wildcards > 0 ||
            driver._count.seasonWinnerPredictions > 0 ||
            driver._count.racingPredictionFirsts > 0 ||
            driver._count.racingPredictionSeconds > 0 ||
            driver._count.racingPredictionThirds > 0;

        if (isUsed) {
            return NextResponse.json(
                {
                    message:
                        "Nie można usunąć kierowcy, który bierze udział w sesjach wyścigowych lub posiada przypisane wyniki/predykcje.",
                },
                { status: 409 }
            );
        }

        await prisma.driver.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Kierowca usunięty" });
    } catch (error) {
        console.error("Error deleting driver:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}