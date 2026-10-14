import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const teams = await prisma.team.findMany({
            orderBy: {
                name: "asc",
            },
            select: {
                id: true,
                name: true,
                shortName: true,
            },
        });

        return NextResponse.json({ teams });
    } catch (error) {
        console.error("Error fetching sorted teams:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}