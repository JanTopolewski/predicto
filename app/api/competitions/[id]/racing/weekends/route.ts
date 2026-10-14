import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const competitionId = (await params).id;

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: {
                racingSeasons: {
                    include: {
                        weekends: {
                            include: {
                                sessions: {
                                    orderBy: { startTime: "asc" },
                                    include: {
                                        participants: {
                                            include: { driver: true },
                                        },
                                        predictions: {
                                            where: {
                                                userId: session.user.id,
                                            },
                                        },
                                        wildcards: {
                                            include: { driver: true },
                                        },
                                    },
                                },
                            },
                            orderBy: { raceDate: "asc" },
                        },
                    },
                },
            },
        });

        if (!competition || competition.type !== "RACING") {
            return NextResponse.json(
                { error: "Competition not found or is not a racing competition" },
                { status: 404 }
            );
        }

        // Allow if user is admin of this competition OR member
        const isAdmin = session.user.role === "ADMIN" && competition.createdBy === session.user.id;

        if (!isAdmin) {
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
        }

        const season = competition.racingSeasons[0];
        const weekends = season?.weekends || [];

        return NextResponse.json({ weekends });
    } catch (error) {
        console.error("Error fetching weekends:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only admins can create weekends" },
                { status: 403 }
            );
        }

        const competitionId = (await params).id;
        const { grandPrix, country, raceDate } = await request.json();

        if (!grandPrix || !country || !raceDate) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: { racingSeasons: true },
        });

        if (!competition || competition.type !== "RACING") {
            return NextResponse.json(
                { error: "Competition not found or is not a racing competition" },
                { status: 404 }
            );
        }

        if (competition.createdBy !== session.user.id) {
            return NextResponse.json(
                { error: "Only competition creator can create weekends" },
                { status: 403 }
            );
        }

        let racingSeason = competition.racingSeasons[0];
        if (!racingSeason) {
            racingSeason = await prisma.racingSeason.create({
                data: { competitionId },
            });
        }

        const weekend = await prisma.racingWeekend.create({
            data: {
                seasonId: racingSeason.id,
                grandPrix,
                country,
                raceDate: new Date(raceDate),
            },
            include: {
                sessions: true,
            },
        });

        return NextResponse.json({ weekend }, { status: 201 });
    } catch (error) {
        console.error("Error creating weekend:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}