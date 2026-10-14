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

        if (competition.winnerResolved) {
            return NextResponse.json(
                { error: "Zwycięzca sezonu został już ogłoszony. Głosowanie jest zamknięte." },
                { status: 400 }
            );
        }

        let footballSeason = competition.footballSeasons[0];
        if (!footballSeason) {
            footballSeason = await prisma.footballSeason.create({
                data: { competitionId },
            });
        }

        const earliestMatch = await prisma.footballMatch.findFirst({
            where: { seasonId: footballSeason.id },
            orderBy: { kickoff: "asc" },
        });

        if (earliestMatch && new Date() >= new Date(earliestMatch.kickoff)) {
            return NextResponse.json(
                { error: "Pierwszy mecz sezonu już się rozpoczął. Nie można już typować zwycięzcy." },
                { status: 400 }
            );
        }

        const existingPrediction =
            await prisma.footballSeasonWinnerPrediction.findUnique({
                where: {
                    seasonId_userId: {
                        seasonId: footballSeason.id,
                        userId: session.user.id,
                    },
                },
            });

        if (existingPrediction) {
            return NextResponse.json(
                { error: "Już oddałeś głos na zwycięzcę sezonu. Nie można zmienić typu." },
                { status: 400 }
            );
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

        const isTeamInSeason = await prisma.footballMatch.findFirst({
            where: {
                seasonId: footballSeason.id,
                OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            },
        });

        if (!isTeamInSeason) {
            return NextResponse.json(
                { error: "Wybrana drużyna nie bierze udziału w rozgrywkach tego sezonu" },
                { status: 400 }
            );
        }

        const prediction =
            await prisma.footballSeasonWinnerPrediction.create({
                data: {
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