"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ChangePasswordPage() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setIsLoading(true);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError("Wszystkie pola są wymagane");
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError("Nowe hasło musi mieć co najmniej 8 znaków");
            setIsLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Nowe hasła nie są identyczne");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Błąd podczas zmiany hasła");
                setIsLoading(false);
                return;
            }

            setSuccessMessage("Hasło zostało pomyślnie zmienione!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setIsLoading(false);

            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);
        } catch (_err) {
            setError("Coś poszło nie tak. Spróbuj ponownie później.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 px-4 sm:px-6 py-8 sm:py-0">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-center text-zinc-900 dark:text-white mb-2">
                            Predicto
                        </h1>
                        <p className="text-center text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                            Zmień swoje hasło
                        </p>
                    </div>

                    {successMessage && (
                        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                ✓ {successMessage}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label
                                htmlFor="currentPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                Aktualne hasło
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="newPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                Nowe hasło
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                Powtórz nowe hasło
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                        >
                            {isLoading ? "Zapisywanie..." : "Zmień hasło"}
                        </button>
                    </form>

                    <div className="mt-4 sm:mt-6 text-center">
                        <Link
                            href="/dashboard"
                            className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                            ← Powrót do panelu
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}