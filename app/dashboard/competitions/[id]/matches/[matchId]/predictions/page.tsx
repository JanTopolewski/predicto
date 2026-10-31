"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Locale } from "@/i18n/config";
import { CheckIcon, AlertTriangleIcon } from "@/components/Icons";

interface Team {
    id: string;
    name: string;
    shortName: string;
}

interface MatchInfo {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    homeGoals: number | null;
    awayGoals: number | null;
    kickoff: string;
    resolved: boolean;
    status: string;
}

interface MemberPredictionItem {
    user: {
        id: string;
        username: string;
    };
    prediction: {
        id: string;
        homeGoals: number;
        awayGoals: number;
        points: number;
        createdAt: string;
    } | null;
}

export default function MatchPredictionsPage() {
    const { data: session, status } = useSession();
    const params = useParams();
    const competitionId = params.id as string;
    const matchId = params.matchId as string;

    const [match, setMatch] = useState<MatchInfo | null>(null);
    const [predictions, setPredictions] = useState<MemberPredictionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const t = useTranslations("matches");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const locale = useLocale() as Locale;

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await fetch(
                    `/api/competitions/${competitionId}/matches/${matchId}/predictions?scope=all`
                );
                const data = await res.json();

                if (!res.ok) {
                    setError(apiError(data));
                    return;
                }

                setMatch(data.match);
                setPredictions(data.predictions || []);
            } catch (err) {
                console.error(err);
                setError(apiError());
            } finally {
                setLoading(false);
            }
        };

        if (status === "authenticated") {
            void fetchPredictions();
        }
    }, [competitionId, matchId, status, apiError]);

    if (status !== "authenticated" || !session?.user?.id) {
        return null;
    }

    const isAdmin = session?.user?.role === "ADMIN";
    const backHref = isAdmin
        ? `/dashboard/competitions/${competitionId}/admin/matches`
        : `/dashboard/competitions/${competitionId}/matches`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                        {t("allPredictionsTitle")}
                    </h1>
                    {match && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {match.homeTeam.name} vs {match.awayTeam.name} •{" "}
                            {new Date(match.kickoff).toLocaleString(locale)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={backHref}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {tCommon("back")}
                    </Link>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : match ? (
                <div className="space-y-6">
                    {/* Match Score Banner */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 text-center">
                        <div className="flex items-center justify-center gap-6">
                            <div className="flex-1 text-right">
                                <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                                    {match.homeTeam.name}
                                </span>
                            </div>
                            <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 min-w-[90px]">
                                {match.resolved ? (
                                    <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white font-mono">
                                        {match.homeGoals} : {match.awayGoals}
                                    </span>
                                ) : (
                                    <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                                        vs
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 text-left">
                                <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                                    {match.awayTeam.name}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Predictions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {predictions.map((item) => {
                            const isCurrentUser = item.user.id === session.user.id;
                            const hasPred = Boolean(item.prediction);

                            return (
                                <div
                                    key={item.user.id}
                                    className={`rounded-lg p-4 border transition-all ${
                                        isCurrentUser
                                            ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-900 dark:text-white">
                                                {item.user.username}
                                            </span>
                                            {isCurrentUser && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                                                    {tCommon("you")}
                                                </span>
                                            )}
                                        </div>
                                        {match.resolved && hasPred && (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                                                {t("pointsEarned", { points: item.prediction!.points })}
                                            </span>
                                        )}
                                    </div>

                                    {hasPred ? (
                                        <div className="flex items-center justify-center py-2 px-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                                            <span className="text-base font-bold font-mono text-zinc-900 dark:text-white">
                                                {item.prediction!.homeGoals} : {item.prediction!.awayGoals}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="py-2 px-3 text-center bg-zinc-100/60 dark:bg-zinc-800/30 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700">
                                            <span className="text-xs text-zinc-500 italic">
                                                {t("noPredictionFromUser")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

