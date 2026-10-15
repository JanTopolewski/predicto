import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function GET(_request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const competitionMembers = await prisma.competitionMember.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                competition: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        season: true,
                        startDate: true,
                        endDate: true,
                        _count: {
                            select: {
                                members: true,
                            },
                        },
                    },
                },
            },
        });

        const competitions = competitionMembers.map((member) => ({
            id: member.competition.id,
            name: member.competition.name,
            type: member.competition.type,
            season: member.competition.season,
            points: member.points,
            memberCount: member.competition._count.members,
            startDate: member.competition.startDate.toISOString(),
            endDate: member.competition.endDate.toISOString(),
        }));

        return NextResponse.json({
            competitions,
        });
    } catch (error) {
        console.error("Error fetching competitions:", error);
        return NextResponse.json(
            { error: "Internal server error" },
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
                { message: "Tylko administratorzy mogą tworzyć konkurencje" },
                { status: 403 }
            );
        }

        const { name, type, season, startDate, endDate, isPublic } = await request.json();

        if (!name || !type || !season || !startDate || !endDate) {
            return NextResponse.json(
                { message: "Wszystkie pola są wymagane" },
                { status: 400 }
            );
        }

        if (!["FOOTBALL", "RACING"].includes(type)) {
            return NextResponse.json(
                { message: "Nieprawidłowy typ konkurencji" },
                { status: 400 }
            );
        }

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            return NextResponse.json(
                { message: "Nieprawidłowy format daty" },
                { status: 400 }
            );
        }

        if (parsedEndDate < parsedStartDate) {
            return NextResponse.json(
                { message: "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia" },
                { status: 400 }
            );
        }

        const inviteCode = nanoid(10).toUpperCase();

        const competition = await prisma.competition.create({
            data: {
                name,
                type,
                season,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                isPublic: isPublic ?? true,
                inviteCode,
                createdBy: session.user.id,
            },
        });

        return NextResponse.json(
            {
                message: "Konkurencja została utworzona",
                competition,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating competition:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}