import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Unwrap params - to jest Promise
        const { id: competitionId } = await params;

        // Pobranie konkurencji ze wszystkimi członkami i ich punktami
        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                },
            },
        });

        if (!competition) {
            return NextResponse.json(
                { message: "Konkurencja nie istnieje" },
                { status: 404 }
            );
        }

        // Mapowanie danych
        const competitionData = {
            id: competition.id,
            name: competition.name,
            type: competition.type,
            season: competition.season,
            startDate: competition.startDate,
            endDate: competition.endDate,
            members: competition.members.map((member) => ({
                id: member.user.id,
                username: member.user.username,
                points: member.points,
            })),
        };

        return NextResponse.json({
            competition: competitionData,
        });
    } catch (error) {
        console.error("Error fetching competition:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}