import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { inviteCode } = await request.json();

        if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
            return apiError(400, "MISSING_INVITE_CODE", "Invite code is required");
        }

        const competition = await prisma.competition.findUnique({
            where: { inviteCode: inviteCode.trim().toUpperCase() },
        });

        if (!competition) {
            return apiError(404, "INVALID_INVITE_CODE", "Invalid invite code");
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
            return apiError(409, "ALREADY_MEMBER", "You are already a member of this competition");
        }

        await prisma.competitionMember.create({
            data: {
                competitionId: competition.id,
                userId: session.user.id,
                points: 0,
            },
        });

        return NextResponse.json(
            { message: "Successfully joined the competition" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error joining competition by code:", error);
        return internalError();
    }
}

