import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
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

        const competitionId = (await params).id;
        const { teamId } = await request.json();

        if (!teamId) {
            return NextResponse.json(
                { error: "Team ID is required" },
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

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: true,
            },
        });

        if (!competition || competition.type !== "FOOTBALL") {
            return NextResponse.json(
                { error: "Competition not found or is not a football competition" },
                { status: 404 }
            );
        }

        let footballSeason = competition.footballSeasons[0];
        if (!footballSeason) {
            footballSeason = await prisma.footballSeason.create({
                data: { competitionId },
            });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
        });

        if (!team) {
            return NextResponse.json(
                { error: "Team not found" },
                { status: 404 }
            );
        }

        const prediction =
            await prisma.footballSeasonWinnerPrediction.upsert({
                where: {
                    seasonId_userId: {
                        seasonId: footballSeason.id,
                        userId: session.user.id,
                    },
                },
                update: {
                    teamId,
                },
                create: {
                    seasonId: footballSeason.id,
                    userId: session.user.id,
                    teamId,
                },
                include: {
                    team: true,
                },
            });

        return NextResponse.json({ prediction }, { status: 201 });
    } catch (error) {
        console.error("Error creating season winner prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

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

        const competitionId = (await params).id;

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: {
                    include: {
                        seasonWinnerPredictions: {
                            where: { userId: session.user.id },
                            include: { team: true },
                        },
                    },
                },
            },
        });

        if (!competition) {
            return NextResponse.json(
                { error: "Competition not found" },
                { status: 404 }
            );
        }

        const prediction =
            competition.footballSeasons[0]?.seasonWinnerPredictions[0] || null;

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error("Error fetching season winner prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}