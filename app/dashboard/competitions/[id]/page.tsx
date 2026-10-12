"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Match {
    id: string;
    homeTeam: { id: string; name: string; shortName: string };
    awayTeam: { id: string; name: string; shortName: string };
    homeGoals: number | null;
    awayGoals: number | null;
    kickoff: string;
    status: string;
    resolved: boolean;
    predictions: Array<{ id: string; userId: string; homeGoals: number; awayGoals: number }>;
}

interface Team {
    id: string;
    name: string;
}

interface Driver {
    id: string;
    name: string;
    number: number;
}

interface FootballSeasonPrediction {
    id: string;
    teamId?: string | null;
    team?: Team | null;
    driver?: never;
    driverId?: never;
}
interface RacingSeasonPrediction {
    id: string;
    driverId?: string | null;
    driver?: Driver | null;
    team?: never;
    teamId?: never;
}
type SeasonPrediction = FootballSeasonPrediction | RacingSeasonPrediction | {
    id: string;
    teamId?: string | null;
    driverId?: string | null;
    team?: Team | null;
    driver?: Driver | null;
    [key: string]: any;
};

interface CompetitionDetail {
    id: string;
    name: string;
    type: string;
    season: string;
    startDate: string;
    endDate: string;
    createdBy: string;
    members: Array<{
        id: string;
        username: string;
        points: number;
    }>;
    matches: Match[];
    allTeams: Team[];
    allDrivers: Driver[];
    seasonPrediction: SeasonPrediction | null;
    hasMatchStarted: boolean;
    winnerResolved: boolean;
}

