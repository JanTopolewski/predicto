import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, forbidden, internalError } from "@/lib/api";

export async function GET(request: NextRequest) {
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

        const url = request?.nextUrl ?? new URL(request?.url ?? "http://localhost/api/teams");
        const sort = url.searchParams?.get("sort");

        const orderBy = sort === "name" || sort === "asc" ? { name: "asc" as const } : { createdAt: "desc" as const };

        const teams = await prisma.team.findMany({
            orderBy,
        });

        return NextResponse.json({ teams });
    } catch (error) {
        console.error("Error fetching teams:", error);
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

        const trimmedShortName = shortName.trim().toUpperCase();

        const existingTeam = await prisma.team.findUnique({
            where: { shortName: trimmedShortName },
        });

        if (existingTeam) {
            return apiError(409, "TEAM_SHORT_NAME_TAKEN", "Team with this short name already exists");
        }

        const team = await prisma.team.create({
            data: {
                name: name.trim(),
                shortName: trimmedShortName,
            },
        });

        return NextResponse.json({ team }, { status: 201 });
    } catch (error) {
        console.error("Error creating team:", error);
        return internalError();
    }
}