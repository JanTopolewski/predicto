"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const { data: session } = useSession();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push("/auth/login");
    };

    const isAdmin = session?.user?.role === "ADMIN";

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
            {/* Header Navigation */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                                Predicto
                            </h1>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex items-center gap-8">
                            <Link
                                href="/dashboard"
                                className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                            >
                                Dashboard
                            </Link>

                            {isAdmin && (
                                <Link
                                    href="/dashboard/users"
                                    className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                                >
                                    Zarządzanie użytkownikami
                                </Link>
                            )}

                            {/* User Info & Logout */}
                            <div className="flex items-center gap-4 pl-4 border-l border-zinc-200 dark:border-zinc-800">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {session?.user?.name}
                                    </p>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {isAdmin ? "Administrator" : "Użytkownik"}
                                    </p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                                >
                                    Wyloguj się
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}