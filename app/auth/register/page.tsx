"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useApiError } from "@/lib/useApiError";
import { Locale } from "@/i18n/config";

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const t = useTranslations("auth.register");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("apiErrors");
    const apiError = useApiError();
    const locale = useLocale() as Locale;

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (!username || !email || !password || !confirmPassword) {
                setError(tErrors("MISSING_FIELDS"));
                return;
            }

            if (password !== confirmPassword) {
                setError(t("passwordMismatch"));
                return;
            }

            if (password.length < 8) {
                setError(t("passwordTooShort"));
                return;
            }

            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                return;
            }

            router.push("/auth/login?registered=true");
        } catch (_err) {
            setError(apiError());
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 px-4 sm:px-6 py-8 sm:py-0">
            <div className="w-full max-w-md">
                <div className="flex justify-end mb-4">
                    <LanguageSwitcher currentLocale={locale} />
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-center text-zinc-900 dark:text-white mb-2">
                            {tCommon("appName")}
                        </h1>
                        <p className="text-center text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                            {t("title")}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("usernameLabel")}
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder={t("usernamePlaceholder")}
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="email"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("emailLabel")}
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder={t("emailPlaceholder")}
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("passwordLabel")}
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                                {t("confirmPasswordLabel")}
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
                            {isLoading ? t("submittingButton") : t("submitButton")}
                        </button>
                    </form>

                    <div className="mt-4 sm:mt-6 text-center">
                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                            {t("haveAccount")}{" "}
                            <Link
                                href="/auth/login"
                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {t("loginLink")}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}