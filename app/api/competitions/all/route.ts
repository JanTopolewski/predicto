import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

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
            ...competitionMembers.map((member) => ({
                id: member.competition.id,
                name: member.competition.name,
                type: member.competition.type,
                season: member.competition.season,
                points: member.points,
                memberCount: member.competition._count.members,
                inviteCode: member.competition.inviteCode,
                isPublic: member.competition.isPublic,
                isMember: true,
                createdBy: member.competition.createdBy,
                canSeeInviteCode: false,
                startDate: member.competition.startDate.toISOString(),
                endDate: member.competition.endDate.toISOString(),
            })),
            ...publicCompetitions.map((comp) => ({
                id: comp.id,
                name: comp.name,
                type: comp.type,
                season: comp.season,
                memberCount: comp._count.members,
                inviteCode: comp.inviteCode,
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
    } catch (error) {
        console.error("Error fetching competitions:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}