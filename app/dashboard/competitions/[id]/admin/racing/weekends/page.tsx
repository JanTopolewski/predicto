"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";

interface RacingWeekend {
    id: string;
    grandPrix: string;
    country: string;
    raceDate: string;
    sessions: RacingSession[];
}

interface RacingSession {
    id: string;
    type: string;
    name: string;
    startTime: string;
}

export default function RacingWeekendsPage() {
    const t = useTranslations("racing.admin.weekends");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    const [weekends, setWeekends] = useState<RacingWeekend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        grandPrix: "",
        country: "",
        raceDate: "",
    });

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    const fetchWeekends = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends`
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data) || t("loadError"));
                return;
            }

            const data = await response.json();
            setWeekends(data.weekends || []);
        } catch (err) {
            console.error(err);
            setError(t("loadError"));
        } finally {
            setLoading(false);
        }
    }, [competitionId, apiError, t]);

    useEffect(() => {
        void fetchWeekends();
    }, [fetchWeekends]);

    const handleCreateWeekend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.grandPrix || !formData.country || !formData.raceDate) {
            setError(apiError({ code: "MISSING_FIELDS", error: "Please fill in all required fields" }));
            return;
        }

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            const data = await response.json();
            setWeekends([...weekends, data.weekend]);
            setFormData({ grandPrix: "", country: "", raceDate: "" });
            setSuccess(t("weekendCreated"));
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            setError(apiError());
        }
    };

    const handleDeleteWeekend = async (weekendId: string) => {
        if (!confirm(t("deleteConfirm"))) return;

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends/${weekendId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            setWeekends(weekends.filter((w) => w.id !== weekendId));
        } catch (err) {
            console.error(err);
            setError(apiError());
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing`}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                    {tCommon("back")}
                </Link>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {success && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        ✓ {success}
                    </p>
                </div>
            )}

            {/* Create Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
                    {t("createTitle")}
                </h2>
                <form onSubmit={handleCreateWeekend} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder={t("grandPrixLabel")}
                            value={formData.grandPrix}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    grandPrix: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            placeholder={t("countryLabel")}
                            value={formData.country}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    country: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="datetime-local"
                            value={formData.raceDate}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    raceDate: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        {t("createButton")}
                    </button>
                </form>
            </div>

            {/* Weekends List */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : weekends.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("noWeekends")}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {weekends.map((weekend) => (
                        <div
                            key={weekend.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                        {weekend.grandPrix}
                                    </h3>
                                    <p className="text-zinc-600 dark:text-zinc-400">
                                        {weekend.country}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-500">
                                        {new Date(
                                            weekend.raceDate
                                        ).toLocaleDateString(locale, { timeZone: "Europe/Warsaw" })}
                                    </p>
                                </div>
                                <button
                                    onClick={() =>
                                        handleDeleteWeekend(weekend.id)
                                    }
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
                                >
                                    {t("deleteWeekend")}
                                </button>
                            </div>

                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                {tCommon("season")}: {weekend.sessions?.length || 0}
                            </p>

                            <Link
                                href={`/dashboard/competitions/${competitionId}/admin/racing/sessions/${weekend.id}`}
                                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm"
                            >
                                {t("manageSessions")}
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}