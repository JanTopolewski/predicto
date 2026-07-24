import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { username, email, password } = await request.json();

        if (!username || !email || !password) {
            return NextResponse.json(
                { message: "Wszystkie pola są wymagane" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { message: "Hasło musi mieć co najmniej 8 znaków" },
                { status: 400 }
            );
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            return NextResponse.json(
                {
                    message:
                        existingUser.email === email
                            ? "Email już jest zarejestrowany"
                            : "Nazwa użytkownika jest już zajęta",
                },
                { status: 409 }
            );
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                role: "USER",
            },
        });

        return NextResponse.json(
            {
                message: "Rejestracja powiodła się",
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { message: "Błąd serwera" },
            { status: 500 }
        );
    }
}