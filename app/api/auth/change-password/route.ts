import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { message: "Brak autoryzacji" },
                { status: 401 }
            );
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { message: "Wszystkie pola są wymagane" },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { message: "Nowe hasło musi mieć co najmniej 8 znaków" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json(
                { message: "Użytkownik nie istnieje" },
                { status: 404 }
            );
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!isCurrentPasswordValid) {
            return NextResponse.json(
                { message: "Aktualne hasło jest niepoprawne" },
                { status: 400 }
            );
        }

        const isSamePassword = await bcrypt.compare(
            newPassword,
            user.passwordHash
        );

        if (isSamePassword) {
            return NextResponse.json(
                { message: "Nowe hasło musi być inne niż aktualne" },
                { status: 400 }
            );
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
            },
        });

        return NextResponse.json(
            { message: "Hasło zostało pomyślnie zmienione" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Change password error:", error);
        return NextResponse.json(
            { message: "Błąd serwera podczas zmiany hasła" },
            { status: 500 }
        );
    }
}