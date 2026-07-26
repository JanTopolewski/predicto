"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface CompetitionDetail {
    id: string;
    name: string;
    type: string;
    season: string;
    startDate: string;
    endDate: string;
    members: Array<{
        id: string;
        username: string;
        points: number;
    }>;
}

export default function CompetitionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const competitionId = params.id as string;

    useEffect(() => {
        const fetchCompetition = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/competitions/${competitionId}`);

                if (!response.ok) {
                    throw new Error("Nie można pobrać konkurencji");
                }

                const data = await response.json();
                setCompetition(data.competition);
            } catch (err) {
                setError("Błąd podczas pobierania konkurencji");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchCompetition();
    }, [competitionId]);

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

            {/* Ranking */}
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
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        Pozycja
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        Użytkownik
                                    </th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                        Punkty
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {rankingData.map((member) => (
                                    <tr
                                        key={member.id}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div
                                                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${getMedalColor(member.position)}`}
                                                >
                                                    {member.position}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
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
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                                {member.points} pkt
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                            {rankingData.map((member) => (
                                <div
                                    key={member.id}
                                    className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full font-bold text-white ${getMedalColor(member.position)}`}
                                        >
                                            {member.position}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className={`font-medium truncate ${
                                                    member.username === session?.user?.name
                                                        ? "text-blue-600 dark:text-blue-400"
                                                        : "text-zinc-900 dark:text-white"
                                                }`}
                                            >
                                                {member.username}
                                                {member.username === session?.user?.name && " (Ty)"}
                                            </p>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                                                {member.points} pkt
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                                {member.points}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}