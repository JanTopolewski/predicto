import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { apiError, forbidden, internalError } from "@/lib/api";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session || session.user?.role !== "ADMIN") {
            return forbidden();
        }

        const { id } = await params;
        const userId = id;

        if (session.user?.id === userId) {
            return apiError(400, "CANNOT_DELETE_SELF", "You cannot delete your own account");
        }

        await prisma.user.delete({
            where: { id: userId },
        });

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