import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { id } = await params;
        const competitionId = id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
        });

        if (!competition) {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        if (!competition.isPublic) {
            return apiError(
                403,
                "PRIVATE_COMPETITION",
                "This competition is private. An invite code is required."
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
            return apiError(409, "ALREADY_MEMBER", "You are already a member of this competition");
        }

        await prisma.competitionMember.create({
            data: {
                competitionId,
                userId: session.user.id,
                points: 0,
            },
        });

        return NextResponse.json(
            { message: "Successfully joined the competition" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error joining competition:", error);
        return internalError();
    }
}

