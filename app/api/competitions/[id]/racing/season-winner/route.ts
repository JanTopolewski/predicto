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
        const { driverId } = await request.json();

        if (!driverId) {
            return NextResponse.json(
                { error: "Driver ID is required" },
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
                racingSeasons: true,
            },
        });

        if (!competition || competition.type !== "RACING") {
            return NextResponse.json(
                { error: "Competition not found or is not a racing competition" },
                { status: 404 }
            );
        }

        if (competition.winnerResolved) {
            return NextResponse.json(
                { error: "Zwycięzca sezonu został już ogłoszony. Głosowanie jest zamknięte." },
                { status: 400 }
            );
        }

        let racingSeason = competition.racingSeasons[0];
        if (!racingSeason) {
            racingSeason = await prisma.racingSeason.create({
                data: { competitionId },
            });
        }

        const earliestSession = await prisma.racingSession.findFirst({
            where: {
                weekend: {
                    seasonId: racingSeason.id,
                },
            },
            orderBy: {
                startTime: "asc",
            },
        });
        if (earliestSession && new Date() >= new Date(earliestSession.startTime)) {
            return NextResponse.json(
                { error: "Pierwsza sesja sezonu już się rozpoczęła. Nie można już typować zwycięzcy." },
                { status: 400 }
            );
        }

        const existingPrediction = await prisma.racingSeasonWinnerPrediction.findUnique({
            where: {
                seasonId_userId: {
                    seasonId: racingSeason.id,
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

        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
        });

        if (!driver) {
            return NextResponse.json(
                { error: "Driver not found" },
                { status: 404 }
            );
        }

        const prediction =
            await prisma.racingSeasonWinnerPrediction.create({
                data: {
                    seasonId: racingSeason.id,
                    userId: session.user.id,
                    driverId,
                },
                include: {
                    driver: true,
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
                racingSeasons: {
                    include: {
                        seasonWinnerPredictions: {
                            where: { userId: session.user.id },
                            include: { driver: true },
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
            competition.racingSeasons[0]?.seasonWinnerPredictions[0] || null;

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error("Error fetching season winner prediction:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}