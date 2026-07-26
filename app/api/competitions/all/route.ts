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

        const userCompetitions = await prisma.competitionMember.findMany({
            where: {
                userId: session.user.id,
            },
            select: {
                competitionId: true,
            },
        });

        const userCompetitionIds = new Set(
            userCompetitions.map((m) => m.competitionId)
        );

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        const allCompetitions = await prisma.competition.findMany({
            where: {
                OR: [
                    { isPublic: true },
                    { id: { in: Array.from(userCompetitionIds) } },
                    ...(user?.role === "ADMIN" ? [{ createdBy: session.user.id }] : []),
                ],
            },
            select: {
                id: true,
                name: true,
                type: true,
                season: true,
                inviteCode: true,
                isPublic: true,
                createdBy: true,
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
        });

        const competitions = allCompetitions.map((comp) => ({
            id: comp.id,
            name: comp.name,
            type: comp.type,
            season: comp.season,
            inviteCode: comp.inviteCode,
            isPublic: comp.isPublic,
            createdBy: comp.createdBy,
            memberCount: comp._count.members,
            isMember: userCompetitionIds.has(comp.id),
            canSeeInviteCode: userCompetitionIds.has(comp.id) || comp.createdBy === session.user.id,
        }));

        return NextResponse.json({
            competitions,
        });
    } catch (error) {
        console.error("Error fetching all competitions:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}