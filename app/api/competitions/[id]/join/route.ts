import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

        const { id } = await params;
        const competitionId = id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
        });

        if (!competition) {
            return NextResponse.json(
                { message: "Konkurencja nie istnieje" },
                { status: 404 }
            );
        }

        if (!competition.isPublic) {
            return NextResponse.json(
                { message: "Ta liga jest prywatna. Wymagany jest kod zaproszenia." },
                { status: 403 }
            );
        }

        const existingMember = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId: session.user.id,
                },
            },
        });

        if (existingMember) {
            return NextResponse.json(
                { message: "Już jesteś członkiem tej konkurencji" },
                { status: 409 }
            );
        }

        await prisma.competitionMember.create({
            data: {
                competitionId,
                userId: session.user.id,
                points: 0,
            },
        });

        return NextResponse.json(
            { message: "Pomyślnie dołączyłeś do konkurencji" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error joining competition:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}