export default function CompetitionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [predictingWinner, setPredictingWinner] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const competitionId = params.id as string;
    const isMember = competition?.members.some(m => m.id === session?.user?.id);
    const isAdmin = session?.user?.role === "ADMIN";
    const isOwner = competition?.createdBy === session?.user?.id;

    const fetchCompetition = useCallback(async () => {
        try {
            const response = await fetch(`/api/competitions/${competitionId}`);

            if (!response.ok) {
                throw new Error("Nie można pobrać konkurencji");
            }

            const data = await response.json();
            setCompetition(data.competition);

            const pred = data.competition.seasonPrediction;
            if (data.competition.type === "FOOTBALL" && pred?.team?.id) {
                setSelectedTeamId(pred.team.id);
            } else if (data.competition.type === "RACING" && pred?.driver?.id) {
                setSelectedDriverId(pred.driver.id);
            }
        } catch (err) {
            setError("Błąd podczas pobierania konkurencji");
            console.error(err);
        }
    }, [competitionId]);

    useEffect(() => {
        const loadCompetition = async () => {
            setLoading(true);
            await fetchCompetition();
            setLoading(false);
        };

        void loadCompetition();
    }, [fetchCompetition]);

    const handlePredictWinner = async () => {
        const selectedId = competition?.type === "FOOTBALL" ? selectedTeamId : selectedDriverId;

        if (!selectedId) {
            setError(competition?.type === "FOOTBALL" ? "Wybierz drużynę" : "Wybierz kierowcę");
            return;
        }

        setError("");
        setPredictingWinner(true);

        try {
            const endpoint = competition?.type === "FOOTBALL"
                ? `/api/competitions/${competitionId}/football/season-winner`
                : `/api/competitions/${competitionId}/racing/season-winner`;

            const bodyKey = competition?.type === "FOOTBALL" ? "teamId" : "driverId";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [bodyKey]: selectedId }),
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Błąd podczas zapisywania predykcji");
                setPredictingWinner(false);
                return;
            }

            setSuccessMessage("✓ Twoja predykcja została zapisana");
            setPredictingWinner(false);
            await fetchCompetition();
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Błąd podczas zapisywania predykcji");
            console.error(err);
            setPredictingWinner(false);
        }
    };

    const getCompetitionTypeLabel = (type: string) => {
        return type === "FOOTBALL" ? "Piłka nożna" : "Wyścigi";
    };

    const getRankingWithTies = (members: Array<{ id: string; username: string; points: number }>) => {
        const sorted = [...members].sort((a, b) => b.points - a.points);
        const ranking = [];
        let currentPosition = 1;

        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i].points !== sorted[i - 1].points) {
                currentPosition = i + 1;
            }
            ranking.push({
                ...sorted[i],
                position: currentPosition,
            });
        }

        return ranking;
    };

    const getMedalColor = (position: number) => {
        switch (position) {
            case 1:
                return "bg-yellow-500";
            case 2:
                return "bg-gray-400";
            case 3:
                return "bg-orange-600";
            default:
                return "bg-zinc-400";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-600 dark:text-zinc-400">Ładowanie konkurencji...</p>
            </div>
        );
    }

    if (error || !competition) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error || "Nie znaleziono konkurencji"}
                    </p>
                </div>
                <Link
                    href="/dashboard/competitions"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                    Wróć do listy
                </Link>
            </div>
        );
    }

    const rankingData = getRankingWithTies(competition.members);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {competition.name}
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            {getCompetitionTypeLabel(competition.type)} • Sezon {competition.season}
                        </p>
                    </div>
                    <Link
                        href="/dashboard/competitions"
                        className="px-4 sm:px-6 py-2.5 sm:py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base"
                    >
                        Wróć
                    </Link>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{successMessage}</p>
                </div>
            )}

            {/* Competition Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                        Data rozpoczęcia
                    </p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                        {new Date(competition.startDate).toLocaleDateString("pl-PL", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                        Data zakończenia
                    </p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                        {new Date(competition.endDate).toLocaleDateString("pl-PL", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
            </div>

            {/* Season Winner Prediction - For members and if first match/session didn't start */}
            {isMember && !isAdmin && !competition.hasMatchStarted && !competition.winnerResolved && !competition.seasonPrediction && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        {competition.type === "FOOTBALL" ? "🏆 Obstawiaj zwycięzcę sezonu" : "🏆 Obstawiaj zwycięzcę sezonu"}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        {competition.type === "FOOTBALL"
                            ? "Wybierz drużynę, która twoim zdaniem wygra sezon"
                            : "Wybierz kierowcę, który twoim zdaniem wygra sezon"}
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                            {competition.type === "FOOTBALL" ? "Drużyna" : "Kierowca"}
                        </label>
                        {competition.type === "FOOTBALL" ? (
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                disabled={predictingWinner}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Wybierz drużynę...</option>
                                {competition.allTeams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                disabled={predictingWinner}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Wybierz kierowcę...</option>
                                {competition.allDrivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.name} (#{driver.number})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <button
                        onClick={handlePredictWinner}
                        disabled={predictingWinner || !selectedTeamId && !selectedDriverId}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {predictingWinner ? "Zapisywanie..." : "Zapisz predykcję"}
                    </button>
                </div>
            )}

            {isMember && !isAdmin && competition.seasonPrediction && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                        🏆 Twój typ na zwycięzcę sezonu
                    </h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Wybrałeś: {competition.type === "FOOTBALL" 
                            ? (competition.seasonPrediction as any)?.team?.name 
                            : `${(competition.seasonPrediction as any)?.driver?.name} (#${(competition.seasonPrediction as any)?.driver?.number})`}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Głos został zarejestrowany i nie można go modyfikować.</p>
                </div>
            )}

            {isMember && competition.hasMatchStarted && !competition.seasonPrediction && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        {competition.type === "FOOTBALL"
                            ? "⚠️ Pierwszy mecz się już zaczął - nie możesz już obstawiać zwycięzcy sezonu"
                            : "⚠️ Pierwsza sesja się już zaczęła - nie możesz już obstawiać zwycięzcy sezonu"}
                    </p>
                </div>
            )}

            {/* Matches - For FOOTBALL members */}
            {isMember && competition.type === "FOOTBALL" && competition.matches.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        ⚽ Mecze
                    </h3>
                    <Link
                        href={`/dashboard/competitions/${competitionId}/matches`}
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Przeglądaj i obstawiaj mecze →
                    </Link>
                </div>
            )}

            {/* Racing Sessions - For RACING members */}
            {isMember && competition.type === "RACING" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        🏁 Sesje wyścigowe
                    </h3>
                    <Link
                        href={`/dashboard/competitions/${competitionId}/racing`}
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Przeglądaj i obstawiaj sesje →
                    </Link>
                </div>
            )}

            {(isMember || isAdmin) && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Ranking
                        </h3>
                    </div>

                    {competition.members.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Brak członków w konkurencji
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {rankingData.map((member) => (
                                <div
                                    key={member.id}
                                    className="p-4 sm:p-6 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div
                                        className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full font-bold text-white ${getMedalColor(member.position)}`}
                                    >
                                        {member.position}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`font-medium ${
                                                member.username === session?.user?.name
                                                    ? "text-blue-600 dark:text-blue-400"
                                                    : "text-zinc-900 dark:text-white"
                                            }`}
                                        >
                                            {member.username}
                                            {member.username === session?.user?.name && " (Ty)"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                            {member.points} pkt
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Admin Actions - FOOTBALL */}
            {isAdmin && isOwner && competition.type === "FOOTBALL" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        ⚙️ Panel administratora
                    </h3>
                    <div className="flex flex-col flex-wrap sm:flex-row gap-3">
                        <Link
                            href={`/dashboard/competitions/${competitionId}/admin/matches`}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center"
                        >
                            ⚽ Zarządzaj meczami
                        </Link>
                        <button
                            onClick={async () => {
                                if (window.confirm("Na pewno chcesz usunąć tę konkurencję? Ta akcja jest nieodwracalna!")) {
                                    try {
                                        const response = await fetch(`/api/competitions/${competitionId}/delete`, {
                                            method: "DELETE",
                                        });

                                        if (!response.ok) {
                                            alert("Błąd podczas usuwania konkurencji");
                                            return;
                                        }

                                        router.push("/dashboard/competitions");
                                    } catch (err) {
                                        alert("Błąd podczas usuwania konkurencji");
                                        console.error(err);
                                    }
                                }
                            }}
                            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                        >
                            🗑️ Usuń konkurencję
                        </button>

                        {!competition?.winnerResolved && (
                            <Link
                                href={`/dashboard/competitions/${competitionId}/admin/announce-winner`}
                                className="block w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-center"
                            >
                                🏆 Ogłoś zwycięzcę sezonu
                            </Link>
                        )}

                        {competition?.winnerResolved && (
                            <div className="w-full px-4 py-3 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 font-medium text-center">
                                ✓ Zwycięzca sezonu już ogłoszony
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Admin Actions - RACING */}
            {isAdmin && isOwner && competition.type === "RACING" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        ⚙️ Panel administratora
                    </h3>
                    <div className="flex flex-col flex-wrap sm:flex-row gap-3">
                        <Link
                            href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center"
                        >
                            🏁 Zarządzaj weekendami
                        </Link>
                        <button
                            onClick={async () => {
                                if (window.confirm("Na pewno chcesz usunąć tę konkurencję? Ta akcja jest nieodwracalna!")) {
                                    try {
                                        const response = await fetch(`/api/competitions/${competitionId}/delete`, {
                                            method: "DELETE",
                                        });

                                        if (!response.ok) {
                                            alert("Błąd podczas usuwania konkurencji");
                                            return;
                                        }

                                        router.push("/dashboard/competitions");
                                    } catch (err) {
                                        alert("Błąd podczas usuwania konkurencji");
                                        console.error(err);
                                    }
                                }
                            }}
                            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                        >
                            🗑️ Usuń konkurencję
                        </button>

                        {!competition?.winnerResolved && (
                            <Link
                                href={`/dashboard/competitions/${competitionId}/admin/racing/season-winner`}
                                className="block w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-center"
                            >
                                🏆 Ogłoś zwycięzcę sezonu
                            </Link>
                        )}

                        {competition?.winnerResolved && (
                            <div className="w-full px-4 py-3 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 font-medium text-center">
                                ✓ Zwycięzca sezonu już ogłoszony
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}