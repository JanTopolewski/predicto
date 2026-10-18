"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { GlobeIcon, LockIcon } from "@/components/Icons";

export default function CreateCompetitionPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [name, setName] = useState("");
    const [type, setType] = useState("FOOTBALL");
    const [season, setSeason] = useState(new Date().getFullYear().toString());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const t = useTranslations("competitions.create");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("apiErrors");
    const apiError = useApiError();

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
            if (!name || !startDate || !endDate) {
                setError(tErrors("MISSING_FIELDS"));
                setIsLoading(false);
                return;
            }

            if (new Date(startDate) >= new Date(endDate)) {
                setError(tErrors("END_DATE_BEFORE_START"));
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/competitions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    type,
                    season,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    isPublic,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setIsLoading(false);
                return;
            }

            router.push("/dashboard/competitions");
        } catch (err) {
            setError(apiError());
            console.error(err);
            setIsLoading(false);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h2>
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
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder={t("namePlaceholder")}
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="type"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("typeLabel")}
                        </label>
                        <select
                            id="type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            disabled={isLoading}
                        >
                            <option value="FOOTBALL">{tCommon("football")}</option>
                            <option value="RACING">{tCommon("racing")}</option>
                        </select>
                    </div>

                    <div>
                        <label
                            htmlFor="season"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("seasonLabel")}
                        </label>
                        <input
                            id="season"
                            type="text"
                            value={season}
                            onChange={(e) => setSeason(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="2026/2027"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="startDate"
                                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("startDateLabel")}
                            </label>
                            <input
                                id="startDate"
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="endDate"
                                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("endDateLabel")}
                            </label>
                            <input
                                id="endDate"
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <input
                            id="isPublic"
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                            disabled={isLoading}
                        />
                        <label
                            htmlFor="isPublic"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                            {isPublic ? (
                                <>
                                    <GlobeIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span>{t("publicOption")}</span>
                                </>
                            ) : (
                                <>
                                    <LockIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    <span>{t("privateOption")}</span>
                                </>
                            )}
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? t("submittingButton") : t("submitButton")}
                        </button>
                        <Link
                            href="/dashboard/competitions"
                            className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center"
                        >
                            {tCommon("cancel")}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}