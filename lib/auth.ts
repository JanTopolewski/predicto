import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    const normalizedEmail = String(credentials.email).trim().toLowerCase();
                    const user = await prisma.user.findUnique({
                        where: { email: normalizedEmail },
                    });

                    if (!user) {
                        return null;
                    }

                    const passwordMatch = await bcrypt.compare(
                        String(credentials.password),
                        user.passwordHash
                    );

                    if (!passwordMatch) {
                        return null;
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.username,
                    };
                } catch (error) {
                    console.error("[Auth] Authorize error:", error);
                    return null;
                }
            },
        }),
    ],
    pages: {
        signIn: "/auth/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 2 * 24 * 60 * 60, // 2 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;

                // Pobierz rolę z bazy danych
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true },
                });
                token.role = dbUser?.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.role = token.role as string;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
    trustHost: true,
});