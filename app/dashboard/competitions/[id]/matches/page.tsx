"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Locale } from "@/i18n/config";
import { CheckIcon, LockIcon, AlertTriangleIcon } from "@/components/Icons";

interface Team {
    id: string;
    name: string;
    shortName: string;
}

interface MatchPrediction {
    id: string;
    homeGoals: number;
    awayGoals: number;
    points: number;
}

interface Match {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    homeGoals: number | null;
    awayGoals: number | null;
    kickoff: string;
    status: string;
    resolved: boolean;
    votingClosedAt: string | null;
    predictions: MatchPrediction[];
}

export default function MatchesPage() {
    const { data: session } = useSession();
    const params = useParams();
    const competitionId = params.id as string;

    const [matches, setMatches] = useState<Match[]>([]);
    const [predictions, setPredictions] = useState<
        Record<string, { homeGoals: string; awayGoals: string }>
    >({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [predictingMatchId, setPredictingMatchId] = useState<string | null>(
        null
    );
    const [editingMatchIds, setEditingMatchIds] = useState<Record<string, boolean>>({});

    const t = useTranslations("matches");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const locale = useLocale() as Locale;

    const hasPrediction = (match: Match) => {
        return match.predictions && match.predictions.length > 0;
    };

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                setLoading(true);
                const response = await fetch(
                    `/api/competitions/${competitionId}/matches`
                );

                if (!response.ok) {
                    const data = await response.json();
                    setError(apiError(data));
                    return;
                }

                const data = await response.json();
                setMatches(data.matches || []);
            } catch (err) {
                setError(apiError());
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchMatches();
    }, [competitionId, apiError]);

    const handlePrediction = async (
        matchId: string,
        homeGoals: number,
        awayGoals: number
    ) => {
        setError("");
        setSuccessMessage("");
        setPredictingMatchId(matchId);

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/matches/${matchId}/predictions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ homeGoals, awayGoals }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setPredictingMatchId(null);
                return;
            }

            setSuccessMessage(t("predictionSaved"));
            setError("");
            setEditingMatchIds((prev) => ({ ...prev, [matchId]: false }));

            const matchesResponse = await fetch(
                `/api/competitions/${competitionId}/matches`
            );
            if (matchesResponse.ok) {
                const data = await matchesResponse.json();
                setMatches(data.matches || []);
            }

            setTimeout(() => setSuccessMessage(""), 3000);
            setPredictingMatchId(null);
        } catch (err) {
            setError(apiError());
            console.error(err);
            setPredictingMatchId(null);
        }
    };

    const isVotingOpen = (match: Match) => {
        const now = new Date();
        const kickoff = new Date(match.kickoff);
        const votingClosed = match.votingClosedAt
            ? new Date(match.votingClosedAt)
            : kickoff;

        return now < votingClosed;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {t("title")}
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            {t("subtitle")}
                        </p>
                    </div>
                    <Link
                        href={`/dashboard/competitions/${competitionId}`}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base"
                    >
                        {tCommon("back")}
                    </Link>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error}
                    </p>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {successMessage}
                    </p>
                </div>
            )}

            {/* Matches List in a responsive grid on desktop */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : matches.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("noMatches")}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {matches.map((match) => (
                        <div
                            key={match.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
                        >
                            <div>
                                {/* Match Info */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                            {match.homeTeam.name} vs{" "}
                                            {match.awayTeam.name}
                                        </h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                            {new Date(match.kickoff).toLocaleString(
                                                locale
                                            )}
                                        </p>
                                    </div>

                                    {match.resolved && (
                                        <div className="text-center">
                                            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                                                {match.homeGoals} :{" "}
                                                {match.awayGoals}
                                            </p>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                                {t("result")}
                                            </p>
                                        </div>
                                    )}

                                    {!isVotingOpen(match) && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-sm font-medium self-start sm:self-auto">
                                            <LockIcon className="w-3.5 h-3.5" />
                                            <span>{t("votingClosed")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Prediction Display / Form */}
                            <div className="mt-4">
                                {match.predictions && match.predictions.length > 0 && !editingMatchIds[match.id] ? (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
                                                    {t("yourVote")}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {match.resolved && (
                                                    <span className="inline-flex items-center justify-center text-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 whitespace-nowrap leading-normal">
                                                        {t("pointsEarned", { points: match.predictions[0].points })}
                                                    </span>
                                                )}
                                                {!match.resolved && isVotingOpen(match) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPredictions((prev) => ({
                                                                ...prev,
                                                                [match.id]: {
                                                                    homeGoals: String(match.predictions[0].homeGoals),
                                                                    awayGoals: String(match.predictions[0].awayGoals),
                                                                },
                                                            }));
                                                            setEditingMatchIds((prev) => ({
                                                                ...prev,
                                                                [match.id]: true,
                                                            }));
                                                        }}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white dark:bg-zinc-800 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                                    >
                                                        {t("editPrediction")}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-center gap-3 text-lg font-bold text-zinc-900 dark:text-white">
                                            <span>{match.homeTeam.shortName}</span>
                                            <span className="px-3 py-1 rounded-md bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 text-xl font-mono">
                                                {match.predictions[0].homeGoals} : {match.predictions[0].awayGoals}
                                            </span>
                                            <span>{match.awayTeam.shortName}</span>
                                        </div>
                                    </div>
                                ) : isVotingOpen(match) ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                                    {match.homeTeam.shortName}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="20"
                                                    value={predictions[match.id]?.homeGoals ?? ""}
                                                    onChange={(e) =>
                                                        setPredictions({
                                                            ...predictions,
                                                            [match.id]: {
                                                                ...predictions[match.id],
                                                                homeGoals: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="w-full px-4 py-3 text-center text-2xl font-bold rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                                    {match.awayTeam.shortName}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="20"
                                                    value={predictions[match.id]?.awayGoals ?? ""}
                                                    onChange={(e) =>
                                                        setPredictions({
                                                            ...predictions,
                                                            [match.id]: {
                                                                ...predictions[match.id],
                                                                awayGoals: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="w-full px-4 py-3 text-center text-2xl font-bold rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            {match.predictions && match.predictions.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditingMatchIds((prev) => ({
                                                            ...prev,
                                                            [match.id]: false,
                                                        }))
                                                    }
                                                    className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg transition-colors"
                                                >
                                                    {t("cancelEdit")}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const pred =
                                                        predictions[match.id];
                                                    if (!pred) return;

                                                    if (pred.homeGoals === "" || pred.awayGoals === "") {
                                                        setError(t("scoreRequired"));
                                                        return;
                                                    }

                                                    const home = Number(pred.homeGoals);
                                                    const away = Number(pred.awayGoals);

                                                    if (
                                                        !Number.isInteger(home) ||
                                                        !Number.isInteger(away) ||
                                                        home < 0 ||
                                                        home > 20 ||
                                                        away < 0 ||
                                                        away > 20
                                                    ) {
                                                        setError(t("scoreRangeError"));
                                                        return;
                                                    }

                                                    setError("");
                                                    handlePrediction(match.id, home, away);
                                                }}
                                                disabled={
                                                    predictingMatchId === match.id ||
                                                    !predictions[match.id] ||
                                                    predictions[match.id].homeGoals === "" ||
                                                    predictions[match.id].awayGoals === ""
                                                }
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {predictingMatchId === match.id
                                                    ? t("saving")
                                                    : match.predictions && match.predictions.length > 0
                                                    ? t("updatePrediction")
                                                    : t("predict")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {match.resolved
                                                ? t("matchFinishedNoVoting")
                                                : t("votingClosed")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
