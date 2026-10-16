import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, forbidden, internalError } from "@/lib/api";

export async function GET() {
    try {
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

        const drivers = await prisma.driver.findMany({
            orderBy: { number: "asc" },
        });

        return NextResponse.json({ drivers });
    } catch (error) {
        console.error("Error fetching drivers:", error);
        return internalError();
    }
}

export async function POST(request: NextRequest) {
    try {
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
            where: { number },
        });

        if (existingDriver) {
            return apiError(409, "DRIVER_NUMBER_TAKEN", "Driver with this number already exists");
        }

        const driver = await prisma.driver.create({
            data: {
                name,
                number,
                team,
            },
        });

        return NextResponse.json({ driver }, { status: 201 });
    } catch (error) {
        console.error("Error creating driver:", error);
        return internalError();
    }
}