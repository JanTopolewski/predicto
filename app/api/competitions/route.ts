import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const url = request.nextUrl ?? new URL(request.url ?? "http://localhost/api/competitions");
        const scope = url.searchParams?.get("scope") || (url.searchParams?.get("all") === "true" ? "all" : null);

        // If scope=all (or ?all=true), return all competitions (both joined and public / admin-visible)
        if (scope === "all") {
            const isAdmin = session.user?.role === "ADMIN";

            if (isAdmin) {
                const competitions = await prisma.competition.findMany({
                    include: {
                        members: {
                            where: {
                                userId: session.user.id,
                            },
                        },
                        _count: {
                            select: {
                                members: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });

                return NextResponse.json({
                    competitions: competitions.map((comp) => ({
                        id: comp.id,
                        name: comp.name,
                        type: comp.type,
                        season: comp.season,
                        memberCount: comp._count.members,
                        inviteCode: comp.inviteCode,
                        isPublic: comp.isPublic,
                        isMember: comp.members.length > 0,
                        createdBy: comp.createdBy,
                        canSeeInviteCode: comp.createdBy === session.user.id || isAdmin,
                        startDate: comp.startDate.toISOString(),
                        endDate: comp.endDate.toISOString(),
                    })),
                });
            }

            const competitionMembers = await prisma.competitionMember.findMany({
                where: {
                    userId: session.user.id,
                },
                include: {
                    competition: {
                        include: {
                            _count: {
                                select: {
                                    members: true,
                                },
                            },
                        },
                    },
                },
            });

            const memberCompetitionIds = competitionMembers.map((m) => m.competition.id);

            const publicCompetitions = await prisma.competition.findMany({
                where: {
                    isPublic: true,
                    id: {
                        notIn: memberCompetitionIds,
                    },
                },
                include: {
                    _count: {
                        select: {
                            members: true,
                        },
                    },
                },
            });

            const allCompetitions = [
                ...competitionMembers.map((member) => {
                    const canSeeInviteCode = member.competition.createdBy === session.user.id;
                    return {
                        id: member.competition.id,
                        name: member.competition.name,
                        type: member.competition.type,
                        season: member.competition.season,
                        points: member.points,
                        memberCount: member.competition._count.members,
                        inviteCode: canSeeInviteCode ? member.competition.inviteCode : null,
                        isPublic: member.competition.isPublic,
                        isMember: true,
                        createdBy: member.competition.createdBy,
                        canSeeInviteCode,
                        startDate: member.competition.startDate.toISOString(),
                        endDate: member.competition.endDate.toISOString(),
                    };
                }),
                ...publicCompetitions.map((comp) => ({
                    id: comp.id,
                    name: comp.name,
                    type: comp.type,
                    season: comp.season,
                    memberCount: comp._count.members,
                    inviteCode: null,
                    isPublic: comp.isPublic,
                    isMember: false,
                    createdBy: comp.createdBy,
                    canSeeInviteCode: false,
                    startDate: comp.startDate.toISOString(),
                    endDate: comp.endDate.toISOString(),
                })),
            ];

            return NextResponse.json({
                competitions: allCompetitions,
            });
        }

        // Default: return user's joined competitions
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
