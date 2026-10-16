import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const competitionId = (await params).id;
        const { teamId } = await request.json();

        if (!teamId) {
            return apiError(400, "MISSING_FIELDS", "Team ID is required");
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
            return apiError(403, "NOT_A_MEMBER", "You are not a member of this competition");
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                footballSeasons: true,
            },
        });

        if (!competition || competition.type !== "FOOTBALL") {
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found or is not a football competition");
        }

        if (competition.winnerResolved) {
            return apiError(
                400,
                "WINNER_ALREADY_RESOLVED",
                "Season winner has already been announced. Voting is closed."
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
            return apiError(
                400,
                "SEASON_ALREADY_STARTED",
                "First match of the season has already started. Season winner prediction is closed."
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
            return apiError(
                400,
                "ALREADY_VOTED",
                "You have already voted for the season winner. Predictions cannot be changed."
            );
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
        });

        if (!team) {
            return apiError(404, "TEAM_NOT_FOUND", "Team not found");
        }

        const isTeamInSeason = await prisma.footballMatch.findFirst({
            where: {
                seasonId: footballSeason.id,
                OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            },
        });

        if (!isTeamInSeason) {
            return apiError(
                400,
                "TEAM_NOT_IN_SEASON",
                "Selected team does not participate in this season's matches"
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
        return internalError();
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
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
            return apiError(404, "COMPETITION_NOT_FOUND", "Competition not found");
        }

        const prediction =
            competition.footballSeasons[0]?.seasonWinnerPredictions[0] || null;

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error("Error fetching season winner prediction:", error);
        return internalError();
    }
}