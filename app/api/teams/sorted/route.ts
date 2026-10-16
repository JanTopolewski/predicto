import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { unauthorized, internalError } from "@/lib/api";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
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
        return internalError();
    }
}