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

        // Pobranie konkurencji, w których użytkownik jest członkiem
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

        // Pobierz pełne dane użytkownika, aby sprawdzić rolę
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        // Pobranie wszystkich konkurencji z filtrami
        const allCompetitions = await prisma.competition.findMany({
            where: {
                OR: [
                    // Publiczne konkurencje
                    { isPublic: true },
                    // Konkurencje, w których użytkownik jest członkiem
                    { id: { in: Array.from(userCompetitionIds) } },
                    // Konkurencje stworzone przez ADMINA (jeśli jest admin)
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

        // Mapowanie danych
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
            // Pokazuj kod dołączenia jeśli użytkownik jest właścicielem lub członkiem
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