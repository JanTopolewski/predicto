"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { TrophyIcon } from "@/components/Icons";

interface Team {
    id: string;
    name: string;
}

interface CompetitionDetail {
    id: string;
    name: string;
    type: string;
    allTeams: Team[];
}

export default function AnnounceWinnerPage() {
    const t = useTranslations("matches.admin.announceWinner");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const params = useParams();
    const router = useRouter();
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [announcing, setAnnouncing] = useState(false);

    const competitionId = params.id as string;

    useEffect(() => {
        const fetchCompetition = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/competitions/${competitionId}`);

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    setError(apiError(data) || t("loadError"));
                    return;
                }

                const data = await response.json();
                setCompetition(data.competition);
            } catch (err) {
                console.error(err);
                setError(t("loadError"));
            } finally {
                setLoading(false);
            }
        };

        void fetchCompetition();
    }, [competitionId, apiError, t]);

    const handleAnnounceWinner = async () => {
        if (!selectedTeamId) {
            setError(t("selectTeamError"));
            return;
        }

        setError("");
        setAnnouncing(true);

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/football/season-winner`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ winningTeamId: selectedTeamId }),
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setAnnouncing(false);
                return;
            }

            setTimeout(() => {
                router.push(`/dashboard/competitions/${competitionId}`);
            }, 1000);
        } catch (err) {
            console.error(err);
            setError(apiError());
            setAnnouncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-600 dark:text-zinc-400">{tCommon("loading")}</p>
            </div>
        );
    }

    if (error && !competition) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error}
                    </p>
                </div>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                    {tCommon("back")}
                </Link>
            </div>
        );
    }

    if (!competition) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrophyIcon className="w-7 h-7 text-amber-500" />
                            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                                {t("title")}
                            </h2>
                        </div>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            {competition.name}
                        </p>
                    </div>
                    <Link
                        href={`/dashboard/competitions/${competitionId}`}
                        className="px-4 sm:px-6 py-2.5 sm:py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base"
                    >
                        {tCommon("back")}
                    </Link>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                    {t("selectPrompt")}
                </h3>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                        {t("teamLabel")}
                    </label>
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        disabled={announcing}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">{t("selectPlaceholder")}</option>
                        {competition.allTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleAnnounceWinner}
                    disabled={announcing || !selectedTeamId}
                    className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {announcing ? t("submitting") : t("submit")}
                </button>
            </div>
        </div>
    );
}