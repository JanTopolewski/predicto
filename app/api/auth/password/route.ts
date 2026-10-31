import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized, internalError } from "@/lib/api";

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return apiError(400, "MISSING_FIELDS", "All fields are required");
        }

        if (newPassword.length < 8) {
            return apiError(400, "PASSWORD_TOO_SHORT", "New password must be at least 8 characters long");
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return apiError(404, "USER_NOT_FOUND", "User not found");
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!isCurrentPasswordValid) {
            return apiError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
        }

        const isSamePassword = await bcrypt.compare(
            newPassword,
            user.passwordHash
        );

        if (isSamePassword) {
            return apiError(400, "PASSWORD_SAME_AS_OLD", "New password must be different from current password");
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
            { message: "Password changed successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Change password error:", error);
        return internalError();
    }
}

