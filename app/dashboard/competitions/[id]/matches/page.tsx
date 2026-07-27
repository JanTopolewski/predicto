"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Team {
    id: string;
    name: string;
    shortName: string;
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
    predictions: { id: string }[];
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
                    throw new Error("Failed to fetch matches");
                }

                const data = await response.json();
                setMatches(data.matches || []);
            } catch (err) {
                setError("Błąd podczas pobierania meczy");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchMatches();
    }, [competitionId]);

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
                `/api/competitions/${competitionId}/matches/${matchId}/predict`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ homeGoals, awayGoals }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(
                    data.error ||
                    "Błąd podczas dodawania predykcji"
                );
                setPredictingMatchId(null);
                return;
            }

            setSuccessMessage("✓ Twoja predykcja została zapisana");

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
            setError("Błąd podczas dodawania predykcji");
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
                            Mecze
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            Obstawiaj mecze i zdobywaj punkty
                        </p>
                    </div>
                    <Link
                        href={`/dashboard/competitions/${competitionId}`}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base"
                    >
                        Wróć
                    </Link>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        ⚠️ {error}
                    </p>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {successMessage}
                    </p>
                </div>
            )}

            {/* Matches List */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Ładowanie meczy...
                    </p>
                </div>
            ) : matches.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Brak meczy
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {matches.map((match) => (
                        <div
                            key={match.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                        >
                            {/* Match Info */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                        {match.homeTeam.name} vs{" "}
                                        {match.awayTeam.name}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                        {new Date(match.kickoff).toLocaleString(
                                            "pl-PL"
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
                                            Wynik
                                        </p>
                                    </div>
                                )}

                                {!isVotingOpen(match) && (
                                    <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-sm font-medium">
                                        🔒 Głosowanie zamknięte
                                    </div>
                                )}
                            </div>

                            {/* Prediction Form */}
                            {isVotingOpen(match) && !match.resolved ? (
                                hasPrediction(match) ? (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center border border-emerald-200 dark:border-emerald-800">
                                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                            ✓ Twoja predykcja została zapisana
                                        </p>
                                    </div>
                                ) : (
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

                                        <button
                                            onClick={() => {
                                                const pred =
                                                    predictions[match.id];
                                                if (!pred) return;

                                                if (pred.homeGoals === "" || pred.awayGoals === "") {
                                                    setError("Podaj wynik obu drużyn");
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
                                                    setError("Wynik musi być z zakresu 0-20");
                                                    return;
                                                }

                                                handlePrediction(match.id, home, away);
                                            }}
                                            disabled={
                                                predictingMatchId === match.id ||
                                                !predictions[match.id] ||
                                                predictions[match.id].homeGoals === "" ||
                                                predictions[match.id].awayGoals === ""
                                            }
                                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {predictingMatchId === match.id
                                                ? "Zapisywanie..."
                                                : "Oddaj strzał"}
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {match.resolved
                                            ? "Mecz zakończony - brak możliwości obstawiania"
                                            : "Głosowanie na ten mecz jest zamknięte"}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}