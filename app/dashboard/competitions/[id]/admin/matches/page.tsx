"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
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
    predictedEndTime: string | null;
    status: string;
    resolved: boolean;
    votingClosedAt: string | null;
}

export default function AdminMatchesPage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const competitionId = params.id as string;

    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [homeTeamId, setHomeTeamId] = useState("");
    const [awayTeamId, setAwayTeamId] = useState("");
    const [kickoff, setKickoff] = useState("");
    const [predictedEndTime, setPredictedEndTime] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit match state
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [editHomeGoals, setEditHomeGoals] = useState("");
    const [editAwayGoals, setEditAwayGoals] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCalculating, setIsCalculating] = useState("");

    useEffect(() => {
        if (session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const [matchesRes, teamsRes] = await Promise.all([
                    fetch(`/api/competitions/${competitionId}/matches`),
                    fetch("/api/teams/sorted"),
                ]);

                if (!matchesRes.ok || !teamsRes.ok) {
                    throw new Error("Failed to fetch data");
                }

                const matchesData = await matchesRes.json();
                const teamsData = await teamsRes.json();

                setMatches(matchesData.matches || []);
                setTeams(teamsData.teams || []);
            } catch (err) {
                setError("Błąd podczas pobierania danych");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, [competitionId]);

    const handleCreateMatch = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setIsCreating(true);

        try {
            if (!homeTeamId || !awayTeamId || !kickoff) {
                setError("Wszystkie pola są wymagane");
                setIsCreating(false);
                return;
            }

            if (homeTeamId === awayTeamId) {
                setError("Wybierz różne drużyny");
                setIsCreating(false);
                return;
            }

            const response = await fetch(
                `/api/competitions/${competitionId}/matches`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        homeTeamId,
                        awayTeamId,
                        kickoff: new Date(kickoff).toISOString(),
                        predictedEndTime: predictedEndTime
                            ? new Date(predictedEndTime).toISOString()
                            : null,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Błąd podczas tworzenia meczu");
                setIsCreating(false);
                return;
            }

            const data = await response.json();
            setMatches([...matches, data.match]);
            setSuccessMessage("✓ Mecz został utworzony");

            // Reset form
            setHomeTeamId("");
            setAwayTeamId("");
            setKickoff("");
            setPredictedEndTime("");
            setShowForm(false);
            setIsCreating(false);

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Błąd podczas tworzenia meczu");
            console.error(err);
            setIsCreating(false);
        }
    };

    const handleUpdateMatch = async (matchId: string) => {
        if (editHomeGoals === "" || editAwayGoals === "") {
            setError("Wpisz wynik");
            return;
        }

        setError("");
        setSuccessMessage("");
        setIsUpdating(true);

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/matches/${matchId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        homeGoals: parseInt(editHomeGoals),
                        awayGoals: parseInt(editAwayGoals),
                        status: "FINISHED",
                        votingClosedAt: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Błąd podczas aktualizacji");
                setIsUpdating(false);
                return;
            }

            const data = await response.json();
            setMatches(
                matches.map((m) => (m.id === matchId ? data.match : m))
            );

            setSuccessMessage("✓ Wynik został zaktualizowany");
            setEditingMatchId(null);
            setEditHomeGoals("");
            setEditAwayGoals("");

            setIsCalculating(matchId);
            try {
                const calculateResponse = await fetch(
                    `/api/competitions/${competitionId}/matches/${matchId}/calculate-points`,
                    {
                        method: "POST",
                    }
                );

                if (calculateResponse.ok) {
                    setSuccessMessage("✓ Wynik zapisany i punkty obliczone");
                } else {
                    const errorData = await calculateResponse.json();
                    setError(errorData.error || "Błąd podczas liczenia punktów");
                }
            } catch (err) {
                console.error("Błąd podczas wyliczania punktów:", err);
                setError("Błąd podczas wyliczania punktów");
            } finally {
                setIsCalculating("");
                setIsUpdating(false);
            }

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Błąd podczas aktualizacji");
            console.error(err);
            setIsUpdating(false);
        }
    };

    const handleCalculatePoints = async (matchId: string) => {
        setError("");
        setSuccessMessage("");
        setIsCalculating(matchId);

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/matches/${matchId}/calculate-points`,
                {
                    method: "POST",
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Błąd podczas liczenia punktów");
                setIsCalculating("");
                return;
            }

            setSuccessMessage("✓ Punkty zostały obliczone");
            setIsCalculating("");

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Błąd podczas liczenia punktów");
            console.error(err);
            setIsCalculating("");
        }
    };

    const handleDeleteMatch = async (matchId: string) => {
        if (!window.confirm("Na pewno chcesz usunąć ten mecz?")) {
            return;
        }

        setError("");
        setSuccessMessage("");

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/matches/${matchId}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Błąd podczas usuwania");
                return;
            }

            setMatches(matches.filter((m) => m.id !== matchId));
            setSuccessMessage("✓ Mecz został usunięty");

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Błąd podczas usuwania");
            console.error(err);
        }
    };

    if (session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            Zarządzanie meczami
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            Tworzenie, edycja i liczenie punktów
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

            {/* Create Match Form */}
            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                    + Dodaj nowy mecz
                </button>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        Nowy mecz
                    </h3>

                    <form onSubmit={handleCreateMatch} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Drużyna domowa
                                </label>
                                <select
                                    value={homeTeamId}
                                    onChange={(e) =>
                                        setHomeTeamId(e.target.value)
                                    }
                                    disabled={isCreating}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">
                                        Wybierz drużynę...
                                    </option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Drużyna gościa
                                </label>
                                <select
                                    value={awayTeamId}
                                    onChange={(e) =>
                                        setAwayTeamId(e.target.value)
                                    }
                                    disabled={isCreating}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">
                                        Wybierz drużynę...
                                    </option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Data/Godzina meczu *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={kickoff}
                                    onChange={(e) => setKickoff(e.target.value)}
                                    disabled={isCreating}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Przewidywany koniec
                                </label>
                                <input
                                    type="datetime-local"
                                    value={predictedEndTime}
                                    onChange={(e) =>
                                        setPredictedEndTime(e.target.value)
                                    }
                                    disabled={isCreating}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isCreating ? "Tworzenie..." : "Utwórz mecz"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors"
                            >
                                Anuluj
                            </button>
                        </div>
                    </form>
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
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 space-y-4"
                        >
                            {/* Match Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                                    <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm font-medium">
                                        ✓ Zakończony
                                    </div>
                                )}
                            </div>

                            {/* Edit Score Section */}
                            {editingMatchId === match.id ? (
                                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg space-y-4">
                                    <h4 className="font-medium text-zinc-900 dark:text-white">
                                        Wpisz wynik
                                    </h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                                                {match.homeTeam.shortName}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editHomeGoals}
                                                onChange={(e) =>
                                                    setEditHomeGoals(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={isUpdating}
                                                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                                                {match.awayTeam.shortName}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editAwayGoals}
                                                onChange={(e) =>
                                                    setEditAwayGoals(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={isUpdating}
                                                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                handleUpdateMatch(match.id)
                                            }
                                            disabled={isUpdating}
                                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                                        >
                                            {isUpdating
                                                ? "Zapisywanie..."
                                                : "Zapisz wynik"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingMatchId(null);
                                                setEditHomeGoals("");
                                                setEditAwayGoals("");
                                            }}
                                            disabled={isUpdating}
                                            className="flex-1 px-3 py-2 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white text-sm font-medium rounded transition-colors"
                                        >
                                            Anuluj
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Score Display */}
                                    {match.resolved ? (
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg text-center">
                                            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                                                {match.homeGoals} :{" "}
                                                {match.awayGoals}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg text-center">
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                Brak wyniku
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingMatchId(match.id);
                                                if (match.homeGoals !== null)
                                                    setEditHomeGoals(
                                                        match.homeGoals.toString()
                                                    );
                                                if (match.awayGoals !== null)
                                                    setEditAwayGoals(
                                                        match.awayGoals.toString()
                                                    );
                                            }}
                                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded text-sm transition-colors"
                                        >
                                            ✏️ Wpisz wynik
                                        </button>

                                        <button
                                            onClick={() =>
                                                handleDeleteMatch(match.id)
                                            }
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded text-sm transition-colors"
                                        >
                                            ️ Usuń
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}