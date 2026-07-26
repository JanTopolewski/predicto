"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Competition {
    id: string;
    name: string;
    type: string;
    season: string;
    points: number;
    memberCount: number;
}

interface ApiResponse {
    competitions: Competition[];
}

export default function DashboardPage() {
    const { data: session } = useSession();
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCompetitions = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/competitions");

                if (!response.ok) {
                    throw new Error("Nie można pobrać konkurencji");
                }

                const data: ApiResponse = await response.json();
                setCompetitions(data.competitions || []);
            } catch (err) {
                setError("Błąd podczas pobierania konkurencji");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (session?.user?.id) {
            void fetchCompetitions();
        }
    }, [session?.user?.id]);

    const getCompetitionTypeLabel = (type: string) => {
        return type === "FOOTBALL" ? "Piłka nożna" : "Wyścigi";
    };

    const getCompetitionTypeColor = (type: string) => {
        return type === "FOOTBALL"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
            : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
    };

    const isAdmin = session?.user?.role === "ADMIN";

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                    Witaj, {session?.user?.name}! 👋
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                    Witaj w aplikacji Predicto - twojej platformie do obstawiania meczy
                    i wyścigów.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* My Competitions Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Moje konkurencje
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            Konkurencje, w których jesteś członkiem
                        </p>
                    </div>
                    <Link
                        href="/dashboard/competitions"
                        className="ml-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Przeglądaj konkurencje
                    </Link>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Ładowanie konkurencji...
                            </p>
                        </div>
                    ) : competitions.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Nie jesteś członkiem żadnej konkurencji
                            </p>
                            <Link
                                href="/dashboard/competitions"
                                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                            >
                                Dołącz do konkurencji
                            </Link>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Konkurencja
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Typ
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Sezon
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Twoje punkty
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Członkowie
                                </th>
                                <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                    Akcje
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {competitions.map((comp) => (
                                <tr
                                    key={comp.id}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                            {comp.name}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span
                                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCompetitionTypeColor(
                                              comp.type
                                          )}`}
                                      >
                                        {getCompetitionTypeLabel(comp.type)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            {comp.season}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                            {comp.points} pkt
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            {comp.memberCount}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/dashboard/competitions/${comp.id}`}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                        >
                                            Wejdź
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden">
                    {loading ? (
                        <div className="p-6 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Ładowanie konkurencji...
                            </p>
                        </div>
                    ) : competitions.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Nie jesteś członkiem żadnej konkurencji
                            </p>
                            <Link
                                href="/dashboard/competitions"
                                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm"
                            >
                                Dołącz do konkurencji
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {competitions.map((comp) => (
                                <div key={comp.id} className="p-4 space-y-3">
                                    {/* Row 1: Name and Button */}
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-semibold text-zinc-900 dark:text-white truncate">
                                            {comp.name}
                                        </h4>
                                        <Link
                                            href={`/dashboard/competitions/${comp.id}`}
                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors whitespace-nowrap flex-shrink-0"
                                        >
                                            Wejdź
                                        </Link>
                                    </div>

                                    {/* Row 2: Season */}
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        Sezon: {comp.season}
                                    </p>

                                    {/* Row 3: Grid with Typ, Punkty, Członkowie */}
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                            <p className="text-zinc-600 dark:text-zinc-400 mb-1">Typ</p>
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium w-full justify-center ${getCompetitionTypeColor(
                                                    comp.type
                                                )}`}
                                            >
                                                {getCompetitionTypeLabel(comp.type)}
                                            </span>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                            <p className="text-zinc-600 dark:text-zinc-400 mb-1">Punkty</p>
                                            <p className="font-semibold text-zinc-900 dark:text-white text-center">
                                                {comp.points}
                                            </p>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                            <p className="text-zinc-600 dark:text-zinc-400 mb-1">Członkowie</p>
                                            <p className="font-semibold text-zinc-900 dark:text-white text-center">
                                                {comp.memberCount}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Section - Create Competition */}
            {isAdmin && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">
                        Panel administratora
                    </h3>
                    <Link
                        href="/dashboard/competitions/create"
                        className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                    >
                        + Utwórz nową konkurencję
                    </Link>
                </div>
            )}
        </div>
    );
}