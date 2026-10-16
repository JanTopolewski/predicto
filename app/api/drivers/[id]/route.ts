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

        const driver = await prisma.driver.findUnique({
            where: { id },
        });

        if (!driver) {
            return apiError(404, "DRIVER_NOT_FOUND", "Driver not found");
        }

        return NextResponse.json({ driver });
    } catch (error) {
        console.error("Error fetching driver:", error);
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

        const { name, number, team } = await request.json();

        if (!name || !number || !team) {
            return apiError(400, "MISSING_FIELDS", "Name, number and team are required");
        }

        if (!Number.isInteger(number) || number < 1) {
            return apiError(400, "INVALID_NUMBER", "Number must be a positive integer");
        }

        const existingDriver = await prisma.driver.findUnique({
            where: { id },
        });

        if (!existingDriver) {
            return apiError(404, "DRIVER_NOT_FOUND", "Driver not found");
        }

        const numberExists = await prisma.driver.findUnique({
            where: { number },
        });

        if (numberExists && numberExists.id !== id) {
            return apiError(409, "DRIVER_NUMBER_TAKEN", "Driver with this number already exists");
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
            return apiError(404, "DRIVER_NOT_FOUND", "Driver not found");
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
            return apiError(
                409,
                "CANNOT_DELETE_USED_DRIVER",
                "Cannot delete driver with associated sessions, results or predictions"
            );
        }

        await prisma.driver.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Driver deleted successfully" });
    } catch (error) {
        console.error("Error deleting driver:", error);
        return internalError();
    }
}