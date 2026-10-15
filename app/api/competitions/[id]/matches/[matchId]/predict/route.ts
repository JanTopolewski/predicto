import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTimePassed } from "@/lib/timeUtils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string; matchId: string }>;
    }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { id: competitionId, matchId } = await params;
        const { homeGoals, awayGoals } = await request.json();

        if (homeGoals === undefined || awayGoals === undefined) {
            return NextResponse.json(
                { error: "Missing prediction data" },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(homeGoals) ||
            !Number.isInteger(awayGoals) ||
            homeGoals < 0 ||
            homeGoals > 20 ||
            awayGoals < 0 ||
            awayGoals > 20
        ) {
            return NextResponse.json(
                { error: "Incorrect goal numbers" },
                { status: 400 }
            );
        }

        const member = await prisma.competitionMember.findUnique({
            where: {
                competitionId_userId: {
                    competitionId,
                    userId: session.user.id,
                },
            },
        });

        if (!member) {
            return NextResponse.json(
                { error: "You are not a member of this competition" },
                { status: 403 }
            );
        }

        const match = await prisma.footballMatch.findUnique({
            where: { id: matchId },
            include: {
                season: true,
            },
        });

        if (!match || match.season.competitionId !== competitionId) {
            return NextResponse.json(
                { error: "Match not found" },
                { status: 404 }
            );
        }

        if (match.resolved) {
            return NextResponse.json(
                { error: "Match has already been resolved" },
                { status: 400 }
            );
        }

        if (match.status !== "SCHEDULED") {
            return NextResponse.json(
                { error: `Cannot predict a match with status ${match.status}` },
                { status: 400 }
            );
        }

        if (match.votingClosedAt && isTimePassed(match.votingClosedAt)) {
            return NextResponse.json(
                { error: "Voting for this match is closed" },
                { status: 400 }
            );
        }

        if (match.kickoff && isTimePassed(match.kickoff)) {
            return NextResponse.json(
                { error: "Match has already started" },
                { status: 400 }
            );
        }

        const prediction = await prisma.footballPrediction.upsert({
            where: {
                matchId_userId: {
                    matchId,
                    userId: session.user.id,
                },
            },
            update: {
                homeGoals,
                awayGoals,
            },
            create: {
                matchId,
                userId: session.user.id,
                homeGoals,
                awayGoals,
            },
        });

        return NextResponse.json({ prediction }, { status: 201 });
    } catch (error) {
        console.error("Error creating prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}