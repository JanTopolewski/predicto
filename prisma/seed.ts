import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim();

    if (!adminEmail || !adminPassword || !adminUsername) {
        console.log(
            "Skipping initial admin seed. Missing required environment variables: INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_USERNAME."
        );
        return;
    }

    if (adminPassword.length < 8) {
        throw new Error("Admin seed error: INITIAL_ADMIN_PASSWORD must be at least 8 characters long.");
    }

    // Check if user with matching email or username already exists
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: adminEmail, mode: "insensitive" } },
                { username: adminUsername },
            ],
        },
    });

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    if (existingUser) {
        console.log(`User "${existingUser.username}" (${existingUser.email}) already exists. Updating role to ADMIN...`);
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                role: "ADMIN",
                passwordHash,
            },
        });
        console.log(`User ${existingUser.email} successfully updated to ADMIN.`);
    } else {
        console.log(`Creating initial admin user: ${adminUsername} (${adminEmail})...`);
        await prisma.user.create({
            data: {
                username: adminUsername,
                email: adminEmail,
                passwordHash,
                role: "ADMIN",
            },
        });
        console.log(`Admin user ${adminEmail} created successfully.`);
    }
}

main()
    .catch((error) => {
        console.error("Error executing admin seed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
