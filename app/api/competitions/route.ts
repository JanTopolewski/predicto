import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function GET(_request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
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
            return apiError(403, "FORBIDDEN", "Only administrators can create competitions");
        }

        const { name, type, season, startDate, endDate, isPublic } = await request.json();

        if (!name || !type || !season || !startDate || !endDate) {
            return apiError(400, "MISSING_FIELDS", "All fields are required");
        }

        if (!["FOOTBALL", "RACING"].includes(type)) {
            return apiError(400, "INVALID_COMPETITION_TYPE", "Invalid competition type");
        }

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            return apiError(400, "INVALID_DATE", "Invalid date format");
        }

        if (parsedEndDate < parsedStartDate) {
            return apiError(400, "END_DATE_BEFORE_START", "End date cannot be earlier than start date");
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
                message: "Competition created successfully",
                competition,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating competition:", error);
        return internalError();
    }
}