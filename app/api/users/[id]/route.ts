import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { apiError, forbidden, internalError } from "@/lib/api";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return forbidden();
        }

        const { id } = await params;
        const userId = id;
        const isSelf = session.user.id === userId;
        const isAdmin = session.user.role === "ADMIN";

        if (!isSelf && !isAdmin) {
            return forbidden();
        }

        // If a user deletes their own account, verify their current password
        if (isSelf) {
            let password = "";
            try {
                const body = await request.json();
                password = body?.password || "";
            } catch {
                // empty body
            }

            if (!password) {
                return apiError(400, "MISSING_FIELDS", "Password is required to delete your account");
            }

            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!currentUser) {
                return apiError(404, "USER_NOT_FOUND", "User not found");
            }

            const passwordMatch = await bcrypt.compare(password, currentUser.passwordHash);
            if (!passwordMatch) {
                return apiError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
            }
        }

        // Atomically reassign user's created competitions to "SYSTEM" and delete the user
        await prisma.$transaction([
            prisma.competition.updateMany({
                where: { createdBy: userId },
                data: { createdBy: "SYSTEM" },
            }),
            prisma.user.delete({
                where: { id: userId },
            }),
        ]);

        return NextResponse.json(
            { message: "User deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Delete user error:", error);
        return internalError();
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session || session.user?.role !== "ADMIN") {
            return forbidden();
        }

        const body = await request.json();
        const { role, password } = body;
        const { id: userId } = await params;

        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            return apiError(404, "USER_NOT_FOUND", "User not found");
        }

        const dataToUpdate: { role?: "USER" | "ADMIN"; passwordHash?: string } = {};

        if (role !== undefined) {
            if (!["USER", "ADMIN"].includes(role)) {
                return apiError(400, "INVALID_ROLE", "Invalid role");
            }

            if (session.user?.id === userId && role === "USER") {
                return apiError(400, "CANNOT_DEMOTE_SELF", "You cannot remove admin rights from yourself");
            }

            dataToUpdate.role = role;
        }

        if (password !== undefined) {
            if (typeof password !== "string" || password.trim().length < 8) {
                return apiError(400, "PASSWORD_TOO_SHORT", "New password must be at least 8 characters long");
            }

            const saltRounds = 10;
            dataToUpdate.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        if (Object.keys(dataToUpdate).length === 0) {
            return apiError(400, "MISSING_FIELDS", "No data provided for update");
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
            ? "User password reset successfully"
            : "User role updated successfully";

        return NextResponse.json(
            { message: successMessage, user },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update user error:", error);
        return internalError();
    }
}