import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {NextRequest, NextResponse} from "next/server";

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

        if (session.user?.id === userId) {
            return NextResponse.json(
                { message: "Nie możesz usunąć swojego konta" },
                { status: 400 }
            );
        }

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

        const body = await request.json();
        const { role, password } = body;
        const { id: userId } = await params;

        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return NextResponse.json(
                { message: "Użytkownik nie istnieje" },
                { status: 404 }
            );
        }

        const dataToUpdate: { role?: "USER" | "ADMIN"; passwordHash?: string } = {};

        if (role !== undefined) {
            if (!["USER", "ADMIN"].includes(role)) {
                return NextResponse.json(
                    { message: "Nieprawidłowa rola" },
                    { status: 400 }
                );
            }
            dataToUpdate.role = role;
        }

        if (password !== undefined) {
            if (typeof password !== "string" || password.trim().length < 8) {
                return NextResponse.json(
                    { message: "Nowe hasło musi mieć co najmniej 8 znaków" },
                    { status: 400 }
                );
            }

            const saltRounds = 10;
            dataToUpdate.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json(
                { message: "Brak danych do aktualizacji" },
                { status: 400 }
            );
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        const successMessage = password
            ? "Hasło użytkownika zostało zresetowane"
            : "Rola użytkownika została zaktualizowana";

        return NextResponse.json(
            { message: successMessage, user },
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