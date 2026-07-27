"use client";

import React, { useState } from "react";
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push("/auth/login");
    };

    const isAdmin = session?.user?.role === "ADMIN";

    const navLinks = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard/competitions", label: "Konkurencje" },
        ...(isAdmin ? [
            { href: "/dashboard/users", label: "Zarządzanie użytkownikami" },
            { href: "/dashboard/teams", label: "Zarządzanie drużynami" },
        ] : []),
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
            {/* Header Navigation */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                                Predicto
                            </h1>
                        </div>

                        {/* Desktop Navigation Links */}
                        <div className="hidden md:flex items-center gap-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}

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

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Mobile Navigation Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 py-4 space-y-3">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ))}

                            {/* Mobile User Info */}
                            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {session?.user?.name}
                                    </p>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {isAdmin ? "Administrator" : "Użytkownik"}
                                    </p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
                                >
                                    Wyloguj się
                                </button>
                            </div>
                        </div>
                    )}
                </nav>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {children}
            </main>
        </div>
    );
}