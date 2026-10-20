"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";

export default function CreateTeamPage() {
    const t = useTranslations("teams.createTeam");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [name, setName] = useState("");
    const [shortName, setShortName] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (!name || !shortName) {
                setError(t("fieldsRequired"));
                setIsLoading(false);
                return;
            }

            if (shortName.length > 3) {
                setError(t("shortNameLength"));
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    shortName: shortName.toUpperCase(),
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setIsLoading(false);
                return;
            }

            router.push("/dashboard/teams");
        } catch (err) {
            console.error(err);
            setError(apiError());
            setIsLoading(false);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    {t("subtitle")}
                </p>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("nameLabel")}
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("namePlaceholder")}
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="shortName"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("shortNameLabel")}
                        </label>
                        <input
                            id="shortName"
                            type="text"
                            maxLength={3}
                            value={shortName}
                            onChange={(e) => setShortName(e.target.value)}
                            placeholder={t("shortNamePlaceholder")}
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors uppercase"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {t("shortNameHelp")}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <Link
                            href="/dashboard/teams"
                            className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center"
                        >
                            {tCommon("cancel")}
                        </Link>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? t("submitting") : t("submit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}