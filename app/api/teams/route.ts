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

        const teams = await prisma.team.findMany({
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ teams });
    } catch (error) {
        console.error("Error fetching teams:", error);
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

        const { name, shortName } = await request.json();

        if (!name || !shortName) {
            return NextResponse.json(
                { message: "Nazwa i skrót są wymagane" },
                { status: 400 }
            );
        }

        const existingTeam = await prisma.team.findUnique({
            where: { shortName: shortName.toUpperCase() },
        });

        if (existingTeam) {
            return NextResponse.json(
                { message: "Drużyna z takim skrótem już istnieje" },
                { status: 409 }
            );
        }

        const team = await prisma.team.create({
            data: {
                name,
                shortName: shortName.toUpperCase(),
            },
        });

        return NextResponse.json({ team }, { status: 201 });
    } catch (error) {
        console.error("Error creating team:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}