import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
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

        const drivers = await prisma.driver.findMany({
            orderBy: { number: "asc" },
        });

        return NextResponse.json({ drivers });
    } catch (error) {
        console.error("Error fetching drivers:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
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
            where: { number },
        });

        if (existingDriver) {
            return NextResponse.json(
                { message: "Kierowca z takim numerem już istnieje" },
                { status: 409 }
            );
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
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}