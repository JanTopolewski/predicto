import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Brak dostępu do tego zasobu" },
                { status: 403 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const rawPage = parseInt(searchParams.get("page") || "1", 10);
        const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

        const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
        const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(100, rawLimit);

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    createdAt: true,
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma.user.count(),
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json(
            {
                users,
                total,
                page,
                limit,
                totalPages,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get users error:", error);
        return NextResponse.json(
            { message: "Błąd serwera" },
            { status: 500 }
        );
    }
}