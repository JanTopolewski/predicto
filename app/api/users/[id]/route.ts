
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Brak dostępu do tego zasobu" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const userId = id;

        // Nie pozwól na usunięcie siebie
        if (session.user?.id === userId) {
            return NextResponse.json(
                { message: "Nie możesz usunąć swojego konta" },
                { status: 400 }
            );
        }

        // Usuń użytkownika
        await prisma.user.delete({
            where: { id: userId },
        });

        return NextResponse.json(
            { message: "Użytkownik został usunięty" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Delete user error:", error);
        return NextResponse.json(
            { message: "Błąd serwera" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { message: "Brak dostępu do tego zasobu" },
                { status: 403 }
            );
        }

        const { role } = await request.json();
        const { id } = await params;
        const userId = id;

        if (!["USER", "ADMIN"].includes(role)) {
            return NextResponse.json(
                { message: "Nieprawidłowa rola" },
                { status: 400 }
            );
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        return NextResponse.json(
            { message: "Rola użytkownika została zaktualizowana", user },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update user error:", error);
        return NextResponse.json(
            { message: "Błąd serwera" },
            { status: 500 }
        );
    }
}