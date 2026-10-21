import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError } from "@/lib/api";

export async function POST(request: NextRequest) {
    try {
        const { username, email, password, acceptTerms } = await request.json();

        if (!acceptTerms) {
            return apiError(400, "TERMS_NOT_ACCEPTED", "You must accept the terms of service and privacy policy");
        }

        if (!username || !email || !password) {
            return apiError(400, "MISSING_FIELDS", "All fields are required");
        }

        if (
            typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return apiError(400, "VALIDATION_FAILED", "Invalid data format");
        }

        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return apiError(400, "VALIDATION_FAILED", "Invalid email format");
        }

        if (!normalizedUsername || !normalizedEmail) {
            return apiError(400, "MISSING_FIELDS", "All fields are required");
        }

        if (password.length < 8) {
            return apiError(400, "PASSWORD_TOO_SHORT", "Password must be at least 8 characters long");
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: normalizedEmail, mode: "insensitive" } },
                    { username: normalizedUsername },
                ],
            },
        });

        if (existingUser) {
            const isEmail = existingUser.email.toLowerCase() === normalizedEmail;
            return apiError(
                409,
                isEmail ? "EMAIL_TAKEN" : "USERNAME_TAKEN",
                isEmail ? "Email is already taken" : "Username is already taken"
            );
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = await prisma.user.create({
            data: {
                username: normalizedUsername,
                email: normalizedEmail,
                passwordHash,
                role: "USER",
            },
        });

        return NextResponse.json(
            {
                message: "Registration successful",
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        if (error?.code === "P2002") {
            return apiError(409, "USER_EXISTS", "Email or username is already taken");
        }
        console.error("Registration error:", error);
        return internalError();
    }
}