import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { inviteCode } = await request.json();

        if (!inviteCode) {
            return NextResponse.json(
                { message: "Kod dostępu jest wymagany" },
                { status: 400 }
            );
        }

        const competition = await prisma.competition.findUnique({
            where: { inviteCode: inviteCode.toUpperCase() },
        });

        if (!competition) {
            return NextResponse.json(
                { message: "Kod dostępu jest nieprawidłowy" },
                { status: 404 }
            );
        }

        const existingMember = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId: competition.id,
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
                competitionId: competition.id,
                userId: session.user.id,
                points: 0,
            },
        });

        return NextResponse.json(
            { message: "Pomyślnie dołączyłeś do konkurencji" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error joining competition by code:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}